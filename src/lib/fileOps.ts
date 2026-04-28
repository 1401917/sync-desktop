// Strict-only assistant-message parser. Mirrors the Rust backend in
// src-tauri/src/workspace.rs so the frontend can show users in advance
// exactly what the apply step will (or won't) do — no fallback parsing,
// no "best-effort" inference. The contract is the marker format only.

import type {
  FileOperation,
  ParseWarning,
  ParseWarningCode,
  ParsedAssistantMessage,
} from "../types/fileOps";

const FENCE_PREFIX = "```";
const PATH_MARKER = "sync:path=";
const DELETE_MARKER = "sync:delete=";

// Frontend sensitivity heuristic. Rust backend is the source of truth;
// this is purely for the UI to flag obvious cases up front.
const SENSITIVE_PATTERNS: RegExp[] = [
  /(^|\/)\.env(\.|$)/i,
  /(^|\/)id_rsa(\.|$)/i,
  /\.pem$/i,
  /\.p12$/i,
  /\.pfx$/i,
  /(^|\/)secrets?\b/i,
  /\.key$/i,
];

const BLOCKED_DIR_PATTERNS: RegExp[] = [
  /(^|\/)\.git(\/|$)/i,
  /(^|\/)node_modules(\/|$)/i,
  /(^|\/)target(\/|$)/i,
  /(^|\/)dist(\/|$)/i,
  /(^|\/)src-tauri\/target(\/|$)/i,
];

/** Parse `sync:path=...` from a single line. Empty path → null. */
function parseSyncPath(line: string): string | null {
  const idx = line.indexOf(PATH_MARKER);
  if (idx < 0) return null;
  const raw = line.slice(idx + PATH_MARKER.length).trim().split(' ')[0];
  const stripped = stripQuotes(raw);
  return stripped.length > 0 ? stripped : null;
}

/** Parse `sync:delete=...` from a single line. */
function parseSyncDelete(line: string): string | null {
  const idx = line.indexOf(DELETE_MARKER);
  if (idx < 0) return null;
  const raw = line.slice(idx + DELETE_MARKER.length).trim();
  const stripped = stripQuotes(raw);
  return stripped.length > 0 ? stripped : null;
}

function stripQuotes(s: string): string {
  if (s.length === 0) return s;
  if (s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1);
  if (s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1);
  return s;
}

function isSensitivePath(path: string): boolean {
  return (
    SENSITIVE_PATTERNS.some((re) => re.test(path)) ||
    BLOCKED_DIR_PATTERNS.some((re) => re.test(path))
  );
}

function isUnsafePath(path: string): boolean {
  if (path.length === 0) return true;
  // Absolute (POSIX) or Windows drive prefix
  if (path.startsWith("/") || /^[a-z]:[\\/]/i.test(path)) return true;
  // Parent-traversal anywhere
  const parts = path.replace(/\\/g, "/").split("/");
  return parts.some((p) => p === "..");
}

/**
 * Parse an assistant message strictly. Returns operations only when a fenced
 * code block's FIRST line contains `sync:path=...`, OR a top-level line
 * contains `sync:delete=...`. Anything else is flagged but not turned into
 * an operation.
 */
export function parseAssistantMessage(message: string): ParsedAssistantMessage {
  const lines = message.split(/\r?\n/);
  const operations: FileOperation[] = [];
  const warnings: ParseWarning[] = [];
  let codeBlocksWithoutMarkers = 0;
  let totalCodeBlocks = 0;

  // Pass 1 — fenced code blocks: collect (firstLine, body[]) pairs.
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trimStart().startsWith(FENCE_PREFIX)) {
      totalCodeBlocks += 1;
      const body: string[] = [];
      let closed = false;
      i += 1;
      while (i < lines.length) {
        const inner = lines[i];
        if (inner.trimStart().startsWith(FENCE_PREFIX)) {
          closed = true;
          i += 1;
          break;
        }
        body.push(inner);
        i += 1;
      }
      if (!closed) {
        warnings.push({
          code: "code-block-unterminated",
          message: "An assistant code block was not closed before end of message.",
        });
      }
      const firstLine = body[0]?.trim() ?? "";
      const path = parseSyncPath(firstLine);
      if (path === null) {
        // Still count: was it a fence with no marker, or an empty marker?
        if (firstLine.includes(PATH_MARKER)) {
          warnings.push({
            code: "marker-empty-path",
            message: "A fenced code block had an empty path after `sync:path=`.",
          });
        } else {
          codeBlocksWithoutMarkers += 1;
        }
        continue;
      }
      const content = body.slice(1).join("\n");
      operations.push({
        kind: "create",
        path,
        content,
        rawMarker: firstLine,
        isSensitive: isSensitivePath(path),
        isUnsafe: isUnsafePath(path),
      });
      continue;
    }
    i += 1;
  }

  // Pass 2 — top-level `sync:delete=...` lines (anywhere, not just blocks).
  const seenDeletes = new Set<string>();
  for (const line of lines) {
    const path = parseSyncDelete(line);
    if (path === null) continue;
    if (seenDeletes.has(path)) continue;
    seenDeletes.add(path);
    operations.push({
      kind: "delete",
      path,
      rawMarker: line.trim(),
      isSensitive: isSensitivePath(path),
      isUnsafe: isUnsafePath(path),
    });
  }

  // Reclassify create→update for create ops whose target is "known to exist"
  // can only happen on the backend. Frontend always emits "create" for path
  // operations; backend determines create-vs-modify by checking disk.

  // Aggregate banner-level warning if there are unmarked code blocks.
  if (codeBlocksWithoutMarkers > 0 && operations.length === 0) {
    warnings.push({
      code: "no-markers-but-code-blocks",
      message: `AI returned ${codeBlocksWithoutMarkers} code block${
        codeBlocksWithoutMarkers === 1 ? "" : "s"
      } without a \`sync:path=\` marker. No files will be created.`,
    });
  } else if (codeBlocksWithoutMarkers > 0) {
    warnings.push({
      code: "no-markers-but-code-blocks",
      message: `AI returned ${codeBlocksWithoutMarkers} extra code block${
        codeBlocksWithoutMarkers === 1 ? "" : "s"
      } without markers — those will NOT be applied.`,
    });
  }

  return {
    operations,
    warnings,
    codeBlocksWithoutMarkers,
    totalCodeBlocks,
  };
}

/** Convenience boolean for the UI banner. */
export function hasUnmarkedCodeBlocks(parsed: ParsedAssistantMessage): boolean {
  return parsed.codeBlocksWithoutMarkers > 0;
}

/** True when the parser found at least one applicable operation. */
export function hasApplicableOperations(parsed: ParsedAssistantMessage): boolean {
  return parsed.operations.some((o) => !o.isUnsafe);
}

/** Re-export warning codes for tests. */
export type { ParseWarningCode };
