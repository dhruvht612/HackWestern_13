import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AccountMenu } from "@/components/AccountMenu";
import { ClassificationBand } from "@/components/ClassificationBand";
import { PageSkeleton } from "@/components/LoadingSkeleton";
import { PageHeader } from "@/components/PageHeader";
import { api } from "@/lib/api";
import type { MfaEnrollment } from "@/lib/types";

export function SecurityPage() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["auth", "me"], queryFn: api.me });
  const factors = useQuery({ queryKey: ["auth", "mfa-factors"], queryFn: api.mfaFactors });
  const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const verified = factors.data?.find((f) => f.status === "verified" && f.factor_type === "totp");
  const factorId = enrollment?.factor_id ?? verified?.id;
  const elevated = me.data?.aal === "aal2";

  const run = async (action: () => Promise<unknown>) => {
    setError(null);
    setPending(true);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setPending(false);
    }
  };

  const startSetup = () => run(async () => setEnrollment(await api.mfaEnroll()));

  const onVerify = (e: FormEvent) => {
    e.preventDefault();
    if (!factorId) return;
    void run(async () => {
      await api.mfaVerify(factorId, code);
      setEnrollment(null);
      setCode("");
      await qc.invalidateQueries({ queryKey: ["auth"] });
    });
  };

  return (
    <div className="grain min-h-screen text-fg">
      <ClassificationBand>Account security</ClassificationBand>
      <div className="mx-auto max-w-2xl px-4 py-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <Link to="/projects" className="display text-[1.35rem] font-extrabold uppercase">
            ShadowScope
          </Link>
          <AccountMenu />
        </header>
        <div className="sheet mt-6 p-5 sm:p-8">
          <PageHeader title="Two-factor" description="A code from an authenticator app, on top of your password. Admin access requires it." />

          {me.isLoading || factors.isLoading ? (
            <div className="mt-6">
              <PageSkeleton />
            </div>
          ) : factors.error ? (
            <p role="alert" className="mt-6 border-2 border-severity-critical p-4 text-sm">
              Couldn&apos;t load two-factor status: {(factors.error as Error).message}
            </p>
          ) : verified && elevated ? (
            <p role="status" className="mt-6 border border-camel/40 p-4 text-sm">
              Two-factor is on for this session.
            </p>
          ) : (
            <div className="mt-6 space-y-5">
              {!verified && !enrollment ? (
                <>
                  <p className="text-sm text-fg-soft">
                    Two-factor isn&apos;t set up yet. You&apos;ll need an authenticator app (1Password, Google Authenticator, Authy…).
                  </p>
                  <button type="button" onClick={startSetup} disabled={pending} className="btn-primary py-2">
                    {pending ? "Working…" : "Set up two-factor"}
                  </button>
                </>
              ) : null}

              {enrollment ? (
                <div className="space-y-3">
                  <p className="text-sm">Scan this with your authenticator app, then enter the 6-digit code it shows.</p>
                  <img src={enrollment.qr_code} alt="Two-factor QR code" className="h-44 w-44 bg-white p-2" />
                  <p className="text-sm text-fg-soft">
                    Can&apos;t scan? Enter this key: <span className="mono select-all break-all text-fg">{enrollment.secret}</span>
                  </p>
                </div>
              ) : verified ? (
                <p className="text-sm">Confirm it&apos;s you: enter the code from your authenticator app.</p>
              ) : null}

              {factorId ? (
                <form onSubmit={onVerify} className="space-y-3">
                  <div>
                    <label htmlFor="mfa-code" className="field-label mb-1.5 block">
                      6-digit code
                    </label>
                    <input
                      id="mfa-code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      required
                      className="field mono max-w-[10rem] tracking-[0.3em]"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    />
                  </div>
                  <button type="submit" disabled={pending || code.length !== 6} className="btn-primary py-2">
                    {pending ? "Checking…" : "Verify"}
                  </button>
                </form>
              ) : null}

              {error ? (
                <div role="alert" className="border-2 border-severity-critical p-3 text-sm">
                  {error}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
