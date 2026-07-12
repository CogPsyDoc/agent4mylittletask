#!/usr/bin/env node
// Graphfy 제안 추가 CLI — /graphfy-update 루틴이 사용
//
//   node scripts/graphfy-suggest.js suggestions.json   # 파일에서
//   cat suggestions.json | node scripts/graphfy-suggest.js -   # stdin에서
//
// 입력: 제안 배열 또는 {suggestions: [...]}
//   노드 제안: { "kind": "node", "label": "홍길동", "type": "person", "emoji": "🙂",
//               "desc": "...", "connectTo": [{"id": "me", "label": "미팅"}],
//               "reason": "7/15 캘린더 미팅 3회", "sourceInfo": "calendar" }
//   엣지 제안: { "kind": "edge", "source": "me", "target": "kyle", "label": "협업",
//               "reason": "...", "sourceInfo": "slack" }
//
// data/graphfy-suggestions.json 에 저장되며, Graphfy UI의 🔔 제안함에서 추가/무시로 확정한다.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SuggestionStore } from '../lib/graphfy.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = process.argv[2];

if (!file) {
  console.error('사용법: node scripts/graphfy-suggest.js <suggestions.json | ->');
  process.exit(1);
}

const raw = file === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(file, 'utf8');
let input;
try {
  input = JSON.parse(raw);
} catch (err) {
  console.error(`JSON 파싱 실패: ${err.message}`);
  process.exit(1);
}

const store = new SuggestionStore(path.join(__dirname, '..', 'data', 'graphfy-suggestions.json'));
try {
  const added = store.add(input);
  console.log(`제안 ${added}건 추가됨 (대기 중 총 ${store.list().length}건)`);
  console.log('Graphfy(/graphfy)의 🔔 제안함에서 확인하세요.');
} catch (err) {
  console.error(`추가 실패: ${err.message}`);
  process.exit(1);
}
