import type { Severity } from "./types";

export const severityOrder: Severity[] = ["critical", "high", "medium", "low", "info"];

export const severityLabels: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Info",
};

// Color rides the edge (badge border + swatch); the label text stays neutral so severity never depends on hue alone.
// Severity hues are semantic, not palette: Lime is never a severity, it marks the single top action.
export const severityClasses: Record<Severity, string> = {
  critical: "border-severity-critical text-fg",
  high: "border-severity-high text-fg",
  medium: "border-severity-medium text-fg",
  low: "border-severity-low text-fg",
  info: "border-severity-info text-fg-soft",
};

// For inline styles (bars, swatches, graph cards); values live in globals.css.
export const severityColors: Record<Severity, string> = {
  critical: "rgb(var(--rgb-sev-critical))",
  high: "rgb(var(--rgb-sev-high))",
  medium: "rgb(var(--rgb-sev-medium))",
  low: "rgb(var(--rgb-sev-low))",
  info: "rgb(var(--rgb-sev-info))",
};

export const severityWeight: Record<Severity, number> = { critical: 5, high: 4, medium: 3, low: 2, info: 1 };

export const bySeverity = <T extends { severity: Severity }>(a: T, b: T) =>
  severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity);
