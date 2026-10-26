// App-style look for DMs: gradient bubbles that group like the phone app, avatars only on the
// last message of a run, pop-in for new messages, a pill composer, glass header, livelier inbox.
// Pure CSS plus a small tagger that marks each message row "me" or "them" and its place in a run.
import { get, on } from '../core/settings.js';
import { addStyle, removeStyle } from '../core/util.js';

export const ACCENTS = {
  tiktok: { label: 'TikTok (pink and cyan)', a: '#fe2c55', b: '#25f4ee', me: 'linear-gradient(135deg, #fe2c55 0%, #ff4f7a 45%, #ff7a59 100%)' },
  neon: { label: 'Neon (purple and pink)', a: '#b14dff', b: '#ff4fd8', me: 'linear-gradient(135deg, #7b2ff7 0%, #b14dff 50%, #ff4fd8 100%)' },
  ocean: { label: 'Ocean (blue)', a: '#2f80ff', b: '#25f4ee', me: 'linear-gradient(135deg, #1f5bff 0%, #2f80ff 50%, #22c4e8 100%)' },
  sunset: { label: 'Sunset (orange)', a: '#ff7a1a', b: '#ffcc33', me: 'linear-gradient(135deg, #ff4e50 0%, #ff7a1a 55%, #ffb627 100%)' },
  mint: { label: 'Mint (green)', a: '#14c38e', b: '#7cf5c3', me: 'linear-gradient(135deg, #0f9b6c 0%, #14c38e 55%, #3fe0b0 100%)' },
  classic: { label: 'Classic TikTok blue', a: '#00a2c9', b: '#25f4ee', me: 'linear-gradient(135deg, #0087a8 0%, #00a2c9 100%)' },
};

const ITEM = '[data-e2e="dm-new-chat-item"]';
const TEXT = '[data-e2e="dm-new-message-text"]';

function vars() {
  const ac = ACCENTS[get('accent')] || ACCENTS.tiktok;
  return `:root { --tkp-a: ${ac.a}; --tkp-b: ${ac.b}; --tkp-me: ${ac.me};
    --tkp-them: #2a2a31; --tkp-them-text: #f1f1f3; --tkp-r: 20px; --tkp-r-tight: 6px; }`;
}

const CSS = `
/* ---------- bubbles ---------- */
${ITEM} ${TEXT} {
  padding: 9px 14px !important; border-radius: var(--tkp-r) !important; font-size: 15px !important;
  line-height: 1.38 !important; box-shadow: 0 1px 1px rgba(0,0,0,.25); transition: transform .15s ease;
}
${ITEM} ${TEXT} p { color: inherit !important; }
[data-tkp-side="me"] ${TEXT} { background: var(--tkp-me) !important; color: #fff !important; }
[data-tkp-side="them"] ${TEXT} { background: var(--tkp-them) !important; color: var(--tkp-them-text) !important; }

/* grouped corners, like the app */
[data-tkp-side="me"][data-tkp-pos="first"] ${TEXT} { border-bottom-right-radius: var(--tkp-r-tight) !important; }
[data-tkp-side="me"][data-tkp-pos="middle"] ${TEXT} { border-top-right-radius: var(--tkp-r-tight) !important; border-bottom-right-radius: var(--tkp-r-tight) !important; }
[data-tkp-side="me"][data-tkp-pos="last"] ${TEXT} { border-top-right-radius: var(--tkp-r-tight) !important; }
[data-tkp-side="them"][data-tkp-pos="first"] ${TEXT} { border-bottom-left-radius: var(--tkp-r-tight) !important; }
[data-tkp-side="them"][data-tkp-pos="middle"] ${TEXT} { border-top-left-radius: var(--tkp-r-tight) !important; border-bottom-left-radius: var(--tkp-r-tight) !important; }
[data-tkp-side="them"][data-tkp-pos="last"] ${TEXT} { border-top-left-radius: var(--tkp-r-tight) !important; }

/* tighter runs, avatar only on the last message of a run */
${ITEM}[data-tkp-pos="middle"], ${ITEM}[data-tkp-pos="last"] { margin-top: -14px !important; }
${ITEM}[data-tkp-pos="first"] [data-e2e="chat-avatar"], ${ITEM}[data-tkp-pos="middle"] [data-e2e="chat-avatar"] { visibility: hidden !important; }

/* pop-in for new messages */
@keyframes tkp-pop { from { transform: translateY(10px) scale(.92); opacity: 0; } to { transform: none; opacity: 1; } }
${ITEM}[data-tkp-new] ${TEXT}, ${ITEM}[data-tkp-new] [data-e2e="dm-new-shared-video"] { animation: tkp-pop .28s cubic-bezier(.2,1.2,.4,1) both; }

/* hover actions as a small floating pill */
${ITEM} [class*="DivActions"] { background: rgba(30,30,36,.92); border-radius: 999px; padding: 2px 4px; box-shadow: 0 4px 14px rgba(0,0,0,.35); }

/* shared videos and media cards */
${ITEM} [data-e2e="dm-new-shared-video"], ${ITEM} [data-e2e="dm-new-image-card"], ${ITEM} [data-e2e="dm-new-video-card"] {
  border-radius: 18px !important; overflow: hidden !important; box-shadow: 0 6px 20px rgba(0,0,0,.35); }

/* reactions under a bubble */
${ITEM} [data-e2e="dm-new-reaction-display"] { background: #1f1f25 !important; border: 2px solid #0e0e11 !important; border-radius: 999px !important; }

/* day separators */
[data-e2e="dm-new-time-separator"] { display: flex; justify-content: center; }
[data-e2e="dm-new-time-separator"] > * , [data-e2e="dm-new-time-separator"] { font-size: 11.5px !important; letter-spacing: .02em; }
[data-e2e="dm-new-time-separator"] { color: rgba(255,255,255,.55) !important; }

/* chat background: soft accent glow */
[data-e2e="dm-new-message-list"] { background:
  radial-gradient(1200px 500px at 110% 110%, color-mix(in srgb, var(--tkp-a) 14%, transparent), transparent 60%),
  radial-gradient(900px 420px at -10% -10%, color-mix(in srgb, var(--tkp-b) 9%, transparent), transparent 60%) !important; }

/* ---------- composer ---------- */
[data-e2e="dm-new-chat-bottom"] { background: transparent !important; }
[data-e2e="message-input-area"] {
  border-radius: 26px !important; background: #1d1d23 !important; border: 1px solid rgba(255,255,255,.08) !important;
  transition: border-color .2s, box-shadow .2s; }
[data-e2e="message-input-area"]:focus-within {
  border-color: color-mix(in srgb, var(--tkp-a) 60%, transparent) !important;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--tkp-a) 18%, transparent); }
.tkdm-input { caret-color: var(--tkp-a) !important; }
[data-e2e="dm-new-emoji-btn"], [data-e2e="dm-new-media-btn"] { transition: transform .15s; }
[data-e2e="dm-new-emoji-btn"]:hover, [data-e2e="dm-new-media-btn"]:hover { transform: scale(1.12); }
@keyframes tkp-send-in { from { transform: scale(.4) rotate(-30deg); opacity: 0; } to { transform: none; opacity: 1; } }
[data-e2e="dm-new-send-btn"] { animation: tkp-send-in .22s cubic-bezier(.2,1.3,.4,1) both; filter: drop-shadow(0 2px 6px color-mix(in srgb, var(--tkp-a) 55%, transparent)); }
[data-e2e="dm-new-send-btn"] path { fill: var(--tkp-a) !important; }

/* ---------- header ---------- */
[data-e2e="top-chat-avatar"] { padding: 2px; border-radius: 50%; background: linear-gradient(135deg, var(--tkp-a), var(--tkp-b)); }
[data-e2e="top-chat-avatar"] img { border: 2px solid #121216; border-radius: 50%; }
[data-e2e="dm-new-chat-nickname"] { font-weight: 700 !important; }

/* ---------- inbox ---------- */
[data-e2e="dm-new-conversation-item"] { border-radius: 14px !important; margin: 2px 6px !important; transition: background .15s, transform .15s; }
[data-e2e="dm-new-conversation-item"]:hover { transform: translateX(2px); }
[data-e2e="dm-new-conversation-avatar"] img { transition: transform .2s; }
[data-e2e="dm-new-conversation-item"]:hover [data-e2e="dm-new-conversation-avatar"] img { transform: scale(1.05); }
[data-e2e="dm-new-conversation-item"][data-tkp-unread] [data-e2e="dm-new-conversation-avatar"] > span {
  box-shadow: 0 0 0 2px #0e0e11, 0 0 0 4px var(--tkp-a); border-radius: 50%; }
[data-e2e="dm-new-conversation-item"][data-tkp-unread] [data-e2e="dm-new-conversation-nickname"] { font-weight: 800 !important; }
[data-e2e="dm-new-conversation-unread"] { background: linear-gradient(135deg, var(--tkp-a), color-mix(in srgb, var(--tkp-a) 60%, var(--tkp-b))) !important; }
[data-e2e="dm-total-unread-count"] { background: var(--tkp-a) !important; }
`;

// ---- tagger: side, position in run, new messages, unread chats ----
const seen = new WeakSet();
let primed = false;
let lastList = null;

const sideCache = new WeakMap();
function sideOf(item) {
  if (sideCache.has(item)) return sideCache.get(item);
  const s = measureSide(item);
  if (s) sideCache.set(item, s);
  return s;
}
function measureSide(item) {
  const hc = item.querySelector('[class*="DivMessageHorizontalContainer"]') || item.firstElementChild && item.firstElementChild.firstElementChild;
  if (!hc) return '';
  return getComputedStyle(hc).flexDirection === 'row-reverse' ? 'me' : 'them';
}

function setAttr(el, k, v) {
  if (v == null) { if (el.hasAttribute(k)) el.removeAttribute(k); }
  else if (el.getAttribute(k) !== v) el.setAttribute(k, v);
}

function tag() {
  if (!document.querySelector(ITEM + ', [data-e2e="dm-new-conversation-item"]')) return;
  const list = document.querySelector('[data-e2e="dm-new-message-list"]');
  if (list !== lastList) { lastList = list; primed = false; }
  const nodes = document.querySelectorAll(ITEM + ', [data-e2e="dm-new-time-separator"]');
  const rows = [];
  for (const n of nodes) {
    if (n.getAttribute('data-e2e') === 'dm-new-time-separator') { rows.push(null); continue; }
    rows.push({ el: n, side: sideOf(n) });
  }
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const prev = rows[i - 1], next = rows[i + 1];
    const joinPrev = prev && prev.side === r.side;
    const joinNext = next && next.side === r.side;
    const pos = joinPrev && joinNext ? 'middle' : joinPrev ? 'last' : joinNext ? 'first' : 'single';
    setAttr(r.el, 'data-tkp-side', r.side || null);
    setAttr(r.el, 'data-tkp-pos', pos);
    if (!seen.has(r.el)) {
      seen.add(r.el);
      if (primed) {
        r.el.setAttribute('data-tkp-new', '');
        setTimeout(() => r.el.removeAttribute('data-tkp-new'), 700);
      }
    }
  }
  if (rows.length) primed = true;

  for (const c of document.querySelectorAll('[data-e2e="dm-new-conversation-item"]')) {
    setAttr(c, 'data-tkp-unread', c.querySelector('[data-e2e="dm-new-conversation-unread"]') ? '' : null);
  }
}

export function startLook() {
  let obs = null, queued = false, timer = null;
  const queue = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; try { tag(); } catch (e) {} }); };
  const sync = () => {
    if (get('appLook')) {
      addStyle('tkp-look-vars', vars());
      addStyle('tkp-look-css', CSS);
      if (!obs) {
        obs = new MutationObserver(queue);
        obs.observe(document.documentElement, { childList: true, subtree: true });
        timer = setInterval(queue, 1500);
      }
      queue();
    } else {
      removeStyle('tkp-look-vars');
      removeStyle('tkp-look-css');
      if (obs) { obs.disconnect(); obs = null; clearInterval(timer); }
    }
  };
  sync();
  on('appLook', sync);
  on('accent', () => { if (get('appLook')) addStyle('tkp-look-vars', vars()); });
}
