$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $root "Caddyfile"))) {
    $root = Get-Location
}
Set-Location $root

$tools = Join-Path $root "tools"
New-Item -ItemType Directory -Force -Path $tools | Out-Null
$caddy = Join-Path $tools "caddy.exe"

if (-not (Test-Path $caddy)) {
    Write-Host "Downloading Caddy..."
    $zip = Join-Path $tools "caddy.zip"
    $url = "https://github.com/caddyserver/caddy/releases/download/v2.10.2/caddy_2.10.2_windows_amd64.zip"
    Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
    Expand-Archive -Path $zip -DestinationPath $tools -Force
    Remove-Item $zip -Force
}

$dist = Join-Path $root "frontend\dist\index.html"
if (-not (Test-Path $dist)) {
    Write-Host "Building frontend..."
    Push-Location (Join-Path $root "frontend")
    npx vite build
    Pop-Location
}

Write-Host "HTTPS proxy: https://182.176.174.69.sslip.io"
Write-Host "Office LAN:  http://192.168.1.3"
& $caddy run --config (Join-Path $root "Caddyfile") --adapter caddyfile
