import { describe, it, expect } from "vitest";
import {
  attachDebugLoopToStage,
  attachDebugLoopFromMultiple,
  buildProblems,
} from "../../src/lib/pipelineDebugBridge";
import { createPipelineTracer } from "../../src/lib/pipelineTracer";
import {
  diagnose,
  parseErrorOutput,
  planRepair,
} from "../../src/lib/debugLoop";

function setup() {
  const tracer = createPipelineTracer();
  const run = tracer.startRun({ requestText: "x", mode: "Balanced" });
  const stage = tracer.startStage(run.id, "Validate");
  return { tracer, runId: run.id, stageId: stage.id, stage };
}

describe("attachDebugLoopToStage", () => {
  it("returns 'passed' and ends the stage when output is empty", () => {
    const { tracer, runId, stageId, stage } = setup();
    const r = attachDebugLoopToStage(tracer, runId, stageId, "");
    expect(r.outcome).toBe("passed");
    expect(stage.status).toBe("Succeeded");
    expect(r.problems).toHaveLength(0);
    expect(r.attempt).toBeUndefined();
    expect(r.topLevelActions).toEqual([]);
  });

  it("returns 'passed' for whitespace-only output", () => {
    const { tracer, runId, stageId, stage } = setup();
    const r = attachDebugLoopToStage(tracer, runId, stageId, "   \n\n\t  \n");
    expect(r.outcome).toBe("passed");
    expect(stage.status).toBe("Succeeded");
  });

  it("returns 'passed' for plain text with no recognizable errors", () => {
    const { tracer, runId, stageId, stage } = setup();
    const r = attachDebugLoopToStage(
      tracer,
      runId,
      stageId,
      "build successful\nall good\n"
    );
    expect(r.outcome).toBe("passed");
    expect(stage.status).toBe("Succeeded");
  });

  it("returns 'noop' when noErrorsTreatedAsPass=false and no errors parsed", () => {
    const { tracer, runId, stageId, stage } = setup();
    const r = attachDebugLoopToStage(
      tracer,
      runId,
      stageId,
      "no errors here just text",
      { noErrorsTreatedAsPass: false }
    );
    expect(r.outcome).toBe("noop");
    expect(stage.status).toBe("Running");
    expect(r.problems).toEqual([]);
  });

  it("returns 'failed' and fails the stage for a single TS error", () => {
    const { tracer, runId, stageId, stage } = setup();
    const r = attachDebugLoopToStage(
      tracer,
      runId,
      stageId,
      "src/a.ts(5,3): error TS2304: Cannot find name 'foo'."
    );
    expect(r.outcome).toBe("failed");
    expect(stage.status).toBe("Failed");
    expect(r.problems).toHaveLength(1);
    const p = r.problems[0];
    expect(p.file).toBe("src/a.ts");
    expect(p.line).toBe(5);
    expect(p.column).toBe(3);
    expect(p.code).toBe("TS2304");
    expect(p.source).toBe("typescript");
    expect(p.severity).toBe("error");
    expect(p.suggestedAction).toBe("rename-symbol");
    expect(p.derived).toBe(false);
    expect(p.groupCount).toBe(1);
    expect(r.attempt).toBeDefined();
    expect(r.attempt?.applied).toBe(false);
    expect(r.attempt?.resolved).toBe(false);
    expect(r.attempt?.rootCause).toContain("TS2304");
    expect(r.plan?.actions[0].kind).toBe("rename-symbol");
  });

  it("produces N problems for N distinct errors and counts distinctFiles", () => {
    const { tracer, runId, stageId } = setup();
    const raw = [
      "src/a.ts(1,1): error TS2304: x.",
      "src/b.ts(2,2): error TS2307: y.",
      "src/c.ts(3,3): error TS1005: z.",
    ].join("\n");
    const r = attachDebugLoopToStage(tracer, runId, stageId, raw);
    expect(r.problems).toHaveLength(3);
    expect(r.summary.distinctFiles).toBe(3);
    expect(r.summary.totalErrors).toBe(3);
  });

  it("flags derived problems and counts derivedCount in summary", () => {
    const { tracer, runId, stageId } = setup();
    const raw = [
      "src/x.ts(10,5): error TS1005: bad.",
      "src/x.ts(20,3): error TS2339: a missing.",
      "src/x.ts(30,3): error TS2339: b missing.",
    ].join("\n");
    const r = attachDebugLoopToStage(tracer, runId, stageId, raw);
    const fix = r.problems.find((p) => p.code === "TS1005");
    const cascades = r.problems.filter((p) => p.code === "TS2339");
    expect(fix?.derived).toBe(false);
    expect(fix?.suggestedAction).toBe("fix-syntax");
    expect(cascades.every((p) => p.derived)).toBe(true);
    expect(cascades.every((p) => p.suggestedAction === undefined)).toBe(true);
    expect(r.summary.derivedCount).toBe(2);
  });

  it("surfaces cascade revert-change in topLevelActions, not per-problem", () => {
    const { tracer, runId, stageId } = setup();
    const raw = [
      "src/a.tsx(1,1): error TS1005: bad.",
      "src/b.tsx(1,1): error TS1005: bad.",
      "src/c.tsx(1,1): error TS17008: tag.",
      "src/d.tsx(1,1): error TS1127: invalid char.",
      "src/e.tsx(1,1): error TS1002: string.",
    ].join("\n");
    const r = attachDebugLoopToStage(tracer, runId, stageId, raw);
    expect(r.topLevelActions).toHaveLength(1);
    expect(r.topLevelActions[0].kind).toBe("revert-change");
    for (const p of r.problems) {
      expect(p.suggestedAction).not.toBe("revert-change");
    }
  });

  it("uses successSummary in the stage's resultSummary on pass", () => {
    const { tracer, runId, stageId, stage } = setup();
    attachDebugLoopToStage(tracer, runId, stageId, "", {
      successSummary: "TS check OK",
    });
    expect(stage.resultSummary).toBe("TS check OK");
  });

  it("collapses duplicate errors into one Problem with groupCount", () => {
    const { tracer, runId, stageId } = setup();
    const raw = [
      "src/a.ts(1,1): error TS2304: x.",
      "src/a.ts(1,1): error TS2304: x.",
      "src/a.ts(1,1): error TS2304: x.",
    ].join("\n");
    const r = attachDebugLoopToStage(tracer, runId, stageId, raw);
    expect(r.problems).toHaveLength(1);
    expect(r.problems[0].groupCount).toBe(3);
  });

  it("exposes the same plan and diagnosis as a direct debugLoop call", () => {
    const { tracer, runId, stageId } = setup();
    const raw = "src/a.ts(5,3): error TS2304: Cannot find 'foo'.";
    const r = attachDebugLoopToStage(tracer, runId, stageId, raw);
    expect(r.plan).toBeDefined();
    expect(r.plan?.diagnosis.totalErrors).toBe(1);
    expect(r.plan?.actions[0].kind).toBe("rename-symbol");
  });
});

describe("attachDebugLoopFromMultiple", () => {
  it("concatenates outputs and matches the combined-string result", () => {
    const a = setup();
    const b = setup();
    const tscOut = "src/a.ts(1,1): error TS2304: x.";
    const cargoOut = ["error[E0277]: trait", "  --> src/b.rs:3:1"].join("\n");
    const combined = tscOut + "\n" + cargoOut;
    const r1 = attachDebugLoopFromMultiple(a.tracer, a.runId, a.stageId, [
      tscOut,
      cargoOut,
    ]);
    const r2 = attachDebugLoopToStage(b.tracer, b.runId, b.stageId, combined);
    expect(r1.outcome).toBe(r2.outcome);
    expect(r1.problems.length).toBe(r2.problems.length);
    expect(r1.summary.totalErrors).toBe(r2.summary.totalErrors);
  });

  it("treats an empty array as 'passed'", () => {
    const { tracer, runId, stageId, stage } = setup();
    const r = attachDebugLoopFromMultiple(tracer, runId, stageId, []);
    expect(r.outcome).toBe("passed");
    expect(stage.status).toBe("Succeeded");
  });

  it("filters out empty strings before concatenation", () => {
    const { tracer, runId, stageId } = setup();
    const r = attachDebugLoopFromMultiple(tracer, runId, stageId, [
      "",
      "src/a.ts(1,1): error TS2304: x.",
      "",
    ]);
    expect(r.outcome).toBe("failed");
    expect(r.problems).toHaveLength(1);
  });
});

describe("buildProblems (pure)", () => {
  it("maps each group to a Problem with derived + groupCount + suggestedAction", () => {
    const errs = parseErrorOutput(
      [
        "src/x.ts(10,5): error TS1005: ')' expected.",
        "src/x.ts(20,3): error TS2339: a.",
        "src/x.ts(30,3): error TS2339: b.",
      ].join("\n")
    );
    const d = diagnose(errs);
    const plan = planRepair(d);
    const problems = buildProblems(d, plan);
    expect(problems).toHaveLength(3);
    const fix = problems.find((p) => p.code === "TS1005");
    expect(fix?.derived).toBe(false);
    expect(fix?.suggestedAction).toBe("fix-syntax");
    const cascades = problems.filter((p) => p.code === "TS2339");
    expect(cascades.every((p) => p.derived)).toBe(true);
    expect(cascades.every((p) => p.suggestedAction === undefined)).toBe(true);
  });

  it("returns an empty array for an empty diagnosis", () => {
    const d = diagnose([]);
    const plan = planRepair(d);
    expect(buildProblems(d, plan)).toEqual([]);
  });
});
