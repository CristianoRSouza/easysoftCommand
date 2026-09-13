import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: { DEFAULT: "#0B1220", raised: "#111A2C", border: "#1E2A44" },
        ink: { DEFAULT: "#E6EDF7", muted: "#8A9AB5" },
        accent: { DEFAULT: "#3B82F6", hover: "#2563EB" },
        ok: "#10B981",
        warn: "#F59E0B",
        danger: "#EF4444",
      },
    },
  },
  plugins: [],
} satisfies Config;
