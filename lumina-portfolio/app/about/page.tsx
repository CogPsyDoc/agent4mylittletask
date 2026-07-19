import type { Metadata } from "next";
import { ButtonLink } from "@/components/Button";
import Frame from "@/components/Frame";
import Chip from "@/components/Chip";
import { site } from "@/site.config";

const { about } = site;

export const metadata: Metadata = {
  title: "About the Artist",
  description: about.intro,
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-container px-margin-mobile lg:px-margin-desktop">
      {/* Header */}
      <section className="pt-16 md:pt-[128px] grid grid-cols-1 gap-12 md:grid-cols-12">
        <div className="md:col-span-7">
          <p className="label-caps text-on-surface-variant">{about.eyebrow}</p>
          <h1 className="type-display mt-6 text-on-surface">{about.headline}</h1>
          <p className="type-body-lg mt-8 max-w-xl">{about.intro}</p>
        </div>
        <div className="md:col-span-4 md:col-start-9">
          <Frame src={about.portrait} tone={about.portraitTone} ratio="4 / 5" />
        </div>
      </section>

      {/* Statement */}
      <section className="section grid grid-cols-1 gap-12 md:grid-cols-12">
        <div className="md:col-span-3">
          <h2 className="type-headline-sm text-on-surface">{about.practiceTitle}</h2>
        </div>
        <div className="md:col-span-8 md:col-start-5 space-y-6">
          {about.practice.map((para, i) => (
            <p key={i} className="type-body-lg">
              {para}
            </p>
          ))}
        </div>
      </section>

      {/* Exhibitions — unstyled list, generous padding, thin dividers. */}
      <section className="section grid grid-cols-1 gap-12 md:grid-cols-12">
        <div className="md:col-span-3">
          <h2 className="type-headline-sm text-on-surface">
            {about.exhibitionsTitle}
          </h2>
        </div>
        <ul className="md:col-span-8 md:col-start-5">
          {about.exhibitions.map((e, i) => (
            <li
              key={i}
              className="flex flex-col gap-1 border-t border-outline-variant/40 py-6 first:border-t-0 md:flex-row md:items-baseline md:justify-between"
            >
              <span className="type-headline-sm text-on-surface">{e.title}</span>
              <span className="type-body-md md:text-right">
                {e.venue}
                <span className="label-caps text-on-surface-variant ml-4">
                  {e.year}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Clients */}
      <section className="section">
        <p className="label-caps text-on-surface-variant">{about.clientsTitle}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          {about.clients.map((c, i) => (
            <Chip key={i}>{c}</Chip>
          ))}
        </div>
        <div className="mt-12">
          <ButtonLink href="/contact" variant="solid">
            Work together
          </ButtonLink>
        </div>
      </section>
    </div>
  );
}
