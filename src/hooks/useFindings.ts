import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useFindings(scanId: string | undefined) {
  return useQuery({
    queryKey: ["findings", scanId],
    queryFn: () => api.getScanFindings(scanId!),
    enabled: Boolean(scanId),
  });
}
