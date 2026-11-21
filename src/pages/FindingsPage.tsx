import { useEffect, useMemo, useState } from "react";
import { useFindings } from "@/hooks/useFindings";
import { useAssets } from "@/hooks/useAssets";
import { useAnalysis } from "@/hooks/useAnalysis";
import { DEMO_SCAN_ID } from "@/lib/constants";
import { SeverityBadge } from "@/components/SeverityBadge";
import { EvidenceBlock } from "@/components/EvidenceBlock";
import { AIAnalystCard } from "@/components/AIAnalystCard";
import { DetailPanel } from "@/components/DetailPanel";
import { PageSkeleton } from "@/components/LoadingSkeleton";
import type { Finding, Severity } from "@/lib/types";
import { severityOrder } from "@/lib/severity";

export function FindingsPage() {
  const findings = useFindings(DEMO_SCAN_ID);
  const assets = useAssets(DEMO_SCAN_ID);
  const analysisMutation = useAnalysis(DEMO_SCAN_ID);
  const [severity, setSeverity] = useState<Severity | "all">("all");
  const [selected, setSelected] = useState<Finding | null>(null);

  useEffect(() => {
    if (!analysisMutation.data && !analysisMutation.isPending && !analysisMutation.error) {
      analysisMutation.mutate();
    }
  }, [analysisMutation]);

  const assetMap = useMemo(() => new Map((assets.data || []).map((a) => [a.id, a])), [assets.data]);
  const filtered = useMemo(() => {
    const list = findings.data || [];
    return list
      .filter((f) => severity === "all" || f.severity === severity)
      .sort((a, b) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity));
  }, [findings.data, severity]);

  if (findings.isLoading || assets.isLoading) return <PageSkeleton />;

  const selectedAnalysis = analysisMutation.data?.findings.find((f) => f.finding_id === selected?.id) || null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Findings</h1>
          <p className="mt-1 text-sm text-slate-400">Filter findings and inspect evidence with AI analyst context.</p>
        </div>
        <select
          className="rounded-lg border border-border bg-panel px-3 py-2 text-sm"
          value={severity}
          onChange={(e) => setSeverity(e.target.value as Severity | "all")}
        >
          <option value="all">All severities</option>
          {severityOrder.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <div className="space-y-3">
          {filtered.map((f) => {
            const asset = assetMap.get(f.asset_id);
            const active = selected?.id === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setSelected(f)}
                className={`panel w-full p-4 text-left transition ${active ? "border-accent/50 bg-accent/5" : "hover:bg-white/[0.02]"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-slate-100">{f.title}</div>
                    <div className="mono mt-1 text-xs text-slate-400">{asset?.hostname || f.asset_id}</div>
                  </div>
                  <SeverityBadge severity={f.severity} />
                </div>
                <p className="mt-2 text-sm text-slate-400">{f.remediation}</p>
              </button>
            );
          })}
        </div>

        <DetailPanel title="Finding detail" open={Boolean(selected)} onClose={() => setSelected(null)}>
          {selected ? (
            <div className="space-y-4">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <SeverityBadge severity={selected.severity} />
                  <span className="text-xs uppercase tracking-wide text-slate-500">{selected.source}</span>
                </div>
                <h4 className="font-medium text-slate-100">{selected.title}</h4>
                <p className="mono mt-1 text-xs text-slate-400">{assetMap.get(selected.asset_id)?.hostname}</p>
              </div>
              <div>
                <div className="mb-2 text-sm text-slate-400">Evidence</div>
                <EvidenceBlock evidence={selected.evidence} />
              </div>
              <div>
                <div className="mb-2 text-sm text-slate-400">Remediation</div>
                <p className="text-sm text-slate-200">{selected.remediation}</p>
              </div>
              <AIAnalystCard analysis={selectedAnalysis} />
            </div>
          ) : null}
        </DetailPanel>
      </div>
    </div>
  );
}
