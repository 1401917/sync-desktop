import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { OperationsSummary } from "../../src/features/operations/OperationsSummary";

describe("OperationsSummary", () => {
  it("renders nothing when the message has no ops and no unmarked blocks", () => {
    const { container } = render(<OperationsSummary source="just prose, no code" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders an op row for a valid sync:path block", () => {
    const msg = ["```", "// sync:path=src/foo.ts", "export const x = 1;", "```"].join("\n");
    render(<OperationsSummary source={msg} />);
    const summary = screen.getByTestId("operations-summary");
    expect(summary).toHaveAttribute("data-op-count", "1");
    expect(summary).toHaveAttribute("data-unmarked-blocks", "0");
    const row = within(summary).getByTestId("operations-summary-row");
    expect(row).toHaveAttribute("data-op-kind", "create");
    expect(row).toHaveAttribute("data-op-path", "src/foo.ts");
    expect(row).toHaveAttribute("data-op-sensitive", "false");
    expect(row).toHaveAttribute("data-op-unsafe", "false");
  });

  it("shows a RED banner when code blocks have no marker and there are no ops", () => {
    const msg = ["```", "console.log('no marker');", "```"].join("\n");
    render(<OperationsSummary source={msg} />);
    const banner = screen.getByTestId("operations-summary-warning-red");
    expect(banner).toHaveAttribute("data-warning-kind", "red");
    expect(banner).toHaveTextContent(/no files will be created/i);
    expect(banner).toHaveTextContent(/sync:path/i);
  });

  it("shows an AMBER banner when ops AND unmarked blocks both exist", () => {
    const msg = [
      "```", "// sync:path=src/a.ts", "1;", "```",
      "```", "console.log('extra');", "```",
    ].join("\n");
    render(<OperationsSummary source={msg} />);
    const banner = screen.getByTestId("operations-summary-warning-amber");
    expect(banner).toHaveAttribute("data-warning-kind", "amber");
    expect(banner).toHaveTextContent(/NOT be applied/i);
  });

  it("flags a sensitive path with the sensitive tag", () => {
    const msg = ["```", "// sync:path=.env", "SECRET=hi", "```"].join("\n");
    render(<OperationsSummary source={msg} />);
    const row = screen.getByTestId("operations-summary-row");
    expect(row).toHaveAttribute("data-op-sensitive", "true");
    expect(within(row).getByTestId("op-tag-sensitive")).toBeInTheDocument();
  });

  it("flags an unsafe path with the unsafe tag", () => {
    const msg = ["```", "// sync:path=../escape.ts", "x", "```"].join("\n");
    render(<OperationsSummary source={msg} />);
    const row = screen.getByTestId("operations-summary-row");
    expect(row).toHaveAttribute("data-op-unsafe", "true");
    expect(within(row).getByTestId("op-tag-unsafe")).toBeInTheDocument();
  });

  it("renders a delete row for a top-level sync:delete= line", () => {
    const msg = "Drop this file:\nsync:delete=src/legacy.ts\n";
    render(<OperationsSummary source={msg} />);
    const row = screen.getByTestId("operations-summary-row");
    expect(row).toHaveAttribute("data-op-kind", "delete");
    expect(row).toHaveAttribute("data-op-path", "src/legacy.ts");
  });
});
