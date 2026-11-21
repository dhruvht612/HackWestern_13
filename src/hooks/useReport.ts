import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useReport(scanId: string | undefined) {
  return useQuery({
    queryKey: ["report", scanId],
    queryFn: () => api.getReport(scanId!),
    enabled: Boolean(scanId),
  });
}
