import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "@/layouts/AppLayout";
import { LandingPage } from "@/pages/LandingPage";
import { NewProjectPage } from "@/pages/NewProjectPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { ScanProgressPage } from "@/pages/ScanProgressPage";
import { AssetsPage } from "@/pages/AssetsPage";
import { FindingsPage } from "@/pages/FindingsPage";
import { DependenciesPage } from "@/pages/DependenciesPage";
import { GraphPage } from "@/pages/GraphPage";
import { ReportPage } from "@/pages/ReportPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

export const router = createBrowserRouter([
  { path: "/", element: <LandingPage /> },
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
      { path: "*", element: <Navigate to="/projects/:id" replace /> },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
