import { describe, expect, it } from "vitest";
import { ignoreTask, restoreTask, taskProgress, updateTaskStatus } from "../../src/features/tasks/taskLogic";
import type { SyncTask } from "../../src/types/domain";

const tasks: SyncTask[] = [
  {
    id: "one",
    title: "Scan project",
    description: "Read safe metadata",
    status: "Pending",
    priority: "High",
    risk: "Safe",
    agent: "Planner Agent",
    related: "Project"
  },
  {
    id: "two",
    title: "Apply patch",
    description: "Requires approval",
    status: "Waiting for Approval",
    priority: "High",
    risk: "Medium",
    agent: "Coder Agent",
    related: "Diff"
  }
];

describe("task workflow helpers", () => {
  it("marks a task ignored without removing it", () => {
    const nextTasks = ignoreTask(tasks, "one", "User excluded this step");

    expect(nextTasks).toHaveLength(2);
    expect(nextTasks[0]).toMatchObject({
      status: "Ignored",
      ignoredReason: "User excluded this step"
    });
  });

  it("restores ignored tasks to pending", () => {
    const ignored = ignoreTask(tasks, "one");
    const restored = restoreTask(ignored, "one");

    expect(restored[0].status).toBe("Pending");
    expect(restored[0].ignoredReason).toBeUndefined();
  });

  it("updates status while clearing ignored reason", () => {
    const ignored = ignoreTask(tasks, "one");
    const completed = updateTaskStatus(ignored, "one", "Completed");

    expect(completed[0].status).toBe("Completed");
    expect(completed[0].ignoredReason).toBeUndefined();
  });

  it("summarizes progress counters", () => {
    const nextTasks = updateTaskStatus(tasks, "one", "Completed");
    const progress = taskProgress(nextTasks);

    expect(progress.completed).toBe(1);
    expect(progress.waiting).toBe(1);
    expect(progress.ignored).toBe(0);
  });
});
