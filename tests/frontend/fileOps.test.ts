import { describe, it, expect } from "vitest";
import {
  parseAssistantMessage,
  hasUnmarkedCodeBlocks,
  hasApplicableOperations,
} from "../../src/lib/fileOps";

describe("parseAssistantMessage — happy path", () => {
  it("returns no ops and no warnings for empty input", () => {
    const r = parseAssistantMessage("");
    expect(r.operations).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.totalCodeBlocks).toBe(0);
    expect(r.codeBlocksWithoutMarkers).toBe(0);
  });

  it("returns no ops for prose with no code blocks", () => {
    const r = parseAssistantMessage("Hello, here is some prose.\nAnd more.");
    expect(r.operations).toHaveLength(0);
    expect(r.totalCodeBlocks).toBe(0);
    expect(r.codeBlocksWithoutMarkers).toBe(0);
  });

  it("recognizes a // sync:path= marker and extracts content", () => {
    const msg = [
      "Here you go:",
      "```",
      "// sync:path=src/foo.ts",
      "export const x = 1;",
      "```",
    ].join("\n");
    const r = parseAssistantMessage(msg);
    expect(r.operations).toHaveLength(1);
    expect(r.operations[0].kind).toBe("create");
    expect(r.operations[0].path).toBe("src/foo.ts");
    expect(r.operations[0].content).toBe("export const x = 1;");
    expect(r.codeBlocksWithoutMarkers).toBe(0);
    expect(r.warnings).toEqual([]);
  });

  it("recognizes a # sync:path= marker (Python-style)", () => {
    const msg = [
      "```",
      "# sync:path=scripts/run.py",
      "print('ok')",
      "```",
    ].join("\n");
    const r = parseAssistantMessage(msg);
    expect(r.operations).toHaveLength(1);
    expect(r.operations[0].path).toBe("scripts/run.py");
    expect(r.operations[0].content).toBe("print('ok')");
  });

  it("strips quotes around the path", () => {
    const msg = ["```", '// sync:path="src/x.ts"', "1;", "```"].join("\n");
    const r = parseAssistantMessage(msg);
    expect(r.operations[0].path).toBe("src/x.ts");
  });

  it("recognizes the marker even when buried after extra text on the line", () => {
    // Mirrors Rust line.find(marker)
    const msg = ["```", "# Hello sync:path=tools/x.sh world", 'echo "hi"', "```"].join("\n");
    const r = parseAssistantMessage(msg);
    expect(r.operations).toHaveLength(1);
    expect(r.operations[0].path).toBe("tools/x.sh");
  });

  it("collects multiple distinct operations", () => {
    const msg = [
      "```", "// sync:path=src/a.ts", "1;", "```",
      "Some prose.",
      "```", "// sync:path=src/b.ts", "2;", "```",
    ].join("\n");
    const r = parseAssistantMessage(msg);
    expect(r.operations).toHaveLength(2);
    expect(r.operations.map((o) => o.path)).toEqual(["src/a.ts", "src/b.ts"]);
  });

  it("recognizes a top-level sync:delete= line as a delete op", () => {
    const msg = "Drop this:\nsync:delete=src/legacy.ts\n";
    const r = parseAssistantMessage(msg);
    expect(r.operations).toHaveLength(1);
    expect(r.operations[0].kind).toBe("delete");
    expect(r.operations[0].path).toBe("src/legacy.ts");
    expect(r.operations[0].content).toBeUndefined();
  });

  it("dedupes repeated sync:delete= for the same path", () => {
    const msg = "sync:delete=src/x.ts\nsync:delete=src/x.ts\nsync:delete=src/y.ts\n";
    const r = parseAssistantMessage(msg);
    expect(r.operations).toHaveLength(2);
    expect(r.operations.map((o) => o.path)).toEqual(["src/x.ts", "src/y.ts"]);
  });
});

describe("parseAssistantMessage — strict-only behavior", () => {
  it("does NOT create an op for a code block missing the marker", () => {
    const msg = ["```", "export const x = 1;", "```"].join("\n");
    const r = parseAssistantMessage(msg);
    expect(r.operations).toHaveLength(0);
    expect(r.codeBlocksWithoutMarkers).toBe(1);
    expect(r.totalCodeBlocks).toBe(1);
    expect(r.warnings.some((w) => w.code === "no-markers-but-code-blocks")).toBe(true);
  });

  it("warns about an empty marker (sync:path= with no path)", () => {
    const msg = ["```", "// sync:path=", "1;", "```"].join("\n");
    const r = parseAssistantMessage(msg);
    expect(r.operations).toHaveLength(0);
    expect(r.warnings.some((w) => w.code === "marker-empty-path")).toBe(true);
  });

  it("flags an unterminated code block", () => {
    const msg = ["```", "// sync:path=src/foo.ts", "still going..."].join("\n");
    const r = parseAssistantMessage(msg);
    expect(r.warnings.some((w) => w.code === "code-block-unterminated")).toBe(true);
  });

  it("emits an amber-style warning when both ops and unmarked blocks coexist", () => {
    const msg = [
      "```", "// sync:path=src/a.ts", "1;", "```",
      "```", "console.log('no marker');", "```",
    ].join("\n");
    const r = parseAssistantMessage(msg);
    expect(r.operations).toHaveLength(1);
    expect(r.codeBlocksWithoutMarkers).toBe(1);
    const banner = r.warnings.find((w) => w.code === "no-markers-but-code-blocks");
    expect(banner).toBeDefined();
    // Amber-style: mentions "extra" / "NOT be applied"
    expect(banner!.message).toMatch(/extra|NOT be applied/i);
  });
});

describe("parseAssistantMessage — safety classification", () => {
  it("flags a sensitive .env path as isSensitive=true", () => {
    const msg = ["```", "// sync:path=.env", "SECRET=hi", "```"].join("\n");
    const r = parseAssistantMessage(msg);
    expect(r.operations[0].isSensitive).toBe(true);
  });

  it("flags a path inside .git/ as sensitive", () => {
    const msg = ["```", "// sync:path=.git/config", "x", "```"].join("\n");
    const r = parseAssistantMessage(msg);
    expect(r.operations[0].isSensitive).toBe(true);
  });

  it("flags an absolute path as isUnsafe=true", () => {
    const msg = ["```", "// sync:path=/etc/passwd", "x", "```"].join("\n");
    const r = parseAssistantMessage(msg);
    expect(r.operations[0].isUnsafe).toBe(true);
  });

  it("flags a parent-traversal path as isUnsafe=true", () => {
    const msg = ["```", "// sync:path=../outside.ts", "x", "```"].join("\n");
    const r = parseAssistantMessage(msg);
    expect(r.operations[0].isUnsafe).toBe(true);
  });

  it("flags a Windows drive-prefix path as isUnsafe=true", () => {
    const msg = ["```", '// sync:path=C:/Users/x.ts', "x", "```"].join("\n");
    const r = parseAssistantMessage(msg);
    expect(r.operations[0].isUnsafe).toBe(true);
  });
});

describe("helpers", () => {
  it("hasUnmarkedCodeBlocks reflects the count", () => {
    const a = parseAssistantMessage("```\nplain\n```");
    expect(hasUnmarkedCodeBlocks(a)).toBe(true);
    const b = parseAssistantMessage("```\n// sync:path=x.ts\n1;\n```");
    expect(hasUnmarkedCodeBlocks(b)).toBe(false);
  });

  it("hasApplicableOperations excludes unsafe ops", () => {
    const r = parseAssistantMessage("```\n// sync:path=../outside\nx\n```");
    expect(r.operations).toHaveLength(1);
    expect(hasApplicableOperations(r)).toBe(false);
  });
});
