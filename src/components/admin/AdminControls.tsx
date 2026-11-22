import { useId } from "react";
import type { AiVerdict } from "@/lib/types";
import { cn, formatDate, timeAgo } from "@/lib/utils";

/** Relative time for scanning, the exact timestamp on hover. */
export function When({ iso }: { iso: string | null | undefined }) {
  return (
    <time dateTime={iso ?? undefined} title={formatDate(iso)} className="tabular whitespace-nowrap">
      {timeAgo(iso)}
    </time>
  );
}

const ADVICE_TONE = {
  approve: "border-silver",
  needs_more_info: "border-severity-medium",
  reject: "border-severity-critical",
} as const;

/** The AI's recommendation as a chip: text always carries it, the edge colour only reinforces. */
export function AdviceChip({ verdict }: { verdict: AiVerdict }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className={cn("border-[1.5px] px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.06em]", ADVICE_TONE[verdict.recommendation])}>
        {verdict.recommendation.replaceAll("_", " ")}
      </span>
      <span className="text-[12px] text-fg-soft">
        {verdict.confidence} confidence · {verdict.fallback_used ? "rules only" : "Gemini"}
      </span>
    </span>
  );
}

export function AdminFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="w-full max-w-xs">
      <label className="field-label block" htmlFor={id}>
        {label}
      </label>
      <select id={id} className="field" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function AdminNotice({ message }: { message: string }) {
  return (
    <p role="status" className="min-h-5 text-sm text-lime">
      {message}
    </p>
  );
}
