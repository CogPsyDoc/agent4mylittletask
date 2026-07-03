// Cowork Sync 프론트엔드 (프레임워크 없이 바닐라 JS)

const $ = (sel, el = document) => el.querySelector(sel);
const el = (tag, props = {}, children = []) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (v != null) n.setAttribute(k, v);
  }
  for (const c of [].concat(children)) if (c != null) n.append(c);
  return n;
};

const state = {
  sessions: [],
  filter: { text: '', folder: null, project: null, tag: null, favorite: false },
  activeId: null,
  chatEnabled: false,
  model: '',
};

const listEl = $('#list');
const facetsEl = $('#facets');
const detailEl = $('#detail');
const appEl = $('#app');
const searchEl = $('#search');
const footEl = $('#sideFoot');

async function api(path, opts) {
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

function toast(msg) {
  let t = $('.toast');
  if (!t) { t = el('div', { class: 'toast' }); document.body.append(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 1400);
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return d.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ---------- 목록 ----------
async function loadSessions() {
  const data = await api('/api/sessions');
  state.sessions = data.sessions;
  footEl.textContent = `${data.count}개 대화 · ${shortDir(data.transcriptsDir)}`;
  await loadFacets();
  renderList();
}

function shortDir(d) {
  if (!d) return '';
  return d.replace(/^.*\/(\.claude\/.*)$/, '~/$1');
}

async function loadFacets() {
  const f = await api('/api/facets');
  facetsEl.replaceChildren();
  const mk = (label, kind, value) => {
    const active = state.filter[kind] === value || (kind === 'favorite' && state.filter.favorite);
    return el('button', {
      class: 'chip' + (active ? ' active' : ''),
      onclick: () => {
        if (kind === 'favorite') state.filter.favorite = !state.filter.favorite;
        else state.filter[kind] = state.filter[kind] === value ? null : value;
        loadFacets();
        renderList();
      },
    }, label);
  };
  facetsEl.append(mk('⭐ 즐겨찾기', 'favorite'));
  f.folders.forEach((x) => facetsEl.append(mk('📁 ' + x, 'folder', x)));
  f.tags.forEach((x) => facetsEl.append(mk('#' + x, 'tag', x)));
  if (f.projects.length > 1) f.projects.forEach((x) => facetsEl.append(mk('▪ ' + x, 'project', x)));
}

function matchesFilter(s) {
  const { folder, project, tag, favorite } = state.filter;
  if (favorite && !s.meta.favorite) return false;
  if (folder && s.meta.folder !== folder) return false;
  if (project && s.projectName !== project) return false;
  if (tag && !(s.meta.tags || []).includes(tag)) return false;
  return true;
}

async function renderList() {
  const text = state.filter.text.trim();
  let items;
  if (text) {
    const data = await api('/api/search?q=' + encodeURIComponent(text));
    items = data.results.filter(matchesFilter);
  } else {
    items = state.sessions.filter(matchesFilter);
  }

  listEl.replaceChildren();
  if (items.length === 0) {
    listEl.append(el('div', { class: 'side-foot' }, '결과 없음'));
    return;
  }
  for (const s of items) {
    const node = el('div', {
      class: 'item' + (s.id === state.activeId ? ' active' : ''),
      onclick: () => openSession(s.id),
    }, [
      el('div', { class: 'row1' }, [
        s.meta.favorite ? el('span', { class: 'star' }, '★') : null,
        el('span', { class: 'title' }, s.title),
      ]),
      el('div', { class: 'preview' }, s.snippet
        ? el('span', {}, [el('span', { class: 'snippet' }, '…' + s.snippet + '… ')])
        : s.preview),
      el('div', { class: 'metaline' }, [
        el('span', {}, `💬 ${s.messageCount}`),
        el('span', {}, fmtDate(s.updatedAt)),
        s.projectName && s.projectName !== 'unknown' ? el('span', {}, '▪ ' + s.projectName) : null,
        ...(s.meta.tags || []).map((t) => el('span', { class: 'tag' }, '#' + t)),
      ]),
    ]);
    listEl.append(node);
  }
}

// ---------- 상세 ----------
async function openSession(id) {
  state.activeId = id;
  renderList();
  appEl.setAttribute('data-view', 'detail');
  detailEl.replaceChildren(el('div', { class: 'empty' }, '불러오는 중…'));
  const s = await api('/api/sessions/' + encodeURIComponent(id));
  renderDetail(s);
}

let savePending = null;
function saveMeta(id, patch) {
  clearTimeout(savePending);
  savePending = setTimeout(async () => {
    await api(`/api/sessions/${encodeURIComponent(id)}/meta`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    // 목록 캐시의 메타도 반영
    const item = state.sessions.find((x) => x.id === id);
    if (item) Object.assign(item.meta, patch, item.meta.customTitle != null ? {} : {});
    toast('저장됨');
    await loadFacets();
    renderList();
  }, 400);
}

function renderDetail(s) {
  const head = el('div', { class: 'conv-head' }, [
    el('div', { class: 'titlebar' }, [
      el('button', {
        class: 'icon-btn only-mobile',
        title: '목록으로',
        onclick: () => appEl.setAttribute('data-view', 'list'),
      }, '‹'),
      el('input', {
        class: 'title-edit',
        value: s.meta.customTitle || s.derivedTitle,
        placeholder: s.derivedTitle,
        oninput: (e) => { s.meta.customTitle = e.target.value; saveMeta(s.id, { customTitle: e.target.value }); updateItemTitle(s.id, e.target.value || s.derivedTitle); },
      }),
      el('button', {
        class: 'fav-btn' + (s.meta.favorite ? ' on' : ''),
        onclick: (e) => {
          s.meta.favorite = !s.meta.favorite;
          e.target.classList.toggle('on', s.meta.favorite);
          const item = state.sessions.find((x) => x.id === s.id);
          if (item) item.meta.favorite = s.meta.favorite;
          saveMeta(s.id, { favorite: s.meta.favorite });
        },
      }, '★'),
    ]),
    el('div', { class: 'conv-sub' }, [
      el('span', {}, `💬 ${s.messageCount} 메시지`),
      el('span', {}, fmtDate(s.createdAt) + ' ~ ' + fmtDate(s.updatedAt)),
      s.projectName ? el('span', {}, '▪ ' + s.projectName) : null,
      s.gitBranch ? el('span', {}, '⌥ ' + s.gitBranch) : null,
    ]),
    el('div', { class: 'organize' }, [
      el('input', {
        placeholder: '📁 폴더',
        value: s.meta.folder || '',
        style: 'width:130px',
        onchange: (e) => { const item = state.sessions.find((x) => x.id === s.id); if (item) item.meta.folder = e.target.value; saveMeta(s.id, { folder: e.target.value }); },
      }),
      el('input', {
        placeholder: '#태그 (쉼표로 구분)',
        value: (s.meta.tags || []).join(', '),
        style: 'width:200px',
        onchange: (e) => {
          const tags = e.target.value.split(',').map((t) => t.trim()).filter(Boolean);
          const item = state.sessions.find((x) => x.id === s.id); if (item) item.meta.tags = tags;
          saveMeta(s.id, { tags });
        },
      }),
    ]),
  ]);

  const msgs = el('div', { class: 'messages' });
  for (const m of s.messages) {
    if (m.isMeta) continue; // system-reminder 등 잡음 숨김
    appendMessage(msgs, m);
  }

  const children = [head, msgs];
  if (state.chatEnabled) {
    children.push(renderComposer(s.id, msgs));
  } else {
    children.push(el('div', { class: 'composer-disabled' },
      '💡 서버에 ANTHROPIC_API_KEY를 설정하면 여기서 이어서 대화할 수 있어요.'));
  }

  detailEl.replaceChildren(...children);
  detailEl.scrollTop = 0;
}

function appendMessage(msgs, m) {
  const who = m.role === 'user' ? '나' : m.role === 'assistant' ? 'Claude' : '도구';
  const bubble = el('div', { class: 'bubble' });
  for (const b of m.blocks) renderBlock(bubble, b);
  if (!bubble.childNodes.length) return null;
  const node = el('div', { class: 'msg ' + m.role + (m.continued ? ' continued' : '') }, [
    el('div', { class: 'who' }, [
      el('span', { class: 'dot' }),
      who,
      m.timestamp ? el('span', { style: 'text-transform:none' }, fmtDate(m.timestamp)) : null,
      m.continued ? el('span', { class: 'cont-badge' }, '이어진 대화') : null,
    ]),
    bubble,
  ]);
  msgs.append(node);
  return node;
}

// ---------- 이어서 대화 ----------
function renderComposer(sessionId, msgs) {
  const input = el('textarea', {
    class: 'composer-input',
    placeholder: '이어서 대화하기… (Enter 전송, Shift+Enter 줄바꿈)',
    rows: '1',
  });
  const btn = el('button', { class: 'composer-send', title: '전송' }, '➤');
  const wrap = el('div', { class: 'composer' }, [input, btn]);

  const submit = () => {
    const text = input.value.trim();
    if (!text || wrap.classList.contains('busy')) return;
    input.value = '';
    sendContinue(sessionId, text, msgs, wrap);
  };
  btn.addEventListener('click', submit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
  });
  return wrap;
}

async function sendContinue(sessionId, text, msgs, composer) {
  composer.classList.add('busy');

  appendMessage(msgs, { role: 'user', blocks: [{ type: 'text', text }], continued: true });

  const pending = { role: 'assistant', blocks: [{ type: 'text', text: '' }], continued: true };
  const node = appendMessage(msgs, { ...pending, blocks: [{ type: 'text', text: '…' }] });
  const textEl = node.querySelector('.block');
  detailEl.scrollTop = detailEl.scrollHeight;

  try {
    const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/continue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    // SSE 파싱
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let full = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const events = buf.split('\n\n');
      buf = events.pop();
      for (const raw of events) {
        const eventLine = raw.split('\n').find((l) => l.startsWith('event: '));
        const dataLine = raw.split('\n').find((l) => l.startsWith('data: '));
        if (!eventLine || !dataLine) continue;
        const type = eventLine.slice(7).trim();
        const data = JSON.parse(dataLine.slice(6));
        if (type === 'delta') {
          full += data.text;
          textEl.textContent = full;
          detailEl.scrollTop = detailEl.scrollHeight;
        } else if (type === 'error') {
          throw new Error(data.message);
        }
      }
    }
    if (!full) textEl.textContent = '(응답 없음)';
  } catch (err) {
    textEl.textContent = '⚠ ' + err.message;
  } finally {
    composer.classList.remove('busy');
    composer.querySelector('.composer-input').focus();
  }
}

function renderBlock(parent, b) {
  if (b.type === 'text' || b.type === 'other') {
    parent.append(el('div', { class: 'block' }, b.text || ''));
  } else if (b.type === 'thinking') {
    parent.append(el('div', { class: 'block thinking' }, b.text || ''));
  } else if (b.type === 'tool_use') {
    const d = el('details', { class: 'tool' }, [
      el('summary', {}, `🔧 ${b.name}`),
      el('pre', {}, b.input || ''),
    ]);
    parent.append(d);
  } else if (b.type === 'tool_result') {
    const d = el('details', { class: 'tool' }, [
      el('summary', {}, b.isError ? '⚠ 도구 결과 (오류)' : '↳ 도구 결과'),
      el('pre', {}, b.output || ''),
    ]);
    if (b.isError) d.setAttribute('data-error', '');
    parent.append(d);
  }
}

function updateItemTitle(id, title) {
  const item = state.sessions.find((x) => x.id === id);
  if (item) item.title = title;
  const active = $('.item.active .title');
  if (active) active.textContent = title;
}

// ---------- 이벤트 ----------
let searchTimer;
searchEl.addEventListener('input', (e) => {
  state.filter.text = e.target.value;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(renderList, 200);
});
$('#menuBack').addEventListener('click', () => appEl.setAttribute('data-view', 'list'));

// 주기적으로 목록 갱신 (진행 중 세션이 늘어나도 반영)
api('/api/config').then((c) => { state.chatEnabled = c.chatEnabled; state.model = c.model; }).catch(() => {});
loadSessions().catch((e) => { listEl.textContent = '불러오기 실패: ' + e.message; });
setInterval(() => { if (!state.filter.text) loadSessions().catch(() => {}); }, 15000);
