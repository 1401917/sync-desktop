import {
  Bell,
  ChevronDown,
  Command,
  Maximize2,
  Minus,
  Search,
  Settings,
  X
} from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { PointerEvent } from "react";
import type { BootstrapPayload } from "../types/domain";

interface TopBarProps {
  payload: BootstrapPayload;
}

export function TopBar({ payload }: TopBarProps) {
  const appWindow = getCurrentWindow();

  async function startDragging(event: PointerEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest("button, [data-no-drag='true']")) {
      return;
    }

    if (event.button === 0) {
      await appWindow.startDragging().catch(() => undefined);
    }
  }

  async function toggleMaximize() {
    await appWindow.toggleMaximize().catch(() => undefined);
  }

  async function minimize() {
    await appWindow.minimize().catch(() => undefined);
  }

  async function close() {
    await appWindow.close().catch(() => undefined);
  }

  return (
    <header
      data-tauri-drag-region
      onPointerDown={startDragging}
      onDoubleClick={toggleMaximize}
      className="flex h-[34px] shrink-0 items-center justify-between border-b border-[#2a2a2a] bg-[#1b1b1b] pl-3 pr-2"
    >
      <div data-tauri-drag-region className="flex w-[190px] items-center gap-2">
        <div className="grid h-4 w-4 place-items-center rounded-[4px] border border-[#343434] bg-[#222]">
          <div className="h-1.5 w-1.5 rounded-full bg-[#f5f5f5]" />
        </div>
        <span data-tauri-drag-region className="text-[11px] font-medium text-[#d8d8d8]">
          {payload.appName}
        </span>
      </div>

      <button data-no-drag="true" className="flex h-[22px] items-center gap-1.5 rounded-md border border-[#343434] bg-[#242424] px-2 text-[11px] text-[#dcdcdc] transition hover:bg-[#2b2b2b]">
        <span>Main Project</span>
        <ChevronDown size={12} />
      </button>

      <div className="flex w-[190px] items-center justify-end gap-1">
        <button data-no-drag="true" className="titlebar-button" aria-label="Search">
          <Search size={12} />
        </button>
        <button data-no-drag="true" className="titlebar-button" aria-label="Commands">
          <Command size={12} />
        </button>
        <button data-no-drag="true" className="titlebar-button" aria-label="Notifications">
          <Bell size={12} />
        </button>
        <button data-no-drag="true" className="titlebar-button" aria-label="Settings">
          <Settings size={12} />
        </button>
        <div className="mx-1 h-4 w-px bg-[#303030]" />
        <button
          data-no-drag="true"
          className="window-control"
          aria-label="Minimize"
          title="Minimize"
          onClick={minimize}
        >
          <Minus size={13} />
        </button>
        <button
          data-no-drag="true"
          className="window-control"
          aria-label="Maximize"
          title="Maximize"
          onClick={toggleMaximize}
        >
          <Maximize2 size={12} />
        </button>
        <button
          data-no-drag="true"
          className="window-control close"
          aria-label="Close"
          title="Close"
          onClick={close}
        >
          <X size={13} />
        </button>
      </div>
    </header>
  );
}
