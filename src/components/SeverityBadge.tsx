import { severityClasses, severityColors, severityLabels } from "@/lib/severity";
import type { Severity } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 border-[1.5px] px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.08em]",
        severity === "critical" && "border-2",
        severityClasses[severity],
        className,
      )}
    >
      <span className="h-2 w-2" style={{ background: severityColors[severity] }} aria-hidden="true" />
      {severityLabels[severity]}
    </span>
  );
}
