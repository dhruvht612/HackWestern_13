/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#0B0F14",
        panel: "#121821",
        border: "#1F2A37",
        accent: "#22D3EE",
        severity: {
          critical: "#EF4444",
          high: "#F97316",
          medium: "#EAB308",
          low: "#3B82F6",
          info: "#64748B",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        panel: "0 0 0 1px rgba(31,42,55,1), 0 8px 24px rgba(0,0,0,0.35)",
      },
    },
  },
  plugins: [],
};
