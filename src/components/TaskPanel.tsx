import { Check, ChevronsUp, Circle, RotateCcw, X } from "lucide-react";
import { taskProgress } from "../features/tasks/taskLogic";
import { cn } from "../lib/cn";
import type { SyncTask, TaskStatus } from "../types/domain";

interface TaskPanelProps {
  tasks: SyncTask[];
  onIgnoreTask: (taskId: string) => void;
  onRestoreTask: (taskId: string) => void;
  onCompleteTask: (taskId: string) => void;
}

const statusStyles: Record<TaskStatus, string> = {
  Pending: "border-[#2B3A4E] text-sync-secondary",
  Ready: "border-[#284362] text-[#93BAFF]",
  "In Progress": "border-[#284362] text-[#93BAFF]",
  "Waiting for Approval": "border-[#4A3B1E] text-sync-warning",
  "Waiting for Context": "border-[#4A3B1E] text-sync-warning",
  Blocked: "border-[#513135] text-sync-error",
  Completed: "border-[#1E4A38] text-sync-success",
  Failed: "border-[#513135] text-sync-error",
  Skipped: "border-[#2B3A4E] text-sync-muted",
  Ignored: "border-[#2B3A4E] text-sync-muted",
  Cancelled: "border-[#2B3A4E] text-sync-muted"
};

export function TaskPanel({
  tasks,
  onIgnoreTask,
  onRestoreTask,
  onCompleteTask
}: TaskPanelProps) {
  const progress = taskProgress(tasks);

  return (
    <section className="mx-6 mb-4 shrink-0 rounded-[18px] border border-[#1C2633] bg-[#0D131B]">
      <div className="flex h-12 items-center justify-between border-b border-[#1A2431] px-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-[#EAF2FC]">
            <ChevronsUp size={16} className="text-sync-accent" />
            Active Tasks
          </div>
          <span className="text-[12px] text-sync-muted">
            {progress.completed} completed, {progress.waiting} waiting, {progress.ignored} ignored
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button className="mini-action">Run next</button>
          <button className="mini-action">Pause</button>
          <button className="mini-action">Export summary</button>
        </div>
      </div>

      <div className="grid max-h-[168px] grid-cols-2 gap-2 overflow-y-auto p-3">
        {tasks.map((task) => (
          <div
            key={task.id}
            className={cn(
              "flex min-h-[68px] items-start gap-3 rounded-2xl border border-[#1F2B39] bg-sync-card p-3",
              task.status === "Ignored" && "opacity-60"
            )}
          >
            <button
              className="mt-0.5 text-sync-muted transition hover:text-sync-success"
              onClick={() => onCompleteTask(task.id)}
              aria-label={`Complete ${task.title}`}
            >
              {task.status === "Completed" ? (
                <Check size={16} className="text-sync-success" />
              ) : (
                <Circle size={16} />
              )}
            </button>
            <div className="min-w-0 flex-1">
              <div
                className={cn(
                  "truncate text-[13px] font-medium text-sync-text",
                  task.status === "Ignored" && "line-through"
                )}
              >
                {task.title}
              </div>
              <div className="mt-1 truncate text-[12px] text-sync-muted">{task.description}</div>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[11px]",
                    statusStyles[task.status]
                  )}
                >
                  {task.status}
                </span>
                <span className="text-[11px] text-sync-muted">{task.agent}</span>
              </div>
            </div>
            {task.status === "Ignored" ? (
              <button
                className="rounded-lg p-1.5 text-sync-muted transition hover:bg-sync-hover hover:text-sync-text"
                onClick={() => onRestoreTask(task.id)}
                aria-label={`Restore ${task.title}`}
              >
                <RotateCcw size={15} />
              </button>
            ) : (
              <button
                className="rounded-lg p-1.5 text-sync-muted transition hover:bg-sync-hover hover:text-sync-error"
                onClick={() => onIgnoreTask(task.id)}
                aria-label={`Ignore ${task.title}`}
              >
                <X size={15} />
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
