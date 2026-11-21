import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useCreateScan(projectId: string) {
  return useMutation({
    mutationFn: () => api.createScan(projectId),
  });
}
