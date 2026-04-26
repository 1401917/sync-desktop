import { describe, it, expect } from "vitest";
import {
  createPipelineTracer,
  type Clock,
} from "../../src/lib/pipelineTracer";

// Deterministic clock: each call advances by a fixed step.
function stepClock(stepMs = 10): Clock {
  let t = 1000;
  return () => {
    const v = t;
    t += stepMs;
    return v;
  };
}

describe("PipelineTracer", () => {
  it("starts a run with Running status and a real startedAt", () => {
    const tracer = createPipelineTracer(stepClock());
    const run = tracer.startRun({ requestText: "demo", mode: "Balanced" });
    expect(run.status).toBe("Running");
    expect(run.startedAt).toBeGreaterThan(0);
    expect(run.stages).toEqual([]);
    expect(run.liveCoding.filesCreated).toBe(0);
  });

  it("records real positive durations on stages", () => {
    const tracer = createPipelineTracer(stepClock(25));
    const run = tracer.startRun({ requestText: "x", mode: "Manual" });
    const s = tracer.startStage(run.id, "AnalyzeProject");
    const ended = tracer.endStage(run.id, s.id, "scanned 12 files");
    expect(ended.status).toBe("Succeeded");
    expect(ended.durationMs).toBe(25);
    expect(ended.resultSummary).toBe("scanned 12 files");
  });

  it("preserves stage insertion order", () => {
    const tracer = createPipelineTracer(stepClock());
    const run = tracer.startRun({ requestText: "x", mode: "Balanced" });
    const a = tracer.startStage(run.id, "ClassifyRequest");
    tracer.endStage(run.id, a.id);
    const b = tracer.startStage(run.id, "AnalyzeProject");
    tracer.endStage(run.id, b.id);
    const c = tracer.startStage(run.id, "PlanTasks");
    tracer.endStage(run.id, c.id);
    expect(run.stages.map((s) => s.kind)).toEqual([
      "ClassifyRequest",
      "AnalyzeProject",
      "PlanTasks",
    ]);
  });

  it("transitions a stage to Failed and records error", () => {
    const tracer = createPipelineTracer(stepClock());
    const run = tracer.startRun({ requestText: "x", mode: "Balanced" });
    const s = tracer.startStage(run.id, "Execute");
    const failed = tracer.failStage(run.id, s.id, {
      message: "TS2339: Property 'status' does not exist",
      parsed: { file: "src/x.ts", line: 42, ruleId: "TS2339" },
    });
    expect(failed.status).toBe("Failed");
    expect(failed.error?.parsed?.line).toBe(42);
    expect(failed.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("merges stage counters via updateStageCounters", () => {
    const tracer = createPipelineTracer(stepClock());
    const run = tracer.startRun({ requestText: "x", mode: "Balanced" });
    const s = tracer.startStage(run.id, "AnalyzeProject");
    tracer.updateStageCounters(run.id, s.id, { filesScanned: 4 });
    tracer.updateStageCounters(run.id, s.id, {
      filesSelected: 2,
      errorsDetected: 1,
    });
    expect(s.counters).toEqual({
      filesScanned: 4,
      filesSelected: 2,
      errorsDetected: 1,
    });
  });

  it("stores a decision and live-coding metrics", () => {
    const tracer = createPipelineTracer(stepClock());
    const run = tracer.startRun({ requestText: "x", mode: "Balanced" });
    tracer.recordDecision(run.id, {
      selectedFiles: ["src/a.ts"],
      reasons: ["touched type"],
      strategy: ["edit", "test"],
    });
    tracer.updateMetrics(run.id, { filesModified: 1, linesAdded: 10 });
    expect(run.decision?.selectedFiles).toEqual(["src/a.ts"]);
    expect(run.liveCoding.linesAdded).toBe(10);
  });

  it("tracks debug attempts with real durations", () => {
    const tracer = createPipelineTracer(stepClock(50));
    const run = tracer.startRun({ requestText: "x", mode: "Balanced" });
    const a = tracer.startDebugAttempt(
      run.id,
      "TS2339: Property 'status' does not exist"
    );
    const ended = tracer.endDebugAttempt(run.id, a.id, {
      resolved: true,
      rootCause: "Type mismatch in Task type",
      fixStrategy: "Extend Task interface",
      applied: true,
    });
    expect(ended.resolved).toBe(true);
    expect(ended.durationMs).toBe(50);
    expect(ended.rootCause).toBe("Type mismatch in Task type");
  });

  it("clamps confidence value to [0,1]", () => {
    const tracer = createPipelineTracer(stepClock());
    const run = tracer.startRun({ requestText: "x", mode: "Balanced" });
    tracer.recordConfidence(run.id, {
      value: 1.7,
      risk: "Medium",
      validation: "Passed",
      assumptions: 2,
    });
    expect(run.confidence?.value).toBe(1);
    tracer.recordConfidence(run.id, {
      value: -0.3,
      risk: "High",
      validation: "Failed",
      assumptions: 5,
    });
    expect(run.confidence?.value).toBe(0);
  });

  it("computes totalDurationMs on endRun", () => {
    const tracer = createPipelineTracer(stepClock(15));
    const run = tracer.startRun({ requestText: "x", mode: "Balanced" }); // start=1000
    const s = tracer.startStage(run.id, "Execute"); // 1015
    tracer.endStage(run.id, s.id); // 1030
    const ended = tracer.endRun(run.id, "Completed"); // 1045
    expect(ended.status).toBe("Completed");
    expect(ended.totalDurationMs).toBe(45);
  });

  it("emits events in the expected order", () => {
    const tracer = createPipelineTracer(stepClock());
    const seen: string[] = [];
    tracer.on((e) => seen.push(e.type));
    const run = tracer.startRun({ requestText: "x", mode: "Balanced" });
    const s = tracer.startStage(run.id, "Execute");
    tracer.endStage(run.id, s.id);
    tracer.endRun(run.id, "Completed");
    expect(seen).toEqual([
      "run-started",
      "stage-started",
      "stage-ended",
      "run-ended",
    ]);
  });

  it("measure() returns a real non-negative duration", () => {
    const tracer = createPipelineTracer(stepClock(7));
    const { value, durationMs } = tracer.measure(() => 42);
    expect(value).toBe(42);
    expect(durationMs).toBe(7);
  });

  it("throws on unknown runId / stageId / debug attempt", () => {
    const tracer = createPipelineTracer(stepClock());
    expect(() => tracer.startStage("nope", "Execute")).toThrow();
    const run = tracer.startRun({ requestText: "x", mode: "Balanced" });
    expect(() => tracer.endStage(run.id, "nope")).toThrow();
    expect(() =>
      tracer.endDebugAttempt(run.id, "nope", { resolved: true })
    ).toThrow();
  });
});
