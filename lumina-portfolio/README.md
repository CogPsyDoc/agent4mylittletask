# 사진작가 포트폴리오 사이트 (Next.js)

미니멀-에디토리얼 스타일의 사진작가 포트폴리오입니다. Google Stitch 디자인
(디자인 시스템: **Ethereal Frame**)을 React / Next.js 로 변환한 것입니다.

- **스택:** Next.js 14 (App Router) · React 18 · TypeScript · Tailwind CSS
- **페이지:** 홈/갤러리 · 소개(About) · 연락(Contact) · 작품 상세(Work)

---

## ⚡ 빠른 시작

```bash
cd lumina-portfolio
npm install
npm run dev        # http://localhost:3000 에서 열림
```

배포용 빌드:

```bash
npm run build && npm start
```

---

## ✍️ 내 포트폴리오로 만들기 (딱 2단계)

### 1) 내용 바꾸기 — `site.config.ts` **한 파일만** 편집

사이트의 모든 글자(이름, 소개, 작품 제목, 전시 이력, 연락처 등)는
[`site.config.ts`](./site.config.ts) 한 곳에 모여 있습니다. 대괄호 `[ ... ]`
안의 자리표시 문구를 당신의 실제 내용으로 바꾸기만 하면 됩니다.

```ts
brand: "[스튜디오명]",          →   brand: "김하늘 스튜디오",
photographer: "[사진작가 이름]",  →   photographer: "김하늘",
hero: {
  headline: "[홈 대표 문장 …]",   →   headline: "빛을 붙잡는 사람",
},
```

`npm run dev` 를 켜 둔 상태라면 저장하는 즉시 브라우저에 반영됩니다.

### 2) 사진 넣기 — `public/images/` 에 파일을 두고 경로 적기

1. 사진 파일을 `public/images/` 폴더에 넣습니다.
   (예: `public/images/series-1/cover.jpg`)
2. `site.config.ts` 에서 해당 항목의 `cover` / `image` / `src` 값을 적습니다.
   (예: `cover: "/images/series-1/cover.jpg"` — `public` 은 빼고 `/images/` 로 시작)

값을 비워두면(`""`) 디자인 톤에 맞는 부드러운 회색 플레이스홀더가 대신 보이므로,
사진 없이도 레이아웃이 정상적으로 보입니다.

> 연락 폼을 실제로 받고 싶다면 `site.config.ts` 의 `contact.formEndpoint` 에
> [Formspree](https://formspree.io) 같은 폼 서비스 URL을 넣으세요. 비워두면
> 제출 시 "감사합니다" 화면만 표시됩니다(메일 전송 없음).

---

## 🎨 디자인은 어디에?

색상·글꼴·여백은 원본 Stitch 디자인 시스템에서 그대로 가져온
[`tailwind.config.ts`](./tailwind.config.ts) 에 토큰으로 정의돼 있습니다.

- **색상** — Ethereal Frame 팔레트(차콜 primary, 골드 secondary, 슬레이트 아웃라인 등)
- **타이포** — 제목 Playfair Display, 본문/라벨 Inter (정확한 스케일)
- **여백** — 8px 기준, 32px 거터, 데스크톱 64px / 모바일 24px 여백, 섹션 간격 128px

색감이나 폰트를 바꾸고 싶으면 이 파일만 손보면 됩니다.

---

## 📁 폴더 구조

```
site.config.ts          ← ⭐ 내용은 여기서 전부 수정
tailwind.config.ts      ← 색/폰트/여백 (디자인 토큰)
app/
  layout.tsx            루트 레이아웃 · 폰트 · Nav + Footer
  page.tsx              홈 / 갤러리
  about/page.tsx        소개
  contact/page.tsx      연락 (폼)
  work/[slug]/page.tsx  작품 상세 (작품마다 자동 생성)
  not-found.tsx         404
components/             Nav, Footer, Button, ImageCard, Frame, Chip, Field
public/images/          ← 사진 넣는 곳
```

---

## 🚀 배포

정적/서버 어디든 배포됩니다. 가장 간단한 방법:

- **Vercel** — 이 저장소를 연결하면 자동 빌드됩니다. Root Directory 를
  `lumina-portfolio` 로 지정하세요.

---

## ℹ️ 변환에 대한 참고

이 사이트는 Stitch **디자인 시스템 + 화면 구성**을 기반으로 충실히 구현한
것으로, 생성된 HTML 을 한 줄씩 그대로 옮긴 것은 아닙니다. 원본 화면의 HTML 과
스크린샷은 Google 사용자 콘텐츠 호스트에서만 제공되는데, 이 사이트를 만든
환경의 아웃바운드 정책이 해당 호스트를 차단(403)해 원본 HTML 을 직접 내려받을
수 없었기 때문입니다. 디자인 시스템 자체는 `stitch.googleapis.com` 에서 정상적으로
받았고, 그 값들을 정확히 반영했습니다.
