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
import { formatDate } from "@/lib/utils";

export function UsersPage() {
  const me = useAdmin();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [risk, setRisk] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const query = useAdminList(["admin", "users", { q, status, risk }], (cursor) =>
    adminApi.users({ q, status, risk, cursor }),
  );
  const user = query.data?.items.find((u) => u.id === selected);
  const detail = useQuery({
    queryKey: ["admin", "user", user?.id],
    queryFn: () => adminApi.user(user!.id),
    enabled: Boolean(user),
  });
  return (
    <div className="space-y-5">
      <PageHeader title="Users" description="Inspect account risk and manage access." />
      <div className="flex flex-wrap gap-3">
        <form
          className="flex min-w-0 flex-1 items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setQ(search.trim());
          }}
        >
          <label className="min-w-0 flex-1">
            <span className="field-label block">Search email</span>
            <input
              className="field"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              type="search"
              maxLength={254}
            />
          </label>
          <button type="submit" className="btn-primary">
            Search
          </button>
        </form>
        <AdminFilter
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: "", label: "All" },
            { value: "active", label: "Active" },
            { value: "pending_review", label: "Under review" },
            { value: "suspended", label: "Suspended" },
          ]}
        />
        <AdminFilter
          label="Risk"
          value={risk}
          onChange={setRisk}
          options={[
            { value: "", label: "All" },
            ...["low", "medium", "high"].map((value) => ({ value, label: value })),
          ]}
        />
      </div>
      <AdminNotice message={message} />
      <AdminState query={query} isEmpty={(d) => !d.items.length} emptyTitle="No matching users">
        {(data) => (
          <div
            className={`grid min-w-0 gap-5 ${user ? "xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]" : ""}`}
          >
            <div className="min-w-0">
              <DataTable
                rows={data.items}
                rowKey={(u) => u.id}
                columns={[
                  {
                    key: "email",
                    header: "Email",
                    render: (u) => (
                      <button
                        className="block max-w-64 truncate text-left underline"
                        onClick={() => setSelected(u.id)}
                      >
                        {u.email ?? u.id}
                      </button>
                    ),
                  },
                  { key: "status", header: "Status", render: (u) => u.status.replaceAll("_", " ") },
                  {
                    key: "risk",
                    header: "Risk",
                    render: (u) => <SeverityBadge severity={u.risk_level} />,
                  },
                  {
                    key: "reasons",
                    header: "Risk reasons",
                    render: (u) => (
                      <span className="block max-w-64 truncate" title={u.risk_reasons.join(", ")}>
                        {u.risk_reasons.join(", ") || "None"}
                      </span>
                    ),
                  },
                  { key: "projects", header: "Projects", render: (u) => u.projects },
                  { key: "joined", header: "Joined", render: (u) => formatDate(u.created_at) },
                  { key: "seen", header: "Last seen", render: (u) => formatDate(u.last_seen) },
                ]}
              />
            </div>
            <DetailPanel
              title={user?.email ?? "User"}
              open={Boolean(user)}
              onClose={() => setSelected(null)}
            >
              {user && (
                <div className="space-y-4 break-words">
                  <p>
                    {user.status.replaceAll("_", " ")} · {user.projects} projects
                  </p>
                  <ul className="list-disc pl-5">
                    {user.risk_reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                  {detail.isLoading && <p role="status">Loading account details…</p>}
                  {detail.error && <p role="alert">Couldn&apos;t load account details.</p>}
                  {detail.data && (
                    <>
                      <h4 className="font-semibold">Domain claims</h4>
                      {detail.data.claims.length ? (
                        <ul>
                          {detail.data.claims.map((claim) => (
                            <li key={claim.project_id}>
                              {claim.root_domain} · {claim.authorization.replaceAll("_", " ")}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p>No domain claims.</p>
                      )}
                      <h4 className="font-semibold">Recent security events</h4>
                      {detail.data.recent_events.length ? (
                        <ul>
                          {detail.data.recent_events.map((event) => (
                            <li key={event.id}>
                              {event.type.replaceAll("_", " ")} · {formatDate(event.created_at)}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p>No recent events.</p>
                      )}
                    </>
                  )}
                  {user.id === me.id ? (
                    <p>This is you.</p>
                  ) : me.role === "operator" ? (
                    <ReasonForm
                      key={`${user.id}-${user.status}`}
                      label="Reason for access change"
                      submitLabel={user.status === "suspended" ? "Restore access" : "Suspend"}
                      tone={user.status === "suspended" ? "primary" : "danger"}
                      onSubmit={async (reason) => {
                        const restoring = user.status === "suspended";
                        await (restoring
                          ? adminApi.unsuspend(user.id, reason)
                          : adminApi.suspend(user.id, reason));
                        await qc.invalidateQueries({ queryKey: ["admin"] });
                        setMessage(restoring ? "Access restored" : "User suspended");
                      }}
                    />
                  ) : (
                    <p>Viewers can&apos;t change account access.</p>
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
