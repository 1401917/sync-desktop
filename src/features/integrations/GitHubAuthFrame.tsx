import { useState } from "react";
import { Github, LogIn, RefreshCcw, X } from "lucide-react";
import {
  checkGitHubConnection,
  loginWithGitHubCli
} from "../../lib/integrations";
import type { GitHubConnectionStatus } from "../../types/domain";

interface GitHubAuthFrameProps {
  intent: string;
  onClose: () => void;
}

export function GitHubAuthFrame({ intent, onClose }: GitHubAuthFrameProps) {
  const [status, setStatus] = useState<GitHubConnectionStatus | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function login() {
    setLoading(true);
    setMessage(null);

    try {
      const result = await loginWithGitHubCli();
      setMessage(result.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    setLoading(true);
    setMessage(null);

    try {
      setStatus(await checkGitHubConnection());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-black/35 px-6 backdrop-blur-[2px]">
      <section className="w-[min(440px,calc(100vw-72px))] rounded-xl border border-[#383838] bg-[#242424] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.62)]">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#3a3a3a] bg-[#1f1f1f] text-[#ededed]">
              <Github size={17} />
            </div>
            <div>
              <h2 className="text-[13px] font-medium text-[#f0f0f0]">GitHub account required</h2>
              <p className="mt-1 text-[11px] leading-5 text-[#9a9a9a]">
                Sync detected a GitHub action in this request. Remote actions such as creating
                repositories, pushing branches, pull requests, and issues need an authenticated
                GitHub account.
              </p>
            </div>
          </div>

          <button className="composer-icon" onClick={onClose} aria-label="Close GitHub sign in">
            <X size={13} />
          </button>
        </div>

        <div className="mt-3 rounded-lg border border-[#333] bg-[#202020] p-3 text-[10.5px] leading-5 text-[#9a9a9a]">
          <span className="block text-[10px] text-[#777]">Requested action</span>
          <strong className="mt-1 block truncate text-[11px] font-medium text-[#e8e8e8]">
            {intent}
          </strong>
        </div>

        {status ? (
          <div className="mt-3 rounded-lg border border-[#333] bg-[#202020] p-3 text-[10.5px] leading-5 text-[#9a9a9a]">
            <span className="block text-[10px] text-[#777]">Status</span>
            <strong className="mt-1 block text-[11px] font-medium text-[#e8e8e8]">
              {status.status}
            </strong>
            <p className="mt-1">{status.message}</p>
          </div>
        ) : null}

        {message ? (
          <div className="mt-3 rounded-lg border border-[#333] bg-[#202020] p-3 text-[10.5px] leading-5 text-[#9a9a9a]">
            {message}
          </div>
        ) : null}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button className="mini-action" onClick={onClose}>
            Local Git only
          </button>
          <button className="integration-primary mb-0" onClick={refresh} disabled={loading}>
            <RefreshCcw size={13} />
            Check
          </button>
          <button className="integration-primary mb-0" onClick={login} disabled={loading}>
            <LogIn size={13} />
            Login
          </button>
        </div>
      </section>
    </div>
  );
}
