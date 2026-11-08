# Generate districts.js on Windows when Node.js is not installed.
# ASCII-only on purpose: Windows PowerShell 5 reads .ps1 as ANSI unless the file has a UTF-8 BOM.
#
# Usage (from the project root):
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/gen-districts.ps1 -OutPath districts.js
#
# Same rules as scripts/gen-districts.mjs: prefecture city -> district/county/county-level city/banner.
# Source: npm china-division@2.7.0 dist/pca-code.json (compiled from MCA administrative divisions).
# Network is used only while generating; the app itself stays fully offline.

param(
  [Parameter(Mandatory = $true)][string]$OutPath
)
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$url = 'https://unpkg.com/china-division@2.7.0/dist/pca-code.json'
Write-Host "downloading $url"
$tree = Invoke-RestMethod -Uri $url -UseBasicParsing

# 11/12/31/50 = Beijing/Tianjin/Shanghai/Chongqing. Their level 2 is already the district list in regions.js.
$municipal = @('11', '12', '31', '50')
$data = [ordered]@{}
$provinceCount = 0
$directGroups = 0

foreach ($p in $tree) {
  if ($null -eq $p) { continue }
  $provinceCount++
  if ($municipal -contains [string]$p.code) { continue }
  if ($null -eq $p.children) { continue }
  foreach ($c in $p.children) {
    if ($null -eq $c -or -not $c.name) { continue }
    # xx90 = province-direct county-level group; it is a level-2 entry in regions.js and has no level 3.
    if ([string]$c.code -like '*90') { $directGroups++; continue }
    $arr = @()
    if ($null -ne $c.children) {
      foreach ($d in $c.children) {
        if ($null -ne $d -and $d.name) { $arr += [string]$d.name }
      }
    }
    if ($arr.Count -gt 0) { $data[[string]$c.name] = $arr }
  }
}

$cityCount = $data.Count
$districtCount = 0
foreach ($k in $data.Keys) { $districtCount += $data[$k].Count }

Write-Host "provinces=$provinceCount cities=$cityCount districts=$districtCount directGroups=$directGroups"

if ($cityCount -lt 300 -or $districtCount -lt 2700) {
  Write-Error "validation failed: too few entries (cities=$cityCount districts=$districtCount)"
  exit 1
}

$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine('/* Nationwide prefecture -> county offline table (auto-generated, do not edit by hand).')
[void]$sb.AppendLine('   Generator: scripts/gen-districts.ps1 or gen-districts.mjs; source: china-division@2.7.0 (MCA divisions).')
[void]$sb.AppendLine('   Key = second-level city name in regions.js; value = its districts, counties, county-level cities, banners.')
[void]$sb.AppendLine('   Municipalities already expand to districts in regions.js, so they are not repeated here. */')
[void]$sb.AppendLine('(function () {')
[void]$sb.AppendLine("  'use strict';")
[void]$sb.AppendLine('')
[void]$sb.AppendLine('  var DATA = {')

$keys = @($data.Keys | Sort-Object)
for ($i = 0; $i -lt $keys.Count; $i++) {
  $k = $keys[$i]
  $vals = (($data[$k] | ForEach-Object { "'$_'" }) -join ', ')
  $comma = ''
  if ($i -lt ($keys.Count - 1)) { $comma = ',' }
  [void]$sb.AppendLine("    '$k': [$vals]$comma")
}

[void]$sb.AppendLine('  };')
[void]$sb.AppendLine('')
[void]$sb.AppendLine('  window.CN_DISTRICTS = DATA;')
[void]$sb.AppendLine('})();')

if (Test-Path -LiteralPath $OutPath) {
  Copy-Item -LiteralPath $OutPath -Destination ($OutPath + '.bak') -Force
}

$enc = New-Object System.Text.UTF8Encoding($true)
[IO.File]::WriteAllText($OutPath, $sb.ToString(), $enc)

$len = (Get-Item -LiteralPath $OutPath).Length
Write-Host "written: $OutPath ($([math]::Round($len / 1024, 1)) KB)"

$fs = [IO.File]::OpenRead($OutPath)
try {
  $ms = New-Object IO.MemoryStream
  $gz = New-Object IO.Compression.GZipStream($ms, [IO.Compression.CompressionMode]::Compress)
  $fs.CopyTo($gz)
  $gz.Dispose()
  Write-Host "gzip: $([math]::Round($ms.Length / 1024, 1)) KB"
  $ms.Dispose()
} finally { $fs.Dispose() }

Write-Host "done"
