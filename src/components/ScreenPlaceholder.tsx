import {
  Bot,
  Boxes,
  BrainCircuit,
  Database,
  FileCode2,
  GitPullRequest,
  History,
  KeyRound,
  Library,
  ListChecks,
  Network,
  Settings,
  ShieldCheck
} from "lucide-react";
import type { BootstrapPayload, NavKey, ProjectSummary, SyncTask } from "../types/domain";
import { ConnectorsPanel } from "../features/integrations/ConnectorsPanel";
import { GitHubPanel } from "../features/integrations/GitHubPanel";
import { McpPanel } from "../features/integrations/McpPanel";

const screenMeta: Record<NavKey, { title: string; subtitle: string; icon: typeof Bot }> = {
  home: {
    title: "Home",
    subtitle: "Recent projects, sessions, pending tasks, connected tools, and recommended actions.",
    icon: Database
  },
  projects: {
    title: "Projects",
    subtitle: "Project workspace and AI development control center.",
    icon: FileCode2
  },
  session: {
    title: "AI Session",
    subtitle: "Mode-aware assistant workflow with task creation, context, permissions, and history.",
    icon: Bot
  },
  tasks: {
    title: "Tasks",
    subtitle: "Visible task graph with ignored, blocked, failed, completed, and approval states.",
    icon: ListChecks
  },
  files: {
    title: "Files",
    subtitle: "Allowed folder browsing, safe reads, sensitive file detection, and selected context.",
    icon: FileCode2
  },
  diffs: {
    title: "Diff Preview",
    subtitle: "Review proposed changes by file and keep snapshots before any approved write.",
    icon: GitPullRequest
  },
  agents: {
    title: "Agents",
    subtitle: "Planner, Coder, Reviewer, UI, Security, GitHub, MCP, and Connector agent modes.",
    icon: Bot
  },
  prompts: {
    title: "Prompts",
    subtitle: "Prompt library with categories, versions, favorites, imports, and exports.",
    icon: Library
  },
  history: {
    title: "History",
    subtitle: "Searchable trace of sessions, tasks, tool calls, approvals, diffs, and audits.",
    icon: History
  },
  connectors: {
    title: "Connectors",
    subtitle: "External services with visible status, permissions, accounts, and action history.",
    icon: Boxes
  },
  mcp: {
    title: "MCP Servers",
    subtitle: "Add, test, enable, inspect, and permission MCP tools before the AI can use them.",
    icon: Network
  },
  github: {
    title: "GitHub",
    subtitle: "Repository creation, branches, commits, issues, pull requests, and safe push flow.",
    icon: GitPullRequest
  },
  settings: {
    title: "Settings",
    subtitle: "General behavior, appearance, AI defaults, storage, logs, diagnostics, and reset tools.",
    icon: Settings
  },
  permissions: {
    title: "Permissions",
    subtitle: "Global, project, session, task, file, command, connector, and MCP approval rules.",
    icon: ShieldCheck
  },
  models: {
    title: "API Keys / Models",
    subtitle: "Providers, model profiles, masked key metadata, connection tests, and local fallback.",
    icon: BrainCircuit
  }
};

interface ScreenPlaceholderProps {
  activeView: NavKey;
  payload: BootstrapPayload;
  selectedProject: ProjectSummary;
  tasks: SyncTask[];
}

export function ScreenPlaceholder({
  activeView,
  payload,
  selectedProject,
  tasks
}: ScreenPlaceholderProps) {
  const meta = screenMeta[activeView];
  const Icon = meta.icon;

  if (activeView === "github") {
    return <GitHubPanel />;
  }

  if (activeView === "mcp") {
    return <McpPanel payload={payload} />;
  }

  if (activeView === "connectors") {
    return <ConnectorsPanel payload={payload} />;
  }

  return (
    <div className="min-h-0 flex-1 overflow-hidden bg-[#202020] p-6 pb-[126px]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-3 grid h-8 w-8 place-items-center rounded-lg border border-[#343434] bg-[#262626]">
            <Icon size={16} className="text-[#d8d8d8]" />
          </div>
          <h1 className="text-[17px] font-medium text-[#eeeeee]">{meta.title}</h1>
          <p className="mt-2 max-w-xl text-[11px] leading-5 text-[#8c8c8c]">{meta.subtitle}</p>
        </div>
        <div className="rounded-lg border border-[#333] bg-[#242424] p-2 text-right">
          <div className="text-[10px] text-[#777]">Project</div>
          <div className="mt-1 text-[11px] font-medium text-[#d8d8d8]">{selectedProject.name}</div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4">
        <Capability title="Traceability" value={`${payload.history.length} recent events`} />
        <Capability title="Tasks" value={`${tasks.length} visible workflow items`} />
        <Capability title="Security" value={payload.securityMode} />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4">
        <Panel title="MVP Surface">
          This screen is wired into the real navigation model and ready for feature-specific
          implementation. Actions that mutate files, commands, GitHub, MCP, or connectors stay
          approval-gated.
        </Panel>
        <Panel title="Storage Contract">
          Runtime state belongs in SQLite. Settings, prompts, MCP presets, and connector metadata can
          be exported through JSON, TOML, or YAML once the import/export tools are enabled.
        </Panel>
      </div>

      <div className="mt-5 rounded-lg border border-[#333] bg-[#242424] p-3">
        <div className="mb-3 flex items-center gap-2 text-[11px] font-medium text-[#dddddd]">
          <KeyRound size={14} className="text-[#9d9d9d]" />
          Guarded Defaults
        </div>
        <div className="grid grid-cols-2 gap-2 text-[10.5px] text-[#a0a0a0]">
          {payload.permissions.map((permission) => (
            <div
              key={permission.id}
              className="flex items-center justify-between gap-3 rounded-md border border-[#303030] bg-[#202020] px-2 py-1.5"
            >
              <span>{permission.action}</span>
              <span className="text-[#777]">{permission.level}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Capability({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#333] bg-[#242424] p-3">
      <div className="text-[10px] text-[#777]">{title}</div>
      <div className="mt-2 text-[11px] font-medium text-[#dddddd]">{value}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[#333] bg-[#242424] p-3">
      <div className="text-[11px] font-medium text-[#dddddd]">{title}</div>
      <p className="mt-2 text-[10.5px] leading-5 text-[#8c8c8c]">{children}</p>
    </div>
  );
}
