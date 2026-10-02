# Build the install directory, run the database bootstrap, and restart the API service.
# Used by the GitHub Actions runner and by hand. See WINDOWS.md.
# Requires Windows PowerShell 5.1 or later.
param(
    [string]$InstallDir = "",
    [string]$SourceDir = "",
    [string]$ServiceName = "HJAReportsBackend",
    [string]$ViteApiUrl = ""
)

$ErrorActionPreference = "Stop"

function Get-FullDirectoryPath {
    param([string]$Path)
    $full = [System.IO.Path]::GetFullPath($Path)
    return $full.TrimEnd('\')
}

function Get-DotEnvValue {
    param(
        [string]$Path,
        [string]$Key
    )
    if (-not (Test-Path -LiteralPath $Path)) {
        return $null
    }
    foreach ($line in Get-Content -LiteralPath $Path) {
        if ($line -match "^\s*#") {
            continue
        }
        $pattern = '^\s*' + [regex]::Escape($Key) + '\s*=\s*(.*)\s*$'
        if ($line -match $pattern) {
            return $Matches[1].Trim().Trim('"').Trim("'")
        }
    }
    return $null
}

function Invoke-Native {
    param(
        [scriptblock]$Command,
        [string]$FailureMessage
    )
    & $Command
    if ($LASTEXITCODE -ne 0) {
        Write-Error "$FailureMessage (exit $LASTEXITCODE)"
        exit $LASTEXITCODE
    }
}

if ([string]::IsNullOrWhiteSpace($InstallDir)) {
    if (-not [string]::IsNullOrWhiteSpace($env:HJA_INSTALL_DIR)) {
        $InstallDir = $env:HJA_INSTALL_DIR
    } else {
        $InstallDir = "C:\HJA\reports-manager"
    }
}

if ([string]::IsNullOrWhiteSpace($ViteApiUrl)) {
    $ViteApiUrl = $env:VITE_API_URL
}

if ([string]::IsNullOrWhiteSpace($ViteApiUrl) -or $ViteApiUrl -notmatch "/api/?$") {
    Write-Error "VITE_API_URL must be set to the browser-reachable API URL and end with /api. Pass -ViteApiUrl or set the VITE_API_URL environment variable."
    exit 1
}

if ([string]::IsNullOrWhiteSpace($SourceDir)) {
    $SourceDir = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

$InstallDir = Get-FullDirectoryPath $InstallDir
$SourceDir = Get-FullDirectoryPath $SourceDir
$envFile = Join-Path $InstallDir "backend\.env"

if (-not (Test-Path -LiteralPath $envFile)) {
    Write-Error "Missing $envFile. Create it before deploying. See WINDOWS.md."
    exit 1
}

$cloudmersiveKey = Get-DotEnvValue -Path $envFile -Key "CLOUDMERSIVE_API_KEY"
if (-not [string]::IsNullOrWhiteSpace($cloudmersiveKey)) {
    Write-Warning "CLOUDMERSIVE_API_KEY is set. Production PDF export should use Windows LibreOffice. Remove that variable from backend\.env."
}

$service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if (-not $service) {
    Write-Error "Windows service '$ServiceName' is not installed. Run scripts\windows\install-service.ps1 first."
    exit 1
}

if ($service.Status -eq "Running") {
    Write-Host "Stopping $ServiceName"
    Stop-Service -Name $ServiceName -Force
    $service.WaitForStatus("Stopped", "00:01:00")
}

if ($SourceDir -ne $InstallDir) {
    Write-Host "Syncing $SourceDir to $InstallDir"
    $envBackup = Join-Path $env:TEMP "hja-backend-env-backup"
    Copy-Item -LiteralPath $envFile -Destination $envBackup -Force

    # /MIR removes files deleted from the repo. Excluded names are left in place.
    # Robocopy exit codes 0-7 are success.
    & robocopy $SourceDir $InstallDir /MIR /XD node_modules .git temp /XF .env /NFL /NDL /NJH /NJS /nc /ns /np
    $robocopyExit = $LASTEXITCODE

    $backendDir = Join-Path $InstallDir "backend"
    New-Item -ItemType Directory -Force -Path $backendDir | Out-Null
    Copy-Item -LiteralPath $envBackup -Destination $envFile -Force
    Remove-Item -LiteralPath $envBackup -Force

    if ($robocopyExit -ge 8) {
        Write-Error "robocopy failed with exit code $robocopyExit"
        exit $robocopyExit
    }
} else {
    Write-Host "Source and install directory are the same. Skipping file sync."
}

$npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npm) {
    Write-Error "npm.cmd not found. Install Node.js 20 and reopen the shell."
    exit 1
}

Write-Host "Installing dependencies"
Push-Location $InstallDir
try {
    Invoke-Native -FailureMessage "npm ci failed" -Command { & npm.cmd ci }
    Write-Host "Building (VITE_API_URL=$ViteApiUrl)"
    $env:VITE_API_URL = $ViteApiUrl
    Invoke-Native -FailureMessage "npm run build failed" -Command { & npm.cmd run build }
} finally {
    Pop-Location
}

Write-Host "Running database bootstrap migration"
Push-Location (Join-Path $InstallDir "backend")
try {
    Invoke-Native -FailureMessage "migration:run:prod failed" -Command { & npm.cmd run migration:run:prod }
} finally {
    Pop-Location
}

Write-Host "Starting $ServiceName"
Start-Service -Name $ServiceName
$service.WaitForStatus("Running", "00:01:00")

$port = Get-DotEnvValue -Path $envFile -Key "PORT"
if ([string]::IsNullOrWhiteSpace($port)) {
    $port = "5000"
}
$healthUrl = "http://127.0.0.1:$port/health"
Write-Host "Waiting for $healthUrl"

$healthy = $false
for ($attempt = 1; $attempt -le 30; $attempt++) {
    try {
        $response = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 5
        if ($response.StatusCode -eq 200) {
            $healthy = $true
            break
        }
    } catch {
        Write-Host "Health check attempt $attempt failed. Retrying..."
    }
    Start-Sleep -Seconds 2
}

if (-not $healthy) {
    $stderrLog = Join-Path "C:\HJA\logs" "$ServiceName.err.log"
    if (Test-Path -LiteralPath $stderrLog) {
        Write-Host "Last lines of $stderrLog :"
        Get-Content -LiteralPath $stderrLog -Tail 40
    }
    Write-Error "API did not become healthy at $healthUrl"
    exit 1
}

Write-Host "Deploy complete. $healthUrl returned 200."
