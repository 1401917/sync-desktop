import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    strictPort: true,
    port: 1420,
    host: "127.0.0.1"
  },
  envPrefix: ["VITE_", "TAURI_"],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/frontend/setup.ts"]
  }
});
