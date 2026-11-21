/** @type {import('tailwindcss').Config} */

// Every color resolves to a CSS variable in src/styles/globals.css; nothing is hardcoded here.
const c = (name) => `rgb(var(--rgb-${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // 60: Abyss Navy and its depth steps
        navy: { DEFAULT: c("primary"), deep: c("primary-deep"), raised: c("primary-raised"), high: c("primary-high") },
        // 30: Camel Suede
        camel: c("secondary"),
        // 10: Electric Kiwi
        kiwi: { DEFAULT: c("accent"), hover: c("accent-hover") },
        // Neutral text
        fg: { DEFAULT: c("text-primary"), soft: c("text-secondary"), faint: c("text-muted") },
        // Semantic severity (always paired with a label)
        severity: {
          critical: c("sev-critical"),
          high: c("sev-high"),
          medium: c("sev-medium"),
          low: c("sev-low"),
          info: c("sev-info"),
        },
      },
      fontFamily: {
        sans: ['"Public Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"Courier Prime"', "ui-monospace", "SFMono-Regular", "monospace"],
        display: ["Archivo", '"Public Sans"', "ui-sans-serif", "sans-serif"],
      },
      boxShadow: {
        sheet: "inset 0 0 0 1px rgb(var(--rgb-secondary) / 0.16), 0 18px 40px -16px rgb(0 0 0 / 0.65)",
        lift: "0 8px 18px -8px rgb(var(--rgb-accent) / 0.35)",
      },
    },
  },
  plugins: [],
};
