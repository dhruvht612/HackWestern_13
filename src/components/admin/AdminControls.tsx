import { useId } from "react";

export function AdminFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="min-w-40">
      <label className="field-label block" htmlFor={id}>
        {label}
      </label>
      <select id={id} className="field" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function AdminNotice({ message }: { message: string }) {
  return (
    <p role="status" className="min-h-5 text-sm text-kiwi">
      {message}
    </p>
  );
}
