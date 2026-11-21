import { cn } from "@/lib/utils";

export function LoadingSkeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-slate-800/70", className)} />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-4">
      <LoadingSkeleton className="h-8 w-64" />
      <div className="grid gap-4 md:grid-cols-4">
        <LoadingSkeleton className="h-28" />
        <LoadingSkeleton className="h-28" />
        <LoadingSkeleton className="h-28" />
        <LoadingSkeleton className="h-28" />
      </div>
      <LoadingSkeleton className="h-64" />
    </div>
  );
}
