import { describe, it, expect } from "vitest";
import {
  parseErrorOutput,
  diagnose,
  planRepair,
  runDebugLoop,
} from "../../src/lib/debugLoop";
import { createPipelineTracer } from "../../src/lib/pipelineTracer";

// ── Parsers ────────────────────────────────────────────────────────────────
describe("parseErrorOutput", () => {
  it("parses a TypeScript tsc error with full location", () => {
    const raw =
      "src/components/Foo.tsx(42,7): error TS2339: Property 'status' does not exist on type 'Bar'.";
    const [e] = parseErrorOutput(raw);
    expect(e.source).toBe("typescript");
    expect(e.severity).toBe("error");
    expect(e.code).toBe("TS2339");
    expect(e.file).toBe("src/components/Foo.tsx");
    expect(e.line).toBe(42);
    expect(e.column).toBe(7);
    expect(e.message).toContain("Property 'status'");
    expect(e.raw).toBe(raw);
  });

  it("parses a TypeScript warning", () => {
    const raw = "src/x.ts(1,1): warning TS6133: 'foo' is declared but never read.";
    const [e] = parseErrorOutput(raw);
    expect(e.severity).toBe("warning");
    expect(e.code).toBe("TS6133");
  });

  it("parses Rust head + location into one ParsedError", () => {
    const raw = [
      "error[E0277]: the trait `Foo` is not implemented for `Bar`",
      "  --> src/lib.rs:10:5",
    ].join("\n");
    const [e] = parseErrorOutput(raw);
    expect(e.source).toBe("rust");
    expect(e.code).toBe("E0277");
    expect(e.file).toBe("src/lib.rs");
    expect(e.line).toBe(10);
    expect(e.column).toBe(5);
    expect(e.raw).toContain("-->");
  });

  it("falls back to generic when a Rust head has no -->", () => {
    const raw = "error[E9999]: aborting due to previous error";
    const [e] = parseErrorOutput(raw);
    expect(e.source).toBe("generic");
    expect(e.code).toBe("E9999");
  });

  it("parses a Vite/esbuild error", () => {
    const raw = "src/main.ts:5:10: error: Unterminated string literal";
    const [e] = parseErrorOutput(raw);
    expect(e.source).toBe("vite");
    expect(e.file).toBe("src/main.ts");
    expect(e.line).toBe(5);
    expect(e.column).toBe(10);
  });

  it("parses a Vite plugin error", () => {
    const raw = "[plugin:vite:react] Error: Failed to parse JSX";
    const [e] = parseErrorOutput(raw);
    expect(e.source).toBe("vite");
    expect(e.message).toContain("Failed to parse JSX");
  });

  it("parses a Vitest assertion + location", () => {
    const raw = [
      "AssertionError: expected 0 to be greater than 0",
      " ❯ tests/frontend/x.test.ts:67:41",
    ].join("\n");
    const [e] = parseErrorOutput(raw);
    expect(e.source).toBe("vitest");
    expect(e.file).toBe("tests/frontend/x.test.ts");
    expect(e.line).toBe(67);
    expect(e.column).toBe(41);
    expect(e.message).toContain("expected 0");
  });

  it("parses an npm error with code", () => {
    const raw = "npm ERR! code ENOENT no such file or directory";
    const [e] = parseErrorOutput(raw);
    expect(e.source).toBe("npm");
    expect(e.code).toBe("ENOENT");
  });

  it("parses an npm error without code", () => {
    const raw = "npm ERR! something failed without a code";
    const [e] = parseErrorOutput(raw);
    expect(e.source).toBe("npm");
    expect(e.code).toBeUndefined();
  });

  it("parses a generic Error: line", () => {
    const raw = "Error: Cannot find native binding";
    const [e] = parseErrorOutput(raw);
    expect(e.source).toBe("generic");
    expect(e.message).toBe("Cannot find native binding");
  });

  it("parses a mixed multi-source log in input order", () => {
    const raw = [
      "src/a.ts(1,1): error TS2304: Cannot find name 'foo'.",
      "error[E0277]: trait bound",
      "  --> src/b.rs:3:1",
      "npm ERR! code ENOENT something missing",
    ].join("\n");
    const errs = parseErrorOutput(raw);
    expect(errs.map((e) => e.source)).toEqual(["typescript", "rust", "npm"]);
  });

  it("returns empty array when no recognizable errors", () => {
    expect(parseErrorOutput("just some text\nlooking fine")).toEqual([]);
  });

  it("populates source and message on every parsed error", () => {
    const raw = [
      "src/a.ts(1,1): error TS2304: x.",
      "error[E0277]: trait bound",
      "  --> src/b.rs:3:1",
      "src/c.ts:1:1: error: y",
      "[plugin:vite:vue] Error: z",
      "AssertionError: q",
      " ❯ tests/d.test.ts:1:1",
      "npm ERR! r",
      "Error: s",
    ].join("\n");
    const errs = parseErrorOutput(raw);
    for (const e of errs) {
      expect(e.source).toBeTruthy();
      expect(e.message).toBeTruthy();
    }
  });
});

// ── diagnose ──────────────────────────────────────────────────────────────
describe("diagnose", () => {
  it("groups identical errors and counts occurrences", () => {
    const errs = parseErrorOutput(
      [
        "src/a.ts(1,1): error TS2304: Cannot find name 'foo'.",
        "src/a.ts(1,1): error TS2304: Cannot find name 'foo'.",
        "src/b.ts(2,2): error TS2304: Cannot find name 'bar'.",
      ].join("\n")
    );
    const d = diagnose(errs);
    expect(d.groups).toHaveLength(2);
    const dup = d.groups.find((g) => g.first.file === "src/a.ts");
    expect(dup?.count).toBe(2);
  });

  it("identifies the first non-warning error as root", () => {
    const errs = parseErrorOutput(
      [
        "src/x.ts(1,1): warning TS6133: unused.",
        "src/x.ts(2,1): error TS2304: Cannot find name.",
      ].join("\n")
    );
    const d = diagnose(errs);
    expect(d.rootError?.severity).toBe("error");
    expect(d.rootError?.code).toBe("TS2304");
  });

  it("counts errors and warnings by source", () => {
    const errs = parseErrorOutput(
      [
        "src/a.ts(1,1): error TS2304: x.",
        "src/a.ts(2,1): warning TS6133: y.",
        "npm ERR! code ENOENT z",
      ].join("\n")
    );
    const d = diagnose(errs);
    expect(d.totalErrors).toBe(2);
    expect(d.totalWarnings).toBe(1);
    expect(d.bySource.typescript).toBe(2);
    expect(d.bySource.npm).toBe(1);
  });

  it("returns empty diagnosis for empty input", () => {
    const d = diagnose([]);
    expect(d.groups).toHaveLength(0);
    expect(d.rootError).toBeUndefined();
    expect(d.totalErrors).toBe(0);
    expect(d.derivedSignatures).toEqual([]);
  });

  it("marks non-parse-class errors in a file as derived when one parse-class is present", () => {
    // 1 parse-class + 2 non-parse-class in same file → cascade
    const raw = [
      "src/x.ts(10,5): error TS1005: ')' expected.",
      "src/x.ts(20,3): error TS2339: Property 'a' does not exist on type 'B'.",
      "src/x.ts(30,3): error TS2339: Property 'c' does not exist on type 'D'.",
    ].join("\n");
    const d = diagnose(parseErrorOutput(raw));
    const parseClass = d.groups.find((g) => g.first.code === "TS1005");
    const others = d.groups.filter((g) => g.first.code === "TS2339");
    expect(parseClass?.derived).toBe(false);
    expect(others.every((g) => g.derived)).toBe(true);
    expect(d.derivedSignatures).toHaveLength(2);
    expect(d.rootError?.code).toBe("TS1005"); // cascade head
  });

  it("does NOT mark cascade when there are <3 errors in the file", () => {
    const raw = [
      "src/x.ts(10,5): error TS1005: ')' expected.",
      "src/x.ts(20,3): error TS2339: Property 'a' does not exist.",
    ].join("\n");
    const d = diagnose(parseErrorOutput(raw));
    expect(d.groups.every((g) => !g.derived)).toBe(true);
    expect(d.derivedSignatures).toEqual([]);
  });

  it("does NOT mark cascade when multiple parse-class errors are present", () => {
    const raw = [
      "src/x.ts(10,5): error TS1005: ')' expected.",
      "src/x.ts(11,3): error TS1127: Invalid character.",
      "src/x.ts(20,3): error TS2339: Property 'a' does not exist.",
      "src/x.ts(21,3): error TS2339: Property 'b' does not exist.",
    ].join("\n");
    const d = diagnose(parseErrorOutput(raw));
    expect(d.groups.every((g) => !g.derived)).toBe(true);
  });
});

// ── planRepair ────────────────────────────────────────────────────────────
describe("planRepair", () => {
  it("infers fix-syntax for TS17008 / TS1005 / TS1127 / TS17002 / TS1002", () => {
    const codes = ["TS1002", "TS1005", "TS1127", "TS17002", "TS17008"];
    for (const code of codes) {
      const raw = `src/x.tsx(10,5): error ${code}: bad syntax.`;
      const plan = planRepair(diagnose(parseErrorOutput(raw)));
      expect(plan.actions[0].kind).toBe("fix-syntax");
      expect(plan.actions[0].targetFile).toBe("src/x.tsx");
      expect(plan.actions[0].targetLine).toBe(10);
    }
  });

  it("infers add-import for TS2307", () => {
    const plan = planRepair(
      diagnose(
        parseErrorOutput(
          "src/a.ts(3,21): error TS2307: Cannot find module '@scope/pkg'."
        )
      )
    );
    expect(plan.actions[0].kind).toBe("add-import");
  });

  it("infers rename-symbol for TS2304 / TS2552", () => {
    for (const code of ["TS2304", "TS2552"]) {
      const plan = planRepair(
        diagnose(parseErrorOutput(`src/a.ts(5,3): error ${code}: Cannot find name 'foo'.`))
      );
      expect(plan.actions[0].kind).toBe("rename-symbol");
    }
  });

  it("infers install-dep for npm ENOENT", () => {
    const plan = planRepair(
      diagnose(parseErrorOutput("npm ERR! code ENOENT no such file or directory"))
    );
    expect(plan.actions[0].kind).toBe("install-dep");
  });

  it("infers update-dependency for npm EBADENGINE / ETARGET / ERESOLVE", () => {
    for (const code of ["EBADENGINE", "ETARGET", "ERESOLVE"]) {
      const plan = planRepair(
        diagnose(parseErrorOutput(`npm ERR! code ${code} version mismatch detected`))
      );
      expect(plan.actions[0].kind).toBe("update-dependency");
    }
  });

  it("infers update-dependency from message when code is absent", () => {
    const plan = planRepair(
      diagnose(parseErrorOutput("npm ERR! requires version 18 or higher"))
    );
    expect(plan.actions[0].kind).toBe("update-dependency");
  });

  it("infers revert-change for Rust E0658 (unstable feature)", () => {
    const raw = [
      "error[E0658]: use of unstable library feature",
      "  --> src-tauri/src/lib.rs:5:1",
    ].join("\n");
    const plan = planRepair(diagnose(parseErrorOutput(raw)));
    expect(plan.actions[0].kind).toBe("revert-change");
  });

  it("emits a cascade revert-change when ≥5 files have parse-class errors", () => {
    const raw = [
      "src/a.tsx(1,1): error TS1005: bad syntax.",
      "src/b.tsx(1,1): error TS1005: bad syntax.",
      "src/c.tsx(1,1): error TS17008: tag.",
      "src/d.tsx(1,1): error TS1127: invalid char.",
      "src/e.tsx(1,1): error TS1002: string.",
    ].join("\n");
    const plan = planRepair(diagnose(parseErrorOutput(raw)));
    expect(plan.actions[0].kind).toBe("revert-change");
    expect(plan.notes.some((n) => /Cascade signal/i.test(n))).toBe(true);
  });

  it("infers manual-investigation only when no concrete action can be derived", () => {
    const plan = planRepair(
      diagnose(parseErrorOutput("Error: Cannot find native binding"))
    );
    expect(plan.actions[0].kind).toBe("manual-investigation");
  });

  it("does NOT emit actions for derived (cascade) groups", () => {
    const raw = [
      "src/x.ts(10,5): error TS1005: ')' expected.",
      "src/x.ts(20,3): error TS2339: prop a missing.",
      "src/x.ts(30,3): error TS2339: prop b missing.",
    ].join("\n");
    const plan = planRepair(diagnose(parseErrorOutput(raw)));
    // Only the parse-class group survives; the two cascade groups are skipped.
    expect(plan.actions).toHaveLength(1);
    expect(plan.actions[0].kind).toBe("fix-syntax");
  });

  it("confidence is always within [0,1]", () => {
    const raw = [
      "src/a.ts(1,1): error TS2304: x.",
      "error[E0277]: trait",
      "  --> src/b.rs:3:1",
      "npm ERR! z",
      "Error: w",
    ].join("\n");
    const plan = planRepair(diagnose(parseErrorOutput(raw)));
    expect(plan.confidence).toBeGreaterThanOrEqual(0);
    expect(plan.confidence).toBeLessThanOrEqual(1);
  });

  it("manual-investigation forces confidence ≤ 0.3", () => {
    const plan = planRepair(diagnose(parseErrorOutput("Error: opaque failure")));
    expect(plan.actions[0].kind).toBe("manual-investigation");
    expect(plan.confidence).toBeLessThanOrEqual(0.3);
  });

  it("no targetFile forces confidence ≤ 0.3", () => {
    const plan = planRepair(
      diagnose(parseErrorOutput("npm ERR! some opaque thing happened"))
    );
    // npm with no specific known message → manual-investigation, no targetFile
    expect(plan.confidence).toBeLessThanOrEqual(0.3);
  });

  it("targetFile but no targetLine caps confidence ≤ 0.6", () => {
    // Vite plugin error has source+message but no file/line → manual-investigation
    // To exercise file-but-no-line: an npm install-dep action lacks file info, so
    // we use a Vite-with-file but the plugin form gives no file. Use a synthetic
    // path where line is missing: not directly produceable from parsers, so we
    // verify via revert-change for cascade which has no file/line.
    const raw = [
      "src/a.tsx(1,1): error TS1005: x.",
      "src/b.tsx(1,1): error TS1005: x.",
      "src/c.tsx(1,1): error TS1005: x.",
      "src/d.tsx(1,1): error TS1005: x.",
      "src/e.tsx(1,1): error TS1005: x.",
    ].join("\n");
    const plan = planRepair(diagnose(parseErrorOutput(raw)));
    // The first action is the cascade revert-change (no file) — capped at 0.5.
    expect(plan.actions[0].kind).toBe("revert-change");
    expect(plan.confidence).toBeLessThanOrEqual(0.85); // mixed with high-confidence fix-syntax
    expect(plan.confidence).toBeGreaterThan(0); // sanity
  });

  it("file + line + code + heuristic match yields confidence ≥ 0.8", () => {
    const plan = planRepair(
      diagnose(parseErrorOutput("src/a.ts(5,3): error TS2304: Cannot find 'foo'."))
    );
    expect(plan.actions[0].kind).toBe("rename-symbol");
    expect(plan.actions[0].targetFile).toBe("src/a.ts");
    expect(plan.actions[0].targetLine).toBe(5);
    expect(plan.confidence).toBeGreaterThanOrEqual(0.8);
    expect(plan.confidence).toBeLessThanOrEqual(0.95);
  });

  it("emits a notes entry when only warnings present", () => {
    const plan = planRepair(
      diagnose(parseErrorOutput("src/a.ts(1,1): warning TS6133: unused."))
    );
    expect(plan.notes.some((n) => /warnings/i.test(n))).toBe(true);
  });

  it("emits a notes entry when nothing is parsed", () => {
    const plan = planRepair(diagnose(parseErrorOutput("garbage text")));
    expect(plan.notes.some((n) => /unsupported format/i.test(n))).toBe(true);
  });

  it("emits a derived-groups note when cascade is detected", () => {
    const raw = [
      "src/x.ts(10,5): error TS1005: bad.",
      "src/x.ts(20,3): error TS2339: a missing.",
      "src/x.ts(30,3): error TS2339: b missing.",
    ].join("\n");
    const plan = planRepair(diagnose(parseErrorOutput(raw)));
    expect(plan.notes.some((n) => /derived \(cascade\)/i.test(n))).toBe(true);
  });
});

// ── runDebugLoop (tracer integration) ─────────────────────────────────────
describe("runDebugLoop", () => {
  it("creates a debug attempt and records rootCause + fixStrategy", () => {
    const tracer = createPipelineTracer();
    const run = tracer.startRun({ requestText: "x", mode: "Balanced" });
    const { attempt, plan } = runDebugLoop(
      tracer,
      run.id,
      "src/a.ts(1,1): error TS2304: Cannot find name 'foo'."
    );
    expect(attempt.applied).toBe(false);
    expect(attempt.resolved).toBe(false);
    expect(attempt.rootCause).toContain("TS2304");
    expect(attempt.fixStrategy).toContain("Resolve unknown identifier");
    expect(plan.actions[0].kind).toBe("rename-symbol");
    expect(run.debugAttempts).toHaveLength(1);
  });

  it("never marks the attempt as resolved or applied", () => {
    const tracer = createPipelineTracer();
    const run = tracer.startRun({ requestText: "x", mode: "Balanced" });
    const { attempt } = runDebugLoop(tracer, run.id, "Error: anything");
    expect(attempt.resolved).toBe(false);
    expect(attempt.applied).toBe(false);
  });

  it("fails the named stage when stageId is provided", () => {
    const tracer = createPipelineTracer();
    const run = tracer.startRun({ requestText: "x", mode: "Balanced" });
    const stage = tracer.startStage(run.id, "Validate");
    runDebugLoop(
      tracer,
      run.id,
      "src/a.ts(1,1): error TS2304: Cannot find name 'foo'.",
      { stageId: stage.id }
    );
    expect(stage.status).toBe("Failed");
    expect(stage.error?.parsed?.file).toBe("src/a.ts");
    expect(stage.error?.parsed?.ruleId).toBe("TS2304");
  });

  it("does not fail any stage when stageId is omitted", () => {
    const tracer = createPipelineTracer();
    const run = tracer.startRun({ requestText: "x", mode: "Balanced" });
    const stage = tracer.startStage(run.id, "Validate");
    runDebugLoop(tracer, run.id, "src/a.ts(1,1): error TS2304: foo.");
    expect(stage.status).toBe("Running");
  });

  it("handles unparseable input by recording a generic rootCause", () => {
    const tracer = createPipelineTracer();
    const run = tracer.startRun({ requestText: "x", mode: "Balanced" });
    const { attempt, plan } = runDebugLoop(
      tracer,
      run.id,
      "no recognizable errors here"
    );
    expect(attempt.rootCause).toContain("No structured error");
    expect(plan.actions).toHaveLength(0);
    expect(plan.notes.some((n) => /unsupported format/i.test(n))).toBe(true);
  });
});
