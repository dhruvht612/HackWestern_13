import { NavLink, Outlet, useNavigate, useParams } from "react-router-dom";
import {
  LayoutDashboard,
  Server,
  AlertTriangle,
  Package,
  Network,
  FileText,
  Plus,
  Shield,
} from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import { useCreateScan } from "@/hooks/useCreateScan";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "" },
  { label: "Assets", icon: Server, path: "/assets" },
  { label: "Findings", icon: AlertTriangle, path: "/findings" },
  { label: "Dependencies", icon: Package, path: "/dependencies" },
  { label: "Attack Paths", icon: Network, path: "/graph" },
  { label: "Report", icon: FileText, path: "/report" },
];

export function AppLayout() {
  const { id } = useParams();
  const projectId = id || "11111111-1111-4111-8111-111111111111";
  const navigate = useNavigate();
  const { data: projects } = useProjects();
  const createScan = useCreateScan(projectId);

  const onNewScan = async () => {
    const result = await createScan.mutateAsync();
    navigate(`/projects/${projectId}/scans/${result.scan_id}`);
  };

  return (
    <div className="min-h-screen bg-background text-slate-100">
      <div className="flex min-h-screen">
        <aside className="no-print hidden w-64 shrink-0 border-r border-border bg-[#0E141C] p-4 lg:block">
          <div className="mb-8 flex items-center gap-2 px-2">
            <div className="rounded-lg border border-accent/30 bg-accent/10 p-2 text-accent">
              <Shield size={18} />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-wide">AttackSurface</div>
              <div className="text-xs text-slate-500">External intelligence</div>
            </div>
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const to = `/projects/${projectId}${item.path}`;
              return (
                <NavLink
                  key={item.label}
                  to={to}
                  end={item.path === ""}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                      isActive
                        ? "bg-accent/10 text-accent border border-accent/20"
                        : "text-slate-300 hover:bg-white/5 hover:text-slate-100 border border-transparent",
                    )
                  }
                >
                  <Icon size={16} />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="no-print sticky top-0 z-20 border-b border-border bg-background/90 px-4 py-3 backdrop-blur md:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="lg:hidden flex items-center gap-2 text-sm font-semibold"><Shield size={16} className="text-accent"/>AttackSurface</div>
                <select
                  className="rounded-lg border border-border bg-panel px-3 py-2 text-sm text-slate-200"
                  value={projectId}
                  onChange={(e) => navigate(`/projects/${e.target.value}`)}
                >
                  {(projects || []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.root_domain})
                    </option>
                  ))}
                  {!projects?.length ? <option value={projectId}>Acme Demo</option> : null}
                </select>
              </div>
              <button
                onClick={onNewScan}
                disabled={createScan.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-300 disabled:opacity-60"
              >
                <Plus size={16} /> {createScan.isPending ? "Starting..." : "New scan"}
              </button>
            </div>
            <div className="mt-3 flex gap-2 overflow-x-auto lg:hidden">
              {navItems.map((item) => {
                const to = `/projects/${projectId}${item.path}`;
                return (
                  <NavLink
                    key={item.label}
                    to={to}
                    end={item.path === ""}
                    className={({ isActive }) =>
                      cn(
                        "whitespace-nowrap rounded-full border px-3 py-1.5 text-xs",
                        isActive ? "border-accent/30 bg-accent/10 text-accent" : "border-border text-slate-300",
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                );
              })}
            </div>
          </header>
          <main className="p-4 md:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
