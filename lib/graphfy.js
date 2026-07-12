// Graphfy 저장소
// - data/graphfy.json 에 그래프(노드/엣지)를 저장
// - 파일이 없으면 sample-data/graphfy-seed.json 을 복사해 시작

import fs from 'node:fs';
import path from 'node:path';

const NODE_TYPES = new Set(['self', 'person', 'org', 'project', 'interest', 'life']);

export class GraphStore {
  constructor(file, seedFile) {
    this.file = file;
    this.seedFile = seedFile;
    this.graph = this.#load();
  }

  #load() {
    try {
      if (fs.existsSync(this.file)) {
        return JSON.parse(fs.readFileSync(this.file, 'utf8'));
      }
      if (this.seedFile && fs.existsSync(this.seedFile)) {
        const seed = JSON.parse(fs.readFileSync(this.seedFile, 'utf8'));
        this.#save(seed);
        return seed;
      }
    } catch (err) {
      console.warn(`[graphfy] 그래프 로드 실패: ${err.message}`);
    }
    return { meta: { title: '나의 Graphfy' }, nodes: [], edges: [] };
  }

  #save(graph) {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(graph, null, 2));
  }

  get() {
    return this.graph;
  }

  set(input) {
    const graph = validateGraph(input);
    graph.meta = { ...this.graph.meta, ...graph.meta, updatedAt: new Date().toISOString() };
    this.graph = graph;
    this.#save(graph);
    return graph;
  }
}

// ---- 제안함 ----
// 자동 갱신 루틴(/graphfy-update)이 넣어둔 노드/관계 제안을 보관.
// 그래프를 직접 수정하지 않고, 사용자가 UI에서 추가/무시로 확정한다.
export class SuggestionStore {
  constructor(file) {
    this.file = file;
    this.items = this.#load();
  }

  #load() {
    try {
      if (fs.existsSync(this.file)) {
        const data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
        if (Array.isArray(data.suggestions)) return data.suggestions;
      }
    } catch (err) {
      console.warn(`[graphfy] 제안함 로드 실패: ${err.message}`);
    }
    return [];
  }

  #save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify({ suggestions: this.items }, null, 2));
  }

  list() {
    return this.items;
  }

  // 검증 + 중복(같은 라벨의 대기 제안) 제거 후 추가. 추가된 개수 반환.
  add(input) {
    const arr = Array.isArray(input) ? input : Array.isArray(input?.suggestions) ? input.suggestions : null;
    if (!arr) throw new Error('제안 배열이 필요해요. ([...] 또는 {suggestions: [...]})');
    let added = 0;
    for (const raw of arr) {
      const s = validateSuggestion(raw);
      if (!s) continue;
      const dup = this.items.some(
        (x) => x.kind === s.kind && x.label === s.label && (x.target || '') === (s.target || ''),
      );
      if (dup) continue;
      s.id = 's' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36) + added;
      s.createdAt = new Date().toISOString();
      this.items.push(s);
      added++;
    }
    if (added) this.#save();
    return added;
  }

  remove(id) {
    const before = this.items.length;
    this.items = this.items.filter((s) => s.id !== id);
    if (this.items.length !== before) this.#save();
    return this.items.length !== before;
  }
}

export function validateSuggestion(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const kind = raw.kind === 'edge' ? 'edge' : 'node';
  const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

  if (kind === 'edge') {
    const source = str(raw.source, 100);
    const target = str(raw.target, 100);
    if (!source || !target || source === target) return null;
    return {
      kind,
      source,
      target,
      label: str(raw.label, 100),
      reason: str(raw.reason, 500),
      sourceInfo: str(raw.sourceInfo || raw.from, 200),
    };
  }

  const label = str(raw.label, 100);
  if (!label) return null;
  const connectTo = (Array.isArray(raw.connectTo) ? raw.connectTo : [])
    .map((c) => (typeof c === 'string' ? { id: c, label: '' } : { id: str(c?.id, 100), label: str(c?.label, 100) }))
    .filter((c) => c.id)
    .slice(0, 8);
  return {
    kind,
    label,
    type: NODE_TYPES.has(raw.type) ? raw.type : 'interest',
    emoji: str(raw.emoji, 8),
    desc: str(raw.desc, 2000),
    connectTo,
    reason: str(raw.reason, 500),
    sourceInfo: str(raw.sourceInfo || raw.from, 200),
  };
}

export function validateGraph(input) {
  if (!input || typeof input !== 'object') throw new Error('그래프 형식이 아니에요.');
  const nodes = Array.isArray(input.nodes) ? input.nodes : null;
  const edges = Array.isArray(input.edges) ? input.edges : null;
  if (!nodes || !edges) throw new Error('nodes / edges 배열이 필요해요.');

  const ids = new Set();
  const cleanNodes = nodes.map((n) => {
    const id = String(n.id || '').trim();
    const label = String(n.label || '').trim();
    if (!id || !label) throw new Error('노드에는 id와 label이 필요해요.');
    if (ids.has(id)) throw new Error(`노드 id가 중복됐어요: ${id}`);
    ids.add(id);
    return {
      id,
      type: NODE_TYPES.has(n.type) ? n.type : 'interest',
      label,
      emoji: typeof n.emoji === 'string' ? n.emoji.slice(0, 8) : '',
      desc: typeof n.desc === 'string' ? n.desc.slice(0, 2000) : '',
      // 마크다운 노트 — [[노드이름]] 위키링크 지원
      ...(typeof n.note === 'string' && n.note.trim() ? { note: n.note.slice(0, 20000) } : {}),
      // 저장된 좌표가 있으면 유지 (레이아웃 고정용)
      ...(Number.isFinite(n.x) && Number.isFinite(n.y) ? { x: n.x, y: n.y } : {}),
    };
  });

  const edgeIds = new Set();
  const cleanEdges = edges
    .filter((e) => ids.has(e.source) && ids.has(e.target) && e.source !== e.target)
    .map((e, i) => {
      let id = String(e.id || `e${i + 1}`);
      while (edgeIds.has(id)) id += '_';
      edgeIds.add(id);
      const edge = {
        id,
        source: e.source,
        target: e.target,
        label: typeof e.label === 'string' ? e.label.slice(0, 100) : '',
      };
      // 관계 가중치 (1~3) — 엣지 두께에 반영
      const w = Number(e.w);
      if (Number.isFinite(w)) edge.w = Math.max(1, Math.min(3, Math.round(w)));
      return edge;
    });

  return { meta: typeof input.meta === 'object' && input.meta ? input.meta : {}, nodes: cleanNodes, edges: cleanEdges };
}
