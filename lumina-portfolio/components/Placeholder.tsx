/**
 * Tonal placeholder standing in for real photography.
 *
 * The source design leads with full-bleed imagery; until real photos are wired
 * in, we render a soft diagonal gradient between two design-system surface tones
 * so the compositions read correctly. No network requests — fully self-contained.
 */
export default function Placeholder({
  tone,
  ratio = "3 / 2",
  label,
  className = "",
}: {
  tone: [string, string];
  ratio?: string;
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={`relative w-full overflow-hidden ${className}`}
      style={{
        aspectRatio: ratio,
        backgroundImage: `linear-gradient(135deg, ${tone[0]} 0%, ${tone[1]} 100%)`,
      }}
      role="img"
      aria-label={label ? `Photograph: ${label}` : "Photograph placeholder"}
    >
      {label ? (
        <span className="absolute bottom-3 left-3 label-caps text-on-surface-variant/70">
          {label}
        </span>
      ) : null}
    </div>
  );
}
