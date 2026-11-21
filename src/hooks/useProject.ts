import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: ["project", id],
    queryFn: () => api.getProject(id!),
    enabled: Boolean(id),
  });
}
