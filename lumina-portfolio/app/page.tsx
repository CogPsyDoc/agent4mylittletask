import { ButtonLink } from "@/components/Button";
import ImageCard from "@/components/ImageCard";
import Placeholder from "@/components/Placeholder";
import { projects } from "@/lib/projects";

export default function HomePage() {
  const [lead, ...rest] = projects;

  return (
    <div className="mx-auto max-w-container px-margin-mobile lg:px-margin-desktop">
      {/* Hero — display-lg headline with generous breathing room. */}
      <section className="pt-16 md:pt-[128px] pb-16 md:pb-24">
        <p className="label-caps text-on-surface-variant">
          Fine-art & editorial photography
        </p>
        <h1 className="type-display mt-6 max-w-4xl text-on-surface">
          Light, held still — a curated frame for high-end imagery.
        </h1>
        <div className="mt-10 flex flex-wrap gap-4">
          <ButtonLink href="/work/urban-silence" variant="solid">
            View latest series
          </ButtonLink>
          <ButtonLink href="/contact" variant="ghost">
            Commission a shoot
          </ButtonLink>
        </div>
      </section>

      {/* Lead work — full-bleed hero image. */}
      <section className="pb-16 md:pb-[128px]">
        <ImageCard project={lead} />
      </section>

      {/* Selected work — asymmetric 12-col-inspired gallery. */}
      <section className="pb-16 md:pb-[128px]">
        <div className="flex items-baseline justify-between border-b border-outline-variant/40 pb-6">
          <h2 className="type-headline-md text-on-surface">Selected Work</h2>
          <span className="label-caps text-on-surface-variant">
            {rest.length + 1} series
          </span>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-x-gutter gap-y-16 md:grid-cols-2">
          {rest.map((project, i) => (
            <div key={project.slug} className={i % 2 === 1 ? "md:mt-24" : ""}>
              <ImageCard project={project} />
            </div>
          ))}
        </div>
      </section>

      {/* Editorial band. */}
      <section className="section grid grid-cols-1 gap-12 md:grid-cols-12 md:items-center">
        <div className="md:col-span-5">
          <Placeholder tone={["#e8e8e8", "#c8c6c5"]} ratio="4 / 5" />
        </div>
        <div className="md:col-span-6 md:col-start-7">
          <p className="label-caps text-on-surface-variant">The approach</p>
          <p className="type-headline-md mt-4 text-on-surface">
            Every frame is composed to hold a single breath.
          </p>
          <p className="type-body-lg mt-6">
            Working in long tonal ranges and deliberate negative space, Lumina
            treats the photograph as an object — something to be lived with, not
            scrolled past.
          </p>
          <div className="mt-8">
            <ButtonLink href="/about" variant="ghost">
              About the artist
            </ButtonLink>
          </div>
        </div>
      </section>
    </div>
  );
}
