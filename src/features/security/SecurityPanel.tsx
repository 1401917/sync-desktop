import { ShieldCheck } from "lucide-react";
import type { BootstrapPayload } from "../../types/domain";

interface SecurityPanelProps {
  payload: BootstrapPayload;
}

export function SecurityPanel({ payload }: SecurityPanelProps) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-[#171717] p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-lg border border-[#343434] bg-[#222]">
          <ShieldCheck size={16} />
        </div>
        <div>
          <h1 className="text-[17px] font-medium text-[#eeeeee]">Permissions & Security</h1>
          <p className="mt-1 text-[11px] text-[#8d8d8d]">
            Balanced Mode keeps reads scoped and gates writes, commands, GitHub, MCP, connectors,
            and secrets.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Metric label="Security mode" value={payload.securityMode} />
        <Metric label="Permission rules" value={String(payload.permissions.length)} />
        <Metric label="Recent audit/history" value={String(payload.history.length)} />
      </div>

      <div className="mt-5 rounded-xl border border-[#303030] bg-[#202020]">
        <div className="border-b border-[#303030] px-4 py-3 text-[12px] font-medium text-[#eeeeee]">
          Tool permission defaults
        </div>
        <div className="divide-y divide-[#292929]">
          {payload.permissions.map((permission) => (
            <div key={permission.id} className="grid grid-cols-[1fr_160px_100px] gap-3 px-4 py-2.5 text-[11px]">
              <div>
                <div className="font-medium text-[#e8e8e8]">{permission.action}</div>
                <div className="mt-0.5 text-[#777]">{permission.category}</div>
              </div>
              <div className="text-[#a9a9a9]">{permission.level}</div>
              <div className="text-[#a9a9a9]">{permission.risk}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#303030] bg-[#202020] p-3">
      <div className="text-[10px] text-[#777]">{label}</div>
      <div className="mt-1 text-[13px] font-medium text-[#eeeeee]">{value}</div>
    </div>
  );
}
