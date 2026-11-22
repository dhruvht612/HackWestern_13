import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { AdminState } from "@/components/admin/AdminState";
import { adminOverviewQuery } from "@/lib/adminQueries";
import { formatDate } from "@/lib/utils";

export function OverviewPage() {
  const query = useQuery(adminOverviewQuery);
  return (
    <div className="space-y-5">
      <PageHeader title="Overview" description="Service activity, AI usage, and the daily operations brief." />
      <AdminState query={query}>
        {(data) => (
          <div className="space-y-6">
            <dl className="grid grid-cols-2 divide-camel/30 border-l border-t border-camel/30 lg:grid-cols-4">
              {[
                ["Users", data.users],
                ["Verified domains", data.verified_domains],
                [
                  "Pending reviews",
                  <Link to="/admin" className="underline">
                    {data.pending_reviews}
                  </Link>,
                ],
                ["Scans · 24h", data.scans_24h],
                ["Scan failures · 24h", data.scan_failures_24h],
                ["Blocklist hits · 24h", data.blocklist_hits_24h],
                [
                  "AI fallback rate",
                  data.ai_fallback_rate === null
                    ? "—"
                    : `${Math.round(data.ai_fallback_rate * 100)}%`,
                ],
              ].map(([label, value]) => (
                <div key={String(label)} className="min-w-0 border-b border-r border-camel/30 p-4">
                  <dt className="text-sm text-fg-soft">{label}</dt>
                  <dd className="mono mt-3 text-3xl">{value}</dd>
                </div>
              ))}
            </dl>
            <p>
              {data.worker_last_seen
                ? `Worker last seen ${formatDate(data.worker_last_seen)}`
                : "Warning: No worker heartbeat"}
            </p>
            <section className="sheet space-y-3 p-5">
              <h2 className="text-xl font-semibold">Daily brief</h2>
              <p className="text-sm text-fg-soft">
                {data.daily_brief.source === "gemini" ? "Written by Gemini" : "Template"}
              </p>
              <p>{data.daily_brief.text}</p>
            </section>
          </div>
        )}
      </AdminState>
    </div>
  );
}
