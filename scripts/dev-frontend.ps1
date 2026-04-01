$ErrorActionPreference = 'Stop'

# Starts Vite frontend dev server, ensuring port 5173 is free.

function Stop-ListenerOnPort([int] $port) {
  $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $conn) { return }

  $targetPid = [int]$conn.OwningProcess
  if ($targetPid -eq $PID) {
    throw "Refusing to stop current shell (PID=$PID) that is listening on port $port. Close other terminals and retry."
  }

  $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$targetPid" -ErrorAction SilentlyContinue
  $procName = if ($proc -and $proc.Name) { $proc.Name } else { 'unknown' }
  Write-Host "Port $port is already in use by PID=$targetPid ($procName). Stopping it..." -ForegroundColor Yellow

  Stop-Process -Id $targetPid -Force -ErrorAction SilentlyContinue
  Start-Sleep -Milliseconds 600

  $conn2 = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($conn2) {
    $pid2 = [int]$conn2.OwningProcess
    if ($pid2 -ne $targetPid) {
      Write-Host "Port $port is now owned by PID=$pid2. Attempting to stop it as well..." -ForegroundColor Yellow
      Stop-Process -Id $pid2 -Force -ErrorAction SilentlyContinue
      Start-Sleep -Milliseconds 600
    }

    $conn3 = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($conn3) {
      $pid3 = [int]$conn3.OwningProcess
      Write-Host "Port $port is still in use (PID=$pid3). Forcing termination of the full process tree..." -ForegroundColor Yellow
      $prevEap2 = $ErrorActionPreference
      $ErrorActionPreference = 'Continue'
      try {
        & taskkill.exe /PID $pid3 /F /T 1>$null 2>$null
      } finally {
        $ErrorActionPreference = $prevEap2
      }
      Start-Sleep -Milliseconds 900
    }

    $conn4 = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($conn4) {
      throw "Port $port is still in use (PID=$($conn4.OwningProcess)). Close it and retry."
    }
  }
}

Stop-ListenerOnPort 5173

# Run Vite via npm so PATH/.bin resolution stays consistent.
& npm.cmd run dev:frontend:raw
exit $LASTEXITCODE
