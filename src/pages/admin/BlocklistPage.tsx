import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { DetailPanel } from "@/components/DetailPanel";
import { AdminState } from "@/components/admin/AdminState";
import { AdminNotice } from "@/components/admin/AdminControls";
import { ReasonForm } from "@/components/admin/ReasonForm";
import { adminApi } from "@/lib/adminApi";
import { useAdminList } from "@/lib/adminQueries";
import { useAdmin } from "@/lib/adminSession";
import { formatDate } from "@/lib/utils";

export function BlocklistPage() {
  const me = useAdmin();
  const qc = useQueryClient();
  const [pattern, setPattern] = useState("");
  const [match, setMatch] = useState<"exact" | "suffix">("exact");
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [adding, setAdding] = useState(false);
  const query = useAdminList(["admin", "blocklist"], adminApi.blocklist);
  return (
    <div className="space-y-5">
      <PageHeader
        title="Blocklist"
        description="Domain patterns that cannot be claimed or scanned."
      />
      <AdminNotice message={message} />
      <AdminState query={query}>
        {(data) => (
          <div
            className={`grid min-w-0 gap-5 ${selected ? "xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]" : ""}`}
          >
            <div className="min-w-0">
              {data.items.length ? (
                <DataTable
                  rows={data.items}
                  rowKey={(b) => b.pattern}
                  columns={[
                    {
                      key: "pattern",
                      header: "Pattern",
                      render: (b) => (
                        <span className="mono block max-w-64 truncate">{b.pattern}</span>
                      ),
                    },
                    { key: "match", header: "Match", render: (b) => b.match },
                    {
                      key: "reason",
                      header: "Reason",
                      render: (b) => <p className="min-w-40 max-w-80 break-words">{b.reason}</p>,
                    },
                    { key: "created", header: "Added", render: (b) => formatDate(b.created_at) },
                    ...(me.role === "operator"
                      ? [
                          {
                            key: "remove",
                            header: "Action",
                            render: (b: { pattern: string }) => (
                              <button
                                className="btn-danger py-1 text-sm"
                                aria-label={`Remove ${b.pattern}`}
                                onClick={() => setSelected(b.pattern)}
                              >
                                Remove
                              </button>
                            ),
                          },
                        ]
                      : []),
                  ]}
                />
              ) : (
                <p>No blocked patterns.</p>
              )}
            </div>
            <DetailPanel
              title={selected ?? "Remove pattern"}
              open={Boolean(selected) && me.role === "operator"}
              onClose={() => setSelected(null)}
            >
              <ReasonForm
                key={selected}
                label="Reason for removal"
                submitLabel="Remove pattern"
                tone="danger"
                onSubmit={async (reason) => {
                  if (!selected) return;
                  await adminApi.removeBlock(selected, reason);
                  await qc.invalidateQueries({ queryKey: ["admin"] });
                  setMessage(`${selected} removed`);
                  setSelected(null);
                }}
              />
            </DetailPanel>
          </div>
        )}
      </AdminState>
      {me.role === "operator" && (
        <section className="max-w-2xl space-y-4 border-t-2 border-camel pt-5">
          <h2 className="text-xl font-semibold">Add pattern</h2>
          <fieldset disabled={adding} className="min-w-0 space-y-4">
            <label className="block">
              <span className="field-label block">Domain pattern</span>
              <input
                className="field"
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                placeholder="example.test"
              />
            </label>
            <fieldset className="min-w-0">
              <legend className="field-label">Match rule</legend>
              <div className="flex gap-5">
                {(["exact", "suffix"] as const).map((value) => (
                  <label key={value} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="match"
                      value={value}
                      checked={match === value}
                      onChange={() => setMatch(value)}
                    />
                    {value}
                  </label>
                ))}
              </div>
              <p className="mt-2 text-sm text-fg-soft">
                Exact blocks only this domain. Suffix blocks the domain and every subdomain; never
                partial words.
              </p>
            </fieldset>
            <ReasonForm
              label="Reason for blocking"
              submitLabel="Add pattern"
              onSubmit={async (reason) => {
                if (!pattern.trim()) throw new Error("Enter a domain pattern.");
                setAdding(true);
                try {
                  const entry = await adminApi.addBlock(pattern.trim(), match, reason);
                  await qc.invalidateQueries({ queryKey: ["admin"] });
                  setMessage(`${entry.pattern} blocked`);
                  setPattern("");
                } finally {
                  setAdding(false);
                }
              }}
            />
          </fieldset>
        </section>
      )}
    </div>
  );
}
