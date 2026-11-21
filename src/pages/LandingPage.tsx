import { Link } from "react-router-dom";
import { ArrowRight, Radar, Brain, Wrench, Shield } from "lucide-react";

const steps = [
  { icon: Radar, title: "Discover", description: "Map exposed assets with passive CT, DNS, and HTTP/TLS signals." },
  { icon: Brain, title: "Analyze", description: "Correlate misconfigurations and dependency advisories into risk." },
  { icon: Wrench, title: "Act", description: "Get prioritized, actionable remediation with AI-assisted context." },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-slate-100">
      <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs text-accent">
          <Shield size={14} /> Passive external attack surface intelligence
        </div>
        <h1 className="max-w-4xl text-4xl font-bold tracking-tight md:text-6xl">
          See what attackers can see.
          <span className="block text-accent">Fix what matters first.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-slate-400">
          AttackSurface turns publicly exposed assets and dependency vulnerabilities into prioritized,
          actionable security insights.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/projects/new"
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 font-medium text-slate-950 hover:bg-cyan-300"
          >
            Start a project <ArrowRight size={16} />
          </Link>
          <Link
            to="/projects/11111111-1111-4111-8111-111111111111"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-panel px-5 py-3 font-medium text-slate-200 hover:bg-white/5"
          >
            View demo dashboard
          </Link>
        </div>

        <div className="mt-16 grid gap-4 md:grid-cols-3">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.title} className="panel p-6">
                <div className="mb-4 inline-flex rounded-lg border border-accent/20 bg-accent/10 p-3 text-accent">
                  <Icon size={20} />
                </div>
                <h2 className="text-xl font-semibold">{step.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{step.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
