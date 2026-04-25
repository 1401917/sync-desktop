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

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-start justify-center bg-black/60 px-4 pt-[14vh]"
      onClick={onClose}
      onKeyDown={onKeyDown}
      tabIndex={-1}
    >
      <div
        className="w-full max-w-[640px] overflow-hidden rounded-xl border border-[#2c2c2c] bg-[#1a1a1a] shadow-[0_25px_60px_rgba(0,0,0,0.55)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-[#252525] px-3.5 py-2.5">
          <Search size={14} className="text-[#7a7a7a]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Type a command or search…"
            className="h-7 min-w-0 flex-1 border-none bg-transparent text-[13px] text-[#ededed] outline-none placeholder:text-[#666]"
          />
          <span className="rounded border border-[#2d2d2d] px-1.5 py-0.5 text-[10px] text-[#7a7a7a]">
            Esc
          </span>
        </div>

        <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-1.5">
          {visibleCommands.length === 0 ? (
            <div className="px-4 py-6 text-center text-[12px] text-[#7a7a7a]">
              No commands match “{query}”.
            </div>
          ) : (
            visibleCommands.map((command, index) => (
              <button
                key={command.id}
                data-index={index}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => execute(command)}
                className={`flex w-full items-center gap-3 px-3.5 py-2 text-left transition ${
                  index === activeIndex ? "bg-[#262626]" : "bg-transparent"
                }`}
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-[#2a2a2a] bg-[#1f1f1f]">
                  {command.risk === "critical" || command.risk === "high" ? (
                    <ShieldAlert size={12} className={RISK_TONE[command.risk]} />
                  ) : (
                    <Zap size={12} className={RISK_TONE[command.risk]} />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[12.5px] font-medium text-[#ededed]">
                      {command.title}
                    </span>
                    <span className="rounded-full border border-[#2a2a2a] bg-[#191919] px-1.5 py-0.5 text-[9.5px] uppercase tracking-wider text-[#8a8a8a]">
                      {command.category}
                    </span>
                  </span>
                  {command.description ? (
                    <span className="mt-0.5 block truncate text-[11px] text-[#7e7e7e]">
                      {command.description}
                    </span>
                  ) : null}
                </span>
                {command.shortcut ? (
                  <span className="rounded border border-[#2d2d2d] bg-[#171717] px-1.5 py-0.5 text-[10px] text-[#9a9a9a]">
                    {command.shortcut}
                  </span>
                ) : null}
              </button>
            ))
          )}
        </div>

        <div className="border-t border-[#252525] bg-[#161616] px-3.5 py-1.5 text-[10px] text-[#6e6e6e]">
          ↑ ↓ navigate · ⏎ run · esc close · {visibleCommands.length} command
          {visibleCommands.length === 1 ? "" : "s"}
        </div>
      </div>
    </div>
  );
}
