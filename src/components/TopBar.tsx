import {
  ArrowLeft,
  ArrowRight,
  Bell,
  ChevronDown,
  Command,
  Download,
  GitBranch,
  Maximize2,
  Minus,
  PanelLeft,
  Search,
  Settings,
  X
} from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { MouseEvent, PointerEvent } from "react";
import type { BootstrapPayload } from "../types/domain";

interface TopBarProps {
  payload: BootstrapPayload;
}

const menuItems = ["File", "Edit", "View", "Window", "Help"];
const updateAvailable = true;

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

  async function maximizeFromTitlebar(event: MouseEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest("button, [data-no-drag='true']")) {
      return;
    }

    await toggleMaximize();
  }

  return (
    <header
      data-tauri-drag-region
      onPointerDown={startDragging}
      onDoubleClick={maximizeFromTitlebar}
      className="flex h-[40px] shrink-0 items-center justify-between border-b border-[#242424] bg-[#1b1b1b] pl-2.5 pr-2"
    >
      <div data-tauri-drag-region className="flex min-w-0 flex-1 items-center gap-1.5">
        <button data-no-drag="true" className="titlebar-button" aria-label="Toggle sidebar">
          <PanelLeft size={13} />
        </button>
        <button data-no-drag="true" className="titlebar-button" aria-label="Back">
          <ArrowLeft size={13} />
        </button>
        <button data-no-drag="true" className="titlebar-button" aria-label="Forward">
          <ArrowRight size={13} />
        </button>

        <div data-tauri-drag-region className="ml-1 flex items-center gap-2">
          <div className="grid h-[18px] w-[18px] place-items-center rounded-full border border-[#353535] bg-[#242424]">
            <div className="h-2 w-2 rounded-full bg-[#4c9bff]" />
          </div>
          <span data-tauri-drag-region className="text-[12px] font-medium text-[#eeeeee]">
            {payload.appName}
          </span>
        </div>

        <nav className="ml-4 flex items-center gap-1">
          {menuItems.map((item) => (
            <button key={item} data-no-drag="true" className="app-menu-button">
              {item}
            </button>
          ))}
        </nav>
      </div>

      <div data-tauri-drag-region className="flex shrink-0 items-center gap-2">
        <button data-no-drag="true" className="toolbar-chip">
          <GitBranch size={12} />
          <span>Main Project</span>
          <ChevronDown size={12} />
        </button>
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-end gap-1">
        {updateAvailable ? (
          <button data-no-drag="true" className="update-button" aria-label="Update Sync">
            <Download size={12} />
            <span>Update</span>
          </button>
        ) : null}
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
