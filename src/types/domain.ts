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
