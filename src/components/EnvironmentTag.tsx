import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  prod: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  staging: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  dev: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  unknown: "bg-slate-500/15 text-slate-300 border-slate-500/30",
};

export function EnvironmentTag({ env }: { env: "prod" | "staging" | "dev" | "unknown" }) {
  return (
    <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-xs font-medium", styles[env])}>
      {env}
    </span>
  );
}
