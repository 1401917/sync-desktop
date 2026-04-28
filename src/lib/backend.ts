import { invoke } from "@tauri-apps/api/core";
import { demoPayload } from "./seed";
import type {
  AiSubmissionResult,
  LoadedChat,
  BootstrapPayload,
  FilePreview,
  ProjectFileEntry,
  ProjectOpenResult,
  ProviderSecretResult,
  SyncTask,
  TaskMutationResult,
  TaskStatus
} from "../types/domain";

export function isTauriRuntime() {
  return Boolean(window.__TAURI_INTERNALS__);
}

export async function bootstrapSync(): Promise<BootstrapPayload> {
  if (!isTauriRuntime()) {
    return demoPayload;
  }
  try {
    return await invoke<BootstrapPayload>("bootstrap");
  } catch (error) {
    console.warn("Falling back to demo bootstrap payload.", error);
    return demoPayload;
  }
}

export async function openProjectFolder(root: string): Promise<ProjectOpenResult> {
  if (!isTauriRuntime()) {
    throw new Error("Project folders can only be opened in the Sync desktop app.");
  }
  return invoke<ProjectOpenResult>("open_project_folder", { root });
}

export async function listProjectFiles(projectId: string): Promise<ProjectFileEntry[]> {
  if (!isTauriRuntime()) return [];
  return invoke<ProjectFileEntry[]>("list_project_files", { projectId });
}

export async function previewProjectFile(
  projectId: string,
  relativePath: string
): Promise<FilePreview> {
  if (!isTauriRuntime()) {
    return {
      path: relativePath,
      relativePath,
      language: "Plain Text",
      sensitive: false,
      binary: false,
      content: null,
      message: "File preview is available in the Sync desktop app."
    };
  }
  return invoke<FilePreview>("preview_project_file", { projectId, relativePath });
}

export async function persistTaskStatus(
  taskId: string,
  status: TaskStatus,
  reason?: string
): Promise<TaskMutationResult | null> {
  if (!isTauriRuntime()) return null;
  return invoke<TaskMutationResult>("update_task_status", {
    taskId,
    status,
    reason: reason ?? null
  });
}

export async function writeTextFileAtPath(path: string, content: string): Promise<string> {
  if (!isTauriRuntime()) {
    throw new Error("Saving files is only available in the Sync desktop app.");
  }
  return invoke<string>("write_text_file_at_path", { path, content });
}

export interface TerminalCommandResult {
  command: string;
  cwd: string;
  exitCode: number;
  stdout: string;
  stderr: string;
}

export async function runTerminalCommand(
  command: string,
  cwd?: string | null
): Promise<TerminalCommandResult> {
  if (!isTauriRuntime()) {
    throw new Error("Terminal commands run only inside the Sync desktop app.");
  }
  return invoke<TerminalCommandResult>("run_terminal_command", { command, cwd: cwd ?? null });
}

// ---------------------------------------------------------------------------
// Tool-calling primitives. The AI's eventual function-calling loop will
// dispatch to these same Tauri commands. They are also exposed directly to
// the frontend so a user can inspect / edit / patch through the UI today.
// ---------------------------------------------------------------------------

export interface DirectoryEntry {
  name: string;
  relativePath: string;
  isDirectory: boolean;
  isFile: boolean;
  sizeBytes: number;
}

export interface FileToolResult {
  path: string;
  relativePath: string;
  bytes: number;
  linesAdded: number;
  linesRemoved: number;
  linesModified: number;
  truncated: boolean;
  content: string | null;
}

function ensureProject(projectRoot: string | null | undefined): string {
  if (!projectRoot) {
    throw new Error("Open a project folder first — this tool needs a project root.");
  }
  return projectRoot;
}

export async function readFileTool(
  projectRoot: string | null | undefined,
  relativePath: string
): Promise<FileToolResult> {
  if (!isTauriRuntime()) throw new Error("File tools require the Sync desktop app.");
  return invoke<FileToolResult>("read_file_tool", {
    projectRoot: ensureProject(projectRoot),
    relativePath
  });
}

export async function listDirectoryTool(
  projectRoot: string | null | undefined,
  relativePath = ""
): Promise<DirectoryEntry[]> {
  if (!isTauriRuntime()) throw new Error("File tools require the Sync desktop app.");
  return invoke<DirectoryEntry[]>("list_directory_tool", {
    projectRoot: ensureProject(projectRoot),
    relativePath
  });
}

export async function writeFileTool(
  projectRoot: string | null | undefined,
  relativePath: string,
  content: string
): Promise<FileToolResult> {
  if (!isTauriRuntime()) throw new Error("File tools require the Sync desktop app.");
  return invoke<FileToolResult>("write_file_tool", {
    projectRoot: ensureProject(projectRoot),
    relativePath,
    content
  });
}

export async function applyPatchTool(
  projectRoot: string | null | undefined,
  relativePath: string,
  search: string,
  replace: string
): Promise<FileToolResult> {
  if (!isTauriRuntime()) throw new Error("File tools require the Sync desktop app.");
  return invoke<FileToolResult>("apply_patch_tool", {
    projectRoot: ensureProject(projectRoot),
    relativePath,
    search,
    replace
  });
}

export async function deleteFileTool(
  projectRoot: string | null | undefined,
  relativePath: string
): Promise<FileToolResult> {
  if (!isTauriRuntime()) throw new Error("File tools require the Sync desktop app.");
  return invoke<FileToolResult>("delete_file_tool", {
    projectRoot: ensureProject(projectRoot),
    relativePath
  });
}

export async function saveProviderKeyMetadata(
  providerId: string,
  key: string
): Promise<ProviderSecretResult> {
  if (!isTauriRuntime()) {
    throw new Error("Provider key metadata can only be saved in the Sync desktop app.");
  }
  return invoke<ProviderSecretResult>("save_provider_key_metadata", { providerId, key });
}

export type ChatHistoryEntry = ["user" | "assistant", string];

export async function submitAiPrompt(
  prompt: string,
  history: ChatHistoryEntry[] = [],
  projectId?: string | null
): Promise<AiSubmissionResult> {
  if (!isTauriRuntime()) {
    return {
      sessionId: "browser-preview",
      userMessageId: "browser-user",
      assistantMessageId: "browser-assistant",
      taskListId: "browser-task-list",
      tasks: demoPayload.activeTasks as SyncTask[],
      assistantMessage:
        "Browser preview cannot call the Sync native AI workflow. Run the desktop app to persist sessions and tasks.",
      providerStatus: "Desktop only",
      historyEvent: demoPayload.history[0]
    };
  }
  return invoke<AiSubmissionResult>("submit_ai_prompt", {
    prompt,
    history,
    projectId: projectId ?? null
  });
}

export async function loadLatestChat(): Promise<LoadedChat | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  return invoke<LoadedChat | null>("load_latest_chat");
}

export async function dryRunApplyArtifacts(
  sessionId: string,
  projectId: string
): Promise<import("../types/diffPlan").DiffPlanOp[]> {
  if (!isTauriRuntime()) {
    return [];
  }
  return invoke<import("../types/diffPlan").DiffPlanOp[]>("dry_run_apply_artifacts", {
    sessionId,
    projectId,
  });
}

export async function applyApprovedArtifacts(
  projectId: string,
  sessionId: string,
  approvedOps: import("../types/diffPlan").ApprovedOp[]
): Promise<import("../types/diffPlan").ApplyResult> {
  if (!isTauriRuntime()) {
    return { applied: [], errors: [], blocked: [] };
  }
  return invoke<import("../types/diffPlan").ApplyResult>("apply_approved_artifacts", {
    projectId,
    sessionId,
    approvedOps,
  });
}
