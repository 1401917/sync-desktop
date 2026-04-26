import { useEffect, useMemo, useRef, useState } from "react";
import { Search, ShieldAlert, Zap } from "lucide-react";
import {
  commandRegistry,
  type CommandContext,
  type CommandRisk,
  type SyncCommand
} from "../lib/commandRegistry";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  context: CommandContext;
}

const RISK_TONE: Record<CommandRisk, string> = {
  safe: "text-[#7fc28a]",
  low: "text-[#a3c5e0]",
  medium: "text-[#e6c068]",
  high: "text-[#e6a268]",
  critical: "text-[#e08585]"
};

export function CommandPalette({ open, onClose, context }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [, forceRefresh] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Re-render when commands are registered/unregistered (e.g. by plugins).
  useEffect(() => {
    return commandRegistry.subscribe(() => forceRefresh((n) => n + 1));
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const allCommands = commandRegistry.list();

  const visibleCommands = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      // No query — surface recent first, then everything else.
      const recentSet = new Set(recentIds);
      const recent = recentIds
        .map((id) => allCommands.find((c) => c.id === id))
        .filter((c): c is SyncCommand => Boolean(c));
      const others = allCommands.filter((c) => !recentSet.has(c.id));
      return [...recent, ...others];
    }
    return allCommands.filter((command) => {
      const haystack = [command.title, command.description, command.category, command.id]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(trimmed);
    });
  }, [query, allCommands, recentIds]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    node?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  if (!open) return null;

  async function execute(command: SyncCommand) {
    setRecentIds((current) => {
      const filtered = current.filter((id) => id !== command.id);
      return [command.id, ...filtered].slice(0, 6);
    });
    onClose();
    try {
      await Promise.resolve(command.handler(context));
    } catch (error) {
      console.warn(`Command ${command.id} failed`, error);
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => Math.min(visibleCommands.length - 1, current + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(0, current - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const command = visibleCommands[activeIndex];
      if (command) execute(command);
    }
  }

  // VS Code-style quick-input: a thin bar pinned near the top, with a
  // shallow autocomplete dropdown only when the user is typing or
  // navigating. No giant modal, no description blob — just title +
  // optional shortcut, like VS Code's command bar.
  const showList = query.trim().length > 0 || activeIndex > 0;
  const trimmedList = showList ? visibleCommands.slice(0, 8) : [];

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-start justify-center bg-black/40 px-4 pt-[6vh]"
      onClick={onClose}
      onKeyDown={onKeyDown}
      tabIndex={-1}
    >
      <div
        className="w-full max-w-[520px]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2 rounded-md border border-[#2c2c2c] bg-[#1d1d1d] px-2.5 shadow-[0_18px_40px_rgba(0,0,0,0.55)]">
          <Search size={12} className="text-[#7a7a7a]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Type a command…"
            className="h-8 min-w-0 flex-1 border-none bg-transparent text-[12.5px] text-[#ededed] outline-none placeholder:text-[#777]"
          />
          <span className="rounded border border-[#2d2d2d] px-1.5 py-0.5 text-[9.5px] text-[#7a7a7a]">
            Esc
          </span>
        </div>

        {showList && trimmedList.length > 0 ? (
          <div
            ref={listRef}
            className="mt-1 overflow-hidden rounded-md border border-[#2c2c2c] bg-[#1a1a1a] shadow-[0_18px_40px_rgba(0,0,0,0.45)]"
          >
            {trimmedList.map((command, index) => (
              <button
                key={command.id}
                data-index={index}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => execute(command)}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left transition ${
                  index === activeIndex ? "bg-[#262626]" : "bg-transparent"
                }`}
              >
                {command.risk === "critical" || command.risk === "high" ? (
                  <ShieldAlert size={11} className={`${RISK_TONE[command.risk]} shrink-0`} />
                ) : (
                  <Zap size={11} className={`${RISK_TONE[command.risk]} shrink-0`} />
                )}
                <span className="truncate text-[12px] text-[#ededed]">{command.title}</span>
                <span className="ml-auto flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] text-[#7a7a7a]">{command.category}</span>
                  {command.shortcut ? (
                    <span className="rounded border border-[#2d2d2d] bg-[#171717] px-1.5 py-0.5 text-[9.5px] text-[#9a9a9a]">
                      {command.shortcut}
                    </span>
                  ) : null}
                </span>
              </button>
            ))}
          </div>
        ) : showList ? (
          <div className="mt-1 rounded-md border border-[#2c2c2c] bg-[#1a1a1a] px-3 py-2 text-[11.5px] text-[#7a7a7a]">
            No matches.
          </div>
        ) : null}
      </div>
    </div>
  );
}
