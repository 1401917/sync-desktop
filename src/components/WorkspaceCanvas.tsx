import {
  Bot,
  Cloud,
  FileCode2,
  FolderOpen,
  GitBranch,
  Loader2,
  Paperclip,
  Send,
  SlidersHorizontal,
  TerminalSquare,
  User
} from "lucide-react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef, useState } from "react";
import { GitHubAuthFrame } from "../features/integrations/GitHubAuthFrame";
import {
  isTauriRuntime,
  loadLatestChat,
  openProjectFolder,
  submitAiPrompt,
  type ChatHistoryEntry
} from "../lib/backend";
import { MarkdownView } from "./MarkdownView";
import { OperationsSummary } from "../features/operations";
import type {
  AiJobUpdate,
  BootstrapPayload,
  ChatMessageSummary,
  ModelProviderSummary,
  NavKey,
  ProjectFileEntry,
  ProjectOpenResult,
  ProjectSummary,
  SyncTask
} from "../types/domain";
import { ScreenPlaceholder } from "./ScreenPlaceholder";

interface WorkspaceCanvasProps {
  activeView: NavKey;
  selectedProject: ProjectSummary;
  payload: BootstrapPayload;
  tasks: SyncTask[];
  projectFiles: ProjectFileEntry[];
  prompt: string;
  hasOpenedProject: boolean;
  onPromptChange: (value: string) => void;
  onProjectOpened: (result: ProjectOpenResult) => void;
  onTasksGenerated: (tasks: SyncTask[]) => void;
  onProviderUpdated: (provider: ModelProviderSummary) => void;
  onComposerRef?: (focusFn: () => void) => void;
}

type ChatMessage =
  | { id: string; role: "user"; content: string }
  | { id: string; role: "assistant"; content: string; status?: "pending" | "ok" | "error" };

const HISTORY_MESSAGE_LIMIT = 12;
const HISTORY_CONTENT_LIMIT = 12_000;
const LARGE_PROMPT_SOFT_LIMIT = 200_000;
const MAX_COMPOSER_CHARS = 120_000;
const TEXT_PREVIEW_STEP = 10_000;

export function WorkspaceCanvas({
  activeView,
  selectedProject,
  payload,
  tasks,
  projectFiles,
  prompt,
  hasOpenedProject,
  onPromptChange,
  onProjectOpened,
  onTasksGenerated,
  onProviderUpdated
}: WorkspaceCanvasProps) {
  const [githubIntent, setGithubIntent] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [stage, setStage] = useState<string>("Thinking");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const onTasksGeneratedRef = useRef(onTasksGenerated);

  useEffect(() => {
    onTasksGeneratedRef.current = onTasksGenerated;
  }, [onTasksGenerated]);

  useEffect(() => {
    let cancelled = false;
    loadLatestChat()
      .then((chat) => {
        if (cancelled || !chat || chat.messages.length === 0) return;
        setActiveSessionId(chat.sessionId);
        setMessages(chat.messages.map(chatMessageToBubble));
        if (chat.tasks.length > 0) {
          onTasksGeneratedRef.current(chat.tasks);
        }
      })
      .catch((error) => {
        console.warn("Unable to autoload latest chat", error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    let disposed = false;
    let unlisten: (() => void) | null = null;

    listen<AiJobUpdate>("sync://ai-job-updated", (event) => {
      if (disposed) return;
      const update = event.payload;
      setActiveSessionId(update.sessionId);
      setMessages((current) =>
        current.map((message) =>
          message.id === update.assistantMessageId
            ? {
                ...message,
                content: update.assistantMessage,
                status: update.status === "ok" ? "ok" : "error"
              }
            : message
        )
      );
      if (update.tasks.length > 0) {
        onTasksGeneratedRef.current(update.tasks);
      }
      setBusy(false);
      if (update.appliedFiles.length > 0) {
        setStatusMessage(`Applied ${update.appliedFiles.length} file(s) inside the opened project.`);
      }
    }).then((dispose) => {
      unlisten = dispose;
      if (disposed) dispose();
    });

    return () => {
      disposed = true;
      if (unlisten) unlisten();
    };
  }, []);

  useEffect(() => {
    if (!busy) {
      setElapsed(0);
      setStage("Thinking");
      return;
    }
    const start = Date.now();
    const stages = [
      "Thinking",
      "Reading project context",
      "Drafting plan",
      "Calling model provider",
      "Composing response"
    ];
    const interval = window.setInterval(() => {
      const seconds = Math.floor((Date.now() - start) / 1000);
      setElapsed(seconds);
      setStage(stages[Math.min(stages.length - 1, Math.floor(seconds / 3))]);
    }, 250);
    return () => window.clearInterval(interval);
  }, [busy]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, busy]);

  async function submitPrompt() {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) return;

    if (requiresGitHubAccount(trimmedPrompt)) {
      setGithubIntent(trimmedPrompt);
      return;
    }

    const userId = `u-${Date.now()}`;
    const assistantId = `a-${Date.now()}`;
    const promptForRequest =
      trimmedPrompt.length > LARGE_PROMPT_SOFT_LIMIT
        ? `${trimmedPrompt.slice(0, LARGE_PROMPT_SOFT_LIMIT)}\n\n[Sync truncated this oversized prompt before sending it to the native request pipeline. Attach very large files through project context instead of pasting them into chat.]`
        : trimmedPrompt;

    setMessages((current) => [
      ...current,
      { id: userId, role: "user", content: trimmedPrompt },
      { id: assistantId, role: "assistant", content: "", status: "pending" }
    ]);
    onPromptChange("");
    setBusy(true);
    setStatusMessage(null);

    try {
      const previous = buildBoundedHistory(messages);
      const result = await submitAiPrompt(
        promptForRequest,
        previous,
        hasOpenedProject ? selectedProject?.id : null
      );
      setActiveSessionId(result.sessionId);
      onTasksGenerated(result.tasks);
      setMessages((current) =>
        current.map((message) =>
          message.id === userId
            ? { ...message, id: result.userMessageId }
            : message.id === assistantId
            ? {
                ...message,
                id: result.assistantMessageId,
                content: result.assistantMessage,
                status: "pending"
              }
            : message
        )
      );
    } catch (error) {
      const errorText = error instanceof Error ? error.message : String(error);
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantId
            ? { ...message, content: errorText, status: "error" }
            : message
        )
      );
      setBusy(false);
    }
  }

  async function chooseProjectFolder() {
    setBusy(true);
    setStatusMessage(null);
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: "Open Sync project folder"
      });
      if (typeof selected !== "string") return;

      const result = await openProjectFolder(selected);
      onProjectOpened(result);
      setStatusMessage(
        `Opened ${result.project.name}: ${result.scan.filesScanned} files indexed, ${result.scan.sensitiveFiles.length} sensitive files protected.`
      );
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  const conversationStarted = messages.length > 0;

  return (
    <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#171717]">
      {activeView === "projects" ? (
        <div className="flex min-h-0 flex-1 flex-col">
          {!conversationStarted ? (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-8">
              <div className="mb-8 flex items-center gap-2 rounded-full border border-[#2f2f2f] bg-[#202020] px-3 py-1.5 text-[11px] text-[#8d8d8d]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#34c759]" />
                {payload.securityMode}
              </div>
              <h1 className="text-[25px] font-medium tracking-[-0.01em] text-[#f2f2f2]">
                What should we build in Sync?
              </h1>
              {hasOpenedProject && selectedProject ? (
                <div className="mt-5 flex items-center gap-2 rounded-lg border border-[#2a3f2c] bg-[#1d2a1f] px-3 py-1.5 text-[11.5px] text-[#aedab1]">
                  <FolderOpen size={13} />
                  <span className="font-medium">{selectedProject.name}</span>
                  <span className="text-[10.5px] text-[#7fc28a]">opened</span>
                </div>
              ) : (
                <button
                  className="mt-5 flex h-9 items-center gap-2 rounded-lg border border-[#343434] bg-[#202020] px-3 text-[12px] font-medium text-[#d8d8d8] transition hover:bg-[#2a2a2a]"
                  onClick={chooseProjectFolder}
                  disabled={busy}
                >
                  <FolderOpen size={14} />
                  Open Project Folder
                </button>
              )}
              <PromptComposer
                prompt={prompt}
                onPromptChange={onPromptChange}
                onSubmit={submitPrompt}
                busy={busy}
              />
              {statusMessage ? (
                <div className="mt-3 w-[min(720px,calc(100%-48px))] rounded-lg border border-[#303030] bg-[#202020] px-3 py-2 text-[11px] leading-5 text-[#9a9a9a]">
                  {statusMessage}
                </div>
              ) : null}
              <div className="mt-5 w-[min(680px,calc(100%-48px))] space-y-1">
                <PromptHint icon={GitBranch} label="Prepare a GitHub repo, branch, and guarded push plan" />
                <PromptHint icon={TerminalSquare} label="Review local changes and create an approval-gated task list" />
                <PromptHint icon={Cloud} label="Connect MCP or external services only after permission review" />
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-6 pt-6">
                <div className="mx-auto flex max-w-[760px] flex-col gap-4 pb-6">
                  {messages.map((message) => (
                    <ChatBubble key={message.id} message={message} busy={busy} />
                  ))}
                  {busy ? <ThinkingIndicator stage={stage} elapsed={elapsed} /> : null}
                </div>
              </div>
              <div className="border-t border-[#222] bg-[#171717] px-6 pb-5 pt-4">
                <div className="mx-auto max-w-[760px]">
                  <PromptComposer
                    prompt={prompt}
                    onPromptChange={onPromptChange}
                    onSubmit={submitPrompt}
                    busy={busy}
                    compact
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <ScreenPlaceholder
          activeView={activeView}
          payload={payload}
          selectedProject={selectedProject}
          tasks={tasks}
          projectFiles={projectFiles}
          onProviderUpdated={onProviderUpdated}
        />
      )}

      {githubIntent ? (
        <GitHubAuthFrame intent={githubIntent} onClose={() => setGithubIntent(null)} />
      ) : null}
    </section>
  );
}

function ChatBubble({ message, busy }: { message: ChatMessage; busy: boolean }) {
  const isUser = message.role === "user";
  const isPending = message.role === "assistant" && message.status === "pending";
  const isError = message.role === "assistant" && message.status === "error";

  if (isPending && busy) {
    return null;
  }

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${
          isUser
            ? "bg-[#2a2a2a] text-[#cfcfcf]"
            : isError
            ? "bg-[#3a2222] text-[#e08585]"
            : "bg-[#1f2a20] text-[#7fc28a]"
        }`}
      >
        {isUser ? <User size={13} /> : <Bot size={13} />}
      </div>
      <div
        className={`max-w-[calc(100%-44px)] rounded-2xl px-3.5 py-2.5 text-[12.5px] leading-[1.55] ${
          isUser
            ? "bg-[#2a2a2a] text-[#ededed]"
            : isError
            ? "border border-[#4a2a2a] bg-[#221818] text-[#e6b3b3]"
            : "border border-[#262626] bg-[#1d1d1d] text-[#dedede]"
        }`}
        style={{ wordBreak: "break-word" }}
      >
        {isUser || isError ? (
          <TextPreview source={message.content} />
        ) : (
          <>
            <OperationsSummary source={message.content} />
            <MarkdownView source={message.content} />
          </>
        )}
      </div>
    </div>
  );
}

function chatMessageToBubble(message: ChatMessageSummary): ChatMessage {
  if (message.role === "user") {
    return { id: message.id, role: "user", content: message.content };
  }
  return {
    id: message.id,
    role: "assistant",
    content: message.content,
    status: message.status === "error" ? "error" : message.status === "pending" ? "pending" : "ok"
  };
}

function TextPreview({ source }: { source: string }) {
  const [visibleChars, setVisibleChars] = useState(TEXT_PREVIEW_STEP);
  const truncated = source.length > visibleChars;
  const visible = truncated ? source.slice(0, visibleChars) : source;

  return (
    <span style={{ whiteSpace: "pre-wrap" }}>
      {visible}
      {truncated ? (
        <>
          {"\n\n"}
          <button
            className="rounded-md border border-[#3a3a3a] bg-[#202020] px-2 py-1 text-[11px] text-[#b8b8b8] transition hover:bg-[#2a2a2a] hover:text-[#f0f0f0]"
            onClick={() => setVisibleChars((current) => current + TEXT_PREVIEW_STEP)}
          >
            Show more
          </button>
        </>
      ) : null}
    </span>
  );
}

function ThinkingIndicator({ stage, elapsed }: { stage: string; elapsed: number }) {
  return (
    <div className="flex gap-3">
      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#1f2a20] text-[#7fc28a]">
        <Bot size={13} />
      </div>
      <div className="flex items-center gap-2 rounded-2xl border border-[#262626] bg-[#1d1d1d] px-3.5 py-2.5 text-[12px] text-[#a8a8a8]">
        <Loader2 size={13} className="animate-spin text-[#7fc28a]" />
        <span>{stage}…</span>
        <span className="text-[11px] text-[#6e6e6e]">{elapsed}s</span>
      </div>
    </div>
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

function buildBoundedHistory(messages: ChatMessage[]): ChatHistoryEntry[] {
  return messages
    .filter((message) => !(message.role === "assistant" && message.status === "pending"))
    .slice(-HISTORY_MESSAGE_LIMIT)
    .map<ChatHistoryEntry>((message) => [
      message.role === "user" ? "user" : "assistant",
      clampContentForHistory(message.content)
    ]);
}

function clampContentForHistory(content: string) {
  if (content.length <= HISTORY_CONTENT_LIMIT) {
    return content;
  }

  const head = content.slice(0, Math.floor(HISTORY_CONTENT_LIMIT * 0.65));
  const tail = content.slice(content.length - Math.floor(HISTORY_CONTENT_LIMIT * 0.25));
  return `${head}\n\n[Middle of this previous message was omitted to keep Sync responsive.]\n\n${tail}`;
}

function limitComposerInput(value: string) {
  if (value.length <= MAX_COMPOSER_CHARS) {
    return value;
  }
  return `${value.slice(0, MAX_COMPOSER_CHARS)}\n\n[Sync capped this pasted prompt to keep the desktop app responsive. Open the project folder and ask Sync to inspect files instead of pasting very large files into chat.]`;
}

function PromptComposer({
  prompt,
  onPromptChange,
  onSubmit,
  busy,
  compact
}: {
  prompt: string;
  onPromptChange: (value: string) => void;
  onSubmit: () => void;
  busy: boolean;
  compact?: boolean;
}) {
  const wrapperClass = compact
    ? "rounded-2xl border border-[#353535] bg-[#222] px-3.5 py-3 shadow-[0_8px_28px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.04)]"
    : "mt-8 w-[min(720px,calc(100%-48px))] rounded-2xl border border-[#353535] bg-[#2a2a2a] px-3.5 py-3 shadow-[0_18px_55px_rgba(0,0,0,0.48),inset_0_1px_0_rgba(255,255,255,0.045)]";

  return (
    <div className={wrapperClass}>
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
        onChange={(event) => onPromptChange(limitComposerInput(event.target.value))}
        onKeyDown={(event) => {
          // Enter sends, Shift+Enter inserts a newline (matches Cursor /
          // ChatGPT / Claude behaviour). IME composition is preserved so
          // Hebrew/CJK input doesn't trigger a premature send.
          if (
            event.key === "Enter" &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault();
            onSubmit();
          }
        }}
        className="min-h-[44px] w-full resize-none border-none bg-transparent text-[12px] leading-5 text-[#f2f2f2] outline-none placeholder:text-[#777]"
        placeholder={busy ? "Sync is working..." : "Ask Sync to build..."}
        disabled={busy}
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
          className="grid h-7 w-7 place-items-center rounded-full bg-[#f2f2f2] text-[#1f1f1f] transition hover:bg-white disabled:cursor-default disabled:bg-[#3a3a3a] disabled:text-[#7a7a7a]"
          onClick={onSubmit}
          disabled={busy || !prompt.trim()}
          aria-label="Send prompt"
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
        </button>
      </div>
    </div>
  );
}

function PromptHint({ icon: Icon, label }: { icon: typeof FileCode2; label: string }) {
  return (
    <button className="flex h-9 w-full items-center gap-3 rounded-lg px-3 text-left text-[12px] text-[#8f8f8f] transition hover:bg-[#202020] hover:text-[#d8d8d8]">
      <Icon size={13} className="text-[#6f6f6f]" />
      <span>{label}</span>
    </button>
  );
}
