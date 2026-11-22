import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Play } from "lucide-react";
import { useCreateScan } from "@/hooks/useCreateScan";
import { useProject } from "@/hooks/useProject";
import { useScan } from "@/hooks/useScan";
import { useCurrentScan } from "@/hooks/useScanData";
import { EmptyState } from "./EmptyState";
import { PageSkeleton } from "./LoadingSkeleton";
import { VerificationPanel } from "./VerificationPanel";
import type { Project } from "@/lib/types";

function scanAuthorized(project: Project | undefined) {
  return project?.verification_status === "verified" && (project.authorization === "approved" || project.authorization === "auto_cleared");
}

const authorizationMessage = {
  not_routed: "This domain does not have scan authorization.",
  pending_review: "This domain is awaiting review. You can start a scan after an operator approves it.",
  rejected: "Authorization for this domain was rejected.",
  revoked: "Authorization for this domain was revoked.",
  approved: "",
  auto_cleared: "",
};

export function StartScanButton({ projectId, label = "Start a scan", className = "btn-primary" }: { projectId: string; label?: string; className?: string }) {
  const navigate = useNavigate();
  const create = useCreateScan(projectId);
  const { data: project } = useProject(projectId);
  if (!scanAuthorized(project)) return null;
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
  const canStart = scanAuthorized(p);
  const authorization = p.authorization ?? "not_routed";
  const blocked = !canStart && (p.verification_status === "verified" || authorization === "revoked" || authorization === "rejected");
  const blockedNotice = <p role="status" className="border border-camel p-4 text-sm">{authorizationMessage[authorization]}</p>;
  if (!scanId) {
    return blocked ? blockedNotice : p.verification_status !== "verified" ? (
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
        action={blocked ? blockedNotice : canStart ? <StartScanButton projectId={projectId} label="Start a new scan" /> : <VerificationPanel project={p} />}
      />
    );
  }
  return (
    <>
      {blocked && blockedNotice}
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
