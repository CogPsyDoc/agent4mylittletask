import Link from "next/link";

type Variant = "solid" | "ghost";

const base =
  "inline-flex items-center justify-center label-caps px-8 py-4 transition-colors duration-300 ease-editorial focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-charcoal";

const variants: Record<Variant, string> = {
  // Primary: solid Deep Charcoal fill.
  solid: "bg-charcoal text-on-primary hover:bg-primary-container",
  // Secondary: 1px Deep Charcoal ghost border.
  ghost: "border border-charcoal text-charcoal hover:bg-charcoal hover:text-on-primary",
};

type CommonProps = {
  variant?: Variant;
  className?: string;
  children: React.ReactNode;
};

export function ButtonLink({
  href,
  variant = "solid",
  className = "",
  children,
}: CommonProps & { href: string }) {
  return (
    <Link href={href} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </Link>
  );
}

export function Button({
  variant = "solid",
  className = "",
  children,
  type = "button",
  ...rest
}: CommonProps & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={`${base} ${variants[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
