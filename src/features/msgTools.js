// Message tools: copy text and save messages (bookmarks) into a saved-messages panel.
// Saved on this device. A bookmark button in the chat header opens the list.
import { get } from '../core/settings.js';
import { addStyle, h, loadData, saveData, toast } from '../core/util.js';
import { openPopover, closePopover } from '../ui/popover.js';

const CSS = `
  .tkp-mt-btn { all: unset; cursor: pointer; width: 28px; height: 28px; display: grid; place-items: center; border-radius: 50%; font-size: 13px; }
  .tkp-mt-btn:hover { background: rgba(255,255,255,.1); }
  .tkp-saved-meta { font-size: 11.5px; opacity: .5; }
  .tkp-hdr-btn { all: unset; cursor: pointer; width: 34px; height: 34px; display: grid; place-items: center; border-radius: 50%; font-size: 16px; }
  .tkp-hdr-btn:hover { background: rgba(255,255,255,.08); }
  .tkp-hdr-spacer { flex: 1; }
  .tkp-hdr-more { font-size: 20px; letter-spacing: -1px; padding-bottom: 5px; box-sizing: border-box; }
  .tkp-menu-ic { width: 22px; text-align: center; flex: none; }
  .tkp-flash { animation: tkp-flash 1.4s ease-out; border-radius: 14px; }
  @keyframes tkp-flash { 0% { background: rgba(254,44,85,.35); } 100% { background: transparent; } }
`;

const saved = () => loadData('saved', []);
export const chatHandle = () => { const el = document.querySelector('[data-e2e="chat-uniqueid"]'); return el ? el.textContent.trim().replace(/^@/, '') : ''; };
const chatName = () => { const el = document.querySelector('[data-e2e="dm-new-chat-nickname"]'); return el ? el.textContent.trim() : ''; };

// Puts a button into TikTok's chat header row (shared by search, saved, nickname, theme).
export function headerHost() {
  const nick = document.querySelector('[data-e2e="dm-new-chat-nickname"]');
  if (!nick) return null;
  let host = nick.closest('[class*="DivChatHeader"]') || nick.parentElement.parentElement.parentElement;
  // The inner content wrapper also matches; the full-width header row is its parent.
  if (host && host.parentElement && /DivChatHeader/.test(String(host.parentElement.className))) host = host.parentElement;
  if (!host) return null;
  if (getComputedStyle(host).display !== 'flex') { host.style.display = 'flex'; host.style.alignItems = 'center'; }
  if (!host.querySelector('.tkp-hdr-spacer')) host.appendChild(Object.assign(document.createElement('div'), { className: 'tkp-hdr-spacer' }));
  return host;
}

// Chat header actions (theme, search, nickname, saved, gallery) live behind one ... button.
const actions = new Map();
export function headerAction(id, spec) {
  if (spec) actions.set(id, spec); else actions.delete(id);
  const host = headerHost();
  const old = host && host.querySelector('.tkp-hdr-more');
  if (!host || !actions.size) { if (old) old.remove(); return; }
  if (old) { if (old !== host.lastElementChild) host.appendChild(old); return; }
  const b = h('button', { class: 'tkp-hdr-btn tkp-hdr-more', title: 'More: chat look, search, nickname, saved, gallery', type: 'button' }, '⋯');
  b.addEventListener('click', e => {
    e.preventDefault(); e.stopPropagation();
    openPopover(b, el => {
      el.append(h('h5', null, 'Chat tools'));
      for (const a of [...actions.values()].sort((x, y) => (x.order || 0) - (y.order || 0))) {
        const row = h('div', { class: 'tkp-pop-row' }, h('span', { class: 'tkp-menu-ic' }, a.icon), h('span', { class: 'tkp-grow' }, a.label));
        row.addEventListener('click', () => { closePopover(); setTimeout(() => a.open(b), 0); });
        el.append(row);
      }
    }, { width: 230 });
  });
  host.appendChild(b);
}

function savedPanel(el) {
  const list = saved();
  el.append(h('h5', null, 'Saved messages'));
  if (!list.length) el.append(h('div', { class: 'tkp-hint' }, 'Nothing saved yet. Hover a message and press the bookmark.'));
  list.slice().reverse().forEach((m, ri) => {
    const i = list.length - 1 - ri;
    const row = h('div', { class: 'tkp-pop-row', title: 'Copy' },
      h('div', { class: 'tkp-grow', style: { whiteSpace: 'normal' } }, h('div', null, m.text), h('div', { class: 'tkp-saved-meta' }, (m.from === 'me' ? 'You' : m.chatName || '@' + m.chat) + ' · ' + new Date(m.at).toLocaleString())),
      h('button', { class: 'tkp-pop-x', title: 'Remove', onclick: e => { e.stopPropagation(); const l = saved(); l.splice(i, 1); saveData('saved', l); el.textContent = ''; savedPanel(el); } }, '✕'));
    row.addEventListener('click', () => { navigator.clipboard.writeText(m.text).then(() => toast('Copied')).catch(() => {}); });
    el.append(row);
  });
}

export function startMsgTools() {
  addStyle('tkp-mt-css', CSS);
  setInterval(() => {
    if (!get('msgTools')) { headerAction('saved', null); return; }
    for (const item of document.querySelectorAll('[data-e2e="dm-new-chat-item"]')) {
      const textEl = item.querySelector('[data-e2e="dm-new-message-text"]');
      const actions = item.querySelector('[class*="DivActions"]');
      if (!textEl || !actions || actions.querySelector('.tkp-mt-btn')) continue;
      const copy = h('button', { class: 'tkp-mt-btn', title: 'Copy text', type: 'button' }, '⧉');
      copy.addEventListener('click', e => {
        e.stopPropagation(); e.preventDefault();
        navigator.clipboard.writeText(textEl.textContent.trim()).then(() => toast('Copied')).catch(() => toast("Couldn't copy"));
      });
      const save = h('button', { class: 'tkp-mt-btn', title: 'Save message', type: 'button' }, '🔖');
      save.addEventListener('click', e => {
        e.stopPropagation(); e.preventDefault();
        const l = saved();
        l.push({ text: textEl.textContent.trim(), chat: chatHandle(), chatName: chatName(), from: item.getAttribute('data-tkp-side') || '', at: Date.now() });
        saveData('saved', l.slice(-500));
        toast('Saved. Open them with the bookmark button in the chat header.');
      });
      actions.prepend(copy, save);
    }
    headerAction('saved', { icon: '🔖', label: 'Saved messages', order: 4, open: b => openPopover(b, savedPanel, { width: 330 }) });
  }, 900);
  void closePopover;
}

// A shared row for our buttons in the message box, right before TikTok's emoji button.
export function composerSlot(emoji) {
  const box = emoji.parentElement, row = box && box.parentElement;
  if (!row) return null;
  let slot = row.querySelector(':scope > .tkp-composer-slot');
  if (!slot) {
    slot = document.createElement('span');
    slot.className = 'tkp-composer-slot';
    slot.style.cssText = 'display:flex;align-items:center;gap:2px;flex:none;';
    row.insertBefore(slot, box);
  }
  return slot;
}
