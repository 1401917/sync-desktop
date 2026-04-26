// Pipeline observability types. Pure data shapes — no logic, no imports.
// Backed by real state in PipelineTracer (src/lib/pipelineTracer.ts).

export type ExecutionMode = "Manual" | "Balanced" | "Autonomous" | "Safe";

export type PipelineStageKind =
  | "ClassifyRequest"
  | "AnalyzeProject"
  | "PlanTasks"
  | "SelectContext"
  | "DecideStrategy"
  | "Execute"
  | "Validate"
  | "Debug"
  | "Summarize";

export type PipelineStageStatus =
  | "Pending"
  | "Running"
  | "Succeeded"
  | "Failed"
  | "Skipped"
  | "Cancelled";

export type PipelineRunStatus =
  | "Idle"
  | "Running"
  | "Completed"
  | "Failed"
  | "Cancelled";

export interface PipelineStageCounters {
  filesScanned?: number;
  filesSelected?: number;
  errorsDetected?: number;
  dependenciesIdentified?: number;
  filesCreated?: number;
  filesModified?: number;
  linesAdded?: number;
  linesRemoved?: number;
  linesChanged?: number;
}

export interface PipelineStageError {
  message: string;
  parsed?: { file?: string; line?: number; ruleId?: string };
}

export interface PipelineStage {
  id: string;
  runId: string;
  kind: PipelineStageKind;
  label: string;
  status: PipelineStageStatus;
  startedAt?: number;   // performance.now() value, never invented
  endedAt?: number;     // performance.now() value, never invented
  durationMs?: number;  // endedAt - startedAt
  resultSummary?: string;
  counters: PipelineStageCounters;
  error?: PipelineStageError;
}

export interface PipelineDecision {
  selectedFiles: string[];
  reasons: string[];
  strategy: string[];
  tradeoffs?: string[];
  risks?: string[];
}

export interface LiveCodingMetrics {
  filesCreated: number;
  filesModified: number;
  linesAdded: number;
  linesRemoved: number;
  linesChanged: number;
  activeFile?: string;
}

export interface DebugAttempt {
  id: string;
  rawError: string;
  rootCause?: string;
  fixStrategy?: string;
  applied: boolean;
  resolved: boolean;
  startedAt: number;
  endedAt?: number;
  durationMs?: number;
}

export interface ConfidenceScore {
  value: number;                                      // clamped 0..1
  risk: "Low" | "Medium" | "High";
  validation: "Passed" | "Failed" | "Partial" | "NotRun";
  assumptions: number;
}

export interface PipelineRun {
  id: string;
  requestText: string;
  mode: ExecutionMode;
  status: PipelineRunStatus;
  startedAt: number;
  endedAt?: number;
  totalDurationMs?: number;
  stages: PipelineStage[];
  decision?: PipelineDecision;
  liveCoding: LiveCodingMetrics;
  debugAttempts: DebugAttempt[];
  confidence?: ConfidenceScore;
}
