import { Link, useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SCAN_DONE, useScan } from "@/hooks/useScan";
import { ScanTimeline } from "@/components/ScanTimeline";
import { PageSkeleton } from "@/components/LoadingSkeleton";
import { PageHeader } from "@/components/PageHeader";
import { StartScanButton } from "@/components/ScanGate";
import { api } from "@/lib/api";

// Progress = pipeline stages the worker has actually reported, never a guess.
const STAGES = ["Certificate Transparency", "DNS:", "HTTP/TLS metadata", "Dependency intel"];

const OUTCOME: Record<string, { label: string; tone: string; text: string }> = {
  completed: { label: "Completed", tone: "border-camel", text: "Collection finished. Findings, the graph, and the report are ready." },
  partial: { label: "Partial", tone: "border-severity-medium", text: "Finished, but at least one data source failed. Results may be incomplete; see the warnings in the log." },
  failed: { label: "Failed", tone: "border-severity-critical", text: "The scan stopped with an error. Nothing here counts as a clean result." },
  cancelled: { label: "Cancelled", tone: "border-severity-medium", text: "Stopped before finishing. It does not count as a completed assessment." },
};

export function ScanProgressPage() {
  const { id: projectId = "", scanId } = useParams();
  const qc = useQueryClient();
  const { data: scan, isLoading, error } = useScan(scanId);
  const cancel = useMutation({
    mutationFn: () => api.cancelScan(scanId!),
    onSuccess: (s) => qc.setQueryData(["scan", scanId], s),
  });

  if (isLoading) return <PageSkeleton />;
  if (error || !scan)
    return (
      <div className="border-2 border-severity-critical p-6 text-sm">
        <div className="font-semibold">Couldn’t load this scan.</div>
        <p className="mt-1 text-fg-soft">{error ? (error as Error).message : "It may have been removed."}</p>
      </div>
    );

  const done = SCAN_DONE.has(scan.status);
  const reached = STAGES.filter((s) => scan.events.some((e) => e.message.includes(s))).length;
  const pct = done ? 100 : Math.round((reached / (STAGES.length + 1)) * 100);
  const outcome = OUTCOME[scan.status];

  return (
    <div className="space-y-7">
      <PageHeader
        title={done ? "Scan record" : "Live scan"}
        description={`Scan ${scan.id.slice(0, 8)}: certificate logs, DNS, then HTTP/TLS metadata on in-scope public hosts, then dependency correlation.`}
        actions={
          !done ? (
            <button onClick={() => cancel.mutate()} disabled={cancel.isPending} className="btn-secondary py-2">
              {cancel.isPending ? "Cancelling…" : "Cancel scan"}
            </button>
          ) : undefined
        }
      />
      <div>
        <div className="mono flex flex-wrap items-baseline justify-between gap-2 text-[13.5px]">
          <span>
            <span className="text-camel">STATUS </span>
            <span className="font-bold uppercase">{scan.status}</span>
          </span>
          <span className="tabular text-fg-soft">{done ? `${scan.events.length} log entries` : `${reached} of ${STAGES.length} stages reported`}</span>
        </div>
        <div className="mt-2 h-3 border border-camel/40" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Scan progress">
          <div className={`h-full transition-[width] duration-500 ease-out ${done ? "bg-camel" : "bg-kiwi"}`} style={{ width: `${pct}%` }} />
        </div>
        {!done ? <p className="mt-2 text-xs text-fg-soft">This view refreshes every 2 seconds.</p> : null}
      </div>

      {outcome ? (
        <div className={`border-2 ${outcome.tone} p-4`}>
          <div className="font-semibold">{outcome.label}</div>
          <p className="mt-1 text-sm text-fg-soft">
            {outcome.text}
            {scan.error ? ` (${scan.error})` : ""}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {scan.status === "completed" || scan.status === "partial" ? (
              <Link to={`/projects/${projectId}`} className="btn-primary py-2">
                View results
              </Link>
            ) : null}
            {scan.status !== "completed" ? <StartScanButton projectId={projectId} label="Start a new scan" className="btn-secondary py-2" /> : null}
          </div>
        </div>
      ) : null}
      {cancel.error ? (
        <p role="alert" className="text-sm text-severity-critical">
          {(cancel.error as Error).message}
        </p>
      ) : null}
      <ScanTimeline events={scan.events} status={scan.status} />
    </div>
  );
}
