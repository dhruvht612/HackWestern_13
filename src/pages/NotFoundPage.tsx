import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 text-slate-100">
      <div className="panel max-w-lg p-8 text-center">
        <div className="mono text-sm text-accent">404</div>
        <h1 className="mt-2 text-2xl font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-slate-400">The page you requested does not exist.</p>
        <Link to="/" className="mt-5 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-slate-950">
          Go home
        </Link>
      </div>
    </div>
  );
}
