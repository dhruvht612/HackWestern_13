import { useParams } from "react-router-dom";
import { useScan } from "@/hooks/useScan";
import { ScanTimeline } from "@/components/ScanTimeline";
import { PageSkeleton } from "@/components/LoadingSkeleton";
import { PageHeader } from "@/components/PageHeader";

export function ScanProgressPage() {
  const { scanId } = useParams();
  const { data: scan, isLoading, error } = useScan(scanId);

  if (isLoading) return <PageSkeleton />;
  if (error || !scan)
    return (
      <div className="border-2 border-severity-critical p-6 text-sm">
        <div className="font-semibold">Couldn’t load this scan.</div>
        <p className="mt-1 text-fg-soft">It may have been removed. Start a new scan from the header.</p>
      </div>
    );

  const done = scan.status === "completed";
  const pct = done ? 100 : Math.min(90, scan.events.length * 15);

  return (
    <div className="space-y-7">
      <PageHeader
        title="Live scan"
        description={`Passive collection for scan ${scan.id.slice(0, 8)}: certificate logs, DNS, then HTTP and TLS metadata.`}
      />
      <div>
        <div className="mono flex flex-wrap items-baseline justify-between gap-2 text-[13.5px]">
          <span>
            <span className="text-fg-soft">STATUS </span>
            <span className="font-bold uppercase">{scan.status}</span>
          </span>
          <span className="tabular text-fg-soft">{scan.events.length} log entries</span>
        </div>
        <div
          className="mt-2 h-3 border border-camel/40"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Scan progress"
        >
          <div className={`h-full transition-[width] duration-500 ease-out ${done ? "bg-camel" : "bg-kiwi"}`} style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-xs text-fg-soft">{done ? "Collection finished." : "This view refreshes every 2 seconds until the scan completes."}</p>
      </div>
      <ScanTimeline events={scan.events} status={scan.status} />
    </div>
  );
}
