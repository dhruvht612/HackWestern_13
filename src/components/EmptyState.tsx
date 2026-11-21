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
    <div className="flex flex-col items-center justify-center border border-dashed border-camel/40 px-6 py-12 text-center">
      <div className="display text-2xl font-extrabold uppercase text-fg">{title}</div>
      <p className="mt-2 max-w-xl text-sm text-fg-soft">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
