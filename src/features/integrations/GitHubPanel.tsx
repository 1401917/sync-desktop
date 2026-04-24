import { useState } from "react";
import { ExternalLink, Github, LogIn, RefreshCcw } from "lucide-react";
import {
  checkGitHubConnection,
  listGitHubRepositories,
  loginWithGitHubCli
} from "../../lib/integrations";
import type { GitHubConnectionStatus, GitHubRepositorySummary } from "../../types/domain";

export function GitHubPanel() {
  const [status, setStatus] = useState<GitHubConnectionStatus | null>(null);
  const [repositories, setRepositories] = useState<GitHubRepositorySummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loginMessage, setLoginMessage] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);

    try {
      const nextStatus = await checkGitHubConnection();
      setStatus(nextStatus);
      setRepositories(nextStatus.connected ? await listGitHubRepositories(8) : []);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setLoading(false);
    }
  }

  async function login() {
    setLoading(true);
    setError(null);

    try {
      const result = await loginWithGitHubCli();
      setLoginMessage(`${result.status}: ${result.message}`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="integration-panel">
      <div className="integration-heading">
        <div className="integration-icon">
          <Github size={16} />
        </div>
        <div>
          <h1>GitHub</h1>
          <p>Read account status and repositories through GitHub CLI auth or a configured token.</p>
        </div>
      </div>

      <div className="flex gap-2">
        <button className="integration-primary" onClick={login} disabled={loading}>
          <LogIn size={13} />
          Login with GitHub
        </button>
        <button className="integration-primary" onClick={refresh} disabled={loading}>
          <RefreshCcw size={13} />
          {loading ? "Checking..." : "Check GitHub"}
        </button>
      </div>

      <div className="integration-card">
        <span>Status</span>
        <strong>{status?.status ?? "Not checked"}</strong>
        <p>{status?.message ?? "Login with GitHub CLI or set GITHUB_TOKEN/GH_TOKEN to connect."}</p>
      </div>

      {error ? <div className="integration-error">{error}</div> : null}
      {loginMessage ? <div className="integration-card">{loginMessage}</div> : null}

      <div className="integration-list">
        {repositories.map((repository) => (
          <a
            key={repository.fullName}
            className="integration-row"
            href={repository.htmlUrl}
            target="_blank"
            rel="noreferrer"
          >
            <div>
              <strong>{repository.fullName}</strong>
              <span>
                {repository.private ? "Private" : "Public"} · {repository.defaultBranch}
              </span>
            </div>
            <ExternalLink size={13} />
          </a>
        ))}
      </div>
    </div>
  );
}
