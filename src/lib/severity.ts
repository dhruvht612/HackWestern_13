import type { Severity } from "./types";

export const severityOrder: Severity[] = ["critical", "high", "medium", "low", "info"];

export const severityLabels: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Info",
};

export const severityClasses: Record<Severity, string> = {
  critical: "bg-severity-critical/15 text-severity-critical border-severity-critical/40",
  high: "bg-severity-high/15 text-severity-high border-severity-high/40",
  medium: "bg-severity-medium/15 text-severity-medium border-severity-medium/40",
  low: "bg-severity-low/15 text-severity-low border-severity-low/40",
  info: "bg-severity-info/15 text-severity-info border-severity-info/40",
};

export const severityColors: Record<Severity, string> = {
  critical: "#EF4444",
  high: "#F97316",
  medium: "#EAB308",
  low: "#3B82F6",
  info: "#64748B",
};
