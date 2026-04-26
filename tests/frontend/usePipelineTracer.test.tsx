import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  createPipelineTracer,
  type Clock,
} from "../../src/lib/pipelineTracer";
import { usePipelineTracer } from "../../src/lib/usePipelineTracer";

function stepClock(stepMs = 10): Clock {
  let t = 1000;
  return () => {
    const v = t;
    t += stepMs;
    return v;
  };
}

describe("usePipelineTracer", () => {
  it("returns undefined when runId is unknown", () => {
    const tracer = createPipelineTracer(stepClock());
    const { result } = renderHook(() =>
      usePipelineTracer(tracer, "missing", { tickMs: 0, clock: stepClock() })
    );
    expect(result.current.run).toBeUndefined();
    expect(result.current.activeStage).toBeUndefined();
  });

  it("re-renders when tracer events fire", () => {
    const tracer = createPipelineTracer(stepClock());
    const run = tracer.startRun({ requestText: "demo", mode: "Balanced" });

    const { result } = renderHook(() =>
      usePipelineTracer(tracer, run.id, { tickMs: 0, clock: stepClock() })
    );
    expect(result.current.run?.stages).toHaveLength(0);

    act(() => {
      tracer.startStage(run.id, "AnalyzeProject");
    });

    expect(result.current.run?.stages).toHaveLength(1);
    expect(result.current.activeStage?.kind).toBe("AnalyzeProject");
  });

  it("elapsedMs uses recorded durationMs after a stage ends", () => {
    const tracer = createPipelineTracer(stepClock(40));
    const run = tracer.startRun({ requestText: "x", mode: "Manual" });
    const s = tracer.startStage(run.id, "Execute");
    tracer.endStage(run.id, s.id);

    const { result } = renderHook(() =>
      usePipelineTracer(tracer, run.id, { tickMs: 0, clock: stepClock() })
    );
    const stage = result.current.run!.stages[0];
    expect(stage.durationMs).toBe(40);
    expect(result.current.elapsedMs(stage)).toBe(40);
  });

  it("elapsedMs uses now - startedAt for a still-running stage", () => {
    // Shared monotonic clock — tracer and hook must share one time source,
    // otherwise the hook's `now` can land before the stage's startedAt.
    let t = 1000;
    const stepMs = 20;
    const clock: Clock = () => {
      const v = t;
      t += stepMs;
      return v;
    };
    const tracer = createPipelineTracer(clock);
    const run = tracer.startRun({ requestText: "x", mode: "Balanced" });
    const s = tracer.startStage(run.id, "Execute");

    const { result } = renderHook(() =>
      usePipelineTracer(tracer, run.id, { tickMs: 0, clock })
    );
    // Hook captured now = 1040 on its first clock read; 1040 - 1020 = 20.
    expect(result.current.elapsedMs(s)).toBe(stepMs);
    expect(result.current.elapsedMs(s)).toBeGreaterThan(0);
  });

  it("totalElapsedMs uses totalDurationMs after endRun", () => {
    const tracer = createPipelineTracer(stepClock(15));
    const run = tracer.startRun({ requestText: "x", mode: "Balanced" });
    const s = tracer.startStage(run.id, "Execute");
    tracer.endStage(run.id, s.id);
    tracer.endRun(run.id, "Completed");

    const { result } = renderHook(() =>
      usePipelineTracer(tracer, run.id, { tickMs: 0 })
    );
    expect(result.current.run!.totalDurationMs).toBe(45);
    expect(result.current.totalElapsedMs()).toBe(45);
  });
});
