import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useAnalysis(scanId: string) {
  return useMutation({
    mutationFn: () => api.createAnalysis(scanId),
  });
}
