import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useGraph(scanId: string | undefined) {
  return useQuery({
    queryKey: ["graph", scanId],
    queryFn: () => api.getGraph(scanId!),
    enabled: Boolean(scanId),
  });
}
