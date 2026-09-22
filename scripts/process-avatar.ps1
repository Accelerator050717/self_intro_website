param([switch]$Refresh)
$ErrorActionPreference = 'Stop'
$avatarRoot = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $avatarRoot
try {
    $avatarPython = Join-Path $avatarRoot '.venv-assets\Scripts\python.exe'
    if (-not (Test-Path -LiteralPath $avatarPython)) {
        if (-not (Get-Command py -ErrorAction SilentlyContinue)) {
            throw 'Python 3.12 is required for local asset processing. Install Python, then run this script again.'
        }
        & py -3.12 -m venv .venv-assets
        if ($LASTEXITCODE -ne 0) { throw 'Could not create the local Python 3.12 environment.' }
    }
    & $avatarPython -m pip install -r scripts/process-avatar-requirements.txt
    if ($LASTEXITCODE -ne 0) { throw 'Could not install local asset dependencies.' }
    $env:PYTHONIOENCODING = 'utf-8'
    if ($Refresh) { & $avatarPython -u scripts/process-avatar.py --refresh }
    else { & $avatarPython -u scripts/process-avatar.py }
    if ($LASTEXITCODE -ne 0) { throw 'Avatar processing failed. Inspect the error above; existing originals are preserved.' }
}
finally { Pop-Location }
