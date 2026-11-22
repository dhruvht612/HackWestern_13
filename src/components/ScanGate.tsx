import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Play } from "lucide-react";
import { useCreateScan } from "@/hooks/useCreateScan";
import { useScan } from "@/hooks/useScan";
import { useCurrentScan } from "@/hooks/useScanData";
import { EmptyState } from "./EmptyState";
import { PageSkeleton } from "./LoadingSkeleton";
import { VerificationPanel } from "./VerificationPanel";

export function StartScanButton({ projectId, label = "Start a scan", className = "btn-primary" }: { projectId: string; label?: string; className?: string }) {
  const navigate = useNavigate();
  const create = useCreateScan(projectId);
  return (
    <span className="inline-flex flex-col items-start gap-2">
      <button
        onClick={async () => {
          const res = await create.mutateAsync().catch(() => null);
          if (res) navigate(`/projects/${projectId}/scans/${res.scan_id}`);
        }}
        disabled={create.isPending}
        className={className}
      >
        <Play size={15} aria-hidden="true" /> {create.isPending ? "Starting…" : label}
      </button>
      {create.error ? (
        <span role="alert" className="text-[13px] text-severity-critical">
          {(create.error as Error).message}
        </span>
      ) : null}
    </span>
  );
}

/**
 * Every project page needs a finished scan. This resolves the project's latest one and renders the
 * right state instead (unverified, no scans, running, failed) so no page ever shows a blank "all clear".
 */
export function ScanGate({ children }: { children: (scanId: string) => ReactNode }) {
  const { projectId, project, scanId } = useCurrentScan();
  const scan = useScan(scanId);

  if (project.isLoading || (scanId && scan.isLoading)) return <PageSkeleton />;
  if (project.error || !project.data) {
    return <EmptyState title="File not found" description="This project doesn't exist, or it belongs to another account." action={<Link className="btn-secondary" to="/projects">All projects</Link>} />;
  }
  const p = project.data;
  if (!scanId) {
    return p.verification_status !== "verified" ? (
      <VerificationPanel project={p} />
    ) : (
      <EmptyState title="No scans yet" description={`Domain control is verified. Start a scan to discover what ${p.root_domain} exposes.`} action={<StartScanButton projectId={projectId} />} />
    );
  }
  const status = scan.data?.status;
  if (status === "queued" || status === "running") {
    return (
      <EmptyState
        title={status === "queued" ? "Scan queued" : "Scan in progress"}
        description="Results appear here when collection finishes. Follow it live in the collection log."
        action={<Link className="btn-primary" to={`/projects/${projectId}/scans/${scanId}`}>Open the collection log</Link>}
      />
    );
  }
  if (status === "failed" || status === "cancelled") {
    return (
      <EmptyState
        title={status === "failed" ? "The last scan failed" : "The last scan was cancelled"}
        description={scan.data?.error ? `${scan.data.error}. No results were recorded.` : "No results were recorded."}
        action={p.verification_status === "verified" ? <StartScanButton projectId={projectId} label="Start a new scan" /> : <VerificationPanel project={p} />}
      />
    );
  }
  return (
    <>
      {status === "partial" ? (
        <p role="status" className="mb-6 border-2 border-severity-medium p-3 text-sm">
          This scan is <strong>partial</strong>: at least one data source failed, so the results below may be incomplete.{" "}
          <Link className="underline underline-offset-4 hover:text-kiwi" to={`/projects/${projectId}/scans/${scanId}`}>See the log</Link>.
        </p>
      ) : null}
      {children(scanId)}
    </>
  );
}
