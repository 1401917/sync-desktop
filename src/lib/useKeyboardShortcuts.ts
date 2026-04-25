import { useEffect } from "react";

export interface ShortcutHandlers {
  onCommandPalette?: () => void;
  onToggleSidebar?: () => void;
  onToggleBottomPanel?: () => void;
  onFocusComposer?: () => void;
  onToggleTerminal?: () => void;
  onCloseOverlay?: () => void;
}

/**
 * Global keyboard shortcuts. We attach a single capture-phase listener so
 * that focus inside an <input> still triggers the meta-shortcuts (palette,
 * panel toggles) but plain typing isn't intercepted.
 */
export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const meta = event.ctrlKey || event.metaKey;

      // Ctrl+Shift+P — Command Palette
      if (meta && event.shiftKey && event.key.toLowerCase() === "p") {
        event.preventDefault();
        handlers.onCommandPalette?.();
        return;
      }
      // Ctrl+B — Toggle sidebar
      if (meta && !event.shiftKey && event.key.toLowerCase() === "b") {
        event.preventDefault();
        handlers.onToggleSidebar?.();
        return;
      }
      // Ctrl+J — Toggle bottom panel
      if (meta && !event.shiftKey && event.key.toLowerCase() === "j") {
        event.preventDefault();
        handlers.onToggleBottomPanel?.();
        return;
      }
      // Ctrl+` — Toggle terminal (just opens bottom panel on Terminal tab)
      if (meta && (event.key === "`" || event.code === "Backquote")) {
        event.preventDefault();
        handlers.onToggleTerminal?.();
        return;
      }
      // Ctrl+K — Focus composer
      if (meta && !event.shiftKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        handlers.onFocusComposer?.();
        return;
      }
      // Escape — close overlay/modal
      if (event.key === "Escape") {
        handlers.onCloseOverlay?.();
      }
    }
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true } as EventListenerOptions);
  }, [handlers]);
}
