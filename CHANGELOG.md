# Changelog

All notable changes to Sync Desktop are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-04-25

### Fixed
- **App no longer freezes / crashes ("Sync (Not Responding)") on AI calls.**
  The `submit_ai_prompt` and `save_provider_key_metadata` Tauri commands were
  doing blocking HTTP + SQLite work on the WebView main thread. They now run
  inside `tauri::async_runtime::spawn_blocking`, so the UI stays responsive
  while the request to NVIDIA NIM is in flight.

### Added
- **Real chat UI with bubbles.** Once a prompt is sent, the workspace
  switches from the empty hero state to a scrollable chat view. User
  messages appear right-aligned in a filled bubble, assistant responses
  left-aligned in a bordered bubble, and errors are tinted red. The composer
  pins to the bottom of the chat area. Long messages wrap and preserve
  newlines.
- **"Thinking…" indicator with stages and elapsed seconds.** While Sync is
  waiting for the AI response, an animated spinner shows a rotating stage
  label (Thinking → Reading project context → Drafting plan → Calling
  NVIDIA NIM → Composing response) and an elapsed-seconds counter, so the
  user sees that work is progressing. The Send button also turns into a
  spinner and the textarea is disabled while busy.

### Changed
- Send button is properly disabled when the prompt is empty or while the
  assistant is generating.



### Added
- **Codex-style sidebar.** Compact New chat / Search / Plugins / Automations row
  at the top, a real Projects section with collapsible per-project entries
  (current session + history), and a single Settings entry pinned to the
  bottom. Secondary tools (Files, Diff, Prompts, GitHub, MCP, Security, Models)
  collapse under a Tools group so they don't drown out the primary nav.
- **Functional menu bar.** File, Edit, View, Window, and Help now open real
  drop-down menus with working actions: New Window (Ctrl+Shift+N), Close
  Window, Undo / Redo / Cut / Copy / Paste, Toggle Fullscreen (F11), Reload
  (Ctrl+R), Minimize, Maximize/Restore, Open Documentation, and Report Issue.
- **Real AI provider calls.** Submitting a prompt now actually calls the
  configured provider's `/chat/completions` endpoint (OpenAI-compatible) using
  the saved API key and the enabled default model profile. Supported
  out-of-the-box: NVIDIA NIM, OpenAI, Groq, Together, and any other
  OpenAI-compatible base URL.
- **Real provider key persistence.** API keys saved from the Models panel are
  now written to `%APPDATA%\Sync\provider_keys\<provider>.key` and used by
  `submit_prompt`. The database keeps only a masked preview, and Sync does not
  mark a provider connected until a real provider call/test succeeds.
- **Better GitHub Connect errors.** The OAuth Device Flow code now returns
  meaningful messages (e.g. `incorrect_client_credentials — The client_id is
  invalid`) instead of the opaque "GitHub device-code response could not be
  parsed: error decoding response body".

### Changed
- **Active Tasks panel hidden by default.** It only appears once a real
  prompt has been submitted and tasks exist; the empty Projects landing no
  longer shows demo seed tasks.
- **Active Tasks neutral palette.** All blue-tinted accents (`#0D131B`,
  `#1C2633`, `#284362`, `text-sync-accent`, the blue `ChevronsUp` icon, etc.)
  swapped for neutral grays matching the rest of the app. The blue dot in the
  title bar is now neutral gray.
- **Models panel simplified.** The confusing four-info grid (Status /
  Configured / Masked key / Enabled) is now two cards (Configured + Masked
  key) plus a green/neutral dot indicator in the provider list. Removed the
  "Secure credential persistence is pending" warning text. Saving a key now
  marks the provider as Connected immediately, with a friendly "API key
  saved. Provider is connected." confirmation.
- **Open Project Folder button auto-hides.** After picking a folder, the
  button is replaced with a green "ProjectName • opened" badge. The button
  no longer disappears just because the demo seed has a `selected: true`
  project — only a real `handleProjectOpened` flips the state.
- **Faster Cargo release builds.** Added `[profile.release]` with
  `lto = false`, `codegen-units = 16`, `incremental = true`, and `opt-level = 2`.
  Final binary is ~10-20% larger but builds 2-4× faster.

### Fixed
- **`Wrong number of parameters passed to query. Got 3, needed 4`.** The
  `INSERT INTO task_lists` statement had four `?` placeholders but only three
  values; `session_id` was missing from `params!`.
- **No compile-time provider key seeding.** Sync no longer reads provider keys
  from Cargo environment configuration at startup, so API keys are not embedded
  into release binaries.

### Security
- `.gitignore` excludes `src-tauri/.cargo/config.toml`,
  `src-tauri/.cargo/`, `*.key`, and `secrets.local.*` to keep local
  credentials out of version control.
- Provider API keys now live in `%APPDATA%\Sync\provider_keys\` outside the
  database. Database rows hold only a masked preview.

## [0.1.0] - 2026-04-24

### Added
- Initial Tauri 2 + React + TypeScript desktop shell.
- Local SQLite schema with task workflow, sessions, messages, and audit log.
- Rust security primitives: risk classification, path safety, secret masking.
- Project folder scanning with sensitive-file detection.
- Git read tooling.
- GitHub Device Flow / `GITHUB_TOKEN` / `gh` CLI auth.
- MCP command/endpoint connection probe.
- Connectors management surface.
