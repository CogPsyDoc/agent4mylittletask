---
description: 캘린더·메일·노션·슬랙을 훑어 Graphfy에 새 노드/관계를 제안
---

당신은 Graphfy(나에 대한 지식 그래프)의 자동 갱신 루틴입니다. 목표: 최근 활동에서 그래프에 없는
새 사람·조직·프로젝트·관심사·일상 변화를 찾아 **제안함에 넣는 것**입니다. 그래프를 직접 수정하지 마세요 —
제안은 사용자가 Graphfy UI(🔔 제안함)에서 추가/무시로 확정합니다.

## 절차

1. **현재 그래프 읽기**: `data/graphfy.json`을 읽으세요 (없으면 `sample-data/graphfy-seed.json`).
   기존 노드의 id·label 목록을 파악해 중복 제안을 피합니다.

2. **소스 스윕** (연결된 커넥터/MCP 도구가 있는 것만, 최근 2~3주 범위):
   - **Google Calendar**: 최근 2주 + 다가올 2주 일정 — 새 미팅 상대, 새 프로젝트/과제명, 반복 일정 변화
   - **Gmail**: 받은편지함 최근 2주 — 새 거래처·발주처·협업 제안, 진행 중인 계약/과제의 새 국면
   - **Notion**: 최근 수정된 프로젝트/회의 페이지 — 새 프로젝트, 담당 변경, 새 협업자
   - **Slack**: (가능하면) 새 프로젝트 채널, 자주 등장하는 새 인물
   - 커넥터가 하나도 없으면 그 사실을 알리고 종료하세요.

3. **후보 선별** — 다음 기준을 모두 만족하는 것만:
   - 기존 노드와 중복이 아님 (label이 비슷하면 노드 제안 대신 `kind:"edge"` 관계 제안 고려)
   - 일회성 스팸/뉴스레터/자동알림이 아니고, 사용자의 활동과 실제로 얽혀 있음 (2회 이상 등장하면 신뢰도 높음)
   - 기존 노드와 연결점(`connectTo`)을 최소 1개 제시할 수 있음
   - 확신이 없으면 빼세요. 제안은 회당 3~8건이 적당합니다.

4. **제안 등록**: 아래 형식의 JSON을 만들어 스크립트로 등록하세요.

   ```bash
   node scripts/graphfy-suggest.js suggestions.json   # 또는 stdin으로: ... | node scripts/graphfy-suggest.js -
   ```

   ```json
   [
     {
       "kind": "node",
       "label": "홍길동",
       "type": "person",            // self|person|project|org|interest|life
       "emoji": "🙂",
       "desc": "○○사 이사. 7월부터 △△ 건으로 주 1회 미팅.",
       "connectTo": [{ "id": "me", "label": "미팅" }, { "id": "shortdrama", "label": "파트너" }],
       "reason": "7/15·7/22 캘린더 미팅, 메일 스레드 3건",
       "sourceInfo": "calendar, gmail"
     },
     {
       "kind": "edge",
       "source": "me",
       "target": "kyle",
       "label": "주간 1:1",
       "reason": "6월부터 매주 화요일 1:1 반복 일정 생김",
       "sourceInfo": "calendar"
     }
   ]
   ```

   `connectTo[].id` / `source` / `target`은 **기존 그래프의 노드 id**여야 합니다.

5. **보고**: 등록한 제안을 표로 요약하고(라벨·종류·근거), 스킵한 후보가 있으면 이유와 함께 한 줄씩 남기세요.
   마지막에 "Graphfy(/graphfy)의 🔔 제안함에서 확인하세요"라고 안내합니다.

## 주기 실행

- Claude Code 세션에서 `/graphfy-update` 입력, 또는
- 터미널/cron에서: `claude -p "/graphfy-update"` (예: 매주 월요일 `0 9 * * 1`)
