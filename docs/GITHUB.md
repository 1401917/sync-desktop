# GitHub Workflow

## Connect The Local Repository

```powershell
git remote add origin https://github.com/1401917/sync-desktop.git
git branch -M main
git push -u origin main
```

## Authenticate

Recommended:

```powershell
winget install --id GitHub.cli -e
gh auth login --web --git-protocol https
```

Alternative:

```powershell
$env:GITHUB_TOKEN="your_token"
```

## Sync App GitHub Screen

The app's GitHub screen can:

- start GitHub CLI login
- check authenticated user
- list recent repositories

Future GitHub write actions should require explicit approval before:

- repository creation
- commits
- pushes
- pull requests
- issues
- branch deletion
- repository visibility changes

## Repository Hygiene

Before pushing:

```powershell
npm run build
npm test
cd src-tauri
cargo test
```

Do not commit:

- `.env`
- API keys
- local app databases
- `target/`
- `node_modules/`
- generated screenshots/logs unless intentionally documenting them
