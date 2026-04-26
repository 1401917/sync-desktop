# Sync release pipeline.
# Safe PowerShell release script for building, tagging, pushing, and publishing Sync.

[CmdletBinding()]
param(
  [string]$Version = "0.4.0",
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

function Warn($message) {
  Write-Host ("    WARNING: " + $message) -ForegroundColor Yellow
}

function Assert-Command($name, $installHint) {
  $cmd = Get-Command $name -ErrorAction SilentlyContinue
  if (-not $cmd) {
    throw ("Missing required command: " + $name + ". " + $installHint)
  }
}

function Assert-LastExit($message) {
  if ($LASTEXITCODE -ne 0) {
    throw $message
  }
}

function Get-SyncInstaller {
  $bundleRoot = Join-Path $RepoRoot "src-tauri\target\release\bundle"

  if (-not (Test-Path $bundleRoot)) {
    return $null
  }

  $candidates = @()

  $candidates += Get-ChildItem -Path $bundleRoot -Recurse -File -Filter "*.exe" -ErrorAction SilentlyContinue |
    Where-Object {
      $_.FullName -match "\\nsis\\" -or
      $_.Name -match "setup" -or
      $_.Name -match "sync"
    }

  if ($candidates.Count -eq 0) {
    $candidates += Get-ChildItem -Path $bundleRoot -Recurse -File -Filter "*.msi" -ErrorAction SilentlyContinue |
      Where-Object {
        $_.FullName -match "\\msi\\" -or
        $_.Name -match "sync"
      }
  }

  if ($candidates.Count -eq 0) {
    return $null
  }

  return $candidates |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
}

function Write-CommitMessageFile($content) {
  $path = Join-Path $env:TEMP ("sync-release-commit-" + [Guid]::NewGuid().ToString("N") + ".txt")
  [System.IO.File]::WriteAllText($path, $content, [System.Text.UTF8Encoding]::new($false))
  return $path
}

# --- 1. Sanity checks ---
Section "Pre-flight checks"

Assert-Command "git" "Install Git and make sure it is available in PATH."
Assert-Command "npm" "Install Node.js/npm and make sure npm is available in PATH."

git rev-parse --is-inside-work-tree | Out-Null
Assert-LastExit "Not a git repository. Run inside D:\Projects\codex."

$branch = git rev-parse --abbrev-ref HEAD
Assert-LastExit "Unable to resolve current git branch."
Ok ("Current branch: " + $branch)

$remote = git remote get-url origin
Assert-LastExit "Unable to resolve git origin remote."
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
Assert-LastExit "git add failed."

$stagedAfterAdd = git diff --cached --name-only
if ($stagedAfterAdd -match "src-tauri/\.cargo/config\.toml") {
  throw "ABORT: src-tauri/.cargo/config.toml became staged after git add -A. Unstage it before continuing."
}

$changes = git diff --cached --name-only

if (-not $changes) {
  Write-Host "    No staged changes; assuming the version bump was already committed." -ForegroundColor Yellow
} else {
  Write-Host "Files staged:"
  $changes | ForEach-Object { Write-Host ("  " + $_) }

  $msgLines = @()
  $msgLines += ("Release v" + $Version)
  $msgLines += ""
  $msgLines += "Coding workspace foundation:"
  $msgLines += "- Command Palette (Ctrl+Shift+P) - VS Code-style compact bar, 27+ built-in commands across AI/Project/Build/Git/Terminal/View/Settings/MCP categories with risk badges"
  $msgLines += "- Bottom Panel (Ctrl+J) with Terminal / Problems / Output tabs"
  $msgLines += "- Real Rust terminal command runner (run_terminal_command) with destructive-token blocking"
  $msgLines += "- Terminal autocomplete: 34 git/gh/npm/cargo/tsc/Windows-shell suggestions with Tab + arrow navigation"
  $msgLines += "- Terminal command history (50 last) with arrow-up/down recall"
  $msgLines += "- Problems panel parses tsc/cargo/generic error output into structured items with Ask AI to fix"
  $msgLines += "- View menu now lists Terminal, Command Palette, Toggle Sidebar, Toggle Bottom Panel, Fullscreen, Reload"
  $msgLines += ""
  $msgLines += "AI tool calling:"
  $msgLines += "- read_file_tool, list_directory_tool, write_file_tool, apply_patch_tool, delete_file_tool exposed as Tauri commands"
  $msgLines += "- ensure_under_root canonicalization + sensitive-token allowlist (no .env, .key, id_rsa, credentials, system paths)"
  $msgLines += "- Auto-apply pipeline: AI emits sync:path= and sync:delete= markers, Sync writes/deletes files automatically with snapshots"
  $msgLines += "- HARD RULES system prompt forces sync:path / sync:delete usage so the user never copy-pastes code manually"
  $msgLines += "- File deletions: snapshot before delete, audit log entry, blocked inside .git/node_modules/target/dist"
  $msgLines += ""
  $msgLines += "Chat UX:"
  $msgLines += "- Enter sends prompt, Shift+Enter inserts newline; IME-safe"
  $msgLines += "- Save-to-file button removed from code blocks; AI writes files directly via auto-apply"
  $msgLines += "- Real chat bubbles, Markdown rendering, animated Thinking indicator with rotating stages and elapsed seconds"
  $msgLines += "- Multi-turn history replayed to model"
  $msgLines += ""
  $msgLines += "Navigation & shell:"
  $msgLines += "- Title-bar Back / Forward arrows wired to a real navigation history stack"
  $msgLines += "- Working File/Edit/View/Window/Help dropdowns"
  $msgLines += "- Codex-style sidebar"
  $msgLines += "- Active Tasks panel hidden outside session/tasks views; neutral grayscale palette"
  $msgLines += "- TopBar safe in browser-preview workflow"
  $msgLines += "- Real History view with relative timestamps and date buckets"
  $msgLines += ""
  $msgLines += "Provider, security, persistence:"
  $msgLines += "- OpenAI-compatible chat completions for NVIDIA NIM, OpenAI, Groq, Together"
  $msgLines += "- API keys persisted to %APPDATA%\Sync\provider_keys\; SQLite stores only masked metadata"
  $msgLines += "- NVIDIA auto-config via SYNC_DEFAULT_NVIDIA_KEY env from gitignored .cargo/config.toml"
  $msgLines += "- Tauri commands moved to async + spawn_blocking"
  $msgLines += "- .gitignore excludes *.key, secrets.local.*, .cargo/config.toml"
  $msgLines += ""
  $msgLines += "Release pipeline:"
  $msgLines += "- release.ps1 launches the new exe before network/git steps"
  $msgLines += "- Auto-detects existing GitHub release and uploads assets with --clobber instead of failing"
  $msgLines += "- Kills any running sync.exe before the rebuild so Cargo can replace it"

  $commitMsg = $msgLines -join [Environment]::NewLine
  $tmpCommitMsg = $null

  try {
    $tmpCommitMsg = Write-CommitMessageFile $commitMsg
    git commit -F $tmpCommitMsg
    Assert-LastExit "git commit failed."
    Ok "Commit created."
  } finally {
    if ($tmpCommitMsg -and (Test-Path $tmpCommitMsg)) {
      Remove-Item $tmpCommitMsg -Force -ErrorAction SilentlyContinue
    }
  }
}

# --- 3. Build the Windows release ---
$exe = Join-Path $RepoRoot "src-tauri\target\release\sync.exe"
$installer = $null

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

  Section "Building Tauri release"
  npm run tauri:build
  Assert-LastExit "Tauri build failed."

  if (-not (Test-Path $exe)) {
    throw ("Build finished but sync.exe is missing at " + $exe)
  }

  Ok ("sync.exe built: " + $exe)

  $installer = Get-SyncInstaller
  if ($installer) {
    Ok ("Installer: " + $installer.FullName)
  } else {
    Warn "No NSIS/MSI installer was found. Will skip installer upload."
  }
} else {
  if (Test-Path $exe) {
    Ok ("Using existing sync.exe: " + $exe)
  }

  $installer = Get-SyncInstaller
  if ($installer) {
    Ok ("Using existing installer: " + $installer.FullName)
  }
}

# --- 4. Launch the new build early ---
if ($Launch) {
  if (Test-Path $exe) {
    Section "Launching new Sync build"
    Start-Process -FilePath $exe
    Ok ("Launched: " + $exe)
  } else {
    Warn ("sync.exe not found at " + $exe + "; cannot launch.")
  }
}

# Network/git publishing should not hide the local build result.
$ErrorActionPreference = "Continue"
$releaseProblems = @()

# --- 5. Tag ---
$tagName = "v" + $Version
Section ("Tagging " + $tagName)

$existingTag = git tag --list $tagName
if ($existingTag) {
  Warn ("Tag " + $tagName + " already exists locally; skipping git tag.")
} else {
  git tag -a $tagName -m ("Sync " + $tagName)
  if ($LASTEXITCODE -ne 0) {
    Warn "git tag failed."
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
    Warn "git push branch failed."
    $releaseProblems += "git push branch failed"
  } else {
    Ok "Branch pushed."
  }

  git push origin $tagName 2>&1 | Out-Host
  if ($LASTEXITCODE -ne 0) {
    Warn "git push tag failed. This may be safe if the tag already exists on origin."
    $releaseProblems += "git push tag failed"
  } else {
    Ok "Tag pushed."
  }
}

# --- 7. GitHub release ---
if (-not $SkipRelease) {
  Section "Creating GitHub release"

  $ghAvailable = $false
  $ghCommand = Get-Command "gh" -ErrorAction SilentlyContinue

  if ($ghCommand) {
    try {
      gh --version *> $null
      $ghAvailable = ($LASTEXITCODE -eq 0)
    } catch {
      $ghAvailable = $false
    }
  }

  if (-not $ghAvailable) {
    Warn "gh CLI is not available. Skipping the GitHub release step."
    Write-Host "    Install with: winget install GitHub.cli" -ForegroundColor Yellow
    Write-Host ("    Or create the release manually at: https://github.com/1401917/sync-desktop/releases/new?tag=" + $tagName)
  } else {
    $notes = ("See CHANGELOG.md for the full list of changes in " + $tagName + ".")

    $assets = @()
    if (Test-Path $exe) {
      $assets += $exe
    }

    if (-not $installer) {
      $installer = Get-SyncInstaller
    }

    if ($installer) {
      $assets += $installer.FullName
    }

    gh release view $tagName *> $null
    $releaseExists = ($LASTEXITCODE -eq 0)

    if ($releaseExists) {
      Warn ("Release " + $tagName + " already exists on GitHub; uploading/replacing assets.")
      if ($assets.Count -gt 0) {
        & gh release upload $tagName @assets --clobber
        if ($LASTEXITCODE -ne 0) {
          Warn ("gh release upload failed. Exit code: " + $LASTEXITCODE)
          $releaseProblems += "gh release upload failed"
        } else {
          Ok ("Uploaded assets to existing release " + $tagName + ".")
        }
      } else {
        Warn "No release assets found to upload."
        $releaseProblems += "no release assets found"
      }
    } else {
      $createArgs = @(
        "release",
        "create",
        $tagName,
        "--title",
        ("Sync " + $tagName),
        "--notes",
        $notes
      )

      if ($assets.Count -gt 0) {
        $createArgs += $assets
      }

      & gh @createArgs
      if ($LASTEXITCODE -ne 0) {
        Warn ("gh release create failed. Exit code: " + $LASTEXITCODE)
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