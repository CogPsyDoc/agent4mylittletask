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
