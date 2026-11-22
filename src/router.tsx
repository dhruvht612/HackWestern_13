import { createBrowserRouter } from "react-router-dom";
import { AppLayout } from "@/layouts/AppLayout";
import { RequireAuth } from "@/components/RequireAuth";
import { LandingPage } from "@/pages/LandingPage";
import { SignInPage } from "@/pages/SignInPage";
import { ProjectsPage } from "@/pages/ProjectsPage";
import { NewProjectPage } from "@/pages/NewProjectPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { ScanProgressPage } from "@/pages/ScanProgressPage";
import { AssetsPage } from "@/pages/AssetsPage";
import { FindingsPage } from "@/pages/FindingsPage";
import { DependenciesPage } from "@/pages/DependenciesPage";
import { GraphPage } from "@/pages/GraphPage";
import { ReportPage } from "@/pages/ReportPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { SecurityPage } from "@/pages/SecurityPage";
import { RequireAdmin } from "@/components/admin/RequireAdmin";
import { AdminLayout } from "@/layouts/AdminLayout";

import { ReviewQueuePage } from "@/pages/admin/ReviewQueuePage";
import { UsersPage } from "@/pages/admin/UsersPage";
import { DomainsPage } from "@/pages/admin/DomainsPage";
import { OverviewPage } from "@/pages/admin/OverviewPage";
import { EventsPage } from "@/pages/admin/EventsPage";
import { BlocklistPage } from "@/pages/admin/BlocklistPage";
import { AuditPage } from "@/pages/admin/AuditPage";
import { AiOperationsPage } from "@/pages/admin/AiOperationsPage";
import { CopilotPage } from "@/pages/admin/CopilotPage";

export const router = createBrowserRouter([
  { path: "/", element: <LandingPage /> },
  { path: "/signin", element: <SignInPage /> },
  { path: "/signup", element: <SignInPage mode="signup" /> },
  {
    element: <RequireAuth />,
    children: [
      { path: "/projects", element: <ProjectsPage /> },
      { path: "/account/security", element: <SecurityPage /> },
      { path: "/projects/new", element: <NewProjectPage /> },
      {
        path: "/projects/:id",
        element: <AppLayout />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: "scans/:scanId", element: <ScanProgressPage /> },
          { path: "assets", element: <AssetsPage /> },
          { path: "findings", element: <FindingsPage /> },
          { path: "dependencies", element: <DependenciesPage /> },
          { path: "graph", element: <GraphPage /> },
          { path: "report", element: <ReportPage /> },
        ],
      },
      {
        element: <RequireAdmin />,
        children: [
          {
            path: "/admin",
            element: <AdminLayout />,
            children: [
              { index: true, element: <ReviewQueuePage /> },
              { path: "users", element: <UsersPage /> },
              { path: "domains", element: <DomainsPage /> },
              { path: "overview", element: <OverviewPage /> },
              { path: "events", element: <EventsPage /> },
              { path: "blocklist", element: <BlocklistPage /> },
              { path: "audit", element: <AuditPage /> },
              { path: "ai", element: <AiOperationsPage /> },
              { path: "copilot", element: <CopilotPage /> },
              { path: "*", element: <NotFoundPage /> },
            ],
          },
        ],
      },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
