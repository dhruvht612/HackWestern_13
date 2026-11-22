import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto", style: "short" });
const UNITS = [["year", 31_536_000], ["month", 2_592_000], ["week", 604_800], ["day", 86_400], ["hour", 3_600], ["minute", 60]] as const;

/** "5 minutes ago", "yesterday". Scannable in a queue; pair it with formatDate in a title. */
export function timeAgo(value: string | null | undefined, now = Date.now()) {
  const t = value ? Date.parse(value) : NaN;
  if (Number.isNaN(t)) return formatDate(value);
  const seconds = Math.round((t - now) / 1000);
  for (const [unit, size] of UNITS) if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  return "just now";
}

export function shortId(value: string) {
  return value.slice(0, 8);
}
