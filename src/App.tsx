import { useEffect, useMemo, useState } from "react";
import { AppShell } from "./components/AppShell";
import { ignoreTask, restoreTask, updateTaskStatus } from "./features/tasks/taskLogic";
import { bootstrapSync, persistTaskStatus } from "./lib/backend";
import { demoPayload } from "./lib/seed";
import type {
  BootstrapPayload,
  ModelProviderSummary,
  NavKey,
  ProjectFileEntry,
  ProjectOpenResult,
  SyncTask
} from "./types/domain";

export default function App() {
  const [payload, setPayload] = useState<BootstrapPayload>(demoPayload);
  const [viewHistory, setViewHistory] = useState<NavKey[]>(["projects"]);
  const [viewIndex, setViewIndex] = useState(0);
  const activeView = viewHistory[viewIndex] ?? "projects";
  const [tasks, setTasks] = useState<SyncTask[]>([]);
  const [projectFiles, setProjectFiles] = useState<ProjectFileEntry[]>([]);
  const [prompt, setPrompt] = useState("");
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const [hasOpenedProject, setHasOpenedProject] = useState(false);

  function navigate(view: NavKey) {
    setViewHistory((current) => {
      const truncated = current.slice(0, viewIndex + 1);
      if (truncated[truncated.length - 1] === view) return truncated;
      return [...truncated, view];
    });
    setViewIndex((current) => current + 1);
  }

  function goBack() {
    setViewIndex((current) => Math.max(0, current - 1));
  }

  function goForward() {
    setViewIndex((current) => Math.min(viewHistory.length - 1, current + 1));
  }

  const canGoBack = viewIndex > 0;
  const canGoForward = viewIndex < viewHistory.length - 1;

  useEffect(() => {
    let mounted = true;
    bootstrapSync().then((nextPayload) => {
      if (!mounted) return;
      setPayload(nextPayload);
    });
    return () => { mounted = false; };
  }, []);

  const selectedProject = useMemo(
    () => payload.recentProjects.find((p) => p.selected) ?? payload.recentProjects[0],
    [payload.recentProjects]
  );

  function handleProjectOpened(result: ProjectOpenResult) {
    setHasOpenedProject(true);
    setProjectFiles(result.files);
    setPayload((current) => ({
      ...current,
      recentProjects: [
        { ...result.project, selected: true },
        ...current.recentProjects
          .filter((project) => project.id !== result.project.id)
          .map((project) => ({ ...project, selected: false }))
      ],
      history: [result.historyEvent, ...current.history].slice(0, 10)
    }));
  }

  function handleTasksGenerated(nextTasks: SyncTask[]) {
    if (nextTasks.length > 0) setHasActiveSession(true);
    setTasks((currentTasks) => {
      const existing = new Set(currentTasks.map((task) => task.id));
      return [...nextTasks.filter((task) => !existing.has(task.id)), ...currentTasks];
    });
  }

  function handleProviderUpdated(provider: ModelProviderSummary) {
    setPayload((current) => ({
      ...current,
      modelProviders: current.modelProviders.map((item) =>
        item.id === provider.id ? provider : item
      )
    }));
  }

  function handleIgnoreTask(taskId: string) {
    setTasks((currentTasks) => ignoreTask(currentTasks, taskId, "Excluded by user"));
    persistTaskStatus(taskId, "Ignored", "Excluded by user").catch(console.warn);
  }

  function handleRestoreTask(taskId: string) {
    setTasks((currentTasks) => restoreTask(currentTasks, taskId));
    persistTaskStatus(taskId, "Pending").catch(console.warn);
  }

  function handleCompleteTask(taskId: string) {
    setTasks((currentTasks) => updateTaskStatus(currentTasks, taskId, "Completed"));
    persistTaskStatus(taskId, "Completed").catch(console.warn);
  }

  return (
    <AppShell
      payload={payload}
      activeView={activeView}
      selectedProject={selectedProject}
      tasks={tasks}
      projectFiles={projectFiles}
      prompt={prompt}
      hasActiveSession={hasActiveSession}
      hasOpenedProject={hasOpenedProject}
      canGoBack={canGoBack}
      canGoForward={canGoForward}
      onPromptChange={setPrompt}
      onNavigate={navigate}
      onBack={goBack}
      onForward={goForward}
      onProjectOpened={handleProjectOpened}
      onTasksGenerated={handleTasksGenerated}
      onProviderUpdated={handleProviderUpdated}
      onIgnoreTask={handleIgnoreTask}
      onRestoreTask={handleRestoreTask}
      onCompleteTask={handleCompleteTask}
    />
  );
}
