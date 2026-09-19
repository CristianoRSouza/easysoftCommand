import type { Config } from "tailwindcss";

/**
 * As cores vêm de variáveis CSS em `src/index.css`, não de valores literais
 * aqui. É o que permite o design existir num lugar só — e é o mesmo arranjo do
 * projeto anterior, para que a aparência seja idêntica.
 */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          glow: "hsl(var(--primary-glow))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        heading: ["Sora", "Manrope", "system-ui", "sans-serif"],
        sans: ["Manrope", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "JetBrains Mono", "monospace"],
      },
      // As do botão do assistente, idênticas às do projeto anterior.
      keyframes: {
        "ai-breathe": {
          "0%, 100%": { transform: "scale(1)", boxShadow: "0 8px 24px -8px hsl(var(--primary) / 0.45)" },
          "50%": { transform: "scale(1.04)", boxShadow: "0 12px 32px -6px hsl(var(--primary) / 0.65)" },
        },
        "ai-conic-spin": { "0%": { transform: "rotate(0deg)" }, "100%": { transform: "rotate(360deg)" } },
        "ai-orbit": {
          "0%": { transform: "rotate(0deg) translateX(22px) rotate(0deg)" },
          "100%": { transform: "rotate(360deg) translateX(22px) rotate(-360deg)" },
        },
      },
      animation: {
        "ai-breathe": "ai-breathe 4s ease-in-out infinite",
        "ai-conic-spin": "ai-conic-spin 6s linear infinite",
        "ai-orbit": "ai-orbit 5s linear infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
