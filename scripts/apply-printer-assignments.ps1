param(
  [string]$BaseUrl = "http://127.0.0.1:5173/api",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Normalize-Serial([string]$s) {
  if (-not $s) { return "" }
  return ($s -replace '[^A-Za-z0-9]', '').ToUpperInvariant()
}

function Parse-DateToIso([string]$s) {
  if (-not $s) { return $null }
  $s = $s.Trim()
  if (-not $s) { return $null }

  # yyyy-mm-dd
  $iso = [regex]::Match($s, '^(\d{4})-(\d{2})-(\d{2})$')
  if ($iso.Success) {
    try {
      return (Get-Date -Date $s).ToString('yyyy-MM-dd')
    } catch {
      return $null
    }
  }

  # dd/mm/yyyy
  $fr = [regex]::Match($s, '^(\d{1,2})/(\d{1,2})/(\d{4})$')
  if ($fr.Success) {
    $d = [int]$fr.Groups[1].Value
    $m = [int]$fr.Groups[2].Value
    $y = [int]$fr.Groups[3].Value
    try {
      return (Get-Date -Year $y -Month $m -Day $d).ToString('yyyy-MM-dd')
    } catch {
      return $null
    }
  }

  return $null
}

$BaseUrl = $BaseUrl.TrimEnd('/')

$printers = @(
  @{ serial = '99J251701862'; area = 'AS2'; assignment_date = '12/11/2025' },
  @{ serial = '99J251701860'; area = 'AS2'; assignment_date = '12/11/2025' },
  @{ serial = '99J251701858'; area = 'AS2'; assignment_date = '12/11/2025' },
  @{ serial = '21010352'; area = 'AS2'; assignment_date = '17/09/2025' },
  @{ serial = 'CZBBT7Z0QH'; area = 'Open_Space' },
  @{ serial = 'CZBBT80078'; area = 'Open_Space' },
  @{ serial = 'CZBBT7Z0QL'; area = 'bureau Maintenance' },
  @{ serial = 'CZBBT80003'; area = 'bureau logistique' },
  @{ serial = 'CZBBT720QJ'; area = 'Open_Space' }
)

if (-not $DryRun) {
  $health = Invoke-RestMethod -Method Get -Uri "$BaseUrl/health"
  Write-Host "health: status=$($health.status) storage=$($health.storage) sqlserver=$($health.sqlserver)"
}

$assetsBySerial = @{}
if (-not $DryRun) {
  $assets = Invoke-RestMethod -Method Get -Uri "$BaseUrl/assets?limit=10000"
  if ($assets -is [string]) { $assets = $assets | ConvertFrom-Json }
  foreach ($a in $assets) {
    $sn = Normalize-Serial([string]$a.serialNumber)
    if ($sn) { $assetsBySerial[$sn] = [string]$a.id }
  }
  Write-Host "assets: loaded=$($assets.Count) mapped_by_serial=$($assetsBySerial.Keys.Count)"
}

$assignments = @()
if (-not $DryRun) {
  $assignments = Invoke-RestMethod -Method Get -Uri "$BaseUrl/assignments?limit=1000"
  if ($assignments -is [string]) { $assignments = $assignments | ConvertFrom-Json }
  Write-Host "assignments: loaded=$($assignments.Count)"
}

function Pick-ActiveAssignment($assetId, $assignments) {
  $active = @($assignments | Where-Object {
    ([string]($_.assetId)) -eq $assetId -and (([string]($_.status)) -ne 'Returned')
  })
  if ($active.Count -eq 0) { return $null }

  $printer = $active | Where-Object { ([string]($_.device_category)) -eq 'Printer' } | Select-Object -First 1
  if ($printer) { return $printer }

  return $active | Select-Object -First 1
}

$created = 0
$updated = 0
$skipped = 0
$missingAssets = @()
$failed = @()

foreach ($p in $printers) {
  $serialNorm = Normalize-Serial([string]$p.serial)
  $area = ([string]$p.area).Trim()
  if (-not $serialNorm -or -not $area) { $skipped += 1; continue }

  $assetId = $assetsBySerial[$serialNorm]
  if (-not $assetId) {
    $missingAssets += $serialNorm
    continue
  }

  $dtIso = Parse-DateToIso([string]$p.assignment_date)

  $existing = Pick-ActiveAssignment $assetId $assignments

  if ($existing) {
    $patch = @{ device_category = 'Printer'; area = $area; status = 'Active' }
    if ($dtIso) { $patch.assignment_date = $dtIso; $patch.startDate = $dtIso }

    if ($DryRun) {
      Write-Host "PATCH assignment $($existing.id) serial=$serialNorm area=$area"
      $updated += 1
    } else {
      try {
        Invoke-RestMethod -Method Patch -Uri "$BaseUrl/assignments/$($existing.id)" -ContentType 'application/json' -Body ($patch | ConvertTo-Json)
        $updated += 1
      } catch {
        $failed += "serial=$serialNorm patch_error=$($_.Exception.Message)"
      }
    }
    continue
  }

  $newId = "PRN-$serialNorm"
  $payload = @{ id = $newId; assetId = $assetId; device_category = 'Printer'; area = $area; status = 'Active' }
  if ($dtIso) { $payload.assignment_date = $dtIso; $payload.startDate = $dtIso }

  if ($DryRun) {
    Write-Host "CREATE assignment $newId serial=$serialNorm area=$area"
    $created += 1
  } else {
    try {
      try {
        Invoke-RestMethod -Method Post -Uri "$BaseUrl/assignments" -ContentType 'application/json' -Body ($payload | ConvertTo-Json)
        $created += 1
      } catch {
        # If already exists, patch it
        Invoke-RestMethod -Method Patch -Uri "$BaseUrl/assignments/$newId" -ContentType 'application/json' -Body (@{ device_category = 'Printer'; area = $area; status = 'Active' } | ConvertTo-Json)
        $updated += 1
      }
    } catch {
      $failed += "serial=$serialNorm create_error=$($_.Exception.Message)"
    }
  }
}

Write-Host ""
Write-Host "summary:"
Write-Host "  created=$created updated=$updated skipped=$skipped"
Write-Host "  missing_assets=$($missingAssets.Count) failed=$($failed.Count)"

if ($missingAssets.Count -gt 0) {
  Write-Host "missing_assets_serials:"
  $missingAssets | Sort-Object -Unique | ForEach-Object { Write-Host "  - $_" }
}

if ($failed.Count -gt 0) {
  Write-Host "failed:"
  $failed | ForEach-Object { Write-Host "  - $_" }
}
