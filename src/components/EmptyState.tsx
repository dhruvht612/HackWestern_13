import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center border border-dashed border-ink/40 px-6 py-12 text-center">
      <div className="display text-2xl font-extrabold uppercase text-ink">{title}</div>
      <p className="mt-2 max-w-xl text-sm text-ink-soft">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
