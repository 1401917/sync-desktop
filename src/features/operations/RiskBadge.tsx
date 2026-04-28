import type { OperationRisk } from "../../types/diffPlan";

export function RiskBadge({ risk }: { risk: OperationRisk }) {
  const cls =
    risk === "Critical"
      ? "border-rose-700/70 bg-rose-950/50 text-rose-200"
      : risk === "High"
      ? "border-orange-700/60 bg-orange-950/40 text-orange-200"
      : risk === "Medium"
      ? "border-amber-700/60 bg-amber-950/40 text-amber-200"
      : "border-zinc-700/60 bg-zinc-900/60 text-zinc-300";
  return (
    <span
      data-testid="risk-badge"
      data-risk={risk}
      className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${cls}`}
    >
      {risk}
    </span>
  );
}
