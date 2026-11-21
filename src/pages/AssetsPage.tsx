import { useMemo } from "react";
import { useAssets } from "@/hooks/useAssets";
import { useFindings } from "@/hooks/useFindings";
import { DEMO_SCAN_ID } from "@/lib/constants";
import { DataTable, type Column } from "@/components/DataTable";
import { EnvironmentTag } from "@/components/EnvironmentTag";
import { SeverityBadge } from "@/components/SeverityBadge";
import { PageSkeleton } from "@/components/LoadingSkeleton";
import { PageHeader } from "@/components/PageHeader";
import type { Asset, Severity } from "@/lib/types";
import { bySeverity } from "@/lib/severity";

type Row = Asset & { findingCount: number; topSeverity?: Severity };

export function AssetsPage() {
  const assets = useAssets(DEMO_SCAN_ID);
  const findings = useFindings(DEMO_SCAN_ID);

  const rows = useMemo<Row[]>(() => {
    const f = findings.data || [];
    return (assets.data || []).map((a) => {
      const af = f.filter((x) => x.asset_id === a.id);
      return { ...a, findingCount: af.length, topSeverity: [...af].sort(bySeverity)[0]?.severity };
    });
  }, [assets.data, findings.data]);

  if (assets.isLoading || findings.isLoading) return <PageSkeleton />;

  const columns: Column<Row>[] = [
    { key: "hostname", header: "Hostname", render: (r) => <span className="mono font-bold">{r.hostname}</span> },
    { key: "env", header: "Environment", render: (r) => <EnvironmentTag env={r.environment} /> },
    { key: "ips", header: "IP addresses", render: (r) => <span className="mono text-[13px] text-ink-soft">{r.ip_addresses.join(", ")}</span> },
    { key: "tech", header: "Technology", render: (r) => <span className="text-ink-soft">{r.technology}</span> },
    {
      key: "https",
      header: "HTTPS",
      render: (r) => (r.https ? <span>Yes</span> : <span className="font-semibold text-severity-high">No</span>),
    },
    { key: "findings", header: "Findings", className: "text-right", render: (r) => <span className="font-mono font-bold">{r.findingCount}</span> },
    {
      key: "severity",
      header: "Worst",
      render: (r) => (r.topSeverity ? <SeverityBadge severity={r.topSeverity} /> : <span className="text-ink-faint">None</span>),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Assets" description="Hosts reachable from the internet, found through CT logs and DNS, with their worst finding." />
      <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />
    </div>
  );
}
