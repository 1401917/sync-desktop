import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OperationsPreviewPanel } from "../../src/features/operations/OperationsPreviewPanel";
import type { DiffPlanOp } from "../../src/types/diffPlan";

describe("OperationsPreviewPanel", () => {
  const mockOps: DiffPlanOp[] = [
    {
      path: "src/main.ts",
      kind: "update",
      before_content: "old",
      after_content: "new",
      blocked: false,
      block_reason: null,
    },
    {
      path: ".env",
      kind: "create",
      before_content: null,
      after_content: "SECRET=123",
      blocked: true,
      block_reason: "sensitive",
    },
  ];

  it("renders operations", () => {
    render(
      <OperationsPreviewPanel
        ops={mockOps}
        mode="Manual"
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />
    );
    expect(screen.getByText("src/main.ts")).toBeInTheDocument();
    expect(screen.getByText(".env")).toBeInTheDocument();
  });

  it("approve button is disabled when op.blocked === true", () => {
    render(
      <OperationsPreviewPanel
        ops={mockOps}
        mode="Manual"
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />
    );
    const selectButtons = screen.getAllByText("Select");
    expect(selectButtons[1]).toBeDisabled(); // .env is blocked
  });

  it("approve all skips blocked ops", () => {
    const onApprove = vi.fn();
    render(
      <OperationsPreviewPanel
        ops={mockOps}
        mode="Manual"
        onApprove={onApprove}
        onReject={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText("Approve All"));
    expect(onApprove).toHaveBeenCalledWith([mockOps[0]]); // only non-blocked
  });

  it("blocked tag is rendered on blocked rows", () => {
    render(
      <OperationsPreviewPanel
        ops={mockOps}
        mode="Manual"
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />
    );
    expect(screen.getByText("BLOCKED")).toBeInTheDocument();
  });

  it("can select and approve non-blocked ops", () => {
    const onApprove = vi.fn();
    render(
      <OperationsPreviewPanel
        ops={mockOps}
        mode="Manual"
        onApprove={onApprove}
        onReject={vi.fn()}
      />
    );
    fireEvent.click(screen.getAllByText("Select")[0]);
    fireEvent.click(screen.getByText("Approve Selected (1)"));
    expect(onApprove).toHaveBeenCalledWith([mockOps[0]]);
  });
});