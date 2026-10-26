// Per-chat wallpaper and bubble theme, like the app's chat appearance settings.
// Saved on this device per chat (keyed by the other person's @handle). Only you see it.
import { get } from '../core/settings.js';
import { addStyle, removeStyle, h, loadData, saveData, toast } from '../core/util.js';
import { openPopover } from '../ui/popover.js';
import { ACCENTS } from './look.js';
import { headerHost } from './msgTools.js';

export const WALLPAPERS = {
  none: { label: 'None', css: '' },
  aurora: { label: 'Aurora', css: 'radial-gradient(900px 600px at 15% 10%, #3b0f5e 0%, transparent 60%), radial-gradient(800px 600px at 90% 80%, #0f4f5e 0%, transparent 60%), #0b0b10' },
  midnight: { label: 'Midnight', css: 'linear-gradient(160deg, #0b1026 0%, #141b3d 50%, #0b0b14 100%)' },
  sunset: { label: 'Sunset', css: 'linear-gradient(170deg, #2b0f1e 0%, #4a1626 45%, #1a0b10 100%)' },
  ocean: { label: 'Ocean', css: 'linear-gradient(180deg, #06202b 0%, #0b3442 50%, #061419 100%)' },
  forest: { label: 'Forest', css: 'linear-gradient(170deg, #0b1f14 0%, #123323 55%, #08130c 100%)' },
  grid: { label: 'Neon grid', css: 'linear-gradient(rgba(254,44,85,.08) 1px, transparent 1px) 0 0/32px 32px, linear-gradient(90deg, rgba(37,244,238,.08) 1px, transparent 1px) 0 0/32px 32px, #0b0b10' },
  dots: { label: 'Dots', css: 'radial-gradient(rgba(255,255,255,.08) 1.2px, transparent 1.4px) 0 0/22px 22px, #0e0e13' },
};

const all = () => loadData('chatThemes', {});
const chatKey = () => {
  const el = document.querySelector('[data-e2e="chat-uniqueid"]');
  return el ? el.textContent.trim().replace(/^@/, '') : '';
};
const imgCache = new Map();

async function blurred(dataUrl, px) {
  const k = dataUrl.length + ':' + dataUrl.slice(-40) + ':' + px;
  if (imgCache.has(k)) return imgCache.get(k);
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl; });
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d');
  if (px) { g.filter = `blur(${px}px)`; g.drawImage(img, -px * 2, -px * 2, c.width + px * 4, c.height + px * 4); }
  else g.drawImage(img, 0, 0);
  const out = c.toDataURL('image/jpeg', 0.85);
  imgCache.set(k, out);
  return out;
}

async function fileToData(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.82);
  } finally { URL.revokeObjectURL(url); }
}

async function apply() {
  const key = chatKey();
  const t = key ? all()[key] : null;
  if (!get('chatThemes') || !t || (!t.wall && !t.bubble)) { removeStyle('tkp-chattheme-css'); return; }
  let bg = '';
  const dim = Math.max(0, Math.min(0.85, (t.dim || 0) / 100));
  if (t.wall === 'custom' && t.img) {
    const src = await blurred(t.img, t.blur || 0);
    bg = `linear-gradient(rgba(0,0,0,${dim}), rgba(0,0,0,${dim})), url("${src}") center/cover no-repeat`;
  } else if (t.wall && WALLPAPERS[t.wall] && WALLPAPERS[t.wall].css) {
    bg = (dim ? `linear-gradient(rgba(0,0,0,${dim}), rgba(0,0,0,${dim})), ` : '') + WALLPAPERS[t.wall].css;
  }
  const ac = t.bubble && ACCENTS[t.bubble];
  const css = (bg ? `[data-e2e="dm-new-message-list"] { background: ${bg} !important; background-attachment: local !important; }` : '') +
    (ac ? `:root { --tkp-me: ${ac.me} !important; --tkp-a: ${ac.a} !important; --tkp-b: ${ac.b} !important; }` : '');
  addStyle('tkp-chattheme-css', css);
}

function edit(key, patch) {
  const a = all();
  a[key] = Object.assign({}, a[key], patch);
  if (!saveData('chatThemes', a)) toast("Couldn't save. The image may be too big for browser storage.");
  apply();
}

function panel(el) {
  const key = chatKey();
  const t = all()[key] || {};
  el.append(h('h5', null, 'Chat appearance · @' + key));
  const wallSel = h('select', null, Object.entries(WALLPAPERS).map(([k, v]) => h('option', { value: k }, v.label)), h('option', { value: 'custom' }, 'Your image...'));
  wallSel.value = t.wall || 'none';
  const file = h('input', { type: 'file', accept: 'image/*', hidden: true });
  file.addEventListener('change', async () => {
    const f = file.files && file.files[0];
    if (!f) return;
    try { edit(key, { wall: 'custom', img: await fileToData(f) }); } catch (e) { toast("That image couldn't be loaded."); }
  });
  wallSel.addEventListener('change', () => { if (wallSel.value === 'custom') file.click(); else edit(key, { wall: wallSel.value }); });
  const blur = h('input', { type: 'range', min: 0, max: 20, value: t.blur || 0 });
  blur.addEventListener('change', () => edit(key, { blur: Number(blur.value) }));
  const dim = h('input', { type: 'range', min: 0, max: 80, value: t.dim || 0 });
  dim.addEventListener('change', () => edit(key, { dim: Number(dim.value) }));
  const bub = h('select', null, h('option', { value: '' }, 'Same as everywhere'), Object.entries(ACCENTS).map(([k, v]) => h('option', { value: k }, v.label)));
  bub.value = t.bubble || '';
  bub.addEventListener('change', () => edit(key, { bubble: bub.value }));
  const lbl = (txt, ctl) => h('label', { style: { display: 'block', margin: '8px 4px' } }, h('div', { style: { fontSize: '12.5px', opacity: '.7', marginBottom: '4px' } }, txt), ctl);
  el.append(lbl('Wallpaper', wallSel), file, lbl('Blur (your image)', blur), lbl('Darken', dim), lbl('Bubble color', bub),
    h('div', { style: { display: 'flex', justifyContent: 'flex-end', marginTop: '6px' } },
      h('button', { class: 'tkp-pbtn', onclick: () => { const a = all(); delete a[key]; saveData('chatThemes', a); apply(); el.remove(); } }, 'Reset this chat')));
}

export function startChatTheme() {
  let lastKey = null;
  setInterval(() => {
    const host = get('chatThemes') ? headerHost() : null;
    if (host && !host.querySelector('.tkp-ct-btn')) {
      const btn = h('button', { class: 'tkp-hdr-btn tkp-ct-btn', title: 'Chat appearance (wallpaper, bubbles)', type: 'button' }, '🎨');
      btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); openPopover(btn, panel, { width: 280 }); });
      host.appendChild(btn);
    }
    if (!get('chatThemes')) document.querySelectorAll('.tkp-ct-btn').forEach(b => b.remove());
    const key = chatKey();
    if (key !== lastKey) { lastKey = key; apply(); }
  }, 700);
}
