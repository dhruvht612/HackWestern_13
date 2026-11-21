/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // The Attacker's Dossier: folder stock, bond paper, carbon ink, one stamp red.
        manila: { DEFAULT: "#D9A13B", deep: "#C38D2E", dark: "#4A3410" },
        bond: "#F8F7F3",
        ink: { DEFAULT: "#141414", soft: "#4A4A46", faint: "#6E6C64" },
        stamp: "#C8102E",
        carbon: "#1F3A93",
        // Stamp red belongs to the P0 mark alone and carbon blue to focus alone, so severity keeps its own inks.
        severity: {
          critical: "#7A1530",
          high: "#D9480F",
          medium: "#A87C00",
          low: "#2E6E62",
          info: "#6B6B66",
        },
      },
      fontFamily: {
        sans: ['"Public Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"Courier Prime"', "ui-monospace", "SFMono-Regular", "monospace"],
        display: ["Archivo", '"Public Sans"', "ui-sans-serif", "sans-serif"],
      },
      boxShadow: {
        sheet: "0 1px 1px rgba(74,52,16,0.18), 0 18px 36px -14px rgba(74,52,16,0.55)",
        lift: "0 2px 4px rgba(20,20,20,0.18), 0 10px 18px -8px rgba(20,20,20,0.4)",
      },
    },
  },
  plugins: [],
};
