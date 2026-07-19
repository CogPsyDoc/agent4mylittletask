import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/Button";
import Frame from "@/components/Frame";
import Chip from "@/components/Chip";
import { getProject, projects } from "@/lib/projects";

export function generateStaticParams() {
  return projects.map((p) => ({ slug: p.slug }));
}

export function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Metadata {
  const project = getProject(params.slug);
  if (!project) return { title: "Not found" };
  return {
    title: project.title,
    description: project.summary,
  };
}

export default function ProjectDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const project = getProject(params.slug);
  if (!project) notFound();

  const next =
    projects[(projects.findIndex((p) => p.slug === project.slug) + 1) % projects.length];

  return (
    <article className="mx-auto max-w-container px-margin-mobile lg:px-margin-desktop">
      {/* Title block */}
      <header className="pt-16 md:pt-[128px] grid grid-cols-1 gap-8 md:grid-cols-12">
        <div className="md:col-span-8">
          <div className="flex flex-wrap gap-3">
            <Chip>{project.category}</Chip>
            <Chip>{project.year}</Chip>
            <Chip>{project.location}</Chip>
          </div>
          <h1 className="type-display mt-8 text-on-surface">{project.title}</h1>
          <p className="type-body-lg mt-6 max-w-2xl">{project.summary}</p>
        </div>
      </header>

      {/* Hero frame — full-bleed within the framing margins. */}
      <section className="mt-12 md:mt-20">
        <Frame
          src={project.cover}
          tone={project.tone}
          ratio={project.coverRatio}
          alt={project.title}
        />
      </section>

      {/* Artist statement */}
      <section className="section grid grid-cols-1 gap-12 md:grid-cols-12">
        <div className="md:col-span-3">
          <h2 className="type-headline-sm text-on-surface">Statement</h2>
        </div>
        <div className="md:col-span-8 md:col-start-5 space-y-6">
          {project.statement.map((para, i) => (
            <p key={i} className="type-body-lg">
              {para}
            </p>
          ))}
        </div>
      </section>

      {/* Sequenced frames — alternating scale for editorial rhythm. */}
      <section className="space-y-16 md:space-y-[128px]">
        {project.frames.map((frame, i) => (
          <figure
            key={i}
            className={i % 3 === 2 ? "" : "md:mx-auto md:max-w-4xl"}
          >
            <Frame
              src={frame.src}
              tone={frame.tone}
              ratio={frame.ratio}
              label={frame.caption}
              alt={frame.caption}
            />
            <figcaption className="mt-4 type-caption">
              {String(i + 1).padStart(2, "0")} — {frame.caption}
            </figcaption>
          </figure>
        ))}
      </section>

      {/* Next project */}
      <section className="section border-t border-outline-variant/40 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="label-caps text-on-surface-variant">Next series</p>
          <Link href={`/work/${next.slug}`}>
            <p className="type-headline-md mt-3 text-on-surface hover:text-gold transition-colors">
              {next.title}
            </p>
          </Link>
        </div>
        <ButtonLink href="/" variant="ghost">
          Back to all work
        </ButtonLink>
      </section>
    </article>
  );
}
