import { diffLines } from "../../lib/lineDiff";
import type { DiffPlanOp } from "../../types/diffPlan";

interface DiffViewProps {
  op: DiffPlanOp;
}

export function DiffView({ op }: DiffViewProps) {
  if (op.kind === "delete") {
    return (
      <div className="bg-red-50 p-2 rounded font-mono text-sm">
        <div className="text-red-600">- {op.before_content}</div>
      </div>
    );
  }

  if (op.kind === "create") {
    return (
      <div className="bg-green-50 p-2 rounded font-mono text-sm">
        <div className="text-green-600">+ {op.after_content}</div>
      </div>
    );
  }

  // Update: show diff
  const segments = diffLines(op.before_content, op.after_content);
  return (
    <div className="bg-gray-50 p-2 rounded font-mono text-sm max-h-60 overflow-y-auto">
      {segments.map((segment, i) => (
        <div key={i} className={
          segment.kind === "added" ? "text-green-600 bg-green-50" :
          segment.kind === "removed" ? "text-red-600 bg-red-50" :
          "text-gray-600"
        }>
          {segment.kind === "added" ? "+ " :
           segment.kind === "removed" ? "- " :
           "  "}
          {segment.text}
        </div>
      ))}
    </div>
  );
}