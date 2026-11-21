import { severityClasses, severityLabels } from "@/lib/severity";
import type { Severity } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium uppercase tracking-wide",
        severityClasses[severity],
        className,
      )}
    >
      {severityLabels[severity]}
    </span>
  );
}
