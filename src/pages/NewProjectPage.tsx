import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useCreateProject } from "@/hooks/useCreateProject";
import { ClassificationBand } from "@/components/ClassificationBand";

export function NewProjectPage() {
  const navigate = useNavigate();
  const createProject = useCreateProject();
  const [name, setName] = useState("");
  const [rootDomain, setRootDomain] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const project = await createProject.mutateAsync({
        name: name.trim(),
        root_domain: rootDomain.trim(),
        authorization_confirmed: authorized,
      });
      navigate(`/projects/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The project couldn’t be created. Check the domain and try again.");
    }
  };

  return (
    <div className="grain min-h-screen text-fg">
      <ClassificationBand>Passive recon only // Authorized targets</ClassificationBand>
      <div className="mx-auto max-w-2xl px-4 py-10 md:py-14">
        <Link to="/projects" className="inline-flex items-center gap-1.5 text-sm font-semibold text-fg-soft hover:text-fg hover:underline">
          <ArrowLeft size={15} aria-hidden="true" /> Back
        </Link>

        <div className="sheet mt-4 px-5 py-7 sm:px-10 sm:py-10">
          <div className="border-b-2 border-camel pb-4">
            <h1 className="display text-[2.4rem] font-extrabold leading-none">Open a new file</h1>
            <p className="mt-3 text-sm leading-relaxed text-fg-soft">
              Add a root domain you’re authorized to assess. AttackSurface maps what’s exposed using passive signals only.
            </p>
          </div>

          <form onSubmit={onSubmit} className="mt-6">
            <div className="grid border border-camel/40 sm:grid-cols-2">
              <div className="border-b border-camel/40 p-3 focus-within:outline focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-kiwi sm:border-b-0 sm:border-r">
                <label htmlFor="project-name" className="field-label">
                  1. Project name
                </label>
                <input
                  id="project-name"
                  className="mt-1 w-full bg-transparent text-[15px] outline-none placeholder:text-fg-faint focus-visible:outline-none"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Acme Demo"
                  autoComplete="off"
                  required
                />
              </div>
              <div className="p-3 focus-within:outline focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-kiwi">
                <label htmlFor="root-domain" className="field-label">
                  2. Root domain
                </label>
                <input
                  id="root-domain"
                  className="mono mt-1 w-full bg-transparent text-[15px] outline-none placeholder:text-fg-faint focus-visible:outline-none"
                  value={rootDomain}
                  onChange={(e) => setRootDomain(e.target.value)}
                  placeholder="acme-demo.com"
                  autoComplete="off"
                  spellCheck={false}
                  aria-describedby="root-domain-hint"
                  required
                />
              </div>
            </div>
            <p id="root-domain-hint" className="mt-2 text-xs text-fg-soft">
              A registrable domain only: no IP addresses, wildcards, schemes, or paths.
            </p>

            <div className="mt-6 border-[1.5px] border-camel p-4">
              <div className="field-label !text-fg">3. Scope of collection</div>
              <p className="mt-1.5 text-sm leading-relaxed">
                Certificate Transparency logs, DNS, and HTTP headers / TLS metadata. No brute-forcing, port scanning, or exploitation.
              </p>
            </div>

            <label className="mt-4 flex cursor-pointer items-start gap-3 border-[1.5px] border-dashed border-camel/50 p-4 text-sm leading-relaxed transition-colors hover:border-camel">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-kiwi"
                checked={authorized}
                onChange={(e) => setAuthorized(e.target.checked)}
              />
              <span>
                <span className="font-semibold">4. Attestation.</span> I confirm I’m authorized to assess this domain and its
                externally exposed assets.
              </span>
            </label>

            {error ? (
              <div role="alert" className="mt-4 border-2 border-severity-critical p-3 text-sm">
                <span className="font-semibold text-severity-critical">Not created.</span> {error}
              </div>
            ) : null}

            <div className="mt-7 flex flex-wrap items-center gap-4">
              <button type="submit" disabled={createProject.isPending || !authorized} className="btn-primary px-6 py-3">
                {createProject.isPending ? "Creating…" : "Create project"}
              </button>
              {!authorized ? <span className="text-xs text-fg-soft">Confirm the attestation to continue.</span> : null}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
