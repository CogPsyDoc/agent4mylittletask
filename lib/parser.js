// Claude Code 세션(JSONL) 파서.
// ~/.claude/projects/<encoded-cwd>/<sessionId>.jsonl 형식을 읽어
// 화면에 뿌리기 좋은 구조로 변환한다.

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

// 한 줄(JSON)에서 표시할 블록들을 뽑아낸다.
// content 는 문자열이거나 { type, ... } 블록 배열이다.
function extractBlocks(content) {
  if (content == null) return [];
  if (typeof content === 'string') {
    return content.trim() ? [{ type: 'text', text: content }] : [];
  }
  if (!Array.isArray(content)) return [];

  const blocks = [];
  for (const b of content) {
    if (!b || typeof b !== 'object') continue;
    switch (b.type) {
      case 'text':
        if (b.text && b.text.trim()) blocks.push({ type: 'text', text: b.text });
        break;
      case 'thinking':
        if (b.thinking && b.thinking.trim()) blocks.push({ type: 'thinking', text: b.thinking });
        break;
      case 'tool_use':
        blocks.push({
          type: 'tool_use',
          name: b.name || 'tool',
          input: safeStringify(b.input),
        });
        break;
      case 'tool_result':
        blocks.push({
          type: 'tool_result',
          output: flattenToolResult(b.content),
          isError: !!b.is_error,
        });
        break;
      default:
        // image 등 알 수 없는 블록은 간단히 표기
        blocks.push({ type: 'other', text: `[${b.type}]` });
    }
  }
  return blocks;
}

function flattenToolResult(content) {
  if (content == null) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((c) => (typeof c === 'string' ? c : c && c.type === 'text' ? c.text : c && c.text) || '')
      .filter(Boolean)
      .join('\n');
  }
  return safeStringify(content);
}

function safeStringify(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

// 블록 배열에서 첫 텍스트를 미리보기용으로 뽑는다.
function firstText(blocks) {
  const t = blocks.find((b) => b.type === 'text');
  return t ? t.text : '';
}

// 파일 하나(세션 하나)를 파싱한다.
export async function parseSessionFile(filePath) {
  const id = path.basename(filePath).replace(/\.jsonl$/, '');
  const messages = [];
  let cwd = null;
  let gitBranch = null;
  let version = null;
  let summary = null;
  let firstTs = null;
  let lastTs = null;

  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let row;
    try {
      row = JSON.parse(trimmed);
    } catch {
      continue; // 깨진 줄은 건너뜀
    }

    if (row.cwd) cwd = row.cwd;
    if (row.gitBranch) gitBranch = row.gitBranch;
    if (row.version) version = row.version;
    if (row.timestamp) {
      if (!firstTs) firstTs = row.timestamp;
      lastTs = row.timestamp;
    }

    if (row.type === 'summary' && row.summary) {
      summary = row.summary;
      continue;
    }

    if ((row.type === 'user' || row.type === 'assistant') && row.message) {
      const role = row.message.role || row.type;
      const blocks = extractBlocks(row.message.content);
      if (blocks.length === 0) continue; // 내용 없는 메타 라인 스킵

      // tool_result 만 있는 user 라인은 "도구 결과" 로 표시
      const onlyToolResult =
        role === 'user' && blocks.every((b) => b.type === 'tool_result');

      messages.push({
        role: onlyToolResult ? 'tool' : role,
        blocks,
        timestamp: row.timestamp || null,
        isMeta: /^\s*<(system-reminder|command-name|local-command)/.test(firstText(blocks)),
      });
    }
  }

  // 제목: summary > 첫 사용자 텍스트 > 세션 ID
  const firstUser = messages.find((m) => m.role === 'user' && !m.isMeta);
  const derivedTitle =
    summary ||
    (firstUser ? truncate(firstText(firstUser.blocks), 80) : '') ||
    id.slice(0, 8);

  const preview = firstUser ? truncate(firstText(firstUser.blocks).replace(/\s+/g, ' '), 140) : '';

  return {
    id,
    title: derivedTitle,
    preview,
    project: cwd || 'unknown',
    projectName: cwd ? path.basename(cwd) : 'unknown',
    gitBranch,
    version,
    messageCount: messages.filter((m) => !m.isMeta).length,
    createdAt: firstTs,
    updatedAt: lastTs,
    messages,
  };
}

function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

// 트랜스크립트 루트 디렉터리를 훑어 모든 세션 파일을 찾는다.
// <root>/<projectDir>/<session>.jsonl 구조.
export function findSessionFiles(root) {
  const results = [];
  let projectDirs;
  try {
    projectDirs = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const d of projectDirs) {
    if (!d.isDirectory()) {
      if (d.isFile() && d.name.endsWith('.jsonl')) {
        results.push(path.join(root, d.name));
      }
      continue;
    }
    const dirPath = path.join(root, d.name);
    let files;
    try {
      files = fs.readdirSync(dirPath);
    } catch {
      continue;
    }
    for (const f of files) {
      if (f.endsWith('.jsonl')) results.push(path.join(dirPath, f));
    }
  }
  return results;
}
