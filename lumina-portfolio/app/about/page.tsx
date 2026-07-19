import type { Metadata } from "next";
import { ButtonLink } from "@/components/Button";
import Placeholder from "@/components/Placeholder";
import Chip from "@/components/Chip";

export const metadata: Metadata = {
  title: "About the Artist",
  description:
    "The story and practice behind Lumina — a fine-art and editorial photographer.",
};

const exhibitions = [
  { year: "2025", title: "Urban Silence", venue: "Galeria Foco, Lisbon" },
  { year: "2024", title: "Salt & Light", venue: "Nordlys, Copenhagen" },
  { year: "2024", title: "In Camera", venue: "Kunsthaus Atelier, Berlin" },
  { year: "2023", title: "Field Notes", venue: "Fotografiska, Stockholm" },
];

const clients = ["Kinfolk", "Aesop", "Cereal", "Monocle", "The Gentlewoman", "Apartamento"];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-container px-margin-mobile lg:px-margin-desktop">
      {/* Header */}
      <section className="pt-16 md:pt-[128px] grid grid-cols-1 gap-12 md:grid-cols-12">
        <div className="md:col-span-7">
          <p className="label-caps text-on-surface-variant">About the artist</p>
          <h1 className="type-display mt-6 text-on-surface">
            I photograph the quiet that a place keeps to itself.
          </h1>
          <p className="type-body-lg mt-8 max-w-xl">
            Lumina is the studio practice of a photographer working between
            fine-art series and editorial commissions. The work is unhurried and
            intentional — built on the belief that restraint is what makes an
            image worth returning to.
          </p>
        </div>
        <div className="md:col-span-4 md:col-start-9">
          <Placeholder tone={["#e8e8e8", "#c8c6c5"]} ratio="4 / 5" />
        </div>
      </section>

      {/* Statement */}
      <section className="section grid grid-cols-1 gap-12 md:grid-cols-12">
        <div className="md:col-span-3">
          <h2 className="type-headline-sm text-on-surface">Practice</h2>
        </div>
        <div className="md:col-span-8 md:col-start-5 space-y-6">
          <p className="type-body-lg">
            My process starts with walking. I return to the same places at the
            edges of the day, when the light is diffuse and the streets are
            emptied of intent. Only then does a composition reveal itself.
          </p>
          <p className="type-body-lg">
            Everything is shot on film and printed in a darkroom. The constraint
            is deliberate: one exposure asks both the photographer and the subject
            to be fully present, and the grain keeps the image honest.
          </p>
        </div>
      </section>

      {/* Exhibitions — unstyled list, generous padding, thin dividers. */}
      <section className="section grid grid-cols-1 gap-12 md:grid-cols-12">
        <div className="md:col-span-3">
          <h2 className="type-headline-sm text-on-surface">Selected Exhibitions</h2>
        </div>
        <ul className="md:col-span-8 md:col-start-5">
          {exhibitions.map((e) => (
            <li
              key={e.title}
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
        <p className="label-caps text-on-surface-variant">Selected clients</p>
        <div className="mt-6 flex flex-wrap gap-3">
          {clients.map((c) => (
            <Chip key={c}>{c}</Chip>
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
