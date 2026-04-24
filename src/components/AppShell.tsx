import type { BootstrapPayload, NavKey, ProjectSummary, SyncTask } from "../types/domain";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { WorkspaceCanvas } from "./WorkspaceCanvas";

interface AppShellProps {
  payload: BootstrapPayload;
  activeView: NavKey;
  selectedProject: ProjectSummary;
  tasks: SyncTask[];
  prompt: string;
  onPromptChange: (value: string) => void;
  onNavigate: (view: NavKey) => void;
}

export function AppShell({
  payload,
  activeView,
  selectedProject,
  tasks,
  prompt,
  onPromptChange,
  onNavigate
}: AppShellProps) {
  return (
    <div className="h-screen w-screen overflow-hidden bg-[#070707] text-sync-text">
      <div className="flex h-full min-h-0 overflow-hidden rounded-[10px] border border-[#252525] bg-[#1f1f1f] shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar payload={payload} />
          <div className="flex min-h-0 flex-1 bg-[#202020]">
            <Sidebar
              activeView={activeView}
              onNavigate={onNavigate}
            />
            <WorkspaceCanvas
              activeView={activeView}
              selectedProject={selectedProject}
              payload={payload}
              tasks={tasks}
              prompt={prompt}
              onPromptChange={onPromptChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
