export function EvidenceBlock({ evidence }: { evidence: string }) {
  return (
    <pre className="mono overflow-x-auto rounded-lg border border-border bg-background/80 p-4 text-xs leading-relaxed text-cyan-100 whitespace-pre-wrap break-words">
      {evidence}
    </pre>
  );
}
