import { invoke } from "@tauri-apps/api/core";
import type {
  GitHubConnectionStatus,
  GitHubLoginResult,
  GitHubRepositorySummary,
  McpConnectionTest
} from "../types/domain";

function isTauriRuntime() {
  return Boolean(window.__TAURI_INTERNALS__);
}

export async function checkGitHubConnection(): Promise<GitHubConnectionStatus> {
  if (!isTauriRuntime()) {
    return {
      connected: false,
      status: "Desktop only",
      username: null,
      message: "GitHub checks run inside the Sync desktop app."
    };
  }

  return invoke<GitHubConnectionStatus>("github_connection_status");
}

export async function listGitHubRepositories(limit = 8): Promise<GitHubRepositorySummary[]> {
  if (!isTauriRuntime()) {
    return [];
  }

  return invoke<GitHubRepositorySummary[]>("github_list_repositories", { limit });
}

export async function loginWithGitHubCli(): Promise<GitHubLoginResult> {
  if (!isTauriRuntime()) {
    return {
      started: false,
      status: "Desktop only",
      message: "GitHub login starts from the Sync desktop app."
    };
  }

  return invoke<GitHubLoginResult>("github_login_with_cli");
}

export async function startGitHubOAuth(): Promise<GitHubLoginResult> {
  if (!isTauriRuntime()) {
    return {
      started: false,
      status: "Desktop only",
      message: "GitHub OAuth starts from the Sync desktop app."
    };
  }

  return invoke<GitHubLoginResult>("github_start_oauth");
}

export async function openUrl(url: string): Promise<void> {
  if (!isTauriRuntime()) {
    window.open(url, "_blank");
    return;
  }
  await invoke("open_url", { url });
}

export async function testMcpConnection(target: string): Promise<McpConnectionTest> {
  if (!isTauriRuntime()) {
    return {
      target,
      reachable: false,
      status: "Desktop only",
      message: "MCP checks run inside the Sync desktop app."
    };
  }

  return invoke<McpConnectionTest>("mcp_test_connection", { target });
}
