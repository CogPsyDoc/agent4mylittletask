# 💬 Cowork Sync

**Claude Code 대화를 어느 기기에서도 보고 내 맘대로 정리하는 웹앱.**

Claude Code(CLI/웹)는 대화 세션을 `~/.claude/projects/**/*.jsonl` 파일로 저장합니다.
Cowork Sync는 그 파일들을 읽어 브라우저에서 보여주고, 폴더·태그·즐겨찾기·검색으로 정리할 수 있게 해줍니다.
서버를 한 대 띄워 두면 폰·태블릿·PC 등 **같은 네트워크의 어느 기기 브라우저에서든** 접속해서 지난 대화를 이어볼 수 있어요.

> 💬 **이어서 대화하기**: 서버에 `ANTHROPIC_API_KEY`를 설정하면 앱 안에서 지난 대화를 그대로 이어서
> Claude와 대화할 수 있어요 (키가 없어도 뷰어/정리 기능은 전부 동작합니다). 아래 "이어서 대화하기" 참고.

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

## 이어서 대화하기

1. [console.anthropic.com](https://console.anthropic.com)에서 API 키를 발급받고 크레딧을 충전합니다 ($5면 충분히 시작).
2. 서버를 키와 함께 실행:

   ```bash
   ANTHROPIC_API_KEY=sk-ant-... npm start
   ```

3. 대화 상세 화면 하단에 입력창이 나타납니다. 지난 대화의 맥락(도구 실행 내역 포함)을
   자동으로 실어 보내므로 정말 "이어서" 대화가 됩니다.

- 이어진 대화는 `data/continuations.json`에 저장되고 원본 트랜스크립트는 건드리지 않습니다.
- 응답은 실시간 스트리밍으로 표시됩니다.
- 매 턴 히스토리 앞부분에 프롬프트 캐싱을 적용해 반복 비용을 줄입니다.
- 모델은 `CLAUDE_MODEL`로 변경 가능 (기본 `claude-opus-4-8`; 저렴하게는 `claude-haiku-4-5`).

## 설정 (`.env` 또는 환경변수)

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `TRANSCRIPTS_DIR` | `~/.claude/projects` | 읽어올 트랜스크립트 폴더 |
| `PORT` | `4317` | 서버 포트 |
| `HOST` | `0.0.0.0` | 바인딩 호스트 |
| `CACHE_TTL_MS` | `5000` | 세션 목록 캐시 유효시간 |
| `ANTHROPIC_API_KEY` | (없음) | 설정 시 "이어서 대화하기" 활성화 |
| `CLAUDE_MODEL` | `claude-opus-4-8` | 이어서 대화에 쓸 모델 |
| `MAX_HISTORY_CHARS` | `400000` | API로 보낼 히스토리 길이 상한(문자) |

`.env.example`를 참고하세요.

---

## 🕸️ Graphfy — 나에 대한 지식 그래프

Obsidian의 Graph view처럼, **나를 둘러싼 사람·프로젝트·조직·관심사·일상을 노드-엣지 그래프로** 보고 편집하는 페이지입니다.

- 접속: `http://localhost:4317/graphfy` (메인 화면의 🕸️ 아이콘)
- 포스 레이아웃(자체 구현, 라이브러리 없음) + 캔버스 렌더링 — 드래그/줌(커서 기준)/팬/핀치 지원
- 글로우·곡선 엣지·줌 연동 라벨 페이드·부드러운 포커스 전환 등 Obsidian Graph view 스타일
- 노드 클릭 → 상세 패널에서 이름·종류·이모지·설명·관계 편집, `◎ 로컬 그래프`로 이웃만 보기
- **노드별 마크다운 노트** — 패널에서 ✏️ 편집/👁 보기 토글, `[[노드이름]]` 위키링크로 노드 간 점프
  (노트 있는 노드는 우상단에 주황 점 표시)
- `＋ 노드`로 추가, `＋ 연결 추가` 후 다른 노드를 클릭하면 엣지 생성 (엣지 `w`(1~3)로 두께 가중치)
- 종류(나/사람/프로젝트/조직/관심사/일상) 칩으로 필터, 검색으로 하이라이트
- 변경 사항은 `data/graphfy.json`에 자동 저장 (노드 위치 포함), JSON 내보내기/가져오기 지원
- 첫 실행 시 `sample-data/graphfy-seed.json`을 시드로 사용 — 자기 것으로 마음껏 고쳐 쓰세요

### 자동 갱신 (`/graphfy-update`)

캘린더·메일·노션을 훑어 그래프에 없는 새 사람/프로젝트/관계를 찾아 **제안함**에 넣는 루틴입니다.
그래프를 직접 고치지 않고, Graphfy 상단의 `🔔 제안` 배지 → 패널에서 **추가/무시**로 확정합니다.

- Claude Code 세션(커넥터 연결 상태)에서 `/graphfy-update` 입력
- 주기 실행: `claude -p "/graphfy-update"` 를 cron에 등록 (예: 매주 월 9시 `0 9 * * 1`)
- 수동 등록도 가능: `node scripts/graphfy-suggest.js <suggestions.json | ->` (형식은 스크립트 주석 참고)
- 제안은 `data/graphfy-suggestions.json`에 대기하며 API는 `GET/POST /api/graphfy/suggestions`, `DELETE /api/graphfy/suggestions/:id`

## 기능

- 💬 **이어서 대화하기** — 지난 세션의 맥락을 그대로 실어 Claude와 계속 대화 (API 키 필요, 스트리밍)
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
| POST | `/api/sessions/:id/continue` | 이어서 대화 (SSE 스트리밍) |
| GET | `/api/config` | 채팅 활성화 여부/모델 |
| GET | `/api/search?q=` | 전체 검색 |
| GET | `/api/facets` | 폴더/태그/프로젝트 목록 |
| GET | `/graphfy` | Graphfy 페이지 |
| GET | `/api/graphfy` | 그래프(노드/엣지) 조회 |
| PUT | `/api/graphfy` | 그래프 전체 저장 |

---

## 다음 단계 (원하면 확장)

- **클라우드 배포 + 자동 업로드**: 로컬 트랜스크립트를 주기적으로 서버로 동기화해 인터넷 어디서든 접속
- **다중 사용자/로그인**: 여러 사람이 각자 계정으로 쓰도록 인증 추가
- **이어진 대화에서 도구 사용**: 지금 이어서 대화는 일반 채팅 (파일 읽기/실행 없음)
