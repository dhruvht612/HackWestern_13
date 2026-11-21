import { Link, NavLink, Outlet, useNavigate, useParams } from "react-router-dom";
import { LayoutDashboard, Server, AlertTriangle, Package, Network, FileText } from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import { useProject } from "@/hooks/useProject";
import { ClassificationBand } from "@/components/ClassificationBand";
import { AccountMenu } from "@/components/AccountMenu";
import { StartScanButton } from "@/components/ScanGate";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "" },
  { label: "Assets", icon: Server, path: "/assets" },
  { label: "Findings", icon: AlertTriangle, path: "/findings" },
  { label: "Dependencies", icon: Package, path: "/dependencies" },
  { label: "Attack paths", icon: Network, path: "/graph" },
  { label: "Report", icon: FileText, path: "/report" },
];

export function AppLayout() {
  const { id: projectId = "" } = useParams();
  const navigate = useNavigate();
  const { data: projects } = useProjects();
  const { data: project } = useProject(projectId);

  return (
    <div className="grain min-h-screen text-fg">
      <ClassificationBand className="no-print">Passive recon only // Potential exposure, validate before action</ClassificationBand>

      <div className="mx-auto max-w-[1440px] px-3 pb-10 md:px-6">
        <header className="no-print flex flex-wrap items-center justify-between gap-3 py-4">
          <Link to="/" className="flex items-center gap-2.5" aria-label="AttackSurface home">
            <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden="true">
              <path className="fill-camel" d="M2 8.5h10l2.5-3H30v22H2z" />
              <path className="fill-navy" d="M6 14h20v3H6zm0 6h13v3H6z" />
            </svg>
            <span className="display text-[1.35rem] font-extrabold uppercase tracking-[0.02em]">AttackSurface</span>
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="project-select" className="sr-only">
              Project
            </label>
            <select
              id="project-select"
              className="field w-auto max-w-[16rem] cursor-pointer py-2 font-mono text-[13px]"
              value={projectId}
              onChange={(e) => navigate(`/projects/${e.target.value}`)}
            >
              {(projects || []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.root_domain}
                </option>
              ))}
              {!projects?.some((p) => p.id === projectId) ? <option value={projectId}>{project?.root_domain ?? "…"}</option> : null}
            </select>
            {project?.verification_status === "verified" ? <StartScanButton projectId={projectId} label="New scan" className="btn-primary py-2" /> : null}
            <Link to="/projects" className="text-[13px] font-semibold text-fg-soft hover:text-kiwi">
              All projects
            </Link>
            <AccountMenu />
          </div>
        </header>

        <nav aria-label="Project sections" className="no-print -mb-px flex gap-0.5 overflow-x-auto px-1 pr-14 pt-1 [mask-image:linear-gradient(to_right,black_80%,transparent)] md:pr-1 md:[mask-image:none]">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.label}
                to={`/projects/${projectId}${item.path}`}
                end={item.path === ""}
                className={({ isActive }) =>
                  cn("tab", isActive ? "tab-active" : "tab-inactive")
                }
              >
                <Icon size={15} aria-hidden="true" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <main className="sheet relative min-h-[70vh] p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
