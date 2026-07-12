// Graphfy — 나에 대한 지식 그래프
// 프레임워크/라이브러리 없이 캔버스 + 자체 포스 레이아웃으로 렌더링.
// 서버(/api/graphfy)가 없으면 window.GRAPHFY_EMBED 데이터로 읽기 전용(로컬) 동작.

const TYPES = {
  self: { label: '나', color: '#d95926' },
  person: { label: '사람', color: '#3987e5' },
  project: { label: '프로젝트', color: '#199e70' },
  org: { label: '조직', color: '#c98500' },
  interest: { label: '관심사', color: '#9085e9' },
  life: { label: '일상', color: '#e66767' },
};
const SURFACE = '#0f1115';

const $ = (sel) => document.querySelector(sel);
const canvas = $('#canvas');
const ctx = canvas.getContext('2d');

const state = {
  graph: { meta: {}, nodes: [], edges: [] },
  serverMode: true, // false면 embed(읽기 전용 저장) 모드
  selected: null, // node id
  hovered: null,
  linking: false, // 연결 추가 모드
  localId: null, // 로컬 그래프(이웃만 보기) 중심 노드
  localSet: null,
  search: '',
  typeOff: new Set(),
  // 뷰: 현재값(x,y,k) + 목표값(tx,ty,tk) — 매 프레임 보간해 부드럽게 이동
  view: { x: 0, y: 0, k: 1, tx: 0, ty: 0, tk: 1 },
  dimA: 0, // 포커스 시 주변 어둡게 — 이징된 강도(0~1)
  alpha: 0, // 시뮬레이션 온도
  dragNode: null,
  saveTimer: null,
  mouseWorld: null,
};

// ---------- 데이터 로드/저장 ----------

async function load() {
  try {
    const res = await fetch('/api/graphfy');
    if (!res.ok) throw new Error(String(res.status));
    state.graph = await res.json();
  } catch {
    state.serverMode = false;
    state.graph = window.GRAPHFY_EMBED || { meta: { title: '나의 Graphfy' }, nodes: [], edges: [] };
    setSaveState('로컬 전용', '');
  }
  // 저장된 좌표가 없으면 미리 돌려서 안정된 레이아웃으로 시작
  const fresh = initPositions();
  if (fresh) {
    state.alpha = 1;
    for (let i = 0; i < 500 && state.alpha > 0.005; i++) tick();
  }
  buildLegend();
  applyMeta();
  fitView(false);
  reheat(0.15);
}

function applyMeta() {
  const meta = state.graph.meta || {};
  if (meta.title) $('#gfyTitle').textContent = `🕸️ ${meta.title}`;
  if (meta.subtitle) $('#gfySubtitle').textContent = meta.subtitle;
  document.title = meta.title ? `${meta.title} — Graphfy` : 'Graphfy';
}

function setSaveState(text, cls) {
  const el = $('#saveState');
  el.textContent = text;
  el.className = `save-state ${cls || ''}`;
}

function scheduleSave() {
  if (!state.serverMode) {
    setSaveState('로컬 전용', '');
    return;
  }
  setSaveState('저장 중…', '');
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(async () => {
    try {
      const body = {
        ...state.graph,
        nodes: state.graph.nodes.map((n) => ({ ...n, x: Math.round(n.x), y: Math.round(n.y), vx: undefined, vy: undefined })),
      };
      const res = await fetch('/api/graphfy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error || res.status);
      setSaveState('저장됨 ✓', 'saved');
    } catch (err) {
      setSaveState('저장 실패', 'error');
      console.warn('[graphfy] 저장 실패:', err);
    }
  }, 800);
}

// ---------- 그래프 유틸 ----------

const nodeById = (id) => state.graph.nodes.find((n) => n.id === id);

function degree(id) {
  return state.graph.edges.reduce((k, e) => k + (e.source === id || e.target === id ? 1 : 0), 0);
}

function radius(n) {
  if (n.type === 'self') return 27;
  return 11 + Math.min(11, Math.sqrt(degree(n.id)) * 3.2);
}

function neighbors(id) {
  const set = new Set();
  for (const e of state.graph.edges) {
    if (e.source === id) set.add(e.target);
    if (e.target === id) set.add(e.source);
  }
  return set;
}

function updateLocalSet() {
  if (!state.localId || !nodeById(state.localId)) {
    state.localId = null;
    state.localSet = null;
    return;
  }
  const set = neighbors(state.localId);
  set.add(state.localId);
  state.localSet = set;
}

function nodeVisible(n) {
  if (state.typeOff.has(n.type)) return false;
  if (state.localSet && !state.localSet.has(n.id)) return false;
  return true;
}

function nodeMatches(n) {
  if (!state.search) return true;
  return (n.label + ' ' + (n.desc || '')).toLowerCase().includes(state.search);
}

// ---------- 포스 레이아웃 ----------

function initPositions() {
  const nodes = state.graph.nodes;
  const R = 90 + nodes.length * 8;
  let fresh = false;
  nodes.forEach((n, i) => {
    if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) {
      fresh = true;
      const a = (i / nodes.length) * Math.PI * 2;
      const r = n.type === 'self' ? 0 : R * (0.55 + 0.45 * ((i * 7919) % 100) / 100);
      n.x = Math.cos(a) * r;
      n.y = Math.sin(a) * r;
    }
    n.vx = 0;
    n.vy = 0;
    n._hs = 1; // 호버 스케일 (이징)
  });
  return fresh;
}

function reheat(alpha = 0.6) {
  state.alpha = Math.max(state.alpha, alpha);
}

function tick() {
  const nodes = state.graph.nodes.filter(nodeVisible);
  const edges = state.graph.edges.filter((e) => {
    const s = nodeById(e.source);
    const t = nodeById(e.target);
    return s && t && nodeVisible(s) && nodeVisible(t);
  });
  const a = state.alpha;
  if (a < 0.005) return;

  // 반발력 (O(n²) — 노드 수백 개까지는 충분)
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const p = nodes[i];
      const q = nodes[j];
      let dx = q.x - p.x;
      let dy = q.y - p.y;
      let d2 = dx * dx + dy * dy;
      if (d2 < 1) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d2 = 1; }
      const f = Math.min(4, (3600 / Math.max(d2, 60)) * a);
      const d = Math.sqrt(d2);
      dx /= d; dy /= d;
      p.vx -= dx * f; p.vy -= dy * f;
      q.vx += dx * f; q.vy += dy * f;
    }
  }

  // 스프링 (엣지) — 가중치가 높을수록 살짝 더 당김
  for (const e of edges) {
    const s = nodeById(e.source);
    const t = nodeById(e.target);
    const rest = radius(s) + radius(t) + 95;
    let dx = t.x - s.x;
    let dy = t.y - s.y;
    const d = Math.max(1, Math.hypot(dx, dy));
    const k = 0.03 * (1 + 0.15 * ((e.w || 1) - 1));
    const f = Math.max(-3, Math.min(3, (d - rest) * k * a));
    dx = (dx / d) * f; dy = (dy / d) * f;
    s.vx += dx; s.vy += dy;
    t.vx -= dx; t.vy -= dy;
  }

  // 중심으로 약한 중력 + 감쇠 (+속도 상한으로 폭주 방지)
  for (const n of nodes) {
    n.vx -= n.x * 0.006 * a;
    n.vy -= n.y * 0.006 * a;
    if (state.dragNode === n) { n.vx = 0; n.vy = 0; continue; }
    n.vx *= 0.85;
    n.vy *= 0.85;
    const v = Math.hypot(n.vx, n.vy);
    if (v > 12) { n.vx = (n.vx / v) * 12; n.vy = (n.vy / v) * 12; }
    n.x += n.vx;
    n.y += n.vy;
  }

  // 겹침 방지 — 원끼리 최소 간격 유지
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const p = nodes[i];
      const q = nodes[j];
      const min = radius(p) + radius(q) + 8;
      let dx = q.x - p.x;
      let dy = q.y - p.y;
      const d = Math.max(0.1, Math.hypot(dx, dy));
      if (d < min) {
        const push = (min - d) / 2;
        dx /= d; dy /= d;
        if (state.dragNode !== p) { p.x -= dx * push; p.y -= dy * push; }
        if (state.dragNode !== q) { q.x += dx * push; q.y += dy * push; }
      }
    }
  }

  state.alpha *= 0.99;
}

// ---------- 렌더링 ----------

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const { clientWidth: w, clientHeight: h } = canvas;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function toWorld(px, py) {
  const { x, y, k } = state.view;
  return { x: (px - canvas.clientWidth / 2) / k - x, y: (py - canvas.clientHeight / 2) / k - y };
}

function hexA(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function edgeCurve(s, t) {
  // 살짝 휘어진 엣지 — 수직 방향으로 거리의 8%만큼 볼록
  const mx = (s.x + t.x) / 2;
  const my = (s.y + t.y) / 2;
  const dx = t.x - s.x;
  const dy = t.y - s.y;
  const d = Math.max(1, Math.hypot(dx, dy));
  const off = d * 0.08;
  const cx = mx - (dy / d) * off;
  const cy = my + (dx / d) * off;
  // 곡선 중점 (t=0.5)
  const px = 0.25 * s.x + 0.5 * cx + 0.25 * t.x;
  const py = 0.25 * s.y + 0.5 * cy + 0.25 * t.y;
  return { cx, cy, px, py };
}

function draw() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const view = state.view;

  // 뷰 보간 (부드러운 팬/줌/센터링)
  view.x += (view.tx - view.x) * 0.14;
  view.y += (view.ty - view.y) * 0.14;
  view.k += (view.tk - view.k) * 0.14;

  ctx.clearRect(0, 0, w, h);

  // 은은한 배경 비네트
  const bgGrad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
  bgGrad.addColorStop(0, '#141821');
  bgGrad.addColorStop(1, SURFACE);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(view.k, view.k);
  ctx.translate(view.x, view.y);

  const sel = state.selected;
  const hov = state.hovered;
  const focus = sel || hov;
  const hood = focus ? neighbors(focus) : null;
  const searching = !!state.search;

  // 포커스 디밍 강도 이징
  state.dimA += ((focus || searching ? 1 : 0) - state.dimA) * 0.15;
  const dimA = state.dimA;

  const visible = (n) => n && nodeVisible(n);
  const isDim = (n) => {
    if (searching && !nodeMatches(n)) return true;
    if (focus && n.id !== focus && !hood.has(n.id)) return true;
    return false;
  };
  const nodeAlpha = (n) => (isDim(n) ? 1 - 0.85 * dimA : 1);

  // 라벨은 확대할수록 선명해짐 (Obsidian 스타일)
  const zoomLabel = Math.max(0, Math.min(1, (view.k - 0.42) / 0.35));

  // ---- 엣지 ----
  for (const e of state.graph.edges) {
    const s = nodeById(e.source);
    const t = nodeById(e.target);
    if (!visible(s) || !visible(t)) continue;
    const active = focus && (e.source === focus || e.target === focus);
    const a = Math.min(nodeAlpha(s), nodeAlpha(t));
    const { cx, cy, px, py } = edgeCurve(s, t);
    const wgt = e.w || 1;

    ctx.strokeStyle = active ? hexA('#e0785a', 0.35 + 0.45 * a) : `rgba(96,108,126,${0.38 * a})`;
    ctx.lineWidth = ((active ? 1.1 : 0.7) + wgt * 0.55) / view.k;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.quadraticCurveTo(cx, cy, t.x, t.y);
    ctx.stroke();

    // 엣지 라벨 (확대 시 또는 포커스 시)
    const la = active ? 1 : zoomLabel;
    if (e.label && la > 0.05 && a > 0.5) {
      ctx.font = `${11 / view.k}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const pad = 3 / view.k;
      const tw = ctx.measureText(e.label).width;
      ctx.fillStyle = `rgba(15,17,21,${0.75 * la})`;
      ctx.fillRect(px - tw / 2 - pad, py - 7 / view.k, tw + pad * 2, 14 / view.k);
      ctx.fillStyle = active ? hexA('#e0785a', la) : `rgba(139,147,161,${la})`;
      ctx.fillText(e.label, px, py);
    }
  }

  // 연결 추가 모드: 선택 노드 → 마우스 위치 임시 선
  if (state.linking && sel && state.mouseWorld) {
    const s = nodeById(sel);
    if (s) {
      ctx.strokeStyle = 'rgba(224,120,90,0.9)';
      ctx.setLineDash([6 / view.k, 5 / view.k]);
      ctx.lineWidth = 2 / view.k;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(state.mouseWorld.x, state.mouseWorld.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // ---- 노드 (라벨은 겹침 방지를 위해 별도 패스로) ----
  const labelPass = [];
  for (const n of state.graph.nodes) {
    if (!visible(n)) continue;
    const color = TYPES[n.type]?.color || '#8b93a1';
    const a = nodeAlpha(n);
    const hot = n.id === sel || n.id === hov;

    // 호버 스케일 이징
    n._hs = (n._hs || 1) + ((hot ? 1.16 : 1) - (n._hs || 1)) * 0.2;
    const r = radius(n) * n._hs;

    ctx.globalAlpha = a;

    // 글로우 (halo)
    const glowR = r * (hot ? 2.6 : 2.1);
    const glow = ctx.createRadialGradient(n.x, n.y, r * 0.6, n.x, n.y, glowR);
    glow.addColorStop(0, hexA(color, hot ? 0.4 : 0.22));
    glow.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(n.x, n.y, glowR, 0, Math.PI * 2);
    ctx.fill();

    // 본체 + 서피스 링(2px)
    ctx.beginPath();
    ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 2 / view.k;
    ctx.strokeStyle = SURFACE;
    ctx.stroke();

    if (n.id === sel) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, r + 4 / view.k, 0, Math.PI * 2);
      ctx.lineWidth = 2 / view.k;
      ctx.strokeStyle = '#e0785a';
      ctx.stroke();
    }

    // 이모지
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (n.emoji) {
      ctx.font = `${Math.max(11, r * 1.02)}px sans-serif`;
      ctx.fillText(n.emoji, n.x, n.y + 1);
    }

    // 라벨 — 나/선택/호버/이웃은 항상, 나머지는 줌에 따라
    let la = zoomLabel;
    if (n.type === 'self' || hot || (focus && hood.has(n.id))) la = 1;
    if (la > 0.03) labelPass.push({ n, r, la: la * a });

    ctx.globalAlpha = 1;
  }

  // 라벨 패스 — 모든 원 위에 그려서 가려지지 않게
  for (const { n, r, la } of labelPass) {
    const fs = n.type === 'self' ? 14.5 : 12;
    ctx.font = `${n.type === 'self' ? 650 : 550} ${fs}px -apple-system, "Noto Sans KR", sans-serif`;
    ctx.textAlign = 'center';
    const ly = n.y + r + 4;
    const tw = ctx.measureText(n.label).width;
    ctx.fillStyle = `rgba(15,17,21,${0.7 * la})`;
    ctx.fillRect(n.x - tw / 2 - 3, ly, tw + 6, fs + 5);
    ctx.textBaseline = 'top';
    ctx.fillStyle = isDim(n) ? `rgba(139,147,161,${la})` : `rgba(230,233,239,${la})`;
    ctx.fillText(n.label, n.x, ly + 2);
  }

  ctx.restore();
}

function loop() {
  tick();
  draw();
  requestAnimationFrame(loop);
}

function fitView(animate = true) {
  const nodes = state.graph.nodes.filter(nodeVisible);
  if (!nodes.length) return;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x);
    minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y);
  }
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const gw = Math.max(100, maxX - minX + 240);
  const gh = Math.max(100, maxY - minY + 240);
  const v = state.view;
  v.tk = Math.min(1.4, Math.min(w / gw, h / gh));
  v.tx = -(minX + maxX) / 2;
  v.ty = -(minY + maxY) / 2;
  if (!animate) { v.x = v.tx; v.y = v.ty; v.k = v.tk; }
}

function centerOn(id, zoom = null) {
  const n = nodeById(id);
  if (!n) return;
  state.view.tx = -n.x;
  state.view.ty = -n.y;
  if (zoom) state.view.tk = zoom;
}

// ---------- 포인터 인터랙션 ----------

function nodeAt(px, py) {
  const { x, y } = toWorld(px, py);
  for (let i = state.graph.nodes.length - 1; i >= 0; i--) {
    const n = state.graph.nodes[i];
    if (!nodeVisible(n)) continue;
    const r = radius(n) + 6 / state.view.k; // 히트 영역은 마크보다 크게
    if ((n.x - x) ** 2 + (n.y - y) ** 2 <= r * r) return n;
  }
  return null;
}

const pointers = new Map();
let panStart = null;
let pinchStart = null;
let moved = false;

canvas.addEventListener('pointerdown', (ev) => {
  canvas.setPointerCapture(ev.pointerId);
  pointers.set(ev.pointerId, { x: ev.offsetX, y: ev.offsetY });
  moved = false;

  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinchStart = { d: Math.hypot(a.x - b.x, a.y - b.y), k: state.view.k };
    state.dragNode = null;
    panStart = null;
    return;
  }

  const n = nodeAt(ev.offsetX, ev.offsetY);
  if (n && !state.linking) {
    state.dragNode = n;
    reheat(0.25);
  } else {
    panStart = { px: ev.offsetX, py: ev.offsetY, vx: state.view.x, vy: state.view.y };
    canvas.classList.add('dragging');
  }
});

canvas.addEventListener('pointermove', (ev) => {
  const p = pointers.get(ev.pointerId);
  if (p) {
    if (Math.abs(ev.offsetX - p.x) + Math.abs(ev.offsetY - p.y) > 3) moved = true;
    p.x = ev.offsetX;
    p.y = ev.offsetY;
  }

  state.mouseWorld = toWorld(ev.offsetX, ev.offsetY);

  if (pointers.size === 2 && pinchStart) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    const k = Math.min(3, Math.max(0.15, (pinchStart.k * d) / pinchStart.d));
    state.view.k = k;
    state.view.tk = k;
    return;
  }

  if (state.dragNode) {
    const w = toWorld(ev.offsetX, ev.offsetY);
    state.dragNode.x = w.x;
    state.dragNode.y = w.y;
    reheat(0.12);
    return;
  }
  if (panStart) {
    const v = state.view;
    v.x = panStart.vx + (ev.offsetX - panStart.px) / v.k;
    v.y = panStart.vy + (ev.offsetY - panStart.py) / v.k;
    v.tx = v.x;
    v.ty = v.y;
    return;
  }

  const n = nodeAt(ev.offsetX, ev.offsetY);
  state.hovered = n ? n.id : null;
  canvas.style.cursor = state.linking ? 'crosshair' : n ? 'pointer' : 'grab';
});

canvas.addEventListener('pointerup', (ev) => {
  pointers.delete(ev.pointerId);
  pinchStart = null;
  canvas.classList.remove('dragging');

  const wasDragging = !!state.dragNode;
  state.dragNode = null;
  panStart = null;

  if (moved) {
    if (wasDragging) scheduleSave(); // 위치 저장
    return;
  }

  const n = nodeAt(ev.offsetX, ev.offsetY);
  if (state.linking) {
    if (n && n.id !== state.selected) addEdge(state.selected, n.id);
    setLinking(false);
    return;
  }
  if (n) selectNode(n.id);
  else {
    state.selected = null;
    hidePanel();
  }
});

// 휠 줌 — 커서 위치 기준
canvas.addEventListener('wheel', (ev) => {
  ev.preventDefault();
  const v = state.view;
  const w0 = toWorld(ev.offsetX, ev.offsetY);
  const k2 = Math.min(3, Math.max(0.15, v.k * Math.exp(-ev.deltaY * 0.0015)));
  v.k = k2;
  v.tk = k2;
  v.x = (ev.offsetX - canvas.clientWidth / 2) / k2 - w0.x;
  v.y = (ev.offsetY - canvas.clientHeight / 2) / k2 - w0.y;
  v.tx = v.x;
  v.ty = v.y;
}, { passive: false });

// ---------- 범례/필터 ----------

function buildLegend() {
  const el = $('#legend');
  el.innerHTML = '';
  for (const [type, info] of Object.entries(TYPES)) {
    const count = state.graph.nodes.filter((n) => n.type === type).length;
    if (!count && type !== 'self') continue;
    const chip = document.createElement('button');
    chip.className = 'chip' + (state.typeOff.has(type) ? ' off' : '');
    chip.innerHTML = `<span class="dot" style="background:${info.color}"></span>${info.label} <span style="color:var(--muted)">${count}</span>`;
    chip.onclick = () => {
      if (state.typeOff.has(type)) state.typeOff.delete(type);
      else state.typeOff.add(type);
      chip.classList.toggle('off', state.typeOff.has(type));
      reheat(0.4);
    };
    el.appendChild(chip);
  }
}

// ---------- 상세 패널 ----------

function typeOptions(selected) {
  return Object.entries(TYPES)
    .map(([t, i]) => `<option value="${t}" ${t === selected ? 'selected' : ''}>${i.label}</option>`)
    .join('');
}

function selectNode(id) {
  state.selected = id;
  const n = nodeById(id);
  if (!n) return;
  $('#panel').hidden = false;
  $('#panelEmoji').textContent = n.emoji || '⬤';
  $('#panelLabel').value = n.label;
  $('#panelType').innerHTML = typeOptions(n.type);
  $('#panelEmojiInput').value = n.emoji || '';
  $('#panelDesc').value = n.desc || '';
  updateLocalBtn();
  renderLinks(n);
  $('#hint').classList.add('hide');
}

function renderLinks(n) {
  const ul = $('#panelLinks');
  ul.innerHTML = '';
  const related = state.graph.edges.filter((e) => e.source === n.id || e.target === n.id);
  if (!related.length) {
    ul.innerHTML = '<li style="color:var(--muted)">아직 연결이 없어요.</li>';
    return;
  }
  for (const e of related) {
    const otherId = e.source === n.id ? e.target : e.source;
    const other = nodeById(otherId);
    if (!other) continue;
    const li = document.createElement('li');
    const color = TYPES[other.type]?.color || '#8b93a1';
    li.innerHTML = `
      <span class="dot" style="background:${color}"></span>
      <span class="to">${other.emoji || ''} ${escapeHtml(other.label)}</span>
      <input class="rel" placeholder="관계" value="${escapeHtml(e.label || '')}" />
      <button class="unlink" title="연결 해제">✕</button>`;
    li.querySelector('.to').onclick = () => {
      selectNode(otherId);
      centerOn(otherId, Math.max(state.view.tk, 0.9));
    };
    li.querySelector('.rel').onchange = (ev) => {
      e.label = ev.target.value.trim();
      scheduleSave();
    };
    li.querySelector('.unlink').onclick = () => {
      state.graph.edges = state.graph.edges.filter((x) => x !== e);
      renderLinks(n);
      reheat(0.3);
      scheduleSave();
    };
    ul.appendChild(li);
  }
}

function hidePanel() {
  $('#panel').hidden = true;
  setLinking(false);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// 패널 편집 → 그래프 반영
$('#panelLabel').addEventListener('change', (ev) => {
  const n = nodeById(state.selected);
  if (!n) return;
  n.label = ev.target.value.trim() || n.label;
  ev.target.value = n.label;
  scheduleSave();
});
$('#panelType').addEventListener('change', (ev) => {
  const n = nodeById(state.selected);
  if (!n) return;
  n.type = ev.target.value;
  buildLegend();
  scheduleSave();
});
$('#panelEmojiInput').addEventListener('change', (ev) => {
  const n = nodeById(state.selected);
  if (!n) return;
  n.emoji = ev.target.value.trim();
  $('#panelEmoji').textContent = n.emoji || '⬤';
  scheduleSave();
});
$('#panelDesc').addEventListener('change', (ev) => {
  const n = nodeById(state.selected);
  if (!n) return;
  n.desc = ev.target.value;
  scheduleSave();
});
$('#panelClose').onclick = () => {
  state.selected = null;
  hidePanel();
};
$('#btnDeleteNode').onclick = () => {
  const n = nodeById(state.selected);
  if (!n) return;
  if (n.type === 'self') return alert('"나" 노드는 지울 수 없어요 🙂');
  if (!confirm(`"${n.label}" 노드와 연결을 삭제할까요?`)) return;
  state.graph.nodes = state.graph.nodes.filter((x) => x.id !== n.id);
  state.graph.edges = state.graph.edges.filter((e) => e.source !== n.id && e.target !== n.id);
  state.selected = null;
  if (state.localId === n.id) { state.localId = null; state.localSet = null; }
  hidePanel();
  buildLegend();
  reheat(0.4);
  scheduleSave();
};

// ---------- 로컬 그래프 (이웃만 보기) ----------

function updateLocalBtn() {
  const btn = $('#btnLocal');
  const on = state.localId && state.localId === state.selected;
  btn.textContent = on ? '◉ 전체 그래프 보기' : '◎ 로컬 그래프';
  btn.classList.toggle('accent', !!on);
}

$('#btnLocal').onclick = () => {
  if (state.localId === state.selected) {
    state.localId = null;
    state.localSet = null;
  } else {
    state.localId = state.selected;
    updateLocalSet();
  }
  updateLocalBtn();
  reheat(0.5);
  setTimeout(() => fitView(true), 250);
};

// ---------- 연결 추가 ----------

function setLinking(on) {
  state.linking = on;
  canvas.classList.toggle('linking', on);
  const hint = $('#hint');
  if (on) {
    hint.textContent = '연결할 노드를 클릭하세요 (빈 곳 클릭 시 취소)';
    hint.classList.add('linking');
    hint.classList.remove('hide');
  } else {
    hint.classList.remove('linking');
    hint.classList.add('hide');
  }
}

function addEdge(sourceId, targetId) {
  if (!sourceId || !targetId) return;
  const dup = state.graph.edges.some(
    (e) => (e.source === sourceId && e.target === targetId) || (e.source === targetId && e.target === sourceId),
  );
  if (dup) return;
  const id = 'e' + (Date.now() % 1e7).toString(36) + Math.floor(Math.random() * 100);
  state.graph.edges.push({ id, source: sourceId, target: targetId, label: '', w: 1 });
  updateLocalSet();
  renderLinks(nodeById(sourceId));
  reheat(0.3);
  scheduleSave();
}

$('#btnLink').onclick = () => setLinking(!state.linking);

// ---------- 툴바 ----------

$('#btnAddNode').onclick = () => {
  const id = 'n' + Date.now().toString(36);
  const c = toWorld(canvas.clientWidth / 2, canvas.clientHeight / 2);
  const node = { id, type: 'interest', label: '새 노드', emoji: '✨', desc: '', x: c.x + 30, y: c.y + 30, vx: 0, vy: 0, _hs: 1 };
  state.graph.nodes.push(node);
  buildLegend();
  selectNode(id);
  reheat(0.3);
  scheduleSave();
  $('#panelLabel').focus();
  $('#panelLabel').select();
};

$('#btnFit').onclick = () => fitView(true);

$('#gfySearch').addEventListener('input', (ev) => {
  state.search = ev.target.value.trim().toLowerCase();
});

$('#btnExport').onclick = () => {
  const data = JSON.stringify(state.graph, null, 2);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
  a.download = 'graphfy.json';
  a.click();
  URL.revokeObjectURL(a.href);
};

$('#btnImport').onclick = () => $('#importFile').click();
$('#importFile').addEventListener('change', async (ev) => {
  const file = ev.target.files?.[0];
  if (!file) return;
  try {
    const graph = JSON.parse(await file.text());
    if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) throw new Error('nodes/edges가 없어요.');
    state.graph = graph;
    state.selected = null;
    state.localId = null;
    state.localSet = null;
    hidePanel();
    initPositions();
    buildLegend();
    applyMeta();
    fitView(true);
    reheat(1);
    scheduleSave();
  } catch (err) {
    alert(`가져오기 실패: ${err.message}`);
  }
  ev.target.value = '';
});

// ---------- 제안함 (자동 갱신 루틴 → 사용자 승인) ----------

const suggest = { items: [] };

async function loadSuggestions() {
  if (!state.serverMode) return;
  try {
    const res = await fetch('/api/graphfy/suggestions');
    if (!res.ok) return;
    suggest.items = (await res.json()).suggestions || [];
  } catch {
    return;
  }
  renderSuggestBadge();
}

function renderSuggestBadge() {
  const btn = $('#btnSuggest');
  const n = suggest.items.length;
  btn.hidden = !state.serverMode || (n === 0 && $('#suggestPanel').hidden);
  $('#suggestCount').textContent = n;
}

function suggestNodeLabel(id) {
  const n = nodeById(id);
  return n ? `${n.emoji || ''} ${n.label}`.trim() : id;
}

function renderSuggestList() {
  const ul = $('#suggestList');
  ul.innerHTML = '';
  if (!suggest.items.length) {
    ul.innerHTML = '<li class="sg-empty">대기 중인 제안이 없어요.<br>Claude Code에서 <b>/graphfy-update</b>를 실행해 보세요.</li>';
    return;
  }
  for (const s of suggest.items) {
    const li = document.createElement('li');
    li.className = 'sg-item';
    if (s.kind === 'edge') {
      const ok = nodeById(s.source) && nodeById(s.target);
      li.innerHTML = `
        <div class="sg-title"><span class="dot" style="background:#8b93a1"></span>연결 제안</div>
        <div class="sg-links"><b>${escapeHtml(suggestNodeLabel(s.source))}</b> ↔ <b>${escapeHtml(suggestNodeLabel(s.target))}</b>${s.label ? ` · ${escapeHtml(s.label)}` : ''}</div>
        ${s.reason ? `<div class="sg-reason">💡 ${escapeHtml(s.reason)}</div>` : ''}
        <div class="sg-actions">
          <button class="btn accent sg-accept" ${ok ? '' : 'disabled title="노드를 찾을 수 없어요"'}>추가</button>
          <button class="btn sg-dismiss">무시</button>
        </div>`;
    } else {
      const color = TYPES[s.type]?.color || '#8b93a1';
      const links = (s.connectTo || []).filter((c) => nodeById(c.id));
      li.innerHTML = `
        <div class="sg-title"><span class="dot" style="background:${color}"></span>${escapeHtml(s.emoji || '')} ${escapeHtml(s.label)} <span style="color:var(--muted);font-weight:400">· ${TYPES[s.type]?.label || s.type}</span></div>
        ${s.desc ? `<div class="sg-desc">${escapeHtml(s.desc)}</div>` : ''}
        ${links.length ? `<div class="sg-links">연결: ${links.map((c) => `<b>${escapeHtml(suggestNodeLabel(c.id))}</b>${c.label ? `(${escapeHtml(c.label)})` : ''}`).join(', ')}</div>` : ''}
        ${s.reason ? `<div class="sg-reason">💡 ${escapeHtml(s.reason)}${s.sourceInfo ? ` — ${escapeHtml(s.sourceInfo)}` : ''}</div>` : ''}
        <div class="sg-actions">
          <button class="btn accent sg-accept">추가</button>
          <button class="btn sg-dismiss">무시</button>
        </div>`;
    }
    li.querySelector('.sg-accept')?.addEventListener('click', () => acceptSuggestion(s));
    li.querySelector('.sg-dismiss').addEventListener('click', () => resolveSuggestion(s, false));
    ul.appendChild(li);
  }
}

function acceptSuggestion(s) {
  if (s.kind === 'edge') {
    if (nodeById(s.source) && nodeById(s.target)) {
      const id = 'e' + (Date.now() % 1e7).toString(36) + Math.floor(Math.random() * 100);
      const dup = state.graph.edges.some(
        (e) => (e.source === s.source && e.target === s.target) || (e.source === s.target && e.target === s.source),
      );
      if (!dup) state.graph.edges.push({ id, source: s.source, target: s.target, label: s.label || '', w: 1 });
    }
  } else {
    // 새 노드 — 첫 연결 노드 근처에 배치
    let id = s.label.toLowerCase().replace(/[^a-z0-9가-힣]+/g, '').slice(0, 24) || 'n';
    while (nodeById(id)) id += '_';
    const anchor = (s.connectTo || []).map((c) => nodeById(c.id)).find(Boolean) || nodeById('me');
    const node = {
      id,
      type: s.type,
      label: s.label,
      emoji: s.emoji || '',
      desc: s.desc || '',
      x: (anchor ? anchor.x : 0) + 60 + Math.random() * 40,
      y: (anchor ? anchor.y : 0) + 60 + Math.random() * 40,
      vx: 0,
      vy: 0,
      _hs: 1,
    };
    state.graph.nodes.push(node);
    for (const c of s.connectTo || []) {
      if (!nodeById(c.id)) continue;
      const eid = 'e' + (Date.now() % 1e7).toString(36) + Math.floor(Math.random() * 100);
      state.graph.edges.push({ id: eid, source: id, target: c.id, label: c.label || '', w: 1 });
    }
    selectNode(id);
    centerOn(id, Math.max(state.view.tk, 0.9));
  }
  buildLegend();
  updateLocalSet();
  reheat(0.4);
  scheduleSave();
  resolveSuggestion(s, true);
}

async function resolveSuggestion(s) {
  suggest.items = suggest.items.filter((x) => x.id !== s.id);
  renderSuggestBadge();
  renderSuggestList();
  try {
    await fetch(`/api/graphfy/suggestions/${encodeURIComponent(s.id)}`, { method: 'DELETE' });
  } catch (err) {
    console.warn('[graphfy] 제안 삭제 실패:', err);
  }
}

$('#btnSuggest').onclick = () => {
  const panel = $('#suggestPanel');
  panel.hidden = !panel.hidden;
  if (!panel.hidden) renderSuggestList();
  renderSuggestBadge();
};
$('#suggestClose').onclick = () => {
  $('#suggestPanel').hidden = true;
  renderSuggestBadge();
};

// 5초 뒤 힌트 감춤
setTimeout(() => $('#hint').classList.add('hide'), 6000);

// ---------- 시작 ----------

window.addEventListener('resize', resize);
resize();
load().then(() => {
  resize();
  fitView(false);
  loadSuggestions();
});
requestAnimationFrame(loop);
