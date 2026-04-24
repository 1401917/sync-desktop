import { useEffect, useMemo, useState } from "react";
import { AppShell } from "./components/AppShell";
import { bootstrapSync } from "./lib/backend";
import { demoPayload } from "./lib/seed";
import type { BootstrapPayload, NavKey, SyncTask } from "./types/domain";
import { ignoreTask, restoreTask, updateTaskStatus } from "./features/tasks/taskLogic";

export default function App() {
  const [payload, setPayload] = useState<BootstrapPayload>(demoPayload);
  const [activeView, setActiveView] = useState<NavKey>("projects");
  const [tasks, setTasks] = useState<SyncTask[]>(demoPayload.activeTasks);
  const [prompt, setPrompt] = useState("");

  useEffect(() => {
    let mounted = true;

    bootstrapSync().then((nextPayload) => {
      if (!mounted) {
        return;
      }

      setPayload(nextPayload);
      setTasks(nextPayload.activeTasks);
    });

    return () => {
      mounted = false;
    };
  }, []);

  const selectedProject = useMemo(
    () => payload.recentProjects.find((project) => project.selected) ?? payload.recentProjects[0],
    [payload.recentProjects]
  );

  return (
    <AppShell
      payload={payload}
      activeView={activeView}
      selectedProject={selectedProject}
      tasks={tasks}
      prompt={prompt}
      onPromptChange={setPrompt}
      onNavigate={setActiveView}
      onIgnoreTask={(taskId) =>
        setTasks((currentTasks) => ignoreTask(currentTasks, taskId, "Excluded by user"))
      }
      onRestoreTask={(taskId) => setTasks((currentTasks) => restoreTask(currentTasks, taskId))}
      onCompleteTask={(taskId) =>
        setTasks((currentTasks) => updateTaskStatus(currentTasks, taskId, "Completed"))
      }
    />
  );
}
