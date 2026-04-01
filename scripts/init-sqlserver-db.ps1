$ErrorActionPreference = 'Stop'

# Initializes SQL Server database: creates DB (if missing), runs schema, seeds data.
$backendDir = Join-Path $PSScriptRoot '..\backend'

if (!(Test-Path $backendDir)) {
  throw "Backend folder not found: $backendDir"
}

Push-Location $backendDir
try {
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

  Write-Host 'Initializing SQL Server database (schema + seed)...' -ForegroundColor Cyan
  & $venvPy scripts\init_sqlserver_db.py
} finally {
  Pop-Location
}
