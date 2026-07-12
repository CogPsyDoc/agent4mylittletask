#!/usr/bin/env node
// 로컬 Claude Code 트랜스크립트(~/.claude/projects/**/*.jsonl)를
// Cloudflare 에이전트로 업로드하는 동기화 스크립트.
//
// 사용법:
//   node scripts/sync-up.js --url https://cowork-sync-agent.<계정>.workers.dev [--room main] [--watch]
//
// 옵션 / 환경변수:
//   --url    COWORK_AGENT_URL   워커 주소 (필수)
//   --room   COWORK_ROOM        룸 이름 (기본 main)
//   --dir    TRANSCRIPTS_DIR    트랜스크립트 폴더 (기본 ~/.claude/projects, 없으면 sample-data)
//   --token  SYNC_TOKEN         업로드 인증 토큰 (워커에 설정한 경우)
//   --watch                     60초마다 반복 업로드
//   --interval <초>             --watch 주기 변경

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findSessionFiles, parseSessionFile } from '../../lib/parser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---- 인자 파싱 ----
const args = process.argv.slice(2);
const opt = (name, envName, fallback) => {
  const i = args.indexOf(`--${name}`);
  if (i >= 0 && args[i + 1] && !args[i + 1].startsWith('--')) return args[i + 1];
  return process.env[envName] || fallback;
};
const URL_BASE = (opt('url', 'COWORK_AGENT_URL', '') || '').replace(/\/$/, '');
const ROOM = opt('room', 'COWORK_ROOM', 'main');
const TOKEN = opt('token', 'SYNC_TOKEN', '');
const WATCH = args.includes('--watch');
const INTERVAL = Number(opt('interval', 'SYNC_INTERVAL', '60'));

if (!URL_BASE) {
  console.error('사용법: node scripts/sync-up.js --url https://<워커주소> [--room main] [--watch]');
  process.exit(1);
}

let DIR = opt('dir', 'TRANSCRIPTS_DIR', path.join(os.homedir(), '.claude', 'projects'));
if (!fs.existsSync(DIR)) {
  const sample = path.join(__dirname, '..', '..', 'sample-data');
  if (fs.existsSync(sample)) {
    console.warn(`[sync] ${DIR} 없음 → 샘플 데이터 사용 (${sample})`);
    DIR = sample;
  } else {
    console.error(`[sync] 트랜스크립트 폴더가 없어요: ${DIR}`);
    process.exit(1);
  }
}

const ENDPOINT = `${URL_BASE}/agents/cowork-agent/${ROOM}/sync`;
const MAX_BLOCK_CHARS = 4000;      // 블록당 텍스트 상한
const MAX_SESSION_BYTES = 250_000; // 세션당 직렬화 상한 (DO row 한도 고려)
const BATCH = 10;                  // 요청당 세션 수

function slim(session) {
  // 업로드용으로 블록 텍스트를 잘라 용량을 줄인다
  let messages = session.messages.map((m) => ({
    role: m.role,
    timestamp: m.timestamp,
    isMeta: m.isMeta || false,
    blocks: m.blocks.map((b) => ({
      type: b.type,
      ...(b.text ? { text: cut(b.text) } : {}),
      ...(b.name ? { name: b.name } : {}),
      ...(b.input ? { input: cut(b.input) } : {}),
      ...(b.output ? { output: cut(b.output) } : {}),
      ...(b.isError ? { isError: true } : {}),
    })),
  }));
  // 그래도 크면 오래된 메시지부터 버린다
  while (messages.length > 2 && JSON.stringify(messages).length > MAX_SESSION_BYTES) {
    messages = messages.slice(Math.ceil(messages.length / 4));
  }
  return {
    id: session.id,
    title: session.title,
    preview: session.preview,
    project: session.project,
    projectName: session.projectName,
    gitBranch: session.gitBranch,
    messageCount: session.messageCount,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    messages,
  };
}

function cut(s) {
  return s.length > MAX_BLOCK_CHARS ? s.slice(0, MAX_BLOCK_CHARS) + '\n…(생략)' : s;
}

// 파일 mtime 기록 — 바뀐 세션만 다시 올린다
const seen = new Map();

async function syncOnce() {
  const files = findSessionFiles(DIR);
  const changed = files.filter((f) => {
    try {
      const mtime = fs.statSync(f).mtimeMs;
      if (seen.get(f) === mtime) return false;
      seen.set(f, mtime);
      return true;
    } catch {
      return false;
    }
  });

  if (!changed.length) {
    console.log(`[sync] 변경 없음 (${files.length}개 세션)`);
    return;
  }

  const sessions = [];
  for (const file of changed) {
    try {
      const s = await parseSessionFile(file);
      if (s.messageCount > 0) sessions.push(slim(s));
    } catch (err) {
      console.warn(`[sync] 파싱 실패: ${file} — ${err.message}`);
    }
  }

  let uploaded = 0;
  for (let i = 0; i < sessions.length; i += BATCH) {
    const batch = sessions.slice(i, i + BATCH);
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}),
      },
      body: JSON.stringify({ sessions: batch }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`업로드 실패 (HTTP ${res.status}): ${body.slice(0, 200)}`);
    }
    const out = await res.json();
    uploaded += out.upserted || 0;
  }
  console.log(`[sync] ${uploaded}개 세션 업로드 완료 → ${ENDPOINT}`);
}

console.log(`[sync] ${DIR} → room "${ROOM}" @ ${URL_BASE}`);
await syncOnce().catch((err) => {
  console.error('[sync] 실패:', err.message);
  if (!WATCH) process.exit(1);
});

if (WATCH) {
  console.log(`[sync] ${INTERVAL}초마다 변경분을 감시합니다. (Ctrl+C로 종료)`);
  setInterval(() => {
    syncOnce().catch((err) => console.error('[sync] 실패:', err.message));
  }, INTERVAL * 1000);
}
