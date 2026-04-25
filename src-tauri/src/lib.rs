mod connectors;
mod database;
mod filesystem;
mod git;
mod github;
mod history;
mod mcp;
mod models;
mod security;
mod settings;
mod tools;
mod workspace;

use std::path::PathBuf;
use std::sync::Mutex;

use models::{
    ActionClassification, AiJobUpdate, AiSubmissionResult, BootstrapPayload, FilePreview,
    GitHubConnectionStatus, GitHubLoginResult, GitHubRepositorySummary, LoadedChat,
    McpConnectionTest, ProjectFileEntry, ProjectOpenResult, ProjectScan, ProviderSecretResult,
    TaskMutationResult,
};
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_opener::OpenerExt;

#[derive(Default)]
struct AppState {
    database_path: Mutex<Option<PathBuf>>,
}

#[tauri::command]
fn bootstrap(app: AppHandle, state: State<'_, AppState>) -> Result<BootstrapPayload, String> {
    let sync_database = database::initialize(&app)?;
    let payload = database::bootstrap_payload(&sync_database)?;

    let mut database_path = state
        .database_path
        .lock()
        .map_err(|_| "Database state lock was poisoned".to_string())?;
    *database_path = Some(sync_database.path);

    Ok(payload)
}

#[tauri::command]
fn classify_command(command: String) -> ActionClassification {
    security::classify_action("run_command", &command, "Terminal")
}

// ---------------------------------------------------------------------------
// Tool-calling primitives. These are the surface area an agent will use to
// inspect and modify the active project. Each tool is a Tauri command so
// it can be invoked from React directly *and* later wired into the AI's
// function-calling loop without changing the implementation.
// ---------------------------------------------------------------------------

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct DirectoryEntry {
    name: String,
    relative_path: String,
    is_directory: bool,
    is_file: bool,
    size_bytes: u64,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct FileToolResult {
    path: String,
    relative_path: String,
    bytes: u64,
    lines_added: usize,
    lines_removed: usize,
    lines_modified: usize,
    truncated: bool,
    content: Option<String>,
}

const MAX_TOOL_FILE_BYTES: u64 = 512 * 1024;
const SENSITIVE_FILE_TOKENS: &[&str] = &[
    ".env", ".env.local", "id_rsa", "id_ed25519", ".pem", ".key",
    ".pfx", ".p12", "secrets.local", "credentials", "wallet",
];

fn ensure_under_root(root: &std::path::Path, candidate: &std::path::Path) -> Result<std::path::PathBuf, String> {
    let canonical_root = root
        .canonicalize()
        .map_err(|error| format!("Project root cannot be resolved: {error}"))?;
    // Resolve the candidate, but if it doesn't exist yet (e.g. brand-new
    // file via write_file_tool), resolve its parent and re-append the file
    // name so we still get a canonical path.
    let canonical_candidate = match candidate.canonicalize() {
        Ok(path) => path,
        Err(_) => {
            let parent = candidate
                .parent()
                .ok_or_else(|| "Path has no parent.".to_string())?;
            let parent_canonical = parent.canonicalize().map_err(|error| {
                format!("Parent directory does not exist or is unreadable: {error}")
            })?;
            let leaf = candidate
                .file_name()
                .ok_or_else(|| "Path has no file name.".to_string())?;
            parent_canonical.join(leaf)
        }
    };
    if !canonical_candidate.starts_with(&canonical_root) {
        return Err(format!(
            "Refusing to touch a path outside the project root. Path: {} Root: {}",
            canonical_candidate.display(),
            canonical_root.display()
        ));
    }
    let lower = canonical_candidate.to_string_lossy().to_lowercase();
    for token in SENSITIVE_FILE_TOKENS {
        if lower.contains(token) {
            return Err(format!(
                "Refusing to touch a sensitive path '{}'. Edit it manually if you really mean it.",
                token
            ));
        }
    }
    Ok(canonical_candidate)
}

/// Read a UTF-8 text file inside the active project. Truncates oversized files.
#[tauri::command]
async fn read_file_tool(
    project_root: String,
    relative_path: String,
) -> Result<FileToolResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let root = std::path::PathBuf::from(&project_root);
        let candidate = root.join(&relative_path);
        let resolved = ensure_under_root(&root, &candidate)?;

        let metadata = std::fs::metadata(&resolved)
            .map_err(|error| format!("Unable to stat file: {error}"))?;
        if !metadata.is_file() {
            return Err("Path is not a regular file.".to_string());
        }
        let size = metadata.len();
        let truncated = size > MAX_TOOL_FILE_BYTES;
        let bytes = std::fs::read(&resolved).map_err(|error| format!("Read failed: {error}"))?;
        let limited = if truncated {
            bytes[..MAX_TOOL_FILE_BYTES as usize].to_vec()
        } else {
            bytes
        };
        let content = String::from_utf8_lossy(&limited).to_string();
        Ok(FileToolResult {
            path: resolved.to_string_lossy().to_string(),
            relative_path,
            bytes: size,
            lines_added: 0,
            lines_removed: 0,
            lines_modified: 0,
            truncated,
            content: Some(content),
        })
    })
    .await
    .map_err(|error| format!("read_file_tool join error: {error}"))?
}

/// List directory entries (files + folders) inside the project root.
#[tauri::command]
async fn list_directory_tool(
    project_root: String,
    relative_path: String,
) -> Result<Vec<DirectoryEntry>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let root = std::path::PathBuf::from(&project_root);
        let candidate = if relative_path.is_empty() || relative_path == "." {
            root.clone()
        } else {
            root.join(&relative_path)
        };
        let resolved = ensure_under_root(&root, &candidate)?;
        let entries = std::fs::read_dir(&resolved)
            .map_err(|error| format!("Unable to list directory: {error}"))?;
        let mut out: Vec<DirectoryEntry> = Vec::new();
        let canonical_root = root
            .canonicalize()
            .map_err(|error| format!("Root canonicalize failed: {error}"))?;
        for entry in entries.flatten() {
            let path = entry.path();
            let metadata = match entry.metadata() {
                Ok(value) => value,
                Err(_) => continue,
            };
            let rel = path
                .strip_prefix(&canonical_root)
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_else(|_| entry.file_name().to_string_lossy().to_string());
            out.push(DirectoryEntry {
                name: entry.file_name().to_string_lossy().to_string(),
                relative_path: rel,
                is_directory: metadata.is_dir(),
                is_file: metadata.is_file(),
                size_bytes: if metadata.is_file() { metadata.len() } else { 0 },
            });
        }
        out.sort_by(|a, b| {
            a.is_directory
                .cmp(&b.is_directory)
                .reverse()
                .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
        });
        Ok(out)
    })
    .await
    .map_err(|error| format!("list_directory_tool join error: {error}"))?
}

/// Write or overwrite a UTF-8 text file inside the project root. Returns
/// line-count diff stats vs. the previous version (or 0/0/0 for new files).
#[tauri::command]
async fn write_file_tool(
    project_root: String,
    relative_path: String,
    content: String,
) -> Result<FileToolResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let root = std::path::PathBuf::from(&project_root);
        let candidate = root.join(&relative_path);
        let resolved = ensure_under_root(&root, &candidate)?;

        let previous = std::fs::read_to_string(&resolved).ok();
        if let Some(parent) = resolved.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|error| format!("Unable to create parent dir: {error}"))?;
        }
        std::fs::write(&resolved, &content)
            .map_err(|error| format!("Write failed: {error}"))?;

        let new_lines: Vec<&str> = content.split('\n').collect();
        let (lines_added, lines_removed, lines_modified) = if let Some(prev) = previous.as_deref() {
            let old_lines: Vec<&str> = prev.split('\n').collect();
            let added = new_lines.len().saturating_sub(old_lines.len());
            let removed = old_lines.len().saturating_sub(new_lines.len());
            let max = std::cmp::min(new_lines.len(), old_lines.len());
            let mut modified = 0usize;
            for i in 0..max {
                if new_lines[i] != old_lines[i] {
                    modified += 1;
                }
            }
            (added, removed, modified)
        } else {
            (new_lines.len(), 0, 0)
        };

        Ok(FileToolResult {
            path: resolved.to_string_lossy().to_string(),
            relative_path,
            bytes: content.len() as u64,
            lines_added,
            lines_removed,
            lines_modified,
            truncated: false,
            content: None,
        })
    })
    .await
    .map_err(|error| format!("write_file_tool join error: {error}"))?
}

/// Search-and-replace patch inside an existing file. Fails if `search` is
/// not found exactly once (so the AI cannot accidentally collapse multiple
/// regions). Returns line-count diff stats.
#[tauri::command]
async fn apply_patch_tool(
    project_root: String,
    relative_path: String,
    search: String,
    replace: String,
) -> Result<FileToolResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        if search.is_empty() {
            return Err("Search string cannot be empty.".to_string());
        }
        let root = std::path::PathBuf::from(&project_root);
        let candidate = root.join(&relative_path);
        let resolved = ensure_under_root(&root, &candidate)?;
        let original = std::fs::read_to_string(&resolved)
            .map_err(|error| format!("Read failed: {error}"))?;

        let occurrences = original.matches(&search).count();
        if occurrences == 0 {
            return Err("Search string was not found in the file.".to_string());
        }
        if occurrences > 1 {
            return Err(format!(
                "Search string occurs {occurrences} times — refusing to patch ambiguously. Add more context."
            ));
        }
        let updated = original.replacen(&search, &replace, 1);
        std::fs::write(&resolved, &updated)
            .map_err(|error| format!("Write failed: {error}"))?;

        let old_lines: Vec<&str> = original.split('\n').collect();
        let new_lines: Vec<&str> = updated.split('\n').collect();
        let added = new_lines.len().saturating_sub(old_lines.len());
        let removed = old_lines.len().saturating_sub(new_lines.len());
        let max = std::cmp::min(new_lines.len(), old_lines.len());
        let mut modified = 0usize;
        for i in 0..max {
            if new_lines[i] != old_lines[i] {
                modified += 1;
            }
        }
        Ok(FileToolResult {
            path: resolved.to_string_lossy().to_string(),
            relative_path,
            bytes: updated.len() as u64,
            lines_added: added,
            lines_removed: removed,
            lines_modified: modified,
            truncated: false,
            content: None,
        })
    })
    .await
    .map_err(|error| format!("apply_patch_tool join error: {error}"))?
}

/// Result of a terminal command run from the Bottom Panel.
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct TerminalCommandResult {
    command: String,
    cwd: String,
    exit_code: i32,
    stdout: String,
    stderr: String,
}

const BLOCKED_COMMAND_TOKENS: &[&str] = &[
    "format c:",
    "rmdir /s",
    "rd /s",
    "del /s /q c:\\",
    "shutdown",
    ":(){ :|:& };:",
    "mkfs",
    "diskpart",
];

const DANGEROUS_RM_PATTERNS: &[&str] = &["rm -rf /", "rm -rf c:\\", "rm -rf ~"];

/// Run a single shell command from the integrated terminal. Always logs the
/// invocation. Refuses obviously destructive system-wide commands. Output is
/// captured (no live streaming yet).
///
/// The command runs through `cmd /C ...` on Windows so that things like
/// `npm`, `git`, `cargo`, etc. are resolved through the user's PATH.
#[tauri::command]
async fn run_terminal_command(
    command: String,
    cwd: Option<String>,
) -> Result<TerminalCommandResult, String> {
    let trimmed = command.trim().to_string();
    if trimmed.is_empty() {
        return Err("Empty command.".to_string());
    }
    let lower = trimmed.to_lowercase();
    for blocked in BLOCKED_COMMAND_TOKENS {
        if lower.contains(blocked) {
            return Err(format!(
                "Blocked: command contains a destructive token ('{blocked}'). Use the OS shell directly if you really mean it."
            ));
        }
    }
    for dangerous in DANGEROUS_RM_PATTERNS {
        if lower.contains(dangerous) {
            return Err(format!(
                "Blocked: '{dangerous}' would wipe your filesystem. Refusing."
            ));
        }
    }

    let working_dir = cwd
        .as_ref()
        .map(std::path::PathBuf::from)
        .filter(|path| path.exists())
        .or_else(|| std::env::current_dir().ok())
        .unwrap_or_else(|| std::path::PathBuf::from("."));

    let working_dir_str = working_dir.to_string_lossy().to_string();

    tauri::async_runtime::spawn_blocking(move || {
        use std::process::Command;
        let mut binding;
        let cmd = if cfg!(windows) {
            binding = Command::new("cmd");
            binding.arg("/C").arg(&trimmed);
            &mut binding
        } else {
            binding = Command::new("sh");
            binding.arg("-c").arg(&trimmed);
            &mut binding
        };
        let output = cmd
            .current_dir(&working_dir)
            .output()
            .map_err(|error| format!("Failed to spawn command: {error}"))?;
        Ok(TerminalCommandResult {
            command: trimmed,
            cwd: working_dir_str,
            exit_code: output.status.code().unwrap_or(-1),
            stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
            stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
        })
    })
    .await
    .map_err(|error| format!("run_terminal_command join error: {error}"))?
}

/// Write a UTF-8 text file. The path is whatever the user picked from the
/// system save dialog, so we trust it but still refuse system-critical
/// directories. Used by the "Save to file" action on chat code blocks.
#[tauri::command]
async fn write_text_file_at_path(path: String, content: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let lower = path.to_lowercase();
        let blocked_prefixes = [
            "c:\\windows",
            "c:\\program files",
            "c:\\program files (x86)",
            "c:\\programdata\\microsoft",
        ];
        if blocked_prefixes
            .iter()
            .any(|prefix| lower.starts_with(prefix))
        {
            return Err(format!(
                "Refusing to write into protected system path: {path}"
            ));
        }

        let target = std::path::PathBuf::from(&path);
        if let Some(parent) = target.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|error| format!("Unable to create parent directory: {error}"))?;
        }
        std::fs::write(&target, content.as_bytes())
            .map_err(|error| format!("Unable to write file: {error}"))?;
        Ok(path)
    })
    .await
    .map_err(|error| format!("write_text_file_at_path join error: {error}"))?
}

#[tauri::command]
fn mask_secret_preview(input: String) -> String {
    security::mask_secrets(&input)
}

#[tauri::command]
fn scan_project_folder(root: String) -> Result<ProjectScan, String> {
    filesystem::scan_project_folder(root)
}

#[tauri::command]
fn git_status(root: String) -> Result<String, String> {
    git::status(root)
}

#[tauri::command]
fn open_project_folder(
    state: State<'_, AppState>,
    root: String,
) -> Result<ProjectOpenResult, String> {
    let database_path = active_database_path(&state)?;
    workspace::open_project(&database_path, root)
}

#[tauri::command]
fn list_project_files(
    state: State<'_, AppState>,
    project_id: String,
) -> Result<Vec<ProjectFileEntry>, String> {
    let database_path = active_database_path(&state)?;
    workspace::list_project_files(&database_path, project_id)
}

#[tauri::command]
fn preview_project_file(
    state: State<'_, AppState>,
    project_id: String,
    relative_path: String,
) -> Result<FilePreview, String> {
    let database_path = active_database_path(&state)?;
    workspace::preview_project_file(&database_path, project_id, relative_path)
}

#[tauri::command]
fn update_task_status(
    state: State<'_, AppState>,
    task_id: String,
    status: String,
    reason: Option<String>,
) -> Result<TaskMutationResult, String> {
    let database_path = active_database_path(&state)?;
    workspace::update_task_status(&database_path, task_id, status, reason)
}

#[tauri::command]
async fn save_provider_key_metadata(
    state: State<'_, AppState>,
    provider_id: String,
    key: String,
) -> Result<ProviderSecretResult, String> {
    let database_path = active_database_path(&state)?;
    // The save touches the filesystem and SQLite. Run it on the blocking
    // thread pool so we never freeze the WebView main thread.
    tauri::async_runtime::spawn_blocking(move || {
        workspace::save_provider_secret_metadata(&database_path, provider_id, key)
    })
    .await
    .map_err(|error| format!("save_provider_key_metadata join error: {error}"))?
}

#[tauri::command]
async fn submit_ai_prompt(
    app: AppHandle,
    state: State<'_, AppState>,
    prompt: String,
    history: Option<Vec<(String, String)>>,
    project_id: Option<String>,
) -> Result<AiSubmissionResult, String> {
    let database_path = active_database_path(&state)?;
    let history = history.unwrap_or_default();
    let prompt_for_job = prompt.clone();
    let project_for_job = project_id.clone();
    let started = tauri::async_runtime::spawn_blocking({
        let database_path = database_path.clone();
        move || workspace::start_prompt_job(&database_path, prompt, project_id)
    })
    .await
    .map_err(|error| format!("submit_ai_prompt start join error: {error}"))??;

    let update_session_id = started.session_id.clone();
    let update_message_id = started.assistant_message_id.clone();
    let started_for_event = started.clone();
    tauri::async_runtime::spawn(async move {
        let result: Result<AiJobUpdate, String> = tauri::async_runtime::spawn_blocking(move || {
            workspace::complete_prompt_job(
                &database_path,
                update_session_id,
                update_message_id,
                prompt_for_job,
                history,
                project_for_job,
            )
        })
        .await
        .map_err(|error| format!("submit_ai_prompt completion join error: {error}"))
        .and_then(|value| value);

        let payload = match result {
            Ok(update) => update,
            Err(error) => AiJobUpdate {
                session_id: started_for_event.session_id.clone(),
                assistant_message_id: started_for_event.assistant_message_id.clone(),
                status: "error".to_string(),
                assistant_message: format!("Sync background job failed: {error}"),
                provider_status: "Error".to_string(),
                error_message: Some(error),
                applied_files: Vec::new(),
                tasks: started_for_event.tasks.clone(),
            },
        };
        let _ = app.emit("sync://ai-job-updated", payload);
    });

    Ok(started)
}

#[tauri::command]
fn load_latest_chat(state: State<'_, AppState>) -> Result<Option<LoadedChat>, String> {
    let database_path = active_database_path(&state)?;
    workspace::load_latest_chat(&database_path)
}

#[tauri::command]
fn github_connection_status() -> GitHubConnectionStatus {
    github::connection_status()
}

#[tauri::command]
fn github_list_repositories(limit: u8) -> Result<Vec<GitHubRepositorySummary>, String> {
    github::list_repositories(limit)
}

#[tauri::command]
fn github_login_with_cli() -> GitHubLoginResult {
    github::start_cli_login()
}

#[tauri::command]
fn github_start_oauth() -> GitHubLoginResult {
    github::start_oauth()
}

#[tauri::command]
fn open_url(app: AppHandle, url: String) -> Result<(), String> {
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|error| format!("Failed to open URL: {error}"))
}

#[tauri::command]
fn mcp_test_connection(target: String) -> McpConnectionTest {
    mcp::test_connection(target)
}

fn active_database_path(state: &State<'_, AppState>) -> Result<PathBuf, String> {
    state
        .database_path
        .lock()
        .map_err(|_| "Database state lock was poisoned".to_string())?
        .clone()
        .ok_or_else(|| "Sync database is not initialized yet".to_string())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            bootstrap,
            classify_command,
            write_text_file_at_path,
            run_terminal_command,
            read_file_tool,
            list_directory_tool,
            write_file_tool,
            apply_patch_tool,
            mask_secret_preview,
            scan_project_folder,
            git_status,
            open_project_folder,
            list_project_files,
            preview_project_file,
            update_task_status,
            save_provider_key_metadata,
            submit_ai_prompt,
            load_latest_chat,
            github_connection_status,
            github_list_repositories,
            github_login_with_cli,
            github_start_oauth,
            open_url,
            mcp_test_connection
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Sync");
}
