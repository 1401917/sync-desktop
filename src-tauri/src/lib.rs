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

use std::path::PathBuf;
use std::sync::Mutex;

use models::{
    ActionClassification, BootstrapPayload, GitHubConnectionStatus, GitHubRepositorySummary,
    McpConnectionTest, ProjectScan,
};
use tauri::{AppHandle, State};

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
fn github_connection_status() -> GitHubConnectionStatus {
    github::connection_status()
}

#[tauri::command]
fn github_list_repositories(limit: u8) -> Result<Vec<GitHubRepositorySummary>, String> {
    github::list_repositories(limit)
}

#[tauri::command]
fn mcp_test_connection(target: String) -> McpConnectionTest {
    mcp::test_connection(target)
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            bootstrap,
            classify_command,
            mask_secret_preview,
            scan_project_folder,
            git_status,
            github_connection_status,
            github_list_repositories,
            mcp_test_connection
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Sync");
}
