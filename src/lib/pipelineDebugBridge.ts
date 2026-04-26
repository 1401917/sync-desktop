import type { PipelineTracer } from "./pipelineTracer";
import { parseErrorOutput, runDebugLoop } from "./debugLoop";
import type {
  DebugDiagnosis,
  ErrorGroup,
  RepairAction,
  RepairPlan,
} from "../types/debug";
import type {
  Problem,
  ValidationReport,
  ValidationSummary,
} from "../types/problems";

export interface AttachDebugLoopOptions {
  /** Stage's resultSummary text on a successful pass. Default: "Validation passed". */
  successSummary?: string;
  /**
   * If parseErrorOutput finds 0 errors, treat as a pass and end the stage.
   * Default true. Set to false if the absence of recognizable errors should
   * leave the stage Running ("noop") instead.
   */
  noErrorsTreatedAsPass?: boolean;
}

// ── pure helpers ──────────────────────────────────────────────────────────

export function buildProblems(
  diagnosis: DebugDiagnosis,
  plan: RepairPlan
): Problem[] {
  const problems: Problem[] = [];
  let counter = 0;
  for (const g of diagnosis.groups) {
    counter += 1;
    const e = g.first;
    const action = findActionForGroup(g, plan.actions);
    problems.push({
      id: `problem_${counter}`,
      source: e.source,
      severity: e.severity,
      code: e.code,
      file: e.file,
      line: e.line,
      column: e.column,
      message: e.message,
      groupSignature: g.signature,
      derived: g.derived,
      groupCount: g.count,
      suggestedAction: action?.kind,
    });
  }
  return problems;
}

function findActionForGroup(
  g: ErrorGroup,
  actions: RepairAction[]
): RepairAction | undefined {
  if (g.derived) return undefined;
  return actions.find(
    (a) =>
      a.kind !== "revert-change" &&
      a.targetFile === g.first.file &&
      a.targetLine === g.first.line
  );
}

function summarize(diagnosis: DebugDiagnosis): ValidationSummary {
  const distinctFiles = new Set<string>();
  for (const g of diagnosis.groups) {
    if (g.first.file) distinctFiles.add(g.first.file);
  }
  return {
    totalErrors: diagnosis.totalErrors,
    totalWarnings: diagnosis.totalWarnings,
    distinctFiles: distinctFiles.size,
    derivedCount: diagnosis.derivedSignatures.length,
  };
}

function emptySummary(): ValidationSummary {
  return {
    totalErrors: 0,
    totalWarnings: 0,
    distinctFiles: 0,
    derivedCount: 0,
  };
}

function isOutputEmpty(raw: string): boolean {
  return raw.trim() === "";
}

// ── orchestrator ──────────────────────────────────────────────────────────

/**
 * Wrap a single Validate-style stage with the debug loop.
 *  - Empty/whitespace rawOutput → ends stage Succeeded, outcome "passed".
 *  - parseErrorOutput returns []:
 *      - default → ends stage Succeeded, outcome "passed".
 *      - noErrorsTreatedAsPass=false → leaves stage Running, outcome "noop".
 *  - Errors found → runs debugLoop (which fails the stage and creates the
 *    debug attempt), builds problems, returns outcome "failed".
 *
 * Caller's responsibility to pass a Running stage. Tracer's permissive
 * semantics apply if not.
 */
export function attachDebugLoopToStage(
  tracer: PipelineTracer,
  runId: string,
  stageId: string,
  rawOutput: string,
  options: AttachDebugLoopOptions = {}
): ValidationReport {
  const successSummary = options.successSummary ?? "Validation passed";
  const noErrorsTreatedAsPass = options.noErrorsTreatedAsPass ?? true;

  if (isOutputEmpty(rawOutput)) {
    tracer.endStage(runId, stageId, successSummary);
    return {
      stageId,
      outcome: "passed",
      problems: [],
      topLevelActions: [],
      summary: emptySummary(),
    };
  }

  const errors = parseErrorOutput(rawOutput);

  if (errors.length === 0) {
    if (noErrorsTreatedAsPass) {
      tracer.endStage(runId, stageId, successSummary);
      return {
        stageId,
        outcome: "passed",
        problems: [],
        topLevelActions: [],
        summary: emptySummary(),
      };
    }
    return {
      stageId,
      outcome: "noop",
      problems: [],
      topLevelActions: [],
      summary: emptySummary(),
    };
  }

  const { attempt, plan } = runDebugLoop(tracer, runId, rawOutput, { stageId });
  const diagnosis = plan.diagnosis;
  const problems = buildProblems(diagnosis, plan);
  const topLevelActions = plan.actions.filter(
    (a) => a.kind === "revert-change" && !a.targetFile
  );

  return {
    stageId,
    outcome: "failed",
    attempt,
    plan,
    problems,
    topLevelActions,
    summary: summarize(diagnosis),
  };
}

/**
 * Concatenate multiple tool outputs and run them through one validation pass.
 * Useful when a Validate stage gathers tsc + vitest + cargo + lint output
 * into a single report. Empty strings in the input array are filtered out.
 */
export function attachDebugLoopFromMultiple(
  tracer: PipelineTracer,
  runId: string,
  stageId: string,
  rawOutputs: string[],
  options?: AttachDebugLoopOptions
): ValidationReport {
  const combined = rawOutputs.filter((s) => s.length > 0).join("\n");
  return attachDebugLoopToStage(tracer, runId, stageId, combined, options);
}
