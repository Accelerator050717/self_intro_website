param(
  [ValidateSet('preview', 'dev')][string]$Mode = 'preview',
  [ValidateRange(1024, 65535)][int]$Port = 4321
)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $nodeCommand -or -not $npmCommand) { throw 'Node.js and npm are required. Install Node.js 24 LTS, then reopen PowerShell.' }
$nodeVersion = [version]((& $nodeCommand.Source --version).TrimStart('v'))
if ($nodeVersion -lt [version]'22.19.0') { throw 'Use Node.js 22.19+ or Node.js 24 LTS.' }
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'node_modules\astro\package.json'))) { throw 'Dependencies are missing. In this directory run: npm.cmd ci' }
if ($Mode -eq 'preview') {
  & $npmCommand.Source run build
  if ($LASTEXITCODE -ne 0) { throw 'The site build failed. See the errors above.' }
}
$projectServerStatus = (& $npmCommand.Source exec --no -- astro $Mode status 2>&1 | Out-String)
if ($projectServerStatus -match 'http://127\.0\.0\.1:\d+') {
  $existingAddress = $Matches[0]
  Write-Host "This project's $Mode server is already running: $existingAddress/en/"
  Write-Host "Stop it from this project with: npx astro $Mode stop"
  return
}
$selectedPort = $Port
while ($selectedPort -le 65535) {
  $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $selectedPort)
  try { $listener.Start(); $listener.Stop(); break }
  catch [System.Net.Sockets.SocketException] { $listener.Stop(); $selectedPort++ }
}
if ($selectedPort -gt 65535) { throw 'No available local port was found.' }
Write-Host "Opening a local $Mode server at http://127.0.0.1:$selectedPort/en/"
Write-Host 'English: /en/   Chinese: /zh/   No files will be published.'
& $npmCommand.Source run $Mode -- --port $selectedPort
if ($LASTEXITCODE -ne 0) { throw "The $Mode server exited with code $LASTEXITCODE." }
