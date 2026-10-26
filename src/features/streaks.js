// Streaks: a flame badge with the day count on chats that have a streak, read from what TikTok
// already shows in the inbox ("3-day Streak ..."), and a streak pet in the chat header that grows
// with the streak. Pets are local, only you see them.
import { get } from '../core/settings.js';
import { addStyle, h, loadData, saveData } from '../core/util.js';
import { headerHost, chatHandle } from './msgTools.js';

const CSS = `
  .tkp-flame { margin-left: 6px; padding: 1px 7px; border-radius: 999px; font: 700 11.5px system-ui, sans-serif;
    background: linear-gradient(135deg, #ff6a00, #ff2d55); color: #fff; vertical-align: middle; }
  .tkp-pet { all: unset; cursor: default; display: flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px;
    background: rgba(255,255,255,.06); font: 600 12.5px system-ui, sans-serif; color: #fff; margin-right: 4px; }
  .tkp-pet b { font-size: 18px; }
  @keyframes tkp-bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
  .tkp-pet b { animation: tkp-bob 2.4s ease-in-out infinite; display: inline-block; }
`;

const STAGES = [[0, '🥚', 'Egg'], [3, '🐣', 'Hatchling'], [7, '🐥', 'Chick'], [14, '🐤', 'Fledgling'], [30, '🐔', 'Hen'], [60, '🦚', 'Peacock'], [100, '🐉', 'Dragon']];
const stageOf = n => STAGES.filter(s => n >= s[0]).pop();
const streakRe = /(\d+)[-\s]day streak/i;

export function startStreaks() {
  addStyle('tkp-streak-css', CSS);
  setInterval(() => {
    if (!get('streaks')) { document.querySelectorAll('.tkp-flame,.tkp-pet').forEach(e => e.remove()); return; }
    const mem = loadData('streaks', {});
    let changed = false;
    for (const item of document.querySelectorAll('[data-e2e="dm-new-conversation-item"]')) {
      const nameEl = item.querySelector('[data-e2e="dm-new-conversation-nickname"]');
      if (!nameEl) continue;
      const own = item.querySelector('.tkp-flame');
      const text = own ? item.textContent.replace(own.textContent, ' ') : item.textContent;
      const m = text.match(streakRe);
      const name = nameEl.textContent.trim();
      if (m) { const n = Number(m[1]); if (mem[name] !== n) { mem[name] = n; changed = true; } }
      const n = mem[name];
      let flame = item.querySelector('.tkp-flame');
      if (n) {
        if (!flame) { flame = h('span', { class: 'tkp-flame' }); nameEl.insertAdjacentElement('afterend', flame); }
        flame.textContent = '🔥 ' + n;
      } else if (flame) flame.remove();
    }
    if (changed) saveData('streaks', mem);

    const header = document.querySelector('[data-e2e="dm-new-chat-nickname"]');
    const host = headerHost();
    if (!header || !host) return;
    const n = mem[header.textContent.trim()] || 0;
    let pet = host.querySelector('.tkp-pet');
    if (!n || !get('streakPet')) { if (pet) pet.remove(); return; }
    const [, icon, label] = stageOf(n);
    if (!pet) { pet = h('span', { class: 'tkp-pet' }); host.insertBefore(pet, host.querySelector('.tkp-hdr-spacer') ? host.querySelector('.tkp-hdr-spacer').nextSibling : null); }
    pet.title = `Streak pet for @${chatHandle()}. Grows at 3, 7, 14, 30, 60 and 100 days.`;
    pet.textContent = '';
    pet.append(h('b', null, icon), `${label} · 🔥${n}`);
  }, 1200);
}
