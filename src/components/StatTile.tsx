import type { ReactNode } from "react";

export function StatTile({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="panel p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm text-slate-400">{label}</div>
          <div className="mt-2 text-3xl font-semibold text-slate-50">{value}</div>
          {hint ? <div className="mt-2 text-xs text-slate-500">{hint}</div> : null}
        </div>
        {icon ? <div className="rounded-lg border border-border bg-background/60 p-2 text-accent">{icon}</div> : null}
      </div>
    </div>
  );
}
