export function EvidenceBlock({ evidence }: { evidence: string }) {
  return (
    <pre className="mono overflow-x-auto whitespace-pre-wrap break-words border border-camel/25 bg-navy-raised p-4 text-[13px] leading-relaxed text-fg">
      {evidence}
    </pre>
  );
}
