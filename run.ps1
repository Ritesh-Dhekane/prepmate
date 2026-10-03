# Starts PrepMate. First run: creates .venv, installs requirements and makes .env from
# .env.example. Later runs only reinstall when requirements.txt has changed.
# Usage (from the repo root): .\run.cmd   (or: powershell -File run.ps1)
# Set PORT to use another port; set NO_BROWSER=1 to not open the browser.

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$python = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'
if (-not (Test-Path $python)) {
    Write-Host 'Creating virtual environment (.venv)...'
    $launcher = Get-Command py -ErrorAction SilentlyContinue
    if ($launcher) { & py -3 -m venv .venv } else { & python -m venv .venv }
    if (-not (Test-Path $python)) { throw 'Could not create .venv. Is Python 3.10+ installed?' }
}

# Reinstall only when requirements.txt changed since the last install.
$stamp = Join-Path $PSScriptRoot '.venv\.requirements.sha256'
$hash = (Get-FileHash requirements.txt -Algorithm SHA256).Hash
$installed = if (Test-Path $stamp) { (Get-Content $stamp -Raw).Trim() } else { '' }
if ($hash -ne $installed) {
    Write-Host 'Installing requirements...'
    & $python -m pip install --disable-pip-version-check -q -r requirements.txt
    if ($LASTEXITCODE -ne 0) { throw 'pip install failed.' }
    Set-Content -Path $stamp -Value $hash -Encoding ascii
}

if (-not (Test-Path .env)) {
    Copy-Item .env.example .env
    Write-Host 'Created .env from .env.example. Add AI_API_KEY there for AI analysis (optional).'
}

$port = if ($env:PORT) { $env:PORT } else { '5000' }
$url = "http://127.0.0.1:$port"
Write-Host "PrepMate: $url  (Ctrl+C to stop)"
if (-not $env:NO_BROWSER) {
    # Open the page once the server has had a moment to start.
    Start-Job -ScriptBlock { param($u) Start-Sleep -Seconds 2; Start-Process $u } -ArgumentList $url | Out-Null
}
$env:PORT = $port
& $python app.py
