/**
 * Command registry — the spine of the Command Palette and any future
 * plugin command system. Every command is a structured entry, not a
 * loose `() => void`. This lets us:
 *
 *   - render command descriptions, shortcuts, risk badges
 *   - filter by category
 *   - apply permission/risk gating later
 *   - allow plugins to register their own commands without touching the UI
 */

import type { NavKey } from "../types/domain";

export type CommandCategory =
  | "AI"
  | "Project"
  | "Build & Test"
  | "Git"
  | "Terminal"
  | "View"
  | "Settings"
  | "MCP"
  | "Connectors"
  | "Plugin";

export type CommandRisk = "safe" | "low" | "medium" | "high" | "critical";

export interface CommandContext {
  navigate: (view: NavKey) => void;
  toggleBottomPanel: () => void;
  toggleSidebar: () => void;
  focusComposer: () => void;
  openTerminal: () => void;
  clearTerminal: () => void;
  openCommandPalette: () => void;
}

export interface SyncCommand {
  id: string;
  title: string;
  description?: string;
  category: CommandCategory;
  shortcut?: string;
  risk: CommandRisk;
  source?: string; // 'core' or plugin id
  enabled?: boolean;
  handler: (context: CommandContext) => void | Promise<void>;
}

/**
 * Mutable command registry. Plugins register commands by calling
 * `registerCommand(...)`. The Command Palette subscribes via
 * `subscribe(...)` so newly added commands appear instantly.
 */
class CommandRegistry {
  private commands = new Map<string, SyncCommand>();
  private listeners = new Set<() => void>();

  register(command: SyncCommand) {
    this.commands.set(command.id, command);
    this.emit();
  }

  unregister(id: string) {
    this.commands.delete(id);
    this.emit();
  }

  list(): SyncCommand[] {
    return Array.from(this.commands.values());
  }

  get(id: string): SyncCommand | undefined {
    return this.commands.get(id);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    for (const listener of this.listeners) listener();
  }
}

export const commandRegistry = new CommandRegistry();

/**
 * Built-in (core) commands. These are registered once at app boot.
 * Plugins can extend this list later via `commandRegistry.register(...)`.
 */
export function registerBuiltInCommands() {
  const items: SyncCommand[] = [
    {
      id: "ai.new-session",
      title: "New AI Session",
      description: "Start a fresh chat with the configured provider.",
      category: "AI",
      shortcut: "Ctrl+N",
      risk: "safe",
      source: "core",
      handler: ({ navigate, focusComposer }) => {
        navigate("session");
        focusComposer();
      }
    },
    {
      id: "project.open-folder",
      title: "Open Project Folder",
      description: "Pick a folder to scan and use as project context.",
      category: "Project",
      risk: "low",
      source: "core",
      handler: ({ navigate }) => navigate("projects")
    },
    {
      id: "project.scan",
      title: "Scan Project",
      description: "Re-scan the active project for files and sensitive paths.",
      category: "Project",
      risk: "safe",
      source: "core",
      handler: ({ navigate }) => navigate("files")
    },
    {
      id: "build.run",
      title: "Run Build",
      description: "Run npm run tauri:build (requires approval).",
      category: "Build & Test",
      risk: "medium",
      source: "core",
      handler: ({ openTerminal }) => openTerminal()
    },
    {
      id: "build.run-tests",
      title: "Run Tests",
      description: "Run npm test or cargo test for the active project.",
      category: "Build & Test",
      risk: "low",
      source: "core",
      handler: ({ openTerminal }) => openTerminal()
    },
    {
      id: "build.dev",
      title: "Run Dev Server",
      description: "Run npm run tauri:dev (requires approval).",
      category: "Build & Test",
      risk: "medium",
      source: "core",
      handler: ({ openTerminal }) => openTerminal()
    },
    {
      id: "git.status",
      title: "Git: Status",
      description: "Show the current branch and dirty file list.",
      category: "Git",
      risk: "safe",
      source: "core",
      handler: ({ navigate }) => navigate("github")
    },
    {
      id: "git.commit",
      title: "Git: Commit",
      description: "Stage and commit changes (requires approval).",
      category: "Git",
      risk: "medium",
      source: "core",
      handler: ({ navigate }) => navigate("github")
    },
    {
      id: "git.push",
      title: "Git: Push",
      description: "Push current branch to origin (requires approval).",
      category: "Git",
      risk: "high",
      source: "core",
      handler: ({ navigate }) => navigate("github")
    },
    {
      id: "github.create-repo",
      title: "GitHub: Create Repository",
      description: "Create a new GitHub repository for this project.",
      category: "Git",
      risk: "high",
      source: "core",
      handler: ({ navigate }) => navigate("github")
    },
    {
      id: "github.connect-repo",
      title: "GitHub: Connect Existing Repository",
      category: "Git",
      risk: "low",
      source: "core",
      handler: ({ navigate }) => navigate("github")
    },
    {
      id: "terminal.open",
      title: "Open Terminal",
      shortcut: "Ctrl+`",
      category: "Terminal",
      risk: "safe",
      source: "core",
      handler: ({ openTerminal }) => openTerminal()
    },
    {
      id: "terminal.clear",
      title: "Clear Terminal",
      category: "Terminal",
      risk: "safe",
      source: "core",
      handler: ({ clearTerminal }) => clearTerminal()
    },
    {
      id: "view.toggle-sidebar",
      title: "Toggle Sidebar",
      shortcut: "Ctrl+B",
      category: "View",
      risk: "safe",
      source: "core",
      handler: ({ toggleSidebar }) => toggleSidebar()
    },
    {
      id: "view.toggle-bottom-panel",
      title: "Toggle Bottom Panel",
      shortcut: "Ctrl+J",
      category: "View",
      risk: "safe",
      source: "core",
      handler: ({ toggleBottomPanel }) => toggleBottomPanel()
    },
    {
      id: "view.command-palette",
      title: "Command Palette",
      shortcut: "Ctrl+Shift+P",
      category: "View",
      risk: "safe",
      source: "core",
      handler: ({ openCommandPalette }) => openCommandPalette()
    },
    {
      id: "view.history",
      title: "Open History",
      category: "View",
      risk: "safe",
      source: "core",
      handler: ({ navigate }) => navigate("history")
    },
    {
      id: "view.tasks",
      title: "Open Tasks",
      category: "View",
      risk: "safe",
      source: "core",
      handler: ({ navigate }) => navigate("tasks")
    },
    {
      id: "view.diff",
      title: "Open Diff Preview",
      category: "View",
      risk: "safe",
      source: "core",
      handler: ({ navigate }) => navigate("diffs")
    },
    {
      id: "view.files",
      title: "Open Files",
      category: "View",
      risk: "safe",
      source: "core",
      handler: ({ navigate }) => navigate("files")
    },
    {
      id: "view.prompts",
      title: "Open Prompts",
      category: "View",
      risk: "safe",
      source: "core",
      handler: ({ navigate }) => navigate("prompts")
    },
    {
      id: "settings.open",
      title: "Open Settings",
      category: "Settings",
      risk: "safe",
      source: "core",
      handler: ({ navigate }) => navigate("settings")
    },
    {
      id: "settings.models",
      title: "Open Models / API Keys",
      category: "Settings",
      risk: "low",
      source: "core",
      handler: ({ navigate }) => navigate("models")
    },
    {
      id: "settings.permissions",
      title: "Open Permissions",
      category: "Settings",
      risk: "safe",
      source: "core",
      handler: ({ navigate }) => navigate("permissions")
    },
    {
      id: "mcp.manage",
      title: "Manage MCP Servers",
      category: "MCP",
      risk: "low",
      source: "core",
      handler: ({ navigate }) => navigate("mcp")
    },
    {
      id: "connectors.manage",
      title: "Manage Connectors",
      category: "Connectors",
      risk: "low",
      source: "core",
      handler: ({ navigate }) => navigate("connectors")
    },
    {
      id: "view.reload",
      title: "Reload App",
      shortcut: "Ctrl+R",
      category: "View",
      risk: "low",
      source: "core",
      handler: () => {
        if (typeof window !== "undefined") window.location.reload();
      }
    }
  ];

  for (const command of items) {
    commandRegistry.register(command);
  }
}
