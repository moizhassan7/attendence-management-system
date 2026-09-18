param(
    [switch]$Supervise
)

$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $Root "Caddyfile"))) {
    $Root = "D:\attendence-zkt"
}

$LogDir = Join-Path $Root "logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

$Python = Join-Path $Root "backend\venv\Scripts\python.exe"
if (-not (Test-Path $Python)) {
    $Python = "C:\Users\hassa\AppData\Local\Programs\Python\Python311\python.exe"
}
$Caddy = Join-Path $Root "tools\caddy.exe"
$BackendDir = Join-Path $Root "backend"

function Test-Listen([int]$Port) {
    return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

function Wait-Postgres {
    for ($i = 0; $i -lt 30; $i++) {
        try {
            $tcp = New-Object System.Net.Sockets.TcpClient
            $tcp.Connect("127.0.0.1", 5432)
            $tcp.Close()
            return
        } catch {
            Start-Sleep -Seconds 2
        }
    }
}

function Start-Backend {
    if (Test-Listen 8000) { return }
    Start-Process -FilePath $Python `
        -ArgumentList "-m uvicorn app.main:app --host 0.0.0.0 --port 8000" `
        -WorkingDirectory $BackendDir `
        -WindowStyle Hidden | Out-Null
}

function Start-Caddy {
    if ((Test-Listen 5173) -or (Test-Listen 443)) { return }
    if (-not (Test-Path $Caddy)) { return }
    Start-Process -FilePath $Caddy `
        -ArgumentList "run --config `"$Root\Caddyfile`" --adapter caddyfile" `
        -WorkingDirectory $Root `
        -WindowStyle Hidden | Out-Null
}

Wait-Postgres
Start-Backend
Start-Sleep -Seconds 2
Start-Caddy

if (-not $Supervise) {
    exit 0
}

while ($true) {
    Start-Sleep -Seconds 8
    Start-Backend
    Start-Caddy
}
