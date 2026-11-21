import { Bot, ShieldCheck } from "lucide-react";
import type { AnalysisFinding } from "@/lib/types";

export function AIAnalystCard({ analysis }: { analysis?: AnalysisFinding | null }) {
  if (!analysis) {
    return (
      <div className="panel p-5">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
          <Bot size={16} className="text-accent" /> AI Analyst
        </div>
        <p className="mt-3 text-sm text-slate-400">
          Select a finding to view AI-generated context, business impact, and remediation guidance.
        </p>
      </div>
    );
  }

  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
          <Bot size={16} className="text-accent" /> AI Analyst
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-400">
          <ShieldCheck size={14} /> Confidence: {analysis.confidence}
        </div>
      </div>
      <div className="mt-4 space-y-3 text-sm">
        <div>
          <div className="text-slate-400">Summary</div>
          <p className="mt-1 text-slate-200">{analysis.summary}</p>
        </div>
        <div>
          <div className="text-slate-400">Why it matters</div>
          <p className="mt-1 text-slate-200">{analysis.why_it_matters}</p>
        </div>
        <div>
          <div className="text-slate-400">Business impact</div>
          <p className="mt-1 text-slate-200">{analysis.business_impact}</p>
        </div>
        <div>
          <div className="text-slate-400">Remediation</div>
          <p className="mt-1 text-slate-200">{analysis.remediation}</p>
        </div>
        <div className="flex flex-wrap gap-2 pt-1 text-xs">
          <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-1 text-accent">
            Priority: {analysis.suggested_priority}
          </span>
          {analysis.evidence_refs.map((ref) => (
            <span key={ref} className="mono rounded-full border border-border bg-background/60 px-2 py-1 text-slate-300">
              {ref}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
