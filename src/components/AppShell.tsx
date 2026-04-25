import type {
  BootstrapPayload,
  ModelProviderSummary,
  NavKey,
  ProjectFileEntry,
  ProjectOpenResult,
  ProjectSummary,
  SyncTask
} from "../types/domain";
import { Sidebar } from "./Sidebar";
import { TaskPanel } from "./TaskPanel";
import { TopBar } from "./TopBar";
import { WorkspaceCanvas } from "./WorkspaceCanvas";

interface AppShellProps {
  payload: BootstrapPayload;
  activeView: NavKey;
  selectedProject: ProjectSummary;
  tasks: SyncTask[];
  projectFiles: ProjectFileEntry[];
  prompt: string;
  hasActiveSession: boolean;
  hasOpenedProject: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  onPromptChange: (value: string) => void;
  onNavigate: (view: NavKey) => void;
  onBack: () => void;
  onForward: () => void;
  onProjectOpened: (result: ProjectOpenResult) => void;
  onTasksGenerated: (tasks: SyncTask[]) => void;
  onProviderUpdated: (provider: ModelProviderSummary) => void;
  onIgnoreTask: (taskId: string) => void;
  onRestoreTask: (taskId: string) => void;
  onCompleteTask: (taskId: string) => void;
}

export function AppShell({
  payload,
  activeView,
  selectedProject,
  tasks,
  projectFiles,
  prompt,
  hasActiveSession,
  hasOpenedProject,
  canGoBack,
  canGoForward,
  onPromptChange,
  onNavigate,
  onBack,
  onForward,
  onProjectOpened,
  onTasksGenerated,
  onProviderUpdated,
  onIgnoreTask,
  onRestoreTask,
  onCompleteTask
}: AppShellProps) {
  // Tasks live alongside the chat, so the panel only makes sense on the
  // session view, not on Plugins, MCP, GitHub, History, etc.
  const showTaskPanel =
    hasActiveSession &&
    tasks.length > 0 &&
    (activeView === "session" || activeView === "tasks");

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#141414] text-sync-text">
      <div className="flex h-full min-h-0 overflow-hidden rounded-[10px] border border-[#252525] bg-[#1b1b1b] shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar
            payload={payload}
            canGoBack={canGoBack}
            canGoForward={canGoForward}
            onBack={onBack}
            onForward={onForward}
          />
          <div className="flex min-h-0 flex-1 bg-[#171717]">
            <Sidebar
              activeView={activeView}
              onNavigate={onNavigate}
              projects={payload.recentProjects}
              selectedProjectId={selectedProject?.id}
            />
            <div className="flex min-w-0 flex-1 flex-col">
              <WorkspaceCanvas
                activeView={activeView}
                selectedProject={selectedProject}
                payload={payload}
                tasks={tasks}
                projectFiles={projectFiles}
                prompt={prompt}
                hasOpenedProject={hasOpenedProject}
                onPromptChange={onPromptChange}
                onProjectOpened={onProjectOpened}
                onTasksGenerated={onTasksGenerated}
                onProviderUpdated={onProviderUpdated}
              />
              {showTaskPanel ? (
                <TaskPanel
                  tasks={tasks}
                  onIgnoreTask={onIgnoreTask}
                  onRestoreTask={onRestoreTask}
                  onCompleteTask={onCompleteTask}
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
