import type { ReactNode } from "react";
import { X } from "lucide-react";

/** Side sheet. The title is the subject itself (a finding, a card), never a generic label. */
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
    <aside
      className="sheet sticky top-4 h-fit max-h-[calc(100vh-7rem)] overflow-auto border border-silver/25 p-5"
      aria-label={title}
    >
      <div className="mb-4 flex items-start justify-between gap-3 border-b-2 border-silver pb-3">
        <h3 className="min-w-0 break-words text-lg font-semibold leading-snug">{title}</h3>
        <button
          onClick={onClose}
          className="-m-1 shrink-0 p-1 text-fg-soft transition-colors hover:text-fg"
          aria-label="Close details"
        >
          <X size={16} />
        </button>
      </div>
      {children}
    </aside>
  );
}
