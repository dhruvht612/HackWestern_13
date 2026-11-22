import { useQuery } from "@tanstack/react-query";
import { AdminState } from "@/components/admin/AdminState";
import { DataTable } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";
import { adminApi } from "@/lib/adminApi";

export function AiOperationsPage() {
  const query = useQuery({ queryKey: ["admin", "ai", "metrics"], queryFn: adminApi.aiMetrics });
  return (
    <div className="space-y-5">
      <PageHeader
        title="Gemini operations"
        description="AI activity and fallback performance over the last 30 days."
      />
      <AdminState query={query}>
        {(data) => (
          <div className="min-w-0 space-y-4">
            <p>
              Model: {data.active_model ?? "Gemini is not configured"} · Review prompt:{" "}
              {data.prompt_version}
            </p>
            {data.purposes.length ? (
              <DataTable
                rows={data.purposes}
                rowKey={(row) => row.purpose}
                columns={[
                  {
                    key: "purpose",
                    header: "Purpose",
                    render: (r) => r.purpose.replaceAll("_", " "),
                  },
                  { key: "runs", header: "Requests", render: (r) => r.requests },
                  {
                    key: "fallback",
                    header: "Fallbacks",
                    render: (r) =>
                      `${r.fallbacks} (${Math.round((r.fallbacks * 100) / r.requests)}%)`,
                  },
                  {
                    key: "tokens",
                    header: "Input / output tokens",
                    render: (r) => `${r.input_tokens ?? "—"} / ${r.output_tokens ?? "—"}`,
                  },
                  {
                    key: "latency",
                    header: "Median / p95 (ms)",
                    render: (r) => `${r.p50_ms ?? "—"} / ${r.p95_ms ?? "—"}`,
                  },
                  {
                    key: "cost",
                    header: "Estimated cost",
                    render: (r) =>
                      r.estimated_cost === null ? "—" : `$${r.estimated_cost.toFixed(4)}`,
                  },
                ]}
              />
            ) : (
              <p>No AI runs recorded.</p>
            )}
            <p>Review refresh requests: {data.reanalyses}</p>
            <h2 className="font-semibold">Errors by category</h2>
            {data.errors.length ? (
              <ul>
                {data.errors.map((error) => (
                  <li key={error.category}>
                    {error.category.replaceAll("_", " ")} · {error.count}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No errors recorded.</p>
            )}
          </div>
        )}
      </AdminState>
    </div>
  );
}
