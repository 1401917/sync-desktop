import { Check, Circle, ListChecks, RotateCcw, X } from "lucide-react";
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
  Pending: "border-[#333333] text-[#a8a8a8]",
  Ready: "border-[#3a3a3a] text-[#cfcfcf]",
  "In Progress": "border-[#3a3a3a] text-[#dcdcdc]",
  "Waiting for Approval": "border-[#4a3b1e] text-[#e6c068]",
  "Waiting for Context": "border-[#4a3b1e] text-[#e6c068]",
  Blocked: "border-[#4a2a2a] text-[#e08585]",
  Completed: "border-[#2a3f2c] text-[#7fc28a]",
  Failed: "border-[#4a2a2a] text-[#e08585]",
  Skipped: "border-[#2f2f2f] text-[#7e7e7e]",
  Ignored: "border-[#2f2f2f] text-[#7e7e7e]",
  Cancelled: "border-[#2f2f2f] text-[#7e7e7e]"
};

export function TaskPanel({
  tasks,
  onIgnoreTask,
  onRestoreTask,
  onCompleteTask
}: TaskPanelProps) {
  const progress = taskProgress(tasks);

  return (
    <section className="mx-4 mb-3 shrink-0 rounded-[12px] border border-[#262626] bg-[#1a1a1a]">
      <div className="flex h-11 items-center justify-between border-b border-[#242424] px-3.5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-[12.5px] font-medium text-[#e8e8e8]">
            <ListChecks size={14} className="text-[#9a9a9a]" />
            Active Tasks
          </div>
          <span className="text-[11.5px] text-[#7e7e7e]">
            {progress.completed} completed, {progress.waiting} waiting, {progress.ignored} ignored
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button className="task-action">Run next</button>
          <button className="task-action">Pause</button>
          <button className="task-action">Export summary</button>
        </div>
      </div>

      <div className="grid max-h-[164px] grid-cols-2 gap-2 overflow-y-auto p-2.5">
        {tasks.map((task) => (
          <div
            key={task.id}
            className={cn(
              "flex min-h-[64px] items-start gap-2.5 rounded-[10px] border border-[#272727] bg-[#202020] p-2.5",
              task.status === "Ignored" && "opacity-60"
            )}
          >
            <button
              className="mt-0.5 text-[#7e7e7e] transition hover:text-[#7fc28a]"
              onClick={() => onCompleteTask(task.id)}
              aria-label={`Complete ${task.title}`}
            >
              {task.status === "Completed" ? (
                <Check size={15} className="text-[#7fc28a]" />
              ) : (
                <Circle size={15} />
              )}
            </button>
            <div className="min-w-0 flex-1">
              <div
                className={cn(
                  "truncate text-[12.5px] font-medium text-[#ededed]",
                  task.status === "Ignored" && "line-through"
                )}
              >
                {task.title}
              </div>
              <div className="mt-0.5 truncate text-[11.5px] text-[#8a8a8a]">
                {task.description}
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10.5px]",
                    statusStyles[task.status]
                  )}
                >
                  {task.status}
                </span>
                <span className="text-[10.5px] text-[#7e7e7e]">{task.agent}</span>
              </div>
            </div>
            {task.status === "Ignored" ? (
              <button
                className="rounded-md p-1 text-[#7e7e7e] transition hover:bg-[#2a2a2a] hover:text-[#e0e0e0]"
                onClick={() => onRestoreTask(task.id)}
                aria-label={`Restore ${task.title}`}
              >
                <RotateCcw size={14} />
              </button>
            ) : (
              <button
                className="rounded-md p-1 text-[#7e7e7e] transition hover:bg-[#2a2a2a] hover:text-[#e08585]"
                onClick={() => onIgnoreTask(task.id)}
                aria-label={`Ignore ${task.title}`}
              >
                <X size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
