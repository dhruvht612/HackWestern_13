import { useMemo, useState } from "react";
import { useAssets, useEvidence, useFindings } from "@/hooks/useScanData";
import { useAnalysis } from "@/hooks/useAnalysis";
import { ScanGate } from "@/components/ScanGate";
import { SeverityBadge } from "@/components/SeverityBadge";
import { EvidenceBlock } from "@/components/EvidenceBlock";
import { AIAnalystCard } from "@/components/AIAnalystCard";
import { DetailPanel } from "@/components/DetailPanel";
import { PageSkeleton } from "@/components/LoadingSkeleton";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import type { Finding, Severity } from "@/lib/types";
import { bySeverity, severityLabels, severityOrder } from "@/lib/severity";
import { cn } from "@/lib/utils";

export function FindingsPage() {
  return <ScanGate>{(scanId) => <FindingsView scanId={scanId} />}</ScanGate>;
}

/** Raw records a finding was derived from, so every claim can be checked. */
function EvidenceRecords({ scanId, ids }: { scanId: string; ids: string[] }) {
  const evidence = useEvidence(scanId, ids.length > 0);
  if (!ids.length) return null;
  const rows = (evidence.data || []).filter((e) => ids.includes(e.id));
  return (
    <details className="mt-2 border border-silver/25 p-3 text-[13px]">
      <summary className="cursor-pointer font-semibold hover:text-lime">Evidence records ({ids.length})</summary>
      {evidence.isLoading ? <p className="mt-2 text-fg-soft">Loading…</p> : null}
      {rows.map((e) => (
        <div key={e.id} className="mt-3">
          <div className="mono text-silver">{e.kind.toUpperCase()} · {e.source} · {new Date(e.collected_at).toISOString().slice(0, 19)}Z</div>
          <pre className="mono mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-words text-[12px] text-fg-soft">{JSON.stringify(e.data, null, 2)}</pre>
        </div>
      ))}
    </details>
  );
}

function FindingsView({ scanId }: { scanId: string }) {
  const findings = useFindings(scanId);
  const assets = useAssets(scanId);
  const analysis = useAnalysis(scanId);
  const [severity, setSeverity] = useState<Severity | "all">("all");
  const [selected, setSelected] = useState<Finding | null>(null);


  const assetMap = useMemo(() => new Map((assets.data || []).map((a) => [a.id, a])), [assets.data]);
  const all = useMemo(() => findings.data || [], [findings.data]);
  const filtered = useMemo(
    () => all.filter((f) => severity === "all" || f.severity === severity).sort(bySeverity),
    [all, severity],
  );

  if (findings.isLoading || assets.isLoading) return <PageSkeleton />;

  const selectedAnalysis = analysis.data?.findings.find((f) => f.finding_id === selected?.id) || null;
  const filters: (Severity | "all")[] = ["all", ...severityOrder];

  return (
    <div className="space-y-6">
      <PageHeader title="Findings" description="Every finding from the latest scan, worst first. Select one to read its evidence and the analyst’s memo." />

      <div role="group" aria-label="Filter by severity" className="flex flex-wrap gap-1.5">
        {filters.map((s) => {
          const count = s === "all" ? all.length : all.filter((f) => f.severity === s).length;
          const active = severity === s;
          return (
            <button
              key={s}
              type="button"
              aria-pressed={active}
              onClick={() => setSeverity(s)}
              disabled={count === 0}
              className={cn(
                "border-[1.5px] px-3 py-1.5 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                active ? "border-lime bg-lime text-ink" : "border-silver/35 text-fg hover:border-silver",
              )}
            >
              {s === "all" ? "All" : severityLabels[s]} <span className="tabular ml-1 font-mono">{count}</span>
            </button>
          );
        })}
      </div>

      <div className={cn("grid gap-6", selected && "xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]")}>
        {filtered.length ? (
          <ul className="border-y border-silver/25">
            {filtered.map((f) => {
              const active = selected?.id === f.id;
              const urgent = f.severity === "critical";
              return (
                <li key={f.id} className={cn("border-t first:border-t-0", active ? "border-lime" : "border-silver/15", active && "[&+li]:border-lime")}>
                  <button
                    onClick={() => setSelected(f)}
                    aria-current={active || undefined}
                    className={cn(
                      "grid w-full grid-cols-[6rem_minmax(0,1fr)] gap-x-4 px-3 py-4 text-left transition-colors",
                      !active && "hover:bg-silver/10",
                    )}
                  >
                    <SeverityBadge severity={f.severity} className="h-fit justify-self-start" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <span className={active || urgent ? "font-bold" : "font-semibold"}>{f.title}</span>
                        <span className="mono text-[13px] text-fg-soft">{assetMap.get(f.asset_id ?? "")?.hostname || f.asset_id}</span>
                      </div>
                      <p className={cn("mt-1 text-sm", active || urgent ? "text-fg" : "text-fg-faint")}>{f.remediation}</p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState title="Nothing at this severity" description="No findings match this filter. Choose All to see every finding from the scan." />
        )}

        <DetailPanel title={selected?.title ?? ""} open={Boolean(selected)} onClose={() => setSelected(null)}>
          {selected ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <SeverityBadge severity={selected.severity} />
                <span className="mono text-[13px] text-fg-soft">
                  {assetMap.get(selected.asset_id ?? "")?.hostname} · {selected.source === "osv" ? "OSV advisory" : "rule"}
                </span>
              </div>
              <div>
                <div className="field-label mb-2">Evidence</div>
                <EvidenceBlock evidence={selected.evidence} />
                <EvidenceRecords scanId={scanId} ids={selected.evidence_ids ?? []} />
              </div>
              <div>
                <div className="field-label mb-1">Remediation</div>
                <p className="text-sm leading-relaxed">{selected.remediation}</p>
              </div>
              <div>
                <div className="field-label mb-2">Analyst memo</div>
                <AIAnalystCard analysis={selectedAnalysis} />
              </div>
            </div>
          ) : null}
        </DetailPanel>
      </div>
    </div>
  );
}
