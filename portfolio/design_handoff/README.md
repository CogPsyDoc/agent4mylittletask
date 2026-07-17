# Handoff: Chongwook Chung — 사진 포트폴리오 사이트 (v3 Urban)

## Overview
사진가 정총욱(Chongwook Chung)의 개인 포트폴리오. 순백 배경 + 검정 헤어라인 + 그로테스크/모노 타이포의 도시적 스타일 — 흑백/필름 사진이 중립 배경 위에서 돋보이도록 설계. 페이지: 갤러리(메인) · 시리즈 인덱스 · 시리즈 상세 · 저널 · 소개. 목적: 개인 아카이브 + 향후 작가 활동.

## About the Design Files
이 번들의 파일은 **HTML로 제작된 디자인 레퍼런스**입니다 — 프로덕션 코드가 아니라 의도한 룩·동작을 보여주는 프로토타입. 과제는 대상 코드베이스의 기존 환경(React, Next.js 등)과 패턴으로 **재구현**하는 것입니다. 환경이 없다면 정적 사이트에 적합한 프레임워크(Next.js, Astro 등)를 선택하세요. 사진 데이터는 JSON/CMS 등 데이터 소스로 분리 권장.

- `Chongwook Chung Portfolio v3 (Urban).dc.html` — 최종 확정 디자인 (구현 대상)
- `image-slot.js` — 프로토타입 전용 이미지 자리표시자. **구현하지 마세요** — 실제로는 `<img>`/`next/image`로 대체.
- `screenshots/` — 화면별 캡처 (01 갤러리 / 02 시리즈 인덱스 / 03 시리즈 상세 / 04 저널 / 05 소개). 필름 그레인 오버레이는 캡처에서 빠짐(실제로는 opacity .03 노이즈 전면). 사진 자리는 자리표시자 상태.

## Fidelity
**High-fidelity (hifi)**. 색·타이포·간격·인터랙션이 최종 의도 — 픽셀 수준 재현 대상. 단, 사진·시리즈명·저널 글·소개문·연락처는 예시 콘텐츠.

## Design Tokens
- 색: 배경 `#ffffff` / 잉크 `#111` / 보조 텍스트 `#888` (본문 보조 `#555`, `#444`) / 헤어라인 `1px solid #111` / 사진 자리 패널 `#f0f0ee` / 반전(활성) = 배경 `#111` + 텍스트 `#ffffff`
- 폰트 (Google Fonts + CDN):
  - **Archivo** 800 — 디스플레이(로고·연도·섹션 제목·이름). uppercase, letter-spacing −.02em~.01em
  - **Space Mono** 400 — 라벨·캡션·내비·날짜·푸터. letter-spacing .06~.12em, uppercase
  - **Pretendard Variable** — 한국어 본문·시리즈명
- 타이포 스케일: 10 / 11 / 13 / 13.5 / 15 / 17 / 23(로고) / 46(소개 이름) / 64(상세 제목) / 76px(연도·섹션 제목)
- 간격: 페이지 좌우 48px, 그리드 gap 26px, 오프셋 64px, 사진-캡션 gap 8px
- radius·그림자 없음. 전부 직각·플랫. 필름 그레인: fixed 오버레이, opacity .03, SVG feTurbulence(fractalNoise 0.9, 2 octaves, 140×140 타일)

## Screens / Views

### 공통 셸
- **헤더**: `padding:26px 48px; border-bottom:1px solid #111`, flex space-between center.
  - 로고: "CHONGWOOK CHUNG" Archivo 800 23px uppercase + 옆에 "PHOTO ARCHIVE — SEOUL" Space Mono 10px `#888` (margin-left 14px). 클릭 → 갤러리.
  - 내비: GALLERY · SERIES · JOURNAL · ABOUT. Space Mono 11px, 각 항목 `padding:6px 12px`, gap 2px. 활성: `#111` 배경 + 흰 텍스트(반전); 비활성: 투명 배경 + `#111`. 시리즈 상세에서도 SERIES 활성.
- **푸터**: `margin:0 48px; padding:18px 0 26px; border-top:1px solid #111`, Space Mono 10px `#888`, 좌 "© 2026 CHONGWOOK CHUNG" / 우 "SEOUL — 37.56°N 126.97°E".
- 본문: `padding:0 48px 24px`.

### 1. 갤러리 (`/`)
- **필터 칩**: ALL + 시리즈명 4개. Space Mono 11px, `padding:6px 12px; border:1px solid #111`, gap 2px, `padding:28px 0 40px`. 활성 = 흑백 반전. 필터 시 해당 시리즈 사진·연도만.
- **연도 섹션** (최신부터): `border-top:1px solid #111; padding-top:18px`, flex 하단정렬 gap 20px — 연도(Archivo 800 76px, line-height .9) + 시리즈명 목록(Space Mono 10px `#888` uppercase) + 우측 "04 WORKS" 카운트.
- **오프셋 2단 그리드**: `grid-template-columns:1fr 1fr; gap:26px`, 홀수 인덱스 `margin-top:64px`. 사진 높이 데이터 지정(300–440px), 자리 패널 `#f0f0ee`.
- **캡션**: Space Mono 10px `#888`, 예 "ALLEY_01 — B/W FILM".

### 2. 시리즈 인덱스 (`/series`)
- 제목 "SERIES" Archivo 800 76px uppercase, `padding:28px 0 36px`.
- 2열 그리드 `gap:40px 26px`. 카드: 대표작(높이 380px) + 아래 행(`border-bottom:1px solid #111; padding-bottom:10px`) — 시리즈명 15px/600 좌, 메타 "2025 · B/W FILM" Space Mono 10px `#888` 우. 카드 클릭 → 상세.

### 3. 시리즈 상세 (`/series/[slug]`)
- "← SERIES" Space Mono 11px `#888`, `padding:28px 0 30px`.
- 제목 행: 시리즈명 Archivo 800 64px + 메타 Space Mono 10px uppercase, flex 하단정렬 gap 20px.
- 시리즈 노트: 13px, line-height 1.7, `#555`, max-width 520px, 아래 44px.
- 사진: 갤러리와 동일한 오프셋 그리드.

### 4. 저널 (`/journal`)
- 제목 "JOURNAL" 76px. 리스트 max-width 720px. 항목: `padding:24px 0; border-top:1px solid #111`, flex gap 28px — 날짜(Space Mono 10px `#888`, 고정폭 70px) / 우측 세로 스택(제목 17px/600, 한 줄 발췌 13px `#555` line-height 1.7).

### 5. 소개 (`/about`)
- 2단 flex gap 64px wrap, `padding:40px 0`. 좌: 프로필 360×480. 우: max-width 560px, 세로 gap 24px.
  - 이름: "정총욱" Archivo 800 46px + "CHONGWOOK CHUNG" Space Mono 11px `#888`.
  - 소개 2문단: 13.5px, line-height 1.9, `#444`.
  - 연락처: `border-top:1px solid #111; padding-top:12px`, Space Mono 11px `#555` — "MAIL — …" / "INSTAGRAM — …".

## Interactions & Behavior
- 페이지 전환: 프로토타입은 state 기반 → 실제로는 라우트 기반 권장(URL 공유 가능).
- 필터 칩·내비: 즉시 전환, 애니메이션 없음(추가는 자유, 과하지 않게).
- hover: 링크 `#777`로 감광. 그 외 hover 효과 없음.
- 반응형: 데스크톱 기준. 모바일: 그리드 1열 + 오프셋 제거, 연도 타이포 40~48px로 축소, 헤더 세로 스택 권장.

## State Management
- `page`(→ 라우트), `filter`(기본 'all'), `open`(시리즈 slug).
- 플래그: `showCaptions`(기본 true), `grain`(기본 true).
- 데이터 모델: `series[] = { key, name, year, tag, note, photos[] }`, `photo = { src, height, caption }`. 저널: `{ date, title, line }`.

## Assets
- 사진 전부 자리표시자 — 실제 사진은 사용자 제공 예정. 텍스트 콘텐츠도 예시.
- 그레인: 외부 에셋 없음, 인라인 SVG로 생성.

## Files
- `Chongwook Chung Portfolio v3 (Urban).dc.html` — 최종 디자인(템플릿 + 데이터/상태 로직)
- `image-slot.js` — 프로토타입용(구현 제외)
- `screenshots/01–05` — 화면 캡처
