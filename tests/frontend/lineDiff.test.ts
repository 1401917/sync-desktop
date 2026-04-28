import { describe, it, expect } from "vitest";
import { percentLinesChanged } from "../../src/lib/lineDiff";

describe("percentLinesChanged", () => {
  it("returns 0 for identical content", () => {
    expect(percentLinesChanged("a\nb\nc", "a\nb\nc")).toBe(0);
  });

  it("returns 100 for completely different content", () => {
    expect(percentLinesChanged("a\nb\nc", "x\ny\nz")).toBe(100);
  });

  it("returns 50 for half changed", () => {
    expect(percentLinesChanged("a\nb\nc\nd", "a\nx\nc\nd")).toBe(25); // 1 out of 4
  });

  it("returns 100 for new file", () => {
    expect(percentLinesChanged(null, "content")).toBe(100);
  });

  it("returns 100 for deleted file", () => {
    expect(percentLinesChanged("content", null)).toBe(100);
  });

  it("returns 0 for both null", () => {
    expect(percentLinesChanged(null, null)).toBe(0);
  });

  it("handles empty strings", () => {
    expect(percentLinesChanged("", "")).toBe(0);
  });

  it("handles one empty", () => {
    expect(percentLinesChanged("", "a")).toBe(100);
  });
});