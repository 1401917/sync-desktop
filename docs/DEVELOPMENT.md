# Development Guide

## Useful Commands

```powershell
npm install
npm run build
npm test
npm run tauri:dev
npm run tauri:build
```

```powershell
cd src-tauri
cargo test
```

## Running The Built App

```powershell
.\src-tauri\target\release\sync.exe
```

The app is configured as a Windows GUI subsystem app, so release builds should not open a separate command window.

## Tauri Window Controls

The custom title bar uses Tauri window APIs:

- close
- minimize
- toggle maximize
- start dragging

Those APIs require explicit permissions in `src-tauri/capabilities/default.json`.

## Database

SQLite is initialized under the user app data directory. Migrations are embedded from:

```text
src-tauri/migrations
```

Every schema change should add a new migration and a focused Rust test.

## Security Rules

Keep these defaults intact:

- no silent file writes
- no silent commands
- no silent GitHub writes
- no secrets in normal database rows
- no sensitive file reads without approval
- all risky actions logged

## Git Workflow

Before each implementation pass:

```powershell
git status --short --branch
```

After a complete working change:

```powershell
git add .
git commit -m "Short present-tense summary"
```

Before pushing:

```powershell
npm run build
npm test
cd src-tauri
cargo test
```
