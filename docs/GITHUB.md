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

Sync checks `gh auth token` after CLI login, so the desktop app can use the same GitHub account for read-only account and repository status.

Alternative:

```powershell
$env:GITHUB_TOKEN="your_token"
```

## Sync App GitHub Prompt

Sync does not keep GitHub as a permanent sidebar destination. The app opens a compact GitHub sign-in frame only when an AI request needs GitHub account access, such as:

- creating a repository
- pushing branches
- opening pull requests
- creating issues
- accessing private GitHub repositories

The prompt can start GitHub Device Flow login, fall back to GitHub CLI login, check the authenticated user, and then let the guarded GitHub flow continue.

## OAuth App Registration

For the GitHub OAuth app form:

- Application name: `Sync Desktop`
- Homepage URL: `https://github.com/1401917/sync-desktop`
- Application description: `Secure local-first desktop AI development workspace for projects, agents, tasks, diffs, GitHub workflows, MCP servers, and connectors.`
- Authorization callback URL: `http://127.0.0.1:1420/auth/github/callback`
- Enable Device Flow: enabled

The MVP uses Device Flow for the desktop login path, so no OAuth client secret is stored in the application source or bundled EXE. The callback URL is kept for a future local callback flow.

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
