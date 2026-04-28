import type { ExecutionMode } from "./pipeline";

export type DiffPlanOpKind = "create" | "update" | "delete";

export type OperationRisk = "Low" | "Medium" | "High" | "Critical";

export type DiffPlanBlockReason =
  | "sensitive"
  | "unsafe-path"
  | "binary"
  | "too-large"
  | null;

export interface DiffPlanOp {
  path: string;
  kind: DiffPlanOpKind;
  /** File contents on disk before the proposed change. null when file does not exist. */
  before_content: string | null;
  /** File contents that would be written. null when kind === "delete". */
  after_content: string | null;
  blocked: boolean;
  block_reason: DiffPlanBlockReason;
}

export interface ApprovedOp {
  path: string;
  kind: DiffPlanOpKind;
  /** Required for "create" / "update". Not used by "delete". */
  content: string | null;
}

export interface ApplyError {
  path: string;
  message: string;
}

export interface ApplyBlocked {
  path: string;
  reason: string;
}

export interface ApplyResult {
  applied: string[];
  errors: ApplyError[];
  blocked: ApplyBlocked[];
}

export type ApprovalDecision = "auto-approve" | "requires-approval";

export type { ExecutionMode };
