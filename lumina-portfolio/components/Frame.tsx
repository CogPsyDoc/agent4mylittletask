/**
 * A photo frame. If `src` points to a real image (drop files in public/images/
 * and use "/images/…"), it renders that photo. Otherwise it falls back to a soft
 * tonal placeholder — no network requests — so layouts read correctly while the
 * site is still being filled in.
 */
export default function Frame({
  src,
  tone,
  ratio = "3 / 2",
  alt,
  label,
  className = "",
}: {
  src?: string;
  tone: readonly [string, string];
  ratio?: string;
  alt?: string;
  label?: string;
  className?: string;
}) {
  const hasImage = Boolean(src && src.trim());

  return (
    <div
      className={`relative w-full overflow-hidden ${className}`}
      style={{
        aspectRatio: ratio,
        backgroundImage: hasImage
          ? undefined
          : `linear-gradient(135deg, ${tone[0]} 0%, ${tone[1]} 100%)`,
      }}
      role="img"
      aria-label={alt || label || "Photograph"}
    >
      {hasImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt || label || ""}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : label ? (
        <span className="absolute bottom-3 left-3 label-caps text-on-surface-variant/70">
          {label}
        </span>
      ) : null}
    </div>
  );
}
