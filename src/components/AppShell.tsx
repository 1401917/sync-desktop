import type { ReactNode } from "react";
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
  sidebarOpen: boolean;
  bottomPanel?: ReactNode;
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
  onComposerRef: (focusFn: () => void) => void;
  onOpenCommandPalette: () => void;
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
  sidebarOpen,
  bottomPanel,
  onPromptChange,
  onNavigate,
  onBack,
  onForward,
  onProjectOpened,
  onTasksGenerated,
  onProviderUpdated,
  onIgnoreTask,
  onRestoreTask,
  onCompleteTask,
  onComposerRef,
  onOpenCommandPalette
}: AppShellProps) {
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
            onOpenCommandPalette={onOpenCommandPalette}
          />
          <div className="flex min-h-0 flex-1 bg-[#171717]">
            {sidebarOpen ? (
              <Sidebar
                activeView={activeView}
                onNavigate={onNavigate}
                projects={payload.recentProjects}
                selectedProjectId={selectedProject?.id}
              />
            ) : null}
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
                onComposerRef={onComposerRef}
              />
              {showTaskPanel ? (
                <TaskPanel
                  tasks={tasks}
                  onIgnoreTask={onIgnoreTask}
                  onRestoreTask={onRestoreTask}
                  onCompleteTask={onCompleteTask}
                />
              ) : null}
              {bottomPanel}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
