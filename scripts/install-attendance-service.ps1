$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $Root "Caddyfile"))) {
    $Root = "D:\attendence-zkt"
}
$Scripts = Join-Path $Root "scripts"
$StartPs1 = Join-Path $Scripts "start-attendance.ps1"
$Tools = Join-Path $Root "tools"
$WinSw = Join-Path $Tools "zkt-attendance.exe"
$TaskName = "ZKT Attendance Stack"

function Test-Admin {
    $principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Install-StartupShortcut {
    $startup = [Environment]::GetFolderPath("Startup")
    Copy-Item -Path (Join-Path $Scripts "start-attendance.cmd") -Destination (Join-Path $startup "ZKT Attendance.cmd") -Force
    Write-Host "Startup folder shortcut: $startup\ZKT Attendance.cmd"
}

function Register-BootTask {
    $arg = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$StartPs1`""
    $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $arg
    $trigger = New-ScheduledTaskTrigger -AtStartup
    $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -RunLevel Highest -LogonType ServiceAccount
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero)
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
    Write-Host "Boot task registered: $TaskName (SYSTEM, At startup)"
}

function Install-WinService {
    New-Item -ItemType Directory -Force -Path $Tools | Out-Null
    if (-not (Test-Path $WinSw)) {
        Write-Host "Downloading WinSW..."
        $url = "https://github.com/winsw/winsw/releases/download/v2.12.0/WinSW-x64.exe"
        Invoke-WebRequest -Uri $url -OutFile $WinSw -UseBasicParsing
    }
    & $WinSw stop
    & $WinSw uninstall
    & $WinSw install
    if ($LASTEXITCODE -ne 0) { throw "WinSW install failed with exit $LASTEXITCODE" }
    & $WinSw start
    Write-Host "Windows service installed: ZKT Attendance Stack (Automatic, delayed)"
}

Install-StartupShortcut

if (-not (Test-Admin)) {
    Write-Host "Requesting Administrator to install the boot service..."
    $self = $MyInvocation.MyCommand.Path
    Start-Process -FilePath "powershell.exe" -Verb RunAs -Wait -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$self`""
    exit 0
}

try {
    Install-WinService
} catch {
    Write-Host "Service install failed: $_"
    Write-Host "Falling back to Task Scheduler..."
    Register-BootTask
}
Write-Host "Done. Reboot the PC to confirm backend + Caddy start by themselves."
