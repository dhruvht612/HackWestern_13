export function EvidenceBlock({ evidence }: { evidence: string }) {
  return (
    <pre className="mono overflow-x-auto whitespace-pre-wrap break-words border border-silver/25 bg-ink-raised p-4 text-[13px] leading-relaxed text-fg">
      {evidence}
    </pre>
  );
}
