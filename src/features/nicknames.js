// Nicknames: your own name for someone, shown in the chat header and the inbox. Saved on this device.
// The real name stays underneath; only the display changes.
import { get } from '../core/settings.js';
import { addStyle, h, loadData, saveData } from '../core/util.js';
import { openPopover, closePopover } from '../ui/popover.js';
import { headerHost, chatHandle } from './msgTools.js';

const CSS = `
  [data-tkp-nick] { font-size: 0 !important; }
  [data-tkp-nick]::before { content: attr(data-tkp-nick); font-size: 15px; font-weight: 700; }
  [data-e2e="dm-new-chat-nickname"][data-tkp-nick]::before { font-size: 18px; }
`;

const nicks = () => loadData('nicknames', { byHandle: {}, byName: {} });

function applyNicks() {
  const n = nicks();
  const handle = chatHandle();
  const header = document.querySelector('[data-e2e="dm-new-chat-nickname"]');
  if (header) {
    const nick = handle && n.byHandle[handle];
    if (nick) { if (header.getAttribute('data-tkp-nick') !== nick) header.setAttribute('data-tkp-nick', nick); }
    else header.removeAttribute('data-tkp-nick');
  }
  for (const el of document.querySelectorAll('[data-e2e="dm-new-conversation-nickname"]')) {
    const real = el.textContent.trim();
    const nick = n.byName[real];
    if (nick) { if (el.getAttribute('data-tkp-nick') !== nick) el.setAttribute('data-tkp-nick', nick); }
    else el.removeAttribute('data-tkp-nick');
  }
}

function panel(el) {
  const handle = chatHandle();
  const header = document.querySelector('[data-e2e="dm-new-chat-nickname"]');
  const real = header ? header.textContent.trim() : '';
  const n = nicks();
  el.append(h('h5', null, 'Nickname for @' + handle));
  const input = h('input', { type: 'text', placeholder: real, value: n.byHandle[handle] || '' });
  const saveIt = () => {
    const d = nicks(); const v = input.value.trim();
    if (v) { d.byHandle[handle] = v; d.byName[real] = v; } else { delete d.byHandle[handle]; delete d.byName[real]; }
    saveData('nicknames', d); applyNicks(); closePopover();
  };
  input.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') saveIt(); });
  el.append(input, h('div', { style: { display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' } },
    h('button', { class: 'tkp-pbtn', onclick: () => { input.value = ''; saveIt(); } }, 'Clear'),
    h('button', { class: 'tkp-pbtn tkp-primary', onclick: saveIt }, 'Save')),
    h('div', { class: 'tkp-hint' }, 'Only you see this. Their real name: ' + real));
  setTimeout(() => input.focus(), 0);
}

export function startNicknames() {
  addStyle('tkp-nick-css', CSS);
  setInterval(() => {
    if (!get('nicknames')) { document.querySelectorAll('[data-tkp-nick]').forEach(e => e.removeAttribute('data-tkp-nick')); return; }
    applyNicks();
    const host = headerHost();
    if (host && !host.querySelector('.tkp-nick-btn')) {
      const b = h('button', { class: 'tkp-hdr-btn tkp-nick-btn', title: 'Set a nickname', type: 'button' }, '✏️');
      b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); openPopover(b, panel, { width: 280 }); });
      host.appendChild(b);
    }
  }, 800);
}
