/**
 * Sample portfolio content for the Lumina site.
 *
 * The source Stitch design ships screens for a Home gallery, a project detail
 * page ("Urban Silence"), an About page and a Contact page. This data drives
 * those pages. Swap in real content + image URLs to go live.
 */

export type Project = {
  slug: string;
  title: string;
  category: string;
  year: string;
  location: string;
  /** Short blurb shown on the gallery and at the top of the detail page. */
  summary: string;
  /** Longer editorial statement shown on the detail page. */
  statement: string[];
  /** Aspect ratio for the gallery card, e.g. "4 / 5" or "3 / 2". */
  ratio: string;
  /** Placeholder tone pairs used until real photography is wired in. */
  tone: [string, string];
  /** Ordered gallery frames for the detail page. */
  frames: { caption: string; ratio: string; tone: [string, string] }[];
};

export const projects: Project[] = [
  {
    slug: "urban-silence",
    title: "Urban Silence",
    category: "Series · Street",
    year: "2025",
    location: "Lisbon, Portugal",
    summary:
      "A study of the quiet moments that punctuate the noise of the modern city.",
    statement: [
      "Urban Silence began as a question: where does a city go to be quiet? Over eight months in Lisbon I walked the same routes at the edges of the day, when the streets exhale and the architecture is left to speak for itself.",
      "The series favours restraint — long tonal ranges, deliberate negative space, and a refusal to fill the frame. Each photograph is composed to hold a single breath.",
    ],
    ratio: "3 / 2",
    tone: ["#e2e2e2", "#c4c7c7"],
    frames: [
      { caption: "Praça do Comércio, 06:12", ratio: "3 / 2", tone: ["#e8e8e8", "#c8c6c5"] },
      { caption: "Alfama stairwell", ratio: "4 / 5", tone: ["#eeeeee", "#dadada"] },
      { caption: "Tram 28, empty", ratio: "3 / 2", tone: ["#e2e2e2", "#b8c8da"] },
      { caption: "Miradouro, last light", ratio: "4 / 5", tone: ["#f3f3f3", "#c4c7c7"] },
    ],
  },
  {
    slug: "salt-and-light",
    title: "Salt & Light",
    category: "Series · Landscape",
    year: "2024",
    location: "Skagen, Denmark",
    summary: "Where two seas meet, the light does the composing.",
    statement: [
      "On the northern tip of Denmark the Skagerrak and Kattegat seas collide. Salt & Light chases the diffuse, almost weightless light that drew painters here a century ago.",
    ],
    ratio: "4 / 5",
    tone: ["#e8e8e8", "#d4e4f6"],
    frames: [
      { caption: "Grenen sandbar", ratio: "3 / 2", tone: ["#eeeeee", "#b8c8da"] },
      { caption: "North pier, fog", ratio: "4 / 5", tone: ["#e2e2e2", "#c4c7c7"] },
    ],
  },
  {
    slug: "in-camera",
    title: "In Camera",
    category: "Series · Portrait",
    year: "2024",
    location: "Studio, Berlin",
    summary: "Portraits made in a single frame, no retouching, no second take.",
    statement: [
      "In Camera is a discipline as much as a series: one exposure per sitter, developed and printed exactly as captured. The constraint asks both photographer and subject to arrive fully present.",
    ],
    ratio: "4 / 5",
    tone: ["#e2e2e2", "#c8c6c5"],
    frames: [
      { caption: "Sitter no. 04", ratio: "4 / 5", tone: ["#eeeeee", "#dadada"] },
      { caption: "Sitter no. 11", ratio: "4 / 5", tone: ["#e8e8e8", "#c4c7c7"] },
    ],
  },
  {
    slug: "field-notes",
    title: "Field Notes",
    category: "Series · Documentary",
    year: "2023",
    location: "Atacama, Chile",
    summary: "A visual diary from the driest desert on earth.",
    statement: [
      "Field Notes collects fragments from six weeks in the Atacama — an unhurried record of terrain that looks less like a place than a proposition.",
    ],
    ratio: "3 / 2",
    tone: ["#e8e8e8", "#e2e2e2"],
    frames: [
      { caption: "Valle de la Luna", ratio: "3 / 2", tone: ["#eeeeee", "#c8c6c5"] },
      { caption: "Salt flat, noon", ratio: "3 / 2", tone: ["#f3f3f3", "#dadada"] },
    ],
  },
];

export function getProject(slug: string): Project | undefined {
  return projects.find((p) => p.slug === slug);
}
