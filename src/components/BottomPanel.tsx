import { ChevronDown, ChevronUp, Play, Square, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { isTauriRuntime } from "../lib/backend";
import type { ProblemItem } from "../lib/problems";

export type BottomTab = "terminal" | "problems" | "output";

export interface TerminalLine {
  id: string;
  kind: "stdout" | "stderr" | "command" | "info";
  text: string;
}

interface BottomPanelProps {
  open: boolean;
  activeTab: BottomTab;
  onChangeTab: (tab: BottomTab) => void;
  onClose: () => void;
  onToggle: () => void;
  workingDirectory: string;
  problems: ProblemItem[];
  output: TerminalLine[];
  terminal: TerminalLine[];
  terminalRunning: boolean;
  onRunCommand: (command: string) => Promise<void>;
  onClearTerminal: () => void;
  onAskAiAboutProblem: (problem: ProblemItem) => void;
}

export function BottomPanel({
  open,
  activeTab,
  onChangeTab,
  onClose,
  onToggle,
  workingDirectory,
  problems,
  output,
  terminal,
  terminalRunning,
  onRunCommand,
  onClearTerminal,
  onAskAiAboutProblem
}: BottomPanelProps) {
  if (!open) {
    return (
      <div className="border-t border-[#222] bg-[#1a1a1a] px-4 py-1.5 text-[11px] text-[#9a9a9a]">
        <button
          onClick={onToggle}
          className="flex items-center gap-2 text-[#9a9a9a] transition hover:text-[#ededed]"
        >
          <ChevronUp size={11} />
          Show panel <span className="text-[10px] text-[#666]">(Ctrl+J)</span>
        </button>
      </div>
    );
  }

  return (
    <section className="flex h-[260px] flex-col border-t border-[#222] bg-[#171717]">
      <header className="flex h-9 shrink-0 items-center justify-between border-b border-[#222] bg-[#1a1a1a] px-2">
        <div className="flex items-center gap-1">
          <Tab
            label="Terminal"
            count={undefined}
            active={activeTab === "terminal"}
            onClick={() => onChangeTab("terminal")}
          />
          <Tab
            label="Problems"
            count={problems.length || undefined}
            tone={problems.some((p) => p.severity === "error") ? "error" : "warn"}
            active={activeTab === "problems"}
            onClick={() => onChangeTab("problems")}
          />
          <Tab
            label="Output"
            count={output.length || undefined}
            active={activeTab === "output"}
            onClick={() => onChangeTab("output")}
          />
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onToggle}
            title="Hide panel (Ctrl+J)"
            className="grid h-7 w-7 place-items-center rounded text-[#9a9a9a] transition hover:bg-[#262626] hover:text-[#ededed]"
          >
            <ChevronDown size={13} />
          </button>
          <button
            onClick={onClose}
            title="Close panel"
            className="grid h-7 w-7 place-items-center rounded text-[#9a9a9a] transition hover:bg-[#262626] hover:text-[#ededed]"
          >
            <X size={12} />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden">
        {activeTab === "terminal" ? (
          <TerminalView
            workingDirectory={workingDirectory}
            terminal={terminal}
            running={terminalRunning}
            onRunCommand={onRunCommand}
            onClearTerminal={onClearTerminal}
          />
        ) : activeTab === "problems" ? (
          <ProblemsView problems={problems} onAskAi={onAskAiAboutProblem} />
        ) : (
          <OutputView output={output} />
        )}
      </div>
    </section>
  );
}

function Tab({
  label,
  active,
  count,
  tone,
  onClick
}: {
  label: string;
  active: boolean;
  count?: number;
  tone?: "warn" | "error";
  onClick: () => void;
}) {
  const badgeTone =
    tone === "error" ? "border-[#4a2a2a] bg-[#221818] text-[#e08585]" :
    tone === "warn" ? "border-[#3f3a25] bg-[#26241d] text-[#cfb56a]" :
    "border-[#2a2a2a] bg-[#1c1c1c] text-[#9a9a9a]";
  return (
    <button
      onClick={onClick}
      className={`flex h-7 items-center gap-2 rounded-md px-2.5 text-[11.5px] transition ${
        active ? "bg-[#262626] text-[#ededed]" : "text-[#9a9a9a] hover:bg-[#1f1f1f] hover:text-[#dcdcdc]"
      }`}
    >
      <span>{label}</span>
      {typeof count === "number" ? (
        <span className={`rounded-full border px-1.5 py-0 text-[9.5px] ${badgeTone}`}>
          {count}
        </span>
      ) : null}
    </button>
  );
}

const COMMAND_SUGGESTIONS: Array<{ command: string; hint: string }> = [
  { command: "git status", hint: "Show changed files" },
  { command: "git add .", hint: "Stage everything" },
  { command: "git commit -m \"\"", hint: "Commit staged" },
  { command: "git push", hint: "Push current branch" },
  { command: "git pull", hint: "Fetch + merge" },
  { command: "git log --oneline -20", hint: "Recent commits" },
  { command: "git branch", hint: "List branches" },
  { command: "git checkout -b ", hint: "New branch" },
  { command: "git diff", hint: "Working tree diff" },
  { command: "git stash", hint: "Stash changes" },
  { command: "gh repo create --private --source=. --push", hint: "Create private GitHub repo" },
  { command: "gh repo view --web", hint: "Open repo in browser" },
  { command: "gh release list", hint: "List releases" },
  { command: "npm install", hint: "Install dependencies" },
  { command: "npm run dev", hint: "Vite dev server" },
  { command: "npm run build", hint: "Build frontend" },
  { command: "npm run tauri:dev", hint: "Tauri dev mode" },
  { command: "npm run tauri:build", hint: "Build Windows installer" },
  { command: "npm test", hint: "Run frontend tests" },
  { command: "npm audit --audit-level=moderate", hint: "Check vulnerabilities" },
  { command: "pnpm install", hint: "Install via pnpm" },
  { command: "yarn install", hint: "Install via yarn" },
  { command: "cargo check", hint: "Type-check Rust" },
  { command: "cargo build", hint: "Build Rust" },
  { command: "cargo build --release", hint: "Release build" },
  { command: "cargo test", hint: "Run Rust tests" },
  { command: "cargo clean", hint: "Wipe target/" },
  { command: "tsc --noEmit", hint: "Type-check TypeScript" },
  { command: "dir", hint: "List files (Windows)" },
  { command: "cd ", hint: "Change directory" },
  { command: "cls", hint: "Clear screen" },
  { command: "type ", hint: "Print file (Windows)" },
  { command: "echo ", hint: "Print text" },
  { command: "where ", hint: "Locate executable" }
];

function TerminalView({
  workingDirectory,
  terminal,
  running,
  onRunCommand,
  onClearTerminal
}: {
  workingDirectory: string;
  terminal: TerminalLine[];
  running: boolean;
  onRunCommand: (command: string) => Promise<void>;
  onClearTerminal: () => void;
}) {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [terminal]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Autocomplete: filter the suggestion list as the user types. Empty input
  // hides the dropdown.
  const trimmedInput = input.trimStart();
  const suggestions = trimmedInput.length === 0
    ? []
    : COMMAND_SUGGESTIONS
        .filter((entry) => entry.command.toLowerCase().startsWith(trimmedInput.toLowerCase()))
        .slice(0, 6);

  useEffect(() => {
    setSuggestionIndex(0);
  }, [trimmedInput]);

  async function submit() {
    const trimmed = input.trim();
    if (!trimmed || running) return;
    setInput("");
    setHistoryIndex(null);
    setHistory((current) => {
      if (current[current.length - 1] === trimmed) return current;
      return [...current, trimmed].slice(-50);
    });
    await onRunCommand(trimmed);
  }

  function applySuggestion(index: number) {
    const choice = suggestions[index];
    if (!choice) return;
    setInput(choice.command);
    inputRef.current?.focus();
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-[#222] bg-[#1a1a1a] px-3 py-1.5">
        <div className="truncate text-[10.5px] text-[#7a7a7a]">{workingDirectory}</div>
        <div className="flex items-center gap-1">
          <button
            onClick={onClearTerminal}
            title="Clear"
            className="grid h-6 w-6 place-items-center rounded text-[#9a9a9a] transition hover:bg-[#262626] hover:text-[#ededed]"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto bg-[#111] px-3 py-2 font-mono text-[11.5px] leading-[1.55]">
        {terminal.length === 0 ? (
          <div className="text-[#666]">
            {isTauriRuntime()
              ? "Type a command and press Enter. AI-initiated commands will require approval."
              : "Terminal commands run only inside the Sync desktop app. Open via the .exe to use this."}
          </div>
        ) : (
          terminal.map((line) => (
            <div
              key={line.id}
              className={
                line.kind === "stderr"
                  ? "text-[#e6a4a4]"
                  : line.kind === "command"
                  ? "text-[#9cb8e0]"
                  : line.kind === "info"
                  ? "text-[#7a7a7a]"
                  : "text-[#dcdcdc]"
              }
              style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
            >
              {line.kind === "command" ? "$ " : ""}
              {line.text}
            </div>
          ))
        )}
      </div>
      <div className="relative shrink-0 border-t border-[#222] bg-[#1a1a1a]">
        {suggestions.length > 0 ? (
          <div className="absolute bottom-full left-0 right-0 mb-1 overflow-hidden rounded-md border border-[#2c2c2c] bg-[#1d1d1d] shadow-[0_-12px_28px_rgba(0,0,0,0.45)]">
            {suggestions.map((entry, index) => (
              <button
                key={entry.command}
                onMouseEnter={() => setSuggestionIndex(index)}
                onMouseDown={(event) => {
                  // Prevent input blur before we apply the suggestion.
                  event.preventDefault();
                  applySuggestion(index);
                }}
                className={`flex w-full items-center gap-3 px-3 py-1.5 text-left transition ${
                  index === suggestionIndex ? "bg-[#262626]" : "bg-transparent"
                }`}
              >
                <span className="font-mono text-[11.5px] text-[#ededed]">
                  {entry.command}
                </span>
                <span className="ml-auto truncate text-[10.5px] text-[#7a7a7a]">
                  {entry.hint}
                </span>
              </button>
            ))}
            <div className="border-t border-[#252525] px-3 py-1 text-[9.5px] text-[#6e6e6e]">
              Tab complete · ↑ ↓ navigate · Enter run
            </div>
          </div>
        ) : null}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
          className="flex items-center gap-2 px-3 py-2"
        >
          <span className="text-[11.5px] text-[#7fc28a]">$</span>
          <input
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              // Tab — accept the highlighted suggestion.
              if (event.key === "Tab" && suggestions.length > 0) {
                event.preventDefault();
                applySuggestion(suggestionIndex);
                return;
              }
              // ArrowDown — into suggestions list, or step forward in shell history.
              if (event.key === "ArrowDown") {
                if (suggestions.length > 0) {
                  event.preventDefault();
                  setSuggestionIndex((current) =>
                    Math.min(suggestions.length - 1, current + 1)
                  );
                  return;
                }
                if (historyIndex !== null) {
                  event.preventDefault();
                  const next = historyIndex + 1;
                  if (next >= history.length) {
                    setInput("");
                    setHistoryIndex(null);
                  } else {
                    setInput(history[next]);
                    setHistoryIndex(next);
                  }
                }
                return;
              }
              // ArrowUp — through suggestions, or backward in shell history.
              if (event.key === "ArrowUp") {
                if (suggestions.length > 0) {
                  event.preventDefault();
                  setSuggestionIndex((current) => Math.max(0, current - 1));
                  return;
                }
                if (history.length > 0) {
                  event.preventDefault();
                  const next = historyIndex === null ? history.length - 1 : Math.max(0, historyIndex - 1);
                  setInput(history[next]);
                  setHistoryIndex(next);
                }
              }
            }}
            placeholder={running ? "Running…" : "Run a command (Tab autocomplete, ↑↓ history)"}
            disabled={running}
            spellCheck={false}
            autoComplete="off"
            className="h-7 min-w-0 flex-1 border-none bg-transparent font-mono text-[11.5px] text-[#ededed] outline-none placeholder:text-[#666] disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={running || !input.trim()}
            title="Run"
            className="grid h-7 w-7 place-items-center rounded text-[#9a9a9a] transition hover:bg-[#262626] hover:text-[#ededed] disabled:opacity-30"
          >
            {running ? <Square size={11} /> : <Play size={11} />}
          </button>
        </form>
      </div>
    </div>
  );
}

function ProblemsView({
  problems,
  onAskAi
}: {
  problems: ProblemItem[];
  onAskAi: (problem: ProblemItem) => void;
}) {
  if (problems.length === 0) {
    return (
      <div className="grid h-full place-items-center text-[12px] text-[#7a7a7a]">
        No problems detected.
      </div>
    );
  }
  return (
    <ul className="h-full overflow-y-auto px-2 py-2">
      {problems.map((problem) => (
        <li
          key={problem.id}
          className="mb-1 flex items-start gap-3 rounded-md border border-[#222] bg-[#1c1c1c] px-3 py-2"
        >
          <span
            className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
              problem.severity === "error"
                ? "bg-[#e08585]"
                : problem.severity === "warning"
                ? "bg-[#e6c068]"
                : "bg-[#7a7a7a]"
            }`}
          />
          <div className="min-w-0 flex-1">
            <div className="text-[12px] text-[#ededed]">{problem.message}</div>
            <div className="mt-0.5 text-[10.5px] text-[#7a7a7a]">
              {problem.filePath}
              {problem.line ? `:${problem.line}` : ""}
              {problem.column ? `:${problem.column}` : ""}
              {problem.source ? ` · ${problem.source}` : ""}
            </div>
          </div>
          <button
            onClick={() => onAskAi(problem)}
            className="shrink-0 rounded-md border border-[#2c2c2c] bg-[#202020] px-2 py-0.5 text-[10.5px] text-[#bdbdbd] transition hover:bg-[#262626] hover:text-[#ededed]"
          >
            Ask AI to fix
          </button>
        </li>
      ))}
    </ul>
  );
}

function OutputView({ output }: { output: TerminalLine[] }) {
  if (output.length === 0) {
    return (
      <div className="grid h-full place-items-center text-[12px] text-[#7a7a7a]">
        Output from build, validation, and AI tool runs will appear here.
      </div>
    );
  }
  return (
    <div className="h-full overflow-y-auto bg-[#111] px-3 py-2 font-mono text-[11.5px] leading-[1.55]">
      {output.map((line) => (
        <div
          key={line.id}
          className={
            line.kind === "stderr"
              ? "text-[#e6a4a4]"
              : line.kind === "command"
              ? "text-[#9cb8e0]"
              : "text-[#dcdcdc]"
          }
          style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
        >
          {line.text}
        </div>
      ))}
    </div>
  );
}
