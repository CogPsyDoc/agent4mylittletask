import Link from "next/link";

const social = [
  { href: "https://instagram.com", label: "Instagram" },
  { href: "https://vsco.co", label: "VSCO" },
  { href: "mailto:studio@lumina.photo", label: "Email" },
];

export default function Footer() {
  return (
    <footer className="border-t border-outline-variant/40 mt-16 md:mt-[128px]">
      <div className="mx-auto max-w-container px-margin-mobile lg:px-margin-desktop py-16">
        <div className="flex flex-col gap-10 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-display text-headline-md text-on-surface">Lumina</p>
            <p className="type-body-md mt-3 max-w-sm">
              A quiet gallery frame for high-end photography. Available for
              commissions and exhibition worldwide.
            </p>
          </div>
          <nav className="flex gap-8">
            {social.map((s) => (
              <Link
                key={s.label}
                href={s.href}
                className="label-caps text-on-surface-variant hover:text-on-surface transition-colors"
              >
                {s.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="mt-12 flex flex-col gap-2 md:flex-row md:justify-between label-caps text-on-surface-variant/70">
          <span>© {new Date().getFullYear()} Lumina Studio</span>
          <span>Design system · Ethereal Frame</span>
        </div>
      </div>
    </footer>
  );
}
