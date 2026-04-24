import {
  PanelLeft,
  Settings,
  Boxes
} from "lucide-react";
import { cn } from "../lib/cn";
import type { NavKey } from "../types/domain";

const navItems: Array<{ id: NavKey; label: string; icon: typeof PanelLeft }> = [
  { id: "projects", label: "Projects", icon: PanelLeft },
  { id: "connectors", label: "Connectors", icon: Boxes },
  { id: "settings", label: "Settings", icon: Settings }
];

interface SidebarProps {
  activeView: NavKey;
  onNavigate: (view: NavKey) => void;
}

export function Sidebar({
  activeView,
  onNavigate
}: SidebarProps) {
  return (
    <aside className="flex w-[232px] shrink-0 flex-col border-r border-[#292929] bg-[#1b1b1b] px-3 py-3">
      <div className="mb-5 px-1">
        <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-[#656565]">
          Workspace
        </div>
        <div className="mt-1 truncate text-[12px] font-medium text-[#d9d9d9]">Sync Desktop</div>
      </div>

      <nav className="shrink-0 space-y-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.id === activeView;

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                "flex h-[32px] w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[12px] transition",
                active
                  ? "bg-[#2a2a2a] text-[#f0f0f0] shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]"
                  : "text-[#a5a5a5] hover:bg-[#242424] hover:text-[#e8e8e8]"
              )}
            >
              <Icon className={active ? "text-[#f0f0f0]" : "text-[#858585]"} size={13} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-auto rounded-lg border border-[#2a2a2a] bg-[#202020] px-3 py-2.5">
        <div className="flex items-center gap-2 text-[11px] font-medium text-[#d8d8d8]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#32d583]" />
          Ready
        </div>
        <div className="mt-1 text-[10.5px] leading-4 text-[#777]">
          Local-first workspace with approval gates.
        </div>
      </div>
    </aside>
  );
}
