import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { AccountMenu } from "@/components/AccountMenu";
import { ClassificationBand } from "@/components/ClassificationBand";
import { EmptyState } from "@/components/EmptyState";
import { PageSkeleton } from "@/components/LoadingSkeleton";
import { useProjects } from "@/hooks/useProjects";
import { formatDate } from "@/lib/utils";

const STATUS_LABEL = { verified: "Verified", pending: "Awaiting DNS check", unverified: "Not verified", expired: "Verification expired" };

export function ProjectsPage() {
  const projects = useProjects();
  return (
    <div className="grain min-h-screen text-fg">
      <ClassificationBand>Passive recon only // Authorized targets</ClassificationBand>
      <div className="mx-auto max-w-4xl px-4 py-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <Link to="/" className="display text-[1.35rem] font-extrabold uppercase">
            ShadowScope
          </Link>
          <AccountMenu />
        </header>
        <div className="sheet mt-6 p-5 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-camel pb-4">
            <div>
              <h1 className="display text-[2rem] font-extrabold leading-none">Your files</h1>
              <p className="mt-2 text-sm text-fg-soft">One project per root domain you're authorized to assess.</p>
            </div>
            <Link to="/projects/new" className="btn-primary py-2">
              <Plus size={16} aria-hidden="true" /> New project
            </Link>
          </div>
          {projects.isLoading ? (
            <div className="mt-6">
              <PageSkeleton />
            </div>
          ) : projects.error ? (
            <p role="alert" className="mt-6 border-2 border-severity-critical p-4 text-sm">
              Couldn't load projects: {(projects.error as Error).message}
            </p>
          ) : !projects.data?.length ? (
            <div className="mt-6">
              <EmptyState
                title="No files yet"
                description="Create a project for a domain you're authorized to assess, verify it with a DNS record, then start a scan."
                action={<Link to="/projects/new" className="btn-primary">Create a project</Link>}
              />
            </div>
          ) : (
            <ul className="mt-2 divide-y divide-camel/15">
              {projects.data.map((p) => (
                <li key={p.id}>
                  <Link to={`/projects/${p.id}`} className="grid gap-1 px-2 py-4 transition-colors hover:bg-camel/10 sm:grid-cols-[1fr_auto] sm:items-center">
                    <span>
                      <span className="block font-semibold">{p.name}</span>
                      <span className="mono text-[13px] text-fg-soft">{p.root_domain}</span>
                    </span>
                    <span className="text-[13px] text-fg-soft sm:text-right">
                      <span className={p.verification_status === "verified" ? "text-fg" : "text-severity-medium"}>{STATUS_LABEL[p.verification_status]}</span>
                      <span className="block">{p.latest_scan_id ? "Has scans" : "No scans yet"} · {formatDate(p.created_at)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
