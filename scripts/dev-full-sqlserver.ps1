$ErrorActionPreference = "Stop"

# Default to SQL Server mode, but do not override user-provided values
if (-not $env:PFE_STORAGE) { $env:PFE_STORAGE = "sqlserver" }
if (-not $env:SQLSERVER_SERVER) { $env:SQLSERVER_SERVER = ".\\SQLEXPRESS" }
if (-not $env:SQLSERVER_DATABASE) { $env:SQLSERVER_DATABASE = "PFE_PROJET" }

# ODBC Driver 18 encrypts by default; for local dev we keep a safe default.
if (-not $env:SQLSERVER_ENCRYPT) { $env:SQLSERVER_ENCRYPT = "yes" }
if (-not $env:SQLSERVER_TRUST_SERVER_CERTIFICATE) { $env:SQLSERVER_TRUST_SERVER_CERTIFICATE = "yes" }

Write-Host "Starting fullstack with SQL Server (backend uses --env-file):" -ForegroundColor Cyan
Write-Host "  Backend env-file: backend/.env.sqlserver" -ForegroundColor Cyan
Write-Host "Hint: edit backend/.env.sqlserver if your SSMS Server name differs" -ForegroundColor Yellow

function Resolve-BackendPort([int] $preferredPort) {
	if ($env:PFE_BACKEND_PORT) {
		try { return [int]$env:PFE_BACKEND_PORT } catch { }
	}

	for ($p = $preferredPort; $p -le ($preferredPort + 10); $p++) {
		$conn = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
		if (-not $conn) { return $p }

		# If netstat reports a PID we can't even see, the port is effectively blocked.
		$owning = [int]$conn.OwningProcess
		$proc = Get-Process -Id $owning -ErrorAction SilentlyContinue
		if (-not $proc) {
			continue
		}
	}

	return ($preferredPort + 1)
}

$resolvedPort = Resolve-BackendPort 8001
if ($resolvedPort -ne 8001) {
	Write-Host "Port 8001 is busy; using backend port $resolvedPort" -ForegroundColor Yellow
}

$env:PFE_BACKEND_PORT = "$resolvedPort"
$env:VITE_BACKEND_PORT = "$resolvedPort"
$env:VITE_API_PROXY_TARGET = "http://127.0.0.1:$resolvedPort"

concurrently -k -n BACKEND,FRONTEND -c blue,green "npm run dev:backend:sqlserver" "npm run dev:frontend"
