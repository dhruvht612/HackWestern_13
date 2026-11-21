import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useUploadDependencies(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => api.uploadDependencies(projectId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dependencies", projectId] });
    },
  });
}
