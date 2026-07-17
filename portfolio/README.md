# Chongwook Chung — Photo Portfolio

사진가 정총욱의 포트폴리오 사이트. [Astro](https://astro.build) 기반 정적 사이트입니다.

디자인 명세: [`design_handoff/README.md`](design_handoff/README.md) (v3 Urban, hifi)

## 구조

```
portfolio/
├── src/
│   ├── data/site.json      ← 모든 콘텐츠 (시리즈·사진·저널·소개)
│   ├── pages/              ← 갤러리(/) · 시리즈(/series) · 상세(/series/[slug]) · 저널 · 소개
│   ├── layouts/Base.astro  ← 공통 셸 (헤더·내비·푸터·그레인)
│   └── styles/global.css   ← 디자인 토큰·전체 스타일
├── public/photos/          ← 사진 파일 (웹용 최적화본)
└── design_handoff/         ← 디자인 핸드오프 원본 (참고용)
```

## 사진 추가 방법

1. 웹용으로 최적화한 이미지를 `public/photos/`에 넣는다 (권장: 긴 변 2000px 이하, 장당 1MB 이하).
2. `src/data/site.json`의 해당 시리즈 `photos` 배열에 항목을 추가한다:

```json
{ "src": "/photos/alley-05.jpg", "height": 420, "caption": "ALLEY_05" }
```

- `src`가 `null`이면 자리표시자 패널(#f0f0ee)이 표시된다.
- `height`는 그리드에서의 프레임 높이(px). 300–440 범위 권장.
- 새 시리즈는 `series` 배열에 `{ slug, name, year, tag, note, cover, photos }` 객체를 추가.
- 시리즈 대표작은 `cover`에 경로 지정 (없으면 첫 사진 사용).

커밋하고 push하면 자동 배포된다 (Cloudflare Pages 연결 기준).

## 개발

```bash
npm install
npm run dev      # 개발 서버
npm run build    # dist/ 에 정적 빌드
```

## 배포 (Cloudflare Pages)

- Framework preset: **Astro**
- Build command: `npm run build`
- Build output directory: `dist`
- (이 저장소가 monorepo 하위 디렉토리일 경우 Root directory: `portfolio`)
