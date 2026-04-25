import {
  Bot,
  ChevronRight,
  FileCode2,
  FolderClosed,
  GitBranch,
  GitPullRequest,
  KeyRound,
  Library,
  ListFilter,
  Maximize2,
  MessageSquareText,
  Minimize2,
  Network,
  Plus,
  Puzzle,
  Search,
  Settings,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "../lib/cn";
import type { NavKey, ProjectSummary } from "../types/domain";

interface PrimaryItem {
  id: NavKey;
  label: string;
  icon: typeof Search;
}

const primaryItems: PrimaryItem[] = [
  { id: "home", label: "Search", icon: Search },
  { id: "connectors", label: "Plugins", icon: Puzzle },
  { id: "agents", label: "Automations", icon: Bot }
];

interface SidebarProps {
  activeView: NavKey;
  onNavigate: (view: NavKey) => void;
  projects: ProjectSummary[];
  selectedProjectId?: string;
}

export function Sidebar({
  activeView,
  onNavigate,
  projects,
  selectedProjectId
}: SidebarProps) {
  const [projectsOpen, setProjectsOpen] = useState(true);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
    () => new Set(selectedProjectId ? [selectedProjectId] : [])
  );

  const projectList = useMemo(() => projects ?? [], [projects]);

  function toggleProject(id: string) {
    setExpandedProjects((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <aside className="flex w-[232px] shrink-0 flex-col border-r border-[#1f1f1f] bg-[#161616] py-2">
      <button
        className="mx-2 mb-1 flex h-[30px] items-center gap-2.5 rounded-md px-2 text-left text-[12.5px] font-medium text-[#ededed] transition hover:bg-[#222]"
        onClick={() => onNavigate("session")}
      >
        <Sparkles size={14} className="text-[#bdbdbd]" />
        <span>New chat</span>
      </button>

      <nav className="mx-2 space-y-0.5">
        {primaryItems.map((item) => {
          const Icon = item.icon;
          const active = item.id === activeView;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                "flex h-[30px] w-full items-center gap-2.5 rounded-md px-2 text-left text-[12.5px] transition",
                active
                  ? "bg-[#222] text-[#ededed]"
                  : "text-[#a8a8a8] hover:bg-[#1e1e1e] hover:text-[#e3e3e3]"
              )}
            >
              <Icon size={14} className={active ? "text-[#ededed]" : "text-[#8a8a8a]"} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="mx-2 mt-3 flex items-center justify-between px-2">
        <button
          onClick={() => setProjectsOpen((value) => !value)}
          className="flex items-center gap-1 text-[11.5px] font-medium text-[#9a9a9a] transition hover:text-[#dcdcdc]"
        >
          <ChevronRight
            size={11}
            className={cn(
              "transition-transform",
              projectsOpen ? "rotate-90 text-[#bdbdbd]" : "text-[#7a7a7a]"
            )}
          />
          Projects
        </button>
        <div className="flex items-center gap-0.5">
          <SideIconButton
            label="Collapse all"
            onClick={() => setExpandedProjects(new Set())}
            icon={projectsOpen ? Minimize2 : Maximize2}
          />
          <SideIconButton
            label="Filter"
            onClick={() => onNavigate("home")}
            icon={ListFilter}
          />
          <SideIconButton
            label="New project"
            onClick={() => onNavigate("projects")}
            icon={Plus}
          />
        </div>
      </div>

      {projectsOpen ? (
        <div className="mt-1 min-h-0 flex-1 overflow-y-auto px-2">
          {projectList.length === 0 ? (
            <div className="px-2 py-3 text-[11px] text-[#6e6e6e]">
              No projects yet.
            </div>
          ) : (
            <ul className="space-y-0.5">
              {projectList.map((project) => {
                const expanded = expandedProjects.has(project.id);
                const selected = project.id === selectedProjectId;
                return (
                  <li key={project.id}>
                    <button
                      onClick={() => {
                        toggleProject(project.id);
                        onNavigate("projects");
                      }}
                      className={cn(
                        "flex h-[28px] w-full items-center gap-2 rounded-md px-2 text-left text-[12px] transition",
                        selected
                          ? "bg-[#222] text-[#ededed]"
                          : "text-[#b3b3b3] hover:bg-[#1e1e1e] hover:text-[#e3e3e3]"
                      )}
                    >
                      <FolderClosed size={13} className="shrink-0 text-[#8a8a8a]" />
                      <span className="truncate">{project.name}</span>
                    </button>
                    {expanded ? (
                      <ul className="mb-1 ml-3 mt-0.5 space-y-0.5 border-l border-[#262626] pl-2">
                        <li>
                          <button
                            onClick={() => onNavigate("session")}
                            className="flex h-[26px] w-full items-center gap-2 rounded-md px-2 text-left text-[11.5px] text-[#9a9a9a] transition hover:bg-[#1e1e1e] hover:text-[#dcdcdc]"
                          >
                            <MessageSquareText size={11} className="text-[#7a7a7a]" />
                            <span className="truncate">Current session</span>
                          </button>
                        </li>
                        <li>
                          <button
                            onClick={() => onNavigate("history")}
                            className="flex h-[26px] w-full items-center gap-2 rounded-md px-2 text-left text-[11.5px] text-[#9a9a9a] transition hover:bg-[#1e1e1e] hover:text-[#dcdcdc]"
                          >
                            <Library size={11} className="text-[#7a7a7a]" />
                            <span className="truncate">History</span>
                          </button>
                        </li>
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : (
        <div className="flex-1" />
      )}

      <div className="mx-2 mt-2 border-t border-[#1f1f1f] pt-2">
        <SecondaryNav activeView={activeView} onNavigate={onNavigate} />
        <button
          onClick={() => onNavigate("settings")}
          className={cn(
            "mt-1 flex h-[30px] w-full items-center gap-2.5 rounded-md px-2 text-left text-[12.5px] transition",
            activeView === "settings"
              ? "bg-[#222] text-[#ededed]"
              : "text-[#a8a8a8] hover:bg-[#1e1e1e] hover:text-[#e3e3e3]"
          )}
        >
          <Settings
            size={14}
            className={activeView === "settings" ? "text-[#ededed]" : "text-[#8a8a8a]"}
          />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  );
}

function SideIconButton({
  label,
  onClick,
  icon: Icon
}: {
  label: string;
  onClick: () => void;
  icon: typeof Search;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid h-[20px] w-[20px] place-items-center rounded text-[#7a7a7a] transition hover:bg-[#222] hover:text-[#dcdcdc]"
    >
      <Icon size={11} />
    </button>
  );
}

const secondaryItems: Array<{ id: NavKey; label: string; icon: typeof FileCode2 }> = [
  { id: "files", label: "Files", icon: FileCode2 },
  { id: "diffs", label: "Diff", icon: GitPullRequest },
  { id: "prompts", label: "Prompts", icon: Library },
  { id: "github", label: "GitHub", icon: GitBranch },
  { id: "mcp", label: "MCP", icon: Network },
  { id: "permissions", label: "Security", icon: ShieldCheck },
  { id: "models", label: "Models", icon: KeyRound }
];

function SecondaryNav({
  activeView,
  onNavigate
}: {
  activeView: NavKey;
  onNavigate: (view: NavKey) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-0.5">
      <button
        onClick={() => setOpen((value) => !value)}
        className="flex h-[28px] w-full items-center gap-2 rounded-md px-2 text-left text-[11.5px] font-medium text-[#9a9a9a] transition hover:bg-[#1e1e1e] hover:text-[#dcdcdc]"
      >
        <ChevronRight
          size={11}
          className={cn(
            "transition-transform",
            open ? "rotate-90 text-[#bdbdbd]" : "text-[#7a7a7a]"
          )}
        />
        Tools
      </button>
      {open
        ? secondaryItems.map((item) => {
            const Icon = item.icon;
            const active = item.id === activeView;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={cn(
                  "flex h-[26px] w-full items-center gap-2.5 rounded-md pl-6 pr-2 text-left text-[12px] transition",
                  active
                    ? "bg-[#222] text-[#ededed]"
                    : "text-[#9a9a9a] hover:bg-[#1e1e1e] hover:text-[#dcdcdc]"
                )}
              >
                <Icon size={12} className={active ? "text-[#ededed]" : "text-[#7e7e7e]"} />
                <span>{item.label}</span>
              </button>
            );
          })
        : null}
    </div>
  );
}
