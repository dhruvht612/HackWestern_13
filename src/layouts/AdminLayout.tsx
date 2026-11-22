import { Link, NavLink, Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Ban, ClipboardCheck, Globe, LayoutGrid, MessageSquare, ScrollText, Siren, Sparkles, Users } from "lucide-react";
import { AccountMenu } from "@/components/AccountMenu";
import { ClassificationBand } from "@/components/ClassificationBand";
import { useAdmin } from "@/lib/adminSession";
import { adminOverviewQuery } from "@/lib/adminQueries";
import { apiConfig } from "@/lib/api";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Review queue", icon: ClipboardCheck, path: "/admin", end: true },
  { label: "Users", icon: Users, path: "/admin/users" },
  { label: "Domains", icon: Globe, path: "/admin/domains" },
  { label: "Overview", icon: LayoutGrid, path: "/admin/overview" },
  { label: "Abuse monitoring", icon: Siren, path: "/admin/events" },
  { label: "Blocklist", icon: Ban, path: "/admin/blocklist" },
  { label: "Audit logs", icon: ScrollText, path: "/admin/audit" },
  { label: "Gemini operations", icon: Sparkles, path: "/admin/ai" },
  { label: "Copilot", icon: MessageSquare, path: "/admin/copilot" },
];

export function AdminLayout() {
  const me = useAdmin();
  const overview = useQuery(adminOverviewQuery);
  const pendingCount = overview.data?.pending_reviews;

  return (
    <div className="grain min-h-screen text-fg">
      <ClassificationBand>ShadowScope Security Control Center // Every action is logged</ClassificationBand>
      {apiConfig.USE_MOCKS ? (
        <div className="border-b-2 border-dashed border-camel/60 bg-navy-deep px-4 py-1.5 text-center text-[13px] font-semibold text-camel">
          Sample data. These users, domains, and events are made up for the demo.
        </div>
      ) : null}

      <div className="mx-auto max-w-[1440px] px-3 pb-10 md:px-6">
        <header className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/projects"
              className="display text-[1.35rem] font-extrabold uppercase tracking-[0.02em]"
            >
              ShadowScope
            </Link>
            <span className="border-[1.5px] border-camel px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.09em] text-camel">
              Security Control Center
            </span>
            <span className="mono text-[13px] text-fg-soft">
              {me.role}
              {me.aal === "aal2" ? " · two-factor ✓" : ""}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link to="/projects" className="text-[13px] font-semibold text-fg-soft hover:text-kiwi">
              Back to projects
            </Link>
            <AccountMenu />
          </div>
        </header>

        <nav
          aria-label="Admin sections"
          className="-mb-px flex gap-0.5 overflow-x-auto px-1 pr-14 pt-1 [mask-image:linear-gradient(to_right,black_80%,transparent)] md:pr-1 md:[mask-image:none]"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                className={({ isActive }) => cn("tab", isActive ? "tab-active" : "tab-inactive")}
              >
                <Icon size={15} aria-hidden="true" />
                {item.label}
                {item.path === "/admin" && pendingCount ? (
                  <span
                    className="mono ml-1 border-[1.5px] border-current px-1.5 text-[11px] leading-tight"
                    aria-label={`${pendingCount} pending`}
                  >
                    {pendingCount}
                  </span>
                ) : null}
              </NavLink>
            );
          })}
        </nav>

        <main className="sheet relative min-h-[70vh] p-4 sm:p-6 lg:p-8">
          <Outlet context={me} />
        </main>
      </div>
    </div>
  );
}
