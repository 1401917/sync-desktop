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
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useEffect, useRef, useState } from "react";
import type { MouseEvent, PointerEvent } from "react";
import type { BootstrapPayload } from "../types/domain";

interface TopBarProps {
  payload: BootstrapPayload;
}

interface MenuEntry {
  label: string;
  shortcut?: string;
  onSelect?: () => void | Promise<void>;
  disabled?: boolean;
  separator?: boolean;
}

const updateAvailable = true;

export function TopBar({ payload }: TopBarProps) {
  const appWindow = getCurrentWindow();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickAway(event: globalThis.MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    }
    if (openMenu) {
      document.addEventListener("mousedown", handleClickAway);
      return () => document.removeEventListener("mousedown", handleClickAway);
    }
  }, [openMenu]);

  async function openNewWindow() {
    const id = `sync-${Date.now()}`;
    try {
      const next = new WebviewWindow(id, {
        url: "/",
        title: "Sync",
        width: 1280,
        height: 800,
        decorations: false,
        resizable: true
      });
      await next.once("tauri://error", (event) => {
        console.warn("New window error", event);
      });
    } catch (error) {
      console.warn("Unable to create new window", error);
    }
  }

  const menus: Record<string, MenuEntry[]> = {
    File: [
      { label: "New Window", shortcut: "Ctrl+Shift+N", onSelect: openNewWindow },
      { separator: true, label: "" },
      { label: "Close Window", shortcut: "Ctrl+W", onSelect: () => appWindow.close() }
    ],
    Edit: [
      { label: "Undo", shortcut: "Ctrl+Z", onSelect: () => { document.execCommand("undo"); } },
      { label: "Redo", shortcut: "Ctrl+Y", onSelect: () => { document.execCommand("redo"); } },
      { separator: true, label: "" },
      { label: "Cut", shortcut: "Ctrl+X", onSelect: () => { document.execCommand("cut"); } },
      { label: "Copy", shortcut: "Ctrl+C", onSelect: () => { document.execCommand("copy"); } },
      { label: "Paste", shortcut: "Ctrl+V", onSelect: () => { document.execCommand("paste"); } }
    ],
    View: [
      {
        label: "Toggle Fullscreen",
        shortcut: "F11",
        onSelect: async () => {
          const isFullscreen = await appWindow.isFullscreen().catch(() => false);
          await appWindow.setFullscreen(!isFullscreen).catch(() => undefined);
        }
      },
      { label: "Reload", shortcut: "Ctrl+R", onSelect: () => window.location.reload() }
    ],
    Window: [
      { label: "Minimize", shortcut: "Ctrl+M", onSelect: () => appWindow.minimize() },
      { label: "Maximize / Restore", onSelect: () => appWindow.toggleMaximize() },
      { separator: true, label: "" },
      { label: "New Window", shortcut: "Ctrl+Shift+N", onSelect: openNewWindow }
    ],
    Help: [
      {
        label: "Open Documentation",
        onSelect: () => { window.open("https://github.com/1401917/sync-desktop", "_blank"); }
      },
      {
        label: "Report Issue",
        onSelect: () => {
          window.open("https://github.com/1401917/sync-desktop/issues/new", "_blank");
        }
      },
      { separator: true, label: "" },
      { label: `About ${payload.appName}`, disabled: true }
    ]
  };

  async function startDragging(event: PointerEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest("button, [data-no-drag='true']")) return;
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
    if ((event.target as HTMLElement).closest("button, [data-no-drag='true']")) return;
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
            <div className="h-2 w-2 rounded-full bg-[#cfcfcf]" />
          </div>
          <span data-tauri-drag-region className="text-[12px] font-medium text-[#eeeeee]">
            {payload.appName}
          </span>
        </div>

        <nav className="ml-4 flex items-center gap-1" ref={menuRef}>
          {Object.keys(menus).map((label) => {
            const isOpen = openMenu === label;
            return (
              <div key={label} className="relative">
                <button
                  data-no-drag="true"
                  className={`app-menu-button ${isOpen ? "bg-[#262626] text-[#e8e8e8]" : ""}`}
                  onClick={() => setOpenMenu(isOpen ? null : label)}
                >
                  {label}
                </button>
                {isOpen ? (
                  <div
                    data-no-drag="true"
                    className="absolute left-0 top-[26px] z-50 min-w-[200px] rounded-md border border-[#2d2d2d] bg-[#1c1c1c] p-1 shadow-[0_8px_28px_rgba(0,0,0,0.45)]"
                  >
                    {menus[label].map((entry, index) =>
                      entry.separator ? (
                        <div key={`sep-${index}`} className="my-1 border-t border-[#2a2a2a]" />
                      ) : (
                        <button
                          key={entry.label}
                          disabled={entry.disabled}
                          onClick={() => {
                            setOpenMenu(null);
                            entry.onSelect?.();
                          }}
                          className="flex w-full items-center justify-between gap-3 rounded px-2.5 py-1.5 text-left text-[12px] text-[#dcdcdc] transition hover:bg-[#262626] disabled:cursor-default disabled:text-[#6e6e6e] disabled:hover:bg-transparent"
                        >
                          <span>{entry.label}</span>
                          {entry.shortcut ? (
                            <span className="text-[10.5px] text-[#7a7a7a]">{entry.shortcut}</span>
                          ) : null}
                        </button>
                      )
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
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
        <button data-no-drag="true" className="window-control" aria-label="Minimize" title="Minimize" onClick={minimize}>
          <Minus size={13} />
        </button>
        <button data-no-drag="true" className="window-control" aria-label="Maximize" title="Maximize" onClick={toggleMaximize}>
          <Maximize2 size={12} />
        </button>
        <button data-no-drag="true" className="window-control close" aria-label="Close" title="Close" onClick={close}>
          <X size={13} />
        </button>
      </div>
    </header>
  );
}
