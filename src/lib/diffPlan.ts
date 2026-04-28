// Diff plan logic for Phase B.
// Risk classification, approval decisions, and critical config detection.

import type {
  DiffPlanOp,
  OperationRisk,
  ApprovalDecision,
  ExecutionMode,
} from "../types/diffPlan";
import { percentLinesChanged } from "./lineDiff";

const CRITICAL_CONFIG_FILES = new Set([
  "package.json",
  "Cargo.toml",
  "tsconfig.json",
  "vite.config.ts",
  "tailwind.config.ts",
]);

export function isCriticalConfigPath(path: string): boolean {
  // Match basename — root-level OR nested. Also matches Windows-style separators.
  const basename = path.replace(/\\/g, "/").split("/").pop() ?? "";
  return CRITICAL_CONFIG_FILES.has(basename);
}

export function classifyRisk(op: DiffPlanOp): OperationRisk {
  if (op.kind === "delete") return "Critical";
  if (isCriticalConfigPath(op.path)) return "Critical";
  if (op.blocked && (op.block_reason === "sensitive" || op.block_reason === "unsafe-path")) return "High";
  if (op.kind === "update") {
    const pct = percentLinesChanged(op.before_content, op.after_content);
    if (pct > 75) return "High";
    if (pct > 50) return "Medium";
    return "Low";
  }
  if (op.kind === "create" && (op.after_content?.length ?? 0) > 5 * 1024) return "Medium";
  return "Low";
}

export function resolveApprovalDecision(op: DiffPlanOp, mode: ExecutionMode): ApprovalDecision {
  if (op.blocked) return "requires-approval"; // moot — UI hard-disables approve
  // PHASE B: every op requires approval. Future relaxation flips here.
  return "requires-approval";
}