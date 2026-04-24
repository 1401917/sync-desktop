import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}", "./tests/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        sync: {
          app: "#0B0F14",
          top: "#0C1117",
          sidebar: "#0E141C",
          main: "#0F141B",
          panel: "#121922",
          card: "#111A24",
          hover: "#18212C",
          border: "#222C38",
          input: "#111821",
          active: "#172231",
          accent: "#4C8DFF",
          accentHover: "#6AA3FF",
          success: "#33C27F",
          warning: "#F3B94E",
          error: "#FF6B6B",
          text: "#E7EDF5",
          secondary: "#A8B3C2",
          muted: "#7F8A99"
        }
      },
      boxShadow: {
        "sync-soft": "0 18px 60px rgba(0, 0, 0, 0.32)",
        "sync-focus": "0 0 0 3px rgba(76, 141, 255, 0.28)"
      },
      fontFamily: {
        sans: [
          "Inter",
          "Segoe UI",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "sans-serif"
        ],
        mono: ["JetBrains Mono", "Cascadia Code", "Consolas", "monospace"]
      }
    }
  },
  plugins: []
} satisfies Config;
