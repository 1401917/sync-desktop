// Debug-loop data shapes. Pure types, zero imports.
// Used by src/lib/debugLoop.ts to parse raw command output into structured
// errors, group them, identify the root error, and produce a repair plan.

export type ErrorSource =
  | "typescript"
  | "rust"
  | "vite"
  | "vitest"
  | "npm"
  | "generic";

export type ErrorSeverity = "error" | "warning" | "info";

export interface ParsedError {
  source: ErrorSource;
  severity: ErrorSeverity;
  code?: string;
  file?: string;
  line?: number;
  column?: number;
  message: string;
  raw: string;
}

export interface ErrorGroup {
  signature: string;
  count: number;
  first: ParsedError;
  occurrences: ParsedError[];
  /** True when classified as a cascade (derived) from another error in the same file. */
  derived: boolean;
}

export interface DebugDiagnosis {
  groups: ErrorGroup[];
  /** First non-warning, non-derived error in input order. */
  rootError: ParsedError | undefined;
  /** Signatures of groups that were classified as cascades. */
  derivedSignatures: string[];
  totalErrors: number;
  totalWarnings: number;
  bySource: Record<ErrorSource, number>;
}

export type RepairActionKind =
  | "edit-file"
  | "add-import"
  | "install-dep"
  | "update-dependency"
  | "fix-syntax"
  | "rename-symbol"
  | "revert-change"
  | "manual-investigation";

export interface RepairAction {
  kind: RepairActionKind;
  description: string;
  targetFile?: string;
  targetLine?: number;
  rationale: string;
}

export interface RepairPlan {
  diagnosis: DebugDiagnosis;
  actions: RepairAction[];
  /** Strict tier-based confidence in [0,1]. Never fuzzy. */
  confidence: number;
  notes: string[];
}
