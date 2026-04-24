use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BootstrapPayload {
    pub app_name: String,
    pub version: String,
    pub database_path: String,
    pub security_mode: String,
    pub recent_projects: Vec<ProjectSummary>,
    pub active_tasks: Vec<TaskSummary>,
    pub agents: Vec<AgentSummary>,
    pub permissions: Vec<PermissionSummary>,
    pub connectors: Vec<ConnectorSummary>,
    pub mcp_servers: Vec<McpServerSummary>,
    pub history: Vec<HistorySummary>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSummary {
    pub id: String,
    pub name: String,
    pub path: String,
    pub description: String,
    pub updated_label: String,
    pub language: String,
    pub framework: String,
    pub git_status: String,
    pub selected: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskSummary {
    pub id: String,
    pub title: String,
    pub description: String,
    pub status: String,
    pub priority: String,
    pub risk: String,
    pub agent: String,
    pub related: String,
    pub ignored_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentSummary {
    pub id: String,
    pub name: String,
    pub role: String,
    pub mode: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PermissionSummary {
    pub id: String,
    pub category: String,
    pub action: String,
    pub level: String,
    pub risk: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectorSummary {
    pub id: String,
    pub name: String,
    pub status: String,
    pub permission: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpServerSummary {
    pub id: String,
    pub name: String,
    pub status: String,
    pub trust: String,
    pub tools: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistorySummary {
    pub id: String,
    pub title: String,
    pub kind: String,
    pub status: String,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActionClassification {
    pub action: String,
    pub risk: String,
    pub target: String,
    pub agent: String,
    pub task: String,
    pub required_tool: String,
    pub required_permission: String,
    pub reason: String,
    pub potential_impact: String,
    pub sensitive_data_involved: bool,
    pub approval_required: bool,
    pub rollback_available: bool,
    pub recommended_decision: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectScan {
    pub root: String,
    pub files_scanned: usize,
    pub directories_scanned: usize,
    pub sensitive_files: Vec<FileScanItem>,
    pub languages: Vec<String>,
    pub package_managers: Vec<String>,
    pub skipped: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileScanItem {
    pub path: String,
    pub relative_path: String,
    pub size: u64,
    pub extension: String,
    pub sensitive: bool,
    pub binary: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubConnectionStatus {
    pub connected: bool,
    pub status: String,
    pub username: Option<String>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubRepositorySummary {
    pub name: String,
    pub full_name: String,
    pub private: bool,
    pub html_url: String,
    pub default_branch: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpConnectionTest {
    pub target: String,
    pub reachable: bool,
    pub status: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubLoginResult {
    pub started: bool,
    pub status: String,
    pub message: String,
}
