import { Check, FileText, FolderOpen, Pencil, Play, ShieldAlert, X } from "lucide-react";
import { useState } from "react";
import {
  applyPatchTool,
  listDirectoryTool,
  readFileTool,
  writeFileTool,
  type FileToolResult,
  type DirectoryEntry
} from "../lib/backend";
import { describeToolCall, riskOfToolCall, type ToolCall } from "../lib/toolCalls";

interface ToolCallCardProps {
  call: ToolCall;
  projectRoot: string | null | undefined;
  onComplete: (call: ToolCall, result: ToolExecutionResult) => void;
}

export interface ToolExecutionResult {
  ok: boolean;
  message: string;
  filesAdded?: number;
  filesModified?: number;
  linesAdded?: number;
  linesRemoved?: number;
  linesModified?: number;
}

const RISK_TONE = {
  safe: "border-[#2a3f2c] bg-[#1d2a1f] text-[#7fc28a]",
  low: "border-[#2a3a4a] bg-[#1d242c] text-[#9cb8e0]",
  medium: "border-[#3f3a25] bg-[#26241d] text-[#cfb56a]",
  high: "border-[#4a3025] bg-[#2a201d] text-[#e6a268]"
} as const;

export function ToolCallCard({ call, projectRoot, onComplete }: ToolCallCardProps) {
  const [status, setStatus] = useState<"pending" | "running" | "done" | "error" | "rejected">(
    "pending"
  );
  const [resultText, setResultText] = useState<string | null>(null);
  const risk = riskOfToolCall(call);

  async function approve() {
    if (status !== "pending") return;
    if (!projectRoot) {
      setStatus("error");
      setResultText("No project folder is open. Open one and try again.");
      onComplete(call, { ok: false, message: "No project folder open." });
      return;
    }
    setStatus("running");
    try {
      switch (call.tool) {
        case "read_file": {
          if (!call.path) throw new Error("Missing path.");
          const r: FileToolResult = await readFileTool(projectRoot, call.path);
          setResultText(
            `${call.path} (${r.bytes} bytes${r.truncated ? ", truncated" : ""})`
          );
          setStatus("done");
          onComplete(call, {
            ok: true,
            message: r.content ?? "(no content)",
            filesModified: 0,
            linesAdded: 0,
            linesRemoved: 0,
            linesModified: 0
          });
          return;
        }
        case "list_directory": {
          const entries: DirectoryEntry[] = await listDirectoryTool(
            projectRoot,
            call.path ?? ""
          );
          const summary = entries
            .slice(0, 50)
            .map((e) => `${e.isDirectory ? "📁" : "📄"} ${e.relativePath}`)
            .join("\n");
          setResultText(`${entries.length} entries`);
          setStatus("done");
          onComplete(call, {
            ok: true,
            message: summary || "(empty)"
          });
          return;
        }
        case "write_file": {
          if (!call.path || typeof call.content !== "string") {
            throw new Error("Missing path or content.");
          }
          const r = await writeFileTool(projectRoot, call.path, call.content);
          setResultText(
            `${r.relativePath} +${r.linesAdded} -${r.linesRemoved} ~${r.linesModified}`
          );
          setStatus("done");
          onComplete(call, {
            ok: true,
            message: `Wrote ${r.relativePath}: ${r.bytes} bytes`,
            filesAdded: r.linesRemoved + r.linesModified === 0 ? 1 : 0,
            filesModified: r.linesRemoved + r.linesModified > 0 ? 1 : 0,
            linesAdded: r.linesAdded,
            linesRemoved: r.linesRemoved,
            linesModified: r.linesModified
          });
          return;
        }
        case "apply_patch": {
          if (!call.path || !call.search || typeof call.replace !== "string") {
            throw new Error("Missing path/search/replace.");
          }
          const r = await applyPatchTool(projectRoot, call.path, call.search, call.replace);
          setResultText(
            `${r.relativePath} +${r.linesAdded} -${r.linesRemoved} ~${r.linesModified}`
          );
          setStatus("done");
          onComplete(call, {
            ok: true,
            message: `Patched ${r.relativePath}`,
            filesModified: 1,
            linesAdded: r.linesAdded,
            linesRemoved: r.linesRemoved,
            linesModified: r.linesModified
          });
          return;
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setResultText(message);
      setStatus("error");
      onComplete(call, { ok: false, message });
    }
  }

  function reject() {
    if (status !== "pending") return;
    setStatus("rejected");
    setResultText("Rejected by user.");
    onComplete(call, { ok: false, message: "Rejected by user." });
  }

  const Icon =
    call.tool === "read_file" ? FileText :
    call.tool === "list_directory" ? FolderOpen :
    call.tool === "apply_patch" ? Pencil :
    Pencil;

  return (
    <div className="rounded-xl border border-[#2a2a2a] bg-[#1c1c1c]">
      <div className="flex items-center justify-between gap-3 border-b border-[#222] px-3.5 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon size={13} className="shrink-0 text-[#9a9a9a]" />
          <span className="truncate text-[12.5px] font-medium text-[#ededed]">
            {describeToolCall(call)}
          </span>
          <span className={`rounded-full border px-2 py-0.5 text-[10px] ${RISK_TONE[risk]}`}>
            {risk}
          </span>
        </div>
        {status === "pending" ? (
          <div className="flex items-center gap-1">
            <button
              onClick={reject}
              className="grid h-6 w-6 place-items-center rounded text-[#9a9a9a] transition hover:bg-[#262626] hover:text-[#e08585]"
              title="Reject"
            >
              <X size={12} />
            </button>
            <button
              onClick={approve}
              className="flex h-6 items-center gap-1.5 rounded bg-[#2a3f2c] px-2 text-[10.5px] font-medium text-[#aedab1] transition hover:bg-[#345038]"
              title="Approve and run"
            >
              <Play size={11} />
              Run
            </button>
          </div>
        ) : status === "running" ? (
          <span className="text-[11px] text-[#9a9a9a]">Running…</span>
        ) : status === "done" ? (
          <span className="flex items-center gap-1 text-[11px] text-[#7fc28a]">
            <Check size={12} /> Done
          </span>
        ) : status === "rejected" ? (
          <span className="text-[11px] text-[#9a9a9a]">Rejected</span>
        ) : (
          <span className="flex items-center gap-1 text-[11px] text-[#e08585]">
            <ShieldAlert size={12} /> Failed
          </span>
        )}
      </div>
      {call.reason ? (
        <div className="px-3.5 py-2 text-[11.5px] text-[#9a9a9a]">{call.reason}</div>
      ) : null}
      {resultText ? (
        <div className="border-t border-[#222] bg-[#161616] px-3.5 py-1.5 font-mono text-[10.5px] text-[#9a9a9a]">
          {resultText}
        </div>
      ) : null}
    </div>
  );
}
