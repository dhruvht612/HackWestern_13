import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { AdminState } from "@/components/admin/AdminState";
import { AdminFilter, When } from "@/components/admin/AdminControls";
import { adminApi } from "@/lib/adminApi";
import { useAdminList } from "@/lib/adminQueries";

export function EventsPage() {
  const [type, setType] = useState("");
  const query = useAdminList(["admin", "events", type], (cursor) =>
    adminApi.events({ type, cursor }),
  );
  return (
    <div className="space-y-5">
      <PageHeader title="Abuse feed" description="Security events and checks across the service." />
      <AdminFilter
        label="Event type"
        value={type}
        onChange={setType}
        options={[
          { value: "", label: "All" },
          ...[
            "signup",
            "signin_failed",
            "verify_issued",
            "verify_failed",
            "verify_passed",
            "blocklist_hit",
            "rate_limited",
            "scan_started",
            "scan_denied",
            "review_queued",
          ].map((value) => ({ value, label: value.replaceAll("_", " ") })),
        ]}
      />
      <AdminState query={query} isEmpty={(d) => !d.items.length} emptyTitle="No matching events">
        {(data) => (
          <DataTable
            rows={data.items}
            rowKey={(e) => String(e.id)}
            columns={[
              { key: "time", header: "Time", render: (e) => <When iso={e.created_at} /> },
              {
                key: "type",
                header: "Type",
                render: (e) => (
                  <>
                    {e.type.replaceAll("_", " ")}
                    {["blocklist_hit", "verify_failed"].includes(e.type) && (
                      <span className="ml-2 border border-silver px-1 text-xs">
                        {e.type === "blocklist_hit" ? "Blocklist" : "Failed check"}
                      </span>
                    )}
                  </>
                ),
              },
              {
                key: "user",
                header: "User",
                render: (e) => (
                  <span className="block max-w-48 truncate">
                    {e.user_email ?? e.user_id ?? "—"}
                  </span>
                ),
              },
              {
                key: "ip",
                header: "IP",
                render: (e) => <span className="mono">{e.ip ?? "—"}</span>,
              },
              {
                key: "subject",
                header: "Subject",
                render: (e) => (
                  <span className="mono block max-w-64 truncate">{e.subject ?? "—"}</span>
                ),
              },
              {
                key: "detail",
                header: "Detail",
                render: (e) => (
                  <p className="min-w-48 max-w-80 break-words">
                    {Object.entries(e.detail)
                      .map(
                        ([k, v]) =>
                          `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`,
                      )
                      .join("; ") || "—"}
                  </p>
                ),
              },
            ]}
          />
        )}
      </AdminState>
    </div>
  );
}
