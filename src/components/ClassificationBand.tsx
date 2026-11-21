import { cn } from "@/lib/utils";

/** The marking line that runs across the top and bottom of every page in the file. */
export function ClassificationBand({ children, className }: { children: string; className?: string }) {
  return (
    <div
      className={cn(
        "bg-ink px-4 py-1.5 text-center font-display text-[11px] font-bold uppercase tracking-[0.22em] text-bond",
        className,
      )}
      style={{ fontStretch: "90%" }}
    >
      {children}
    </div>
  );
}
