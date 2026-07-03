// "이어서 대화" 기능.
// - 원본 JSONL 트랜스크립트는 절대 건드리지 않고,
//   이어서 나눈 대화는 data/continuations.json 에 별도 저장한다.
// - Anthropic API 키(ANTHROPIC_API_KEY)가 있을 때만 활성화된다.

import fs from 'node:fs';
import path from 'node:path';

export const CHAT_MODEL = process.env.CLAUDE_MODEL || 'claude-opus-4-8';

// 히스토리가 너무 길면 오래된 것부터 잘라낸다 (문자 기준 근사치).
const MAX_HISTORY_CHARS = Number(process.env.MAX_HISTORY_CHARS || 400_000);

export function isChatEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

// ---- 이어진 대화 저장소 ----
export class ContinuationStore {
  constructor(filePath) {
    this.filePath = filePath;
    try {
      this.data = JSON.parse(fs.readFileSync(filePath, 'utf8')) || {};
    } catch {
      this.data = {};
    }
  }

  get(sessionId) {
    return this.data[sessionId] || [];
  }

  append(sessionId, message) {
    if (!this.data[sessionId]) this.data[sessionId] = [];
    this.data[sessionId].push(message);
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
  }
}

// 세션 메시지 + 이어진 대화 → Claude API messages 배열.
// 원본 세션의 도구 호출/결과는 텍스트로 요약해 맥락만 유지한다.
export function buildHistory(session, continuation) {
  const turns = [];

  for (const m of session.messages) {
    if (m.isMeta) continue;
    const text = m.blocks
      .map((b) => {
        if (b.type === 'text') return b.text;
        if (b.type === 'thinking') return null; // 과거 thinking은 히스토리에서 제외
        if (b.type === 'tool_use') return `[도구 실행: ${b.name}]`;
        if (b.type === 'tool_result') return truncate(`[도구 결과]\n${b.output || ''}`, 2000);
        return null;
      })
      .filter(Boolean)
      .join('\n');
    if (!text.trim()) continue;

    const role = m.role === 'assistant' ? 'assistant' : 'user'; // tool 결과는 user 턴으로
    // 같은 역할 연속 턴은 합친다 (API는 허용하지만 깔끔하게)
    const last = turns[turns.length - 1];
    if (last && last.role === role) last.content += '\n\n' + text;
    else turns.push({ role, content: text });
  }

  for (const c of continuation) {
    const last = turns[turns.length - 1];
    if (last && last.role === c.role) last.content += '\n\n' + c.text;
    else turns.push({ role: c.role, content: c.text });
  }

  // 첫 턴은 user 여야 한다
  while (turns.length && turns[0].role !== 'user') turns.shift();

  // 길이 제한: 오래된 턴부터 제거하되 첫 user 턴 유지 규칙 재적용
  let total = turns.reduce((s, t) => s + t.content.length, 0);
  while (total > MAX_HISTORY_CHARS && turns.length > 2) {
    const removed = turns.shift();
    total -= removed.content.length;
  }
  while (turns.length && turns[0].role !== 'user') {
    total -= turns[0].content.length;
    turns.shift();
  }

  return turns;
}

function truncate(s, n) {
  return s.length > n ? s.slice(0, n) + '\n…(생략)' : s;
}

// content 블록 배열 형태로 변환 + 프롬프트 캐싱 브레이크포인트 삽입.
// 마지막에서 두 번째 턴(직전까지의 히스토리)에 cache_control 을 달아
// 다음 턴에서 히스토리 전체가 캐시에서 읽히도록 한다.
export function toApiMessages(turns) {
  return turns.map((t, i) => ({
    role: t.role,
    content: [
      {
        type: 'text',
        text: t.content,
        ...(i === turns.length - 2 ? { cache_control: { type: 'ephemeral' } } : {}),
      },
    ],
  }));
}
