import { useEffect, useReducer, useState } from "react";
import type { PipelineTracer } from "./pipelineTracer";
import type { PipelineRun, PipelineStage } from "../types/pipeline";

export interface UsePipelineTracerOptions {
  /** Cadence (ms) for re-reading the live "now" while a run is Running. 0/null disables. */
  tickMs?: number;
  /** Override clock for tests. Defaults to performance.now(). */
  clock?: () => number;
}

export interface UsePipelineTracerResult {
  run: PipelineRun | undefined;
  now: number;
  /** Real elapsed time for a stage. Uses recorded duration if ended, else now - startedAt. Never invented. */
  elapsedMs: (stage: PipelineStage) => number;
  /** Real elapsed time for the run. Uses totalDurationMs if ended, else now - startedAt. */
  totalElapsedMs: () => number;
  activeStage: PipelineStage | undefined;
}

const defaultClock = () =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

export function usePipelineTracer(
  tracer: PipelineTracer,
  runId: string | undefined,
  options: UsePipelineTracerOptions = {}
): UsePipelineTracerResult {
  const tickMs = options.tickMs ?? 250;
  const clock = options.clock ?? defaultClock;

  // Force re-render on tracer events. Tracer mutates state in place,
  // so we can't rely on referential change detection.
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const [now, setNow] = useState<number>(() => clock());

  useEffect(() => {
    return tracer.on(() => bump());
  }, [tracer]);

  // Tick clock only while the run is actually Running.
  useEffect(() => {
    if (!tickMs) return;
    const run = runId ? tracer.getRun(runId) : undefined;
    if (!run || run.status !== "Running") return;
    const id = setInterval(() => setNow(clock()), tickMs);
    return () => clearInterval(id);
    // bump-driven re-renders feed runId/status changes back through here
  }, [tracer, runId, tickMs, clock, tracerVersion(tracer, runId)]);

  const run = runId ? tracer.getRun(runId) : undefined;
  const activeStage = run?.stages.find((s) => s.status === "Running");

  return {
    run,
    now,
    elapsedMs(stage) {
      if (stage.durationMs !== undefined) return stage.durationMs;
      if (stage.startedAt === undefined) return 0;
      return Math.max(0, now - stage.startedAt);
    },
    totalElapsedMs() {
      if (!run) return 0;
      if (run.totalDurationMs !== undefined) return run.totalDurationMs;
      return Math.max(0, now - run.startedAt);
    },
    activeStage,
  };
}

// Lightweight version key so the tick effect re-evaluates when the run's status changes.
function tracerVersion(
  tracer: PipelineTracer,
  runId: string | undefined
): string {
  if (!runId) return "no-run";
  const run = tracer.getRun(runId);
  return run ? `${run.id}:${run.status}:${run.stages.length}` : "missing";
}
