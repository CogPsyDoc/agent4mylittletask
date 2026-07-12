# ☁️ Cowork Sync Agent — Cloudflare 실시간 에이전트

Cowork Sync를 **인터넷 어디서든, 여러 기기에서 실시간으로** 쓰게 해주는 Cloudflare 에이전트입니다.
[Cloudflare Agents SDK](https://developers.cloudflare.com/agents/)(Durable Object) 위에서 동작합니다.

```
[로컬 PC]                         [Cloudflare Workers]                [폰/태블릿/다른 PC]
scripts/sync-up.js ──POST /sync──▶  CoworkAgent (Durable Object)  ◀──WebSocket──▶ 브라우저들
~/.claude/projects                  ├ SQLite: 세션/메타/채팅/활동      실시간 반영:
                                    ├ Claude 스트리밍 채팅 중계         · 세션 목록/정리 메타
                                    └ 알람 기반 리마인더 예약           · 채팅 델타, 리마인더, 활동
```

**룸(room)** 하나가 에이전트 인스턴스 하나입니다. 같은 룸에 접속한 모든 기기는
세션 목록, ⭐즐겨찾기/태그, 채팅 스트리밍, 리마인더, 활동 피드를 실시간으로 공유합니다.

## 기능

- 📡 **실시간 동기화** — 어떤 기기에서 즐겨찾기/태그를 바꾸거나 채팅을 보내면, 접속 중인 모든 기기에 즉시 반영 (WebSocket 브로드캐스트)
- 💬 **이어서 대화하기** — Claude 스트리밍 응답을 모든 기기에 동시에 중계. 폰에서 보낸 질문의 답이 PC에도 실시간으로 흐릅니다
- ☁️ **클라우드 저장** — 세션/정리 메타/이어진 대화가 Durable Object 내장 SQLite에 저장 (기기가 꺼져 있어도 유지)
- ⏰ **예약 작업(리마인더)** — Durable Object 알람으로 예약. 접속이 끊겨 있어도 에이전트가 깨어나 실행하고, 그 순간 접속한 기기에 알림
- 🔄 **로컬 → 클라우드 업로드** — `sync-up.js`가 `~/.claude/projects`의 변경분만 골라 업로드 (`--watch`로 상시 동기화)

## 배포

```bash
cd cloudflare
npm install
npx wrangler login                      # Cloudflare 계정 연결
npx wrangler secret put SYNC_TOKEN      # 업로드 인증 토큰 (강력 권장)
npx wrangler secret put ANTHROPIC_API_KEY  # 채팅 기능 (선택)
npm run deploy
```

배포되면 `https://cowork-sync-agent.<계정>.workers.dev` 가 생깁니다.
브라우저로 열면 UI, `?room=이름` 으로 룸을 나눌 수 있어요 (기본 `main`).

## 로컬 트랜스크립트 업로드

```bash
# 한 번 업로드
node scripts/sync-up.js --url https://cowork-sync-agent.<계정>.workers.dev --token <SYNC_TOKEN>

# 60초마다 변경분 자동 업로드 (로컬 PC에 켜두기)
node scripts/sync-up.js --url https://... --token <토큰> --watch
```

| 옵션 | 환경변수 | 기본값 | 설명 |
| --- | --- | --- | --- |
| `--url` | `COWORK_AGENT_URL` | (필수) | 워커 주소 |
| `--room` | `COWORK_ROOM` | `main` | 룸 이름 |
| `--dir` | `TRANSCRIPTS_DIR` | `~/.claude/projects` | 트랜스크립트 폴더 (없으면 `sample-data`) |
| `--token` | `SYNC_TOKEN` | (없음) | 업로드 Bearer 토큰 |
| `--watch` / `--interval` | `SYNC_INTERVAL` | 60초 | 반복 업로드 |

## 로컬 개발

```bash
cp .dev.vars.example .dev.vars   # 키 채우기 (선택)
npm run dev                      # http://localhost:8787
node scripts/sync-up.js --url http://127.0.0.1:8787 --dir ../sample-data   # 데모 데이터 주입
```

## API / 프로토콜

에이전트 주소: `/agents/cowork-agent/<room>`

**HTTP**

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| POST | `/agents/cowork-agent/<room>/sync` | 세션 업로드 (`{sessions: [...]}`, `SYNC_TOKEN` 설정 시 Bearer 인증) |
| GET | `/agents/cowork-agent/<room>/sessions` | 세션 목록 |
| GET | `/agents/cowork-agent/<room>/health` | 상태 확인 |

**WebSocket** (같은 주소로 업그레이드)

| 보내기 | 응답/브로드캐스트 |
| --- | --- |
| `{type:"open", sessionId}` | `session_detail` (요청 기기에만) |
| `{type:"chat", sessionId, text}` | `chat_user` → `chat_delta`\* → `chat_done` (전 기기) |
| `{type:"meta", sessionId, patch}` | `sessions` (전 기기) |
| `{type:"remind", seconds, note}` | `reminders`, 발화 시 `reminder` (전 기기) |
| `{type:"cancel_remind", id}` / `{type:"list_reminders"}` | `reminders` |

접속 직후 `welcome`(세션/활동/설정 스냅샷)이 오고, `presence`/`activity`가 수시로 브로드캐스트됩니다.
`cf_agent_` 로 시작하는 메시지는 SDK 내부용이니 무시하세요.

## 설정

| 이름 | 종류 | 설명 |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | secret | 설정 시 "이어서 대화" 활성화 |
| `SYNC_TOKEN` | secret | 설정 시 `/sync` 업로드에 Bearer 인증 요구 |
| `CLAUDE_MODEL` | var (wrangler.jsonc) | 기본 `claude-opus-4-8` |

> ⚠️ 뷰어(WebSocket/GET)는 별도 인증이 없습니다. 대화 내용이 민감하다면 Cloudflare Access
> 등으로 워커 전체에 접근 제어를 걸거나, 룸 이름을 추측하기 어렵게 쓰세요.
