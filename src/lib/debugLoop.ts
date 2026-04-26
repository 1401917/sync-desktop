import type { PipelineTracer } from "./pipelineTracer";
import type { DebugAttempt } from "../types/pipeline";
import type {
  DebugDiagnosis,
  ErrorGroup,
  ErrorSeverity,
  ErrorSource,
  ParsedError,
  RepairAction,
  RepairActionKind,
  RepairPlan,
} from "../types/debug";

// ── Single-line parsers ────────────────────────────────────────────────────
type LineParser = (line: string) => ParsedError | null;

// TypeScript: "src/x.ts(42,7): error TS2339: Property 'status' does not exist"
const tsRe = /^(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s*(.+)$/;
function parseTypescript(line: string): ParsedError | null {
  const m = tsRe.exec(line);
  if (!m) return null;
  return {
    source: "typescript",
    severity: m[4] as ErrorSeverity,
    file: m[1],
    line: parseInt(m[2], 10),
    column: parseInt(m[3], 10),
    code: m[5],
    message: m[6].trim(),
    raw: line,
  };
}

// npm: "npm ERR! code ENOENT" / "npm ERR! something failed"
const npmRe = /^npm (?:ERR!|error)\s*(?:code\s+(\w+)\s+)?(.+)$/;
function parseNpm(line: string): ParsedError | null {
  const m = npmRe.exec(line);
  if (!m) return null;
  return {
    source: "npm",
    severity: "error",
    code: m[1],
    message: m[2].trim(),
    raw: line,
  };
}

// Vite/esbuild: "src/x.ts:42:7: error: Unterminated string"
const viteEsbuildRe = /^(.+?):(\d+):(\d+):\s*(error|warning):\s*(.+)$/;
// Vite plugin: "[plugin:vite:react] Error: ..."
const vitePluginRe = /^\[plugin:[^\]]+\]\s*(?:Error:\s*)?(.+)$/;
function parseVite(line: string): ParsedError | null {
  const m = viteEsbuildRe.exec(line);
  if (m) {
    return {
      source: "vite",
      severity: m[4] as ErrorSeverity,
      file: m[1],
      line: parseInt(m[2], 10),
      column: parseInt(m[3], 10),
      message: m[5].trim(),
      raw: line,
    };
  }
  const p = vitePluginRe.exec(line);
  if (p) {
    return { source: "vite", severity: "error", message: p[1].trim(), raw: line };
  }
  return null;
}

// Generic last-resort: "Error: ..." / "ERR: ..." / "error: ..."
const genericRe = /^(?:Error|ERR|error):\s*(.+)$/;
function parseGeneric(line: string): ParsedError | null {
  const m = genericRe.exec(line);
  if (!m) return null;
  return { source: "generic", severity: "error", message: m[1].trim(), raw: line };
}

const SINGLE_LINE_PARSERS: LineParser[] = [
  parseTypescript,
  parseNpm,
  parseVite,
  parseGeneric,
];

// ── Streaming parser (multi-line: Rust, Vitest) ───────────────────────────
const rustHeadRe = /^(error|warning)(?:\[(E\d+|[\w-]+)\])?:\s*(.+)$/;
const rustLocRe = /^\s*-->\s+(.+?):(\d+):(\d+)\s*$/;
// Bare `Error:` deliberately excluded — it's the generic parser's domain.
// Real vitest output uses AssertionError or TypeError as the head.
const vitestAssertRe = /^(AssertionError|TypeError):\s*(.+)$/;
const vitestLocRe = /^\s*[❯>]\s+(.+?):(\d+):(\d+)\s*$/;

class StreamingParser {
  private out: ParsedError[] = [];
  private pendRust:
    | { severity: ErrorSeverity; code?: string; message: string; raw: string }
    | null = null;
  private pendVitest: { message: string; raw: string } | null = null;

  feed(line: string): void {
    if (this.pendRust) {
      const rl = rustLocRe.exec(line);
      if (rl) {
        this.out.push({
          source: "rust",
          severity: this.pendRust.severity,
          code: this.pendRust.code,
          file: rl[1],
          line: parseInt(rl[2], 10),
          column: parseInt(rl[3], 10),
          message: this.pendRust.message,
          raw: this.pendRust.raw + "\n" + line,
        });
        this.pendRust = null;
        return;
      }
      this.out.push({
        source: "generic",
        severity: this.pendRust.severity,
        code: this.pendRust.code,
        message: this.pendRust.message,
        raw: this.pendRust.raw,
      });
      this.pendRust = null;
    }

    if (this.pendVitest) {
      const vl = vitestLocRe.exec(line);
      if (vl) {
        this.out.push({
          source: "vitest",
          severity: "error",
          file: vl[1],
          line: parseInt(vl[2], 10),
          column: parseInt(vl[3], 10),
          message: this.pendVitest.message,
          raw: this.pendVitest.raw + "\n" + line,
        });
        this.pendVitest = null;
        return;
      }
      if (line.trim() !== "") {
        this.out.push({
          source: "vitest",
          severity: "error",
          message: this.pendVitest.message,
          raw: this.pendVitest.raw,
        });
        this.pendVitest = null;
      } else {
        return;
      }
    }

    const rh = rustHeadRe.exec(line);
    if (rh && rh[2] && rh[2].startsWith("E")) {
      this.pendRust = {
        severity: rh[1] as ErrorSeverity,
        code: rh[2],
        message: rh[3].trim(),
        raw: line,
      };
      return;
    }

    const va = vitestAssertRe.exec(line);
    if (va) {
      this.pendVitest = { message: va[2].trim(), raw: line };
      return;
    }

    for (const p of SINGLE_LINE_PARSERS) {
      const r = p(line);
      if (r) {
        this.out.push(r);
        return;
      }
    }
  }

  flush(): ParsedError[] {
    if (this.pendRust) {
      this.out.push({
        source: "generic",
        severity: this.pendRust.severity,
        code: this.pendRust.code,
        message: this.pendRust.message,
        raw: this.pendRust.raw,
      });
      this.pendRust = null;
    }
    if (this.pendVitest) {
      this.out.push({
        source: "vitest",
        severity: "error",
        message: this.pendVitest.message,
        raw: this.pendVitest.raw,
      });
      this.pendVitest = null;
    }
    return this.out;
  }
}

// ── Public API ────────────────────────────────────────────────────────────
export function parseErrorOutput(raw: string): ParsedError[] {
  const sp = new StreamingParser();
  for (const line of raw.split(/\r?\n/)) sp.feed(line);
  return sp.flush();
}

const PARSE_CLASS_TS = new Set([
  "TS1002",
  "TS1005",
  "TS1127",
  "TS17002",
  "TS17008",
]);

function isParseClass(e: ParsedError): boolean {
  return (
    e.source === "typescript" &&
    e.code !== undefined &&
    PARSE_CLASS_TS.has(e.code)
  );
}

function signatureOf(e: ParsedError): string {
  return `${e.source}|${e.code ?? ""}|${e.file ?? ""}|${e.line ?? ""}|${e.column ?? ""}|${e.message}`;
}

export function diagnose(errors: ParsedError[]): DebugDiagnosis {
  const groupMap = new Map<string, ErrorGroup>();
  const bySource: Record<ErrorSource, number> = {
    typescript: 0,
    rust: 0,
    vite: 0,
    vitest: 0,
    npm: 0,
    generic: 0,
  };
  let totalErrors = 0;
  let totalWarnings = 0;

  for (const e of errors) {
    const sig = signatureOf(e);
    const existing = groupMap.get(sig);
    if (existing) {
      existing.count += 1;
      existing.occurrences.push(e);
    } else {
      groupMap.set(sig, {
        signature: sig,
        count: 1,
        first: e,
        occurrences: [e],
        derived: false,
      });
    }
    bySource[e.source] += 1;
    if (e.severity === "warning") totalWarnings += 1;
    else totalErrors += 1;
  }

  const groups = Array.from(groupMap.values());

  // Cascade detection: if a file has ≥3 errors and exactly one parse-class
  // error, the parse-class is the head and the rest are derived.
  const fileToGroups = new Map<string, ErrorGroup[]>();
  for (const g of groups) {
    const f = g.first.file;
    if (!f) continue;
    const list = fileToGroups.get(f) ?? [];
    list.push(g);
    fileToGroups.set(f, list);
  }
  for (const list of fileToGroups.values()) {
    if (list.length < 3) continue;
    const parseClassGroups = list.filter((g) => isParseClass(g.first));
    if (parseClassGroups.length === 1) {
      for (const g of list) {
        if (!isParseClass(g.first)) g.derived = true;
      }
    }
  }

  const root =
    errors.find((e) => {
      const g = groupMap.get(signatureOf(e));
      return e.severity !== "warning" && g !== undefined && !g.derived;
    }) ??
    errors.find((e) => e.severity !== "warning") ??
    errors[0];

  const derivedSignatures = groups
    .filter((g) => g.derived)
    .map((g) => g.signature);

  return {
    groups,
    rootError: root,
    derivedSignatures,
    totalErrors,
    totalWarnings,
    bySource,
  };
}

export function planRepair(diagnosis: DebugDiagnosis): RepairPlan {
  const actions: RepairAction[] = [];
  const notes: string[] = [];

  // Cascade-revert: ≥5 distinct files with parse-class TS errors
  const filesWithParseClass = new Set<string>();
  for (const g of diagnosis.groups) {
    if (isParseClass(g.first) && g.first.file)
      filesWithParseClass.add(g.first.file);
  }
  const cascadeRevert = filesWithParseClass.size >= 5;

  if (cascadeRevert) {
    actions.push({
      kind: "revert-change",
      description: `Revert recent edit — ${filesWithParseClass.size} files have parse-class errors simultaneously`,
      rationale: "Strong signal of a broken refactor or partial commit",
    });
    notes.push(
      `Cascade signal: ${filesWithParseClass.size} files have TS parse-class errors.`
    );
  }

  for (const g of diagnosis.groups) {
    if (g.derived) continue;
    actions.push(inferAction(g.first));
  }

  if (diagnosis.totalErrors === 0 && diagnosis.totalWarnings > 0) {
    notes.push("Only warnings detected — build may still succeed.");
  }
  if (diagnosis.groups.length === 0) {
    notes.push("No errors parsed — output may be in an unsupported format.");
  }
  if (diagnosis.totalErrors > 50) {
    notes.push("High error count — likely a cascade from a single root cause.");
  }
  if (diagnosis.derivedSignatures.length > 0) {
    notes.push(
      `${diagnosis.derivedSignatures.length} group(s) classified as derived (cascade).`
    );
  }

  let confSum = 0;
  let confN = 0;
  for (const a of actions) {
    const sourceGroup = findGroupForAction(a, diagnosis);
    const sourceError =
      a.kind === "revert-change"
        ? diagnosis.rootError ?? diagnosis.groups[0]?.first
        : sourceGroup?.first;
    const count =
      a.kind === "revert-change"
        ? filesWithParseClass.size
        : sourceGroup?.count ?? 1;
    confSum += tierConfidence(a, sourceError, count, cascadeRevert);
    confN += 1;
  }
  const confidence = confN === 0 ? 0 : confSum / confN;

  return { diagnosis, actions, confidence, notes };
}

function findGroupForAction(
  a: RepairAction,
  d: DebugDiagnosis
): ErrorGroup | undefined {
  if (!a.targetFile) {
    return d.groups.find(
      (g) => !g.derived && g.first.message === a.rationale
    );
  }
  return d.groups.find(
    (g) =>
      !g.derived &&
      g.first.file === a.targetFile &&
      g.first.line === a.targetLine
  );
}

function inferAction(e: ParsedError): RepairAction {
  if (e.source === "typescript" && e.code) {
    switch (e.code) {
      case "TS2304":
      case "TS2552":
        return mk("rename-symbol", `Resolve unknown identifier in ${e.file ?? "?"}`, e);
      case "TS2307":
        return mk("add-import", `Add or fix import in ${e.file ?? "?"}`, e);
      case "TS1002":
      case "TS1005":
      case "TS1127":
      case "TS17002":
      case "TS17008":
        return mk("fix-syntax", `Fix syntax in ${e.file ?? "?"}`, e);
      default:
        return mk("edit-file", `Adjust types in ${e.file ?? "?"}`, e);
    }
  }
  if (e.source === "rust") {
    if (e.code === "E0658") {
      return {
        kind: "revert-change",
        description: `Revert change touching unstable feature in ${e.file ?? "?"}`,
        targetFile: e.file,
        targetLine: e.line,
        rationale: e.code ? `${e.code}: ${e.message}` : e.message,
      };
    }
    return mk("edit-file", `Fix Rust ${e.code ?? "issue"} in ${e.file ?? "?"}`, e);
  }
  if (e.source === "npm") {
    const code = e.code ?? "";
    if (code === "ENOENT" || /not found|missing|cannot find/i.test(e.message)) {
      return {
        kind: "install-dep",
        description: "Install missing npm dependency",
        rationale: e.message,
      };
    }
    if (
      ["EBADENGINE", "ETARGET", "ERESOLVE", "EPEERINVALID"].includes(code) ||
      /incompatible|requires version|peer dep/i.test(e.message)
    ) {
      return {
        kind: "update-dependency",
        description: "Update or align npm dependency versions",
        rationale: code ? `${code}: ${e.message}` : e.message,
      };
    }
    return {
      kind: "manual-investigation",
      description: "Inspect npm error",
      rationale: e.message,
    };
  }
  if ((e.source === "vite" || e.source === "vitest") && e.file) {
    return mk("edit-file", `Fix in ${e.file}`, e);
  }
  return {
    kind: "manual-investigation",
    description: "Manual investigation needed",
    rationale: e.message,
  };
}

function mk(
  kind: RepairActionKind,
  description: string,
  e: ParsedError
): RepairAction {
  return {
    kind,
    description,
    targetFile: e.file,
    targetLine: e.line,
    rationale: e.code ? `${e.code}: ${e.message}` : e.message,
  };
}

function tierConfidence(
  a: RepairAction,
  e: ParsedError | undefined,
  count: number,
  isCascadeRevert: boolean
): number {
  if (a.kind === "manual-investigation") return 0.25;
  if (a.kind === "revert-change" && isCascadeRevert) return 0.5;

  const hasFile = !!a.targetFile;
  const hasLine = a.targetLine !== undefined;
  const hasCode = !!e?.code;

  if (!hasFile) return 0.25;
  if (hasFile && !hasLine)
    return Math.min(0.6, 0.45 + (hasCode ? 0.1 : 0));

  const heuristicMatch =
    a.kind === "fix-syntax" ||
    a.kind === "rename-symbol" ||
    a.kind === "add-import" ||
    a.kind === "install-dep" ||
    a.kind === "update-dependency";

  if (hasFile && hasLine && hasCode && heuristicMatch) {
    let c = 0.85;
    if (count > 5) c -= 0.05;
    return Math.min(0.95, Math.max(0.8, c));
  }
  if (hasFile && hasLine && hasCode) {
    let c = 0.78;
    if (count > 5) c -= 0.05;
    return Math.min(0.85, Math.max(0.7, c));
  }
  if (hasFile && hasLine) return 0.65;
  return 0.5;
}

// ── Tracer integration ────────────────────────────────────────────────────
export interface RunDebugLoopOptions {
  stageId?: string;
}

export interface DebugLoopResult {
  attempt: DebugAttempt;
  plan: RepairPlan;
}

export function runDebugLoop(
  tracer: PipelineTracer,
  runId: string,
  rawError: string,
  options: RunDebugLoopOptions = {}
): DebugLoopResult {
  const attempt = tracer.startDebugAttempt(runId, rawError);
  const errors = parseErrorOutput(rawError);
  const diagnosis = diagnose(errors);
  const plan = planRepair(diagnosis);

  const root = diagnosis.rootError;
  const rootCause = root
    ? `${root.code ?? root.source}: ${root.message}`
    : "No structured error parsed";
  const fixStrategy =
    plan.actions.length > 0
      ? plan.actions.map((a) => a.description).join(" → ")
      : "Manual investigation";

  if (options.stageId && root) {
    tracer.failStage(runId, options.stageId, {
      message: rootCause,
      parsed: root.file
        ? { file: root.file, line: root.line, ruleId: root.code }
        : undefined,
    });
  }

  const ended = tracer.endDebugAttempt(runId, attempt.id, {
    resolved: false,
    rootCause,
    fixStrategy,
    applied: false,
  });
  return { attempt: ended, plan };
}
