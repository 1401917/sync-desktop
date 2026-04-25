# Sync — full release pipeline
#
# 1. Verifies the working tree
# 2. Bumps + commits the version (already done in files; this just commits)
# 3. Builds the Tauri Windows release (.exe + NSIS installer)
# 4. Creates an annotated git tag
# 5. Pushes the branch + tag to GitHub
# 6. Creates a GitHub release via `gh` CLI and attaches the installer
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\release.ps1
#   powershell -ExecutionPolicy Bypass -File .\release.ps1 -Version 0.2.1
#
# Requirements: git, npm, rustup, gh CLI (already authenticated via `gh auth login`)

[CmdletBinding()]
param(
  [string]$Version = "0.2.0",
  [switch]$SkipBuild,
  [switch]$SkipPush,
  [switch]$SkipRelease
)

$ErrorActionPreference = "Stop"
$env:PATH = "$env:USERPROFILE\.cargo\bin;" + $env:PATH

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $RepoRoot

function Section($message) {
  Write-Host ""
  Write-Host "==> $message" -ForegroundColor Cyan
}

function Ok($message) {
  Write-Host "    $message" -ForegroundColor Green
}

# ----- 1. Sanity checks -----
Section "Pre-flight checks"

git rev-parse --is-inside-work-tree | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Not a git repository. Run inside D:\Projects\codex." }

$branch = git rev-parse --abbrev-ref HEAD
Ok "Current branch: $branch"

$remote = git remote get-url origin
Ok "Origin: $remote"

# Verify the gitignored secrets file is not staged.
$staged = git diff --cached --name-only
if ($staged -match "src-tauri/\.cargo/config\.toml") {
  throw "ABORT: src-tauri/.cargo/config.toml is staged for commit. That file is local-only configuration and must stay local."
}

# Make sure config.toml is actually ignored.
$gitignored = git check-ignore -v "src-tauri/.cargo/config.toml" 2>$null
if (-not $gitignored) {
  Write-Warning "src-tauri/.cargo/config.toml is NOT in .gitignore. Aborting to prevent leaking your API key."
  throw "Add 'src-tauri/.cargo/config.toml' to .gitignore before continuing."
}
Ok "Local secrets file is properly gitignored."

# ----- 2. Stage + commit version bump and code changes -----
Section "Staging changes"

git add -A
$changes = git diff --cached --name-only
if (-not $changes) {
  Write-Host "    No staged changes; assuming version bump already committed." -ForegroundColor Yellow
} else {
  Write-Host "Files staged:"
  $changes | ForEach-Object { Write-Host "  $_" }

  $commitMsg = @"
Release v$Version: Codex-style sidebar, provider settings, safer credentials

- Sidebar redesigned to match Codex layout (4 primary actions + Projects list + Tools collapsible + Settings)
- Active Tasks panel hidden until a real session starts; neutral palette (no more blue accents)
- TopBar menus (File/Edit/View/Window/Help) now functional with real handlers
- Real AI provider calls via OpenAI-compatible /chat/completions for NVIDIA NIM, OpenAI, Groq, Together
- Provider API keys persisted to %APPDATA%\Sync\provider_keys\; SQLite stores only masked metadata
- Provider keys are not auto-seeded from compile-time environment variables
- Fixed SQL Got 3 needed 4 in INSERT INTO task_lists (missing session_id param)
- Open Project Folder button auto-hides into a green opened badge after a real folder is picked
- GitHub Device Flow now returns meaningful errors instead of error decoding response body
- .gitignore extended to exclude *.key, secrets.local.*, and the local Cargo config
"@

  git commit -m $commitMsg
  if ($LASTEXITCODE -ne 0) { throw "git commit failed" }
  Ok "Commit created."
}

# ----- 3. Build the Windows release -----
if (-not $SkipBuild) {
  Section "Building Tauri release (this can take a few minutes)"
  npm run tauri:build
  if ($LASTEXITCODE -ne 0) { throw "Tauri build failed." }

  $exe = Join-Path $RepoRoot "src-tauri\target\release\sync.exe"
  if (-not (Test-Path $exe)) { throw "Build finished but sync.exe is missing at $exe" }
  Ok "sync.exe built: $exe"

  $installer = Get-ChildItem -Path "src-tauri\target\release\bundle" -Recurse -Filter "*setup*.exe" -ErrorAction SilentlyContinue |
    Select-Object -First 1
  if ($installer) {
    Ok "Installer: $($installer.FullName)"
  } else {
    Write-Warning "No NSIS installer was produced. Will skip installer upload."
  }
}

# ----- 4. Create the git tag -----
Section "Tagging v$Version"

$existingTag = git tag --list "v$Version"
if ($existingTag) {
  Write-Warning "Tag v$Version already exists locally — skipping git tag."
} else {
  git tag -a "v$Version" -m "Sync v$Version"
  if ($LASTEXITCODE -ne 0) { throw "git tag failed" }
  Ok "Tagged v$Version"
}

# ----- 5. Push branch + tag -----
if (-not $SkipPush) {
  Section "Pushing to GitHub"
  git push origin $branch
  if ($LASTEXITCODE -ne 0) { throw "git push branch failed" }
  Ok "Branch pushed."

  git push origin "v$Version"
  if ($LASTEXITCODE -ne 0) { throw "git push tag failed" }
  Ok "Tag pushed."
}

# ----- 6. Create GitHub release with the installer -----
if (-not $SkipRelease) {
  Section "Creating GitHub release"

  $ghAvailable = $false
  try {
    gh --version | Out-Null
    $ghAvailable = $LASTEXITCODE -eq 0
  } catch { $ghAvailable = $false }

  if (-not $ghAvailable) {
    Write-Warning "gh CLI is not available. Skipping the GitHub release step."
    Write-Host "    Install with: winget install GitHub.cli" -ForegroundColor Yellow
    Write-Host "    Or create the release manually at:"
    Write-Host "      https://github.com/1401917/sync-desktop/releases/new?tag=v$Version"
  } else {
    $notes = "See [CHANGELOG.md](./CHANGELOG.md#0$($Version.Replace('.','')))-$($Version.Replace('.','')) for the full list of changes."

    $assets = @()
    $exePath = Join-Path $RepoRoot "src-tauri\target\release\sync.exe"
    if (Test-Path $exePath) { $assets += $exePath }
    $installerPath = Get-ChildItem -Path "src-tauri\target\release\bundle" -Recurse -Filter "*setup*.exe" -ErrorAction SilentlyContinue |
      Select-Object -First 1 -ExpandProperty FullName
    if ($installerPath) { $assets += $installerPath }

    $createArgs = @("release", "create", "v$Version", "--title", "Sync v$Version", "--notes", $notes)
    if ($assets.Count -gt 0) { $createArgs += $assets }

    & gh @createArgs
    if ($LASTEXITCODE -ne 0) { throw "gh release create failed" }
    Ok "GitHub release v$Version created."
  }
}

Section "Done"
Write-Host "Sync v$Version is released. Repo: $remote" -ForegroundColor Green
