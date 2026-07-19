/**
 * Project helpers. All content lives in `site.config.ts` — edit that file,
 * not this one.
 */
import { site, type Project } from "@/site.config";

export type { Project };

export const projects = site.projects;

export function getProject(slug: string): Project | undefined {
  return projects.find((p) => p.slug === slug);
}
