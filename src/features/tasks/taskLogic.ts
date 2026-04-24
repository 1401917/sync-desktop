import type { SyncTask, TaskStatus } from "../../types/domain";

export function updateTaskStatus(
  tasks: SyncTask[],
  taskId: string,
  status: TaskStatus
): SyncTask[] {
  return tasks.map((task) =>
    task.id === taskId
      ? {
          ...task,
          status,
          ignoredReason: status === "Ignored" ? task.ignoredReason : undefined
        }
      : task
  );
}

export function ignoreTask(tasks: SyncTask[], taskId: string, reason = "Ignored"): SyncTask[] {
  return tasks.map((task) =>
    task.id === taskId
      ? {
          ...task,
          status: "Ignored",
          ignoredReason: reason
        }
      : task
  );
}

export function restoreTask(tasks: SyncTask[], taskId: string): SyncTask[] {
  return tasks.map((task) =>
    task.id === taskId
      ? {
          ...task,
          status: "Pending",
          ignoredReason: undefined
        }
      : task
  );
}

export function taskProgress(tasks: SyncTask[]) {
  return tasks.reduce(
    (progress, task) => {
      if (task.status === "Completed") {
        progress.completed += 1;
      }

      if (task.status === "Waiting for Approval" || task.status === "Waiting for Context") {
        progress.waiting += 1;
      }

      if (task.status === "Ignored") {
        progress.ignored += 1;
      }

      if (task.status === "Failed" || task.status === "Blocked") {
        progress.needsAttention += 1;
      }

      return progress;
    },
    {
      completed: 0,
      waiting: 0,
      ignored: 0,
      needsAttention: 0
    }
  );
}
