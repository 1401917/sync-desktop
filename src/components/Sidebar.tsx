import {
  Bot,
  Check,
  Circle,
  FileCode2,
  GitPullRequest,
  History,
  Home,
  Library,
  ListChecks,
  MessageSquareText,
  Network,
  PanelLeft,
  Plus,
  RotateCcw,
  Settings,
  X,
  Boxes
} from "lucide-react";
import { cn } from "../lib/cn";
import type { NavKey, ProjectSummary, SyncTask } from "../types/domain";

const navItems: Array<{ id: NavKey; label: string; icon: typeof Home }> = [
  { id: "home", label: "Home", icon: Home },
  { id: "projects", label: "Projects", icon: PanelLeft },
  { id: "session", label: "AI Session", icon: MessageSquareText },
  { id: "tasks", label: "Tasks", icon: ListChecks },
  { id: "files", label: "Files", icon: FileCode2 },
  { id: "diffs", label: "Diff Preview", icon: GitPullRequest },
  { id: "agents", label: "Agents", icon: Bot },
  { id: "prompts", label: "Prompts", icon: Library },
  { id: "history", label: "History", icon: History },
  { id: "github", label: "GitHub", icon: GitPullRequest },
  { id: "mcp", label: "MCP", icon: Network },
  { id: "connectors", label: "Connectors", icon: Boxes },
  { id: "settings", label: "Settings", icon: Settings }
];

interface SidebarProps {
  activeView: NavKey;
  projects: ProjectSummary[];
  tasks: SyncTask[];
  onNavigate: (view: NavKey) => void;
  onIgnoreTask: (taskId: string) => void;
  onRestoreTask: (taskId: string) => void;
  onCompleteTask: (taskId: string) => void;
}

export function Sidebar({
  activeView,
  projects,
  tasks,
  onNavigate,
  onIgnoreTask,
  onRestoreTask,
  onCompleteTask
}: SidebarProps) {
  return (
    <aside className="flex w-[202px] shrink-0 flex-col border-r border-[#2c2c2c] bg-[#191919] px-2 py-2">
      <button className="mb-2 flex h-[30px] w-full items-center gap-2 rounded-md bg-[#262626] px-2 text-left text-[11px] font-medium text-[#e8e8e8] transition hover:bg-[#303030]">
        <Plus size={13} />
        New Session
      </button>

      <SectionTitle>Workspace</SectionTitle>
      <nav className="shrink-0">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.id === activeView;

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                "mb-0.5 flex h-[25px] w-full items-center gap-2 rounded-md px-2 text-left text-[11px] transition",
                active
                  ? "bg-[#2a2a2a] text-[#f0f0f0]"
                  : "text-[#a9a9a9] hover:bg-[#242424] hover:text-[#e8e8e8]"
              )}
            >
              <Icon className={active ? "text-[#f0f0f0]" : "text-[#858585]"} size={13} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-3 shrink-0">
        <SectionTitle>Recent Projects</SectionTitle>
        <div className="space-y-0.5">
          {projects.slice(0, 5).map((project) => (
            <button
              key={project.id}
              className={cn(
                "w-full rounded-md px-2 py-1.5 text-left transition",
                project.selected
                  ? "bg-[#252525]"
                  : "bg-transparent hover:bg-[#232323]"
              )}
            >
              <div className="truncate text-[11px] font-medium text-[#d8d8d8]">{project.name}</div>
              <div className="mt-0.5 truncate text-[10px] text-[#777]">{project.updatedLabel}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 min-h-0 flex-1 overflow-hidden">
        <SectionTitle>Tasks</SectionTitle>
        <div className="space-y-1 overflow-y-auto pr-0.5">
          {tasks.map((task) => (
            <div key={task.id} className="group rounded-md px-2 py-1.5 hover:bg-[#232323]">
              <div className="flex items-start gap-1.5">
                <button
                  className="mt-0.5 text-[#7e7e7e] hover:text-[#dcdcdc]"
                  onClick={() => onCompleteTask(task.id)}
                  aria-label={`Complete ${task.title}`}
                >
                  {task.status === "Completed" ? <Check size={12} /> : <Circle size={12} />}
                </button>
                <button
                  className={cn(
                    "min-w-0 flex-1 truncate text-left text-[10.5px] text-[#b8b8b8]",
                    task.status === "Ignored" && "line-through text-[#707070]"
                  )}
                  onClick={() => onNavigate("tasks")}
                >
                  {task.title}
                </button>
                {task.status === "Ignored" ? (
                  <button
                    className="opacity-0 text-[#777] hover:text-[#ddd] group-hover:opacity-100"
                    onClick={() => onRestoreTask(task.id)}
                    aria-label={`Restore ${task.title}`}
                  >
                    <RotateCcw size={11} />
                  </button>
                ) : (
                  <button
                    className="opacity-0 text-[#777] hover:text-[#ddd] group-hover:opacity-100"
                    onClick={() => onIgnoreTask(task.id)}
                    aria-label={`Ignore ${task.title}`}
                  >
                    <X size={11} />
                  </button>
                )}
              </div>
              <div className="ml-[18px] truncate text-[9.5px] text-[#6d6d6d]">{task.status}</div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1.5 px-2 text-[10px] font-medium uppercase tracking-[0.04em] text-[#6f6f6f]">
      {children}
    </div>
  );
}
