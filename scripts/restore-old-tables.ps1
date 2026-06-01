$ErrorActionPreference = 'Stop'

function Load-EnvFile {
  param([Parameter(Mandatory = $true)][string]$Path)
  if (-not (Test-Path $Path)) { return }

  Get-Content -LiteralPath $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#') -or $line -notmatch '=') { return }
    $parts = $line.Split('=', 2)
    Set-Item -Path "Env:$($parts[0].Trim())" -Value $parts[1].Trim().Trim('"').Trim("'")
  }
}

function Normalize-Text {
  param([AllowNull()][object]$Value)
  if ($null -eq $Value) { return '' }

  $normalized = ([string]$Value).Normalize([Text.NormalizationForm]::FormD)
  $builder = New-Object System.Text.StringBuilder
  foreach ($ch in $normalized.ToCharArray()) {
    if ([Globalization.CharUnicodeInfo]::GetUnicodeCategory($ch) -ne [Globalization.UnicodeCategory]::NonSpacingMark) {
      [void]$builder.Append($ch)
    }
  }

  $result = $builder.ToString().ToLowerInvariant()
  $result = [regex]::Replace($result, '[\s\-/\.]+', '_')
  $result = [regex]::Replace($result, '[^a-z0-9_]+', '')
  $result = [regex]::Replace($result, '_+', '_').Trim('_')
  return $result
}

function To-Text {
  param([AllowNull()][object]$Value)
  if ($null -eq $Value) { return '' }
  if ($Value -is [DateTime]) { return $Value.ToString('yyyy-MM-dd') }
  return ([string]$Value).Trim()
}

function To-Int {
  param([AllowNull()][object]$Value)
  $text = (To-Text $Value).Replace(',', '.')
  $out = 0
  if ([int]::TryParse($text, [ref]$out)) { return $out }
  $dbl = 0.0
  if ([double]::TryParse($text, [Globalization.NumberStyles]::Float, [Globalization.CultureInfo]::InvariantCulture, [ref]$dbl)) {
    return [int][Math]::Round($dbl)
  }
  return 0
}

function Parse-Date {
  param([AllowNull()][object]$Value)
  $text = To-Text $Value
  if (-not $text) { return $null }

  $dt = $null
  $styles = [Globalization.DateTimeStyles]::AllowWhiteSpaces
  foreach ($culture in @([Globalization.CultureInfo]::InvariantCulture, [Globalization.CultureInfo]::CurrentCulture)) {
    if ([DateTime]::TryParse($text, $culture, $styles, [ref]$dt)) { return $dt.Date }
  }
  return $null
}

function New-Id {
  param(
    [Parameter(Mandatory = $true)][string]$Prefix,
    [Parameter(ValueFromRemainingArguments = $true)]$Parts,
    [int]$MaxLen = 64
  )

  $raw = ($Parts | ForEach-Object { To-Text $_ } | Where-Object { $_ }) -join '_'
  $raw = Normalize-Text $raw
  if (-not $raw) { $raw = 'x' }
  $out = "$Prefix-$raw"
  if ($out.Length -le $MaxLen) { return $out }
  return $out.Substring(0, $MaxLen - 9) + '-' + $out.Substring($out.Length - 8)
}

function Get-RowValue {
  param(
    [Parameter(Mandatory = $true)]$Row,
    [Parameter(Mandatory = $true)][string[]]$Candidates
  )

  $properties = @($Row.PSObject.Properties)
  foreach ($candidate in $Candidates) {
    $normalizedCandidate = Normalize-Text $candidate
    foreach ($prop in $properties) {
      if ((Normalize-Text $prop.Name) -eq $normalizedCandidate) {
        if ($null -ne $prop.Value -and (To-Text $prop.Value)) { return $prop.Value }
      }
    }
  }
  return $null
}

function Escape-SqlText {
  param([AllowNull()][object]$Value)
  if ($null -eq $Value) { return 'NULL' }
  if ($Value -is [bool]) { return $(if ($Value) { '1' } else { '0' }) }
  if ($Value -is [int] -or $Value -is [long] -or $Value -is [decimal] -or $Value -is [double] -or $Value -is [single]) {
    return ([string]::Format([Globalization.CultureInfo]::InvariantCulture, '{0}', $Value))
  }
  if ($Value -is [DateTime]) { return "N'$(($Value).ToString('yyyy-MM-dd HH:mm:ss'))'" }
  if (($Value -is [System.Array]) -or ($Value -is [System.Collections.IDictionary]) -or ($Value -is [pscustomobject])) {
    $json = ($Value | ConvertTo-Json -Compress -Depth 20) -replace "'", "''"
    return "N'$json'"
  }

  $text = [string]$Value
  if ($text -match '^-?\d+(\.\d+)?$') { return $text }
  $text = $text -replace "'", "''"
  $text = $text -replace "`r`n|`r|`n", ' '
  return "N'$text'"
}

function Add-Insert {
  param(
    [Parameter(Mandatory = $true)][System.Collections.Generic.List[string]]$Sql,
    [Parameter(Mandatory = $true)][string]$Table,
    [Parameter(Mandatory = $true)][System.Collections.IDictionary]$Row
  )

  $cols = @($Row.Keys | ForEach-Object { "[$_]" }) -join ', '
  $vals = @($Row.Values | ForEach-Object { Escape-SqlText $_ }) -join ', '
  $Sql.Add("INSERT INTO dbo.[$Table] ($cols) VALUES ($vals);") | Out-Null
}

function Add-Delete {
  param(
    [Parameter(Mandatory = $true)][System.Collections.Generic.List[string]]$Sql,
    [Parameter(Mandatory = $true)][string]$Table
  )

  $Sql.Add("DELETE FROM dbo.[$Table];") | Out-Null
}

function Get-Workbook {
  param($Json, [string]$FileName)
  return ($Json | Where-Object { $_.file -eq $FileName } | Select-Object -First 1)
}

function Get-HeadersFromHeaderRow {
  param($HeaderRow)
  $headers = @()
  foreach ($prop in @($HeaderRow.PSObject.Properties)) { $headers += (To-Text $prop.Value) }
  return $headers
}

function Convert-OrderedRow {
  param([string[]]$Headers, $ValuesRow)
  $values = @($ValuesRow.PSObject.Properties | ForEach-Object { $_.Value })
  $out = [ordered]@{}
  for ($i = 0; $i -lt [Math]::Min($Headers.Count, $values.Count); $i++) {
    $header = To-Text $Headers[$i]
    if ($header) { $out[$header] = $values[$i] }
  }
  return $out
}

function Get-UniqueAssetTag {
  param(
    [string]$Serial,
    [AllowNull()][object]$Candidate,
    [System.Collections.Generic.HashSet[string]]$UsedTags
  )

  $tag = To-Text $Candidate
  if (-not $tag) { $tag = "SN-$Serial" }
  if ($UsedTags.Add($tag)) { return $tag }
  $fallback = "SN-$Serial"
  if ($UsedTags.Add($fallback)) { return $fallback }
  $suffix = 1
  while ($true) {
    $candidate = "SN-$Serial-$suffix"
    if ($UsedTags.Add($candidate)) { return $candidate }
    $suffix++
  }
}

function Build-StockInventory {
  param($Workbook, [System.Collections.Generic.HashSet[string]]$UsedAssetTags, [System.Collections.Generic.Dictionary[string, object]]$Assets, [System.Collections.Generic.Dictionary[string, object]]$Movements)

  foreach ($sheet in $Workbook.sheets) {
    foreach ($row in $sheet.rows) {
      $serial = To-Text (Get-RowValue $row @('SN'))
      if (-not $serial) { continue }

      $sheetName = To-Text $sheet.name
      $typeValue = To-Text (Get-RowValue $row @('TYPE'))
      $model = To-Text (Get-RowValue $row @('Model'))
      $description = To-Text (Get-RowValue $row @('DESCRIPTION'))
      $site = To-Text (Get-RowValue $row @('Plant'))
      $assetTag = Get-UniqueAssetTag -Serial $serial -Candidate (Get-RowValue $row @('Immo Number', 'BCI', 'VNC')) -UsedTags $UsedAssetTags
      $dateIn = Parse-Date (Get-RowValue $row @('Date In'))
      $dateOut = Parse-Date (Get-RowValue $row @('Date Out'))
      $pilote = To-Text (Get-RowValue $row @('Pilote'))

      $asset = [ordered]@{
        id = New-Id 'asset' $serial
        assetTag = $assetTag
        serialNumber = $serial
        macAddress = $null
        ipAddress = $null
        area = $null
        department = $null
        condition = $description
        model = $model
        type = if ($typeValue) { $typeValue.Trim() } else { $null }
        deviceProfile = $null
        category = if ($typeValue) { $typeValue.Trim() } else { $sheetName }
        supplier = 'Unknown'
        site = if ($site) { $site } else { 'Unknown' }
        status = if ($dateOut) { 'Assigned' } else { 'Available' }
        warrantyEndDate = if ($dateIn) { $dateIn.ToString('yyyy-MM-dd') } else { (Get-Date).Date.ToString('yyyy-MM-dd') }
        acquisitionDate = if ($dateIn) { $dateIn.ToString('yyyy-MM-dd') } else { (Get-Date).Date.ToString('yyyy-MM-dd') }
        value = 0
        description = $description
        bci = To-Text (Get-RowValue $row @('BCI'))
        bce = To-Text (Get-RowValue $row @('BCE'))
        bciCheck = $null
        vnc = To-Text (Get-RowValue $row @('VNC'))
        stockIn = To-Text (Get-RowValue $row @('Stock IN'))
        dateIn = if ($dateIn) { $dateIn.ToString('yyyy-MM-dd') } else { $null }
        pilote = $pilote
        stockOut = To-Text (Get-RowValue $row @('Stock Out'))
        dateOut = if ($dateOut) { $dateOut.ToString('yyyy-MM-dd') } else { $null }
        immoNumber = To-Text (Get-RowValue $row @('Immo Number'))
        pilote1 = To-Text (Get-RowValue $row @('Pilote_1', 'Pilote 1'))
        comment = To-Text (Get-RowValue $row @('Comment'))
        barcode = $null
        qrCode = $null
        storeLocation = $null
        cabinet = $null
        rack = $null
        level = $null
      }

      $Assets[$serial] = $asset

      if ($dateIn) {
        $moveId = New-Id 'mov' $asset.id 'Entry' $dateIn.ToString('yyyy-MM-dd')
        $Movements[$moveId] = [ordered]@{
          id = $moveId
          assetId = $asset.id
          type = 'Entry'
          sourceSite = $null
          destinationSite = if ($site) { $site } else { $null }
          date = $dateIn.ToString('yyyy-MM-dd')
          user = $pilote
          comment = To-Text (Get-RowValue $row @('Comment'))
        }
      }

      if ($dateOut) {
        $moveId = New-Id 'mov' $asset.id 'Exit' $dateOut.ToString('yyyy-MM-dd')
        $Movements[$moveId] = [ordered]@{
          id = $moveId
          assetId = $asset.id
          type = 'Exit'
          sourceSite = $null
          destinationSite = if ($site) { $site } else { $null }
          date = $dateOut.ToString('yyyy-MM-dd')
          user = $pilote
          comment = To-Text (Get-RowValue $row @('Comment'))
        }
      }
    }
  }
}

function Build-InventoryMa6 {
  param($Workbook, [System.Collections.Generic.HashSet[string]]$UsedAssetTags, [System.Collections.Generic.Dictionary[string, object]]$Assets, [System.Collections.Generic.Dictionary[string, object]]$Assignments)

  foreach ($sheet in $Workbook.sheets) {
    foreach ($row in $sheet.rows) {
      $sheetName = To-Text $sheet.name

      if ($sheetName -eq 'WS MA6') {
        $serial = To-Text (Get-RowValue $row @('WS_SN'))
        if (-not $serial) { continue }

        $acq = Parse-Date (Get-RowValue $row @("Date d’acquisition", "Date d'acquisition", 'Acquisition date'))
        $assignDate = Parse-Date (Get-RowValue $row @("date d'affectation", 'Date affectation', 'Assignement date', 'Assignment date', 'assignment_date'))
        $eos = Parse-Date (Get-RowValue $row @('Date end of Support', 'Date end of support', 'EOS'))
        $site = To-Text (Get-RowValue $row @('site', 'Site'))
        $userValue = To-Text (Get-RowValue $row @('user', 'Username'))
        $fullName = To-Text (Get-RowValue $row @('full name', 'Full Name'))
        $service = To-Text (Get-RowValue $row @('Service'))
        $hostname = To-Text (Get-RowValue $row @('hostname', 'Hostname'))
        $usb = To-Text (Get-RowValue $row @('USB'))
        $assetTag = Get-UniqueAssetTag -Serial $serial -Candidate (Get-RowValue $row @('immo ws', 'IMMO Number', 'hostname', 'Hostname')) -UsedTags $UsedAssetTags

        $asset = [ordered]@{
          id = New-Id 'asset' $serial
          assetTag = $assetTag
          serialNumber = $serial
          macAddress = $null
          ipAddress = $null
          area = $null
          department = $service
          condition = $null
          model = To-Text (Get-RowValue $row @('WS_model'))
          type = $null
          deviceProfile = $null
          category = 'Workstation'
          supplier = 'Unknown'
          site = if ($site) { $site } else { 'Unknown' }
          status = if ($assignDate) { 'Assigned' } else { 'Available' }
          warrantyEndDate = if ($eos) { $eos.ToString('yyyy-MM-dd') } elseif ($acq) { $acq.ToString('yyyy-MM-dd') } else { (Get-Date).Date.ToString('yyyy-MM-dd') }
          acquisitionDate = if ($acq) { $acq.ToString('yyyy-MM-dd') } else { (Get-Date).Date.ToString('yyyy-MM-dd') }
          value = 0
          description = $null
          bci = $null
          bce = $null
          bciCheck = $null
          vnc = $null
          stockIn = $null
          dateIn = $null
          pilote = $null
          stockOut = $null
          dateOut = $null
          immoNumber = To-Text (Get-RowValue $row @('immo ws', 'IMMO Number'))
          pilote1 = $null
          comment = $null
          barcode = $null
          qrCode = $null
          storeLocation = $null
          cabinet = $null
          rack = $null
          level = $null
        }

        $Assets[$serial] = $asset

        if ($assignDate -and $userValue) {
          $assignId = New-Id 'asn' $asset.id $assignDate.ToString('yyyy-MM-dd')
          $Assignments[$assignId] = [ordered]@{
            id = $assignId
            assetId = $asset.id
            brand = $null
            area = $null
            department = $service
            site = if ($site) { $site } else { 'Unknown' }
            startDate = $assignDate.ToString('yyyy-MM-dd')
            returnDate = $null
            status = 'Active'
            approvedBy = $null
            approvedAt = $null
            approvalSignature = $null
            device_category = 'Workstation'
            hostname = $hostname
            usb_status = $usb
            usb = $usb
            user = $userValue
            username = $userValue
            full_name = $fullName
            service = $service
            ws_sn = $serial
            ws_model = To-Text (Get-RowValue $row @('WS_model'))
            nb_sn = $null
            model_nb = $null
            mac_address = $null
            os = To-Text (Get-RowValue $row @('OS'))
            immo_ws = To-Text (Get-RowValue $row @('immo ws'))
            immo_number = $null
            bci_ws = To-Text (Get-RowValue $row @('bci ws'))
            bci = $null
            acquisition_date = if ($acq) { $acq.ToString('yyyy-MM-dd') } else { $null }
            assignment_date = if ($assignDate) { $assignDate.ToString('yyyy-MM-dd') } else { $null }
            end_of_support_date = if ($eos) { $eos.ToString('yyyy-MM-dd') } else { $null }
            monitor_model = To-Text (Get-RowValue $row @('monitor_model'))
            monitor_sn = To-Text (Get-RowValue $row @('monitor_SN', 'monitor_sn'))
            monitor_immo = To-Text (Get-RowValue $row @('monitor_immo'))
            monitor_bci = To-Text (Get-RowValue $row @('monitor_BCI', 'monitor_bci'))
          }
        }
        continue
      }

      if ($sheetName -eq 'NB') {
        $serial = To-Text (Get-RowValue $row @('NB SN', 'NB_SN', 'nb_sn'))
        if (-not $serial) { continue }

        $acq = Parse-Date (Get-RowValue $row @("Date d’acquisition", "Date d'acquisition", 'Acquisition date'))
        $assignDate = Parse-Date (Get-RowValue $row @("date d'affectation", 'Date affectation', 'Assignement date', 'Assignment date', 'assignment_date'))
        $eos = Parse-Date (Get-RowValue $row @('Date end of support', 'Date end of Support', 'EOS'))
        $site = To-Text (Get-RowValue $row @('Site', 'site'))
        $userValue = To-Text (Get-RowValue $row @('Username', 'user'))
        $fullName = To-Text (Get-RowValue $row @('full name', 'Full Name'))
        $service = To-Text (Get-RowValue $row @('Service'))
        $hostname = To-Text (Get-RowValue $row @('Hostname', 'hostname'))
        $usb = To-Text (Get-RowValue $row @('USB'))
        $assetTag = Get-UniqueAssetTag -Serial $serial -Candidate (Get-RowValue $row @('IMMO Number', 'Hostname', 'hostname')) -UsedTags $UsedAssetTags

        $asset = [ordered]@{
          id = New-Id 'asset' $serial
          assetTag = $assetTag
          serialNumber = $serial
          macAddress = To-Text (Get-RowValue $row @('Mac Adress', 'Mac address', 'mac address'))
          ipAddress = $null
          area = $null
          department = $service
          condition = $null
          model = To-Text (Get-RowValue $row @('Model NB', 'model nb'))
          type = $null
          deviceProfile = $null
          category = 'Notebook'
          supplier = 'Unknown'
          site = if ($site) { $site } else { 'Unknown' }
          status = if ($assignDate) { 'Assigned' } else { 'Available' }
          warrantyEndDate = if ($eos) { $eos.ToString('yyyy-MM-dd') } elseif ($acq) { $acq.ToString('yyyy-MM-dd') } else { (Get-Date).Date.ToString('yyyy-MM-dd') }
          acquisitionDate = if ($acq) { $acq.ToString('yyyy-MM-dd') } else { (Get-Date).Date.ToString('yyyy-MM-dd') }
          value = 0
          description = $null
          bci = $null
          bce = $null
          bciCheck = $null
          vnc = $null
          stockIn = $null
          dateIn = $null
          pilote = $null
          stockOut = $null
          dateOut = $null
          immoNumber = To-Text (Get-RowValue $row @('IMMO Number', 'Hostname', 'hostname'))
          pilote1 = $null
          comment = $null
          barcode = $null
          qrCode = $null
          storeLocation = $null
          cabinet = $null
          rack = $null
          level = $null
        }

        $Assets[$serial] = $asset

        if ($assignDate -and $userValue) {
          $assignId = New-Id 'asn' $asset.id $assignDate.ToString('yyyy-MM-dd')
          $Assignments[$assignId] = [ordered]@{
            id = $assignId
            assetId = $asset.id
            brand = $null
            area = $null
            department = $service
            site = if ($site) { $site } else { 'Unknown' }
            startDate = $assignDate.ToString('yyyy-MM-dd')
            returnDate = $null
            status = 'Active'
            approvedBy = $null
            approvedAt = $null
            approvalSignature = $null
            device_category = 'Notebook'
            hostname = $hostname
            usb_status = $usb
            usb = $usb
            user = $userValue
            username = $userValue
            full_name = $fullName
            service = $service
            ws_sn = $null
            ws_model = $null
            nb_sn = $serial
            model_nb = To-Text (Get-RowValue $row @('Model NB', 'model nb'))
            mac_address = To-Text (Get-RowValue $row @('Mac Adress', 'Mac address', 'mac address'))
            os = To-Text (Get-RowValue $row @('OS'))
            immo_ws = $null
            immo_number = To-Text (Get-RowValue $row @('IMMO Number', 'Hostname', 'hostname'))
            bci_ws = $null
            bci = $null
            acquisition_date = if ($acq) { $acq.ToString('yyyy-MM-dd') } else { $null }
            assignment_date = if ($assignDate) { $assignDate.ToString('yyyy-MM-dd') } else { $null }
            end_of_support_date = if ($eos) { $eos.ToString('yyyy-MM-dd') } else { $null }
            monitor_model = To-Text (Get-RowValue $row @('monitor_model'))
            monitor_sn = To-Text (Get-RowValue $row @('monitor_SN', 'monitor_sn'))
            monitor_immo = To-Text (Get-RowValue $row @('monitor_immo'))
            monitor_bci = To-Text (Get-RowValue $row @('monitor_BCI', 'monitor_bci'))
          }
        }
        continue
      }

      if ($sheetName -eq 'print') {
        $serial = To-Text (Get-RowValue $row @('Printer SN', 'printer sn', 'SN'))
        if (-not $serial) { continue }

        $acq = Parse-Date (Get-RowValue $row @('date reception', 'Date reception'))
        $assignDate = Parse-Date (Get-RowValue $row @('Date affectation', 'date affectation'))
        $eos = Parse-Date (Get-RowValue $row @('EOS', 'EOS '))
        $site = To-Text (Get-RowValue $row @('Site', 'site'))
        $area = To-Text (Get-RowValue $row @('Area'))
        $assetTag = Get-UniqueAssetTag -Serial $serial -Candidate (Get-RowValue $row @('printer name', 'Printer name', 'immo', 'Immo Number')) -UsedTags $UsedAssetTags

        $asset = [ordered]@{
          id = New-Id 'asset' $serial
          assetTag = $assetTag
          serialNumber = $serial
          macAddress = $null
          ipAddress = To-Text (Get-RowValue $row @('IP'))
          area = $area
          department = $null
          condition = $null
          model = To-Text (Get-RowValue $row @('printer model', 'Printer model', 'Model'))
          type = $null
          deviceProfile = $null
          category = 'Printer'
          supplier = 'Unknown'
          site = if ($site) { $site } else { 'Unknown' }
          status = if ($assignDate) { 'Assigned' } else { 'Available' }
          warrantyEndDate = if ($eos) { $eos.ToString('yyyy-MM-dd') } elseif ($acq) { $acq.ToString('yyyy-MM-dd') } else { (Get-Date).Date.ToString('yyyy-MM-dd') }
          acquisitionDate = if ($acq) { $acq.ToString('yyyy-MM-dd') } else { (Get-Date).Date.ToString('yyyy-MM-dd') }
          value = 0
          description = $null
          bci = $null
          bce = $null
          bciCheck = $null
          vnc = $null
          stockIn = $null
          dateIn = $null
          pilote = $null
          stockOut = $null
          dateOut = $null
          immoNumber = To-Text (Get-RowValue $row @('printer name', 'Printer name', 'immo', 'Immo Number'))
          pilote1 = $null
          comment = $null
          barcode = $null
          qrCode = $null
          storeLocation = $null
          cabinet = $null
          rack = $null
          level = $null
        }

        $Assets[$serial] = $asset
      }
    }
  }
}

function Build-PrinterTonerTables {
  param($Workbook, [System.Collections.Generic.Dictionary[string, object]]$Incidents, [System.Collections.Generic.Dictionary[string, object]]$Entries, [System.Collections.Generic.Dictionary[string, object]]$Exits, [System.Collections.Generic.Dictionary[string, object]]$MinQty)

  foreach ($sheet in $Workbook.sheets) {
    $name = To-Text $sheet.name

    if ($name -eq 'Incidents') {
      if (-not $sheet.rows -or $sheet.rows.Count -lt 2) { continue }
      $headers = Get-HeadersFromHeaderRow $sheet.rows[0]
      for ($i = 1; $i -lt $sheet.rows.Count; $i++) {
        $row = Convert-OrderedRow -Headers $headers -ValuesRow $sheet.rows[$i]
        $site = To-Text (Get-RowValue $row @('Site'))
        $printerName = To-Text (Get-RowValue $row @('Printer Name'))
        $demandType = To-Text (Get-RowValue $row @('Type of demand'))
        $ticket = To-Text (Get-RowValue $row @('N° Ticket CBI', 'N° Ticket', 'Ticket'))
        $nature = To-Text (Get-RowValue $row @('Nature du Probleme', 'Nature du Problème'))
        $serial = To-Text (Get-RowValue $row @('N° de Série Imprimante', 'N° de Série'))
        $model = To-Text (Get-RowValue $row @('Model Imprimante', 'Modèle Imprimante'))
        $claimDate = Parse-Date (Get-RowValue $row @('Date Reclamation', 'Date Réclamation'))
        $intervDate = Parse-Date (Get-RowValue $row @("Date D'intervention CBI", "Date d'intervention CBI"))
        $duration = To-Text (Get-RowValue $row @('Duree de traitement ticket', 'Duree de traitement ticket '))
        if (-not ($site -or $printerName -or $ticket -or $nature)) { continue }

        $id = New-Id 'pti' $site $printerName $ticket ($(if ($claimDate) { $claimDate.ToString('yyyy-MM-dd') } else { $null })) $nature
        $Incidents[$id] = [ordered]@{
          id = $id
          site = if ($site) { $site } else { $null }
          printerName = if ($printerName) { $printerName } else { $null }
          demandType = if ($demandType) { $demandType } else { $null }
          ticketNumber = if ($ticket) { $ticket } else { $null }
          problemNature = if ($nature) { $nature } else { $null }
          printerSerial = if ($serial) { $serial } else { $null }
          printerModel = if ($model) { $model } else { $null }
          claimDate = if ($claimDate) { $claimDate.ToString('yyyy-MM-dd HH:mm:ss') } else { $null }
          interventionDate = if ($intervDate) { $intervDate.ToString('yyyy-MM-dd HH:mm:ss') } else { $null }
          duration = if ($duration) { $duration } else { $null }
          status = if ($intervDate) { 'INTERVENUE' } else { 'NON_INTERVENUE' }
          raw = ($row | ConvertTo-Json -Compress -Depth 20)
          rawHeaders = ($headers | Where-Object { $_ }) | ConvertTo-Json -Compress
        }
      }
      continue
    }

    if ($name -eq 'Entrées') {
      foreach ($row in $sheet.rows) {
        $d = Parse-Date (Get-RowValue $row @("Date d'entrée", 'Date d entree'))
        $article = To-Text (Get-RowValue $row @('Article'))
        $code = To-Text (Get-RowValue $row @('Code Artice', 'Code Article'))
        $qty = To-Int (Get-RowValue $row @('Quantité', 'Quantite'))
        if (-not ($article -or $qty)) { continue }

        $id = New-Id 'pte' ($(if ($d) { $d.ToString('yyyy-MM-dd') } else { $null })) $article $code $qty
        $Entries[$id] = [ordered]@{
          id = $id
          date = if ($d) { $d.ToString('yyyy-MM-dd') } else { $null }
          article = if ($article) { $article } else { $null }
          articleCode = if ($code) { $code } else { $null }
          quantity = $qty
        }
      }
      continue
    }

    if ($name -eq 'Sorties') {
      foreach ($row in $sheet.rows) {
        $d = Parse-Date (Get-RowValue $row @('Date de sortie'))
        $article = To-Text (Get-RowValue $row @('Nom Article', 'Article'))
        $code = To-Text (Get-RowValue $row @('Code Artice', 'Code Article'))
        $qty = To-Int (Get-RowValue $row @('Quantité', 'Quantite'))
        if (-not ($article -or $qty)) { continue }

        $id = New-Id 'ptx' ($(if ($d) { $d.ToString('yyyy-MM-dd') } else { $null })) $article $code $qty
        $Exits[$id] = [ordered]@{
          id = $id
          date = if ($d) { $d.ToString('yyyy-MM-dd') } else { $null }
          article = if ($article) { $article } else { $null }
          articleCode = if ($code) { $code } else { $null }
          quantity = $qty
        }
      }
      continue
    }

    if ($name -eq 'AS3') {
      foreach ($row in $sheet.rows) {
        $ref = To-Text (Get-RowValue $row @('Référence ', 'Référence', 'Reference'))
        $color = (To-Text (Get-RowValue $row @('Couleur', 'Color'))).ToUpperInvariant()
        $qty = To-Int (Get-RowValue $row @('Nombre de toner ', 'Nombre de toner', 'Nombre de toner  '))
        if (-not ($ref -or $color -or $qty)) { continue }

        $id = New-Id 'ptm' $ref $color
        $MinQty[$id] = [ordered]@{
          id = $id
          ref = if ($ref) { $ref } else { $null }
          color = if ($color) { $color } else { $null }
          minQty = $qty
        }
      }
      continue
    }
  }
}

function Emit-TableRows {
  param([System.Collections.Generic.List[string]]$Sql, [string]$Table, $Rows)
  foreach ($row in $Rows.Values) { Add-Insert -Sql $Sql -Table $Table -Row $row }
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Load-EnvFile -Path (Join-Path $repoRoot 'backend\.env.sqlserver')

$jsonPath = Join-Path $repoRoot 'recovered\old-table-data.json'
if (-not (Test-Path $jsonPath)) { throw "Missing recovery file: $jsonPath" }
$data = Get-Content -LiteralPath $jsonPath -Raw | ConvertFrom-Json

$sqlLines = New-Object 'System.Collections.Generic.List[string]'
$sqlLines.Add('SET NOCOUNT ON;') | Out-Null
$sqlLines.Add('SET XACT_ABORT ON;') | Out-Null
$sqlLines.Add('BEGIN TRAN;') | Out-Null

foreach ($table in @('stock_movements', 'assignments', 'maintenance_tickets', 'printer_toner_incidents', 'printer_toner_entries', 'printer_toner_exits', 'printer_toner_min_qty', 'assets')) {
  Add-Delete -Sql $sqlLines -Table $table
}

$usedAssetTags = New-Object 'System.Collections.Generic.HashSet[string]'
$assets = New-Object 'System.Collections.Generic.Dictionary[string, object]'
$movements = New-Object 'System.Collections.Generic.Dictionary[string, object]'
$assignments = New-Object 'System.Collections.Generic.Dictionary[string, object]'
$incidents = New-Object 'System.Collections.Generic.Dictionary[string, object]'
$entries = New-Object 'System.Collections.Generic.Dictionary[string, object]'
$exits = New-Object 'System.Collections.Generic.Dictionary[string, object]'
$minQty = New-Object 'System.Collections.Generic.Dictionary[string, object]'

$stockWorkbook = Get-Workbook -Json $data -FileName 'MA6-Stock Inventory.xlsx'
$inventoryWorkbook = Get-Workbook -Json $data -FileName 'Inventory-MA6.xlsx'
$printerWorkbook = Get-Workbook -Json $data -FileName 'suivie incidents imprimantes.xlsm'

if ($stockWorkbook) { Build-StockInventory -Workbook $stockWorkbook -UsedAssetTags $usedAssetTags -Assets $assets -Movements $movements }
if ($inventoryWorkbook) { Build-InventoryMa6 -Workbook $inventoryWorkbook -UsedAssetTags $usedAssetTags -Assets $assets -Assignments $assignments }
if ($printerWorkbook) { Build-PrinterTonerTables -Workbook $printerWorkbook -Incidents $incidents -Entries $entries -Exits $exits -MinQty $minQty }

Emit-TableRows -Sql $sqlLines -Table 'assets' -Rows $assets
Emit-TableRows -Sql $sqlLines -Table 'stock_movements' -Rows $movements
Emit-TableRows -Sql $sqlLines -Table 'assignments' -Rows $assignments
Emit-TableRows -Sql $sqlLines -Table 'printer_toner_incidents' -Rows $incidents
Emit-TableRows -Sql $sqlLines -Table 'printer_toner_entries' -Rows $entries
Emit-TableRows -Sql $sqlLines -Table 'printer_toner_exits' -Rows $exits
Emit-TableRows -Sql $sqlLines -Table 'printer_toner_min_qty' -Rows $minQty

$sqlLines.Add('COMMIT;') | Out-Null

$tempSql = Join-Path $env:TEMP 'restore-old-tables.sql'
$sqlLines | Set-Content -LiteralPath $tempSql -Encoding UTF8

$server = if ($env:SQLSERVER_SERVER) { $env:SQLSERVER_SERVER } else { '.\SQLEXPRESS' }
$database = if ($env:SQLSERVER_DATABASE) { $env:SQLSERVER_DATABASE } else { 'PFE_PROJET' }

$sqlcmdArgs = if ($env:SQLSERVER_USER) {
  @('-S', $server, '-d', $database, '-U', $env:SQLSERVER_USER, '-P', $env:SQLSERVER_PASSWORD, '-C', '-b', '-i', $tempSql)
} else {
  @('-S', $server, '-d', $database, '-E', '-C', '-b', '-i', $tempSql)
}

Write-Host "Running sqlcmd against $server / $database"
& sqlcmd @sqlcmdArgs
if ($LASTEXITCODE -ne 0) { throw "sqlcmd failed with exit code $LASTEXITCODE" }

Write-Host 'Validation counts:'
$countQuery = "SELECT 'assets' AS table_name, COUNT(1) AS row_count FROM dbo.assets UNION ALL SELECT 'stock_movements', COUNT(1) FROM dbo.stock_movements UNION ALL SELECT 'assignments', COUNT(1) FROM dbo.assignments UNION ALL SELECT 'printer_toner_incidents', COUNT(1) FROM dbo.printer_toner_incidents UNION ALL SELECT 'printer_toner_entries', COUNT(1) FROM dbo.printer_toner_entries UNION ALL SELECT 'printer_toner_exits', COUNT(1) FROM dbo.printer_toner_exits UNION ALL SELECT 'printer_toner_min_qty', COUNT(1) FROM dbo.printer_toner_min_qty ORDER BY table_name"
$countArgs = if ($env:SQLSERVER_USER) {
  @('-S', $server, '-d', $database, '-U', $env:SQLSERVER_USER, '-P', $env:SQLSERVER_PASSWORD, '-Q', $countQuery)
} else {
  @('-S', $server, '-d', $database, '-E', '-Q', $countQuery)
}
& sqlcmd @countArgs$ErrorActionPreference = 'Stop'

function Load-EnvFile {
  param([Parameter(Mandatory = $true)][string]$Path)

  if (-not (Test-Path $Path)) {
    return
  }

  Get-Content -LiteralPath $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#') -or $line -notmatch '=') {
      return
    }

    $parts = $line.Split('=', 2)
    $key = $parts[0].Trim()
    $value = $parts[1].Trim().Trim('"').Trim("'")
    Set-Item -Path "Env:$key" -Value $value
  }
}

function Normalize-Text {
  param([AllowNull()][object]$Value)

  if ($null -eq $Value) {
    return ''
  }

  $text = [string]$Value
  $normalized = $text.Normalize([Text.NormalizationForm]::FormD)
  $builder = New-Object System.Text.StringBuilder
  foreach ($ch in $normalized.ToCharArray()) {
    if ([Globalization.CharUnicodeInfo]::GetUnicodeCategory($ch) -ne [Globalization.UnicodeCategory]::NonSpacingMark) {
      [void]$builder.Append($ch)
    }
  }

  $result = $builder.ToString().ToLowerInvariant()
  $result = [regex]::Replace($result, '[\s\-/\.]+', '_')
  $result = [regex]::Replace($result, '[^a-z0-9_]+', '')
  $result = [regex]::Replace($result, '_+', '_').Trim('_')
  return $result
}

function Get-RowValue {
  param(
    [Parameter(Mandatory = $true)]$Row,
    [Parameter(Mandatory = $true)][string[]]$Candidates
  )

  $properties = @($Row.PSObject.Properties)
  foreach ($candidate in $Candidates) {
    $normalizedCandidate = Normalize-Text $candidate
    foreach ($prop in $properties) {
      if ((Normalize-Text $prop.Name) -eq $normalizedCandidate) {
        $value = $prop.Value
        if ($null -ne $value -and ([string]$value).Trim()) {
          return $value
        }
      }
    }
  }

  return $null
}

function To-Text {
  param([AllowNull()][object]$Value)

  if ($null -eq $Value) {
    return ''
  }
  if ($Value -is [DateTime]) {
    return $Value.ToString('yyyy-MM-dd')
  }
  return ([string]$Value).Trim()
}

function Parse-Date {
  param([AllowNull()][object]$Value)

  $text = To-Text $Value
  if (-not $text) {
    return $null
  }

  $dt = $null
  $styles = [Globalization.DateTimeStyles]::AllowWhiteSpaces
  $cultures = @(
    [Globalization.CultureInfo]::InvariantCulture,
    [Globalization.CultureInfo]::CurrentCulture
  )

  foreach ($culture in $cultures) {
    if ([DateTime]::TryParse($text, $culture, $styles, [ref]$dt)) {
      return $dt.Date
    }
  }

  if ($text -match '^\d{1,2}/\d{1,2}/\d{2,4}(\s+\d{1,2}:\d{2}(:\d{2})?)?$') {
    foreach ($culture in $cultures) {
      if ([DateTime]::TryParse($text, $culture, $styles, [ref]$dt)) {
        return $dt.Date
      }
    }
  }

  return $null
}

function New-Id {
  param(
    [Parameter(Mandatory = $true)][string]$Prefix,
    [Parameter(ValueFromRemainingArguments = $true)]$Parts,
    [int]$MaxLen = 64
  )

  $raw = ($Parts | ForEach-Object { To-Text $_ } | Where-Object { $_ }) -join '_'
  $raw = Normalize-Text $raw
  if (-not $raw) {
    $raw = 'x'
  }

  $out = "$Prefix-$raw"
  if ($out.Length -le $MaxLen) {
    return $out
  }

  return $out.Substring(0, $MaxLen - 9) + '-' + $out.Substring($out.Length - 8)
}

function Escape-SqlText {
  param([AllowNull()][object]$Value)

  if ($null -eq $Value) {
    return 'NULL'
  }

  if ($Value -is [bool]) {
    return $(if ($Value) { '1' } else { '0' })
  }

  if ($Value -is [int] -or $Value -is [long] -or $Value -is [decimal] -or $Value -is [double] -or $Value -is [single]) {
    return ([string]::Format([Globalization.CultureInfo]::InvariantCulture, '{0}', $Value))
  }

  if ($Value -is [DateTime]) {
    return "N'$(($Value).ToString('yyyy-MM-dd HH:mm:ss'))'"
  }

  $text = [string]$Value
  if ($text -match '^-?\d+(\.\d+)?$') {
    return $text
  }

  $text = $text -replace "'", "''"
  $text = $text -replace "`r`n|`r|`n", ' '
  return "N'$text'"
}

function Add-Insert {
  param(
    [Parameter(Mandatory = $true)][System.Collections.Generic.List[string]]$Sql,
    [Parameter(Mandatory = $true)][string]$Table,
    [Parameter(Mandatory = $true)][ordered]$Row
  )

  $cols = @($Row.Keys | ForEach-Object { "[$_]" }) -join ', '
  $vals = @($Row.Values | ForEach-Object { Escape-SqlText $_ }) -join ', '
  $Sql.Add("INSERT INTO dbo.[$Table] ($cols) VALUES ($vals);") | Out-Null
}

function Add-Delete {
  param(
    [Parameter(Mandatory = $true)][System.Collections.Generic.List[string]]$Sql,
    [Parameter(Mandatory = $true)][string]$Table
  )

  $Sql.Add("DELETE FROM dbo.[$Table];") | Out-Null
}

function Get-Workbook {
  param(
    [Parameter(Mandatory = $true)]$Json,
    [Parameter(Mandatory = $true)][string]$FileName
  )

  return ($Json | Where-Object { $_.file -eq $FileName } | Select-Object -First 1)
}

function Get-HeadersFromHeaderRow {
  param([Parameter(Mandatory = $true)]$HeaderRow)

  $headers = @()
  foreach ($prop in @($HeaderRow.PSObject.Properties)) {
    $headers += (To-Text $prop.Value)
  }
  return $headers
}

function Convert-OrderedRow {
  param(
    [Parameter(Mandatory = $true)][string[]]$Headers,
    [Parameter(Mandatory = $true)]$ValuesRow
  )

  $values = @($ValuesRow.PSObject.Properties | ForEach-Object { $_.Value })
  $out = [ordered]@{}
  for ($i = 0; $i -lt [Math]::Min($Headers.Count, $values.Count); $i++) {
    $header = To-Text $Headers[$i]
    if (-not $header) { continue }
    $out[$header] = $values[$i]
  }
  return $out
}

function Get-UniqueAssetTag {
  param(
    [Parameter(Mandatory = $true)][string]$Serial,
    [AllowNull()][string]$Candidate,
    [Parameter(Mandatory = $true)][System.Collections.Generic.HashSet[string]]$UsedTags
  )

  $tag = To-Text $Candidate
  if (-not $tag) {
    $tag = "SN-$Serial"
  }

  if ($UsedTags.Add($tag)) {
    return $tag
  }

  $fallback = "SN-$Serial"
  if ($UsedTags.Add($fallback)) {
    return $fallback
  }

  $suffix = 1
  while ($true) {
    $candidate = "SN-$Serial-$suffix"
    if ($UsedTags.Add($candidate)) {
      return $candidate
    }
    $suffix++
  }
}

function Build-StockInventory {
  param(
    [Parameter(Mandatory = $true)]$Workbook,
    [Parameter(Mandatory = $true)][System.Collections.Generic.List[string]]$Sql,
    [Parameter(Mandatory = $true)][System.Collections.Generic.HashSet[string]]$UsedAssetTags,
    [Parameter(Mandatory = $true)][System.Collections.Generic.Dictionary[string, ordered]]$Assets,
    [Parameter(Mandatory = $true)][System.Collections.Generic.Dictionary[string, ordered]]$Movements
  )

  foreach ($sheet in $Workbook.sheets) {
    foreach ($row in $sheet.rows) {
      $serial = To-Text (Get-RowValue $row @('SN'))
      if (-not $serial) { continue }

      $sheetName = To-Text $sheet.name
      $typeValue = To-Text (Get-RowValue $row @('TYPE'))
      $model = To-Text (Get-RowValue $row @('Model'))
      $description = To-Text (Get-RowValue $row @('DESCRIPTION'))
      $site = To-Text (Get-RowValue $row @('Plant'))
      $assetTag = Get-UniqueAssetTag -Serial $serial -Candidate (Get-RowValue $row @('Immo Number', 'BCI', 'VNC')) -UsedTags $UsedAssetTags
      $dateIn = Parse-Date (Get-RowValue $row @('Date In'))
      $dateOut = Parse-Date (Get-RowValue $row @('Date Out'))
      $pilote = To-Text (Get-RowValue $row @('Pilote'))

      $asset = [ordered]@{
        id = New-Id 'asset' $serial
        assetTag = $assetTag
        serialNumber = $serial
        macAddress = $null
        ipAddress = $null
        area = $null
        department = $null
        condition = $description
        model = $model
        type = if ($typeValue) { $typeValue.Trim() } else { $null }
        deviceProfile = $null
        category = if ($typeValue) { $typeValue.Trim() } else { $sheetName }
        supplier = 'Unknown'
        site = if ($site) { $site } else { 'Unknown' }
        status = if ($dateOut) { 'Assigned' } else { 'Available' }
        warrantyEndDate = if ($dateIn) { $dateIn.ToString('yyyy-MM-dd') } else { (Get-Date).Date.ToString('yyyy-MM-dd') }
        acquisitionDate = if ($dateIn) { $dateIn.ToString('yyyy-MM-dd') } else { (Get-Date).Date.ToString('yyyy-MM-dd') }
        value = 0
        description = $description
        bci = To-Text (Get-RowValue $row @('BCI'))
        bce = To-Text (Get-RowValue $row @('BCE'))
        bciCheck = $null
        vnc = To-Text (Get-RowValue $row @('VNC'))
        stockIn = To-Text (Get-RowValue $row @('Stock IN'))
        dateIn = if ($dateIn) { $dateIn.ToString('yyyy-MM-dd') } else { $null }
        pilote = $pilote
        stockOut = To-Text (Get-RowValue $row @('Stock Out'))
        dateOut = if ($dateOut) { $dateOut.ToString('yyyy-MM-dd') } else { $null }
        immoNumber = To-Text (Get-RowValue $row @('Immo Number'))
        pilote1 = To-Text (Get-RowValue $row @('Pilote_1', 'Pilote 1'))
        comment = To-Text (Get-RowValue $row @('Comment'))
        barcode = $null
        qrCode = $null
        storeLocation = $null
        cabinet = $null
        rack = $null
        level = $null
      }

      $Assets[$serial] = $asset

      if ($dateIn) {
        $moveId = New-Id 'mov' $asset.id 'Entry' $dateIn.ToString('yyyy-MM-dd')
        $Movements[$moveId] = [ordered]@{
          id = $moveId
          assetId = $asset.id
          type = 'Entry'
          sourceSite = $null
          destinationSite = if ($site) { $site } else { $null }
          date = $dateIn.ToString('yyyy-MM-dd')
          user = $pilote
          comment = To-Text (Get-RowValue $row @('Comment'))
        }
      }

      if ($dateOut) {
        $moveId = New-Id 'mov' $asset.id 'Exit' $dateOut.ToString('yyyy-MM-dd')
        $Movements[$moveId] = [ordered]@{
          id = $moveId
          assetId = $asset.id
          type = 'Exit'
          sourceSite = $null
          destinationSite = if ($site) { $site } else { $null }
          date = $dateOut.ToString('yyyy-MM-dd')
          user = $pilote
          comment = To-Text (Get-RowValue $row @('Comment'))
        }
      }
    }
  }
}

function Build-InventoryMa6 {
  param(
    [Parameter(Mandatory = $true)]$Workbook,
    [Parameter(Mandatory = $true)][System.Collections.Generic.HashSet[string]]$UsedAssetTags,
    [Parameter(Mandatory = $true)][System.Collections.Generic.Dictionary[string, ordered]]$Assets,
    [Parameter(Mandatory = $true)][System.Collections.Generic.Dictionary[string, ordered]]$Assignments
  )

  foreach ($sheet in $Workbook.sheets) {
    foreach ($row in $sheet.rows) {
      $sheetName = To-Text $sheet.name

      if ($sheetName -eq 'WS MA6') {
        $serial = To-Text (Get-RowValue $row @('WS_SN'))
        if (-not $serial) { continue }

        $acq = Parse-Date (Get-RowValue $row @("Date d’acquisition", "Date d'acquisition", 'Acquisition date'))
        $assignDate = Parse-Date (Get-RowValue $row @("date d'affectation", 'Date affectation', 'Assignement date', 'Assignment date', 'assignment_date'))
        $eos = Parse-Date (Get-RowValue $row @('Date end of Support', 'Date end of support', 'EOS'))
        $site = To-Text (Get-RowValue $row @('site', 'Site'))
        $userName = To-Text (Get-RowValue $row @('user', 'Username'))
        $fullName = To-Text (Get-RowValue $row @('full name', 'Full Name'))
        $service = To-Text (Get-RowValue $row @('Service'))
        $hostname = To-Text (Get-RowValue $row @('hostname', 'Hostname'))
        $usb = To-Text (Get-RowValue $row @('USB'))
        $assetTag = Get-UniqueAssetTag -Serial $serial -Candidate (Get-RowValue $row @('immo ws', 'IMMO Number', 'hostname', 'Hostname')) -UsedTags $UsedAssetTags

        $asset = [ordered]@{
          id = New-Id 'asset' $serial
          assetTag = $assetTag
          serialNumber = $serial
          macAddress = $null
          ipAddress = $null
          area = $null
          department = $service
          condition = $null
          model = To-Text (Get-RowValue $row @('WS_model'))
          type = $null
          deviceProfile = $null
          category = 'Workstation'
          supplier = 'Unknown'
          site = if ($site) { $site } else { 'Unknown' }
          status = if ($assignDate) { 'Assigned' } else { 'Available' }
          warrantyEndDate = if ($eos) { $eos.ToString('yyyy-MM-dd') } elseif ($acq) { $acq.ToString('yyyy-MM-dd') } else { (Get-Date).Date.ToString('yyyy-MM-dd') }
          acquisitionDate = if ($acq) { $acq.ToString('yyyy-MM-dd') } else { (Get-Date).Date.ToString('yyyy-MM-dd') }
          value = 0
          description = $null
          bci = $null
          bce = $null
          bciCheck = $null
          vnc = $null
          stockIn = $null
          dateIn = $null
          pilote = $null
          stockOut = $null
          dateOut = $null
          immoNumber = To-Text (Get-RowValue $row @('immo ws', 'IMMO Number'))
          pilote1 = $null
          comment = $null
          barcode = $null
          qrCode = $null
          storeLocation = $null
          cabinet = $null
          rack = $null
          level = $null
        }

        $Assets[$serial] = $asset

        if ($assignDate -and $userName) {
          $assignId = New-Id 'asn' $asset.id $assignDate.ToString('yyyy-MM-dd')
          $Assignments[$assignId] = [ordered]@{
            id = $assignId
            assetId = $asset.id
            userName = $userName
            brand = $null
            area = $null
            department = $service
            site = if ($site) { $site } else { 'Unknown' }
            startDate = $assignDate.ToString('yyyy-MM-dd')
            returnDate = $null
            status = 'Active'
            approvedBy = $null
            approvedAt = $null
            approvalSignature = $null
            device_category = 'Workstation'
            hostname = $hostname
            usb_status = $usb
            usb = $usb
            user = $userName
            username = $userName
            full_name = $fullName
            service = $service
            ws_sn = $serial
            ws_model = To-Text (Get-RowValue $row @('WS_model'))
            nb_sn = $null
            model_nb = $null
            mac_address = $null
            os = To-Text (Get-RowValue $row @('OS'))
            immo_ws = To-Text (Get-RowValue $row @('immo ws'))
            immo_number = $null
            bci_ws = To-Text (Get-RowValue $row @('bci ws'))
            bci = $null
            acquisition_date = if ($acq) { $acq.ToString('yyyy-MM-dd') } else { $null }
            assignment_date = if ($assignDate) { $assignDate.ToString('yyyy-MM-dd') } else { $null }
            end_of_support_date = if ($eos) { $eos.ToString('yyyy-MM-dd') } else { $null }
            monitor_model = To-Text (Get-RowValue $row @('monitor_model'))
            monitor_sn = To-Text (Get-RowValue $row @('monitor_SN', 'monitor_sn'))
            monitor_immo = To-Text (Get-RowValue $row @('monitor_immo'))
            monitor_bci = To-Text (Get-RowValue $row @('monitor_BCI', 'monitor_bci'))
          }
        }
        continue
      }

      if ($sheetName -eq 'NB') {
        $serial = To-Text (Get-RowValue $row @('NB SN', 'NB_SN', 'nb_sn'))
        if (-not $serial) { continue }

        $acq = Parse-Date (Get-RowValue $row @("Date d’acquisition", "Date d'acquisition", 'Acquisition date'))
        $assignDate = Parse-Date (Get-RowValue $row @("date d'affectation", 'Date affectation', 'Assignement date', 'Assignment date', 'assignment_date'))
        $eos = Parse-Date (Get-RowValue $row @('Date end of support', 'Date end of Support', 'EOS'))
        $site = To-Text (Get-RowValue $row @('Site', 'site'))
        $userName = To-Text (Get-RowValue $row @('Username', 'user'))
        $fullName = To-Text (Get-RowValue $row @('full name', 'Full Name'))
        $service = To-Text (Get-RowValue $row @('Service'))
        $hostname = To-Text (Get-RowValue $row @('Hostname', 'hostname'))
        $usb = To-Text (Get-RowValue $row @('USB'))
        $assetTag = Get-UniqueAssetTag -Serial $serial -Candidate (Get-RowValue $row @('IMMO Number', 'Hostname', 'hostname')) -UsedTags $UsedAssetTags

        $asset = [ordered]@{
          id = New-Id 'asset' $serial
          assetTag = $assetTag
          serialNumber = $serial
          macAddress = To-Text (Get-RowValue $row @('Mac Adress', 'Mac address', 'mac address'))
          ipAddress = $null
          area = $null
          department = $service
          condition = $null
          model = To-Text (Get-RowValue $row @('Model NB', 'model nb'))
          type = $null
          deviceProfile = $null
          category = 'Notebook'
          supplier = 'Unknown'
          site = if ($site) { $site } else { 'Unknown' }
          status = if ($assignDate) { 'Assigned' } else { 'Available' }
          warrantyEndDate = if ($eos) { $eos.ToString('yyyy-MM-dd') } elseif ($acq) { $acq.ToString('yyyy-MM-dd') } else { (Get-Date).Date.ToString('yyyy-MM-dd') }
          acquisitionDate = if ($acq) { $acq.ToString('yyyy-MM-dd') } else { (Get-Date).Date.ToString('yyyy-MM-dd') }
          value = 0
          description = $null
          bci = $null
          bce = $null
          bciCheck = $null
          vnc = $null
          stockIn = $null
          dateIn = $null
          pilote = $null
          stockOut = $null
          dateOut = $null
          immoNumber = To-Text (Get-RowValue $row @('IMMO Number', 'Hostname', 'hostname'))
          pilote1 = $null
          comment = $null
          barcode = $null
          qrCode = $null
          storeLocation = $null
          cabinet = $null
          rack = $null
          level = $null
        }

        $Assets[$serial] = $asset

        if ($assignDate -and $userName) {
          $assignId = New-Id 'asn' $asset.id $assignDate.ToString('yyyy-MM-dd')
          $Assignments[$assignId] = [ordered]@{
            id = $assignId
            assetId = $asset.id
            userName = $userName
            brand = $null
            area = $null
            department = $service
            site = if ($site) { $site } else { 'Unknown' }
            startDate = $assignDate.ToString('yyyy-MM-dd')
            returnDate = $null
            status = 'Active'
            approvedBy = $null
            approvedAt = $null
            approvalSignature = $null
            device_category = 'Notebook'
            hostname = $hostname
            usb_status = $usb
            usb = $usb
            user = $userName
            username = $userName
            full_name = $fullName
            service = $service
            ws_sn = $null
            ws_model = $null
            nb_sn = $serial
            model_nb = To-Text (Get-RowValue $row @('Model NB', 'model nb'))
            mac_address = To-Text (Get-RowValue $row @('Mac Adress', 'Mac address', 'mac address'))
            os = To-Text (Get-RowValue $row @('OS'))
            immo_ws = $null
            immo_number = To-Text (Get-RowValue $row @('IMMO Number', 'Hostname', 'hostname'))
            bci_ws = $null
            bci = $null
            acquisition_date = if ($acq) { $acq.ToString('yyyy-MM-dd') } else { $null }
            assignment_date = if ($assignDate) { $assignDate.ToString('yyyy-MM-dd') } else { $null }
            end_of_support_date = if ($eos) { $eos.ToString('yyyy-MM-dd') } else { $null }
            monitor_model = To-Text (Get-RowValue $row @('monitor_model'))
            monitor_sn = To-Text (Get-RowValue $row @('monitor_SN', 'monitor_sn'))
            monitor_immo = To-Text (Get-RowValue $row @('monitor_immo'))
            monitor_bci = To-Text (Get-RowValue $row @('monitor_BCI', 'monitor_bci'))
          }
        }
        continue
      }

      if ($sheetName -eq 'print') {
        $serial = To-Text (Get-RowValue $row @('Printer SN', 'printer sn', 'SN'))
        if (-not $serial) { continue }

        $acq = Parse-Date (Get-RowValue $row @('date reception', 'Date reception'))
        $assignDate = Parse-Date (Get-RowValue $row @('Date affectation', 'date affectation'))
        $eos = Parse-Date (Get-RowValue $row @('EOS', 'EOS '))
        $site = To-Text (Get-RowValue $row @('Site', 'site'))
        $area = To-Text (Get-RowValue $row @('Area'))
        $assetTagCandidate = Get-RowValue $row @('printer name', 'Printer name', 'immo', 'Immo Number')
        $assetTag = Get-UniqueAssetTag -Serial $serial -Candidate $assetTagCandidate -UsedTags $UsedAssetTags

        $asset = [ordered]@{
          id = New-Id 'asset' $serial
          assetTag = $assetTag
          serialNumber = $serial
          macAddress = $null
          ipAddress = To-Text (Get-RowValue $row @('IP'))
          area = $area
          department = $null
          condition = $null
          model = To-Text (Get-RowValue $row @('printer model', 'Printer model', 'Model'))
          type = $null
          deviceProfile = $null
          category = 'Printer'
          supplier = 'Unknown'
          site = if ($site) { $site } else { 'Unknown' }
          status = if ($assignDate) { 'Assigned' } else { 'Available' }
          warrantyEndDate = if ($eos) { $eos.ToString('yyyy-MM-dd') } elseif ($acq) { $acq.ToString('yyyy-MM-dd') } else { (Get-Date).Date.ToString('yyyy-MM-dd') }
          acquisitionDate = if ($acq) { $acq.ToString('yyyy-MM-dd') } else { (Get-Date).Date.ToString('yyyy-MM-dd') }
          value = 0
          description = $null
          bci = $null
          bce = $null
          bciCheck = $null
          vnc = $null
          stockIn = $null
          dateIn = $null
          pilote = $null
          stockOut = $null
          dateOut = $null
          immoNumber = To-Text (Get-RowValue $row @('printer name', 'Printer name', 'immo', 'Immo Number'))
          pilote1 = $null
          comment = $null
          barcode = $null
          qrCode = $null
          storeLocation = $null
          cabinet = $null
          rack = $null
          level = $null
        }

        $Assets[$serial] = $asset
      }
    }
  }
}

function Build-PrinterTonerTables {
  param(
    [Parameter(Mandatory = $true)]$Workbook,
    [Parameter(Mandatory = $true)][System.Collections.Generic.Dictionary[string, ordered]]$Incidents,
    [Parameter(Mandatory = $true)][System.Collections.Generic.Dictionary[string, ordered]]$Entries,
    [Parameter(Mandatory = $true)][System.Collections.Generic.Dictionary[string, ordered]]$Exits,
    [Parameter(Mandatory = $true)][System.Collections.Generic.Dictionary[string, ordered]]$MinQty
  )

  foreach ($sheet in $Workbook.sheets) {
    $name = To-Text $sheet.name

    if ($name -eq 'Incidents') {
      if (-not $sheet.rows -or $sheet.rows.Count -lt 2) { continue }
      $headers = Get-HeadersFromHeaderRow $sheet.rows[0]
      for ($i = 1; $i -lt $sheet.rows.Count; $i++) {
        $row = Convert-OrderedRow -Headers $headers -ValuesRow $sheet.rows[$i]
        $site = To-Text (Get-RowValue $row @('Site'))
        $printerName = To-Text (Get-RowValue $row @('Printer Name'))
        $demandType = To-Text (Get-RowValue $row @('Type of demand'))
        $ticket = To-Text (Get-RowValue $row @('N° Ticket CBI', 'N° Ticket', 'Ticket'))
        $nature = To-Text (Get-RowValue $row @('Nature du Probleme', 'Nature du Problème'))
        $serial = To-Text (Get-RowValue $row @('N° de Série Imprimante', 'N° de Série'))
        $model = To-Text (Get-RowValue $row @('Model Imprimante', 'Modèle Imprimante'))
        $claimDate = Parse-Date (Get-RowValue $row @('Date Reclamation', 'Date Réclamation'))
        $intervDate = Parse-Date (Get-RowValue $row @("Date D'intervention CBI", "Date d'intervention CBI"))
        $duration = To-Text (Get-RowValue $row @('Duree de traitement ticket', 'Duree de traitement ticket '))

        if (-not ($site -or $printerName -or $ticket -or $nature)) { continue }

        $id = New-Id 'pti' $site $printerName $ticket ($(if ($claimDate) { $claimDate.ToString('yyyy-MM-dd') } else { $null })) $nature
        $Incidents[$id] = [ordered]@{
          id = $id
          site = if ($site) { $site } else { $null }
          printerName = if ($printerName) { $printerName } else { $null }
          demandType = if ($demandType) { $demandType } else { $null }
          ticketNumber = if ($ticket) { $ticket } else { $null }
          problemNature = if ($nature) { $nature } else { $null }
          printerSerial = if ($serial) { $serial } else { $null }
          printerModel = if ($model) { $model } else { $null }
          claimDate = if ($claimDate) { $claimDate.ToString('yyyy-MM-dd HH:mm:ss') } else { $null }
          interventionDate = if ($intervDate) { $intervDate.ToString('yyyy-MM-dd HH:mm:ss') } else { $null }
          duration = if ($duration) { $duration } else { $null }
          status = if ($intervDate) { 'INTERVENUE' } else { 'NON_INTERVENUE' }
          raw = ($row | ConvertTo-Json -Compress)
          rawHeaders = ($headers | Where-Object { $_ })
        }
      }
      continue
    }

    if ($name -eq 'Entrées') {
      foreach ($row in $sheet.rows) {
        $d = Parse-Date (Get-RowValue $row @("Date d'entrée", 'Date d entree'))
        $article = To-Text (Get-RowValue $row @('Article'))
        $code = To-Text (Get-RowValue $row @('Code Artice', 'Code Article'))
        $qty = [int](To-Text (Get-RowValue $row @('Quantité', 'Quantite')) -as [int])
        if (-not ($article -or $qty)) { continue }

        $id = New-Id 'pte' ($(if ($d) { $d.ToString('yyyy-MM-dd') } else { $null })) $article $code $qty
        $Entries[$id] = [ordered]@{
          id = $id
          date = if ($d) { $d.ToString('yyyy-MM-dd') } else { $null }
          article = if ($article) { $article } else { $null }
          articleCode = if ($code) { $code } else { $null }
          quantity = if ($qty) { $qty } else { 0 }
        }
      }
      continue
    }

    if ($name -eq 'Sorties') {
      foreach ($row in $sheet.rows) {
        $d = Parse-Date (Get-RowValue $row @('Date de sortie'))
        $article = To-Text (Get-RowValue $row @('Nom Article', 'Article'))
        $code = To-Text (Get-RowValue $row @('Code Artice', 'Code Article'))
        $qty = [int](To-Text (Get-RowValue $row @('Quantité', 'Quantite')) -as [int])
        if (-not ($article -or $qty)) { continue }

        $id = New-Id 'ptx' ($(if ($d) { $d.ToString('yyyy-MM-dd') } else { $null })) $article $code $qty
        $Exits[$id] = [ordered]@{
          id = $id
          date = if ($d) { $d.ToString('yyyy-MM-dd') } else { $null }
          article = if ($article) { $article } else { $null }
          articleCode = if ($code) { $code } else { $null }
          quantity = if ($qty) { $qty } else { 0 }
        }
      }
      continue
    }

    if ($name -eq 'AS3') {
      foreach ($row in $sheet.rows) {
        $ref = To-Text (Get-RowValue $row @('Référence ', 'Référence', 'Reference'))
        $color = To-Text (Get-RowValue $row @('Couleur', 'Color')).ToUpperInvariant()
        $qty = [int](To-Text (Get-RowValue $row @('Nombre de toner ', 'Nombre de toner', 'Nombre de toner  ')) -as [int])
        if (-not ($ref -or $color -or $qty)) { continue }

        $id = New-Id 'ptm' $ref $color
        $MinQty[$id] = [ordered]@{
          id = $id
          ref = if ($ref) { $ref } else { $null }
          color = if ($color) { $color } else { $null }
          minQty = if ($qty) { $qty } else { 0 }
        }
      }
      continue
    }
  }
}

function Emit-TableRows {
  param(
    [Parameter(Mandatory = $true)][System.Collections.Generic.List[string]]$Sql,
    [Parameter(Mandatory = $true)][string]$Table,
    [Parameter(Mandatory = $true)]$Rows
  )

  foreach ($row in $Rows.Values) {
    Add-Insert -Sql $Sql -Table $Table -Row $row
  }
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$envPath = Join-Path $repoRoot 'backend\.env.sqlserver'
Load-EnvFile -Path $envPath

$jsonPath = Join-Path $repoRoot 'recovered\old-table-data.json'
if (-not (Test-Path $jsonPath)) {
  throw "Missing recovery file: $jsonPath"
}

$data = Get-Content -LiteralPath $jsonPath -Raw | ConvertFrom-Json

$sqlLines = New-Object 'System.Collections.Generic.List[string]'
$sqlLines.Add('SET NOCOUNT ON;') | Out-Null
$sqlLines.Add('SET XACT_ABORT ON;') | Out-Null
$sqlLines.Add('BEGIN TRAN;') | Out-Null

# Clear the operational tables that are restored from the old workbooks.
foreach ($table in @('stock_movements', 'assignments', 'maintenance_tickets', 'printer_toner_incidents', 'printer_toner_entries', 'printer_toner_exits', 'printer_toner_min_qty', 'assets')) {
  Add-Delete -Sql $sqlLines -Table $table
}

$usedAssetTags = New-Object 'System.Collections.Generic.HashSet[string]'
$assets = New-Object 'System.Collections.Generic.Dictionary[string, ordered]'
$movements = New-Object 'System.Collections.Generic.Dictionary[string, ordered]'
$assignments = New-Object 'System.Collections.Generic.Dictionary[string, ordered]'
$incidents = New-Object 'System.Collections.Generic.Dictionary[string, ordered]'
$entries = New-Object 'System.Collections.Generic.Dictionary[string, ordered]'
$exits = New-Object 'System.Collections.Generic.Dictionary[string, ordered]'
$minQty = New-Object 'System.Collections.Generic.Dictionary[string, ordered]'

$stockWorkbook = Get-Workbook -Json $data -FileName 'MA6-Stock Inventory.xlsx'
$inventoryWorkbook = Get-Workbook -Json $data -FileName 'Inventory-MA6.xlsx'
$printerWorkbook = Get-Workbook -Json $data -FileName 'suivie incidents imprimantes.xlsm'

if ($stockWorkbook) {
  Build-StockInventory -Workbook $stockWorkbook -Sql $sqlLines -UsedAssetTags $usedAssetTags -Assets $assets -Movements $movements
}

if ($inventoryWorkbook) {
  Build-InventoryMa6 -Workbook $inventoryWorkbook -UsedAssetTags $usedAssetTags -Assets $assets -Assignments $assignments
}

if ($printerWorkbook) {
  Build-PrinterTonerTables -Workbook $printerWorkbook -Incidents $incidents -Entries $entries -Exits $exits -MinQty $minQty
}

Emit-TableRows -Sql $sqlLines -Table 'assets' -Rows $assets
Emit-TableRows -Sql $sqlLines -Table 'stock_movements' -Rows $movements
Emit-TableRows -Sql $sqlLines -Table 'assignments' -Rows $assignments
Emit-TableRows -Sql $sqlLines -Table 'printer_toner_incidents' -Rows $incidents
Emit-TableRows -Sql $sqlLines -Table 'printer_toner_entries' -Rows $entries
Emit-TableRows -Sql $sqlLines -Table 'printer_toner_exits' -Rows $exits
Emit-TableRows -Sql $sqlLines -Table 'printer_toner_min_qty' -Rows $minQty

$sqlLines.Add('COMMIT;') | Out-Null

$tempSql = Join-Path $env:TEMP 'restore-old-tables.sql'
$sqlLines | Set-Content -LiteralPath $tempSql -Encoding UTF8

$server = $env:SQLSERVER_SERVER
if (-not $server) { $server = '.\SQLEXPRESS' }
$database = $env:SQLSERVER_DATABASE
if (-not $database) { $database = 'PFE_PROJET' }

$sqlcmdArgs = @('-S', $server, '-d', $database, '-C', '-b', '-i', $tempSql)
if ($env:SQLSERVER_USER) {
  $sqlcmdArgs = @('-S', $server, '-d', $database, '-U', $env:SQLSERVER_USER, '-P', $env:SQLSERVER_PASSWORD, '-C', '-b', '-i', $tempSql)
} else {
  $sqlcmdArgs = @('-S', $server, '-d', $database, '-E', '-C', '-b', '-i', $tempSql)
}

Write-Host "Running sqlcmd against $server / $database"
& sqlcmd @sqlcmdArgs

if ($LASTEXITCODE -ne 0) {
  throw "sqlcmd failed with exit code $LASTEXITCODE"
}

Write-Host 'Validation counts:'
& sqlcmd @sqlcmdArgs[0..($sqlcmdArgs.Count - 2)] -Q "SELECT 'assets' AS table_name, COUNT(1) AS row_count FROM dbo.assets UNION ALL SELECT 'stock_movements', COUNT(1) FROM dbo.stock_movements UNION ALL SELECT 'assignments', COUNT(1) FROM dbo.assignments UNION ALL SELECT 'printer_toner_incidents', COUNT(1) FROM dbo.printer_toner_incidents UNION ALL SELECT 'printer_toner_entries', COUNT(1) FROM dbo.printer_toner_entries UNION ALL SELECT 'printer_toner_exits', COUNT(1) FROM dbo.printer_toner_exits UNION ALL SELECT 'printer_toner_min_qty', COUNT(1) FROM dbo.printer_toner_min_qty ORDER BY table_name"$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$pythonExe = Join-Path $repoRoot '.venv\Scripts\python.exe'

if (-not (Test-Path $pythonExe)) {
  throw "Python executable not found: $pythonExe"
}

& $pythonExe "backend/scripts/restore_old_tables.py"