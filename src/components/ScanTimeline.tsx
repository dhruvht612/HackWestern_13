import type { ScanEvent } from "@/lib/types";

function clock(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toISOString().slice(11, 19);
}

/** The collection log: typed, timestamped, one line per entry. */
export function ScanTimeline({ events, status }: { events: ScanEvent[]; status: string }) {
  return (
    <section className="panel">
      <div className="flex items-center justify-between border-b border-silver/20 px-5 py-3">
        <h3 className="field-label !text-fg">Collection log</h3>
        <span className="field-label">{status}</span>
      </div>
      <ol className="divide-y divide-silver/10">
        {events.map((event, i) => (
          <li key={`${event.timestamp}-${i}`} className="grid grid-cols-[5.5rem_1fr] gap-3 px-5 py-3 text-sm sm:grid-cols-[6.5rem_4rem_1fr]">
            <span className="mono tabular text-fg-soft">{clock(event.timestamp)}Z</span>
            <span
              className={`mono hidden text-[13px] font-bold uppercase sm:block ${
                event.level === "warn" ? "text-severity-high" : event.level === "error" ? "text-severity-critical" : "text-fg-faint"
              }`}
            >
              {event.level}
            </span>
            <span className={event.level === "warn" ? "font-semibold text-fg" : "text-fg"}>{event.message}</span>
          </li>
        ))}
        {status !== "completed" ? (
          <li className="grid grid-cols-[5.5rem_1fr] gap-3 px-5 py-3 text-sm sm:grid-cols-[6.5rem_4rem_1fr]">
            <span className="skeleton h-3.5 w-16 self-center" />
            <span className="hidden sm:block" />
            <span className="text-fg-soft">Collecting…</span>
          </li>
        ) : null}
      </ol>
    </section>
  );
}
