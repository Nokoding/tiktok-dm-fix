// Composer extras: smart reply chips based on the last message you got, plus fortune cookie,
// greeting card and nudge. They only fill in the message box. You still press Enter to send.
import { get } from '../core/settings.js';
import { addStyle, h } from '../core/util.js';
import { insertText } from './composer.js';
import { openPopover, closePopover } from '../ui/popover.js';
import { composerSlot } from './msgTools.js';

const CSS = `
  .tkp-smart { display: flex; gap: 6px; flex-wrap: wrap; padding: 0 12px 6px; }
  .tkp-smart button { all: unset; cursor: pointer; padding: 5px 11px; border-radius: 999px; background: #1f1f26;
    border: 1px solid rgba(255,255,255,.1); font: 13px system-ui, sans-serif; color: #eee; }
  .tkp-smart button:hover { border-color: var(--tkp-a, #fe2c55); }
  .tkp-fun-btn { all: unset; cursor: pointer; width: 28px; height: 28px; display: grid; place-items: center;
    border-radius: 50%; font-size: 16px; } .tkp-fun-btn:hover { background: rgba(255,255,255,.08); }
`;

const FORTUNES = [
  'Your next DM will make someone smile.', 'A surprise is waiting in your For You page.', 'Good vibes are loading... 87%.',
  'Someone is thinking about sending you a TikTok right now.', 'The beat you make today goes crazy tomorrow.',
  'Patience. The algorithm sees you.', 'You will find a sound you can\'t stop replaying.', 'Today is a great day to reply fast.',
  'A friend owes you a favor. Collect it.', 'Your streak will outlive us all.',
];
const CARDS = [
  ['Birthday', '🎂 ✨ HAPPY BIRTHDAY ✨ 🎂\n🎉 hope your day goes crazy 🎉'],
  ['Thank you', '🌸 ━━━ THANK YOU ━━━ 🌸\nfr appreciate you 🙏'],
  ['Good morning', '☀️ G O O D  M O R N I N G ☀️\nrise and grind 💪'],
  ['Good night', '🌙 ✦ good night ✦ 🌙\nsleep well 💤'],
  ['Congrats', '🏆 C O N G R A T S 🏆\nyou earned it 🔥'],
  ['Miss you', '💌 ┊ missing you ┊ 💌'],
];

function suggestions(text) {
  const t = text.toLowerCase().trim();
  if (!t) return [];
  if (/^(hi|hey|hello|yo|wsp|sup|what'?s up)\b/.test(t)) return ['hey!', 'yo what\'s up', 'heyy 😄'];
  if (/thank|thx|ty\b/.test(t)) return ['np!', 'anytime 🙏', 'of course'];
  if (/\?\s*$/.test(t)) return ['yeah', 'nah', 'idk tbh', 'lemme check'];
  if (/(lol|lmao|haha|😂|💀)/.test(t)) return ['😂😂', 'LMAO', 'I\'m crying 💀'];
  if (/(sorry|my bad)/.test(t)) return ['all good', 'no worries 🙏'];
  if (/(night|gn\b)/.test(t)) return ['gn!', 'good night 🌙'];
  if (/(love|ily)/.test(t)) return ['love you too ❤️', '🥹❤️'];
  return ['😂', 'fr', 'bet', 'ok 👍'];
}

function lastIncoming() {
  const items = [...document.querySelectorAll('[data-e2e="dm-new-chat-item"][data-tkp-side="them"]')];
  const last = items.pop();
  const t = last && last.querySelector('[data-e2e="dm-new-message-text"]');
  return t ? t.textContent : '';
}

function funPanel(el) {
  el.append(h('h5', null, 'Fun'));
  const row = (label, fn) => { const r = h('div', { class: 'tkp-pop-row' }, label); r.addEventListener('click', () => { closePopover(); fn(); }); el.append(r); };
  row('🥠 Fortune cookie', () => insertText('🥠 Fortune: ' + FORTUNES[Math.floor(Math.random() * FORTUNES.length)]));
  row('👉 Nudge', () => insertText('👉👉 nudge'));
  el.append(h('h5', { style: { marginTop: '10px' } }, 'Greeting cards'));
  for (const [name, text] of CARDS) row('💌 ' + name, () => insertText(text));
  el.append(h('div', { class: 'tkp-hint' }, 'These fill the box. Press Enter to send.'));
}

export function startComposerExtras() {
  addStyle('tkp-cx-css', CSS);
  let lastSeen = null;
  setInterval(() => {
    const bottom = document.querySelector('[data-e2e="dm-new-chat-bottom"]');
    // Fun button
    for (const emoji of document.querySelectorAll('[data-e2e="dm-new-emoji-btn"]')) {
      const host = get('funExtras') ? composerSlot(emoji) : null;
      if (!host || host.querySelector('.tkp-fun-btn')) continue;
      const b = h('button', { class: 'tkp-fun-btn', title: 'Fortune cookie, nudge, greeting cards', type: 'button' }, '🎁');
      b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); openPopover(b, funPanel, { width: 250 }); });
      host.append(b);
    }
    if (!get('funExtras')) document.querySelectorAll('.tkp-fun-btn').forEach(b => b.remove());
    // Smart replies
    let bar = document.querySelector('.tkp-smart');
    if (!get('smartReplies') || !bottom) { if (bar) bar.remove(); return; }
    const text = lastIncoming();
    if (!bar || !bar.isConnected) { bar = h('div', { class: 'tkp-smart' }); bottom.insertBefore(bar, bottom.firstChild); lastSeen = null; }
    if (text === lastSeen) return;
    lastSeen = text;
    bar.textContent = '';
    for (const s of suggestions(text)) {
      const b = h('button', { type: 'button' }, s);
      b.addEventListener('click', () => insertText(s));
      bar.append(b);
    }
  }, 1000);
}
