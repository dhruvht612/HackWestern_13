import { CheckCircle2, Circle, Clock, AlertTriangle } from "lucide-react";
import type { ScanEvent } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export function ScanTimeline({ events, status }: { events: ScanEvent[]; status: string }) {
  return (
    <div className="panel p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-100">Scan timeline</h3>
        <span className="text-xs uppercase tracking-wide text-slate-400">{status}</span>
      </div>
      <div className="space-y-4">
        {events.map((event, i) => {
          const done = status === "completed" || i < events.length - 1;
          const Icon = event.level === "warn" ? AlertTriangle : done ? CheckCircle2 : Circle;
          const color =
            event.level === "warn"
              ? "text-severity-medium"
              : done
                ? "text-accent"
                : "text-slate-500";
          return (
            <div key={`${event.timestamp}-${i}`} className="flex gap-3">
              <div className={`mt-0.5 ${color}`}>
                <Icon size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-slate-200">{event.message}</div>
                <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                  <Clock size={12} /> {formatDate(event.timestamp)}
                </div>
              </div>
            </div>
          );
        })}
        {status !== "completed" ? (
          <div className="flex gap-3 text-slate-500">
            <Circle size={16} className="mt-0.5 animate-pulse" />
            <div className="text-sm">Scan in progress...</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
