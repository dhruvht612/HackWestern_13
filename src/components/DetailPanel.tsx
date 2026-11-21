import type { ReactNode } from "react";
import { X } from "lucide-react";

export function DetailPanel({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <aside className="panel sticky top-4 h-fit max-h-[calc(100vh-7rem)] overflow-auto p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-100">{title}</h3>
        <button
          onClick={onClose}
          className="rounded-md border border-border p-1 text-slate-400 hover:text-slate-100"
          aria-label="Close details"
        >
          <X size={16} />
        </button>
      </div>
      {children}
    </aside>
  );
}
