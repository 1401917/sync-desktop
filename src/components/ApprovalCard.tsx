import { ShieldAlert } from "lucide-react";
import type { RiskLevel } from "../types/domain";

interface ApprovalCardProps {
  title: string;
  action: string;
  target: string;
  risk: RiskLevel;
  permission: string;
  reason: string;
}

export function ApprovalCard({ title, action, target, risk, permission, reason }: ApprovalCardProps) {
  return (
    <div className="rounded-2xl border border-[#2A3545] bg-sync-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-[#EAF2FC]">
          <ShieldAlert size={16} className="text-sync-warning" />
          {title}
        </div>
        <span className="rounded-full border border-[#4A3B1E] bg-[#211A10] px-2 py-1 text-[11px] text-sync-warning">
          {risk}
        </span>
      </div>

      <div className="mt-4 space-y-2 text-[12px]">
        <Info label="Action" value={action} />
        <Info label="Target" value={target} />
        <Info label="Permission" value={permission} />
      </div>

      <p className="mt-3 text-[12px] leading-5 text-sync-secondary">{reason}</p>

      <div className="mt-4 flex items-center gap-2">
        <button className="rounded-xl border border-[#2B3A4E] bg-[#172231] px-3 py-2 text-[12px] text-[#DCE6F2] transition hover:bg-sync-hover">
          Allow once
        </button>
        <button className="rounded-xl border border-[#2B3A4E] px-3 py-2 text-[12px] text-sync-secondary transition hover:bg-sync-hover">
          Deny
        </button>
        <button className="rounded-xl border border-[#2B3A4E] px-3 py-2 text-[12px] text-sync-secondary transition hover:bg-sync-hover">
          Modify
        </button>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[#1A2431] pb-2 last:border-0 last:pb-0">
      <span className="text-sync-muted">{label}</span>
      <span className="text-right text-[#E4ECF7]">{value}</span>
    </div>
  );
}
