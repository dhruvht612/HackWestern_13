import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { useProject } from "./useProject";

type MaybeId = string | null | undefined;

/** The project in the URL and the scan the project pages should show (its latest). */
export function useCurrentScan() {
  const { id: projectId = "" } = useParams();
  const project = useProject(projectId);
  return { projectId, project, scanId: project.data?.latest_scan_id ?? null };
}

export const useAssets = (scanId: MaybeId) =>
  useQuery({ queryKey: ["assets", scanId], queryFn: () => api.getScanAssets(scanId!), enabled: Boolean(scanId) });

export const useFindings = (scanId: MaybeId) =>
  useQuery({ queryKey: ["findings", scanId], queryFn: () => api.getScanFindings(scanId!), enabled: Boolean(scanId) });

export const useEvidence = (scanId: MaybeId, enabled = true) =>
  useQuery({ queryKey: ["evidence", scanId], queryFn: () => api.getScanEvidence(scanId!), enabled: Boolean(scanId) && enabled });

export const useGraph = (scanId: MaybeId) =>
  useQuery({ queryKey: ["graph", scanId], queryFn: () => api.getGraph(scanId!), enabled: Boolean(scanId) });

export const useReport = (scanId: MaybeId) =>
  useQuery({ queryKey: ["report", scanId], queryFn: () => api.getReport(scanId!), enabled: Boolean(scanId) });

export const useScans = (projectId: MaybeId) =>
  useQuery({ queryKey: ["scans", projectId], queryFn: () => api.listScans(projectId!), enabled: Boolean(projectId) });
