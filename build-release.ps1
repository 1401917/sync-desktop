$env:PATH = "$env:USERPROFILE\.cargo\bin;" + $env:PATH
$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $RepoRoot
Write-Host "Building release..." -ForegroundColor Cyan
npm run tauri:build
Write-Host "Done! Exe is at: src-tauri\target\release\sync.exe" -ForegroundColor Green
Read-Host "Press Enter to close"
