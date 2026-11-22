import type { ReactNode } from "react";
import { ScopeMark } from "@/components/Logo";

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
    <div className="flex flex-col items-center justify-center border border-dashed border-silver/40 px-6 py-12 text-center">
      {/* the scope with nothing in its sights */}
      <ScopeMark className="mb-4 h-10 w-10 opacity-60" />
      <div className="display text-2xl font-extrabold uppercase text-fg">{title}</div>
      <p className="mt-2 max-w-xl text-sm text-fg-soft">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
