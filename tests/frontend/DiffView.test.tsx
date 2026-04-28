import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DiffView } from "../../src/features/operations/DiffView";
import type { DiffPlanOp } from "../../src/types/diffPlan";

describe("DiffView", () => {
  it("renders create op", () => {
    const op: DiffPlanOp = {
      path: "new.txt",
      kind: "create",
      before_content: null,
      after_content: "new content",
      blocked: false,
      block_reason: null,
    };
    render(<DiffView op={op} />);
    expect(screen.getByText("+ new content")).toBeInTheDocument();
  });

  it("renders delete op", () => {
    const op: DiffPlanOp = {
      path: "old.txt",
      kind: "delete",
      before_content: "old content",
      after_content: null,
      blocked: false,
      block_reason: null,
    };
    render(<DiffView op={op} />);
    expect(screen.getByText("- old content")).toBeInTheDocument();
  });

  it("renders update op with diff", () => {
    const op: DiffPlanOp = {
      path: "file.txt",
      kind: "update",
      before_content: "old\nline",
      after_content: "new\nline",
      blocked: false,
      block_reason: null,
    };
    render(<DiffView op={op} />);
    expect(screen.getByText("- old")).toBeInTheDocument();
    expect(screen.getByText("+ new")).toBeInTheDocument();
    expect(screen.getByText("line")).toBeInTheDocument();
  });
});