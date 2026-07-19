"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { site } from "@/site.config";

const links = [
  { href: "/", label: "Work" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/" || pathname.startsWith("/work");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-sm border-b border-outline-variant/40">
      <div className="mx-auto max-w-container px-margin-mobile lg:px-margin-desktop">
        <div className="flex h-20 items-center justify-between">
          <Link
            href="/"
            className="font-display text-headline-sm tracking-tight text-on-surface"
            onClick={() => setOpen(false)}
          >
            {site.brand}
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-10">
            {links.map((link) => {
              const active = isActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`label-caps pb-1 border-b transition-colors duration-300 ${
                    active
                      ? "border-gold text-on-surface"
                      : "border-transparent text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Mobile toggle */}
          <button
            type="button"
            className="md:hidden label-caps text-on-surface"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Close" : "Menu"}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {open ? (
        <nav
          id="mobile-nav"
          className="md:hidden border-t border-outline-variant/40 bg-background"
        >
          <div className="mx-auto max-w-container px-margin-mobile py-4 flex flex-col">
            {links.map((link) => {
              const active = isActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={`label-caps py-4 border-b border-outline-variant/40 ${
                    active ? "text-gold" : "text-on-surface"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </nav>
      ) : null}
    </header>
  );
}
