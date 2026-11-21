import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useDependencies(projectId: string | undefined) {
  return useQuery({
    queryKey: ["dependencies", projectId],
    queryFn: () => api.getDependencies(projectId!),
    enabled: Boolean(projectId),
  });
}
