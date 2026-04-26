import type { PipelineTracer } from "../../lib/pipelineTracer";
import { usePipelineTracer } from "../../lib/usePipelineTracer";
import type {
  ConfidenceScore,
  LiveCodingMetrics,
  PipelineStage,
  PipelineStageStatus,
} from "../../types/pipeline";

export interface PipelinePanelProps {
  tracer: PipelineTracer;
  runId?: string;
  className?: string;
}

export function PipelinePanel({ tracer, runId, className }: PipelinePanelProps) {
  const { run, elapsedMs, totalElapsedMs, activeStage } = usePipelineTracer(
    tracer,
    runId
  );

  if (!run) {
    return (
      <section
        data-testid="pipeline-panel-empty"
        className={cn(
          "rounded-md border border-zinc-800 bg-zinc-950/40 p-4 text-sm text-zinc-400",
          className
        )}
      >
        Pipeline idle — no active run.
      </section>
    );
  }

  return (
    <section
      data-testid="pipeline-panel"
      data-run-id={run.id}
      data-run-status={run.status}
      className={cn(
        "rounded-md border border-zinc-800 bg-zinc-950/40 text-sm text-zinc-200",
        className
      )}
    >
      <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
        <div className="flex items-center gap-2">
          <StatusDot status={run.status} />
          <span className="font-medium">{titleForRun(run.requestText)}</span>
          <span className="text-xs text-zinc-500">· {run.mode}</span>
        </div>
        <div className="text-xs tabular-nums text-zinc-400">
          {formatMs(totalElapsedMs())}
        </div>
      </header>

      <StageList
        stages={run.stages}
        activeStageId={activeStage?.id}
        elapsedMs={elapsedMs}
      />

      <MetricsBar metrics={run.liveCoding} />

      {run.confidence ? <ConfidenceBadge score={run.confidence} /> : null}
    </section>
  );
}

// ── sub-components (file-private) ───────────────────────────────────────────

function StageList(props: {
  stages: PipelineStage[];
  activeStageId: string | undefined;
  elapsedMs: (s: PipelineStage) => number;
}) {
  if (props.stages.length === 0) {
    return (
      <ul data-testid="stage-list" className="px-4 py-3 text-xs text-zinc-500">
        Waiting for first stage…
      </ul>
    );
  }
  return (
    <ul data-testid="stage-list" className="divide-y divide-zinc-800/60">
      {props.stages.map((stage) => (
        <StageRow
          key={stage.id}
          stage={stage}
          active={stage.id === props.activeStageId}
          elapsedMs={props.elapsedMs(stage)}
        />
      ))}
    </ul>
  );
}

function StageRow(props: {
  stage: PipelineStage;
  active: boolean;
  elapsedMs: number;
}) {
  const { stage, active, elapsedMs } = props;
  return (
    <li
      data-testid="stage-row"
      data-stage-kind={stage.kind}
      data-stage-status={stage.status}
      data-active={active ? "true" : "false"}
      className={cn(
        "flex items-center justify-between px-4 py-1.5",
        active && "bg-zinc-900/60"
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <StatusDot status={stage.status} />
        <span className="truncate">{stage.label}</span>
        {stage.resultSummary ? (
          <span className="truncate text-xs text-zinc-500">
            · {stage.resultSummary}
          </span>
        ) : null}
        {stage.error ? (
          <span className="truncate text-xs text-rose-400">
            · {stage.error.message}
          </span>
        ) : null}
      </div>
      <div className="ml-3 shrink-0 text-xs tabular-nums text-zinc-400">
        {stage.status === "Pending" ? "—" : formatMs(elapsedMs)}
      </div>
    </li>
  );
}

function MetricsBar(props: { metrics: LiveCodingMetrics }) {
  const m = props.metrics;
  const hasAny =
    m.filesCreated > 0 ||
    m.filesModified > 0 ||
    m.linesAdded > 0 ||
    m.linesRemoved > 0 ||
    m.linesChanged > 0 ||
    !!m.activeFile;
  if (!hasAny) {
    return (
      <div
        data-testid="metrics-bar"
        className="border-t border-zinc-800 px-4 py-2 text-xs text-zinc-500"
      >
        No file changes yet.
      </div>
    );
  }
  return (
    <div
      data-testid="metrics-bar"
      className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-zinc-800 px-4 py-2 text-xs text-zinc-400"
    >
      {m.activeFile ? (
        <span className="text-zinc-300">
          <span className="text-zinc-500">Active:</span> {m.activeFile}
        </span>
      ) : null}
      <span>
        <span className="text-zinc-500">Files:</span> +{m.filesCreated} ~
        {m.filesModified}
      </span>
      <span>
        <span className="text-emerald-400">+{m.linesAdded}</span>{" "}
        <span className="text-rose-400">-{m.linesRemoved}</span>{" "}
        <span className="text-amber-400">~{m.linesChanged}</span>
      </span>
    </div>
  );
}

function ConfidenceBadge(props: { score: ConfidenceScore }) {
  const s = props.score;
  return (
    <div
      data-testid="confidence-badge"
      className="flex items-center gap-3 border-t border-zinc-800 px-4 py-2 text-xs text-zinc-400"
    >
      <span>
        <span className="text-zinc-500">Confidence:</span>{" "}
        <span className="tabular-nums">{s.value.toFixed(2)}</span>
      </span>
      <span>
        <span className="text-zinc-500">Risk:</span> {s.risk}
      </span>
      <span>
        <span className="text-zinc-500">Validation:</span> {s.validation}
      </span>
      <span>
        <span className="text-zinc-500">Assumptions:</span> {s.assumptions}
      </span>
    </div>
  );
}

function StatusDot(props: { status: PipelineStageStatus | string }) {
  const cls =
    props.status === "Running"
      ? "bg-sky-400 animate-pulse"
      : props.status === "Succeeded" || props.status === "Completed"
        ? "bg-emerald-400"
        : props.status === "Failed"
          ? "bg-rose-400"
          : props.status === "Skipped"
            ? "bg-zinc-500"
            : props.status === "Cancelled"
              ? "bg-amber-400"
              : "bg-zinc-600";
  return (
    <span
      data-testid="status-dot"
      data-status={props.status}
      className={cn("inline-block h-2 w-2 rounded-full", cls)}
    />
  );
}

// ── helpers ─────────────────────────────────────────────────────────────────

function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function titleForRun(req: string): string {
  const trimmed = req.trim();
  if (!trimmed) return "Pipeline run";
  return trimmed.length > 60 ? trimmed.slice(0, 57) + "…" : trimmed;
}

function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
