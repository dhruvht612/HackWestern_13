export function EvidenceBlock({ evidence }: { evidence: string }) {
  return (
    <pre className="mono overflow-x-auto whitespace-pre-wrap break-words border border-ink/25 bg-bond p-4 text-[13px] leading-relaxed text-ink">
      {evidence}
    </pre>
  );
}
