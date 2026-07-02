# 💬 Cowork Sync

**Claude Code 대화를 어느 기기에서도 보고 내 맘대로 정리하는 웹앱.**

Claude Code(CLI/웹)는 대화 세션을 `~/.claude/projects/**/*.jsonl` 파일로 저장합니다.
Cowork Sync는 그 파일들을 읽어 브라우저에서 보여주고, 폴더·태그·즐겨찾기·검색으로 정리할 수 있게 해줍니다.
서버를 한 대 띄워 두면 폰·태블릿·PC 등 **같은 네트워크의 어느 기기 브라우저에서든** 접속해서 지난 대화를 이어볼 수 있어요.

> ⚠️ **읽기(뷰어) 전용입니다.** 지난 대화를 보고 정리하는 데 초점이 맞춰져 있어요.
> 앱 안에서 Claude에게 **새 메시지를 보내 답을 받는 기능**은 Anthropic API 키가 필요하며, 지금은 포함돼 있지 않습니다. (아래 "다음 단계" 참고)

---

## 빠른 시작

```bash
npm install
npm start
```

- 브라우저에서 `http://localhost:4317`
- `~/.claude/projects`가 없으면 자동으로 `sample-data/`(데모 대화)를 보여줍니다.

## 어느 기기에서든 접속하기

서버는 기본적으로 `0.0.0.0`에 바인딩되어 같은 네트워크의 다른 기기에서 접속할 수 있습니다.

1. 서버를 띄운 컴퓨터의 로컬 IP를 확인 (`ipconfig` / `ifconfig` / `ip addr`)
2. 폰이나 다른 기기 브라우저에서 `http://<그-IP>:4317`

집 밖에서도 쓰고 싶다면 터널을 하나 걸어두면 됩니다(택1):

- **Tailscale** (추천, 개인용 무료) — 기기들을 사설망으로 묶어 IP로 바로 접속
- **Cloudflare Tunnel** — `cloudflared tunnel --url http://localhost:4317`
- **ngrok** — `ngrok http 4317`

## 설정 (`.env` 또는 환경변수)

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `TRANSCRIPTS_DIR` | `~/.claude/projects` | 읽어올 트랜스크립트 폴더 |
| `PORT` | `4317` | 서버 포트 |
| `HOST` | `0.0.0.0` | 바인딩 호스트 |
| `CACHE_TTL_MS` | `5000` | 세션 목록 캐시 유효시간 |

`.env.example`를 참고하세요.

---

## 기능

- 📃 모든 Claude Code 세션을 최근순으로 나열, 프로젝트/브랜치 표시
- 🔎 제목·미리보기·**본문 전체 텍스트**·태그 검색 (스니펫 하이라이트)
- 🗂 폴더 지정, #태그, ⭐ 즐겨찾기, 커스텀 제목 — 내 맘대로 정리 (자동 저장)
- 🧵 대화 상세: 사용자/Claude/도구 호출을 구분해서 렌더링 (도구 입출력은 접힘)
- 📱 반응형 — 폰/태블릿/PC 브라우저 모두 대응
- 💾 정리 메타데이터는 `data/metadata.json`에 저장 (원본 트랜스크립트는 건드리지 않음)

## 구조

```
[폰/PC/태블릿 브라우저]  ←→  [Node/Express 서버]  ──읽기──▶  ~/.claude/projects/*.jsonl
      public/ (뷰어 UI)       server.js + lib/           (Claude Code가 저장)
                              정리 메타 → data/metadata.json
```

- `server.js` — API 서버 + 정적 파일 서빙
- `lib/parser.js` — JSONL 세션 파서
- `lib/store.js` — 정리 메타데이터 저장소
- `public/` — 프레임워크 없는 바닐라 웹 UI

## API

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET | `/api/sessions` | 세션 목록(요약) |
| GET | `/api/sessions/:id` | 세션 본문 |
| PATCH | `/api/sessions/:id/meta` | 정리 메타 수정 |
| GET | `/api/search?q=` | 전체 검색 |
| GET | `/api/facets` | 폴더/태그/프로젝트 목록 |

---

## 다음 단계 (원하면 확장)

- **앱 안에서 이어서 대화하기**: Anthropic API 키를 붙여 `/api/sessions/:id/continue`로
  세션 히스토리를 그대로 실어 Claude에 이어 보내는 기능. (키 발급: console.anthropic.com)
- **클라우드 배포 + 자동 업로드**: 로컬 트랜스크립트를 주기적으로 서버로 동기화해 인터넷 어디서든 접속
- **다중 사용자/로그인**: 여러 사람이 각자 계정으로 쓰도록 인증 추가
