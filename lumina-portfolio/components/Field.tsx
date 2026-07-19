/**
 * Bottom-border-only input to mimic high-end stationery, with a small
 * label positioned above the line (per the design system input spec).
 */
export function Field({
  label,
  name,
  type = "text",
  placeholder,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="label-caps text-on-surface-variant">{label}</span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        className="mt-2 w-full bg-transparent border-0 border-b border-charcoal py-3 text-body-md text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-gold transition-colors"
      />
    </label>
  );
}

export function TextArea({
  label,
  name,
  placeholder,
  required,
  rows = 4,
}: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="label-caps text-on-surface-variant">{label}</span>
      <textarea
        name={name}
        rows={rows}
        placeholder={placeholder}
        required={required}
        className="mt-2 w-full resize-none bg-transparent border-0 border-b border-charcoal py-3 text-body-md text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-gold transition-colors"
      />
    </label>
  );
}
