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
