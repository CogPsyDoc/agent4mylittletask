// Cowork Sync 서버
// - ~/.claude/projects 의 Claude Code 세션(JSONL)을 읽어 API로 제공
// - 정리 메타데이터(태그/폴더/즐겨찾기/커스텀 제목/메모)를 저장
// - 정적 웹 UI(public/) 서빙 → 어느 기기 브라우저에서도 접속

import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findSessionFiles, parseSessionFile } from './lib/parser.js';
import { MetaStore } from './lib/store.js';
import {
  CHAT_MODEL,
  ContinuationStore,
  buildHistory,
  isChatEnabled,
  toApiMessages,
} from './lib/chat.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---- 설정 ----
const PORT = process.env.PORT || 4317;
const HOST = process.env.HOST || '0.0.0.0'; // 0.0.0.0 → 같은 네트워크의 다른 기기에서 접속 가능
const DEFAULT_DIR = path.join(os.homedir(), '.claude', 'projects');
let TRANSCRIPTS_DIR = process.env.TRANSCRIPTS_DIR || DEFAULT_DIR;

// 기본 위치가 없으면 데모용 샘플로 폴백
if (!fs.existsSync(TRANSCRIPTS_DIR)) {
  const sample = path.join(__dirname, 'sample-data');
  if (fs.existsSync(sample)) {
    console.warn(`[cowork-sync] ${TRANSCRIPTS_DIR} 없음 → 샘플 데이터 사용 (${sample})`);
    TRANSCRIPTS_DIR = sample;
  }
}

const store = new MetaStore(path.join(__dirname, 'data', 'metadata.json'));
const continuations = new ContinuationStore(path.join(__dirname, 'data', 'continuations.json'));

// ---- 세션 캐시 ----
// 파싱은 비용이 있으니 목록/본문을 캐시하고, TTL 지나면 다시 스캔.
let cache = { at: 0, list: [], byId: new Map() };
const CACHE_TTL = Number(process.env.CACHE_TTL_MS || 5000);

async function scan(force = false) {
  const now = Date.now();
  if (!force && now - cache.at < CACHE_TTL && cache.list.length) return cache;

  const files = findSessionFiles(TRANSCRIPTS_DIR);
  const byId = new Map();
  const list = [];
  for (const file of files) {
    try {
      const session = await parseSessionFile(file);
      if (session.messageCount === 0) continue;
      byId.set(session.id, session);
      list.push(session);
    } catch (err) {
      console.warn(`[cowork-sync] 파싱 실패: ${file} — ${err.message}`);
    }
  }
  // 최근 업데이트 순
  list.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  cache = { at: now, list, byId };
  return cache;
}

// 세션 요약 + 사용자 메타 병합
function toSummary(s) {
  const meta = store.get(s.id);
  return {
    id: s.id,
    title: meta.customTitle || s.title,
    derivedTitle: s.title,
    preview: s.preview,
    project: s.project,
    projectName: s.projectName,
    gitBranch: s.gitBranch,
    messageCount: s.messageCount,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    meta,
  };
}

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// 전체 세션 목록(요약)
app.get('/api/sessions', async (req, res) => {
  const { list } = await scan();
  res.json({
    transcriptsDir: TRANSCRIPTS_DIR,
    count: list.length,
    sessions: list.map(toSummary),
  });
});

// 세션 본문 (+ 이어진 대화 병합)
app.get('/api/sessions/:id', async (req, res) => {
  const { byId } = await scan();
  const s = byId.get(req.params.id);
  if (!s) return res.status(404).json({ error: 'not found' });
  const extra = continuations.get(s.id).map((c) => ({
    role: c.role,
    blocks: [{ type: 'text', text: c.text }],
    timestamp: c.timestamp,
    isMeta: false,
    continued: true,
  }));
  res.json({ ...toSummary(s), messages: [...s.messages, ...extra] });
});

// 앱 설정 (프론트가 채팅 활성화 여부 확인용)
app.get('/api/config', (req, res) => {
  res.json({ chatEnabled: isChatEnabled(), model: CHAT_MODEL });
});

// 이어서 대화하기 — SSE로 응답을 스트리밍
app.post('/api/sessions/:id/continue', async (req, res) => {
  if (!isChatEnabled()) {
    return res.status(503).json({
      error: 'ANTHROPIC_API_KEY가 설정되어 있지 않아요. 키를 설정하면 이어서 대화할 수 있습니다.',
    });
  }
  const userText = String(req.body?.message || '').trim();
  if (!userText) return res.status(400).json({ error: 'message가 비어 있어요.' });

  const { byId } = await scan();
  const s = byId.get(req.params.id);
  if (!s) return res.status(404).json({ error: 'not found' });

  const history = buildHistory(s, continuations.get(s.id));
  history.push({ role: 'user', content: userText });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic();

    let fullText = '';
    const stream = client.messages.stream({
      model: CHAT_MODEL,
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      system:
        '이 대화는 Claude Code 세션에서 이어진 것입니다. 이전 맥락을 참고해 자연스럽게 이어서 답하세요. ' +
        '단, 지금은 도구를 실행할 수 없는 일반 대화 환경입니다.',
      messages: toApiMessages(history),
    });

    stream.on('text', (delta) => {
      fullText += delta;
      send('delta', { text: delta });
    });

    const final = await stream.finalMessage();

    if (final.stop_reason === 'refusal') {
      send('error', { message: '안전상의 이유로 이 요청에는 답할 수 없어요.' });
    } else {
      continuations.append(s.id, { role: 'user', text: userText, timestamp: new Date().toISOString() });
      continuations.append(s.id, { role: 'assistant', text: fullText, timestamp: new Date().toISOString() });
      send('done', {
        stopReason: final.stop_reason,
        usage: {
          input: final.usage.input_tokens,
          output: final.usage.output_tokens,
          cacheRead: final.usage.cache_read_input_tokens,
        },
      });
    }
  } catch (err) {
    console.error('[cowork-sync] continue 실패:', err.message);
    send('error', { message: err.message });
  }
  res.end();
});

// 정리 메타 업데이트
app.patch('/api/sessions/:id/meta', async (req, res) => {
  const { byId } = await scan();
  if (!byId.has(req.params.id)) return res.status(404).json({ error: 'not found' });
  const allowed = ['customTitle', 'tags', 'folder', 'favorite', 'notes'];
  const patch = {};
  for (const k of allowed) if (k in req.body) patch[k] = req.body[k];
  const next = store.update(req.params.id, patch);
  res.json(next);
});

// 전체 검색 (제목/미리보기/본문 텍스트/태그)
app.get('/api/search', async (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  if (!q) return res.json({ q, results: [] });
  const { list } = await scan();
  const results = [];
  for (const s of list) {
    const meta = store.get(s.id);
    const hay = [
      s.title,
      meta.customTitle,
      s.preview,
      s.projectName,
      (meta.tags || []).join(' '),
      meta.notes,
    ]
      .filter(Boolean)
      .join('\n')
      .toLowerCase();

    let snippet = '';
    let hit = hay.includes(q);
    if (!hit) {
      // 본문 텍스트까지 검색
      for (const m of s.messages) {
        for (const b of m.blocks) {
          const text = (b.text || b.output || b.input || '').toLowerCase();
          const idx = text.indexOf(q);
          if (idx >= 0) {
            hit = true;
            const start = Math.max(0, idx - 40);
            snippet = (b.text || b.output || b.input).slice(start, start + 120);
            break;
          }
        }
        if (hit) break;
      }
    }
    if (hit) results.push({ ...toSummary(s), snippet });
  }
  res.json({ q, count: results.length, results });
});

// 폴더/태그 목록 (사이드바 필터용)
app.get('/api/facets', async (req, res) => {
  const { list } = await scan();
  const folders = new Set();
  const tags = new Set();
  const projects = new Set();
  for (const s of list) {
    const meta = store.get(s.id);
    if (meta.folder) folders.add(meta.folder);
    (meta.tags || []).forEach((t) => tags.add(t));
    if (s.projectName) projects.add(s.projectName);
  }
  res.json({
    folders: [...folders].sort(),
    tags: [...tags].sort(),
    projects: [...projects].sort(),
  });
});

app.get('/api/health', (req, res) => res.json({ ok: true, dir: TRANSCRIPTS_DIR }));

app.listen(PORT, HOST, () => {
  console.log(`\n  Cowork Sync 실행 중`);
  console.log(`  ─ 로컬:    http://localhost:${PORT}`);
  console.log(`  ─ 트랜스크립트: ${TRANSCRIPTS_DIR}`);
  console.log(`  ─ 다른 기기: http://<이 컴퓨터 IP>:${PORT}\n`);
});
