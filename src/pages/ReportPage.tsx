import { useMemo } from "react";
import { Download, Printer } from "lucide-react";
import { useReport } from "@/hooks/useReport";
import { DEMO_SCAN_ID } from "@/lib/constants";
import { PageSkeleton } from "@/components/LoadingSkeleton";
import { PageHeader } from "@/components/PageHeader";
import { ClassificationBand } from "@/components/ClassificationBand";
import { SeverityBadge } from "@/components/SeverityBadge";
import { Stamp } from "@/components/Stamp";
import { parseMarkdown, splitBold, type Block } from "@/lib/markdownBlocks";
import { severityOrder } from "@/lib/severity";
import type { Severity } from "@/lib/types";

function Inline({ text }: { text: string }) {
  return (
    <>
      {splitBold(text).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part))}
    </>
  );
}

function Cell({ value, first }: { value: string; first: boolean }) {
  const sev = value.toLowerCase() as Severity;
  if (severityOrder.includes(sev)) return <SeverityBadge severity={sev} />;
  return <span className={first ? "mono font-bold" : undefined}><Inline text={value} /></span>;
}

function DocBlock({ block }: { block: Block }) {
  switch (block.kind) {
    case "h1":
      return null; // rendered as the document title
    case "h2":
      return (
        <h2 className="mt-9 border-b border-ink pb-1 font-display text-[15px] font-extrabold uppercase tracking-[0.14em]" style={{ fontStretch: "85%" }}>
          {block.text}
        </h2>
      );
    case "fields":
      return (
        <dl className="mono mt-3 grid grid-cols-[7rem_minmax(0,1fr)] gap-y-1 text-[13.5px]">
          {block.rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="uppercase text-ink-soft">{k}</dt>
              <dd className="break-all">{v}</dd>
            </div>
          ))}
        </dl>
      );
    case "p":
      return (
        <p className="mt-3 max-w-[70ch] text-[15px] leading-relaxed">
          <Inline text={block.text} />
        </p>
      );
    case "ol":
      return (
        <ol className="mt-2 max-w-[70ch] list-decimal space-y-1 pl-6 text-[15px] leading-relaxed marker:font-mono marker:font-bold">
          {block.items.map((item) => (
            <li key={item}>
              <Inline text={item} />
            </li>
          ))}
        </ol>
      );
    case "table":
      return (
        <div className="mt-3 overflow-x-auto">
          <table className="tabular min-w-full text-[13.5px]">
            <thead>
              <tr className="ledger-head">
                {block.head.map((h) => (
                  <th key={h} scope="col" className="whitespace-nowrap px-2 py-2 first:pl-0">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/15">
              {block.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((c, i) => (
                    <td key={i} className="px-2 py-2 align-top first:pl-0">
                      <Cell value={c} first={i === 0} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

export function ReportPage() {
  const scanId = DEMO_SCAN_ID;
  const report = useReport(scanId);
  const blocks = useMemo(() => (report.data ? parseMarkdown(report.data) : []), [report.data]);

  if (report.isLoading) return <PageSkeleton />;
  if (report.error || !report.data)
    return (
      <div className="border-2 border-severity-critical p-6 text-sm">
        <div className="font-semibold">Couldn’t load the report.</div>
        <p className="mt-1 text-ink-soft">Reload the page to try again.</p>
      </div>
    );

  const exportMarkdown = () => {
    const blob = new Blob([report.data], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attacksurface-report-${scanId}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const title = blocks.find((b) => b.kind === "h1");

  return (
    <div className="space-y-6">
      <div className="no-print">
        <PageHeader
          title="Report"
          description="The full file, ready to print or hand off."
          actions={
            <>
              <button onClick={exportMarkdown} className="btn-secondary py-2">
                <Download size={16} aria-hidden="true" /> Export Markdown
              </button>
              <button onClick={() => window.print()} className="btn-primary py-2">
                <Printer size={16} aria-hidden="true" /> Print or save PDF
              </button>
            </>
          }
        />
      </div>

      <article className="print-surface mx-auto max-w-[58rem] border border-ink/25 bg-bond">
        <ClassificationBand>Potential exposure // Validate before action</ClassificationBand>
        <div className="relative px-6 py-9 md:px-12 md:py-12">
          <Stamp lines={["Filed", `AS-${scanId.slice(0, 8)}`]} tone="ink" rotate={-5} className="absolute right-4 top-5 w-32 md:right-10 md:top-8 md:w-40" />
          {/* "AttackSurface Report — acme-demo.com": the subject goes on its own unbreakable mono line */}
          <h1 className="pr-28 md:pr-44">
            <span className="display block text-[2.4rem] font-extrabold uppercase leading-none">
              {(title?.kind === "h1" ? title.text : "AttackSurface report").split(" — ")[0]}
            </span>
            {title?.kind === "h1" && title.text.includes(" — ") ? (
              <span className="mono mt-2 block whitespace-nowrap text-[1.05rem] font-bold">SUBJECT: {title.text.split(" — ")[1]}</span>
            ) : null}
          </h1>
          <div className="mt-6 border-t-2 border-ink pt-1">
            {blocks.map((b, i) => (
              <DocBlock key={i} block={b} />
            ))}
          </div>
        </div>
        <ClassificationBand>Potential exposure // Validate before action</ClassificationBand>
      </article>
    </div>
  );
}
