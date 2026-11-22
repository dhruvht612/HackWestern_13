import { useId, useState } from "react";
import type { FormEvent } from "react";
import { cn } from "@/lib/utils";

const MIN = 5;
const MAX = 500;

/** Every admin action needs a written reason; it goes into the audit log next to the change. */
export function ReasonForm({
  label,
  submitLabel,
  tone = "primary",
  placeholder,
  onSubmit,
}: {
  label: string;
  submitLabel: string;
  tone?: "primary" | "danger";
  placeholder?: string;
  onSubmit: (reason: string) => Promise<void>;
}) {
  const id = useId();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const valid = reason.trim().length >= MIN;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid || pending) return;
    setError(null);
    setPending(true);
    try {
      await onSubmit(reason.trim());
      setReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-2">
      <label htmlFor={id} className="field-label block">
        {label}
      </label>
      <textarea
        id={id}
        rows={2}
        maxLength={MAX}
        className="field resize-y text-sm"
        placeholder={placeholder}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        aria-describedby={`${id}-hint`}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span id={`${id}-hint`} className="text-[13px] text-fg-faint">
          Logged with your name. At least {MIN} characters.
        </span>
        <button
          type="submit"
          disabled={!valid || pending}
          className={cn("py-1.5 text-sm", tone === "danger" ? "btn-danger" : "btn-primary")}
        >
          {pending ? "Working…" : submitLabel}
        </button>
      </div>
      {error ? (
        <p role="alert" className="border-2 border-severity-critical p-2 text-sm">
          {error}
        </p>
      ) : null}
    </form>
  );
}
