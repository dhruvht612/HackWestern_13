import { useOutletContext } from "react-router-dom";
import { adminApi } from "./adminApi";
import type { AdminMe } from "./types";

export const adminMeQuery = {
  queryKey: ["admin", "me"],
  queryFn: adminApi.me,
  retry: false,
  staleTime: 30_000,
} as const;
export function useAdmin(): AdminMe {
  return useOutletContext<AdminMe>();
}
