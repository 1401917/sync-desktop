$env:PATH = "$env:USERPROFILE\.cargo\bin;" + $env:PATH
$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $RepoRoot
npm run tauri:dev
