export const log = (...a) => { try { console.debug('[TikTok Plus]', ...a); } catch (e) {} };

// Runs fn and never lets one broken feature take the rest down.
export function safe(name, fn) {
  try { return fn(); } catch (e) { log(name + ' failed', e); }
}

export function addStyle(id, css) {
  let s = document.getElementById(id);
  if (!s) {
    s = document.createElement('style');
    s.id = id;
    (document.head || document.documentElement).appendChild(s);
  }
  if (s.textContent !== css) s.textContent = css;
  return s;
}

export function removeStyle(id) {
  const s = document.getElementById(id);
  if (s) s.remove();
}

export function onReady(fn) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
  else fn();
}

// Small DOM builder. No innerHTML anywhere, so TikTok's Trusted Types policy can't block us.
export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) {
    for (const k in props) {
      const v = props[k];
      if (v == null || v === false) continue;
      if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'class') el.className = v;
      else if (k in el && typeof v !== 'string') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.appendChild(typeof kid === 'string' || typeof kid === 'number' ? document.createTextNode(String(kid)) : kid);
  }
  return el;
}

export function fiberOf(el) {
  if (!el) return null;
  const k = Object.keys(el).find(x => x.startsWith('__reactFiber$'));
  return k ? el[k] : null;
}

// Walks up the React tree from a DOM node until test(props) is true.
export function findProps(el, test, max = 60) {
  let f = fiberOf(el), n = 0;
  while (f && n < max) {
    const p = f.memoizedProps;
    if (p && typeof p === 'object' && test(p)) return p;
    f = f.return; n++;
  }
  return null;
}

// True when the user is typing somewhere, so our shortcut keys stay out of the way.
export function isTyping(e) {
  const t = e.target;
  if (!t || !t.tagName) return false;
  return t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
}

// The video you're watching: the playing one with the most area on screen, else the most visible one.
export function activeVideo() {
  let best = null, bestScore = -1;
  for (const v of document.querySelectorAll('video')) {
    if (!v.isConnected) continue;
    const r = v.getBoundingClientRect();
    const w = Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0));
    const hh = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
    const score = w * hh + (v.paused ? 0 : 1e9);
    if (w * hh > 0 && score > bestScore) { best = v; bestScore = score; }
  }
  return best;
}

export function onFeedPage() {
  const p = location.pathname;
  return p === '/' || p.startsWith('/foryou') || p.startsWith('/following') || p.startsWith('/friends') || p.startsWith('/explore');
}

export function toast(text, ms = 2600) {
  addStyle('tkp-toast-css', `.tkp-toast { position: fixed; z-index: 2147483004; left: 50%; bottom: 84px;
    transform: translateX(-50%); background: rgba(24,24,30,.96); color: #fff; padding: 10px 16px;
    border-radius: 12px; font: 13.5px/1.35 system-ui, sans-serif; border: 1px solid rgba(255,255,255,.1);
    box-shadow: 0 10px 30px rgba(0,0,0,.45); max-width: min(420px, 90vw); text-align: center; }`);
  const el = h('div', { class: 'tkp-toast', role: 'status' }, text);
  document.body.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

// Separate localStorage slot for lists and per-chat data (settings stay small).
export function loadData(key, def) {
  try { const raw = localStorage.getItem('tkplus:data:' + key); return raw ? JSON.parse(raw) : def; } catch (e) { return def; }
}
export function saveData(key, val) {
  try { localStorage.setItem('tkplus:data:' + key, JSON.stringify(val)); return true; } catch (e) { return false; }
}
