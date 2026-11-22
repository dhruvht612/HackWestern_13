import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { adminApi } from "@/lib/adminApi";

export function CopilotPage() {
  const [question, setQuestion] = useState("");
  const ask = useMutation({ mutationFn: adminApi.ask });
  const result = ask.data;
  return (
    <div className="space-y-5">
      <PageHeader
        title="Admin copilot"
        description="Ask about review activity, domain claims, and security events."
      />
      <form
        className="max-w-3xl space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!ask.isPending && question.trim().length >= 5) ask.mutate(question.trim());
        }}
      >
        <label htmlFor="copilot-question" className="field-label block">
          Question
        </label>
        <textarea
          id="copilot-question"
          className="field"
          value={question}
          maxLength={600}
          rows={4}
          onChange={(event) => setQuestion(event.target.value)}
        />
        <button className="btn-primary" disabled={ask.isPending || question.trim().length < 5}>
          {ask.isPending ? "Getting an answer…" : "Ask copilot"}
        </button>
      </form>
      {ask.error && <p role="alert">{ask.error.message}</p>}
      {result && (
        <section
          className="max-w-3xl space-y-4 break-words border border-silver/30 p-4"
          aria-label="Copilot answer"
          aria-live="polite"
        >
          <p className="whitespace-pre-wrap">{result.answer}</p>
          {result.stats && (
            <dl className="grid gap-2 sm:grid-cols-2">
              {Object.entries(result.stats).map(([label, value]) => (
                <div key={label}>
                  <dt>{label.replaceAll("_", " ")}</dt>
                  <dd className="mono">{value ?? "—"}</dd>
                </div>
              ))}
            </dl>
          )}
          <h2 className="font-semibold">Sources</h2>
          <ul className="mono text-sm">
            {result.references.map((ref) => (
              <li key={ref}>{ref}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
