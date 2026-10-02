# One-time IIS site for the static frontend. Run from an elevated PowerShell.
# See WINDOWS.md. The UI has no client-side URL routes; index.html is enough.
param(
    [string]$InstallDir = "C:\HJA\reports-manager",
    [string]$SiteName = "HJAReports",
    [int]$Port = 8080
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

function Enable-Iis {
    $featureCmd = Get-Command Install-WindowsFeature -ErrorAction SilentlyContinue
    if ($featureCmd) {
        Write-Host "Enabling the Web Server role..."
        $result = Install-WindowsFeature -Name Web-Server -IncludeManagementTools
        if (-not $result.Success) {
            Write-Error "Install-WindowsFeature Web-Server failed."
            exit 1
        }
        return
    }

    Write-Host "Enabling IIS Windows features..."
    Enable-WindowsOptionalFeature -Online -FeatureName @(
        "IIS-WebServerRole",
        "IIS-WebServer",
        "IIS-CommonHttpFeatures",
        "IIS-StaticContent",
        "IIS-DefaultDocument",
        "IIS-ManagementConsole"
    ) -All -NoRestart | Out-Null
}

Assert-Administrator
Enable-Iis

if (-not (Get-Module -ListAvailable -Name WebAdministration)) {
    Write-Error "The WebAdministration module is not available yet. Close this window, open a new elevated PowerShell, and run the script again."
    exit 1
}

Import-Module WebAdministration

$physicalPath = Join-Path $InstallDir "frontend\dist"
New-Item -ItemType Directory -Force -Path $physicalPath | Out-Null

$poolPath = "IIS:\AppPools\$SiteName"
if (-not (Test-Path $poolPath)) {
    Write-Host "Creating application pool $SiteName"
    New-WebAppPool -Name $SiteName | Out-Null
}
# Static files only; do not load a .NET runtime.
Set-ItemProperty $poolPath -Name managedRuntimeVersion -Value ""

$binding = "*:${Port}:"
$sitePath = "IIS:\Sites\$SiteName"
$existingSite = Get-Website -Name $SiteName -ErrorAction SilentlyContinue
if (-not $existingSite) {
    $conflict = Get-WebBinding | Where-Object { $_.bindingInformation -eq $binding }
    if ($conflict) {
        Write-Error "Port $Port is already bound on another IIS site. Pass a different -Port."
        exit 1
    }
    Write-Host "Creating site $SiteName on port $Port"
    New-Website -Name $SiteName -Port $Port -PhysicalPath $physicalPath -ApplicationPool $SiteName | Out-Null
} else {
    Write-Host "Updating site $SiteName"
    Set-ItemProperty $sitePath -Name physicalPath -Value $physicalPath
    Set-ItemProperty $sitePath -Name applicationPool -Value $SiteName
    $hasBinding = Get-WebBinding -Name $SiteName | Where-Object { $_.bindingInformation -eq $binding }
    if (-not $hasBinding) {
        $conflict = Get-WebBinding | Where-Object { $_.bindingInformation -eq $binding }
        if ($conflict) {
            Write-Error "Port $Port is already bound on another IIS site. Pass a different -Port."
            exit 1
        }
        New-WebBinding -Name $SiteName -Protocol http -Port $Port | Out-Null
    }
}

$poolIdentity = "IIS AppPool\$SiteName"
& icacls $physicalPath /grant "${poolIdentity}:(OI)(CI)R" /T | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Error "icacls failed to grant $poolIdentity read on $physicalPath (exit $LASTEXITCODE)"
    exit 1
}

$site = Get-Website -Name $SiteName
if ($site.State -ne "Started") {
    Start-Website -Name $SiteName
}

Write-Host "IIS site is ready."
Write-Host "  URL: http://localhost:$Port"
Write-Host "  Path: $physicalPath"
Write-Host "Set CORS_ORIGIN to the origin browsers use for this site, and VITE_API_URL to the API URL ending in /api."
