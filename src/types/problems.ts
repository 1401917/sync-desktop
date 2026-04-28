import type {
  ErrorSeverity,
  ErrorSource,
  RepairAction,
  RepairActionKind,
  RepairPlan,
} from "./debug";
import type { DebugAttempt } from "./pipeline";

export type { DebugAttempt } from "./pipeline";
export type { RepairAction, RepairPlan } from "./debug";
export type { ErrorSeverity, ErrorSource, RepairActionKind } from "./debug";

export type ValidationOutcome = "passed" | "failed" | "noop";

export interface Problem {
  id: string;
  source: ErrorSource;
  severity: ErrorSeverity;
  code?: string;
  file?: string;
  line?: number;
  column?: number;
  message: string;
  groupSignature: string;
  derived: boolean;
  groupCount: number;
  suggestedAction?: RepairActionKind;
}

export interface ValidationSummary {
  totalErrors: number;
  totalWarnings: number;
  distinctFiles: number;
  derivedCount: number;
}

export interface ValidationReport {
  stageId: string;
  outcome: ValidationOutcome;
  attempt?: DebugAttempt;
  plan?: RepairPlan;
  problems: Problem[];
  topLevelActions: RepairAction[];
  summary: ValidationSummary;
}
