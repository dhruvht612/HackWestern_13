import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useUploadDependencies(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, deployedOn }: { file: File; deployedOn?: string }) => api.uploadDependencies(projectId, file, deployedOn),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dependencies", projectId] }),
  });
}
