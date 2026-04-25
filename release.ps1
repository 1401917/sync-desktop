# Sync release pipeline. Avoids here-strings (which were tripping
# PowerShell's parser on $Version: drive-qualified parsing) and uses
# only simple double-quoted strings with ${var} delimiters everywhere a
# variable touches punctuation.

[CmdletBinding()]
param(
  [string]$Version = "0.3.0",
  [switch]$SkipBuild,
  [switch]$SkipPush,
  [switch]$SkipRelease,
  [switch]$Launch
)

$ErrorActionPreference = "Stop"
$env:PATH = "$env:USERPROFILE\.cargo\bin;" + $env:PATH

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $RepoRoot

function Section($message) {
  Write-Host ""
  Write-Host ("==> " + $message) -ForegroundColor Cyan
}

function Ok($message) {
  Write-Host ("    " + $message) -ForegroundColor Green
}

# --- 1. Sanity checks ---
Section "Pre-flight checks"

git rev-parse --is-inside-work-tree | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Not a git repository. Run inside D:\Projects\codex." }

$branch = git rev-parse --abbrev-ref HEAD
Ok ("Current branch: " + $branch)

$remote = git remote get-url origin
Ok ("Origin: " + $remote)

$staged = git diff --cached --name-only
if ($staged -match "src-tauri/\.cargo/config\.toml") {
  throw "ABORT: src-tauri/.cargo/config.toml is staged. Keep it local-only."
}

$gitignored = git check-ignore -v "src-tauri/.cargo/config.toml" 2>$null
if (-not $gitignored) {
  throw "src-tauri/.cargo/config.toml is NOT in .gitignore. Add it before continuing."
}
Ok "Local secrets file is properly gitignored."

# --- 2. Stage + commit ---
Section "Staging changes"

git add -A
$changes = git diff --cached --name-only
if (-not $changes) {
  Write-Host "    No staged changes; assuming the version bump was already committed." -ForegroundColor Yellow
} else {
  Write-Host "Files staged:"
  $changes | ForEach-Object { Write-Host ("  " + $_) }

  # Build the commit message line by line. No here-string anywhere.
  $msgLines = @()
  $msgLines += ("Release v" + $Version)
  $msgLines += ""
  $msgLines += "- Codex-style sidebar (4 primary actions + Projects + Tools collapsible + Settings)"
  $msgLines += "- Active Tasks panel hidden until a real session starts"
  $msgLines += "- Neutral palette (no more blue accents)"
  $msgLines += "- Top-bar menus (File / Edit / View / Window / Help) functional"
  $msgLines += "- Real OpenAI-compatible chat completions with NVIDIA NIM, OpenAI, Groq, Together"
  $msgLines += "- Multi-turn chat history replayed to the model on every turn"
  $msgLines += "- API keys persisted to %APPDATA%\Sync\provider_keys\; SQLite stores only masked metadata"
  $msgLines += "- NVIDIA auto-config via SYNC_DEFAULT_NVIDIA_KEY env from gitignored .cargo/config.toml"
  $msgLines += "- Fixed SQL Got 3 needed 4 in INSERT INTO task_lists"
  $msgLines += "- Fixed app freeze: Tauri commands moved to async + spawn_blocking"
  $msgLines += "- Real chat UI with bubbles, Markdown rendering, animated thinking indicator"
  $msgLines += "- Real History view with relative timestamps and grouped buckets"
  $msgLines += "- Open Project Folder button auto-hides into a green opened badge"
  $msgLines += "- Better GitHub Device Flow error messages"
  $msgLines += "- TopBar safe in browser-preview workflow"
  $msgLines += "- .gitignore excludes *.key, secrets.local.*, .cargo/config.toml"

  $commitMsg = $msgLines -join [Environment]::NewLine
  git commit -m $commitMsg
  if ($LASTEXITCODE -ne 0) { throw "git commit failed" }
  Ok "Commit created."
}

# --- 3. Build the Windows release ---
if (-not $SkipBuild) {
  Section "Closing any running Sync instance"
  $running = Get-Process -Name "sync" -ErrorAction SilentlyContinue
  if ($running) {
    Write-Host ("    Found " + $running.Count + " running sync process(es); stopping...") -ForegroundColor Yellow
    $running | Stop-Process -Force
    Start-Sleep -Seconds 2
    Ok "Stopped."
  } else {
    Ok "No running sync.exe."
  }

  Section "Building Tauri release (this can take a few minutes)"
  npm run tauri:build
  if ($LASTEXITCODE -ne 0) { throw "Tauri build failed." }

  $exe = Join-Path $RepoRoot "src-tauri\target\release\sync.exe"
  if (-not (Test-Path $exe)) { throw ("Build finished but sync.exe is missing at " + $exe) }
  Ok ("sync.exe built: " + $exe)

  $installer = Get-ChildItem -Path "src-tauri\target\release\bundle" -Recurse -Filter "*setup*.exe" -ErrorAction SilentlyContinue |
    Select-Object -First 1
  if ($installer) {
    Ok ("Installer: " + $installer.FullName)
  } else {
    Write-Warning "No NSIS installer was produced. Will skip installer upload."
  }
}

# --- 4. Launch the new build EARLY, so network failures below cannot
#        prevent the user from seeing their freshly built app. ---
if ($Launch) {
  $exe = Join-Path $RepoRoot "src-tauri\target\release\sync.exe"
  if (Test-Path $exe) {
    Section "Launching new Sync build"
    Start-Process -FilePath $exe
    Ok ("Launched: " + $exe)
  } else {
    Write-Warning ("sync.exe not found at " + $exe + "; cannot launch.")
  }
}

# All later steps are network/git related. Switch to Continue so a network
# hiccup does NOT abort the script before printing the final summary.
$ErrorActionPreference = "Continue"
$releaseProblems = @()

# --- 5. Tag ---
$tagName = "v" + $Version
Section ("Tagging " + $tagName)

$existingTag = git tag --list $tagName
if ($existingTag) {
  Write-Warning ("Tag " + $tagName + " already exists locally; skipping git tag.")
} else {
  git tag -a $tagName -m ("Sync " + $tagName)
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "git tag failed."
    $releaseProblems += "git tag failed"
  } else {
    Ok ("Tagged " + $tagName)
  }
}

# --- 6. Push branch + tag ---
if (-not $SkipPush) {
  Section "Pushing to GitHub"
  git push origin $branch
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "git push branch failed."
    $releaseProblems += "git push branch failed"
  } else {
    Ok "Branch pushed."
  }

  git push origin $tagName 2>&1 | Out-Host
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "git push tag failed (often safe to ignore if the tag already exists on origin)."
    $releaseProblems += "git push tag failed"
  } else {
    Ok "Tag pushed."
  }
}

# --- 7. GitHub release ---
if (-not $SkipRelease) {
  Section "Creating GitHub release"

  $ghAvailable = $false
  try {
    gh --version *> $null
    $ghAvailable = ($LASTEXITCODE -eq 0)
  } catch {
    $ghAvailable = $false
  }

  if (-not $ghAvailable) {
    Write-Warning "gh CLI is not available. Skipping the GitHub release step."
    Write-Host "    Install with: winget install GitHub.cli" -ForegroundColor Yellow
    Write-Host ("    Or create the release manually at: https://github.com/1401917/sync-desktop/releases/new?tag=" + $tagName)
  } else {
    $notes = ("See CHANGELOG.md for the full list of changes in " + $tagName + ".")

    $assets = @()
    $exePath = Join-Path $RepoRoot "src-tauri\target\release\sync.exe"
    if (Test-Path $exePath) { $assets += $exePath }
    $installerPath = Get-ChildItem -Path "src-tauri\target\release\bundle" -Recurse -Filter "*setup*.exe" -ErrorAction SilentlyContinue |
      Select-Object -First 1 -ExpandProperty FullName
    if ($installerPath) { $assets += $installerPath }

    # If the release already exists on GitHub, upload assets to it with
    # --clobber instead of failing.
    gh release view $tagName *> $null
    $releaseExists = ($LASTEXITCODE -eq 0)

    if ($releaseExists) {
      Write-Warning ("Release " + $tagName + " already exists on GitHub; uploading/replacing assets.")
      if ($assets.Count -gt 0) {
        & gh release upload $tagName @assets --clobber
        if ($LASTEXITCODE -ne 0) {
          Write-Warning ("gh release upload failed (exit " + $LASTEXITCODE + "). Skipping assets but keeping the release.")
          $releaseProblems += "gh release upload failed"
        } else {
          Ok ("Uploaded assets to existing release " + $tagName + ".")
        }
      }
    } else {
      $createArgs = @("release", "create", $tagName, "--title", ("Sync " + $tagName), "--notes", $notes)
      if ($assets.Count -gt 0) { $createArgs += $assets }
      & gh @createArgs
      if ($LASTEXITCODE -ne 0) {
        Write-Warning ("gh release create failed (exit " + $LASTEXITCODE + "). The build is still on disk and pushed; create the release manually if needed.")
        $releaseProblems += "gh release create failed"
      } else {
        Ok ("GitHub release " + $tagName + " created.")
      }
    }
  }
}

Section "Done"
if ($releaseProblems.Count -gt 0) {
  Write-Host ("Sync " + $tagName + " built. Some publish steps had issues: " + ($releaseProblems -join ", ")) -ForegroundColor Yellow
  Write-Host ("Repo: " + $remote) -ForegroundColor Yellow
} else {
  Write-Host ("Sync " + $tagName + " is released. Repo: " + $remote) -ForegroundColor Green
}
