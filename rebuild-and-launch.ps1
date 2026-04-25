# Sync — rebuild + relaunch script
# Builds a fresh sync.exe with the latest UI changes and reopens the app.

$ErrorActionPreference = "Stop"
$env:PATH = "$env:USERPROFILE\.cargo\bin;" + $env:PATH

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $RepoRoot

Write-Host ""
Write-Host "==> Sync rebuild + relaunch" -ForegroundColor Cyan
Write-Host "    Repo: $RepoRoot"
Write-Host ""

# 1. Close any running Sync instance so the .exe can be replaced.
$running = Get-Process -Name "sync" -ErrorAction SilentlyContinue
if ($running) {
  Write-Host "==> Closing running Sync ($($running.Count) process(es))..." -ForegroundColor Yellow
  $running | Stop-Process -Force
  Start-Sleep -Seconds 1
}

# 2. Make sure dependencies are present (only re-runs if node_modules is stale).
if (-not (Test-Path "node_modules")) {
  Write-Host "==> Installing npm dependencies..." -ForegroundColor Cyan
  npm install
  if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
}

# 3. Build the Tauri Windows release (frontend + Rust + NSIS installer).
Write-Host "==> Building Tauri release (this can take a few minutes)..." -ForegroundColor Cyan
npm run tauri:build
if ($LASTEXITCODE -ne 0) { throw "Tauri build failed" }

# 4. Locate the freshly built exe.
$exe = Join-Path $RepoRoot "src-tauri\target\release\sync.exe"
if (-not (Test-Path $exe)) {
  throw "Build finished but sync.exe was not found at $exe"
}

# 5. Show installer path if it was produced.
$installer = Get-ChildItem -Path "src-tauri\target\release\bundle" -Recurse -Filter "*setup*.exe" -ErrorAction SilentlyContinue |
  Select-Object -First 1
if ($installer) {
  Write-Host ""
  Write-Host "==> Installer ready: $($installer.FullName)" -ForegroundColor Green
}

# 6. Launch the new build.
Write-Host ""
Write-Host "==> Launching new Sync build..." -ForegroundColor Green
Start-Process -FilePath $exe

Write-Host ""
Write-Host "Done. The new UI (Codex-style sidebar, neutral Active Tasks) should be visible now." -ForegroundColor Green
