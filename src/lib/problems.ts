/**
 * Problems are structured records — TypeScript errors, Rust errors, lint
 * warnings, build failures, security warnings, etc. Each problem can be
 * surfaced in the Problems tab and "Ask AI to fix" passes the structured
 * record to the next AI prompt.
 */

export type ProblemSeverity = "error" | "warning" | "info";

export interface ProblemItem {
  id: string;
  severity: ProblemSeverity;
  message: string;
  filePath: string;
  line?: number;
  column?: number;
  source?: string; // e.g. "tsc", "cargo", "vite", "user"
  taskId?: string;
  ignored?: boolean;
}
