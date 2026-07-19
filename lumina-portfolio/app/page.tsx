import { ButtonLink } from "@/components/Button";
import ImageCard from "@/components/ImageCard";
import Frame from "@/components/Frame";
import { projects } from "@/lib/projects";
import { site } from "@/site.config";

export default function HomePage() {
  const [lead, ...rest] = projects;
  const { hero, approach } = site;

  return (
    <div className="mx-auto max-w-container px-margin-mobile lg:px-margin-desktop">
      {/* Hero — display-lg headline with generous breathing room. */}
      <section className="pt-16 md:pt-[128px] pb-16 md:pb-24">
        <p className="label-caps text-on-surface-variant">{hero.eyebrow}</p>
        <h1 className="type-display mt-6 max-w-4xl text-on-surface">
          {hero.headline}
        </h1>
        <div className="mt-10 flex flex-wrap gap-4">
          <ButtonLink href={hero.primaryCta.href} variant="solid">
            {hero.primaryCta.label}
          </ButtonLink>
          <ButtonLink href={hero.secondaryCta.href} variant="ghost">
            {hero.secondaryCta.label}
          </ButtonLink>
        </div>
      </section>

      {/* Lead work — full-bleed hero image. */}
      {lead ? (
        <section className="pb-16 md:pb-[128px]">
          <ImageCard project={lead} />
        </section>
      ) : null}

      {/* Selected work — asymmetric 12-col-inspired gallery. */}
      <section className="pb-16 md:pb-[128px]">
        <div className="flex items-baseline justify-between border-b border-outline-variant/40 pb-6">
          <h2 className="type-headline-md text-on-surface">Selected Work</h2>
          <span className="label-caps text-on-surface-variant">
            {projects.length} series
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
          <Frame src={approach.image} tone={approach.tone} ratio="4 / 5" />
        </div>
        <div className="md:col-span-6 md:col-start-7">
          <p className="label-caps text-on-surface-variant">{approach.eyebrow}</p>
          <p className="type-headline-md mt-4 text-on-surface">{approach.title}</p>
          <p className="type-body-lg mt-6">{approach.body}</p>
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
