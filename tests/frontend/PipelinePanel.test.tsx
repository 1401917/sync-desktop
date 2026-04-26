import { describe, it, expect } from "vitest";
import { render, screen, within, act } from "@testing-library/react";
import { createPipelineTracer } from "../../src/lib/pipelineTracer";
import { PipelinePanel } from "../../src/features/pipeline/PipelinePanel";

describe("PipelinePanel", () => {
  it("renders an idle state when there is no run", () => {
    const tracer = createPipelineTracer();
    render(<PipelinePanel tracer={tracer} />);
    expect(screen.getByTestId("pipeline-panel-empty")).toBeInTheDocument();
  });

  it("renders the run header and stage list", () => {
    const tracer = createPipelineTracer();
    const run = tracer.startRun({
      requestText: "ship pipeline panel",
      mode: "Balanced",
    });
    tracer.endStage(
      run.id,
      tracer.startStage(run.id, "ClassifyRequest").id
    );
    tracer.startStage(run.id, "AnalyzeProject");

    render(<PipelinePanel tracer={tracer} runId={run.id} />);
    const panel = screen.getByTestId("pipeline-panel");
    expect(panel).toHaveAttribute("data-run-status", "Running");
    expect(within(panel).getByText("ship pipeline panel")).toBeInTheDocument();

    const rows = within(panel).getAllByTestId("stage-row");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveAttribute("data-stage-status", "Succeeded");
    expect(rows[1]).toHaveAttribute("data-stage-status", "Running");
    expect(rows[1]).toHaveAttribute("data-active", "true");
  });

  it("shows live coding metrics when present", () => {
    const tracer = createPipelineTracer();
    const run = tracer.startRun({ requestText: "x", mode: "Balanced" });
    tracer.updateMetrics(run.id, {
      filesCreated: 1,
      filesModified: 2,
      linesAdded: 12,
      linesRemoved: 3,
      activeFile: "src/x.ts",
    });

    render(<PipelinePanel tracer={tracer} runId={run.id} />);
    const bar = screen.getByTestId("metrics-bar");
    expect(bar).toHaveTextContent("src/x.ts");
    expect(bar).toHaveTextContent("+1");
    expect(bar).toHaveTextContent("~2");
    expect(bar).toHaveTextContent("+12");
    expect(bar).toHaveTextContent("-3");
  });

  it("shows confidence when recorded", () => {
    const tracer = createPipelineTracer();
    const run = tracer.startRun({ requestText: "x", mode: "Balanced" });
    tracer.recordConfidence(run.id, {
      value: 0.87,
      risk: "Medium",
      validation: "Passed",
      assumptions: 2,
    });

    render(<PipelinePanel tracer={tracer} runId={run.id} />);
    const badge = screen.getByTestId("confidence-badge");
    expect(badge).toHaveTextContent("0.87");
    expect(badge).toHaveTextContent("Medium");
    expect(badge).toHaveTextContent("Passed");
  });

  it("re-renders when a stage is added after mount", () => {
    const tracer = createPipelineTracer();
    const run = tracer.startRun({ requestText: "x", mode: "Balanced" });
    render(<PipelinePanel tracer={tracer} runId={run.id} />);
    expect(screen.getByText(/Waiting for first stage/i)).toBeInTheDocument();

    act(() => {
      tracer.startStage(run.id, "Execute");
    });

    expect(screen.getAllByTestId("stage-row")).toHaveLength(1);
  });
});
