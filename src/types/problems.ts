import type {
  ErrorSeverity,
  ErrorSource,
  RepairAction,
  RepairActionKind,
  RepairPlan,
} from "./debug";
import type { DebugAttempt } from "./pipeline";

// Re-export the supporting types so consumers of the bridge only need
// to import from one module.
export type { DebugAttempt, RepairAction, RepairPlan } from "./debug";
export type { ErrorSeverity, ErrorSource, RepairActionKind } from "./debug";

export type ValidationOutcome = "passed" | "failed" | "noop";

/**
 * A single Problems-Panel-shaped record. One Problem per distinct error group
 * (cascades produce derived=true entries — UI can hide or fade them).
 */
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
  /**
   * Actions that don't attach to a single file/line — e.g. cascade revert-change.
   * Render at the top of a Problems Panel as banner-style suggestions.
   */
  topLevelActions: RepairAction[];
  summary: ValidationSummary;
}
