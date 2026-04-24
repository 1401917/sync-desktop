import { invoke } from "@tauri-apps/api/core";
import { demoPayload } from "./seed";
import type { BootstrapPayload } from "../types/domain";

function isTauriRuntime() {
  return Boolean(window.__TAURI_INTERNALS__);
}

export async function bootstrapSync(): Promise<BootstrapPayload> {
  if (!isTauriRuntime()) {
    return demoPayload;
  }

  try {
    return await invoke<BootstrapPayload>("bootstrap");
  } catch (error) {
    console.warn("Falling back to demo bootstrap payload.", error);
    return demoPayload;
  }
}
