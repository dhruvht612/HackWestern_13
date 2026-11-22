import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Four lime corner brackets filling the nearest positioned ancestor. Decorative. */
export function ScopeCorners() {
  const corner = "absolute h-3 w-3 border-lime";
  return (
    <>
      <span aria-hidden="true" className={cn(corner, "left-0 top-0 border-l-2 border-t-2")} />
      <span aria-hidden="true" className={cn(corner, "right-0 top-0 border-r-2 border-t-2")} />
      <span aria-hidden="true" className={cn(corner, "bottom-0 left-0 border-b-2 border-l-2")} />
      <span aria-hidden="true" className={cn(corner, "bottom-0 right-0 border-b-2 border-r-2")} />
    </>
  );
}

/**
 * The scope at rest: brackets just outside the one item a surface says to act on first (the P0).
 * One per surface. Never a hover or selection style.
 */
export function ScopeFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <div aria-hidden="true" className="pointer-events-none absolute -inset-2 sm:-inset-3">
        <ScopeCorners />
      </div>
      {children}
    </div>
  );
}
