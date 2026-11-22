import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { AdminState } from "@/components/admin/AdminState";
import { AdminFilter, When } from "@/components/admin/AdminControls";
import { adminApi } from "@/lib/adminApi";
import { useAdminList } from "@/lib/adminQueries";

export function AuditPage() {
  const [action, setAction] = useState("");
  const query = useAdminList(["admin", "audit", action], (cursor) =>
    adminApi.audit({ action, cursor }),
  );
  return (
    <div className="space-y-5">
      <PageHeader title="Audit log" description="Entries can't be edited or deleted." />
      <AdminFilter
        label="Action"
        value={action}
        onChange={setAction}
        options={[
          { value: "", label: "All" },
          ...["review.", "user.", "domain.", "blocklist.", "migration.", "copilot."].map((value) => ({
            value,
            label: value.slice(0, -1),
          })),
        ]}
      />
      <AdminState
        query={query}
        isEmpty={(d) => !d.items.length}
        emptyTitle="No matching audit entries"
      >
        {(data) => (
          <DataTable
            rows={data.items}
            rowKey={(a) => String(a.id)}
            columns={[
              { key: "time", header: "Time", render: (a) => <When iso={a.created_at} /> },
              {
                key: "actor",
                header: "Actor",
                render: (a) => (
                  <span className="block max-w-48 truncate">
                    {a.actor_id === null ? "System" : (a.actor_email ?? a.actor_id)}
                  </span>
                ),
              },
              {
                key: "action",
                header: "Action",
                render: (a) => <span className="mono">{a.action}</span>,
              },
              {
                key: "target",
                header: "Target",
                render: (a) => (
                  <span className="mono block max-w-64 truncate" title={a.target_id}>
                    {a.target_type}: {a.target_id}
                  </span>
                ),
              },
              {
                key: "reason",
                header: "Reason",
                render: (a) => <p className="min-w-48 max-w-96 break-words">{a.reason ?? "—"}</p>,
              },
            ]}
          />
        )}
      </AdminState>
    </div>
  );
}
