INSERT OR IGNORE INTO app_settings (key, value, value_type, category)
VALUES
  ('startup_screen', 'Projects', 'string', 'general'),
  ('default_approval_mode', 'Balanced Mode', 'string', 'security'),
  ('default_ai_mode', 'Plan Mode', 'string', 'ai'),
  ('history_enabled', 'true', 'boolean', 'storage'),
  ('project_memory_enabled', 'true', 'boolean', 'storage');

INSERT OR IGNORE INTO user_preferences (
  id,
  preferred_response_style,
  default_agent,
  default_ai_mode,
  default_task_behavior,
  confirm_before_write,
  confirm_before_command,
  confirm_before_github_action
) VALUES (
  'local-user',
  'balanced',
  'Planner Agent',
  'Plan Mode',
  'automatic',
  1,
  1,
  1
);

INSERT OR IGNORE INTO model_providers (
  id, name, provider_type, base_url, auth_method, connection_status, configured, enabled
)
VALUES
  ('openai', 'OpenAI', 'openai', 'https://api.openai.com/v1', 'api_key', 'Requires authentication', 0, 0),
  ('openrouter', 'OpenRouter', 'openrouter', 'https://openrouter.ai/api/v1', 'api_key', 'Requires authentication', 0, 0),
  ('anthropic', 'Anthropic', 'anthropic', 'https://api.anthropic.com', 'api_key', 'Requires authentication', 0, 0),
  ('gemini', 'Google Gemini', 'gemini', 'https://generativelanguage.googleapis.com', 'api_key', 'Requires authentication', 0, 0),
  ('ollama', 'Ollama', 'ollama', 'http://localhost:11434', 'none', 'Not tested', 0, 0);

INSERT OR IGNORE INTO model_profiles (
  id, name, provider_id, model_id, role, max_context, temperature, streaming_enabled, enabled
)
VALUES
  ('default-model', 'Default Model', 'openai', 'configure-provider-first', 'default', 128000, 0.2, 1, 0),
  ('fast-model', 'Fast Tasks', 'openai', 'configure-provider-first', 'fast', 64000, 0.2, 1, 0),
  ('coding-model', 'Coding Tasks', 'openai', 'configure-provider-first', 'coding', 128000, 0.1, 1, 0),
  ('review-model', 'Review Tasks', 'openai', 'configure-provider-first', 'review', 128000, 0.1, 1, 0),
  ('local-fallback', 'Local Fallback', 'ollama', 'configure-local-model', 'local fallback', 32000, 0.2, 1, 0);

INSERT OR IGNORE INTO agents (
  id, name, description, role, enabled, default_mode, model_profile_id, permissions_profile, system_prompt_reference, configuration_json, version
)
VALUES
  ('planner', 'Planner Agent', 'Break requests into tasks, phases, and milestones.', 'Task planning', 1, 'Plan Mode', 'default-model', 'balanced', 'requirements/desktop/product.txt', '{}', '1'),
  ('coder', 'Coder Agent', 'Propose code changes and implementation steps.', 'Implementation', 1, 'Build Mode', 'coding-model', 'balanced', 'requirements/agent/tools.txt', '{}', '1'),
  ('reviewer', 'Reviewer Agent', 'Review code, logic, architecture, and risks.', 'Code review', 1, 'Review Mode', 'review-model', 'balanced', 'requirements/desktop/security.txt', '{}', '1'),
  ('ui', 'UI Agent', 'Improve interface structure, UX, visual consistency, and screen logic.', 'UI/UX', 1, 'Design Mode', 'default-model', 'balanced', 'requirements/desktop/design.txt', '{}', '1'),
  ('security', 'Security Agent', 'Detect unsafe operations, secrets, risky permissions, and dangerous commands.', 'Risk checks', 1, 'Safe Mode', 'review-model', 'strict', 'requirements/desktop/security.txt', '{}', '1'),
  ('github', 'GitHub Agent', 'Manage repositories, issues, pull requests, commits, and branches.', 'Repository workflow', 1, 'GitHub Mode', 'default-model', 'approval-required', 'requirements/desktop/product.txt', '{}', '1'),
  ('connector', 'Connector Agent', 'Use external tools and connected services with visible approvals.', 'Connectors', 1, 'Connector Mode', 'default-model', 'approval-required', 'requirements/agent/tools.txt', '{}', '1');

INSERT OR IGNORE INTO task_lists (
  id, title, description, owner_agent, status, progress_percentage
) VALUES (
  'mvp-foundation',
  'Sync MVP Foundation',
  'Architecture, security, database, task workflow, and main desktop UI.',
  'Planner Agent',
  'active',
  25
);

INSERT OR IGNORE INTO tasks (
  id, task_list_id, title, description, status, priority, owner_agent, risk_level, required_tools, affected_files, approval_state, related_target
)
VALUES
  ('task-scan', 'mvp-foundation', 'Scan allowed project folder', 'Index project metadata without reading protected files.', 'Completed', 'High', 'Planner Agent', 'Safe', '["scan_project_structure"]', '[]', 'not_required', 'Project'),
  ('task-schema', 'mvp-foundation', 'Prepare local SQLite schema', 'Create traceable storage for sessions, tasks, tools, permissions, and history.', 'In Progress', 'High', 'Coder Agent', 'Low', '["database_migrate"]', '["src-tauri/migrations"]', 'not_required', 'Database'),
  ('task-permissions', 'mvp-foundation', 'Review file write permissions', 'Require approval before applying diffs or running commands.', 'Waiting for Approval', 'High', 'Security Agent', 'Medium', '["permission_gate"]', '[]', 'required', 'Permissions'),
  ('task-github', 'mvp-foundation', 'Connect GitHub repository', 'Optional repository setup remains gated behind explicit approval.', 'Pending', 'Medium', 'GitHub Agent', 'High', '["github_connect_account"]', '[]', 'required', 'GitHub');

INSERT OR IGNORE INTO tool_permissions (
  id, tool_name, category, default_permission_level, enabled, risk_level
)
VALUES
  ('read-files', 'Read opened project files', 'File System', 'Allow for this project', 1, 'Safe'),
  ('search-files', 'Search opened project files', 'File System', 'Allow for this project', 1, 'Safe'),
  ('read-sensitive-files', 'Read sensitive files', 'File System', 'Ask every time', 1, 'High'),
  ('write-files', 'Write files', 'File System', 'Ask every time', 1, 'Medium'),
  ('delete-files', 'Delete files', 'File System', 'Ask every time', 1, 'High'),
  ('run-commands', 'Run commands', 'Terminal', 'Ask every time', 1, 'High'),
  ('git-read', 'Git status/diff/log', 'Git', 'Allow for this project', 1, 'Low'),
  ('git-commit-push', 'Commit and push', 'Git', 'Ask every time', 1, 'High'),
  ('github-create-repo', 'Create GitHub repository', 'GitHub', 'Ask every time', 1, 'High'),
  ('mcp-tools', 'Use MCP tools', 'MCP', 'Ask every time', 1, 'Medium'),
  ('connector-read', 'Connector read', 'Connectors', 'Ask every time', 1, 'Medium'),
  ('connector-write', 'Connector write', 'Connectors', 'Ask every time', 1, 'High'),
  ('secret-access', 'Secrets access', 'Secrets', 'Disabled', 1, 'Critical');

INSERT OR IGNORE INTO connectors (
  id, name, connector_type, enabled, default_permission_level, status
)
VALUES
  ('github', 'GitHub', 'github', 0, 'Ask every time', 'Not connected'),
  ('google-drive', 'Google Drive', 'drive', 0, 'Ask every time', 'Disabled'),
  ('gmail', 'Gmail', 'gmail', 0, 'Ask every time', 'Disabled'),
  ('notion', 'Notion', 'notion', 0, 'Ask every time', 'Disabled'),
  ('slack', 'Slack', 'slack', 0, 'Ask every time', 'Disabled'),
  ('figma', 'Figma', 'figma', 0, 'Ask every time', 'Disabled'),
  ('supabase', 'Supabase', 'supabase', 0, 'Ask every time', 'Disabled'),
  ('vercel', 'Vercel', 'vercel', 0, 'Ask every time', 'Disabled'),
  ('openai', 'OpenAI', 'ai-provider', 0, 'Provider only', 'Requires authentication'),
  ('openrouter', 'OpenRouter', 'ai-provider', 0, 'Provider only', 'Requires authentication'),
  ('anthropic', 'Anthropic', 'ai-provider', 0, 'Provider only', 'Requires authentication'),
  ('gemini', 'Google Gemini', 'ai-provider', 0, 'Provider only', 'Requires authentication'),
  ('ollama', 'Ollama', 'local-ai-provider', 0, 'Provider only', 'Not tested');

INSERT OR IGNORE INTO mcp_servers (
  id, name, server_type, command_or_endpoint, transport, enabled, trust_status, permissions_profile, status
)
VALUES
  ('documentation-lookup', 'Documentation Lookup', 'command', NULL, 'stdio', 0, 'limited', 'Ask every time', 'Not configured'),
  ('browser-automation', 'Browser Automation', 'command', NULL, 'stdio', 0, 'untrusted', 'Ask every time', 'Disabled'),
  ('database-inspector', 'Database Inspector', 'command', NULL, 'stdio', 0, 'untrusted', 'Ask every time', 'Disabled');

INSERT OR IGNORE INTO prompt_templates (
  id, title, description, category, tags, content, favorite, created_by_user
)
VALUES
  ('planning-default', 'Plan a coding workflow', 'Break a request into safe, reviewable tasks.', 'Planning', '["planning","tasks","security"]', 'Create a concise task plan with required context, permissions, risks, and next actions.', 1, 0),
  ('review-default', 'Review code safely', 'Review code for regressions, risks, and missing tests.', 'Code Review', '["review","security","tests"]', 'Review the selected code with findings first, ordered by severity, and include file references.', 1, 0),
  ('security-default', 'Classify risky action', 'Classify action risk and required permission.', 'Security', '["permissions","risk"]', 'Classify this action using Sync risk levels and state required approval.', 1, 0);

INSERT OR IGNORE INTO history_events (
  id, event_type, title, summary, status, severity, metadata_json
)
VALUES
  ('history-session-seed', 'session_started', 'Workspace foundation created', 'Sync loaded the MVP workspace foundation.', 'Completed', 'info', '{}'),
  ('history-permissions-seed', 'permission_changed', 'Balanced Mode security defaults loaded', 'Safe reads are project-scoped; writes and external actions require approval.', 'Active', 'info', '{}');

INSERT OR IGNORE INTO audit_logs (
  id, action, actor, target, risk_level, decision, result, metadata_json
)
VALUES
  ('audit-security-defaults', 'load_security_defaults', 'system', 'local permissions', 'Low', 'allowed', 'Balanced Mode defaults loaded', '{}');
