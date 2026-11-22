import { cn } from "@/lib/utils";

/** Loading reads as redacted lines waiting to be declassified. */
export function LoadingSkeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div className="space-y-2 border-b-2 border-silver/20 pb-4">
        <LoadingSkeleton className="h-8 w-56" />
        <LoadingSkeleton className="h-3 w-96 max-w-full" />
      </div>
      <div className="grid gap-px bg-silver/10 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-3 bg-ink-raised p-5">
            <LoadingSkeleton className="h-2.5 w-24" />
            <LoadingSkeleton className="h-8 w-16" />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {[90, 75, 82, 60, 70].map((w) => (
          <div key={w} style={{ width: `${w}%` }}>
            <LoadingSkeleton className="h-3.5" />
          </div>
        ))}
      </div>
    </div>
  );
}
