import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

/**
 * The scope lens: a reticle whose left half is still in shadow and whose right half has been
 * brought into view. The off-white pupil sits on the seam between the two.
 */
export function ScopeMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-7 w-7 shrink-0", className)} aria-hidden="true">
      <circle cx="16" cy="16" r="10" className="fill-none stroke-silver" strokeWidth="2.5" />
      <path d="M16 6a10 10 0 0 1 0 20z" className="fill-silver" />
      <path d="M16 .5V5M16 27v4.5M.5 16H5M27 16h4.5" className="stroke-silver" strokeWidth="2.5" />
      <circle cx="16" cy="16" r="2.4" className="fill-fg" />
    </svg>
  );
}

/** "SHADOW" sits in shadow (muted), "SCOPE" in full light. Reads as one word to screen readers. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("display text-[1.35rem] font-extrabold uppercase tracking-[0.02em]", className)}>
      <span className="text-fg-faint">Shadow</span>
      <span className="text-fg">Scope</span>
    </span>
  );
}

/** Mark plus wordmark. Pass `to` to make it a home link. */
export function Logo({ to, className }: { to?: string; className?: string }) {
  const body = (
    <>
      <ScopeMark />
      <Wordmark />
    </>
  );
  const cls = cn("flex items-center gap-2.5", className);
  return to ? (
    <Link to={to} className={cls} aria-label="ShadowScope home">
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
