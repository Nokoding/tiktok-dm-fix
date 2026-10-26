// A small popover anchored to a button. Closes on outside click or Escape.
import { addStyle, h } from '../core/util.js';

const CSS = `
  .tkp-pop { position: fixed; z-index: 2147483003; width: 300px; max-height: 420px; overflow: auto; padding: 10px;
    background: rgba(24,24,30,.98); color: #f1f1f2; border: 1px solid rgba(255,255,255,.1); border-radius: 16px;
    box-shadow: 0 16px 50px rgba(0,0,0,.55); font: 14px/1.35 system-ui, -apple-system, Segoe UI, sans-serif;
    animation: tkp-pop-in .12s ease-out both; }
  @keyframes tkp-pop-in { from { transform: translateY(6px); opacity: 0; } to { transform: none; opacity: 1; } }
  .tkp-pop h5 { margin: 4px 4px 8px; font-size: 12px; letter-spacing: .06em; text-transform: uppercase; opacity: .55; }
  .tkp-pop-row { display: flex; align-items: center; gap: 8px; padding: 8px 8px; border-radius: 10px; cursor: pointer; }
  .tkp-pop-row:hover, .tkp-pop-row.tkp-sel { background: rgba(255,255,255,.08); }
  .tkp-pop-row .tkp-grow { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tkp-pop-x { all: unset; cursor: pointer; opacity: .45; padding: 0 4px; }
  .tkp-pop-x:hover { opacity: 1; }
  .tkp-pop input[type=text], .tkp-pop textarea, .tkp-pop select { width: 100%; box-sizing: border-box; background: #22222a;
    color: #fff; border: 1px solid rgba(255,255,255,.15); border-radius: 9px; padding: 7px 9px; font: inherit; }
  .tkp-pop .tkp-pbtn { all: unset; cursor: pointer; padding: 7px 12px; border-radius: 9px; background: #2a2a33;
    font-weight: 600; font-size: 13px; }
  .tkp-pop .tkp-pbtn:hover { background: #34343e; }
  .tkp-pop .tkp-pbtn.tkp-primary { background: var(--tkp-a, #fe2c55); }
  .tkp-pop .tkp-hint { font-size: 12px; opacity: .55; margin: 6px 4px 0; }
`;

let current = null;

export function closePopover() {
  if (current) { current.el.remove(); document.removeEventListener('pointerdown', current.out, true); document.removeEventListener('keydown', current.key, true); current = null; }
}

export function openPopover(anchor, build, opts = {}) {
  addStyle('tkp-pop-css', CSS);
  if (current && current.anchor === anchor) { closePopover(); return null; }
  closePopover();
  const el = h('div', { class: 'tkp-pop', role: 'dialog' });
  if (opts.width) el.style.width = opts.width + 'px';
  build(el);
  document.body.appendChild(el);
  const r = anchor.getBoundingClientRect();
  const w = el.offsetWidth, hh = el.offsetHeight;
  let left = Math.min(Math.max(8, r.right - w), innerWidth - w - 8);
  let top = r.top - hh - 10;
  if (top < 8) top = Math.min(r.bottom + 10, innerHeight - hh - 8);
  el.style.left = left + 'px';
  el.style.top = top + 'px';
  const out = e => { if (!el.contains(e.target) && !anchor.contains(e.target)) closePopover(); };
  const key = e => { if (e.key === 'Escape') { e.stopPropagation(); closePopover(); } };
  document.addEventListener('pointerdown', out, true);
  document.addEventListener('keydown', key, true);
  current = { el, anchor, out, key };
  return el;
}
