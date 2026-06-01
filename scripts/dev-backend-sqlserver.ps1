$ErrorActionPreference = 'Stop'

# Starts FastAPI backend in SQL Server mode via uvicorn --env-file (reliable with --reload).
$backendDir = Join-Path $PSScriptRoot '..\backend'

if (!(Test-Path $backendDir)) {
  throw "Backend folder not found: $backendDir"
}

Push-Location $backendDir
$exitCode = 0
try {
  function Stop-ListenerOnPort([int] $port) {
    $maxAttempts = 8
    for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
      $conns = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
      if (-not $conns -or $conns.Count -eq 0) { return }

      $pids = @($conns | Select-Object -ExpandProperty OwningProcess -Unique | Where-Object { $_ -ne $null })
      foreach ($listenerPid in $pids) {
        $targetPid = [int]$listenerPid
        if ($targetPid -eq $PID) {
          throw "Refusing to stop current shell (PID=$PID) that is listening on port $port. Close other terminals and retry."
        }

        $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$targetPid" -ErrorAction SilentlyContinue
        $procName = if ($proc -and $proc.Name) { $proc.Name } else { 'unknown' }
        $msg = if ($attempt -eq 1) {
          "Port $port is already in use by PID=$targetPid ($procName). Stopping it..."
        } else {
          "Port $port is still in use by PID=$targetPid ($procName). Retrying ($attempt/$maxAttempts)..."
        }
        Write-Host $msg -ForegroundColor Yellow

        $prevEap2 = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        try {
          Stop-Process -Id $targetPid -Force 2>$null
          & taskkill.exe /PID $targetPid /F /T 1>$null 2>$null
        } finally {
          $ErrorActionPreference = $prevEap2
        }
      }

      Start-Sleep -Milliseconds (400 + (100 * $attempt))
    }

    $remaining = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
    if ($remaining -and $remaining.Count -gt 0) {
      $remainingPids = @($remaining | Select-Object -ExpandProperty OwningProcess -Unique)
      throw "Port $port is still in use (PID(s)=$($remainingPids -join ', ')). Close them and retry."
    }
  }

  function Import-EnvFile([string] $filePath) {
    if (!(Test-Path $filePath)) { return }
    Get-Content $filePath | ForEach-Object {
      $line = $_.Trim()
      if ($line.Length -eq 0) { return }
      if ($line.StartsWith('#')) { return }
      $parts = $line.Split('=', 2)
      if ($parts.Count -ne 2) { return }
      $key = $parts[0].Trim()
      $value = $parts[1].Trim()
      if (-not (Test-Path "Env:$key")) { Set-Item -Path "Env:$key" -Value $value }
    }
  }

  # Optional local env for LLM tuning (does not override already-set env vars)
  Import-EnvFile (Join-Path $backendDir '.env')
  Import-EnvFile (Join-Path $backendDir '.env.local')

  function Test-PythonExecutable([string] $pythonExe) {
    if (![string]::IsNullOrWhiteSpace($pythonExe) -and (Test-Path $pythonExe)) {
      & $pythonExe -c "import sys; print(sys.executable)" 1>$null
      return ($LASTEXITCODE -eq 0)
    }
    return $false
  }

  function Resolve-SystemPython {
    $cmd = Get-Command python -ErrorAction SilentlyContinue
    if ($cmd -and $cmd.Path) { return $cmd.Path }

    $py = Get-Command py -ErrorAction SilentlyContinue
    if ($py -and $py.Path) { return "$($py.Path) -3" }

    throw 'Python is not available on PATH. Install Python 3.x and try again.'
  }

  $venvPy = Join-Path $backendDir '.venv\Scripts\python.exe'

  $venvOk = Test-PythonExecutable $venvPy
  if (-not $venvOk) {
    if (Test-Path (Join-Path $backendDir '.venv')) {
      Write-Host 'Detected broken backend/.venv. Recreating virtualenv...' -ForegroundColor Yellow
      Remove-Item -Recurse -Force (Join-Path $backendDir '.venv')
    }

    $systemPython = Resolve-SystemPython
    if ($systemPython -like '* -3') {
      & py -3 -m venv .venv
    } else {
      & $systemPython -m venv .venv
    }

    if (-not (Test-Path $venvPy)) {
      throw 'Failed to create backend/.venv (python.exe missing).'
    }

    Write-Host 'Installing backend dependencies (SQL Server)...' -ForegroundColor Cyan
    & $venvPy -m pip install --upgrade pip
    & $venvPy -m pip install -r requirements-sqlserver.txt
  }

  # Ensure new deps are present even if the venv already existed.
  # Important: with $ErrorActionPreference='Stop', native stderr can become a terminating error.
  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  & $venvPy -c "import httpx" *> $null
  $ErrorActionPreference = $prevEap

  if ($LASTEXITCODE -ne 0) {
    Write-Host 'Installing missing backend dependency: httpx' -ForegroundColor Cyan
    & $venvPy -m pip install -r requirements-sqlserver.txt
  }

  # FastAPI UploadFile/FormData requires python-multipart.
  $prevEapM = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  & $venvPy -c "import multipart" *> $null
  $ErrorActionPreference = $prevEapM

  if ($LASTEXITCODE -ne 0) {
    Write-Host 'Installing missing backend dependency: python-multipart' -ForegroundColor Cyan
    & $venvPy -m pip install -r requirements-sqlserver.txt
  }

  # SQL Server driver for Python.
  $prevEapOdbc = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  & $venvPy -c "import pyodbc" *> $null
  $ErrorActionPreference = $prevEapOdbc

  if ($LASTEXITCODE -ne 0) {
    Write-Host 'Installing missing backend dependency: pyodbc' -ForegroundColor Cyan
    & $venvPy -m pip install -r requirements-sqlserver.txt
  }

  function Test-BackendHealth([int] $port) {
    $prevEapH = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
      return Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:$port/health" -TimeoutSec 2
    } catch {
      return $null
    } finally {
      $ErrorActionPreference = $prevEapH
    }
  }

  $port = 8001
  if ($env:PFE_BACKEND_PORT) {
    try { $port = [int]$env:PFE_BACKEND_PORT } catch { $port = 8001 }
  }

  $existingHealth = Test-BackendHealth $port
  if ($existingHealth -and $existingHealth.status -eq 'ok') {
    $storage = if ($existingHealth.storage) { $existingHealth.storage } else { 'unknown' }
    if ($storage -eq 'sqlserver') {
      Write-Host "Backend already running on http://127.0.0.1:$port (storage=sqlserver). Reusing it." -ForegroundColor Yellow
      while ($true) { Start-Sleep -Seconds 3600 }
    }
  }

  # Load backend/.env.sqlserver into the current process env (so child Python definitely inherits it).
  $envFile = Join-Path $backendDir '.env.sqlserver'
  if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
      $line = $_.Trim()
      if ($line.Length -eq 0) { return }
      if ($line.StartsWith('#')) { return }
      $parts = $line.Split('=', 2)
      if ($parts.Count -ne 2) { return }
      $key = $parts[0].Trim()
      $value = $parts[1].Trim()
      Set-Item -Path "Env:$key" -Value $value
    }
  }

  Write-Host "Backend (SQL Server) starting (no --reload)" -ForegroundColor Cyan
  Write-Host "  PFE_STORAGE=$env:PFE_STORAGE" -ForegroundColor Cyan
  Write-Host "  SQLSERVER_SERVER=$env:SQLSERVER_SERVER" -ForegroundColor Cyan
  Write-Host "  SQLSERVER_DATABASE=$env:SQLSERVER_DATABASE" -ForegroundColor Cyan
  Write-Host "  Backend port=$port" -ForegroundColor Cyan

  try {
    Stop-ListenerOnPort $port
  } catch {
    $health = Test-BackendHealth $port
    if ($health -and $health.status -eq 'ok') {
      $storage = if ($health.storage) { $health.storage } else { 'unknown' }
      if ($storage -ne 'sqlserver') {
        Write-Host "Backend already running on http://127.0.0.1:$port (storage=$storage). Expected storage=sqlserver." -ForegroundColor Yellow
      } else {
        Write-Host "Backend already running on http://127.0.0.1:$port (storage=sqlserver). Reusing it." -ForegroundColor Yellow
      }
      while ($true) { Start-Sleep -Seconds 3600 }
    }
    throw
  }

  & $venvPy -m uvicorn app.main:app --env-file .env.sqlserver --host 127.0.0.1 --port $port
  $exitCode = $LASTEXITCODE
} finally {
  Pop-Location
}

exit $exitCode
