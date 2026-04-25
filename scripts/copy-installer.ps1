$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$BundleDir = Join-Path $RepoRoot "src-tauri\target\release\bundle\nsis"
$Installer = Get-ChildItem $BundleDir -Filter "*setup.exe" |
  Where-Object { $_.Name -ne "setup_sync.exe" } |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

if (-not $Installer) {
  throw "No NSIS installer was found in $BundleDir"
}

$Target = Join-Path $BundleDir "setup_sync.exe"
Copy-Item -LiteralPath $Installer.FullName -Destination $Target -Force
Write-Host "Installer copied to $Target"
