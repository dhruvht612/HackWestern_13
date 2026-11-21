import { cn } from "@/lib/utils";

// Environment is told by line, not hue, so it never competes with severity color.
const styles: Record<string, string> = {
  prod: "border-ink bg-ink text-bond",
  staging: "border-ink text-ink",
  dev: "border-dashed border-ink text-ink",
  unknown: "border-dotted border-ink-faint text-ink-soft",
};

export function EnvironmentTag({ env }: { env: "prod" | "staging" | "dev" | "unknown" | string }) {
  return (
    <span
      className={cn(
        "inline-flex border-[1.5px] px-1.5 py-px font-mono text-[11px] font-bold uppercase tracking-[0.06em]",
        styles[env] ?? styles.unknown,
      )}
    >
      {env}
    </span>
  );
}
