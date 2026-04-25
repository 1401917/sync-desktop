use std::fs;
use std::path::{Path, PathBuf};

use rusqlite::{params, Connection, OptionalExtension};
use uuid::Uuid;

use crate::filesystem;
use crate::history;
use crate::models::{
    AiSubmissionResult, FilePreview, ModelProviderSummary, ProjectFileEntry, ProjectOpenResult,
    ProjectSummary, ProviderSecretResult, TaskMutationResult, TaskSummary,
};
use crate::security;

const MAX_PREVIEW_BYTES: u64 = 220_000;

pub fn open_project(database_path: &Path, root: String) -> Result<ProjectOpenResult, String> {
    let connection = open_connection(database_path)?;
    let canonical_root = PathBuf::from(root)
        .canonicalize()
        .map_err(|error| format!("Unable to resolve selected project folder: {error}"))?;

    if !canonical_root.is_dir() {
        return Err("Selected project path is not a directory".to_string());
    }

    let scan = filesystem::scan_project_folder(canonical_root.display().to_string())?;
    let mut files = filesystem::collect_project_files(&canonical_root)?;
    let project_id = upsert_project(&connection, &canonical_root, &scan)?;
    index_project_files(&connection, &project_id, &mut files)?;

    let history_event = history::create_history_event(
        &connection,
        "project_opened",
        "Project opened and indexed",
        &format!(
            "Indexed {} files in {}",
            files.len(),
            canonical_root.display()
        ),
        "Completed",
        "info",
    )?;
    history::record_audit_event(
        &connection,
        "project_scope_added",
        &canonical_root.display().to_string(),
        "Low",
        "allowed",
        "Project folder selected by user",
    )?;

    Ok(ProjectOpenResult {
        project: load_project_summary(&connection, &project_id, true)?,
        scan,
        files,
        history_event,
    })
}

pub fn list_project_files(
    database_path: &Path,
    project_id: String,
) -> Result<Vec<ProjectFileEntry>, String> {
    let connection = open_connection(database_path)?;
    let mut statement = connection
        .prepare(
            "SELECT id, project_id, file_path, relative_path, file_name, COALESCE(extension, ''),
                    size_bytes, COALESCE(language, 'Plain Text'), sensitive, binary, modified_at
             FROM project_files_index
             WHERE project_id = ?1 AND ignored = 0
             ORDER BY relative_path
             LIMIT 1200",
        )
        .map_err(|error| format!("Unable to prepare file index query: {error}"))?;

    let rows = statement
        .query_map(params![project_id], |row| {
            Ok(ProjectFileEntry {
                id: row.get(0)?,
                project_id: row.get(1)?,
                path: row.get(2)?,
                relative_path: row.get(3)?,
                file_name: row.get(4)?,
                extension: row.get(5)?,
                size: row.get::<_, i64>(6)? as u64,
                language: row.get(7)?,
                sensitive: row.get::<_, i64>(8)? == 1,
                binary: row.get::<_, i64>(9)? == 1,
                modified_at: row.get(10)?,
            })
        })
        .map_err(|error| format!("Unable to load file index: {error}"))?;

    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Unable to collect file index: {error}"))
}

pub fn preview_project_file(
    database_path: &Path,
    project_id: String,
    relative_path: String,
) -> Result<FilePreview, String> {
    let connection = open_connection(database_path)?;
    let root: String = connection
        .query_row(
            "SELECT normalized_root_path FROM projects WHERE id = ?1 AND deleted_at IS NULL",
            params![project_id],
            |row| row.get(0),
        )
        .map_err(|error| format!("Unable to find project root: {error}"))?;
    let root_path = PathBuf::from(root);
    let target_path = root_path.join(&relative_path);
    let canonical_target = security::ensure_within_root(&root_path, &target_path)?;
    let metadata = fs::metadata(&canonical_target)
        .map_err(|error| format!("Unable to read file metadata: {error}"))?;
    let sensitive = security::is_sensitive_path(&canonical_target);
    let extension = canonical_target
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_string();
    let binary = is_binary_extension(&extension);

    if sensitive {
        history::record_audit_event(
            &connection,
            "sensitive_file_preview_blocked",
            &canonical_target.display().to_string(),
            "High",
            "blocked",
            "Sensitive files require explicit approval",
        )?;
        return Ok(FilePreview {
            path: canonical_target.display().to_string(),
            relative_path,
            language: language_for_extension(&extension),
            sensitive,
            binary,
            content: None,
            message: "Sensitive file preview is blocked until an approval flow is granted."
                .to_string(),
        });
    }

    if binary {
        return Ok(FilePreview {
            path: canonical_target.display().to_string(),
            relative_path,
            language: "Binary".to_string(),
            sensitive,
            binary,
            content: None,
            message: "Binary files are indexed but not previewed as AI context.".to_string(),
        });
    }

    if metadata.len() > MAX_PREVIEW_BYTES {
        return Ok(FilePreview {
            path: canonical_target.display().to_string(),
            relative_path,
            language: language_for_extension(&extension),
            sensitive,
            binary,
            content: None,
            message: "File is too large for the MVP preview limit.".to_string(),
        });
    }

    let raw = fs::read_to_string(&canonical_target)
        .map_err(|error| format!("Unable to read selected file: {error}"))?;
    let masked = security::mask_secrets(&raw);
    history::create_history_event(
        &connection,
        "file_previewed",
        "File previewed",
        &format!("Previewed {}", canonical_target.display()),
        "Completed",
        "info",
    )?;

    Ok(FilePreview {
        path: canonical_target.display().to_string(),
        relative_path,
        language: language_for_extension(&extension),
        sensitive,
        binary,
        content: Some(masked),
        message: "Preview loaded with secret masking applied.".to_string(),
    })
}

pub fn update_task_status(
    database_path: &Path,
    task_id: String,
    status: String,
    reason: Option<String>,
) -> Result<TaskMutationResult, String> {
    let connection = open_connection(database_path)?;
    connection
        .execute(
            "UPDATE tasks
             SET status = ?1,
                 ignored_reason = CASE WHEN ?1 = 'Ignored' THEN ?2 ELSE NULL END,
                 completed_at = CASE WHEN ?1 IN ('Completed', 'Skipped', 'Ignored', 'Cancelled') THEN CURRENT_TIMESTAMP ELSE completed_at END,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?3",
            params![status, reason, task_id],
        )
        .map_err(|error| format!("Unable to update task status: {error}"))?;

    let task = load_task_summary(&connection, &task_id)?;
    let history_event = history::create_history_event(
        &connection,
        &format!("task_{}", task.status.to_lowercase().replace(' ', "_")),
        &format!("Task marked {}", task.status),
        &task.title,
        "Completed",
        "info",
    )?;

    Ok(TaskMutationResult {
        task,
        history_event,
    })
}

fn provider_secret_path(provider_id: &str) -> PathBuf {
    let base = std::env::var("APPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("."));
    base.join("Sync")
        .join("provider_keys")
        .join(format!("{provider_id}.key"))
}

fn write_provider_secret(provider_id: &str, key: &str) -> Result<(), String> {
    let path = provider_secret_path(provider_id);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|error| format!("Unable to create provider key directory: {error}"))?;
    }
    std::fs::write(&path, key.trim())
        .map_err(|error| format!("Unable to save provider key file: {error}"))?;
    Ok(())
}

pub fn save_provider_secret_metadata(
    database_path: &Path,
    provider_id: String,
    key: String,
) -> Result<ProviderSecretResult, String> {
    let connection = open_connection(database_path)?;
    if key.trim().is_empty() {
        return Err("Provider key cannot be empty".to_string());
    }

    // Persist the raw key to the per-user app-data directory so the provider
    // is actually usable. Database keeps only masked metadata.
    write_provider_secret(&provider_id, &key)?;

    let masked = mask_key_preview(&key);
    connection
        .execute(
            "UPDATE model_providers
             SET configured = 1,
                 masked_key_preview = ?1,
                 connection_status = 'Not Connected',
                 enabled = 1,
                 updated_at = CURRENT_TIMESTAMP,
                 error_state = NULL
             WHERE id = ?2",
            params![masked, provider_id],
        )
        .map_err(|error| format!("Unable to update provider metadata: {error}"))?;

    history::record_audit_event(
        &connection,
        "provider_key_saved",
        &provider_id,
        "Medium",
        "credential-stored",
        "Provider API key saved to per-user app-data file; only masked preview kept in database",
    )?;
    let audit_event = history::create_history_event(
        &connection,
        "provider_key_saved",
        "Provider key saved",
        "API key stored in the per-user app-data folder. Only a masked preview is kept in the database.",
        "Completed",
        "info",
    )?;

    Ok(ProviderSecretResult {
        provider: load_model_provider(&connection, &provider_id)?,
        audit_event,
        message: "API key saved outside SQLite. Connection testing is still pending.".to_string(),
    })
}

pub fn submit_prompt(
    database_path: &Path,
    prompt: String,
    history: Vec<(String, String)>,
) -> Result<AiSubmissionResult, String> {
    let connection = open_connection(database_path)?;
    let trimmed = prompt.trim();
    if trimmed.is_empty() {
        return Err("Prompt cannot be empty".to_string());
    }

    let session_id = Uuid::new_v4().to_string();
    let user_message_id = Uuid::new_v4().to_string();
    let assistant_message_id = Uuid::new_v4().to_string();
    connection
        .execute(
            "INSERT INTO sessions (id, title, mode, selected_agent, status, summary, created_at, updated_at)
             VALUES (?1, ?2, 'Plan Mode', 'Planner Agent', 'active', ?3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
            params![session_id, short_title(trimmed), "Created from prompt composer"],
        )
        .map_err(|error| format!("Unable to create AI session: {error}"))?;
    connection
        .execute(
            "INSERT INTO messages (id, session_id, role, content, status, created_at, updated_at)
             VALUES (?1, ?2, 'user', ?3, 'created', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
            params![user_message_id, session_id, security::mask_secrets(trimmed)],
        )
        .map_err(|error| format!("Unable to store user message: {error}"))?;

    let provider_status = configured_provider_status(&connection)?;
    let task_list_id = if should_create_tasks(trimmed) {
        Some(create_task_plan(&connection, &session_id, trimmed)?)
    } else {
        None
    };
    let tasks = load_session_tasks(&connection, &session_id)?;
    let (assistant_message, ai_status, ai_error) = if provider_status == "Configured" {
        match call_default_provider(&connection, trimmed, &history) {
            Ok(reply) => (reply, "ok", None),
            Err(error) => (
                format!(
                    "Provider call failed: {error}. Check the API key, base URL, and model in the Models panel."
                ),
                "error",
                Some(error),
            ),
        }
    } else {
        (
            "No AI provider is configured yet. Configure one in the Models panel — paste an API key, press Save, and try again.".to_string(),
            "not_configured",
            None,
        )
    };
    connection
        .execute(
            "INSERT INTO messages (id, session_id, role, content, status, created_at, updated_at)
             VALUES (?1, ?2, 'assistant', ?3, 'created', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
            params![assistant_message_id, session_id, assistant_message],
        )
        .map_err(|error| format!("Unable to store assistant message: {error}"))?;
    connection
        .execute(
            "INSERT INTO model_usage_events (id, session_id, purpose, status, error_message, created_at)
             VALUES (?1, ?2, 'chat_response', ?3, ?4, CURRENT_TIMESTAMP)",
            params![
                Uuid::new_v4().to_string(),
                session_id,
                ai_status,
                ai_error.as_deref().unwrap_or("")
            ],
        )
        .map_err(|error| format!("Unable to store model usage event: {error}"))?;
    let history_event = history::create_history_event(
        &connection,
        "session_started",
        "AI session created",
        "Prompt stored locally with task planning metadata.",
        "Completed",
        "info",
    )?;

    Ok(AiSubmissionResult {
        session_id,
        user_message_id,
        assistant_message_id,
        task_list_id,
        tasks,
        assistant_message,
        provider_status,
        history_event,
    })
}

fn open_connection(path: &Path) -> Result<Connection, String> {
    let connection = Connection::open(path)
        .map_err(|error| format!("Unable to open SQLite database: {error}"))?;
    connection
        .pragma_update(None, "foreign_keys", "ON")
        .map_err(|error| format!("Unable to enable SQLite foreign keys: {error}"))?;
    Ok(connection)
}

fn upsert_project(
    connection: &Connection,
    root: &Path,
    scan: &crate::models::ProjectScan,
) -> Result<String, String> {
    let normalized = root.display().to_string();
    let existing: Option<String> = connection
        .query_row(
            "SELECT id FROM projects WHERE normalized_root_path = ?1",
            params![normalized],
            |row| row.get(0),
        )
        .optional()
        .map_err(|error| format!("Unable to query project: {error}"))?;
    let project_id = existing.unwrap_or_else(|| Uuid::new_v4().to_string());
    let name = root
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("Project");
    let languages = scan.languages.join(", ");
    let package_managers = scan.package_managers.join(", ");

    connection
        .execute(
            "INSERT INTO projects (
                id, name, root_path, normalized_root_path, detected_languages,
                detected_frameworks, last_opened_at, project_summary, status, created_at, updated_at
             ) VALUES (?1, ?2, ?3, ?3, ?4, ?5, CURRENT_TIMESTAMP, ?6, 'Active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             ON CONFLICT(normalized_root_path) DO UPDATE SET
                name = excluded.name,
                root_path = excluded.root_path,
                detected_languages = excluded.detected_languages,
                detected_frameworks = excluded.detected_frameworks,
                last_opened_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP,
                deleted_at = NULL",
            params![
                project_id,
                name,
                normalized,
                languages,
                package_managers,
                format!("{} files indexed safely", scan.files_scanned)
            ],
        )
        .map_err(|error| format!("Unable to save project: {error}"))?;
    connection
        .execute(
            "INSERT OR IGNORE INTO project_paths (
                id, project_id, path, path_type, permission_level, added_by_user, enabled
             ) VALUES (?1, ?2, ?3, 'root', 'Allow for this project', 1, 1)",
            params![Uuid::new_v4().to_string(), project_id, normalized],
        )
        .map_err(|error| format!("Unable to save project path: {error}"))?;

    Ok(project_id)
}

fn index_project_files(
    connection: &Connection,
    project_id: &str,
    files: &mut [ProjectFileEntry],
) -> Result<(), String> {
    connection
        .execute(
            "DELETE FROM project_files_index WHERE project_id = ?1",
            params![project_id],
        )
        .map_err(|error| format!("Unable to clear old file index: {error}"))?;

    let mut statement = connection
        .prepare(
            "INSERT INTO project_files_index (
                id, project_id, file_path, relative_path, file_name, extension, size_bytes,
                modified_at, language, file_type, indexed_status, sensitive, binary, last_scanned_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'file', 'indexed', ?10, ?11, CURRENT_TIMESTAMP)",
        )
        .map_err(|error| format!("Unable to prepare file index insert: {error}"))?;

    for file in files {
        file.project_id = Some(project_id.to_string());
        statement
            .execute(params![
                file.id,
                project_id,
                file.path,
                file.relative_path,
                file.file_name,
                file.extension,
                file.size as i64,
                file.modified_at,
                file.language,
                if file.sensitive { 1 } else { 0 },
                if file.binary { 1 } else { 0 },
            ])
            .map_err(|error| format!("Unable to insert indexed file: {error}"))?;
    }

    Ok(())
}

fn load_project_summary(
    connection: &Connection,
    project_id: &str,
    selected: bool,
) -> Result<ProjectSummary, String> {
    connection
        .query_row(
            "SELECT id, name, root_path, COALESCE(project_summary, ''), COALESCE(detected_languages, ''),
                    COALESCE(detected_frameworks, ''), COALESCE(status, 'Active')
             FROM projects WHERE id = ?1",
            params![project_id],
            |row| {
                Ok(ProjectSummary {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    path: row.get(2)?,
                    description: row.get(3)?,
                    updated_label: "Just now".to_string(),
                    language: row.get(4)?,
                    framework: row.get(5)?,
                    git_status: row.get(6)?,
                    selected,
                })
            },
        )
        .map_err(|error| format!("Unable to load project: {error}"))
}

fn load_task_summary(connection: &Connection, task_id: &str) -> Result<TaskSummary, String> {
    connection
        .query_row(
            "SELECT id, title, description, status, priority, risk_level, owner_agent,
                    related_target, ignored_reason
             FROM tasks WHERE id = ?1",
            params![task_id],
            |row| {
                Ok(TaskSummary {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    description: row.get(2)?,
                    status: row.get(3)?,
                    priority: row.get(4)?,
                    risk: row.get(5)?,
                    agent: row.get(6)?,
                    related: row.get(7)?,
                    ignored_reason: row.get(8)?,
                })
            },
        )
        .map_err(|error| format!("Unable to load task: {error}"))
}

fn load_model_provider(
    connection: &Connection,
    provider_id: &str,
) -> Result<ModelProviderSummary, String> {
    connection
        .query_row(
            "SELECT id, name, provider_type, base_url, connection_status, configured,
                    masked_key_preview, enabled, last_tested_at, error_state
             FROM model_providers WHERE id = ?1",
            params![provider_id],
            |row| {
                Ok(ModelProviderSummary {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    provider_type: row.get(2)?,
                    base_url: row.get(3)?,
                    connection_status: row.get(4)?,
                    configured: row.get::<_, i64>(5)? == 1,
                    masked_key_preview: row.get(6)?,
                    enabled: row.get::<_, i64>(7)? == 1,
                    last_tested_at: row.get(8)?,
                    error_state: row.get(9)?,
                })
            },
        )
        .map_err(|error| format!("Unable to load provider: {error}"))
}

fn read_provider_secret(provider_id: &str) -> Option<String> {
    std::fs::read_to_string(provider_secret_path(provider_id))
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

fn call_default_provider(
    connection: &Connection,
    prompt: &str,
    history: &[(String, String)],
) -> Result<String, String> {
    // Pick the first enabled + configured provider, preferring those with a saved key file.
    let candidates: Vec<(String, String, Option<String>)> = connection
        .prepare(
            "SELECT id, provider_type, base_url FROM model_providers \
             WHERE enabled = 1 AND configured = 1 ORDER BY updated_at DESC",
        )
        .and_then(|mut statement| {
            statement
                .query_map([], |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, Option<String>>(2)?,
                    ))
                })
                .map(|rows| rows.flatten().collect())
        })
        .map_err(|error| format!("Unable to load providers: {error}"))?;

    let (provider_id, provider_type, base_url) = candidates
        .into_iter()
        .find(|(id, _, _)| read_provider_secret(id).is_some())
        .ok_or_else(|| {
            "No provider has a saved API key. Open Models, paste a key, and press Save.".to_string()
        })?;

    let key = read_provider_secret(&provider_id)
        .ok_or_else(|| "Provider key file is missing.".to_string())?;

    let model = connection
        .query_row(
            "SELECT model_id FROM model_profiles WHERE provider_id = ?1 AND enabled = 1 \
             ORDER BY (role = 'default') DESC, updated_at DESC LIMIT 1",
            params![provider_id],
            |row| row.get::<_, String>(0),
        )
        .map_err(|error| format!("Unable to find an enabled model profile: {error}"))?;

    let url = build_chat_completions_url(&provider_type, base_url.as_deref());
    call_openai_compatible(&url, &key, &model, prompt, history)
}

fn build_chat_completions_url(provider_type: &str, base_url: Option<&str>) -> String {
    let base = base_url
        .map(|s| s.trim().trim_end_matches('/').to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| match provider_type.to_lowercase().as_str() {
            "openai" => "https://api.openai.com/v1".to_string(),
            "nvidia" | "nim" => "https://integrate.api.nvidia.com/v1".to_string(),
            "groq" => "https://api.groq.com/openai/v1".to_string(),
            "together" => "https://api.together.xyz/v1".to_string(),
            "anthropic" => "https://api.anthropic.com/v1".to_string(),
            _ => "https://api.openai.com/v1".to_string(),
        });
    format!("{base}/chat/completions")
}

fn call_openai_compatible(
    url: &str,
    api_key: &str,
    model: &str,
    prompt: &str,
    history: &[(String, String)],
) -> Result<String, String> {
    let client = reqwest::blocking::Client::builder()
        // Long-form responses (multi-step plans, large code blocks, etc.) can
        // take well over a minute on a 70B model. Three minutes is a safe
        // upper bound that still surfaces real connectivity failures.
        .timeout(std::time::Duration::from_secs(180))
        .user_agent("Sync-Desktop")
        .build()
        .map_err(|error| format!("HTTP client init failed: {error}"))?;

    let mut messages: Vec<serde_json::Value> = Vec::with_capacity(history.len() + 2);
    messages.push(serde_json::json!({
        "role": "system",
        "content": "You are Sync, a desktop AI coding workspace assistant. \
                    Be thorough but well-structured: when the user asks for code, give a clear plan, \
                    then the code in fenced markdown blocks with a language tag, then a short summary \
                    of what you produced and any follow-ups. Use markdown headings, bullet lists, and \
                    bold sparingly to keep the answer scannable. Prefer concise prose over filler. \
                    If you would change files in a real workspace, end your message with a `Changes` \
                    section listing each file and what would change. Ask before destructive actions."
    }));

    // Replay prior turns (user/assistant) so multi-turn conversations have
    // memory. We trust the caller to bound the slice; the client side caps
    // it to keep the prompt within the model's context window.
    for (role, content) in history {
        messages.push(serde_json::json!({ "role": role, "content": content }));
    }

    messages.push(serde_json::json!({ "role": "user", "content": prompt }));

    let body = serde_json::json!({
        "model": model,
        "messages": messages,
        "temperature": 0.4,
        // Allow long answers — large planning replies, multi-file code, etc.
        "max_tokens": 4096
    });

    let response = client
        .post(url)
        .bearer_auth(api_key)
        .header("Accept", "application/json")
        .json(&body)
        .send()
        .map_err(|error| format!("Request failed: {error}"))?;

    let status = response.status();
    let raw = response
        .text()
        .map_err(|error| format!("Reading response body failed: {error}"))?;

    if !status.is_success() {
        return Err(format!(
            "Provider returned HTTP {}: {}",
            status.as_u16(),
            truncate_str(&raw, 240)
        ));
    }

    let parsed: serde_json::Value = serde_json::from_str(&raw)
        .map_err(|error| format!("Provider response was not valid JSON: {error}"))?;

    let content = parsed
        .get("choices")
        .and_then(|choices| choices.get(0))
        .and_then(|choice| choice.get("message"))
        .and_then(|message| message.get("content"))
        .and_then(|content| content.as_str())
        .map(|s| s.trim().to_string());

    content.ok_or_else(|| {
        format!(
            "Provider response did not contain a message: {}",
            truncate_str(&raw, 240)
        )
    })
}

fn truncate_str(value: &str, max: usize) -> String {
    if value.len() <= max {
        value.to_string()
    } else {
        format!("{}…", &value[..max])
    }
}

fn configured_provider_status(connection: &Connection) -> Result<String, String> {
    let count: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM model_providers WHERE enabled = 1 AND configured = 1",
            [],
            |row| row.get(0),
        )
        .map_err(|error| format!("Unable to inspect provider configuration: {error}"))?;
    Ok(if count > 0 {
        "Configured".to_string()
    } else {
        "Not configured".to_string()
    })
}

fn create_task_plan(
    connection: &Connection,
    session_id: &str,
    prompt: &str,
) -> Result<String, String> {
    let task_list_id = Uuid::new_v4().to_string();
    connection
        .execute(
            "INSERT INTO task_lists (id, session_id, title, description, owner_agent, status, progress_percentage)
             VALUES (?1, ?2, ?3, ?4, 'Planner Agent', 'active', 0)",
            params![
                task_list_id,
                session_id,
                short_title(prompt),
                "Generated from prompt composer"
            ],
        )
        .map_err(|error| format!("Unable to create task list: {error}"))?;

    let mut tasks = vec![
        (
            "Understand request and scope",
            "Review the request, selected project, and current permissions.",
            "Ready",
            "Planner Agent",
            "Low",
            "Workspace",
        ),
        (
            "Gather project context",
            "Use opened project metadata and safe file index before reading content.",
            "Pending",
            "Planner Agent",
            "Safe",
            "Project",
        ),
        (
            "Prepare implementation plan",
            "Create reviewable tasks, affected files, and approval requirements.",
            "Pending",
            "Coder Agent",
            "Medium",
            "Tasks",
        ),
        (
            "Wait for approval before mutations",
            "Block writes, commands, GitHub, MCP, and connector actions until approved.",
            "Waiting for Approval",
            "Security Agent",
            "High",
            "Permissions",
        ),
    ];

    if prompt.to_lowercase().contains("github") || prompt.to_lowercase().contains("repo") {
        tasks.push((
            "Check GitHub account and repository target",
            "Use Device Flow or CLI auth and require approval before any remote write.",
            "Waiting for Approval",
            "GitHub Agent",
            "High",
            "GitHub",
        ));
    }

    for (title, description, status, agent, risk, related) in tasks {
        connection
            .execute(
                "INSERT INTO tasks (
                    id, task_list_id, session_id, title, description, status, priority,
                    owner_agent, risk_level, approval_state, related_target, required_tools, affected_files
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'Medium', ?7, ?8, ?9, ?10, '[]', '[]')",
                params![
                    Uuid::new_v4().to_string(),
                    task_list_id,
                    session_id,
                    title,
                    description,
                    status,
                    agent,
                    risk,
                    if status == "Waiting for Approval" { "required" } else { "not_required" },
                    related,
                ],
            )
            .map_err(|error| format!("Unable to create task: {error}"))?;
    }

    Ok(task_list_id)
}

fn load_session_tasks(
    connection: &Connection,
    session_id: &str,
) -> Result<Vec<TaskSummary>, String> {
    let mut statement = connection
        .prepare(
            "SELECT id, title, description, status, priority, risk_level, owner_agent,
                    related_target, ignored_reason
             FROM tasks WHERE session_id = ?1 ORDER BY created_at ASC",
        )
        .map_err(|error| format!("Unable to prepare session task query: {error}"))?;
    let rows = statement
        .query_map(params![session_id], |row| {
            Ok(TaskSummary {
                id: row.get(0)?,
                title: row.get(1)?,
                description: row.get(2)?,
                status: row.get(3)?,
                priority: row.get(4)?,
                risk: row.get(5)?,
                agent: row.get(6)?,
                related: row.get(7)?,
                ignored_reason: row.get(8)?,
            })
        })
        .map_err(|error| format!("Unable to load session tasks: {error}"))?;

    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|error| format!("Unable to collect session tasks: {error}"))
}

fn should_create_tasks(prompt: &str) -> bool {
    let lower = prompt.to_lowercase();
    prompt.len() > 24
        || [
            "build", "create", "fix", "review", "improve", "github", "repo", "connect",
        ]
        .iter()
        .any(|keyword| lower.contains(keyword))
}

fn short_title(prompt: &str) -> String {
    let title = prompt.trim().chars().take(64).collect::<String>();
    if title.is_empty() {
        "New Sync session".to_string()
    } else {
        title
    }
}

fn mask_key_preview(key: &str) -> String {
    security::mask_secrets(&format!("api_key={key}")).replace("api_key=", "")
}

fn language_for_extension(extension: &str) -> String {
    match extension.to_lowercase().as_str() {
        "ts" | "tsx" => "TypeScript",
        "js" | "jsx" => "JavaScript",
        "rs" => "Rust",
        "py" => "Python",
        "sql" => "SQL",
        "json" => "JSON",
        "toml" => "TOML",
        "yaml" | "yml" => "YAML",
        "css" => "CSS",
        "html" => "HTML",
        "md" => "Markdown",
        _ => "Plain Text",
    }
    .to_string()
}

fn is_binary_extension(extension: &str) -> bool {
    matches!(
        extension.to_lowercase().as_str(),
        "png" | "jpg" | "jpeg" | "gif" | "webp" | "ico" | "exe" | "dll" | "pdf" | "zip"
    )
}
