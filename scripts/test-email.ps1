$ErrorActionPreference = 'Stop'

# Run SMTP test from repo root reliably.
$repoRoot = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $repoRoot 'backend'
Push-Location $backendDir
try {
  python scripts\test_email.py @Args
} finally {
  Pop-Location
}
