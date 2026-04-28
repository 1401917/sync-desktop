import { describe, it, expect } from "vitest";
import { classifyRisk, resolveApprovalDecision, isCriticalConfigPath } from "../../src/lib/diffPlan";
import type { DiffPlanOp, ExecutionMode } from "../../src/types/diffPlan";

describe("isCriticalConfigPath", () => {
  it("returns true for package.json", () => {
    expect(isCriticalConfigPath("package.json")).toBe(true);
  });

  it("returns true for Cargo.toml", () => {
    expect(isCriticalConfigPath("Cargo.toml")).toBe(true);
  });

  it("returns true for tsconfig.json", () => {
    expect(isCriticalConfigPath("tsconfig.json")).toBe(true);
  });

  it("returns true for vite.config.ts", () => {
    expect(isCriticalConfigPath("vite.config.ts")).toBe(true);
  });

  it("returns true for tailwind.config.ts", () => {
    expect(isCriticalConfigPath("tailwind.config.ts")).toBe(true);
  });

  it("returns true for nested config files", () => {
    expect(isCriticalConfigPath("src/package.json")).toBe(true);
  });

  it("returns false for other files", () => {
    expect(isCriticalConfigPath("src/main.ts")).toBe(false);
  });
});

describe("classifyRisk", () => {
  it("classifies delete as Critical", () => {
    const op: DiffPlanOp = {
      path: "file.txt",
      kind: "delete",
      before_content: "content",
      after_content: null,
      blocked: false,
      block_reason: null,
    };
    expect(classifyRisk(op)).toBe("Critical");
  });

  it("classifies package.json modifications as Critical", () => {
    const op: DiffPlanOp = {
      path: "package.json",
      kind: "update",
      before_content: "{}",
      after_content: '{"name": "test"}',
      blocked: false,
      block_reason: null,
    };
    expect(classifyRisk(op)).toBe("Critical");
  });

  it("classifies blocked sensitive as High", () => {
    const op: DiffPlanOp = {
      path: ".env",
      kind: "update",
      before_content: "",
      after_content: "SECRET=123",
      blocked: true,
      block_reason: "sensitive",
    };
    expect(classifyRisk(op)).toBe("High");
  });

  it("classifies high change percentage as High", () => {
    const op: DiffPlanOp = {
      path: "file.txt",
      kind: "update",
      before_content: "a\nb\nc\nd\ne\nf\ng\nh\ni\nj",
      after_content: "x\ny\nz\nw\nv\nu\nt\ns\nr\nq",
      blocked: false,
      block_reason: null,
    };
    expect(classifyRisk(op)).toBe("High"); // >50% changed
  });

  it("classifies medium change as Medium", () => {
    const op: DiffPlanOp = {
      path: "file.txt",
      kind: "update",
      before_content: "a\nb\nc\nd\ne\nf\ng\nh\ni\nj",
      after_content: "a\nb\nc\nd\nx\ny\nz\nw\nv\nu",
      blocked: false,
      block_reason: null,
    };
    expect(classifyRisk(op)).toBe("Medium"); // >10% changed
  });

  it("classifies large create as Medium", () => {
    const largeContent = "x".repeat(6000);
    const op: DiffPlanOp = {
      path: "file.txt",
      kind: "create",
      before_content: null,
      after_content: largeContent,
      blocked: false,
      block_reason: null,
    };
    expect(classifyRisk(op)).toBe("Medium");
  });

  it("classifies normal ops as Low", () => {
    const op: DiffPlanOp = {
      path: "file.txt",
      kind: "update",
      before_content: "a\nb\nc",
      after_content: "a\nb\nd",
      blocked: false,
      block_reason: null,
    };
    expect(classifyRisk(op)).toBe("Low");
  });
});

describe("resolveApprovalDecision", () => {
  const modes: ExecutionMode[] = ["Manual", "Balanced", "Autonomous"];

  modes.forEach(mode => {
    it(`every op requires approval in ${mode} mode`, () => {
      const op: DiffPlanOp = {
        path: "file.txt",
        kind: "update",
        before_content: "old",
        after_content: "new",
        blocked: false,
        block_reason: null,
      };
      expect(resolveApprovalDecision(op, mode)).toBe("requires-approval");
    });
  });

  it("blocked op cannot be approved", () => {
    const op: DiffPlanOp = {
      path: ".env",
      kind: "create",
      before_content: null,
      after_content: "SECRET=123",
      blocked: true,
      block_reason: "sensitive",
    };
    expect(resolveApprovalDecision(op, "Manual")).toBe("requires-approval");
  });
});