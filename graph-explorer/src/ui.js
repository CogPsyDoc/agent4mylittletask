/**
 * DOM overlay: control panel, note panel, crosshair, zen mode, dive fade.
 * All behavior is delegated to callbacks passed by main.js.
 */

import { THEMES } from './themes.js';
import { FLIGHT_AVATARS, INTERIOR_AVATARS } from './avatars.js';
import { renderMarkdown } from './util/markdown.js';

const $ = (id) => document.getElementById(id);

export function createUI(callbacks) {
  const els = {
    ui: $('ui'),
    fade: $('fade'),
    crosshair: $('crosshair'),
    stats: $('stats'),
    modeBadge: $('mode-badge'),
    themeSelect: $('theme-select'),
    avatarSelect: $('avatar-select'),
    interiorAvatarSelect: $('interior-avatar-select'),
    toggleHubs: $('toggle-hubs'),
    toggleAttachments: $('toggle-attachments'),
    speed: $('speed'),
    spread: $('spread'),
    notePanel: $('note-panel'),
    noteTitle: $('note-title'),
    noteMeta: $('note-meta'),
    noteBody: $('note-body'),
    noteActions: $('note-actions'),
    noteClose: $('note-close'),
  };

  const fillSelect = (select, entries) => {
    for (const [key, val] of Object.entries(entries)) {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = val.name;
      select.appendChild(opt);
    }
  };
  fillSelect(els.themeSelect, THEMES);
  fillSelect(els.avatarSelect, FLIGHT_AVATARS);
  fillSelect(els.interiorAvatarSelect, INTERIOR_AVATARS);

  els.themeSelect.addEventListener('change', () => callbacks.onTheme(els.themeSelect.value));
  els.avatarSelect.addEventListener('change', () => callbacks.onFlightAvatar(els.avatarSelect.value));
  els.interiorAvatarSelect.addEventListener('change', () => callbacks.onInteriorAvatar(els.interiorAvatarSelect.value));
  els.toggleHubs.addEventListener('change', () => callbacks.onFilters({ hubs: els.toggleHubs.checked }));
  els.toggleAttachments.addEventListener('change', () => callbacks.onFilters({ attachments: els.toggleAttachments.checked }));
  els.speed.addEventListener('input', () => callbacks.onSpeed(Number(els.speed.value)));
  els.spread.addEventListener('input', () => callbacks.onSpread(Number(els.spread.value)));
  els.noteClose.addEventListener('click', () => ui.hideNote());

  els.noteBody.addEventListener('click', (e) => {
    const link = e.target.closest('.wikilink');
    if (link) callbacks.onWikilink(link.dataset.target);
  });

  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.code === 'KeyZ') document.body.classList.toggle('zen');
  });

  let openNode = null;

  const ui = {
    els,
    get openNode() { return openNode; },

    setStats({ notes, hubs, attachments, links }) {
      els.stats.textContent = `${notes} notes · ${hubs} hubs · ${attachments} attachments · ${links} links`;
    },

    setMode(mode, title = '') {
      els.modeBadge.textContent = mode === 'interior' ? `INSIDE · ${title.toUpperCase()}` : 'GALAXY';
    },

    setTargeted(on) {
      els.crosshair.classList.toggle('target', !!on);
    },

    showNote(node, markdown, actions = []) {
      openNode = node;
      els.noteTitle.textContent = node.label;
      const kindText = node.kind === 'hub' ? 'synthesized hub'
        : node.kind === 'attachment' ? 'attachment' : (node.folder || 'vault root');
      els.noteMeta.textContent = `${kindText} · ${node.degree} link${node.degree === 1 ? '' : 's'}`;
      els.noteBody.innerHTML = markdown !== null
        ? renderMarkdown(markdown)
        : `<p><em>${node.kind === 'hub'
          ? 'This node has no file of its own — it exists because other notes keep linking to it.'
          : 'Attachment — no text content.'}</em></p>`;
      els.noteActions.innerHTML = '';
      for (const a of actions) {
        const b = document.createElement('button');
        b.textContent = a.label;
        b.addEventListener('click', a.onClick);
        els.noteActions.appendChild(b);
      }
      els.notePanel.hidden = false;
    },

    hideNote() {
      openNode = null;
      els.notePanel.hidden = true;
    },

    /** White-flash transition; `swap` runs while the screen is covered. */
    dive(swap) {
      els.fade.classList.add('on');
      setTimeout(() => {
        swap();
        setTimeout(() => els.fade.classList.remove('on'), 60);
      }, 300);
    },
  };
  return ui;
}
