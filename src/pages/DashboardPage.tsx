import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useAssets } from "@/hooks/useAssets";
import { useFindings } from "@/hooks/useFindings";
import { useDependencies } from "@/hooks/useDependencies";
import { useAnalysis } from "@/hooks/useAnalysis";
import { useProject } from "@/hooks/useProject";
import { useScan } from "@/hooks/useScan";
import { SeverityBadge } from "@/components/SeverityBadge";
import { PageSkeleton } from "@/components/LoadingSkeleton";
import { PageHeader } from "@/components/PageHeader";
import { Stamp } from "@/components/Stamp";
import { DEMO_SCAN_ID } from "@/lib/constants";
import { bySeverity, severityColors, severityOrder, severityWeight } from "@/lib/severity";
import { cn } from "@/lib/utils";

export function DashboardPage() {
  const { id: projectId } = useParams();
  const scanId = DEMO_SCAN_ID;
  const project = useProject(projectId);
  const scan = useScan(scanId);
  const assets = useAssets(scanId);
  const findings = useFindings(scanId);
  const deps = useDependencies(projectId);
  const analysisMutation = useAnalysis(scanId);

  useEffect(() => {
    if (!analysisMutation.data && !analysisMutation.isPending && !analysisMutation.error) {
      analysisMutation.mutate();
    }
  }, [analysisMutation]);

  if (assets.isLoading || findings.isLoading || deps.isLoading) return <PageSkeleton />;
  if (assets.error || findings.error)
    return (
      <div className="border-2 border-severity-critical p-6 text-sm">
        <div className="font-semibold">Couldn’t load the dashboard.</div>
        <p className="mt-1 text-ink-soft">Check that the API is running, or switch to mock mode with VITE_USE_MOCKS=true.</p>
      </div>
    );

  const assetList = assets.data || [];
  const findingList = findings.data || [];
  const depList = deps.data || [];
  const count = (sev: string) => findingList.filter((f) => f.severity === sev).length;

  const severityCounts = severityOrder.map((sev) => ({ sev, count: count(sev) }));
  const maxSev = Math.max(1, ...severityCounts.map((s) => s.count));

  const riskByAsset = assetList
    .map((a) => ({
      host: a.hostname,
      score: findingList.filter((f) => f.asset_id === a.id).reduce((sum, f) => sum + severityWeight[f.severity], 0),
    }))
    .filter((a) => a.score > 0)
    .sort((a, b) => b.score - a.score);
  const maxRisk = Math.max(1, ...riskByAsset.map((r) => r.score));

  const topPriorities = [...findingList].sort(bySeverity).slice(0, 3);
  const hostOf = (assetId: string) => assetList.find((a) => a.id === assetId)?.hostname ?? assetId;
  const memoFor = (findingId: string) => analysisMutation.data?.findings.find((f) => f.finding_id === findingId);

  const ledger: [string, string][] = [
    ["SUBJECT", project.data?.root_domain ?? "—"],
    [
      "SCAN",
      scan.data
        ? `${scanId.slice(0, 8)} · ${scan.data.status}${scan.data.completed_at ? ` ${scan.data.completed_at.slice(0, 16).replace("T", " ")}Z` : ""}`
        : scanId.slice(0, 8),
    ],
    ["SOURCES", "CT logs · DNS · HTTP/TLS metadata · OSV"],
    [
      "ON FILE",
      `${assetList.length} hosts · ${findingList.length} findings (${count("critical")} critical, ${count("high")} high) · ${depList.length} dependencies`,
    ],
  ];

  return (
    <div className="space-y-9">
      <PageHeader title="Dashboard" description="What the latest scan put on file, and what to fix first." />

      <dl className="mono grid grid-cols-[6rem_minmax(0,1fr)] border-b border-ink/25 text-[13.5px] sm:grid-cols-[7.5rem_minmax(0,1fr)]">
        {ledger.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="border-t border-ink/15 py-2 text-ink-soft first-of-type:border-t-0">{k}</dt>
            <dd className="tabular border-t border-ink/15 py-2 text-ink">
              {/* dates and hostnames must not break at their hyphens */}
              {v.split(/(\s+)/).map((t, i) => (t.includes("-") ? <span key={i} className="whitespace-nowrap">{t}</span> : t))}
            </dd>
          </div>
        ))}
      </dl>

      <section>
        <div className="flex items-baseline justify-between border-b-2 border-ink pb-2">
          <h2 className="display text-2xl font-extrabold">Fix first</h2>
          <Link to={`/projects/${projectId}/findings`} className="inline-flex items-center gap-1 text-[13px] font-semibold underline underline-offset-4 hover:text-carbon">
            All findings <ArrowRight size={13} aria-hidden="true" />
          </Link>
        </div>
        <ol className="divide-y divide-ink/15">
          {topPriorities.map((f, i) => {
            const lead = i === 0;
            const priority = memoFor(f.id)?.suggested_priority;
            return (
              <li key={f.id} className="relative grid grid-cols-[2rem_minmax(0,1fr)] gap-3 py-5 sm:pr-48">
                <span className={cn("tabular font-mono text-lg font-bold", lead ? "text-ink" : "text-ink-faint")}>{i + 1}.</span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <SeverityBadge severity={f.severity} />
                    {priority && !(lead && priority === "P0") ? (
                      <span className="border-[1.5px] border-ink px-1.5 font-mono text-[11px] font-bold">{priority}</span>
                    ) : null}
                    <span className="mono text-[13px] text-ink-soft">{hostOf(f.asset_id)}</span>
                  </div>
                  <div className={cn("mt-1.5", lead ? "text-lg font-bold" : "font-semibold")}>{f.title}</div>
                  <p className={cn("mt-1 text-sm", lead ? "text-ink" : "text-ink-faint")}>{f.remediation}</p>
                  {lead && priority === "P0" ? (
                    <Stamp lines={["P0", "Fix first"]} tone="red" rotate={-6} className="mt-3 w-32 sm:absolute sm:right-2 sm:top-5 sm:mt-0 sm:w-40" />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <div className="grid gap-9 xl:grid-cols-2">
        <section>
          <h2 className="field-label border-b border-ink/25 pb-2 !text-ink">Findings by severity</h2>
          <ul className="mt-3 space-y-2.5">
            {severityCounts.map(({ sev, count }) => (
              <li key={sev} className="grid grid-cols-[6rem_minmax(0,1fr)_2rem] items-center gap-3">
                <SeverityBadge severity={sev} className="justify-self-start" />
                <span className="h-3 border-y border-ink/10">
                  <span className="block h-full" style={{ width: `${(count / maxSev) * 100}%`, background: severityColors[sev] }} />
                </span>
                <span className="tabular text-right font-mono text-sm font-bold">{count}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="field-label border-b border-ink/25 pb-2 !text-ink">Exposure by host (weighted)</h2>
          <ul className="mt-3 space-y-2.5">
            {riskByAsset.map((r, i) => (
              <li key={r.host} className="grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)_2rem] items-center gap-3">
                <span className={cn("mono truncate text-[13px]", i === 0 ? "text-ink" : "text-ink-soft")} title={r.host}>
                  {r.host}
                </span>
                <span className="h-3 border-y border-ink/10">
                  <span className={cn("block h-full", i === 0 ? "bg-ink" : "bg-ink/40")} style={{ width: `${(r.score / maxRisk) * 100}%` }} />
                </span>
                <span className="tabular text-right font-mono text-sm font-bold">{r.score}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-soft">Critical 5 · high 4 · medium 3 · low 2 · info 1, summed per host.</p>
        </section>
      </div>

      <section className="border border-ink/25">
        <dl className="mono grid grid-cols-[4.5rem_minmax(0,1fr)] gap-y-1 border-b-2 border-ink px-5 py-4 text-[13px] sm:px-7">
          <dt className="text-ink-soft">TO:</dt>
          <dd>Engineering, {project.data?.root_domain ?? "this project"}</dd>
          <dt className="text-ink-soft">FROM:</dt>
          <dd>AttackSurface analyst (Gemini)</dd>
          <dt className="text-ink-soft">RE:</dt>
          <dd className="font-bold">Overall exposure</dd>
        </dl>
        <div className="px-5 py-5 sm:px-7">
          {analysisMutation.data ? (
            <p className="max-w-[72ch] text-[15px] leading-relaxed">{analysisMutation.data.executive_summary}</p>
          ) : analysisMutation.isPending ? (
            <div className="space-y-2" aria-busy="true">
              {[100, 92, 96, 60].map((w) => (
                <div key={w} className="h-3.5 animate-pulse bg-ink/10" style={{ width: `${w}%` }} />
              ))}
              <p className="pt-1 text-xs text-ink-soft">Writing the memo…</p>
            </div>
          ) : (
            <p className="text-sm text-ink-soft">The analyst memo isn’t available right now. The findings above are unaffected.</p>
          )}
        </div>
      </section>
    </div>
  );
}
