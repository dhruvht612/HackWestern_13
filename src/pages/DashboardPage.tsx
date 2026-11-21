import { useParams } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { ShieldAlert, Server, Bug, Package } from "lucide-react";
import { useAssets } from "@/hooks/useAssets";
import { useFindings } from "@/hooks/useFindings";
import { useDependencies } from "@/hooks/useDependencies";
import { useAnalysis } from "@/hooks/useAnalysis";
import { StatTile } from "@/components/StatTile";
import { SeverityBadge } from "@/components/SeverityBadge";
import { PageSkeleton } from "@/components/LoadingSkeleton";
import { DEMO_SCAN_ID } from "@/lib/constants";
import { severityColors, severityOrder } from "@/lib/severity";
import type { Severity } from "@/lib/types";
import { useEffect } from "react";

export function DashboardPage() {
  const { id: projectId } = useParams();
  const scanId = DEMO_SCAN_ID;
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
  if (assets.error || findings.error) return <div className="panel p-6 text-severity-critical">Failed to load dashboard data.</div>;

  const assetList = assets.data || [];
  const findingList = findings.data || [];
  const depList = deps.data || [];

  const severityCounts = severityOrder.map((sev) => ({
    name: sev,
    value: findingList.filter((f) => f.severity === sev).length,
  }));
  const riskByAsset = assetList
    .map((a) => {
      const fs = findingList.filter((f) => f.asset_id === a.id);
      const weight: Record<Severity, number> = { critical: 5, high: 4, medium: 3, low: 2, info: 1 };
      const score = fs.reduce((sum, f) => sum + weight[f.severity], 0);
      return { name: a.hostname.replace(".acme-demo.com", ""), score };
    })
    .filter((a) => a.score > 0);

  const topPriorities = [...findingList]
    .sort((a, b) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity))
    .slice(0, 3);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-400">External exposure summary for the latest scan.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Assets" value={assetList.length} hint="Discovered hosts" icon={<Server size={18} />} />
        <StatTile label="Findings" value={findingList.length} hint="Rules + dependency advisories" icon={<Bug size={18} />} />
        <StatTile label="Critical/High" value={findingList.filter((f) => f.severity === "critical" || f.severity === "high").length} hint="Prioritize first" icon={<ShieldAlert size={18} />} />
        <StatTile label="Dependencies" value={depList.length} hint="Scanned packages" icon={<Package size={18} />} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="panel p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-200">Findings by severity</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={severityCounts} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={3}>
                  {severityCounts.map((entry) => (
                    <Cell key={entry.name} fill={severityColors[entry.name as Severity]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "#121821", border: "1px solid #1F2A37", borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-3 text-xs text-slate-300">
            {severityCounts.map((s) => (
              <span key={s.name} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: severityColors[s.name as Severity] }} />
                {s.name} ({s.value})
              </span>
            ))}
          </div>
        </div>

        <div className="panel p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-200">Risk by asset</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riskByAsset}>
                <XAxis dataKey="name" stroke="#64748B" fontSize={12} />
                <YAxis stroke="#64748B" fontSize={12} />
                <Tooltip contentStyle={{ background: "#121821", border: "1px solid #1F2A37", borderRadius: 8 }} />
                <Bar dataKey="score" fill="#22D3EE" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <div className="panel p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-200">Top 3 priorities</h2>
          <div className="space-y-3">
            {topPriorities.map((f) => (
              <div key={f.id} className="rounded-lg border border-border bg-background/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium text-slate-100">{f.title}</div>
                  <SeverityBadge severity={f.severity} />
                </div>
                <p className="mt-2 text-sm text-slate-400">{f.remediation}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="panel p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-200">AI executive summary</h2>
          {analysisMutation.data ? (
            <p className="text-sm leading-relaxed text-slate-300">{analysisMutation.data.executive_summary}</p>
          ) : (
            <p className="text-sm text-slate-400">
              {analysisMutation.isPending ? "Generating analysis..." : "Analysis unavailable."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
