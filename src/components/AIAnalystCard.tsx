import type { AnalysisFinding } from "@/lib/types";

/** The analyst's memo on one finding, in the form a memo actually takes. */
export function AIAnalystCard({ analysis }: { analysis?: AnalysisFinding | null }) {
  if (!analysis) {
    return (
      <div className="border border-dashed border-camel/35 p-5 text-sm text-fg-soft">
        No analyst memo on file for this finding. Memos are written for the highest-priority findings first.
      </div>
    );
  }

  const memo: [string, string][] = [
    ["Summary", analysis.summary],
    ["Why it matters", analysis.why_it_matters],
    ["Business impact", analysis.business_impact],
    ["Remediation", analysis.remediation],
  ];

  return (
    <div className="border border-camel/25">
      <dl className="mono grid grid-cols-[4.5rem_1fr] gap-x-3 gap-y-1 border-b border-camel/20 px-5 py-3 text-[13px]">
        <dt className="text-camel">FROM:</dt>
        <dd>AI analyst (Gemini)</dd>
        <dt className="text-camel">RE:</dt>
        <dd className="flex flex-wrap items-center gap-2">
          <span className={analysis.suggested_priority === "P0" ? "bg-kiwi px-1.5 font-bold text-navy" : "border border-camel px-1.5 font-bold"}>
            {analysis.suggested_priority}
          </span>
          <span>confidence {analysis.confidence}</span>
        </dd>
      </dl>
      <div className="space-y-3 px-5 py-4 text-sm">
        {memo.map(([label, body]) => (
          <div key={label}>
            <div className="field-label">{label}</div>
            <p className="mt-1 leading-relaxed text-fg">{body}</p>
          </div>
        ))}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {analysis.evidence_refs.map((ref) => (
            <span key={ref} className="mono border border-camel/25 px-1.5 py-0.5 text-[13px] text-fg-soft">
              {ref}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
