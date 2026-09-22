$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$verificationRoot = Join-Path $projectRoot '.verification\visual-upgrade'
$snapshotName = 'clean-install-' + (Get-Date -Format 'yyyyMMdd-HHmmss')
$snapshotPath = Join-Path $verificationRoot $snapshotName
if (Test-Path -LiteralPath $snapshotPath) { throw 'Choose a fresh snapshot directory.' }
New-Item -ItemType Directory -Path $snapshotPath -Force | Out-Null
$originalDirectory = Get-Location
$reportPath = Join-Path $projectRoot 'docs\reports\visual-upgrade\clean-install.json'
$startedAt = (Get-Date).ToUniversalTime().ToString('o')
$result = [ordered]@{
  startedAt = $startedAt
  snapshot = ".verification/visual-upgrade/$snapshotName"
  method = 'Export the exact reviewed Git index into a new empty directory, install from lockfile, build with no private original images or local environment file.'
  indexTree = ''
  node = (& node --version)
  npm = (& npm.cmd --version)
  installExit = $null
  buildExit = $null
  htmlCount = 0
  passed = $false
}
try {
  Set-Location -LiteralPath $projectRoot
  $result.indexTree = (& git write-tree).Trim()
  $prefix = $snapshotPath.Replace('\', '/') + '/'
  & git checkout-index --all "--prefix=$prefix"
  if ($LASTEXITCODE -ne 0) { throw 'Git index export failed.' }
  Set-Location -LiteralPath $snapshotPath
  & npm.cmd ci --no-fund *> (Join-Path $verificationRoot "$snapshotName-install.log")
  $result.installExit = $LASTEXITCODE
  if ($LASTEXITCODE -ne 0) { throw 'Clean npm ci failed; inspect the local install log.' }
  & npm.cmd run build *> (Join-Path $verificationRoot "$snapshotName-build.log")
  $result.buildExit = $LASTEXITCODE
  if ($LASTEXITCODE -ne 0) { throw 'Clean production build failed; inspect the local build log.' }
  $result.htmlCount = @(Get-ChildItem -LiteralPath (Join-Path $snapshotPath 'dist') -Recurse -Filter '*.html').Count
  if ($result.htmlCount -ne 24) { throw 'Unexpected static page count.' }
  $result.passed = $true
} finally {
  Set-Location -LiteralPath $originalDirectory
  $result.finishedAt = (Get-Date).ToUniversalTime().ToString('o')
  $result | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $reportPath -Encoding utf8
  $result | ConvertTo-Json -Depth 4
}
