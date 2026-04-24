CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  value_type TEXT NOT NULL DEFAULT 'string',
  category TEXT NOT NULL DEFAULT 'general',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_preferences (
  id TEXT PRIMARY KEY,
  preferred_response_style TEXT NOT NULL DEFAULT 'balanced',
  default_agent TEXT NOT NULL DEFAULT 'Planner Agent',
  default_ai_mode TEXT NOT NULL DEFAULT 'Plan Mode',
  default_task_behavior TEXT NOT NULL DEFAULT 'automatic',
  confirm_before_write INTEGER NOT NULL DEFAULT 1,
  confirm_before_command INTEGER NOT NULL DEFAULT 1,
  confirm_before_github_action INTEGER NOT NULL DEFAULT 1,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS model_providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider_type TEXT NOT NULL,
  base_url TEXT,
  auth_method TEXT NOT NULL DEFAULT 'api_key',
  connection_status TEXT NOT NULL DEFAULT 'Not configured',
  configured INTEGER NOT NULL DEFAULT 0,
  masked_key_preview TEXT,
  enabled INTEGER NOT NULL DEFAULT 0,
  last_tested_at TEXT,
  error_state TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS model_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider_id TEXT,
  model_id TEXT NOT NULL,
  role TEXT NOT NULL,
  max_context INTEGER,
  temperature REAL,
  reasoning_effort TEXT,
  streaming_enabled INTEGER NOT NULL DEFAULT 1,
  fallback_model_profile_id TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(provider_id) REFERENCES model_providers(id)
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  root_path TEXT NOT NULL,
  normalized_root_path TEXT NOT NULL UNIQUE,
  project_type TEXT,
  detected_languages TEXT,
  detected_frameworks TEXT,
  default_branch TEXT,
  connected_git_repo_id TEXT,
  connected_github_repo_id TEXT,
  last_opened_at TEXT,
  pinned INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  project_summary TEXT,
  status TEXT NOT NULL DEFAULT 'Active',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS project_paths (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  path TEXT NOT NULL,
  path_type TEXT NOT NULL,
  permission_level TEXT NOT NULL,
  added_by_user INTEGER NOT NULL DEFAULT 1,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS project_memory (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  memory_type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  confidence REAL,
  source TEXT,
  source_session_id TEXT,
  source_task_id TEXT,
  stale INTEGER NOT NULL DEFAULT 0,
  pinned INTEGER NOT NULL DEFAULT 0,
  user_editable INTEGER NOT NULL DEFAULT 1,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT,
  FOREIGN KEY(project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS project_files_index (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  file_path TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  extension TEXT,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  modified_at TEXT,
  content_hash TEXT,
  language TEXT,
  file_type TEXT,
  indexed_status TEXT NOT NULL DEFAULT 'pending',
  ignored INTEGER NOT NULL DEFAULT 0,
  sensitive INTEGER NOT NULL DEFAULT 0,
  binary INTEGER NOT NULL DEFAULT 0,
  last_scanned_at TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  title TEXT NOT NULL,
  mode TEXT NOT NULL,
  selected_agent TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at TEXT,
  last_message_at TEXT,
  summary TEXT,
  pinned INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  model_profile_id TEXT,
  context_summary TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT,
  FOREIGN KEY(project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  content_format TEXT NOT NULL DEFAULT 'markdown',
  model_id TEXT,
  provider_id TEXT,
  token_estimate INTEGER,
  status TEXT NOT NULL DEFAULT 'created',
  parent_message_id TEXT,
  generated_task_list_id TEXT,
  linked_tool_call_id TEXT,
  linked_agent_run_id TEXT,
  error_state TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(session_id) REFERENCES sessions(id)
);

CREATE TABLE IF NOT EXISTS message_context_items (
  id TEXT PRIMARY KEY,
  message_id TEXT,
  context_type TEXT NOT NULL,
  reference_id TEXT,
  title TEXT NOT NULL,
  source TEXT,
  token_estimate INTEGER,
  included INTEGER NOT NULL DEFAULT 1,
  reason TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(message_id) REFERENCES messages(id)
);

CREATE TABLE IF NOT EXISTS task_lists (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  project_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  owner_agent TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  progress_percentage REAL NOT NULL DEFAULT 0,
  created_from_message_id TEXT,
  current_task_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT,
  FOREIGN KEY(session_id) REFERENCES sessions(id),
  FOREIGN KEY(project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  task_list_id TEXT,
  project_id TEXT,
  session_id TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Pending',
  priority TEXT NOT NULL DEFAULT 'Medium',
  owner_agent TEXT,
  risk_level TEXT NOT NULL DEFAULT 'Low',
  required_tools TEXT NOT NULL DEFAULT '[]',
  affected_files TEXT NOT NULL DEFAULT '[]',
  expected_output TEXT,
  approval_state TEXT NOT NULL DEFAULT 'not_required',
  ignored_reason TEXT,
  result_summary TEXT,
  error_message TEXT,
  related_target TEXT NOT NULL DEFAULT 'Workspace',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT,
  FOREIGN KEY(task_list_id) REFERENCES task_lists(id),
  FOREIGN KEY(project_id) REFERENCES projects(id),
  FOREIGN KEY(session_id) REFERENCES sessions(id)
);

CREATE TABLE IF NOT EXISTS task_dependencies (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  depends_on_task_id TEXT NOT NULL,
  dependency_type TEXT NOT NULL,
  required_status TEXT NOT NULL DEFAULT 'Completed',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(task_id) REFERENCES tasks(id),
  FOREIGN KEY(depends_on_task_id) REFERENCES tasks(id)
);

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  role TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  default_mode TEXT NOT NULL,
  model_profile_id TEXT,
  permissions_profile TEXT,
  system_prompt_reference TEXT,
  configuration_json TEXT NOT NULL DEFAULT '{}',
  version TEXT NOT NULL DEFAULT '1',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(model_profile_id) REFERENCES model_profiles(id)
);

CREATE TABLE IF NOT EXISTS agent_runs (
  id TEXT PRIMARY KEY,
  agent_id TEXT,
  session_id TEXT,
  project_id TEXT,
  task_id TEXT,
  mode TEXT NOT NULL,
  input_summary TEXT,
  output_summary TEXT,
  confidence_score REAL,
  model_provider TEXT,
  model_id TEXT,
  status TEXT NOT NULL DEFAULT 'requested',
  error_message TEXT,
  token_usage_json TEXT NOT NULL DEFAULT '{}',
  cost_estimate REAL,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY(agent_id) REFERENCES agents(id),
  FOREIGN KEY(session_id) REFERENCES sessions(id),
  FOREIGN KEY(project_id) REFERENCES projects(id),
  FOREIGN KEY(task_id) REFERENCES tasks(id)
);

CREATE TABLE IF NOT EXISTS agent_handoffs (
  id TEXT PRIMARY KEY,
  source_agent_id TEXT,
  target_agent_id TEXT,
  session_id TEXT,
  task_id TEXT,
  reason TEXT,
  context_summary TEXT,
  status TEXT NOT NULL DEFAULT 'requested',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY(source_agent_id) REFERENCES agents(id),
  FOREIGN KEY(target_agent_id) REFERENCES agents(id)
);

CREATE TABLE IF NOT EXISTS tool_calls (
  id TEXT PRIMARY KEY,
  tool_name TEXT NOT NULL,
  tool_category TEXT NOT NULL,
  session_id TEXT,
  project_id TEXT,
  task_id TEXT,
  agent_run_id TEXT,
  input_json TEXT NOT NULL DEFAULT '{}',
  output_json TEXT,
  output_reference TEXT,
  status TEXT NOT NULL DEFAULT 'Requested',
  risk_level TEXT NOT NULL DEFAULT 'Low',
  approval_decision_id TEXT,
  error_message TEXT,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at TEXT,
  duration_ms INTEGER,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY(session_id) REFERENCES sessions(id),
  FOREIGN KEY(project_id) REFERENCES projects(id),
  FOREIGN KEY(task_id) REFERENCES tasks(id),
  FOREIGN KEY(agent_run_id) REFERENCES agent_runs(id)
);

CREATE TABLE IF NOT EXISTS tool_permissions (
  id TEXT PRIMARY KEY,
  tool_name TEXT NOT NULL,
  category TEXT NOT NULL,
  default_permission_level TEXT NOT NULL,
  project_permission_level TEXT,
  session_permission_level TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  risk_level TEXT NOT NULL DEFAULT 'Low',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS permission_decisions (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  session_id TEXT,
  task_id TEXT,
  requested_action TEXT NOT NULL,
  tool_name TEXT,
  risk_level TEXT NOT NULL,
  target TEXT NOT NULL,
  decision TEXT NOT NULL,
  decision_scope TEXT NOT NULL,
  decided_by_user TEXT NOT NULL DEFAULT 'local-user',
  reason TEXT,
  expires_at TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(project_id) REFERENCES projects(id),
  FOREIGN KEY(session_id) REFERENCES sessions(id),
  FOREIGN KEY(task_id) REFERENCES tasks(id)
);

CREATE TABLE IF NOT EXISTS diff_previews (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  session_id TEXT,
  task_id TEXT,
  title TEXT NOT NULL,
  summary TEXT,
  status TEXT NOT NULL DEFAULT 'generated',
  risk_level TEXT NOT NULL DEFAULT 'Low',
  diff_content TEXT,
  diff_reference TEXT,
  files_changed_count INTEGER NOT NULL DEFAULT 0,
  additions INTEGER NOT NULL DEFAULT 0,
  removals INTEGER NOT NULL DEFAULT 0,
  created_by_agent_run_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(project_id) REFERENCES projects(id),
  FOREIGN KEY(session_id) REFERENCES sessions(id),
  FOREIGN KEY(task_id) REFERENCES tasks(id)
);

CREATE TABLE IF NOT EXISTS file_snapshots (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  file_path TEXT NOT NULL,
  snapshot_path TEXT NOT NULL,
  content_hash TEXT,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  reason TEXT,
  created_by_task_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT,
  FOREIGN KEY(project_id) REFERENCES projects(id),
  FOREIGN KEY(created_by_task_id) REFERENCES tasks(id)
);

CREATE TABLE IF NOT EXISTS file_changes (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  session_id TEXT,
  task_id TEXT,
  file_path TEXT NOT NULL,
  change_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'proposed',
  diff_preview_id TEXT,
  snapshot_id_before TEXT,
  snapshot_id_after TEXT,
  approved_by_decision_id TEXT,
  summary TEXT,
  applied_at TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(project_id) REFERENCES projects(id),
  FOREIGN KEY(session_id) REFERENCES sessions(id),
  FOREIGN KEY(task_id) REFERENCES tasks(id),
  FOREIGN KEY(diff_preview_id) REFERENCES diff_previews(id),
  FOREIGN KEY(snapshot_id_before) REFERENCES file_snapshots(id),
  FOREIGN KEY(snapshot_id_after) REFERENCES file_snapshots(id)
);

CREATE TABLE IF NOT EXISTS git_repositories (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  root_path TEXT NOT NULL,
  current_branch TEXT,
  remote_origin TEXT,
  status TEXT NOT NULL DEFAULT 'unknown',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS git_actions (
  id TEXT PRIMARY KEY,
  repository_id TEXT,
  project_id TEXT,
  session_id TEXT,
  task_id TEXT,
  action_type TEXT NOT NULL,
  command_text TEXT,
  status TEXT NOT NULL DEFAULT 'requested',
  risk_level TEXT NOT NULL DEFAULT 'Low',
  approval_decision_id TEXT,
  result_summary TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY(repository_id) REFERENCES git_repositories(id),
  FOREIGN KEY(project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS github_accounts (
  id TEXT PRIMARY KEY,
  display_name TEXT,
  username TEXT,
  account_identifier TEXT,
  connection_status TEXT NOT NULL DEFAULT 'Not connected',
  scopes TEXT NOT NULL DEFAULT '[]',
  token_metadata_json TEXT NOT NULL DEFAULT '{}',
  connected_at TEXT,
  last_checked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS github_repositories (
  id TEXT PRIMARY KEY,
  account_id TEXT,
  project_id TEXT,
  owner TEXT NOT NULL,
  name TEXT NOT NULL,
  full_name TEXT NOT NULL,
  html_url TEXT,
  visibility TEXT NOT NULL DEFAULT 'private',
  default_branch TEXT,
  connected_git_repo_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT,
  FOREIGN KEY(account_id) REFERENCES github_accounts(id),
  FOREIGN KEY(project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS github_actions (
  id TEXT PRIMARY KEY,
  account_id TEXT,
  repository_id TEXT,
  project_id TEXT,
  session_id TEXT,
  task_id TEXT,
  action_type TEXT NOT NULL,
  target TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested',
  approval_decision_id TEXT,
  result_url TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY(account_id) REFERENCES github_accounts(id),
  FOREIGN KEY(repository_id) REFERENCES github_repositories(id)
);

CREATE TABLE IF NOT EXISTS mcp_servers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  server_type TEXT NOT NULL,
  command_or_endpoint TEXT,
  transport TEXT NOT NULL DEFAULT 'stdio',
  enabled INTEGER NOT NULL DEFAULT 0,
  trust_status TEXT NOT NULL DEFAULT 'untrusted',
  permissions_profile TEXT NOT NULL DEFAULT 'Ask every time',
  last_connected_at TEXT,
  status TEXT NOT NULL DEFAULT 'Not configured',
  error_message TEXT,
  configuration_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS mcp_tools (
  id TEXT PRIMARY KEY,
  server_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  description TEXT,
  input_schema_json TEXT NOT NULL DEFAULT '{}',
  output_schema_json TEXT NOT NULL DEFAULT '{}',
  permission_level TEXT NOT NULL DEFAULT 'Ask every time',
  risk_level TEXT NOT NULL DEFAULT 'Medium',
  enabled INTEGER NOT NULL DEFAULT 0,
  last_used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(server_id) REFERENCES mcp_servers(id)
);

CREATE TABLE IF NOT EXISTS mcp_calls (
  id TEXT PRIMARY KEY,
  server_id TEXT,
  tool_id TEXT,
  session_id TEXT,
  project_id TEXT,
  task_id TEXT,
  input_json TEXT NOT NULL DEFAULT '{}',
  output_json TEXT,
  output_reference TEXT,
  status TEXT NOT NULL DEFAULT 'requested',
  risk_level TEXT NOT NULL DEFAULT 'Medium',
  approval_decision_id TEXT,
  error_message TEXT,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY(server_id) REFERENCES mcp_servers(id),
  FOREIGN KEY(tool_id) REFERENCES mcp_tools(id)
);

CREATE TABLE IF NOT EXISTS connectors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  connector_type TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0,
  default_permission_level TEXT NOT NULL DEFAULT 'Ask every time',
  status TEXT NOT NULL DEFAULT 'Not connected',
  last_sync_at TEXT,
  configuration_metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS connector_accounts (
  id TEXT PRIMARY KEY,
  connector_id TEXT NOT NULL,
  account_display_name TEXT,
  account_identifier TEXT,
  scopes TEXT NOT NULL DEFAULT '[]',
  connection_status TEXT NOT NULL DEFAULT 'Not connected',
  token_metadata_json TEXT NOT NULL DEFAULT '{}',
  connected_at TEXT,
  last_checked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT,
  FOREIGN KEY(connector_id) REFERENCES connectors(id)
);

CREATE TABLE IF NOT EXISTS connector_calls (
  id TEXT PRIMARY KEY,
  connector_id TEXT,
  account_id TEXT,
  session_id TEXT,
  project_id TEXT,
  task_id TEXT,
  action_type TEXT NOT NULL,
  target TEXT,
  input_summary TEXT,
  output_summary TEXT,
  output_reference TEXT,
  status TEXT NOT NULL DEFAULT 'requested',
  approval_decision_id TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY(connector_id) REFERENCES connectors(id),
  FOREIGN KEY(account_id) REFERENCES connector_accounts(id)
);

CREATE TABLE IF NOT EXISTS prompt_templates (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  content TEXT NOT NULL,
  favorite INTEGER NOT NULL DEFAULT 0,
  created_by_user INTEGER NOT NULL DEFAULT 1,
  active_version_id TEXT,
  usage_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS prompt_versions (
  id TEXT PRIMARY KEY,
  prompt_template_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  content TEXT NOT NULL,
  change_summary TEXT,
  created_by TEXT NOT NULL DEFAULT 'local-user',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(prompt_template_id) REFERENCES prompt_templates(id)
);

CREATE TABLE IF NOT EXISTS history_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  project_id TEXT,
  session_id TEXT,
  task_id TEXT,
  agent_run_id TEXT,
  tool_call_id TEXT,
  file_change_id TEXT,
  github_action_id TEXT,
  mcp_call_id TEXT,
  connector_call_id TEXT,
  title TEXT NOT NULL,
  summary TEXT,
  status TEXT NOT NULL DEFAULT 'Created',
  severity TEXT NOT NULL DEFAULT 'info',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  target TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  decision TEXT,
  result TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS diagnostics_logs (
  id TEXT PRIMARY KEY,
  log_level TEXT NOT NULL,
  source TEXT NOT NULL,
  message TEXT NOT NULL,
  stack_trace TEXT,
  project_id TEXT,
  session_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS command_runs (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  session_id TEXT,
  task_id TEXT,
  command_text TEXT NOT NULL,
  working_directory TEXT NOT NULL,
  shell_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested',
  risk_level TEXT NOT NULL,
  approval_decision_id TEXT,
  stdout_reference TEXT,
  stderr_reference TEXT,
  exit_code INTEGER,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS secrets_metadata (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  file_path TEXT NOT NULL,
  secret_type TEXT NOT NULL,
  masked_preview TEXT NOT NULL,
  risk_level TEXT NOT NULL DEFAULT 'High',
  status TEXT NOT NULL DEFAULT 'Detected',
  ignored_by_user INTEGER NOT NULL DEFAULT 0,
  detected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY(project_id) REFERENCES projects(id)
);

CREATE INDEX IF NOT EXISTS idx_projects_root ON projects(normalized_root_path);
CREATE INDEX IF NOT EXISTS idx_sessions_project_updated ON sessions(project_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_messages_session_created ON messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_list_status ON tasks(task_list_id, status);
CREATE INDEX IF NOT EXISTS idx_history_project_created ON history_events(project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tool_calls_project_created ON tool_calls(project_id, started_at);
CREATE INDEX IF NOT EXISTS idx_file_index_project_path ON project_files_index(project_id, relative_path);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_category ON prompt_templates(category, title);
CREATE INDEX IF NOT EXISTS idx_agent_runs_project_started ON agent_runs(project_id, started_at);
CREATE INDEX IF NOT EXISTS idx_permission_decisions_project_created ON permission_decisions(project_id, created_at);
