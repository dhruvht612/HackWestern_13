import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

const PENDING = new Set(["queued", "running"]);

/** Latest analysis for a scan; polls while the job is queued or running. Null = never requested. */
export function useAnalysis(scanId: string | null | undefined) {
  return useQuery({
    queryKey: ["analysis", scanId],
    queryFn: () => api.getAnalysis(scanId!),
    enabled: Boolean(scanId),
    refetchInterval: (q) => (q.state.data && PENDING.has(q.state.data.status ?? "") ? 2000 : false),
  });
}

export function useRequestAnalysis(scanId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.requestAnalysis(scanId!),
    onSuccess: (data) => qc.setQueryData(["analysis", scanId], data),
  });
}
