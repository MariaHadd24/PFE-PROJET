$ErrorActionPreference = 'Stop'

function Stop-PortListener([int] $port) {
  try {
    $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -eq $conn) { return }

    $pid = [int]$conn.OwningProcess
    if ($pid -le 0) { return }

    Write-Host "Stopping process on port $port (PID=$pid)" -ForegroundColor Yellow
    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
  } catch {
    # Best-effort cleanup
  }
}

# Free ports used by fullstack dev
$port = 8001
if ($env:PFE_BACKEND_PORT) {
  try { $port = [int]$env:PFE_BACKEND_PORT } catch { $port = 8001 }
}
Stop-PortListener $port
Stop-PortListener 5173

# Small delay to let sockets release
Start-Sleep -Milliseconds 400

npm.cmd run dev:full:sqlserver
