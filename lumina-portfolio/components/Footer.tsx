import Link from "next/link";
import { site } from "@/site.config";

export default function Footer() {
  return (
    <footer className="border-t border-outline-variant/40 mt-16 md:mt-[128px]">
      <div className="mx-auto max-w-container px-margin-mobile lg:px-margin-desktop py-16">
        <div className="flex flex-col gap-10 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-display text-headline-md text-on-surface">
              {site.brand}
            </p>
            <p className="type-body-md mt-3 max-w-sm">{site.tagline}</p>
          </div>
          <nav className="flex flex-wrap gap-8">
            {site.socials.map((s) => (
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
          <span>
            © {new Date().getFullYear()} {site.brand}
          </span>
          <span>Design system · Ethereal Frame</span>
        </div>
      </div>
    </footer>
  );
}
