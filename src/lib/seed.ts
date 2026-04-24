import type { BootstrapPayload } from "../types/domain";

export const demoPayload: BootstrapPayload = {
  appName: "Sync",
  version: "0.1.0",
  databasePath: "Not initialized in browser preview",
  securityMode: "Balanced Mode",
  recentProjects: [
    {
      id: "mainpy",
      name: "MainPy",
      path: "D:\\Projects\\MainPy",
      description: "Desktop AI workspace",
      updatedLabel: "Updated 5m ago",
      language: "TypeScript / Rust",
      framework: "Tauri + React",
      gitStatus: "Clean",
      selected: true
    },
    {
      id: "darkstudio",
      name: "DarkStudio AI",
      path: "D:\\Projects\\DarkStudio",
      description: "AI editing suite",
      updatedLabel: "Updated 1h ago",
      language: "TypeScript",
      framework: "React",
      gitStatus: "3 changes"
    },
    {
      id: "time",
      name: "Steal a Time",
      path: "D:\\Projects\\StealATime",
      description: "Game systems",
      updatedLabel: "Updated yesterday",
      language: "Lua",
      framework: "Roblox",
      gitStatus: "Clean"
    },
    {
      id: "admin",
      name: "Admin System",
      path: "D:\\Projects\\AdminSystem",
      description: "Internal tooling",
      updatedLabel: "Updated 2 days ago",
      language: "TypeScript",
      framework: "Node",
      gitStatus: "Needs review"
    },
    {
      id: "portfolio",
      name: "Portfolio Site",
      path: "D:\\Projects\\Portfolio",
      description: "Personal website",
      updatedLabel: "Updated 4 days ago",
      language: "TSX",
      framework: "Vite",
      gitStatus: "Clean"
    }
  ],
  activeTasks: [
    {
      id: "task-scan",
      title: "Scan allowed project folder",
      description: "Index project metadata without reading protected files.",
      status: "Completed",
      priority: "High",
      risk: "Safe",
      agent: "Planner Agent",
      related: "Project"
    },
    {
      id: "task-schema",
      title: "Prepare local SQLite schema",
      description: "Create traceable storage for sessions, tasks, tools, permissions, and history.",
      status: "In Progress",
      priority: "High",
      risk: "Low",
      agent: "Coder Agent",
      related: "Database"
    },
    {
      id: "task-permissions",
      title: "Review file write permissions",
      description: "Require approval before applying diffs or running commands.",
      status: "Waiting for Approval",
      priority: "High",
      risk: "Medium",
      agent: "Security Agent",
      related: "Permissions"
    },
    {
      id: "task-github",
      title: "Connect GitHub repository",
      description: "Optional repository setup remains gated behind explicit approval.",
      status: "Pending",
      priority: "Medium",
      risk: "High",
      agent: "GitHub Agent",
      related: "GitHub"
    }
  ],
  agents: [
    { id: "planner", name: "Planner Agent", role: "Task planning", mode: "Plan Mode", enabled: true },
    { id: "coder", name: "Coder Agent", role: "Implementation", mode: "Build Mode", enabled: true },
    { id: "reviewer", name: "Reviewer Agent", role: "Code review", mode: "Review Mode", enabled: true },
    { id: "security", name: "Security Agent", role: "Risk checks", mode: "Safe Mode", enabled: true }
  ],
  permissions: [
    {
      id: "read-files",
      category: "File System",
      action: "Read opened project files",
      level: "Allow for this project",
      risk: "Safe"
    },
    {
      id: "write-files",
      category: "File System",
      action: "Write files",
      level: "Ask every time",
      risk: "Medium"
    },
    {
      id: "commands",
      category: "Terminal",
      action: "Run commands",
      level: "Ask every time",
      risk: "High"
    },
    {
      id: "github-push",
      category: "GitHub",
      action: "Commit and push",
      level: "Ask every time",
      risk: "High"
    }
  ],
  connectors: [
    { id: "github", name: "GitHub", status: "Not connected", permission: "Ask every time" },
    { id: "openai", name: "OpenAI", status: "Requires authentication", permission: "Provider only" },
    { id: "drive", name: "Google Drive", status: "Disabled", permission: "Disabled" },
    { id: "figma", name: "Figma", status: "Disabled", permission: "Disabled" }
  ],
  mcpServers: [
    { id: "docs", name: "Documentation Lookup", status: "Not configured", trust: "limited", tools: 0 },
    { id: "browser", name: "Browser Automation", status: "Disabled", trust: "untrusted", tools: 0 }
  ],
  history: [
    {
      id: "history-session",
      title: "Workspace foundation created",
      kind: "session_started",
      status: "Completed",
      timestamp: "Just now"
    },
    {
      id: "history-permission",
      title: "Balanced Mode security defaults loaded",
      kind: "permission_changed",
      status: "Active",
      timestamp: "Just now"
    }
  ]
};
