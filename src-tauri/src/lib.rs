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
    ActionClassification, AiSubmissionResult, BootstrapPayload, FilePreview,
    GitHubConnectionStatus, GitHubLoginResult, GitHubRepositorySummary, McpConnectionTest,
    ProjectFileEntry, ProjectOpenResult, ProjectScan, ProviderSecretResult, TaskMutationResult,
};
use tauri::{AppHandle, State};
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
    state: State<'_, AppState>,
    prompt: String,
    history: Option<Vec<(String, String)>>,
) -> Result<AiSubmissionResult, String> {
    let database_path = active_database_path(&state)?;
    let history = history.unwrap_or_default();
    // submit_prompt does network I/O (the OpenAI-compatible chat completion)
    // plus SQLite writes. Without spawn_blocking the call would block the
    // WebView main thread for seconds and Windows would mark the app as
    // "Not Responding" — exactly what was happening before.
    tauri::async_runtime::spawn_blocking(move || {
        workspace::submit_prompt(&database_path, prompt, history)
    })
    .await
    .map_err(|error| format!("submit_ai_prompt join error: {error}"))?
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
            mask_secret_preview,
            scan_project_folder,
            git_status,
            open_project_folder,
            list_project_files,
            preview_project_file,
            update_task_status,
            save_provider_key_metadata,
            submit_ai_prompt,
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
