import { useMemo } from "react";
import { useAssets, useFindings } from "@/hooks/useScanData";
import { ScanGate } from "@/components/ScanGate";
import { DataTable, type Column } from "@/components/DataTable";
import { EnvironmentTag } from "@/components/EnvironmentTag";
import { SeverityBadge } from "@/components/SeverityBadge";
import { PageSkeleton } from "@/components/LoadingSkeleton";
import { PageHeader } from "@/components/PageHeader";
import type { Asset, Severity } from "@/lib/types";
import { bySeverity } from "@/lib/severity";

type Row = Asset & { findingCount: number; topSeverity?: Severity };

export function AssetsPage() {
  return <ScanGate>{(scanId) => <AssetsView scanId={scanId} />}</ScanGate>;
}

function AssetsView({ scanId }: { scanId: string }) {
  const assets = useAssets(scanId);
  const findings = useFindings(scanId);

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
    { key: "ips", header: "IP addresses", render: (r) => <span className="mono text-[13px] text-fg-soft">{r.ip_addresses.join(", ")}</span> },
    { key: "tech", header: "Technology", render: (r) => <span className="text-fg-soft">{r.technology}</span> },
    {
      key: "https",
      header: "HTTPS",
      render: (r) => (r.https ? <span>Yes</span> : <span className="font-semibold text-severity-high">No</span>),
    },
    { key: "findings", header: "Findings", className: "text-right", render: (r) => <span className="font-mono font-bold">{r.findingCount}</span> },
    {
      key: "severity",
      header: "Worst",
      render: (r) => (r.topSeverity ? <SeverityBadge severity={r.topSeverity} /> : <span className="text-fg-faint">None</span>),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Assets" description="Hosts reachable from the internet, found through CT logs and DNS, with their worst finding." />
      <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />
    </div>
  );
}
