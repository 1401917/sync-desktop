import { useState } from "react";
import { ExternalLink, Github, RefreshCcw } from "lucide-react";
import { checkGitHubConnection, listGitHubRepositories } from "../../lib/integrations";
import type { GitHubConnectionStatus, GitHubRepositorySummary } from "../../types/domain";

export function GitHubPanel() {
  const [status, setStatus] = useState<GitHubConnectionStatus | null>(null);
  const [repositories, setRepositories] = useState<GitHubRepositorySummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="integration-panel">
      <div className="integration-heading">
        <div className="integration-icon">
          <Github size={16} />
        </div>
        <div>
          <h1>GitHub</h1>
          <p>Read account status and repositories through the GitHub API when a token is available.</p>
        </div>
      </div>

      <button className="integration-primary" onClick={refresh} disabled={loading}>
        <RefreshCcw size={13} />
        {loading ? "Checking..." : "Check GitHub"}
      </button>

      <div className="integration-card">
        <span>Status</span>
        <strong>{status?.status ?? "Not checked"}</strong>
        <p>{status?.message ?? "Set GITHUB_TOKEN or GH_TOKEN before launching Sync to connect."}</p>
      </div>

      {error ? <div className="integration-error">{error}</div> : null}

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
