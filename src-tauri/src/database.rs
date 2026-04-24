use std::fs;
use std::path::{Path, PathBuf};

use rusqlite::{params, Connection};
use tauri::{AppHandle, Manager};

use crate::history;
use crate::models::{
    AgentSummary, BootstrapPayload, ConnectorSummary, HistorySummary, McpServerSummary,
    PermissionSummary, ProjectSummary, TaskSummary,
};

pub struct SyncDatabase {
    pub path: PathBuf,
}

const MIGRATIONS: &[(&str, &str)] = &[
    ("001_core", include_str!("../migrations/001_core.sql")),
    ("002_seed_defaults", include_str!("../migrations/002_seed_defaults.sql")),
];

pub fn initialize(app: &AppHandle) -> Result<SyncDatabase, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Unable to resolve app data directory: {error}"))?;
    fs::create_dir_all(&app_data_dir)
        .map_err(|error| format!("Unable to create app data directory: {error}"))?;

    initialize_at_path(app_data_dir.join("sync.sqlite3"))
}

pub fn initialize_at_path(path: PathBuf) -> Result<SyncDatabase, String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Unable to create database parent directory: {error}"))?;
    }

    let connection = Connection::open(&path)
        .map_err(|error| format!("Unable to open local SQLite database: {error}"))?;
    connection
        .pragma_update(None, "journal_mode", "WAL")
        .map_err(|error| format!("Unable to enable SQLite WAL mode: {error}"))?;
    connection
        .pragma_update(None, "foreign_keys", "ON")
        .map_err(|error| format!("Unable to enable SQLite foreign keys: {error}"))?;

    connection
        .execute_batch(
            "CREATE TABLE IF NOT EXISTS schema_migrations (
                id TEXT PRIMARY KEY,
                applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );",
        )
        .map_err(|error| format!("Unable to prepare migration table: {error}"))?;

    for (id, sql) in MIGRATIONS {
        run_migration(&connection, id, sql)?;
    }

    history::record_system_event(
        &connection,
        "app_initialized",
        "Sync initialized local SQLite storage",
        "Completed",
    )?;

    Ok(SyncDatabase { path })
}

fn run_migration(connection: &Connection, id: &str, sql: &str) -> Result<(), String> {
    let already_applied: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM schema_migrations WHERE id = ?1",
            params![id],
            |row| row.get(0),
        )
        .map_err(|error| format!("Unable to inspect migration state: {error}"))?;

    if already_applied > 0 {
        return Ok(());
    }

    let transaction = connection
        .unchecked_transaction()
        .map_err(|error| format!("Unable to start migration transaction: {error}"))?;
    transaction
        .execute_batch(sql)
        .map_err(|error| format!("Unable to apply migration {id}: {error}"))?;
    transaction
        .execute(
            "INSERT INTO schema_migrations (id, applied_at) VALUES (?1, CURRENT_TIMESTAMP)",
            params![id],
        )
        .map_err(|error| format!("Unable to record migration {id}: {error}"))?;
    transaction
        .commit()
        .map_err(|error| format!("Unable to commit migration {id}: {error}"))?;

    Ok(())
}

pub fn bootstrap_payload(database: &SyncDatabase) -> Result<BootstrapPayload, String> {
    let connection = Connection::open(&database.path)
        .map_err(|error| format!("Unable to open local SQLite database: {error}"))?;

    Ok(BootstrapPayload {
        app_name: "Sync".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        database_path: database.path.display().to_string(),
        security_mode: setting_value(&connection, "default_approval_mode", "Balanced Mode")?,
        recent_projects: load_projects(&connection)?,
        active_tasks: load_tasks(&connection)?,
        agents: load_agents(&connection)?,
        permissions: load_permissions(&connection)?,
        connectors: load_connectors(&connection)?,
        mcp_servers: load_mcp_servers(&connection)?,
        history: load_history(&connection)?,
    })
}

fn setting_value(connection: &Connection, key: &str, fallback: &str) -> Result<String, String> {
    match connection.query_row(
        "SELECT value FROM app_settings WHERE key = ?1",
        params![key],
        |row| row.get(0),
    ) {
        Ok(value) => Ok(value),
        Err(_) => Ok(fallback.to_string()),
    }
}

fn load_projects(connection: &Connection) -> Result<Vec<ProjectSummary>, String> {
    let mut statement = connection
        .prepare(
            "SELECT id, name, root_path, COALESCE(project_summary, ''), COALESCE(detected_languages, ''),
                    COALESCE(detected_frameworks, ''), COALESCE(status, 'Active')
             FROM projects
             WHERE deleted_at IS NULL
             ORDER BY last_opened_at DESC
             LIMIT 5",
        )
        .map_err(|error| format!("Unable to prepare project query: {error}"))?;

    let rows = statement
        .query_map([], |row| {
            Ok(ProjectSummary {
                id: row.get(0)?,
                name: row.get(1)?,
                path: row.get(2)?,
                description: row.get::<_, String>(3)?,
                updated_label: "Stored locally".to_string(),
                language: row.get(4)?,
                framework: row.get(5)?,
                git_status: row.get(6)?,
                selected: false,
            })
        })
        .map_err(|error| format!("Unable to load projects: {error}"))?;

    let mut projects = collect_rows(rows)?;
    if projects.is_empty() {
        projects.push(ProjectSummary {
            id: "sync-workspace".to_string(),
            name: "Sync".to_string(),
            path: "Open a project folder to scope file access".to_string(),
            description: "Desktop AI coding workspace".to_string(),
            updated_label: "Ready".to_string(),
            language: "TypeScript / Rust".to_string(),
            framework: "Tauri + React".to_string(),
            git_status: "Not connected".to_string(),
            selected: true,
        });
    } else if let Some(project) = projects.first_mut() {
        project.selected = true;
    }

    Ok(projects)
}

fn load_tasks(connection: &Connection) -> Result<Vec<TaskSummary>, String> {
    let mut statement = connection
        .prepare(
            "SELECT id, title, description, status, priority, risk_level, owner_agent, related_target, ignored_reason
             FROM tasks
             WHERE deleted_at IS NULL
             ORDER BY created_at ASC
             LIMIT 12",
        )
        .map_err(|error| format!("Unable to prepare task query: {error}"))?;

    let rows = statement
        .query_map([], |row| {
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
        .map_err(|error| format!("Unable to load tasks: {error}"))?;

    collect_rows(rows)
}

fn load_agents(connection: &Connection) -> Result<Vec<AgentSummary>, String> {
    let mut statement = connection
        .prepare("SELECT id, name, role, default_mode, enabled FROM agents ORDER BY name")
        .map_err(|error| format!("Unable to prepare agent query: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            Ok(AgentSummary {
                id: row.get(0)?,
                name: row.get(1)?,
                role: row.get(2)?,
                mode: row.get(3)?,
                enabled: row.get::<_, i64>(4)? == 1,
            })
        })
        .map_err(|error| format!("Unable to load agents: {error}"))?;

    collect_rows(rows)
}

fn load_permissions(connection: &Connection) -> Result<Vec<PermissionSummary>, String> {
    let mut statement = connection
        .prepare(
            "SELECT id, category, tool_name, default_permission_level, risk_level
             FROM tool_permissions
             ORDER BY category, tool_name",
        )
        .map_err(|error| format!("Unable to prepare permission query: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            Ok(PermissionSummary {
                id: row.get(0)?,
                category: row.get(1)?,
                action: row.get(2)?,
                level: row.get(3)?,
                risk: row.get(4)?,
            })
        })
        .map_err(|error| format!("Unable to load permissions: {error}"))?;

    collect_rows(rows)
}

fn load_connectors(connection: &Connection) -> Result<Vec<ConnectorSummary>, String> {
    let mut statement = connection
        .prepare("SELECT id, name, status, default_permission_level FROM connectors ORDER BY name")
        .map_err(|error| format!("Unable to prepare connector query: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            Ok(ConnectorSummary {
                id: row.get(0)?,
                name: row.get(1)?,
                status: row.get(2)?,
                permission: row.get(3)?,
            })
        })
        .map_err(|error| format!("Unable to load connectors: {error}"))?;

    collect_rows(rows)
}

fn load_mcp_servers(connection: &Connection) -> Result<Vec<McpServerSummary>, String> {
    let mut statement = connection
        .prepare(
            "SELECT mcp_servers.id, mcp_servers.name, mcp_servers.status, mcp_servers.trust_status,
                    COUNT(mcp_tools.id) AS tools
             FROM mcp_servers
             LEFT JOIN mcp_tools ON mcp_tools.server_id = mcp_servers.id
             GROUP BY mcp_servers.id
             ORDER BY mcp_servers.name",
        )
        .map_err(|error| format!("Unable to prepare MCP query: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            Ok(McpServerSummary {
                id: row.get(0)?,
                name: row.get(1)?,
                status: row.get(2)?,
                trust: row.get(3)?,
                tools: row.get(4)?,
            })
        })
        .map_err(|error| format!("Unable to load MCP servers: {error}"))?;

    collect_rows(rows)
}

fn load_history(connection: &Connection) -> Result<Vec<HistorySummary>, String> {
    let mut statement = connection
        .prepare(
            "SELECT id, title, event_type, status, created_at
             FROM history_events
             ORDER BY created_at DESC
             LIMIT 10",
        )
        .map_err(|error| format!("Unable to prepare history query: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            Ok(HistorySummary {
                id: row.get(0)?,
                title: row.get(1)?,
                kind: row.get(2)?,
                status: row.get(3)?,
                timestamp: row.get(4)?,
            })
        })
        .map_err(|error| format!("Unable to load history: {error}"))?;

    collect_rows(rows)
}

fn collect_rows<T>(
    rows: rusqlite::MappedRows<'_, impl FnMut(&rusqlite::Row<'_>) -> rusqlite::Result<T>>,
) -> Result<Vec<T>, String> {
    rows.collect::<rusqlite::Result<Vec<T>>>()
        .map_err(|error| format!("Unable to collect database rows: {error}"))
}

#[allow(dead_code)]
pub fn database_exists(path: &Path) -> bool {
    path.exists()
}

#[cfg(test)]
mod tests {
    use tempfile::tempdir;

    use super::*;

    #[test]
    fn applies_migrations_and_seeds_defaults() {
        let directory = tempdir().expect("temp dir");
        let database_path = directory.path().join("sync.sqlite3");

        let database = initialize_at_path(database_path).expect("database initialized");
        let payload = bootstrap_payload(&database).expect("bootstrap payload");

        assert_eq!(payload.app_name, "Sync");
        assert!(!payload.agents.is_empty());
        assert!(!payload.permissions.is_empty());
        assert!(database.path.exists());
    }
}
