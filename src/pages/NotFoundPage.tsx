import { Link } from "react-router-dom";
import { Stamp } from "@/components/Stamp";

export function NotFoundPage() {
  return (
    <div className="grain flex min-h-screen items-center justify-center px-4 py-12 text-ink">
      <div className="sheet relative w-full max-w-lg px-8 py-10">
        <Stamp lines={["No record", "404"]} tone="ink" rotate={-7} className="absolute -right-4 -top-6 w-40" />
        <div className="mono text-[13px] text-ink-soft">REQUEST: {typeof window !== "undefined" ? window.location.pathname : ""}</div>
        <h1 className="display mt-3 text-[2.4rem] font-extrabold leading-none">There’s no file at this address.</h1>
        <p className="mt-4 text-sm leading-relaxed text-ink-soft">The page may have moved, or the link was mistyped.</p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link to="/" className="btn-primary">
            Back to the front page
          </Link>
        </div>
      </div>
    </div>
  );
}
