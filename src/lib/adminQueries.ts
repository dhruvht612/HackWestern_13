import { useInfiniteQuery, type QueryKey } from "@tanstack/react-query";
import { adminApi } from "./adminApi";
import type { Page } from "./types";

export const adminOverviewQuery = {
  queryKey: ["admin", "overview"],
  queryFn: adminApi.overview,
} as const;

export function useAdminList<T>(
  queryKey: QueryKey,
  loadPage: (cursor?: string) => Promise<Page<T>>,
) {
  return useInfiniteQuery({
    queryKey,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => loadPage(pageParam),
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    select: ({ pages }) => ({ items: pages.flatMap((page) => page.items) }),
  });
}
