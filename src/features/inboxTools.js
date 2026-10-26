// Inbox tools: search, filter chips, local pins (a row of avatars on top, like the app) and archive.
// TikTok's list is virtualized (rows sit at fixed positions), so filters fade rows out instead of
// moving them. Pins and archive are stored on this device.
import { get } from '../core/settings.js';
import { addStyle, h, loadData, saveData } from '../core/util.js';

const STYLES = `
  .tkp-inbox-bar { padding: 6px 12px 8px; display: flex; flex-direction: column; gap: 8px; }
  .tkp-inbox-search { box-sizing: border-box; width: 100%; padding: 8px 12px; border-radius: 999px; border: 1px solid rgba(255,255,255,.1);
    background: #1b1b21; color: #fff; font: 14px system-ui, sans-serif; outline: none; }
  .tkp-inbox-search:focus { border-color: var(--tkp-a, #fe2c55); }
  .tkp-chips { display: flex; gap: 6px; flex-wrap: wrap; }
  .tkp-chip { all: unset; cursor: pointer; padding: 5px 11px; border-radius: 999px; background: #1f1f26; font: 600 12.5px system-ui, sans-serif;
    color: rgba(255,255,255,.75); }
  .tkp-chip.tkp-on { background: var(--tkp-a, #fe2c55); color: #fff; }
  .tkp-pins { display: flex; gap: 10px; overflow-x: auto; padding: 2px 2px 4px; }
  .tkp-pin { all: unset; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 4px; width: 58px; }
  .tkp-pin img { width: 46px; height: 46px; border-radius: 50%; object-fit: cover;
    box-shadow: 0 0 0 2px #0e0e11, 0 0 0 4px var(--tkp-a, #fe2c55); }
  .tkp-pin span { font: 11.5px system-ui, sans-serif; color: rgba(255,255,255,.8); max-width: 58px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  [data-tkp-dim] { opacity: .16 !important; transition: opacity .15s; }
  [data-tkp-archived] { opacity: .45; }
  [data-tkp-archived] [data-e2e="dm-new-conversation-nickname"]::after { content: ' · archived'; font-weight: 400; opacity: .7; font-size: 12px; }
  [data-tkp-pinned] [data-e2e="dm-new-conversation-nickname"]::before { content: '📌 '; }
  .tkp-row-tools { position: absolute; right: 44px; top: 50%; transform: translateY(-50%); display: none; gap: 2px; z-index: 3; }
  [data-e2e="dm-new-conversation-item"]:hover .tkp-row-tools { display: flex; }
  .tkp-row-tools button { all: unset; cursor: pointer; width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center;
    background: rgba(30,30,36,.95); font-size: 13px; }
  .tkp-row-tools button:hover { background: #33333d; }
`;

const data = () => loadData('inbox', { pins: {}, archived: {} });
const store = d => saveData('inbox', d);
let filter = 'all';
let query = '';

function infoOf(item) {
  const name = (item.querySelector('[data-e2e="dm-new-conversation-nickname"]') || {}).textContent || '';
  const img = item.querySelector('[data-e2e="dm-new-conversation-avatar"] img');
  return { name: name.trim(), avatar: img ? img.src : '' };
}

function openConv(id) {
  const item = document.querySelector(`[data-e2e="dm-new-conversation-item"][data-conv-id="${CSS.escape(id)}"]`);
  if (item) { item.scrollIntoView({ block: 'nearest' }); item.click(); }
}

function renderPins(bar) {
  const pins = bar.querySelector('.tkp-pins');
  const d = data();
  pins.textContent = '';
  for (const [id, info] of Object.entries(d.pins)) {
    pins.append(h('button', { class: 'tkp-pin', title: info.name, onclick: () => openConv(id) },
      info.avatar ? h('img', { src: info.avatar, alt: '' }) : h('div', { style: { width: '46px', height: '46px', borderRadius: '50%', background: '#333' } }),
      h('span', null, info.name)));
  }
  pins.hidden = !Object.keys(d.pins).length;
}

function apply(bar) {
  const d = data();
  for (const item of document.querySelectorAll('[data-e2e="dm-new-conversation-item"]')) {
    const id = item.getAttribute('data-conv-id') || '';
    const pinned = !!d.pins[id], archived = !!d.archived[id];
    item.toggleAttribute('data-tkp-pinned', pinned);
    item.toggleAttribute('data-tkp-archived', archived && filter !== 'archived');
    const text = item.textContent.toLowerCase();
    const unread = !!item.querySelector('[data-e2e="dm-new-conversation-unread"]');
    let show = true;
    if (query && !text.includes(query)) show = false;
    if (filter === 'unread' && !unread) show = false;
    if (filter === 'pinned' && !pinned) show = false;
    if (filter === 'archived' && !archived) show = false;
    item.toggleAttribute('data-tkp-dim', !show);

    if (!item.querySelector('.tkp-row-tools')) {
      const tools = h('div', { class: 'tkp-row-tools' });
      const pinB = h('button', { title: 'Pin to top (on this device)' });
      const arcB = h('button', { title: 'Archive (on this device)' });
      pinB.addEventListener('click', e => {
        e.stopPropagation(); e.preventDefault();
        const dd = data(); const iid = item.getAttribute('data-conv-id');
        if (dd.pins[iid]) delete dd.pins[iid]; else dd.pins[iid] = infoOf(item);
        store(dd); renderPins(bar); apply(bar);
      });
      arcB.addEventListener('click', e => {
        e.stopPropagation(); e.preventDefault();
        const dd = data(); const iid = item.getAttribute('data-conv-id');
        if (dd.archived[iid]) delete dd.archived[iid]; else dd.archived[iid] = true;
        store(dd); apply(bar);
      });
      tools.append(pinB, arcB);
      item.append(tools);
    }
    const t = item.querySelector('.tkp-row-tools');
    t.children[0].textContent = pinned ? '📍' : '📌';
    t.children[0].title = pinned ? 'Unpin' : 'Pin to top (on this device)';
    t.children[1].textContent = archived ? '📤' : '🗄';
    t.children[1].title = archived ? 'Unarchive' : 'Archive (on this device)';
  }
}

export function startInboxTools() {
  addStyle('tkp-inbox-css', STYLES);
  let bar = null;
  setInterval(() => {
    const list = document.querySelector('[data-e2e="dm-new-conversation-list"]');
    if (!get('inboxTools') || !list) {
      if (bar) { bar.remove(); bar = null; }
      document.querySelectorAll('[data-tkp-dim],[data-tkp-archived],[data-tkp-pinned]').forEach(e => { e.removeAttribute('data-tkp-dim'); e.removeAttribute('data-tkp-archived'); e.removeAttribute('data-tkp-pinned'); });
      return;
    }
    if (!bar || !bar.isConnected) {
      const search = h('input', { class: 'tkp-inbox-search', type: 'text', placeholder: 'Search chats' });
      search.addEventListener('input', () => { query = search.value.trim().toLowerCase(); apply(bar); });
      search.addEventListener('keydown', e => e.stopPropagation());
      const chips = h('div', { class: 'tkp-chips' });
      for (const [k, label] of [['all', 'All'], ['unread', 'Unread'], ['pinned', 'Pinned'], ['archived', 'Archived']]) {
        const c = h('button', { class: 'tkp-chip' + (filter === k ? ' tkp-on' : ''), onclick: () => {
          filter = k; chips.querySelectorAll('.tkp-chip').forEach(x => x.classList.toggle('tkp-on', x === c)); apply(bar);
        } }, label);
        chips.append(c);
      }
      bar = h('div', { class: 'tkp-inbox-bar' }, search, chips, h('div', { class: 'tkp-pins' }));
      list.parentElement.insertBefore(bar, list);
      renderPins(bar);
    }
    apply(bar);
  }, 900);
}
