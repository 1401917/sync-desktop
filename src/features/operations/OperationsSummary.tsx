import { AlertTriangle, FilePlus, FileEdit, Trash2, ShieldAlert } from "lucide-react";
import { useMemo } from "react";
import {
  parseAssistantMessage,
  hasUnmarkedCodeBlocks,
} from "../../lib/fileOps";
import type { FileOperation, ParsedAssistantMessage } from "../../types/fileOps";

export interface OperationsSummaryProps {
  /** Raw assistant message text. */
  source: string;
  /** When true, the message has not been applied to disk yet. */
  pending?: boolean;
  className?: string;
}

export function OperationsSummary({ source, pending, className }: OperationsSummaryProps) {
  const parsed: ParsedAssistantMessage = useMemo(
    () => parseAssistantMessage(source),
    [source]
  );

  const showBanner = hasUnmarkedCodeBlocks(parsed);
  const hasOps = parsed.operations.length > 0;
  if (!showBanner && !hasOps) return null;

  return (
    <section
      data-testid="operations-summary"
      data-pending={pending ? "true" : "false"}
      data-op-count={parsed.operations.length}
      data-unmarked-blocks={parsed.codeBlocksWithoutMarkers}
      className={cn(
        "mb-2 space-y-2 rounded-md border border-zinc-800 bg-zinc-950/50 p-2 text-[12px]",
        className
      )}
    >
      {hasOps ? (
        <header data-testid="operations-summary-header" className="flex items-center justify-between text-zinc-300">
          <span className="font-medium">
            AI proposed {parsed.operations.length} operation
            {parsed.operations.length === 1 ? "" : "s"}
          </span>
          <span className="text-[11px] text-zinc-500">
            {parsed.totalCodeBlocks} code block
            {parsed.totalCodeBlocks === 1 ? "" : "s"} parsed
          </span>
        </header>
      ) : null}

      {hasOps ? (
        <ul data-testid="operations-summary-list" className="space-y-1">
          {parsed.operations.map((op, idx) => (
            <OpRow key={`${op.kind}_${op.path}_${idx}`} op={op} />
          ))}
        </ul>
      ) : null}

      {showBanner ? (
        <div
          data-testid={
            hasOps ? "operations-summary-warning-amber" : "operations-summary-warning-red"
          }
          data-warning-kind={hasOps ? "amber" : "red"}
          className={cn(
            "flex items-start gap-2 rounded-md p-2 text-[11.5px]",
            hasOps
              ? "border border-amber-700/50 bg-amber-950/30 text-amber-200"
              : "border border-rose-700/60 bg-rose-950/40 text-rose-200"
          )}
        >
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="font-medium">
              {hasOps
                ? `${parsed.codeBlocksWithoutMarkers} code block${parsed.codeBlocksWithoutMarkers === 1 ? "" : "s"} without sync:path marker — those will NOT be applied.`
                : `${parsed.codeBlocksWithoutMarkers} code block${parsed.codeBlocksWithoutMarkers === 1 ? "" : "s"} without sync:path marker — no files will be created.`}
            </p>
            <p className="text-[11px] opacity-80">
              The AI must use <code>// sync:path=relative/path</code> or <code># sync:path=relative/path</code> as the FIRST line inside a fenced code block.
              Ask Sync to retry with the strict marker format.
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function OpRow({ op }: { op: FileOperation }) {
  const Icon = op.kind === "delete" ? Trash2 : op.kind === "create" ? FilePlus : FileEdit;
  const tone =
    op.kind === "delete"
      ? "text-rose-300"
      : op.kind === "create"
      ? "text-emerald-300"
      : "text-sky-300";
  return (
    <li
      data-testid="operations-summary-row"
      data-op-kind={op.kind}
      data-op-path={op.path}
      data-op-sensitive={op.isSensitive ? "true" : "false"}
      data-op-unsafe={op.isUnsafe ? "true" : "false"}
      className="flex items-center justify-between gap-2 rounded-sm bg-zinc-900/60 px-2 py-1"
    >
      <div className="flex min-w-0 items-center gap-2">
        <Icon size={13} className={tone} />
        <span className={cn("text-[10.5px] uppercase tracking-wide", tone)}>{op.kind}</span>
        <code className="truncate text-[12px] text-zinc-200">{op.path}</code>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {op.isUnsafe ? (
          <Tag tone="rose" testid="op-tag-unsafe">unsafe path</Tag>
        ) : null}
        {op.isSensitive ? (
          <Tag tone="amber" testid="op-tag-sensitive" icon={<ShieldAlert size={11} />}>
            sensitive
          </Tag>
        ) : null}
      </div>
    </li>
  );
}

function Tag(props: {
  tone: "rose" | "amber";
  testid: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const cls =
    props.tone === "rose"
      ? "border-rose-700/60 bg-rose-950/40 text-rose-200"
      : "border-amber-700/50 bg-amber-950/30 text-amber-200";
  return (
    <span
      data-testid={props.testid}
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10px]",
        cls
      )}
    >
      {props.icon ?? null}
      {props.children}
    </span>
  );
}

function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
