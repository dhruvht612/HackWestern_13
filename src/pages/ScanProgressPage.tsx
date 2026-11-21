import { useParams } from "react-router-dom";
import { useScan } from "@/hooks/useScan";
import { ScanTimeline } from "@/components/ScanTimeline";
import { PageSkeleton } from "@/components/LoadingSkeleton";

export function ScanProgressPage() {
  const { scanId } = useParams();
  const { data: scan, isLoading, error } = useScan(scanId);

  if (isLoading) return <PageSkeleton />;
  if (error || !scan) return <div className="panel p-6 text-severity-critical">Failed to load scan.</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Live scan</h1>
        <p className="mt-1 text-sm text-slate-400">
          Passive discovery in progress for scan <span className="mono text-slate-300">{scan.id}</span>
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="panel p-5 md:col-span-2">
          <div className="text-sm text-slate-400">Status</div>
          <div className="mt-2 text-xl font-semibold capitalize text-slate-100">{scan.status}</div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full bg-accent transition-all"
              style={{ width: scan.status === "completed" ? "100%" : `${Math.min(90, scan.events.length * 15)}%` }}
            />
          </div>
          <p className="mt-3 text-xs text-slate-500">
            This view polls every 2 seconds until the scan completes.
          </p>
        </div>
        <div className="panel p-5">
          <div className="text-sm text-slate-400">Events</div>
          <div className="mt-2 text-3xl font-semibold">{scan.events.length}</div>
          <div className="mt-2 text-xs text-slate-500">CT logs, DNS, HTTP/TLS metadata collection.</div>
        </div>
      </div>
      <ScanTimeline events={scan.events} status={scan.status} />
    </div>
  );
}
