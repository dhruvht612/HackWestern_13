import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const SCAN_DONE = new Set(["completed", "partial", "failed", "cancelled"]);

export function useScan(scanId: string | null | undefined) {
  return useQuery({
    queryKey: ["scan", scanId],
    queryFn: () => api.getScan(scanId!),
    enabled: Boolean(scanId),
    refetchInterval: (q) => (q.state.data && SCAN_DONE.has(q.state.data.status) ? false : 2000),
  });
}
