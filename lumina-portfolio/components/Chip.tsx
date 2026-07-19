/** Small label-caps tag with a 1px slate border and no background fill. */
export default function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center label-caps text-on-surface-variant border border-outline-variant px-3 py-1.5">
      {children}
    </span>
  );
}
