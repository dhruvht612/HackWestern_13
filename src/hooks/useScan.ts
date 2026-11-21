import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useScan(scanId: string | undefined) {
  return useQuery({
    queryKey: ["scan", scanId],
    queryFn: () => api.getScan(scanId!),
    enabled: Boolean(scanId),
    refetchInterval: (query) => (query.state.data?.status === "completed" ? false : 2000),
  });
}
