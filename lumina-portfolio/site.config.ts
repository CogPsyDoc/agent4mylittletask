/**
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  이 파일 하나만 수정하면 사이트 전체 내용이 바뀝니다.                 │
 * │  EDIT THIS ONE FILE — it is the single source of truth for the site.  │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * 사용법 / How to use
 *  1. 아래 대괄호 [ ... ] 안의 자리표시 문구를 당신의 실제 내용으로 바꾸세요.
 *  2. 사진을 넣으려면 파일을 `public/images/` 폴더에 넣고, 각 항목의
 *     `image` / `cover` / `src` 값을 "/images/파일이름.jpg" 로 적으세요.
 *     비워두면("") 부드러운 회색 플레이스홀더가 대신 표시됩니다.
 *  3. 저장하면 개발 서버(npm run dev)가 자동으로 새로고침됩니다.
 *
 * 디자인 색/폰트/여백은 tailwind.config.ts 에 있습니다(원본 Stitch 디자인 토큰).
 */

/** 플레이스홀더 그라데이션에 쓰는 기본 톤. 사진을 넣으면 무시됩니다. */
const TONE = {
  warm: ["#e8e8e8", "#c8c6c5"] as [string, string],
  cool: ["#e2e2e2", "#b8c8da"] as [string, string],
  soft: ["#eeeeee", "#dadada"] as [string, string],
  light: ["#f3f3f3", "#c4c7c7"] as [string, string],
};

export const site = {
  // ══════════════════════════════════════════════════════════════════
  //  기본 정보 / IDENTITY  — 상단 로고, 푸터, 메타데이터에 사용
  // ══════════════════════════════════════════════════════════════════
  brand: "[스튜디오명]", // 예: "Lumina" — 상단 왼쪽 로고 & 푸터 제목
  photographer: "[사진작가 이름]", // 예: "김하늘"
  role: "[직함]", // 예: "Fine-art & Editorial Photographer"
  email: "[you@example.com]",
  location: "[도시 · 국가]", // 예: "Seoul · Korea"
  tagline: "A quiet gallery frame for high-end photography.", // 푸터 한 줄 소개

  /** 소셜/연락 링크. 필요 없는 줄은 지우고, 더 넣어도 됩니다. */
  socials: [
    { label: "Instagram", href: "[https://instagram.com/your-handle]" },
    { label: "Behance", href: "[https://behance.net/your-handle]" },
    { label: "Email", href: "mailto:[you@example.com]" },
  ],

  // ══════════════════════════════════════════════════════════════════
  //  홈(Work) 페이지 / HOME
  // ══════════════════════════════════════════════════════════════════
  hero: {
    eyebrow: "[상단 작은 문구]", // 예: "Fine-art & editorial photography"
    headline: "[홈 대표 문장 — 한 줄로 당신을 소개]", // 큰 헤드라인
    primaryCta: { label: "View latest series", href: "/work/series-1" },
    secondaryCta: { label: "Commission a shoot", href: "/contact" },
  },

  /** 홈 하단의 에디토리얼 밴드(이미지 + 문장). */
  approach: {
    eyebrow: "The approach",
    title: "[당신의 작업 철학을 한 문장으로]",
    body: "[2~3문장으로 접근 방식을 설명하세요. 어떤 시선으로, 어떻게 찍는지.]",
    image: "", // 예: "/images/approach.jpg"
    tone: TONE.warm,
  },

  // ══════════════════════════════════════════════════════════════════
  //  작품(시리즈) / PROJECTS
  //  - 각 항목이 홈 갤러리 카드 + /work/[slug] 상세 페이지가 됩니다.
  //  - slug 는 URL 주소입니다(영문/숫자/하이픈).
  //  - 항목을 추가·삭제해도 됩니다. cover/src 를 채우면 사진이 나옵니다.
  // ══════════════════════════════════════════════════════════════════
  projects: [
    {
      slug: "series-1",
      title: "[작품 시리즈 제목 1]",
      category: "[분류]", // 예: "Series · Street"
      year: "[2025]",
      location: "[촬영 장소]",
      summary: "[한 줄 설명]",
      cover: "", // 대표 이미지, 예: "/images/series-1/cover.jpg"
      coverRatio: "3 / 2", // 카드 비율: "3 / 2" 또는 "4 / 5"
      tone: TONE.soft,
      statement: [
        "[작가 노트 1문단 — 이 시리즈를 왜, 어떻게 작업했는지.]",
        "[작가 노트 2문단 — 필요하면 더 쓰고, 필요 없으면 이 줄을 지우세요.]",
      ],
      frames: [
        { caption: "[사진 캡션 1]", src: "", ratio: "3 / 2", tone: TONE.warm },
        { caption: "[사진 캡션 2]", src: "", ratio: "4 / 5", tone: TONE.soft },
        { caption: "[사진 캡션 3]", src: "", ratio: "3 / 2", tone: TONE.cool },
        { caption: "[사진 캡션 4]", src: "", ratio: "4 / 5", tone: TONE.light },
      ],
    },
    {
      slug: "series-2",
      title: "[작품 시리즈 제목 2]",
      category: "[분류]",
      year: "[2024]",
      location: "[촬영 장소]",
      summary: "[한 줄 설명]",
      cover: "",
      coverRatio: "4 / 5",
      tone: TONE.cool,
      statement: ["[작가 노트 1문단]"],
      frames: [
        { caption: "[사진 캡션 1]", src: "", ratio: "3 / 2", tone: TONE.soft },
        { caption: "[사진 캡션 2]", src: "", ratio: "4 / 5", tone: TONE.warm },
      ],
    },
    {
      slug: "series-3",
      title: "[작품 시리즈 제목 3]",
      category: "[분류]",
      year: "[2024]",
      location: "[촬영 장소]",
      summary: "[한 줄 설명]",
      cover: "",
      coverRatio: "4 / 5",
      tone: TONE.warm,
      statement: ["[작가 노트 1문단]"],
      frames: [
        { caption: "[사진 캡션 1]", src: "", ratio: "4 / 5", tone: TONE.soft },
        { caption: "[사진 캡션 2]", src: "", ratio: "4 / 5", tone: TONE.light },
      ],
    },
    {
      slug: "series-4",
      title: "[작품 시리즈 제목 4]",
      category: "[분류]",
      year: "[2023]",
      location: "[촬영 장소]",
      summary: "[한 줄 설명]",
      cover: "",
      coverRatio: "3 / 2",
      tone: TONE.soft,
      statement: ["[작가 노트 1문단]"],
      frames: [
        { caption: "[사진 캡션 1]", src: "", ratio: "3 / 2", tone: TONE.warm },
        { caption: "[사진 캡션 2]", src: "", ratio: "3 / 2", tone: TONE.cool },
      ],
    },
  ],

  // ══════════════════════════════════════════════════════════════════
  //  소개 / ABOUT 페이지
  // ══════════════════════════════════════════════════════════════════
  about: {
    eyebrow: "About the artist",
    headline: "[About 대표 문장 — 당신의 작업을 한 문장으로]",
    intro: "[소개 문단 — 어떤 사진가인지, 무엇을 추구하는지 2~4문장.]",
    portrait: "", // 본인 사진, 예: "/images/portrait.jpg"
    portraitTone: TONE.warm,

    practiceTitle: "Practice",
    practice: [
      "[작업 방식 문단 1 — 어떻게 작업에 접근하는지.]",
      "[작업 방식 문단 2 — 장비/필름/철학 등. 필요 없으면 지우세요.]",
    ],

    exhibitionsTitle: "Selected Exhibitions",
    exhibitions: [
      { year: "[2025]", title: "[전시/프로젝트 제목]", venue: "[장소, 도시]" },
      { year: "[2024]", title: "[전시/프로젝트 제목]", venue: "[장소, 도시]" },
      { year: "[2024]", title: "[전시/프로젝트 제목]", venue: "[장소, 도시]" },
      { year: "[2023]", title: "[전시/프로젝트 제목]", venue: "[장소, 도시]" },
    ],

    clientsTitle: "Selected clients",
    clients: ["[클라이언트 1]", "[클라이언트 2]", "[클라이언트 3]", "[클라이언트 4]"],
  },

  // ══════════════════════════════════════════════════════════════════
  //  연락 / CONTACT 페이지
  // ══════════════════════════════════════════════════════════════════
  contact: {
    eyebrow: "Contact",
    headline: "[Contact 대표 문장]", // 예: "Let’s make something quiet."
    intro: "[연락 안내 문단 — 어떤 문의를 환영하는지, 답신 기간 등.]",
    details: [
      { label: "Studio", value: "[도시 · 도시]" },
      { label: "Email", value: "[you@example.com]" },
      { label: "Representation", value: "[에이전시 이름 또는 '—']" },
    ],
    // 폼 전송 대상. 비워두면 전송 시 '감사합니다' 화면만 표시됩니다.
    // Formspree 등 폼 서비스 URL을 넣으면 실제로 메일이 전송됩니다.
    formEndpoint: "",
  },
} as const;

export type SiteConfig = typeof site;
export type Project = (typeof site.projects)[number];
