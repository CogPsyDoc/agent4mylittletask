import Link from "next/link";
import Placeholder from "./Placeholder";
import type { Project } from "@/lib/projects";

/**
 * Gallery card — the image is the hero. Caption sits below in body-md; on hover
 * the card lifts with a diffused ambient shadow (per the design system).
 */
export default function ImageCard({ project }: { project: Project }) {
  return (
    <Link href={`/work/${project.slug}`} className="group block">
      <div className="overflow-hidden transition-shadow duration-500 ease-editorial group-hover:shadow-lift">
        <Placeholder
          tone={project.tone}
          ratio={project.ratio}
          className="transition-transform duration-700 ease-editorial group-hover:scale-[1.02]"
        />
      </div>
      <div className="mt-5 flex items-baseline justify-between gap-4">
        <div>
          <h3 className="type-headline-sm text-on-surface">{project.title}</h3>
          <p className="type-caption mt-1">{project.summary}</p>
        </div>
        <span className="label-caps text-on-surface-variant whitespace-nowrap">
          {project.year}
        </span>
      </div>
    </Link>
  );
}
