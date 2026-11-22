import type { ReactNode } from "react";
import { EmptyState } from "@/components/EmptyState";
import { PageSkeleton } from "@/components/LoadingSkeleton";
import { ApiError } from "@/lib/api";
import { NotFoundPage } from "@/pages/NotFoundPage";

/** Loading, error, and empty states rendered the same way on every admin page. */
export function AdminState<T>({
  query,
  isEmpty,
  emptyTitle,
  emptyDescription,
  children,
}: {
  query: {
    data: T | undefined;
    error: Error | null;
    isLoading: boolean;
    isFetching: boolean;
    hasNextPage?: boolean;
    isFetchNextPageError?: boolean;
    fetchNextPage?: () => Promise<unknown>;
  };
  isEmpty?: (data: T) => boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  children: (data: T) => ReactNode;
}) {
  if (query.isLoading) return <PageSkeleton />;
  if (query.error) {
    const err = query.error;
    if (err instanceof ApiError && (err.status === 401 || err.status === 403))
      return <NotFoundPage />;
    if (!query.isFetchNextPageError || query.data === undefined) {
      const notBuilt = err instanceof ApiError && (err.status === 404 || err.status === 405);
      return (
        <p role="alert" className="border-2 border-dashed border-camel/60 p-4 text-sm">
          {notBuilt
            ? "This part of the admin API isn't available yet."
            : `Couldn't load this: ${err.message}`}
        </p>
      );
    }
  }
  if (query.data === undefined) return <PageSkeleton />;
  const data = query.data;
  if (isEmpty?.(data))
    return <EmptyState title={emptyTitle ?? "Nothing here"} description={emptyDescription ?? ""} />;
  return (
    <>
      {children(data)}
      {query.isFetchNextPageError && (
        <p role="alert">Couldn&apos;t load more: {query.error?.message}</p>
      )}
      {query.hasNextPage && (
        <button
          className="btn-primary mt-3"
          disabled={query.isFetching}
          onClick={() => void query.fetchNextPage?.()}
        >
          {query.isFetching ? "Loading…" : "Load more"}
        </button>
      )}
    </>
  );
}
