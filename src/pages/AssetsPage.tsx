import { useMemo } from "react";
import { useAssets } from "@/hooks/useAssets";
import { useFindings } from "@/hooks/useFindings";
import { DEMO_SCAN_ID } from "@/lib/constants";
import { DataTable, type Column } from "@/components/DataTable";
import { EnvironmentTag } from "@/components/EnvironmentTag";
import { SeverityBadge } from "@/components/SeverityBadge";
import { PageSkeleton } from "@/components/LoadingSkeleton";
import type { Asset, Severity } from "@/lib/types";
import { severityOrder } from "@/lib/severity";

export function AssetsPage() {
  const assets = useAssets(DEMO_SCAN_ID);
  const findings = useFindings(DEMO_SCAN_ID);

  const rows = useMemo(() => {
    const list = assets.data || [];
    const f = findings.data || [];
    return list.map((a) => {
      const af = f.filter((x) => x.asset_id === a.id);
      const top = [...af].sort((x, y) => severityOrder.indexOf(x.severity) - severityOrder.indexOf(y.severity))[0]?.severity as Severity | undefined;
      return { ...a, findingCount: af.length, topSeverity: top };
    });
  }, [assets.data, findings.data]);

  if (assets.isLoading || findings.isLoading) return <PageSkeleton />;

  const columns: Column<(Asset & { findingCount: number; topSeverity?: Severity })>[] = [
    { key: "hostname", header: "Hostname", render: (r) => <span className="mono text-cyan-100">{r.hostname}</span> },
    { key: "env", header: "Environment", render: (r) => <EnvironmentTag env={r.environment} /> },
    { key: "ips", header: "IP addresses", render: (r) => <span className="mono text-xs text-slate-300">{r.ip_addresses.join(", ")}</span> },
    { key: "tech", header: "Technology", render: (r) => <span className="text-slate-300">{r.technology}</span> },
    { key: "https", header: "HTTPS", render: (r) => <span>{r.https ? "Yes" : "No"}</span> },
    { key: "findings", header: "Findings", render: (r) => <span>{r.findingCount}</span> },
    { key: "severity", header: "Top severity", render: (r) => r.topSeverity ? <SeverityBadge severity={r.topSeverity} /> : <span className="text-slate-500">—</span> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Assets</h1>
        <p className="mt-1 text-sm text-slate-400">Discovered externally exposed hosts and their risk posture.</p>
      </div>
      <div className="panel p-4">
        <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />
      </div>
    </div>
  );
}
