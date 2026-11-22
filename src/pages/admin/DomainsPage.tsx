import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { DetailPanel } from "@/components/DetailPanel";
import { AdminState } from "@/components/admin/AdminState";
import { AdminFilter, AdminNotice } from "@/components/admin/AdminControls";
import { ReasonForm } from "@/components/admin/ReasonForm";
import { adminApi } from "@/lib/adminApi";
import { useAdminList } from "@/lib/adminQueries";
import { useAdmin } from "@/lib/adminSession";
import { formatDate } from "@/lib/utils";
import type { DomainAuthorization } from "@/lib/types";

const labels: Record<DomainAuthorization, string> = {
  not_routed: "Not routed (can't scan)",
  auto_cleared: "Auto-cleared",
  pending_review: "Under review",
  approved: "Approved",
  rejected: "Rejected",
  revoked: "Revoked",
};
export function DomainsPage() {
  const me = useAdmin();
  const qc = useQueryClient();
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const query = useAdminList(["admin", "domains", status], (cursor) =>
    adminApi.domains({ status, cursor }),
  );
  const domain = query.data?.items.find((d) => d.project_id === selected);
  return (
    <div className="space-y-5">
      <PageHeader
        title="Domains"
        description="DNS proof and authorization are separate requirements for scanning."
      />
      <AdminFilter
        label="Authorization"
        value={status}
        onChange={setStatus}
        options={[
          { value: "", label: "All" },
          ...Object.entries(labels).map(([value, label]) => ({ value, label })),
        ]}
      />
      <AdminNotice message={message} />
      <AdminState query={query} isEmpty={(d) => !d.items.length} emptyTitle="No matching domains">
        {(data) => (
          <div
            className={`grid min-w-0 gap-5 ${domain ? "xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]" : ""}`}
          >
            <div className="min-w-0">
              <DataTable
                rows={data.items}
                rowKey={(d) => d.project_id}
                columns={[
                  {
                    key: "domain",
                    header: "Domain",
                    render: (d) => (
                      <button
                        className="mono block max-w-64 truncate text-left underline"
                        onClick={() => {
                          setSelected(d.project_id);
                          setMessage("");
                        }}
                      >
                        {d.root_domain}
                      </button>
                    ),
                  },
                  {
                    key: "owner",
                    header: "Owner",
                    render: (d) => (
                      <span className="block max-w-48 truncate">{d.owner_email ?? d.owner_id}</span>
                    ),
                  },
                  { key: "dns", header: "DNS proof", render: (d) => d.dns_proof },
                  {
                    key: "authorization",
                    header: "Authorization",
                    render: (d) => labels[d.authorization],
                  },
                  { key: "verified", header: "Verified", render: (d) => formatDate(d.verified_at) },
                  { key: "risk", header: "Risk", render: (d) => d.risk_level ?? "Not assessed" },
                ]}
              />
            </div>
            <DetailPanel
              title={domain?.root_domain ?? "Domain"}
              open={Boolean(domain)}
              onClose={() => setSelected(null)}
            >
              {domain && (
                <div className="space-y-4 break-words">
                  <p>DNS: {domain.dns_proof}</p>
                  <p>Authorization: {labels[domain.authorization]}</p>
                  {me.role === "operator" && (
                    <>
                      <ReasonForm
                        key={`${domain.project_id}-dns`}
                        label="Reason to recheck DNS"
                        submitLabel="Re-check DNS"
                        onSubmit={async (reason) => {
                          const result = await adminApi.recheck(domain.project_id, reason);
                          setMessage(
                            `${domain.root_domain}: ${result.found ? "Record found" : "Record not found"} · ${formatDate(result.checked_at)}`,
                          );
                          await qc.invalidateQueries({ queryKey: ["admin", "audit"] });
                        }}
                      />
                      {["approved", "auto_cleared"].includes(domain.authorization) && (
                        <>
                          <p>Stops queued and running scans for this domain.</p>
                          <ReasonForm
                            key={domain.project_id}
                            label="Reason for revocation"
                            submitLabel="Revoke authorization"
                            tone="danger"
                            onSubmit={async (reason) => {
                              await adminApi.revoke(domain.project_id, reason);
                              await qc.invalidateQueries({ queryKey: ["admin"] });
                              setMessage(`${domain.root_domain}: authorization revoked`);
                            }}
                          />
                        </>
                      )}
                    </>
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
