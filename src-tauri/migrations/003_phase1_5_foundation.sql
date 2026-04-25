CREATE TABLE IF NOT EXISTS package_events (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  package_manager TEXT NOT NULL,
  package_name TEXT,
  action TEXT NOT NULL,
  version_before TEXT,
  version_after TEXT,
  status TEXT NOT NULL DEFAULT 'requested',
  related_file_changes TEXT NOT NULL DEFAULT '[]',
  approval_decision_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY(project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS exports (
  id TEXT PRIMARY KEY,
  export_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  project_id TEXT,
  session_id TEXT,
  status TEXT NOT NULL DEFAULT 'created',
  included_data_categories TEXT NOT NULL DEFAULT '[]',
  masked_secrets INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY(project_id) REFERENCES projects(id),
  FOREIGN KEY(session_id) REFERENCES sessions(id)
);

CREATE TABLE IF NOT EXISTS imports (
  id TEXT PRIMARY KEY,
  import_type TEXT NOT NULL,
  source_file_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'created',
  imported_records_count INTEGER NOT NULL DEFAULT 0,
  skipped_records_count INTEGER NOT NULL DEFAULT 0,
  conflict_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  read INTEGER NOT NULL DEFAULT 0,
  project_id TEXT,
  session_id TEXT,
  task_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY(project_id) REFERENCES projects(id),
  FOREIGN KEY(session_id) REFERENCES sessions(id),
  FOREIGN KEY(task_id) REFERENCES tasks(id)
);

CREATE TABLE IF NOT EXISTS model_usage_events (
  id TEXT PRIMARY KEY,
  provider_id TEXT,
  model_profile_id TEXT,
  session_id TEXT,
  task_id TEXT,
  purpose TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested',
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  cost_estimate REAL,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY(provider_id) REFERENCES model_providers(id),
  FOREIGN KEY(model_profile_id) REFERENCES model_profiles(id),
  FOREIGN KEY(session_id) REFERENCES sessions(id),
  FOREIGN KEY(task_id) REFERENCES tasks(id)
);

CREATE TABLE IF NOT EXISTS database_connections (
  id TEXT PRIMARY KEY,
  connection_name TEXT NOT NULL,
  database_type TEXT NOT NULL,
  host_metadata TEXT,
  database_name TEXT,
  status TEXT NOT NULL DEFAULT 'Not connected',
  permission_level TEXT NOT NULL DEFAULT 'Ask every time',
  last_tested_at TEXT,
  credential_metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

INSERT OR IGNORE INTO model_providers (
  id, name, provider_type, base_url, auth_method, connection_status, configured, enabled, metadata_json
)
VALUES
  ('nvidia', 'NVIDIA NIM / AI Endpoints', 'nvidia', 'https://integrate.api.nvidia.com/v1', 'api_key', 'Requires authentication', 0, 0, '{"compatibility":"openai-compatible","supports_cloud":true,"supports_future_local":true}'),
  ('custom-openai-compatible', 'Custom OpenAI-Compatible', 'openai-compatible', '', 'api_key', 'Not configured', 0, 0, '{"user_configurable":true}');

INSERT OR IGNORE INTO model_profiles (
  id, name, provider_id, model_id, role, max_context, temperature, streaming_enabled, enabled, metadata_json
)
VALUES
  ('nvidia-default', 'NVIDIA Default', 'nvidia', 'configure-nvidia-model', 'default', 128000, 0.2, 1, 0, '{"provider_family":"nvidia"}'),
  ('nvidia-coding', 'NVIDIA Coding', 'nvidia', 'configure-nvidia-coding-model', 'coding', 128000, 0.1, 1, 0, '{"provider_family":"nvidia"}'),
  ('custom-default', 'Custom Compatible Default', 'custom-openai-compatible', 'configure-custom-model', 'default', 128000, 0.2, 1, 0, '{"provider_family":"openai-compatible"}');

INSERT OR IGNORE INTO agents (
  id, name, description, role, enabled, default_mode, model_profile_id, permissions_profile, system_prompt_reference, configuration_json, version
)
VALUES
  ('git', 'Git Agent', 'Inspect local repositories and prepare approval-gated Git workflows.', 'Git workflow', 1, 'Review Mode', 'default-model', 'approval-required', 'requirements/agent/tools.txt', '{}', '1'),
  ('mcp', 'MCP Agent', 'Plan MCP server and tool usage through guarded calls.', 'MCP workflow', 1, 'Connector Mode', 'default-model', 'approval-required', 'requirements/agent/tools.txt', '{}', '1'),
  ('diagnostics', 'Diagnostics Agent', 'Inspect environment health and logs using read-only diagnostics first.', 'Diagnostics', 1, 'Debug Mode', 'fast-model', 'balanced', 'requirements/desktop/security.txt', '{}', '1'),
  ('memory', 'Memory Agent', 'Maintain visible project memory without storing secrets.', 'Project memory', 1, 'Plan Mode', 'default-model', 'balanced', 'requirements/desktop/db.txt', '{}', '1');

INSERT OR IGNORE INTO connectors (
  id, name, connector_type, enabled, default_permission_level, status
)
VALUES
  ('discord', 'Discord', 'discord', 0, 'Ask every time', 'Disabled'),
  ('trello', 'Trello', 'trello', 0, 'Ask every time', 'Disabled'),
  ('jira', 'Jira', 'jira', 0, 'Ask every time', 'Disabled'),
  ('linear', 'Linear', 'linear', 0, 'Ask every time', 'Disabled'),
  ('firebase', 'Firebase', 'firebase', 0, 'Ask every time', 'Disabled'),
  ('netlify', 'Netlify', 'netlify', 0, 'Ask every time', 'Disabled'),
  ('nvidia', 'NVIDIA', 'ai-provider', 0, 'Provider only', 'Requires authentication');

INSERT OR IGNORE INTO app_settings (key, value, value_type, category)
VALUES
  ('updates_enabled', 'true', 'boolean', 'general'),
  ('installer_channel', 'nsis', 'string', 'build'),
  ('task_panel_default', 'expanded', 'string', 'workspace');

CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_model_usage_provider_created ON model_usage_events(provider_id, created_at);
CREATE INDEX IF NOT EXISTS idx_package_events_project_created ON package_events(project_id, created_at);
