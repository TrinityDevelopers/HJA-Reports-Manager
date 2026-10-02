# One-time registration of the API as a Windows service via NSSM.
# Run from an elevated PowerShell. See WINDOWS.md.
param(
    [string]$InstallDir = "C:\HJA\reports-manager",
    [string]$ServiceName = "HJAReportsBackend",
    [string]$MysqlServiceName = "MySQL80",
    [string]$NssmPath = "",
    [Parameter(Mandatory = $true)]
    [string]$ServiceUser,
    [Parameter(Mandatory = $true)]
    [string]$ServicePassword,
    [string]$LogDir = "C:\HJA\logs",
    [string]$NodePath = ""
)

$ErrorActionPreference = "Stop"

function Assert-Administrator {
    $principal = New-Object Security.Principal.WindowsPrincipal(
        [Security.Principal.WindowsIdentity]::GetCurrent()
    )
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        Write-Error "Run this script from an elevated PowerShell session."
        exit 1
    }
}

function Resolve-NssmPath {
    param([string]$Explicit)
    if ($Explicit) {
        if (-not (Test-Path -LiteralPath $Explicit)) {
            Write-Error "NSSM not found at $Explicit"
            exit 1
        }
        return (Resolve-Path -LiteralPath $Explicit).Path
    }

    $cmd = Get-Command nssm -ErrorAction SilentlyContinue
    if ($cmd) {
        return $cmd.Source
    }

    $candidates = @(
        "C:\nssm\win64\nssm.exe",
        "C:\nssm\nssm.exe",
        (Join-Path $env:ProgramFiles "nssm\win64\nssm.exe"),
        (Join-Path $env:ProgramFiles "nssm\nssm.exe")
    )
    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate) {
            return (Resolve-Path -LiteralPath $candidate).Path
        }
    }

    Write-Error "NSSM not found. Install NSSM and pass -NssmPath, or add nssm.exe to PATH."
    exit 1
}

function Resolve-NodePath {
    param([string]$Explicit)
    if ($Explicit) {
        if (-not (Test-Path -LiteralPath $Explicit)) {
            Write-Error "node.exe not found at $Explicit"
            exit 1
        }
        return (Resolve-Path -LiteralPath $Explicit).Path
    }

    $cmd = Get-Command node -ErrorAction SilentlyContinue
    if ($cmd) {
        return $cmd.Source
    }

    $default = "C:\Program Files\nodejs\node.exe"
    if (Test-Path -LiteralPath $default) {
        return $default
    }

    Write-Error "node.exe not found. Install Node.js 20 and pass -NodePath if it is not on PATH."
    exit 1
}

function Invoke-Nssm {
    param(
        [string[]]$NssmArgs,
        [switch]$Secret
    )
    & $script:NssmExe @NssmArgs
    if ($LASTEXITCODE -ne 0) {
        if ($Secret) {
            $shown = "$($NssmArgs[0]) $($NssmArgs[1]) $($NssmArgs[2]) (credentials hidden)"
        } else {
            $shown = $NssmArgs -join " "
        }
        Write-Error "nssm $shown failed with exit code $LASTEXITCODE"
        exit 1
    }
}

Assert-Administrator

$mysql = Get-Service -Name $MysqlServiceName -ErrorAction SilentlyContinue
if (-not $mysql) {
    Write-Error "MySQL Windows service '$MysqlServiceName' was not found. Pass -MysqlServiceName with the name from services.msc (often MySQL80 or MySQL84)."
    exit 1
}

$script:NssmExe = Resolve-NssmPath -Explicit $NssmPath
$nodeExe = Resolve-NodePath -Explicit $NodePath
$backendDir = Join-Path $InstallDir "backend"
$entry = Join-Path $backendDir "dist\src\index.js"

if (-not (Test-Path -LiteralPath $backendDir)) {
    Write-Error "Backend directory not found: $backendDir. Clone the repo to $InstallDir first."
    exit 1
}

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

$existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existing -and $existing.Status -eq "Running") {
    Write-Host "Stopping $ServiceName so its configuration can be updated..."
    Stop-Service -Name $ServiceName -Force
    $existing.WaitForStatus("Stopped", "00:01:00")
}

if (-not $existing) {
    Write-Host "Installing service $ServiceName"
    Invoke-Nssm -NssmArgs @("install", $ServiceName, $nodeExe)
}

Invoke-Nssm -NssmArgs @("set", $ServiceName, "Application", $nodeExe)
Invoke-Nssm -NssmArgs @("set", $ServiceName, "AppDirectory", $backendDir)
Invoke-Nssm -NssmArgs @("set", $ServiceName, "AppParameters", "dist\src\index.js")
Invoke-Nssm -NssmArgs @("set", $ServiceName, "DisplayName", "HJA Reports Manager API")
Invoke-Nssm -NssmArgs @("set", $ServiceName, "Description", "Express API for HJA Reports Manager")
Invoke-Nssm -NssmArgs @("set", $ServiceName, "Start", "SERVICE_AUTO_START")
Invoke-Nssm -NssmArgs @("set", $ServiceName, "DependOnService", $MysqlServiceName)
Invoke-Nssm -NssmArgs @("set", $ServiceName, "AppStdout", (Join-Path $LogDir "$ServiceName.out.log"))
Invoke-Nssm -NssmArgs @("set", $ServiceName, "AppStderr", (Join-Path $LogDir "$ServiceName.err.log"))
Invoke-Nssm -NssmArgs @("set", $ServiceName, "AppRotateFiles", "1")
Invoke-Nssm -NssmArgs @("set", $ServiceName, "AppRotateOnline", "1")
Invoke-Nssm -NssmArgs @("set", $ServiceName, "AppRotateBytes", "10485760")
Invoke-Nssm -NssmArgs @("set", $ServiceName, "AppExit", "Default", "Restart")
Invoke-Nssm -NssmArgs @("set", $ServiceName, "AppRestartDelay", "5000")
Invoke-Nssm -NssmArgs @("set", $ServiceName, "ObjectName", $ServiceUser, $ServicePassword) -Secret

$aclUser = $ServiceUser
if ($aclUser.StartsWith(".\")) {
    $aclUser = $aclUser.Substring(2)
}
& icacls $InstallDir /grant "${aclUser}:(OI)(CI)M" /T | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Error "icacls failed to grant $aclUser modify on $InstallDir (exit $LASTEXITCODE)"
    exit 1
}
& icacls $LogDir /grant "${aclUser}:(OI)(CI)M" | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Error "icacls failed to grant $aclUser modify on $LogDir (exit $LASTEXITCODE)"
    exit 1
}

if (Test-Path -LiteralPath $entry) {
    Write-Host "Starting $ServiceName"
    Start-Service -Name $ServiceName
} else {
    Write-Host "Service $ServiceName is installed and set to Automatic."
    Write-Host "dist\src\index.js is not built yet. The next deploy will start the service."
}

Write-Host "API service is ready."
Write-Host "  Application: $nodeExe dist\src\index.js"
Write-Host "  Working directory: $backendDir"
Write-Host "  Logs: $LogDir"
