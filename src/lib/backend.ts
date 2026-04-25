import { invoke } from "@tauri-apps/api/core";
import { demoPayload } from "./seed";
import type {
  AiSubmissionResult,
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
  history: ChatHistoryEntry[] = []
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
  return invoke<AiSubmissionResult>("submit_ai_prompt", { prompt, history });
}
