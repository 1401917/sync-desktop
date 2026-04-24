import {
  Cloud,
  FileCode2,
  GitBranch,
  Paperclip,
  Send,
  SlidersHorizontal,
  TerminalSquare
} from "lucide-react";
import { useState } from "react";
import { GitHubAuthFrame } from "../features/integrations/GitHubAuthFrame";
import type { BootstrapPayload, NavKey, ProjectSummary, SyncTask } from "../types/domain";
import { ScreenPlaceholder } from "./ScreenPlaceholder";

interface WorkspaceCanvasProps {
  activeView: NavKey;
  selectedProject: ProjectSummary;
  payload: BootstrapPayload;
  tasks: SyncTask[];
  prompt: string;
  onPromptChange: (value: string) => void;
}

export function WorkspaceCanvas({
  activeView,
  selectedProject,
  payload,
  tasks,
  prompt,
  onPromptChange
}: WorkspaceCanvasProps) {
  const [githubIntent, setGithubIntent] = useState<string | null>(null);

  function submitPrompt() {
    const trimmedPrompt = prompt.trim();

    if (!trimmedPrompt) {
      return;
    }

    if (requiresGitHubAccount(trimmedPrompt)) {
      setGithubIntent(trimmedPrompt);
      return;
    }
  }

  return (
    <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#171717]">
      {activeView === "projects" ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-8">
          <div className="mb-8 flex items-center gap-2 rounded-full border border-[#2f2f2f] bg-[#202020] px-3 py-1.5 text-[11px] text-[#8d8d8d]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#34c759]" />
            {payload.securityMode}
          </div>

          <h1 className="text-[25px] font-medium tracking-[-0.01em] text-[#f2f2f2]">
            What should we build in Sync?
          </h1>

          <PromptComposer
            prompt={prompt}
            onPromptChange={onPromptChange}
            onSubmit={submitPrompt}
          />

          <div className="mt-5 w-[min(680px,calc(100%-48px))] space-y-1">
            <PromptHint icon={GitBranch} label="Prepare a GitHub repo, branch, and guarded push plan" />
            <PromptHint icon={TerminalSquare} label="Review local changes and create an approval-gated task list" />
            <PromptHint icon={Cloud} label="Connect MCP or external services only after permission review" />
          </div>
        </div>
      ) : (
        <ScreenPlaceholder
          activeView={activeView}
          payload={payload}
          selectedProject={selectedProject}
          tasks={tasks}
        />
      )}

      {githubIntent ? (
        <GitHubAuthFrame intent={githubIntent} onClose={() => setGithubIntent(null)} />
      ) : null}
    </section>
  );
}

function requiresGitHubAccount(prompt: string) {
  const normalizedPrompt = prompt.toLowerCase();
  const remoteGitHubPatterns = [
    /\bgithub\b/,
    /\bcreate\s+(a\s+)?repo(sitory)?\b/,
    /\bnew\s+repo(sitory)?\b/,
    /\bpush\b/,
    /\bpull\s+request\b/,
    /\bpr\b/,
    /\bissue\b/,
    /\bfork\b/,
    /\brelease\b/,
    /\bgist\b/,
    /\bclone\s+(private|github)\b/
  ];

  return remoteGitHubPatterns.some((pattern) => pattern.test(normalizedPrompt));
}

function PromptComposer({
  prompt,
  onPromptChange,
  onSubmit
}: {
  prompt: string;
  onPromptChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="mt-8 w-[min(720px,calc(100%-48px))] rounded-2xl border border-[#353535] bg-[#2a2a2a] px-3.5 py-3 shadow-[0_18px_55px_rgba(0,0,0,0.48),inset_0_1px_0_rgba(255,255,255,0.045)]">
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded-md border border-[#3a3a3a] bg-[#202020] px-2 py-0.5 text-[10px] text-[#cfcfcf]">
            Sync Core
          </span>
          <span className="rounded-md border border-[#3a3a3a] bg-[#202020] px-2 py-0.5 text-[10px] text-[#8c8c8c]">
            Plan
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button className="composer-icon" aria-label="Attach">
            <Paperclip size={13} />
          </button>
          <button className="composer-icon" aria-label="Tools">
            <SlidersHorizontal size={13} />
          </button>
        </div>
      </div>
      <textarea
        value={prompt}
        onChange={(event) => onPromptChange(event.target.value)}
        onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
            event.preventDefault();
            onSubmit();
          }
        }}
        className="min-h-[44px] w-full resize-none border-none bg-transparent text-[12px] leading-5 text-[#f2f2f2] outline-none placeholder:text-[#777]"
        placeholder="Ask Sync to build..."
      />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button className="composer-button">
            <TerminalSquare size={12} />
            Context
          </button>
          <button className="composer-button">
            <FileCode2 size={12} />
            File
          </button>
        </div>
        <button
          className="grid h-7 w-7 place-items-center rounded-full bg-[#f2f2f2] text-[#1f1f1f] transition hover:bg-white"
          onClick={onSubmit}
          aria-label="Send prompt"
        >
          <Send size={13} />
        </button>
      </div>
    </div>
  );
}

function PromptHint({
  icon: Icon,
  label
}: {
  icon: typeof FileCode2;
  label: string;
}) {
  return (
    <button className="flex h-9 w-full items-center gap-3 rounded-lg px-3 text-left text-[12px] text-[#8f8f8f] transition hover:bg-[#202020] hover:text-[#d8d8d8]">
      <Icon size={13} className="text-[#6f6f6f]" />
      <span>{label}</span>
    </button>
  );
}
