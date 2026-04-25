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
  const [activeView, setActiveView] = useState<NavKey>("projects");
  const [tasks, setTasks] = useState<SyncTask[]>([]);
  const [projectFiles, setProjectFiles] = useState<ProjectFileEntry[]>([]);
  const [prompt, setPrompt] = useState("");
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const [hasOpenedProject, setHasOpenedProject] = useState(false);

  useEffect(() => {
    let mounted = true;

    bootstrapSync().then((nextPayload) => {
      if (!mounted) return;
      setPayload(nextPayload);
    });

    return () => {
      mounted = false;
    };
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
    if (nextTasks.length > 0) {
      setHasActiveSession(true);
    }
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
      onPromptChange={setPrompt}
      onNavigate={setActiveView}
      onProjectOpened={handleProjectOpened}
      onTasksGenerated={handleTasksGenerated}
      onProviderUpdated={handleProviderUpdated}
      onIgnoreTask={handleIgnoreTask}
      onRestoreTask={handleRestoreTask}
      onCompleteTask={handleCompleteTask}
    />
  );
}
