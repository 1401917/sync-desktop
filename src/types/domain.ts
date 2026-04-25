export type NavKey =
  | "home"
  | "projects"
  | "session"
  | "tasks"
  | "files"
  | "diffs"
  | "agents"
  | "prompts"
  | "history"
  | "connectors"
  | "mcp"
  | "github"
  | "settings"
  | "permissions"
  | "models";

export type TaskStatus =
  | "Pending"
  | "Ready"
  | "In Progress"
  | "Waiting for Approval"
  | "Waiting for Context"
  | "Blocked"
  | "Completed"
  | "Failed"
  | "Skipped"
  | "Ignored"
  | "Cancelled";

export type RiskLevel = "Safe" | "Low" | "Medium" | "High" | "Critical";

export type PermissionLevel =
  | "Disabled"
  | "Ask every time"
  | "Allow once"
  | "Allow for this session"
  | "Allow for this project"
  | "Always allow";

export interface ProjectSummary {
  id: string;
  name: string;
  path: string;
  description: string;
  updatedLabel: string;
  language: string;
  framework: string;
  gitStatus: string;
  selected?: boolean;
}

export interface AgentSummary {
  id: string;
  name: string;
  role: string;
  mode: string;
  enabled: boolean;
}

export interface PermissionSummary {
  id: string;
  category: string;
  action: string;
  level: PermissionLevel;
  risk: RiskLevel;
}

export interface ConnectorSummary {
  id: string;
  name: string;
  status: "Connected" | "Not connected" | "Error" | "Requires authentication" | "Disabled";
  permission: string;
}

export interface McpServerSummary {
  id: string;
  name: string;
  status: "Configured" | "Disabled" | "Error" | "Not configured";
  trust: "trusted" | "limited" | "untrusted";
  tools: number;
}

export interface HistorySummary {
  id: string;
  title: string;
  kind: string;
  status: string;
  timestamp: string;
}

export interface SyncTask {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: "Low" | "Medium" | "High";
  risk: RiskLevel;
  agent: string;
  related: string;
  ignoredReason?: string;
}

export interface BootstrapPayload {
  appName: string;
  version: string;
  databasePath: string;
  securityMode: string;
  recentProjects: ProjectSummary[];
  activeTasks: SyncTask[];
  agents: AgentSummary[];
  permissions: PermissionSummary[];
  connectors: ConnectorSummary[];
  mcpServers: McpServerSummary[];
  history: HistorySummary[];
  modelProviders: ModelProviderSummary[];
  modelProfiles: ModelProfileSummary[];
}

export interface GitHubConnectionStatus {
  connected: boolean;
  status: string;
  username?: string | null;
  message: string;
}

export interface GitHubRepositorySummary {
  name: string;
  fullName: string;
  private: boolean;
  htmlUrl: string;
  defaultBranch: string;
}

export interface McpConnectionTest {
  target: string;
  reachable: boolean;
  status: string;
  message: string;
}

export interface GitHubLoginResult {
  started: boolean;
  status: string;
  message: string;
}

export interface ModelProviderSummary {
  id: string;
  name: string;
  providerType: string;
  baseUrl?: string | null;
  connectionStatus: "Connected" | "Not Connected" | "Requires authentication" | "Not configured" | "Not tested" | "Error" | "Disabled";
  configured: boolean;
  maskedKeyPreview?: string | null;
  enabled: boolean;
  lastTestedAt?: string | null;
  errorState?: string | null;
}

export interface ModelProfileSummary {
  id: string;
  name: string;
  providerId?: string | null;
  modelId: string;
  role: string;
  maxContext?: number | null;
  temperature?: number | null;
  streamingEnabled: boolean;
  enabled: boolean;
}

export interface ProjectFileEntry {
  id: string;
  projectId?: string | null;
  path: string;
  relativePath: string;
  fileName: string;
  extension: string;
  size: number;
  language: string;
  sensitive: boolean;
  binary: boolean;
  modifiedAt?: string | null;
}

export interface ProjectScan {
  root: string;
  filesScanned: number;
  directoriesScanned: number;
  sensitiveFiles: FileScanItem[];
  languages: string[];
  packageManagers: string[];
  skipped: string[];
}

export interface FileScanItem {
  path: string;
  relativePath: string;
  size: number;
  extension: string;
  sensitive: boolean;
  binary: boolean;
}

export interface ProjectOpenResult {
  project: ProjectSummary;
  scan: ProjectScan;
  files: ProjectFileEntry[];
  historyEvent: HistorySummary;
}

export interface FilePreview {
  path: string;
  relativePath: string;
  language: string;
  sensitive: boolean;
  binary: boolean;
  content?: string | null;
  message: string;
}

export interface TaskMutationResult {
  task: SyncTask;
  historyEvent: HistorySummary;
}

export interface ProviderSecretResult {
  provider: ModelProviderSummary;
  auditEvent: HistorySummary;
  message: string;
}

export interface AiSubmissionResult {
  sessionId: string;
  userMessageId: string;
  assistantMessageId: string;
  taskListId?: string | null;
  tasks: SyncTask[];
  assistantMessage: string;
  providerStatus: string;
  historyEvent: HistorySummary;
}
