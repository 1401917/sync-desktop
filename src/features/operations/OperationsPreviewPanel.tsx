import { Check, X, AlertTriangle, FileText, Trash2, Plus } from "lucide-react";
import { useState } from "react";
import type { DiffPlanOp } from "../../types/diffPlan";
import { classifyRisk, resolveApprovalDecision } from "../../lib/diffPlan";
import { RiskBadge } from "./RiskBadge";
import { DiffView } from "./DiffView";

interface OperationsPreviewPanelProps {
  ops: DiffPlanOp[];
  mode: "Manual" | "Balanced" | "Autonomous";
  onApprove: (approvedOps: DiffPlanOp[]) => void;
  onReject: () => void;
}

export function OperationsPreviewPanel({
  ops,
  mode,
  onApprove,
  onReject,
}: OperationsPreviewPanelProps) {
  const [selectedOps, setSelectedOps] = useState<Set<string>>(new Set());
  const [expandedOp, setExpandedOp] = useState<string | null>(null);

  const toggleOp = (path: string) => {
    const newSelected = new Set(selectedOps);
    if (newSelected.has(path)) {
      newSelected.delete(path);
    } else {
      newSelected.add(path);
    }
    setSelectedOps(newSelected);
  };

  const approveSelected = () => {
    const approved = ops.filter(op => selectedOps.has(op.path) && !op.blocked);
    onApprove(approved);
  };

  const approveAll = () => {
    const approved = ops.filter(op => !op.blocked);
    onApprove(approved);
  };

  const getOpIcon = (kind: DiffPlanOp["kind"]) => {
    switch (kind) {
      case "create": return <Plus className="w-4 h-4 text-green-500" />;
      case "update": return <FileText className="w-4 h-4 text-blue-500" />;
      case "delete": return <Trash2 className="w-4 h-4 text-red-500" />;
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Operations Preview</h2>
        <div className="flex gap-2">
          <button
            onClick={approveAll}
            className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Approve All
          </button>
          <button
            onClick={approveSelected}
            disabled={selectedOps.size === 0}
            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            Approve Selected ({selectedOps.size})
          </button>
          <button
            onClick={onReject}
            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Reject All
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {ops.map((op) => {
          const risk = classifyRisk(op);
          const decision = resolveApprovalDecision(op, mode);
          const canApprove = !op.blocked && decision === "auto-approve";

          return (
            <div key={op.path} className="border rounded p-3">
              <div className="flex items-center gap-2">
                {getOpIcon(op.kind)}
                <span className="font-mono text-sm">{op.path}</span>
                <RiskBadge risk={risk} />
                {op.blocked && <span className="text-red-500 text-xs">BLOCKED</span>}
                <div className="ml-auto flex gap-1">
                  <button
                    onClick={() => setExpandedOp(expandedOp === op.path ? null : op.path)}
                    className="px-2 py-1 text-xs bg-gray-200 rounded"
                  >
                    {expandedOp === op.path ? "Collapse" : "Expand"}
                  </button>
                  <button
                    onClick={() => toggleOp(op.path)}
                    disabled={op.blocked}
                    className={`px-2 py-1 text-xs rounded ${
                      selectedOps.has(op.path)
                        ? "bg-green-200 text-green-800"
                        : "bg-gray-200"
                    } ${op.blocked ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    {selectedOps.has(op.path) ? "Selected" : "Select"}
                  </button>
                </div>
              </div>
              {expandedOp === op.path && (
                <div className="mt-2">
                  <DiffView op={op} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}