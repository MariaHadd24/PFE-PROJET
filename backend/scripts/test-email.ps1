$ErrorActionPreference = 'Stop'

# Run SMTP test from backend/ reliably.
$backendDir = Split-Path -Parent $PSScriptRoot
Push-Location $backendDir
try {
  python scripts\test_email.py @Args
} finally {
  Pop-Location
}
