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

const $ = (sel) => document.querySelector(sel);
const canvas = $('#canvas');
const ctx = canvas.getContext('2d');

const state = {
  graph: { meta: {}, nodes: [], edges: [] },
  serverMode: true, // false면 embed(읽기 전용 저장) 모드
  selected: null, // node id
  hovered: null,
  linking: false, // 연결 추가 모드
  search: '',
  typeOff: new Set(),
  view: { x: 0, y: 0, k: 1 }, // pan/zoom
  alpha: 0, // 시뮬레이션 온도
  dragNode: null,
  saveTimer: null,
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
    for (let i = 0; i < 400 && state.alpha > 0.005; i++) tick();
  }
  buildLegend();
  applyMeta();
  fitView();
  reheat(0.2);
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
  if (n.type === 'self') return 26;
  return 12 + Math.min(10, Math.sqrt(degree(n.id)) * 3);
}

function neighbors(id) {
  const set = new Set();
  for (const e of state.graph.edges) {
    if (e.source === id) set.add(e.target);
    if (e.target === id) set.add(e.source);
  }
  return set;
}

function nodeVisible(n) {
  if (state.typeOff.has(n.type)) return false;
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
  });
  return fresh;
}

function reheat(alpha = 0.6) {
  state.alpha = Math.max(state.alpha, alpha);
}

function tick() {
  const nodes = state.graph.nodes.filter(nodeVisible);
  const edges = state.graph.edges.filter(
    (e) => nodeById(e.source) && nodeById(e.target) && nodeVisible(nodeById(e.source)) && nodeVisible(nodeById(e.target)),
  );
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

  // 스프링 (엣지)
  for (const e of edges) {
    const s = nodeById(e.source);
    const t = nodeById(e.target);
    const rest = radius(s) + radius(t) + 95;
    let dx = t.x - s.x;
    let dy = t.y - s.y;
    const d = Math.max(1, Math.hypot(dx, dy));
    const f = Math.max(-3, Math.min(3, (d - rest) * 0.03 * a));
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

function draw() {
  const { clientWidth: w, clientHeight: h } = canvas;
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(state.view.k, state.view.k);
  ctx.translate(state.view.x, state.view.y);

  const sel = state.selected;
  const hov = state.hovered;
  const focus = sel || hov;
  const hood = focus ? neighbors(focus) : null;
  const searching = !!state.search;

  const visible = (n) => n && nodeVisible(n);
  const dimmed = (n) => {
    if (searching && !nodeMatches(n)) return true;
    if (focus && n.id !== focus && !hood.has(n.id)) return true;
    return false;
  };

  // 엣지
  for (const e of state.graph.edges) {
    const s = nodeById(e.source);
    const t = nodeById(e.target);
    if (!visible(s) || !visible(t)) continue;
    const active = focus && (e.source === focus || e.target === focus);
    const dim = dimmed(s) || dimmed(t);
    ctx.strokeStyle = active ? 'rgba(224,120,90,0.75)' : dim ? 'rgba(42,49,60,0.35)' : 'rgba(96,108,126,0.45)';
    ctx.lineWidth = (active ? 2 : 1.5) / state.view.k;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(t.x, t.y);
    ctx.stroke();

    // 엣지 라벨 (확대 시 또는 포커스 시)
    if (e.label && (state.view.k > 0.85 || active) && !dim) {
      const mx = (s.x + t.x) / 2;
      const my = (s.y + t.y) / 2;
      ctx.font = `${11 / state.view.k}px sans-serif`;
      ctx.fillStyle = active ? '#e0785a' : '#8b93a1';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const pad = 3 / state.view.k;
      const tw = ctx.measureText(e.label).width;
      ctx.fillStyle = 'rgba(15,17,21,0.75)';
      ctx.fillRect(mx - tw / 2 - pad, my - 7 / state.view.k, tw + pad * 2, 14 / state.view.k);
      ctx.fillStyle = active ? '#e0785a' : '#8b93a1';
      ctx.fillText(e.label, mx, my);
    }
  }

  // 연결 추가 모드: 선택 노드 → 마우스 위치 임시 선
  if (state.linking && sel && state.mouseWorld) {
    const s = nodeById(sel);
    if (s) {
      ctx.strokeStyle = 'rgba(224,120,90,0.9)';
      ctx.setLineDash([6 / state.view.k, 5 / state.view.k]);
      ctx.lineWidth = 2 / state.view.k;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(state.mouseWorld.x, state.mouseWorld.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // 노드
  for (const n of state.graph.nodes) {
    if (!visible(n)) continue;
    const r = radius(n);
    const dim = dimmed(n);
    const color = TYPES[n.type]?.color || '#8b93a1';

    ctx.globalAlpha = dim ? 0.18 : 1;

    // 채움 + 서피스 링(2px)
    ctx.beginPath();
    ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 2 / state.view.k;
    ctx.strokeStyle = '#0f1115';
    ctx.stroke();

    if (n.id === sel || n.id === hov) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, r + 3.5 / state.view.k, 0, Math.PI * 2);
      ctx.lineWidth = 2 / state.view.k;
      ctx.strokeStyle = n.id === sel ? '#e0785a' : 'rgba(224,120,90,0.55)';
      ctx.stroke();
    }

    // 이모지 & 라벨
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (n.emoji) {
      ctx.font = `${Math.max(11, r * 1.05)}px sans-serif`;
      ctx.fillText(n.emoji, n.x, n.y + 1);
    }
    const fs = n.type === 'self' ? 14 : 12;
    ctx.font = `${n.type === 'self' ? 650 : 550} ${fs}px -apple-system, "Noto Sans KR", sans-serif`;
    const ly = n.y + r + 4;
    ctx.fillStyle = 'rgba(15,17,21,0.7)';
    const tw = ctx.measureText(n.label).width;
    ctx.fillRect(n.x - tw / 2 - 3, ly, tw + 6, fs + 5);
    ctx.fillStyle = dim ? '#8b93a1' : '#e6e9ef';
    ctx.textBaseline = 'top';
    ctx.fillText(n.label, n.x, ly + 2);

    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

function loop() {
  tick();
  draw();
  requestAnimationFrame(loop);
}

function fitView() {
  const nodes = state.graph.nodes.filter(nodeVisible);
  if (!nodes.length) return;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x);
    minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y);
  }
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const gw = Math.max(100, maxX - minX + 220);
  const gh = Math.max(100, maxY - minY + 220);
  state.view.k = Math.min(1.4, Math.min(w / gw, h / gh));
  state.view.x = -(minX + maxX) / 2;
  state.view.y = -(minY + maxY) / 2;
}

// ---------- 포인터 인터랙션 ----------

function nodeAt(px, py) {
  const { x, y } = toWorld(px, py);
  // 위에 그려진(뒤에 있는) 노드 우선
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
    reheat(0.3);
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
    state.view.k = Math.min(3, Math.max(0.15, (pinchStart.k * d) / pinchStart.d));
    return;
  }

  if (state.dragNode) {
    const w = toWorld(ev.offsetX, ev.offsetY);
    state.dragNode.x = w.x;
    state.dragNode.y = w.y;
    reheat(0.15);
    return;
  }
  if (panStart) {
    state.view.x = panStart.vx + (ev.offsetX - panStart.px) / state.view.k;
    state.view.y = panStart.vy + (ev.offsetY - panStart.py) / state.view.k;
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
  const draggedNode = state.dragNode;
  state.dragNode = null;
  panStart = null;

  if (moved) {
    if (wasDragging && draggedNode) scheduleSave(); // 위치 저장
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

canvas.addEventListener('wheel', (ev) => {
  ev.preventDefault();
  const factor = Math.exp(-ev.deltaY * 0.0015);
  state.view.k = Math.min(3, Math.max(0.15, state.view.k * factor));
}, { passive: false });

// ---------- 범례/필터 ----------

function buildLegend() {
  const el = $('#legend');
  el.innerHTML = '';
  for (const [type, info] of Object.entries(TYPES)) {
    const count = state.graph.nodes.filter((n) => n.type === type).length;
    if (!count && type !== 'self') continue;
    const chip = document.createElement('button');
    chip.className = 'chip';
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
      centerOn(otherId);
    };
    li.querySelector('.rel').onchange = (ev) => {
      e.label = ev.target.value.trim();
      scheduleSave();
    };
    li.querySelector('.unlink').onclick = () => {
      state.graph.edges = state.graph.edges.filter((x) => x !== e);
      renderLinks(n);
      buildLegend();
      reheat(0.3);
      scheduleSave();
    };
    ul.appendChild(li);
  }
}

function centerOn(id) {
  const n = nodeById(id);
  if (!n) return;
  state.view.x = -n.x;
  state.view.y = -n.y;
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
  hidePanel();
  buildLegend();
  reheat(0.4);
  scheduleSave();
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
  state.graph.edges.push({ id, source: sourceId, target: targetId, label: '' });
  renderLinks(nodeById(sourceId));
  reheat(0.3);
  scheduleSave();
}

$('#btnLink').onclick = () => setLinking(!state.linking);

// ---------- 툴바 ----------

$('#btnAddNode').onclick = () => {
  const id = 'n' + Date.now().toString(36);
  const c = toWorld(canvas.clientWidth / 2, canvas.clientHeight / 2);
  const node = { id, type: 'interest', label: '새 노드', emoji: '✨', desc: '', x: c.x + 30, y: c.y + 30, vx: 0, vy: 0 };
  state.graph.nodes.push(node);
  buildLegend();
  selectNode(id);
  reheat(0.3);
  scheduleSave();
  $('#panelLabel').focus();
  $('#panelLabel').select();
};

$('#btnFit').onclick = fitView;

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
    hidePanel();
    initPositions();
    buildLegend();
    applyMeta();
    fitView();
    reheat(1);
    scheduleSave();
  } catch (err) {
    alert(`가져오기 실패: ${err.message}`);
  }
  ev.target.value = '';
});

// 5초 뒤 힌트 감춤
setTimeout(() => $('#hint').classList.add('hide'), 6000);

// ---------- 시작 ----------

window.addEventListener('resize', resize);
resize();
load().then(() => {
  resize();
  fitView();
});
requestAnimationFrame(loop);
