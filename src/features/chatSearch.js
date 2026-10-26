// Search inside the open chat: highlights matches in the loaded messages and jumps between them.
// Scroll up first to load older messages if you want to search further back.
import { get } from '../core/settings.js';
import { addStyle, h } from '../core/util.js';
import { openPopover } from '../ui/popover.js';
import { headerHost } from './msgTools.js';

const CSS = `
  [data-tkp-hit] [data-e2e="dm-new-message-text"] { outline: 2px solid #ffd60a; outline-offset: 2px; }
  [data-tkp-hit-cur] [data-e2e="dm-new-message-text"] { outline: 3px solid #25f4ee; }
  .tkp-search-nav { display: flex; gap: 6px; align-items: center; margin-top: 8px; }
`;

function clear() {
  document.querySelectorAll('[data-tkp-hit],[data-tkp-hit-cur]').forEach(e => { e.removeAttribute('data-tkp-hit'); e.removeAttribute('data-tkp-hit-cur'); });
}

function panel(el) {
  el.append(h('h5', null, 'Search this chat'));
  const input = h('input', { type: 'text', placeholder: 'Words to find' });
  const count = h('span', { class: 'tkp-hint', style: { margin: 0, flex: 1 } }, '');
  let hits = [], cur = -1;
  const show = () => {
    document.querySelectorAll('[data-tkp-hit-cur]').forEach(e => e.removeAttribute('data-tkp-hit-cur'));
    if (cur >= 0 && hits[cur]) { hits[cur].setAttribute('data-tkp-hit-cur', ''); hits[cur].scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    count.textContent = hits.length ? `${cur + 1} of ${hits.length}` : (input.value ? 'No matches in loaded messages' : '');
  };
  const run = () => {
    clear();
    const q = input.value.trim().toLowerCase();
    hits = q ? [...document.querySelectorAll('[data-e2e="dm-new-chat-item"]')].filter(it => {
      const t = it.querySelector('[data-e2e="dm-new-message-text"]');
      return t && t.textContent.toLowerCase().includes(q);
    }) : [];
    hits.forEach(x => x.setAttribute('data-tkp-hit', ''));
    cur = hits.length ? hits.length - 1 : -1;
    show();
  };
  input.addEventListener('input', run);
  input.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Enter' && hits.length) { cur = (cur - (e.shiftKey ? -1 : 1) + hits.length) % hits.length; show(); }
  });
  const prev = h('button', { class: 'tkp-pbtn', title: 'Older match', onclick: () => { if (hits.length) { cur = (cur - 1 + hits.length) % hits.length; show(); } } }, '↑');
  const next = h('button', { class: 'tkp-pbtn', title: 'Newer match', onclick: () => { if (hits.length) { cur = (cur + 1) % hits.length; show(); } } }, '↓');
  el.append(input, h('div', { class: 'tkp-search-nav' }, count, prev, next),
    h('div', { class: 'tkp-hint' }, 'Searches messages loaded on screen. Scroll up in the chat to load older ones.'));
  setTimeout(() => input.focus(), 0);
}

export function startChatSearch() {
  addStyle('tkp-search-css', CSS);
  setInterval(() => {
    if (!get('chatSearch')) return;
    const host = headerHost();
    if (host && !host.querySelector('.tkp-search-btn')) {
      const b = h('button', { class: 'tkp-hdr-btn tkp-search-btn', title: 'Search this chat', type: 'button' }, '🔍');
      b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); if (!openPopover(b, panel, { width: 300 })) clear(); });
      host.appendChild(b);
    }
  }, 900);
}
