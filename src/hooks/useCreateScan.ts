import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useCreateScan(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.createScan(projectId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["scans", projectId] });
    },
  });
}
