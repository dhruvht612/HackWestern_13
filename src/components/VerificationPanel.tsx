import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy } from "lucide-react";
import { api } from "@/lib/api";
import type { Project, VerificationChallenge } from "@/lib/types";

/** DNS TXT proof of domain control. Shown until the project is verified; scans are blocked until then. */
export function VerificationPanel({ project }: { project: Project }) {
  const qc = useQueryClient();
  const [challenge, setChallenge] = useState<VerificationChallenge | null>(null);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["project", project.id] });
    qc.invalidateQueries({ queryKey: ["projects"] });
  };
  const issue = useMutation({ mutationFn: () => api.issueVerification(project.id), onSuccess: (c) => { setChallenge(c); refresh(); } });
  const check = useMutation({ mutationFn: () => api.checkVerification(project.id), onSuccess: (c) => { setChallenge((prev) => ({ ...c, record_value: prev?.record_value ?? null })); refresh(); } });
  const error = (issue.error || check.error) as Error | null;

  return (
    <section className="border-2 border-silver p-5" aria-labelledby="verify-heading">
      <h2 id="verify-heading" className="display text-xl font-extrabold">
        {project.verification_status === "expired" ? "Re-verify domain control" : "Verify domain control"}
      </h2>
      <p className="mt-2 max-w-[70ch] text-sm leading-relaxed text-fg-soft">
        The authorization checkbox isn't proof. Add a DNS TXT record to <span className="mono text-fg">{project.root_domain}</span> to show
        you control it. Scans are blocked until it verifies, and only cover {project.root_domain} and its subdomains.
      </p>

      {challenge?.record_value ? (
        <dl className="mono mt-4 grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 gap-y-2 border border-silver/30 p-4 text-[13px]">
          <dt className="text-silver">TYPE</dt>
          <dd>TXT</dd>
          <dt className="text-silver">NAME</dt>
          <dd className="break-all">{challenge.record_name}</dd>
          <dt className="text-silver">VALUE</dt>
          <dd className="flex items-start gap-2">
            <span className="break-all">{challenge.record_value}</span>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(challenge.record_value ?? "")}
              className="shrink-0 text-fg-soft hover:text-lime"
              aria-label="Copy TXT value"
            >
              <Copy size={14} />
            </button>
          </dd>
        </dl>
      ) : null}
      {challenge?.message ? (
        <p role="status" className="mt-3 text-sm">
          {challenge.message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 border-2 border-severity-critical p-3 text-sm">
          {error.message}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={() => issue.mutate()} disabled={issue.isPending} className={challenge?.record_value ? "btn-secondary py-2" : "btn-primary py-2"}>
          {issue.isPending ? "Issuing…" : challenge?.record_value || project.verification_status === "pending" ? "Issue a new value" : "Get TXT record"}
        </button>
        {project.verification_status === "pending" || challenge ? (
          <button onClick={() => check.mutate()} disabled={check.isPending} className="btn-primary py-2">
            {check.isPending ? "Checking DNS…" : "Check DNS now"}
          </button>
        ) : null}
      </div>
      {project.verification_status === "pending" && !challenge?.record_value ? (
        <p className="mt-3 text-xs text-fg-faint">A value was issued earlier but isn't shown again. Check it, or issue a new one.</p>
      ) : null}
    </section>
  );
}
