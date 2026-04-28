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
    pub model_providers: Vec<ModelProviderSummary>,
    pub model_profiles: Vec<ModelProfileSummary>,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelProviderSummary {
    pub id: String,
    pub name: String,
    pub provider_type: String,
    pub base_url: Option<String>,
    pub connection_status: String,
    pub configured: bool,
    pub masked_key_preview: Option<String>,
    pub enabled: bool,
    pub last_tested_at: Option<String>,
    pub error_state: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelProfileSummary {
    pub id: String,
    pub name: String,
    pub provider_id: Option<String>,
    pub model_id: String,
    pub role: String,
    pub max_context: Option<i64>,
    pub temperature: Option<f64>,
    pub streaming_enabled: bool,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectOpenResult {
    pub project: ProjectSummary,
    pub scan: ProjectScan,
    pub files: Vec<ProjectFileEntry>,
    pub history_event: HistorySummary,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectFileEntry {
    pub id: String,
    pub project_id: Option<String>,
    pub path: String,
    pub relative_path: String,
    pub file_name: String,
    pub extension: String,
    pub size: u64,
    pub language: String,
    pub sensitive: bool,
    pub binary: bool,
    pub modified_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FilePreview {
    pub path: String,
    pub relative_path: String,
    pub language: String,
    pub sensitive: bool,
    pub binary: bool,
    pub content: Option<String>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskMutationResult {
    pub task: TaskSummary,
    pub history_event: HistorySummary,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderSecretResult {
    pub provider: ModelProviderSummary,
    pub audit_event: HistorySummary,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiSubmissionResult {
    pub session_id: String,
    pub user_message_id: String,
    pub assistant_message_id: String,
    pub task_list_id: Option<String>,
    pub tasks: Vec<TaskSummary>,
    pub assistant_message: String,
    pub provider_status: String,
    pub history_event: HistorySummary,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessageSummary {
    pub id: String,
    pub session_id: String,
    pub role: String,
    pub content: String,
    pub status: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadedChat {
    pub session_id: String,
    pub title: String,
    pub messages: Vec<ChatMessageSummary>,
    pub tasks: Vec<TaskSummary>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiJobUpdate {
    pub session_id: String,
    pub assistant_message_id: String,
    pub status: String,
    pub assistant_message: String,
    pub provider_status: String,
    pub error_message: Option<String>,
    pub applied_files: Vec<String>,
    pub tasks: Vec<TaskSummary>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct DiffPlanOp {
    pub path: String,
    pub kind: String, // "create", "update", "delete"
    pub before_content: Option<String>,
    pub after_content: Option<String>,
    pub blocked: bool,
    pub block_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct ApprovedOp {
    pub path: String,
    pub kind: String,
    pub content: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct ApplyError {
    pub path: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct ApplyBlocked {
    pub path: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct ApplyResult {
    pub applied: Vec<String>,
    pub errors: Vec<ApplyError>,
    pub blocked: Vec<ApplyBlocked>,
}
