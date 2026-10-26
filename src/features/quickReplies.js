// Quick replies: saved messages you insert with one click, or by typing / in the message box.
// Stored on this device. Nothing is sent until you press Enter yourself.
import { get } from '../core/settings.js';
import { addStyle, h, loadData, saveData } from '../core/util.js';
import { openPopover, closePopover } from '../ui/popover.js';
import { insertText, activeBox } from './composer.js';

const DEFAULTS = ['On my way!', 'Haha 😂', 'Sounds good 👍', "Can't talk rn, I'll text you later", 'Love this ❤️'];
const list = () => loadData('quickReplies', DEFAULTS);
const save = l => saveData('quickReplies', l);

const CSS = `
  .tkp-qr-btn { all: unset; cursor: pointer; width: 28px; height: 28px; display: grid; place-items: center;
    border-radius: 50%; font-size: 16px; margin-right: 6px; transition: transform .15s; }
  .tkp-qr-btn:hover { transform: scale(1.12); background: rgba(255,255,255,.08); }
`;

function buildList(el, filter, onPick) {
  el.textContent = '';
  el.append(h('h5', null, 'Quick replies'));
  const items = list().map((t, i) => ({ t, i })).filter(x => !filter || x.t.toLowerCase().includes(filter.toLowerCase()));
  items.forEach((x, n) => {
    const row = h('div', { class: 'tkp-pop-row' + (filter && n === 0 ? ' tkp-sel' : ''), title: x.t },
      h('span', { class: 'tkp-grow' }, x.t),
      filter ? null : h('button', { class: 'tkp-pop-x', title: 'Delete', onclick: e => {
        e.stopPropagation(); const l = list(); l.splice(x.i, 1); save(l); buildList(el, filter, onPick);
      } }, '✕'));
    row.addEventListener('click', () => onPick(x.t));
    el.append(row);
  });
  if (!items.length) el.append(h('div', { class: 'tkp-hint' }, filter ? 'No match. Press Esc to keep typing.' : 'No quick replies yet.'));
  if (!filter) {
    const input = h('input', { type: 'text', placeholder: 'Add a quick reply...' });
    input.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Enter' && input.value.trim()) { const l = list(); l.push(input.value.trim()); save(l); buildList(el, filter, onPick); }
    });
    el.append(h('div', { style: { marginTop: '8px' } }, input), h('div', { class: 'tkp-hint' }, 'Tip: type / in the message box to search these.'));
  }
}

export function startQuickReplies() {
  addStyle('tkp-qr-css', CSS);

  // Button next to the emoji button.
  setInterval(() => {
    if (!get('quickReplies')) { document.querySelectorAll('.tkp-qr-btn').forEach(b => b.remove()); return; }
    for (const emoji of document.querySelectorAll('[data-e2e="dm-new-emoji-btn"]')) {
      const host = emoji.parentElement;
      if (!host || host.querySelector('.tkp-qr-btn')) continue;
      const btn = h('button', { class: 'tkp-qr-btn', title: 'Quick replies', type: 'button' }, '⚡');
      btn.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        openPopover(btn, el => buildList(el, '', t => { closePopover(); insertText(t); }));
      });
      host.insertBefore(btn, emoji);
    }
  }, 800);

  // Type "/" at the start of the box to search quick replies.
  let slashPop = null;
  document.addEventListener('input', e => {
    if (!get('quickReplies') || !e.target.classList || !e.target.classList.contains('tkdm-input')) return;
    const ta = e.target, v = ta.value;
    if (v.startsWith('/') && !v.includes('\n') && v.length <= 40) {
      const pick = t => { closePopover(); slashPop = null; ta.value = ''; ta.dispatchEvent(new Event('input', { bubbles: true })); insertText(t); };
      if (!slashPop || !slashPop.isConnected) slashPop = openPopover(ta, el => buildList(el, v.slice(1), pick));
      else buildList(slashPop, v.slice(1), pick);
      if (slashPop) slashPop.__pick = () => { const first = list().find(t => t.toLowerCase().includes(v.slice(1).toLowerCase())); if (first) pick(first); };
    } else if (slashPop) { closePopover(); slashPop = null; }
  }, true);

  // Enter or Tab picks the first match while the / list is open (runs before the box's own Enter).
  document.addEventListener('keydown', e => {
    if (!slashPop || !slashPop.isConnected) return;
    if (!e.target.classList || !e.target.classList.contains('tkdm-input')) return;
    if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'Tab') {
      e.preventDefault(); e.stopImmediatePropagation();
      slashPop.__pick && slashPop.__pick();
    }
  }, true);
  void activeBox;
}
