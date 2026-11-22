import { useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { ClassificationBand } from "@/components/ClassificationBand";
import { api, apiConfig } from "@/lib/api";
import { session, useSession } from "@/lib/session";
import { cn } from "@/lib/utils";

export function SignInPage({ mode: requestedMode }: { mode?: "signin" | "signup" }) {
  const [params] = useSearchParams();
  const initialMode =
    requestedMode === "signup" || params.get("mode") === "signup" ? "signup" : "signin";
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const navigate = useNavigate();
  const next = params.get("next")?.startsWith("/") ? params.get("next")! : "/projects";
  const current = useSession();

  if (apiConfig.USE_MOCKS || current) return <Navigate to={next} replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setPending(true);
    try {
      if (mode === "signin") {
        session.set(await api.signIn(email.trim(), password));
        navigate(next, { replace: true });
      } else {
        const result = await api.signUp(email.trim(), password);
        if (result.session) {
          session.set(result.session);
          navigate(next, { replace: true });
        } else {
          setNotice(result.message);
          setMode("signin");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="grain min-h-screen text-fg">
      <ClassificationBand>Authorized users only // Passive recon</ClassificationBand>
      <div className="mx-auto max-w-md px-4 py-10 md:py-16">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-fg-soft hover:text-fg hover:underline">
          <ArrowLeft size={15} aria-hidden="true" /> Back
        </Link>

        <div className="mt-6 flex items-center gap-2.5">
          <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden="true">
            <path className="fill-camel" d="M2 8.5h10l2.5-3H30v22H2z" />
            <path className="fill-navy" d="M6 14h20v3H6zm0 6h13v3H6z" />
          </svg>
          <span className="display text-[1.35rem] font-extrabold uppercase tracking-[0.02em]">ShadowScope</span>
        </div>
        <p className="mono mt-1 text-[13px] text-camel">See Beyond the Surface.</p>

        <div className="mt-4 flex gap-0.5 px-1" role="tablist" aria-label="Account">
          {(["signin", "signup"] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => {
                setMode(m);
                setError(null);
              }}
              className={cn("tab", mode === m ? "tab-active" : "tab-inactive")}
            >
              {m === "signin" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>
        <div className="sheet px-5 py-7 sm:px-8">
          <h1 className="display text-[2rem] font-extrabold leading-none">{mode === "signin" ? "Open your files" : "Open an account"}</h1>
          <p className="mt-2 text-sm text-fg-soft">
            {mode === "signin" ? "Sign in to see your projects and scans." : "Use at least 8 characters for the password."}
          </p>

          {notice ? (
            <p role="status" className="mt-5 border border-camel/40 p-3 text-sm">
              {notice}
            </p>
          ) : null}

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="field-label mb-1.5 block">
                Email
              </label>
              <input id="email" type="email" autoComplete="email" required className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label htmlFor="password" className="field-label mb-1.5 block">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                minLength={mode === "signup" ? 8 : undefined}
                required
                className="field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error ? (
              <div role="alert" className="border-2 border-severity-critical p-3 text-sm">
                {error}
              </div>
            ) : null}
            <button type="submit" disabled={pending} className="btn-primary w-full py-3">
              {pending ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
