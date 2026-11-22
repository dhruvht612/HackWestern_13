import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { DetailPanel } from "@/components/DetailPanel";
import { SeverityBadge } from "@/components/SeverityBadge";
import { AdminState } from "@/components/admin/AdminState";
import { AdminFilter, AdminNotice } from "@/components/admin/AdminControls";
import { ReasonForm } from "@/components/admin/ReasonForm";
import { adminApi } from "@/lib/adminApi";
import { useAdminList } from "@/lib/adminQueries";
import { useAdmin } from "@/lib/adminSession";
import { ApiError } from "@/lib/api";
import { formatDate } from "@/lib/utils";

export function ReviewQueuePage() {
  const me = useAdmin();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("pending");
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [conflict, setConflict] = useState("");
  const [busy, setBusy] = useState(false);
  const query = useAdminList(["admin", "reviews", filter], (cursor) =>
    adminApi.reviews({
      status: filter === "pending" || filter === "decided" ? filter : undefined,
      cursor,
    }),
  );
  const rows = query.data?.items ?? [];
  const detail = useQuery({
    queryKey: ["admin", "review", selected],
    queryFn: () => adminApi.review(selected!),
    enabled: Boolean(selected),
    refetchInterval: (query) => (query.state.data?.status === "pending" ? 15_000 : false),
  });
  const item = detail.data ?? rows.find((r) => r.id === selected);
  const verdict = item?.ai_verdict;
  const decide = async (decision: "approve" | "reject", reason: string) => {
    if (!item || busy) return;
    setConflict("");
    setBusy(true);
    try {
      await adminApi.decide(item.id, decision, reason);
      await qc.invalidateQueries({ queryKey: ["admin"] });
      setMessage(decision === "approve" ? "Approved" : "Rejected");
      setSelected(rows.find((r) => r.id !== item.id && r.status === "pending")?.id ?? null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setConflict("Someone else already decided this.");
        await qc.invalidateQueries({ queryKey: ["admin"] });
        throw new Error("Someone else already decided this.");
      }
      throw err;
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-5">
      <PageHeader
        title="Review queue"
        description="Review the evidence and record your decision. AI recommendations are advice only."
      />
      <AdminFilter
        label="Reviews"
        value={filter}
        onChange={(value) => {
          setFilter(value);
          setSelected(null);
          setConflict("");
        }}
        options={[
          { value: "pending", label: "Pending" },
          { value: "decided", label: "Decided" },
          { value: "all", label: "All" },
        ]}
      />
      <AdminNotice message={message} />
      {conflict && <p role="alert">{conflict}</p>}
      <AdminState query={query}>
        {() => (
          <div
            className={`grid min-w-0 gap-5 ${item ? "xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" : ""}`}
          >
            <div className="min-w-0">
              {rows.length ? (
                <DataTable
                  rows={rows}
                  rowKey={(r) => r.id}
                  columns={[
                    {
                      key: "risk",
                      header: "Risk",
                      render: (r) => <SeverityBadge severity={r.risk_level} />,
                    },
                    {
                      key: "target",
                      header: "Request",
                      render: (r) => (
                        <>
                          <button
                            className="mono block max-w-64 truncate text-left underline hover:text-kiwi"
                            onClick={() => setSelected(r.id)}
                          >
                            {r.root_domain ?? r.user_email ?? r.user_id}
                          </button>
                          <span className="text-xs">
                            {r.kind} · {r.status}
                          </span>
                        </>
                      ),
                    },
                    {
                      key: "requester",
                      header: "Requester",
                      render: (r) => (
                        <span className="block max-w-48 truncate">{r.user_email ?? r.user_id}</span>
                      ),
                    },
                    {
                      key: "advice",
                      header: "Advice",
                      render: (r) => (
                        <p className="min-w-48 max-w-80">
                          {r.ai_verdict
                            ? `${r.ai_verdict.fallback_used ? "Rules only" : "Gemini recommends"}: ${r.ai_verdict.recommendation.replaceAll("_", " ")} (${r.ai_verdict.confidence}). ${r.ai_verdict.summary}`
                            : "No recommendation"}
                        </p>
                      ),
                    },
                    { key: "date", header: "Requested", render: (r) => formatDate(r.created_at) },
                  ]}
                />
              ) : (
                <p>No reviews match this filter.</p>
              )}
            </div>
            <DetailPanel
              title={item?.root_domain ?? item?.user_email ?? "Review"}
              open={Boolean(item)}
              onClose={() => setSelected(null)}
            >
              {item && (
                <div className="space-y-5 break-words">
                  <dl className="space-y-3">
                    {item.signals.map((s) => (
                      <div key={s.id} id={`${item.id}-${s.id}`}>
                        <dt className="font-semibold">{s.label}</dt>
                        <dd>{s.value}</dd>
                        <dd className="mono text-xs text-fg-soft">{s.id}</dd>
                      </div>
                    ))}
                  </dl>
                  {detail.data?.recent_events.length ? (
                    <section className="space-y-2">
                      <h4 className="font-semibold">Recent security events</h4>
                      <ul>
                        {detail.data.recent_events.map((event) => (
                          <li key={event.id} id={`${item.id}-event:${event.id}`}>
                            {event.type.replaceAll("_", " ")} · {formatDate(event.created_at)}{" "}
                            <span className="mono text-xs">event:{event.id}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}
                  {verdict ? (
                    <section className="space-y-2 border-y border-camel/30 py-4">
                      <h4 className="font-semibold">
                        {verdict.fallback_used ? "Rules-only fallback" : "Gemini recommends"}:{" "}
                        {verdict.recommendation.replaceAll("_", " ")}
                      </h4>
                      <p>{verdict.confidence} confidence · Advice only</p>
                      <p>{verdict.summary}</p>
                      <ul>
                        {verdict.key_signals.map((s) => (
                          <li key={s}>
                            <a className="mono underline" href={`#${item.id}-${s}`}>
                              {s}
                            </a>
                          </li>
                        ))}
                      </ul>
                      {verdict.missing_information.length > 0 && (
                        <>
                          <h5 className="font-semibold">Missing information</h5>
                          <ul className="list-disc pl-5">
                            {verdict.missing_information.map((s) => (
                              <li key={s}>{s}</li>
                            ))}
                          </ul>
                        </>
                      )}
                      <p className="text-xs text-fg-soft">
                        {verdict.fallback_used ? "Rules-only fallback" : verdict.model}
                      </p>
                    </section>
                  ) : (
                    <p>No AI advice available.</p>
                  )}
                  {item.status !== "pending" ? (
                    <p>
                      {item.status} by {item.decided_by ?? "Unknown"} ·{" "}
                      {formatDate(item.decided_at)}
                      <br />
                      {item.decision_reason}
                    </p>
                  ) : me.id === item.user_id ? (
                    <p>You can&apos;t decide a review about your own account or domains.</p>
                  ) : me.role !== "operator" ? (
                    <p>Viewers can&apos;t decide reviews.</p>
                  ) : (
                    <fieldset disabled={busy} className="min-w-0 space-y-5">
                      <ReasonForm
                        key={`${item.id}-approve`}
                        label="Reason for approval"
                        submitLabel="Approve"
                        onSubmit={(reason) => decide("approve", reason)}
                      />
                      <ReasonForm
                        key={`${item.id}-reject`}
                        label="Reason for rejection"
                        submitLabel="Reject"
                        tone="danger"
                        onSubmit={(reason) => decide("reject", reason)}
                      />
                      <ReasonForm
                        key={`${item.id}-reanalyze`}
                        label="Reason to refresh advice"
                        submitLabel="Queue fresh advice"
                        onSubmit={async (reason) => {
                          await adminApi.reanalyze(item.id, reason);
                          setMessage("Review advice queued");
                          await qc.invalidateQueries({ queryKey: ["admin"] });
                        }}
                      />
                    </fieldset>
                  )}
                </div>
              )}
            </DetailPanel>
          </div>
        )}
      </AdminState>
    </div>
  );
}
