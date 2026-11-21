import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useAssets(scanId: string | undefined) {
  return useQuery({
    queryKey: ["assets", scanId],
    queryFn: () => api.getScanAssets(scanId!),
    enabled: Boolean(scanId),
  });
}
