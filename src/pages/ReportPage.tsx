import { useReport } from "@/hooks/useReport";
import { useAnalysis } from "@/hooks/useAnalysis";
import { DEMO_SCAN_ID } from "@/lib/constants";
import { PageSkeleton } from "@/components/LoadingSkeleton";
import { Download, Printer } from "lucide-react";
import { useEffect } from "react";

export function ReportPage() {
  const scanId = DEMO_SCAN_ID;
  const report = useReport(scanId);
  const analysis = useAnalysis(scanId);

  useEffect(() => {
    if (!analysis.data && !analysis.isPending && !analysis.error) analysis.mutate();
  }, [analysis]);

  if (report.isLoading) return <PageSkeleton />;
  if (report.error || !report.data) return <div className="panel p-6 text-severity-critical">Failed to load report.</div>;

  const exportMarkdown = () => {
    const blob = new Blob([report.data], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attacksurface-report-${scanId}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Report</h1>
          <p className="mt-1 text-sm text-slate-400">Printable security report preview and export.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportMarkdown} className="inline-flex items-center gap-2 rounded-lg border border-border bg-panel px-3 py-2 text-sm hover:bg-white/5">
            <Download size={16} /> Export Markdown
          </button>
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-300">
            <Printer size={16} /> Export PDF
          </button>
        </div>
      </div>

      <div className="print-surface panel p-6 md:p-8">
        <div className="mb-6 border-b border-border pb-4">
          <div className="text-xs uppercase tracking-wide text-accent">AttackSurface Report</div>
          <h2 className="mt-1 text-2xl font-semibold">acme-demo.com</h2>
          {analysis.data ? <p className="mt-3 text-sm text-slate-300">{analysis.data.executive_summary}</p> : null}
        </div>
        <pre className="mono whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-200">{report.data}</pre>
      </div>
    </div>
  );
}
