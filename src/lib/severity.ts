import type { Severity } from "./types";

export const severityOrder: Severity[] = ["critical", "high", "medium", "low", "info"];

export const severityLabels: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Info",
};

// Color rides the edge (cover-sheet band); text stays ink. Stamp red is not a severity: it marks the P0 alone.
export const severityClasses: Record<Severity, string> = {
  critical: "border-severity-critical text-ink",
  high: "border-severity-high text-ink",
  medium: "border-severity-medium text-ink",
  low: "border-severity-low text-ink",
  info: "border-severity-info text-ink-soft",
};

export const severityColors: Record<Severity, string> = {
  critical: "#7A1530",
  high: "#D9480F",
  medium: "#A87C00",
  low: "#2E6E62",
  info: "#6B6B66",
};

export const severityWeight: Record<Severity, number> = { critical: 5, high: 4, medium: 3, low: 2, info: 1 };

export const bySeverity = <T extends { severity: Severity }>(a: T, b: T) =>
  severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity);
