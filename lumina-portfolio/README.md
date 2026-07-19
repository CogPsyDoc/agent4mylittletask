# Lumina — Photography Portfolio (Next.js)

A minimalist-editorial photography portfolio, built as a **React / Next.js
conversion of a Google Stitch design**.

- **Source Stitch project:** `모던 포토 포트폴리오` (Lumina Photography Portfolio)
- **Design system:** `Ethereal Frame` — minimalist-editorial, "a quiet gallery
  frame for high-end photography"
- **Stack:** Next.js 14 (App Router) · React 18 · TypeScript · Tailwind CSS

## Quick start

```bash
cd lumina-portfolio
npm install
npm run dev      # http://localhost:3000
```

```bash
npm run build && npm start   # production
```

## What was converted

The Stitch project ships these screens (desktop + responsive mobile variants):

| Stitch screen              | Route in this app          |
| -------------------------- | -------------------------- |
| Home — Gallery             | `/`                        |
| About the Artist           | `/about`                   |
| Contact                    | `/contact`                 |
| Project Detail             | `/work/[slug]`             |

Every design token below is the **exact value** exported from the Stitch design
system theme (see `tailwind.config.ts`):

- **Colors** — full `Ethereal Frame` named-color palette (surface tones,
  charcoal primary, gold secondary, slate outlines).
- **Typography** — Playfair Display for display/headlines, Inter for body/labels,
  with the exact scale (`display-lg` 64px, `headline-md` 32px, `label-caps` 12px
  / 0.1em tracking, etc.). Mapped to helper classes in `app/globals.css`.
- **Spacing** — 8px base, 32px gutter, 64px desktop / 24px mobile framing
  margins, 128px section gaps, 1440px container.
- **Components** — ghost/solid buttons, image cards with the diffused hover
  "lift" shadow, bottom-border-only inputs, slate-bordered chips, divided lists —
  all per the design system's component spec.

## Important: how faithful this is

This is a conversion built from the Stitch **design system + screen inventory**,
not a line-for-line transpile of the generated HTML.

The raw per-screen HTML that Stitch generates, and the screen screenshots, are
served only from Google user-content hosts (`contribution.usercontent.google.com`
and `lh3.googleusercontent.com`). In the environment where this was built, those
hosts are blocked by the outbound egress policy (HTTP 403), so the exact HTML
could not be downloaded. The design system theme, style guidelines, and screen
list *were* retrievable (they come from `stitch.googleapis.com` directly), and
this implementation is built faithfully from them.

To regenerate a 1:1 transpile from the original HTML, run in an environment that
allows those hosts, or export the code from the Stitch web UI and drop it in.

## Placeholder imagery

Real photographs aren't part of the export, so galleries render soft tonal
placeholders (`components/Placeholder.tsx`) using the design-system surface
tones — no network requests. Swap `Placeholder` for `next/image` and real URLs
to go live. Sample content lives in `lib/projects.ts`.

## Structure

```
app/
  layout.tsx            root layout · fonts · Nav + Footer
  page.tsx              Home / Gallery
  about/page.tsx        About the Artist
  contact/page.tsx      Contact (client form)
  work/[slug]/page.tsx  Project Detail (SSG per project)
  not-found.tsx         404
components/              Nav, Footer, Button, ImageCard, Placeholder, Chip, Field
lib/projects.ts         sample portfolio content
tailwind.config.ts      Ethereal Frame design tokens
```
