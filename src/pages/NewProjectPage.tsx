import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { useCreateProject } from "@/hooks/useCreateProject";

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
      setError(err instanceof Error ? err.message : "Failed to create project");
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-12 text-slate-100">
      <div className="mx-auto max-w-2xl">
        <Link to="/" className="text-sm text-slate-400 hover:text-accent">← Back</Link>
        <div className="panel mt-4 p-6 md:p-8">
          <h1 className="text-2xl font-semibold">Create project</h1>
          <p className="mt-2 text-sm text-slate-400">
            Add an authorized root domain for passive external attack surface discovery.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-5">
            <div>
              <label className="mb-2 block text-sm text-slate-300">Project name</label>
              <input
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Demo"
                required
              />
            </div>
            <div>
              <label className="mb-2 block text-sm text-slate-300">Root domain</label>
              <input
                className="mono w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
                value={rootDomain}
                onChange={(e) => setRootDomain(e.target.value)}
                placeholder="acme-demo.com"
                required
              />
              <p className="mt-2 text-xs text-slate-500">Registrable domain only. No IPs, wildcards, schemes, or paths.</p>
            </div>

            <div className="rounded-lg border border-severity-medium/30 bg-severity-medium/5 p-4">
              <div className="flex gap-2 text-sm text-severity-medium">
                <ShieldAlert size={16} className="mt-0.5 shrink-0" />
                <div>
                  <div className="font-medium">Passive discovery only</div>
                  <p className="mt-1 text-slate-300">
                    Discovery uses CT logs, DNS, and HTTP headers/TLS metadata only. No brute-forcing, port scanning, or exploitation.
                  </p>
                </div>
              </div>
            </div>

            <label className="flex items-start gap-3 text-sm text-slate-300">
              <input
                type="checkbox"
                className="mt-1 accent-[#22D3EE]"
                checked={authorized}
                onChange={(e) => setAuthorized(e.target.checked)}
              />
              <span>I confirm I am authorized to assess this domain and its externally exposed assets.</span>
            </label>

            {error ? <div className="rounded-lg border border-severity-critical/30 bg-severity-critical/10 p-3 text-sm text-severity-critical">{error}</div> : null}

            <button
              type="submit"
              disabled={createProject.isPending}
              className="rounded-lg bg-accent px-4 py-2 font-medium text-slate-950 hover:bg-cyan-300 disabled:opacity-60"
            >
              {createProject.isPending ? "Creating..." : "Create project"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
