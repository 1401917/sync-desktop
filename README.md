# Sync Desktop

Sync is a Windows desktop AI coding workspace built with Tauri, Rust, React, TypeScript, Tailwind CSS, and SQLite.

The app is designed as a serious local-first AI development control center: project context, visible tasks, file safety, approvals, history, Git/GitHub workflows, MCP servers, connectors, and guarded tool execution.

## Current Status

This repository contains the MVP desktop foundation:

- Tauri 2 Windows desktop shell
- Custom frameless dark UI inspired by modern AI coding tools
- Local SQLite schema and seeded MVP data
- Task workflow model with ignored/restored/completed states
- Rust security primitives for risk classification, path safety, and secret masking
- Project folder scanning with sensitive file detection
- Git read tooling
- GitHub API status/repository listing when authenticated
- GitHub CLI login launcher
- MCP command/endpoint connection probe
- Connectors management surface

## Requirements

- Windows 10/11
- Node.js 20+
- npm
- Rust toolchain through rustup
- Visual Studio 2022 Build Tools with C++ workload
- Git
- Optional: GitHub CLI (`gh`) for browser-based GitHub login

## Install

```powershell
npm install
```

## Run In Development

```powershell
npm run tauri:dev
```

## Build The Windows EXE

```powershell
npm run tauri:build
```

The release executable is created at:

```text
src-tauri/target/release/sync.exe
```

## Test

Frontend:

```powershell
npm test
```

Rust:

```powershell
cd src-tauri
cargo test
```

Audit frontend dependencies:

```powershell
npm audit --audit-level=moderate
```

## GitHub Integration

Sync supports two MVP GitHub authentication paths:

1. Environment token:

```powershell
$env:GITHUB_TOKEN="ghp_your_token_here"
npm run tauri:dev
```

2. GitHub CLI login:

```powershell
gh auth login --web --git-protocol https
```

Inside Sync, open the GitHub screen and use:

- `Login with GitHub`
- `Check GitHub`

GitHub write actions should remain approval-gated. The MVP currently supports safe connection status and repository listing.

## MCP

The MCP screen can test:

- executable commands, such as `node` or `npx`
- HTTP endpoints, such as `https://example.com`

MCP server outputs should be treated as untrusted context and every tool call should be logged before this becomes a full automation layer.

## Project Structure

```text
src/                    React + TypeScript UI
src/features/           Feature surfaces and workflow logic
src/lib/                Frontend backend adapters and helpers
src/types/              Shared TypeScript domain types
src-tauri/src/          Rust desktop, storage, security, Git, GitHub, MCP
src-tauri/migrations/   SQLite schema and seed data
config/defaults/        JSON/TOML/YAML defaults and presets
requirements/           Product, design, database, security, and tool specifications
tests/                  Frontend tests
```

## Version Workflow

Use git for every meaningful step:

```powershell
git status --short --branch
git add .
git commit -m "Describe the change"
git push
```

Recommended release tags:

```powershell
git tag v0.1.0
git push origin v0.1.0
```

## Security Defaults

Sync is designed around explicit user control:

- Read opened project files only
- Ask before writes
- Ask before commands
- Ask before GitHub writes
- Protect sensitive files
- Mask secrets in logs and exports
- Keep history and audit records

## Roadmap

- Full GitHub OAuth app flow
- Secure credential storage for provider and connector tokens
- Full diff review and patch application UI
- Git commit/push approval flow
- MCP server registry and tool schemas
- Real connector OAuth flows
- AI provider streaming and task orchestration
- Installer packaging and signed releases
