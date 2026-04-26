import type {
  ConfidenceScore,
  DebugAttempt,
  ExecutionMode,
  LiveCodingMetrics,
  PipelineDecision,
  PipelineRun,
  PipelineRunStatus,
  PipelineStage,
  PipelineStageCounters,
  PipelineStageError,
  PipelineStageKind,
} from "../types/pipeline";

/**
 * Real, in-memory tracer for the observable pipeline.
 * - All timings come from the injected clock (defaults to performance.now()).
 * - No invented values. No setTimeout-based "fake progress".
 * - No coupling to UI, IPC, or storage.
 */

export type Clock = () => number;

const defaultClock: Clock = () =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

export type PipelineEvent =
  | { type: "run-started"; run: PipelineRun }
  | { type: "stage-started"; runId: string; stage: PipelineStage }
  | { type: "stage-ended"; runId: string; stage: PipelineStage }
  | { type: "stage-failed"; runId: string; stage: PipelineStage }
  | { type: "stage-skipped"; runId: string; stage: PipelineStage }
  | { type: "stage-counters-updated"; runId: string; stage: PipelineStage }
  | { type: "decision-recorded"; runId: string; decision: PipelineDecision }
  | { type: "metrics-updated"; runId: string; metrics: LiveCodingMetrics }
  | { type: "debug-started"; runId: string; attempt: DebugAttempt }
  | { type: "debug-ended"; runId: string; attempt: DebugAttempt }
  | { type: "confidence-recorded"; runId: string; confidence: ConfidenceScore }
  | { type: "run-ended"; run: PipelineRun };

export type PipelineEventListener = (event: PipelineEvent) => void;

const STAGE_LABELS: Record<PipelineStageKind, string> = {
  ClassifyRequest: "Classifying request",
  AnalyzeProject: "Analyzing project",
  PlanTasks: "Planning tasks",
  SelectContext: "Selecting context",
  DecideStrategy: "Deciding strategy",
  Execute: "Executing",
  Validate: "Validating",
  Debug: "Debugging",
  Summarize: "Summarizing",
};

function emptyMetrics(): LiveCodingMetrics {
  return {
    filesCreated: 0,
    filesModified: 0,
    linesAdded: 0,
    linesRemoved: 0,
    linesChanged: 0,
  };
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

export class PipelineTracer {
  private runs = new Map<string, PipelineRun>();
  private listeners = new Set<PipelineEventListener>();
  private counter = 0;
  private clock: Clock;

  constructor(clock: Clock = defaultClock) {
    this.clock = clock;
  }

  // --- subscription -------------------------------------------------------
  on(listener: PipelineEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  private emit(event: PipelineEvent): void {
    for (const l of this.listeners) l(event);
  }

  // --- run lifecycle ------------------------------------------------------
  startRun(input: { requestText: string; mode: ExecutionMode }): PipelineRun {
    const run: PipelineRun = {
      id: this.nextId("run"),
      requestText: input.requestText,
      mode: input.mode,
      status: "Running",
      startedAt: this.clock(),
      stages: [],
      liveCoding: emptyMetrics(),
      debugAttempts: [],
    };
    this.runs.set(run.id, run);
    this.emit({ type: "run-started", run });
    return run;
  }

  endRun(
    runId: string,
    status: Exclude<PipelineRunStatus, "Idle" | "Running">
  ): PipelineRun {
    const run = this.requireRun(runId);
    run.endedAt = this.clock();
    run.totalDurationMs = run.endedAt - run.startedAt;
    run.status = status;
    this.emit({ type: "run-ended", run });
    return run;
  }

  getRun(runId: string): PipelineRun | undefined {
    return this.runs.get(runId);
  }

  // --- stages -------------------------------------------------------------
  startStage(runId: string, kind: PipelineStageKind): PipelineStage {
    const run = this.requireRun(runId);
    const stage: PipelineStage = {
      id: this.nextId("stage"),
      runId,
      kind,
      label: STAGE_LABELS[kind],
      status: "Running",
      startedAt: this.clock(),
      counters: {},
    };
    run.stages.push(stage);
    this.emit({ type: "stage-started", runId, stage });
    return stage;
  }

  updateStageCounters(
    runId: string,
    stageId: string,
    partial: Partial<PipelineStageCounters>
  ): PipelineStage {
    const stage = this.requireStage(runId, stageId);
    stage.counters = { ...stage.counters, ...partial };
    this.emit({ type: "stage-counters-updated", runId, stage });
    return stage;
  }

  endStage(
    runId: string,
    stageId: string,
    resultSummary?: string
  ): PipelineStage {
    const stage = this.requireStage(runId, stageId);
    stage.endedAt = this.clock();
    stage.durationMs =
      stage.startedAt !== undefined ? stage.endedAt - stage.startedAt : 0;
    stage.status = "Succeeded";
    stage.resultSummary = resultSummary;
    this.emit({ type: "stage-ended", runId, stage });
    return stage;
  }

  failStage(
    runId: string,
    stageId: string,
    error: PipelineStageError
  ): PipelineStage {
    const stage = this.requireStage(runId, stageId);
    stage.endedAt = this.clock();
    stage.durationMs =
      stage.startedAt !== undefined ? stage.endedAt - stage.startedAt : 0;
    stage.status = "Failed";
    stage.error = error;
    this.emit({ type: "stage-failed", runId, stage });
    return stage;
  }

  skipStage(
    runId: string,
    kind: PipelineStageKind,
    reason?: string
  ): PipelineStage {
    const run = this.requireRun(runId);
    const stage: PipelineStage = {
      id: this.nextId("stage"),
      runId,
      kind,
      label: STAGE_LABELS[kind],
      status: "Skipped",
      counters: {},
      resultSummary: reason,
    };
    run.stages.push(stage);
    this.emit({ type: "stage-skipped", runId, stage });
    return stage;
  }

  // --- decision / metrics / debug / confidence ----------------------------
  recordDecision(runId: string, decision: PipelineDecision): void {
    const run = this.requireRun(runId);
    run.decision = decision;
    this.emit({ type: "decision-recorded", runId, decision });
  }

  updateMetrics(
    runId: string,
    partial: Partial<LiveCodingMetrics>
  ): LiveCodingMetrics {
    const run = this.requireRun(runId);
    run.liveCoding = { ...run.liveCoding, ...partial };
    this.emit({ type: "metrics-updated", runId, metrics: run.liveCoding });
    return run.liveCoding;
  }

  startDebugAttempt(runId: string, rawError: string): DebugAttempt {
    const run = this.requireRun(runId);
    const attempt: DebugAttempt = {
      id: this.nextId("debug"),
      rawError,
      applied: false,
      resolved: false,
      startedAt: this.clock(),
    };
    run.debugAttempts.push(attempt);
    this.emit({ type: "debug-started", runId, attempt });
    return attempt;
  }

  endDebugAttempt(
    runId: string,
    attemptId: string,
    outcome: {
      resolved: boolean;
      rootCause?: string;
      fixStrategy?: string;
      applied?: boolean;
    }
  ): DebugAttempt {
    const attempt = this.requireDebug(runId, attemptId);
    attempt.endedAt = this.clock();
    attempt.durationMs = attempt.endedAt - attempt.startedAt;
    attempt.resolved = outcome.resolved;
    if (outcome.rootCause !== undefined) attempt.rootCause = outcome.rootCause;
    if (outcome.fixStrategy !== undefined)
      attempt.fixStrategy = outcome.fixStrategy;
    if (outcome.applied !== undefined) attempt.applied = outcome.applied;
    this.emit({ type: "debug-ended", runId, attempt });
    return attempt;
  }

  recordConfidence(runId: string, confidence: ConfidenceScore): void {
    const run = this.requireRun(runId);
    const safe: ConfidenceScore = {
      ...confidence,
      value: clamp01(confidence.value),
    };
    run.confidence = safe;
    this.emit({ type: "confidence-recorded", runId, confidence: safe });
  }

  // --- pure measurement helpers ------------------------------------------
  measure<T>(fn: () => T): { value: T; durationMs: number } {
    const start = this.clock();
    const value = fn();
    return { value, durationMs: this.clock() - start };
  }

  async measureAsync<T>(
    fn: () => Promise<T>
  ): Promise<{ value: T; durationMs: number }> {
    const start = this.clock();
    const value = await fn();
    return { value, durationMs: this.clock() - start };
  }

  // --- internal -----------------------------------------------------------
  private nextId(prefix: string): string {
    this.counter += 1;
    return `${prefix}_${this.counter}`;
  }
  private requireRun(runId: string): PipelineRun {
    const r = this.runs.get(runId);
    if (!r) throw new Error(`PipelineTracer: unknown runId ${runId}`);
    return r;
  }
  private requireStage(runId: string, stageId: string): PipelineStage {
    const run = this.requireRun(runId);
    const s = run.stages.find((x) => x.id === stageId);
    if (!s)
      throw new Error(
        `PipelineTracer: unknown stageId ${stageId} in run ${runId}`
      );
    return s;
  }
  private requireDebug(runId: string, attemptId: string): DebugAttempt {
    const run = this.requireRun(runId);
    const a = run.debugAttempts.find((x) => x.id === attemptId);
    if (!a)
      throw new Error(
        `PipelineTracer: unknown debug attempt ${attemptId} in run ${runId}`
      );
    return a;
  }
}

export function createPipelineTracer(clock?: Clock): PipelineTracer {
  return new PipelineTracer(clock);
}
