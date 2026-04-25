/**
 * Tool-call parser. The AI is instructed (via the system prompt) to emit
 * structured JSON inside ```tool_call fenced blocks when it wants to read
 * or modify a file. We parse those blocks, present them as approval cards,
 * and execute through the real Tauri tools after the user approves.
 *
 * Format the model is taught to emit:
 *
 *   ```tool_call
 *   {
 *     "tool": "write_file",
 *     "path": "src/foo.ts",
 *     "content": "...",
 *     "reason": "create initial scaffold"
 *   }
 *   ```
 *
 * Supported tool names: read_file, write_file, list_directory, apply_patch.
 */

export type ToolName = "read_file" | "write_file" | "list_directory" | "apply_patch";

export interface ToolCall {
  id: string;
  tool: ToolName;
  path?: string;
  content?: string;
  search?: string;
  replace?: string;
  reason?: string;
  raw: string;
}

const FENCE_REGEX = /```\s*tool_call\s*\n([\s\S]*?)```/g;

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function parseToolCalls(message: string): ToolCall[] {
  const calls: ToolCall[] = [];
  let match: RegExpExecArray | null;
  let counter = 0;
  while ((match = FENCE_REGEX.exec(message)) !== null) {
    const body = match[1].trim();
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(body);
    } catch {
      continue;
    }
    const tool = asString(parsed["tool"]);
    if (!tool) continue;
    if (!["read_file", "write_file", "list_directory", "apply_patch"].includes(tool)) continue;
    calls.push({
      id: `tool-${Date.now()}-${counter++}`,
      tool: tool as ToolName,
      path: asString(parsed["path"]),
      content: asString(parsed["content"]),
      search: asString(parsed["search"]),
      replace: asString(parsed["replace"]),
      reason: asString(parsed["reason"]),
      raw: body
    });
  }
  return calls;
}

export function describeToolCall(call: ToolCall): string {
  switch (call.tool) {
    case "read_file":
      return `Read ${call.path ?? "(unknown)"}`;
    case "list_directory":
      return `List ${call.path && call.path.length > 0 ? call.path : "."}`;
    case "write_file":
      return `Write ${call.path ?? "(unknown)"}`;
    case "apply_patch":
      return `Patch ${call.path ?? "(unknown)"}`;
  }
}

export function riskOfToolCall(call: ToolCall): "safe" | "low" | "medium" | "high" {
  switch (call.tool) {
    case "read_file":
    case "list_directory":
      return "safe";
    case "apply_patch":
      return "medium";
    case "write_file":
      return "high";
  }
}

export const TOOL_CALL_SYSTEM_INSTRUCTIONS = `
You can act on the user's project directly by emitting structured tool-call
blocks. When you want to inspect or change a file, output a fenced block
exactly like this:

\`\`\`tool_call
{
  "tool": "read_file",
  "path": "src/App.tsx",
  "reason": "Need to see current chat layout before editing"
}
\`\`\`

Available tools and their JSON shape:
- read_file        { tool, path, reason }
- list_directory   { tool, path, reason }                     // path "" or "." means root
- write_file       { tool, path, content, reason }            // overwrites or creates
- apply_patch      { tool, path, search, replace, reason }    // single occurrence only

Rules:
1. Always emit *valid* JSON inside the tool_call block — no comments.
2. Use one tool_call per fenced block, but you may emit several blocks per turn.
3. Prefer apply_patch over write_file when changing existing files.
4. For apply_patch the "search" string must match exactly once in the file.
5. After requesting tools, also write a short plain-language summary outside
   the fenced blocks describing what you are about to do and why.
6. Do NOT emit tool_call blocks unless the user has clearly asked for code
   changes or file inspection.
7. The user must approve every tool call before it executes — assume the
   call will run, but do not assume its result.
`.trim();
