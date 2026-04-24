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
    <aside className="flex w-[158px] shrink-0 flex-col border-r border-[#2c2c2c] bg-[#191919] px-2 py-3">
      <nav className="shrink-0 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.id === activeView;

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                "flex h-[28px] w-full items-center gap-2 rounded-md px-2 text-left text-[11px] transition",
                active
                  ? "bg-[#2a2a2a] text-[#f0f0f0]"
                  : "text-[#a9a9a9] hover:bg-[#242424] hover:text-[#e8e8e8]"
              )}
            >
              <Icon className={active ? "text-[#f0f0f0]" : "text-[#858585]"} size={13} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
