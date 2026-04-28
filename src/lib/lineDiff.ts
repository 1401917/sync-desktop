// Pure-TS line diff via classic LCS. No deps. Returns a flat list of
// segments suitable for rendering with +/- gutters.
//
// Output ordering preserves both files' original sequence: removed lines
// from `before` interleave with added lines from `after` exactly where
// they diverged.

export type DiffSegmentKind = "context" | "added" | "removed";

export interface DiffSegment {
  kind: DiffSegmentKind;
  /** Line number in the BEFORE file (1-based). undefined for "added". */
  beforeLine?: number;
  /** Line number in the AFTER file (1-based). undefined for "removed". */
  afterLine?: number;
  text: string;
}

function splitLines(s: string | null | undefined): string[] {
  if (!s) return [];
  // Preserve all lines including a trailing empty line if file ends with \n.
  return s.split(/\r?\n/);
}

/** Compute the LCS table for two arrays of strings. */
function lcsTable(a: string[], b: string[]): number[][] {
  const m = a.length;
  const n = b.length;
  const t: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0)
  );
  for (let i = 1; i <= m; i++) {
    const ai = a[i - 1];
    for (let j = 1; j <= n; j++) {
      t[i][j] = ai === b[j - 1] ? t[i - 1][j - 1] + 1 : Math.max(t[i - 1][j], t[i][j - 1]);
    }
  }
  return t;
}

export function diffLines(before: string | null, after: string | null): DiffSegment[] {
  const a = splitLines(before);
  const b = splitLines(after);
  const t = lcsTable(a, b);
  const out: DiffSegment[] = [];

  // Walk from (m, n) back to (0, 0).
  let i = a.length;
  let j = b.length;
  const reversed: DiffSegment[] = [];
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      reversed.push({ kind: "context", beforeLine: i, afterLine: j, text: a[i - 1] });
      i--;
      j--;
    } else if (t[i - 1][j] >= t[i][j - 1]) {
      reversed.push({ kind: "removed", beforeLine: i, text: a[i - 1] });
      i--;
    } else {
      reversed.push({ kind: "added", afterLine: j, text: b[j - 1] });
      j--;
    }
  }
  while (i > 0) {
    reversed.push({ kind: "removed", beforeLine: i, text: a[i - 1] });
    i--;
  }
  while (j > 0) {
    reversed.push({ kind: "added", afterLine: j, text: b[j - 1] });
    j--;
  }
  for (let k = reversed.length - 1; k >= 0; k--) out.push(reversed[k]);
  return out;
}

export interface DiffStats {
  added: number;
  removed: number;
  context: number;
  /** Percentage of lines that changed, relative to max(before, after). 0 when both empty. */
  percentChanged: number;
}

export function computeDiffStats(before: string | null, after: string | null): DiffStats {
  const a = splitLines(before);
  const b = splitLines(after);
  const segments = diffLines(before, after);
  let added = 0;
  let removed = 0;
  let context = 0;
  for (const s of segments) {
    if (s.kind === "added") added++;
    else if (s.kind === "removed") removed++;
    else context++;
  }
  const denom = Math.max(a.length, b.length);
  const percentChanged = denom === 0 ? 0 : Math.round(((added + removed) / denom) * 100);
  return { added, removed, context, percentChanged };
}

export function percentLinesChanged(before: string | null, after: string | null): number {
  if (before === null && after === null) return 0;
  if (before === null) return 100; // new file
  if (after === null) return 100; // deleted file

  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');

  if (beforeLines.length === 0 && afterLines.length === 0) return 0;
  if (beforeLines.length === 0) return 100;
  if (afterLines.length === 0) return 100;

  // Simple diff: count differing lines
  const maxLines = Math.max(beforeLines.length, afterLines.length);
  let changedLines = 0;

  for (let i = 0; i < maxLines; i++) {
    const b = beforeLines[i] || '';
    const a = afterLines[i] || '';
    if (b !== a) changedLines++;
  }

  return Math.round((changedLines / maxLines) * 100);
}
