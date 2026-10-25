// The gear button and settings panel. Built from the settings schema, so every feature shows up.
import { SCHEMA, get, set, on, exportJson, importJson, reset } from '../core/settings.js';
import { addStyle, h } from '../core/util.js';

const VERSION = typeof __TKP_VERSION__ !== 'undefined' ? __TKP_VERSION__ : '';

const CSS = `
  .tkp-gear { position: fixed; z-index: 2147483001; left: 14px; bottom: 14px; width: 40px; height: 40px;
    border-radius: 50%; border: 1px solid rgba(255,255,255,.14); cursor: pointer;
    background: linear-gradient(135deg, rgba(254,44,85,.9), rgba(37,244,238,.75));
    box-shadow: 0 6px 22px rgba(0,0,0,.4); display: grid; place-items: center; color: #fff;
    font-size: 20px; line-height: 1; transition: transform .25s; padding: 0; }
  .tkp-gear:hover { transform: rotate(60deg) scale(1.06); }
  .tkp-overlay { position: fixed; inset: 0; z-index: 2147483002; background: rgba(0,0,0,.45);
    backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px); display: grid; place-items: center; }
  .tkp-panel { width: min(520px, calc(100vw - 32px)); max-height: min(80vh, 760px); overflow: auto;
    background: #141418; color: #f1f1f2; border: 1px solid rgba(255,255,255,.1); border-radius: 18px;
    box-shadow: 0 24px 80px rgba(0,0,0,.6); font: 14px/1.4 system-ui, -apple-system, Segoe UI, sans-serif; }
  .tkp-head { position: sticky; top: 0; display: flex; align-items: center; gap: 10px; padding: 16px 18px;
    background: rgba(20,20,24,.96); border-bottom: 1px solid rgba(255,255,255,.08); }
  .tkp-head b { font-size: 17px; background: linear-gradient(90deg, #fe2c55, #25f4ee);
    -webkit-background-clip: text; background-clip: text; color: transparent; }
  .tkp-head small { opacity: .5; }
  .tkp-head button { margin-left: auto; }
  .tkp-group { padding: 6px 18px 10px; }
  .tkp-group h4 { margin: 12px 0 4px; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; opacity: .55; }
  .tkp-row { display: flex; align-items: center; gap: 14px; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,.05); }
  .tkp-row:last-child { border-bottom: 0; }
  .tkp-row .tkp-txt { flex: 1; }
  .tkp-row .tkp-txt div { font-weight: 600; }
  .tkp-row .tkp-txt p { margin: 2px 0 0; font-size: 12.5px; opacity: .6; }
  .tkp-row .tkp-reload { color: #ffb020; font-size: 12px; margin-top: 3px; }
  .tkp-switch { position: relative; width: 42px; height: 24px; flex: none; }
  .tkp-switch input { opacity: 0; width: 0; height: 0; position: absolute; }
  .tkp-switch span { position: absolute; inset: 0; border-radius: 999px; background: #3a3a40; transition: .2s; cursor: pointer; }
  .tkp-switch span::after { content: ''; position: absolute; left: 3px; top: 3px; width: 18px; height: 18px;
    border-radius: 50%; background: #fff; transition: .2s; }
  .tkp-switch input:checked + span { background: #fe2c55; }
  .tkp-switch input:checked + span::after { transform: translateX(18px); }
  .tkp-panel select { background: #22222a; color: #fff; border: 1px solid rgba(255,255,255,.15);
    border-radius: 8px; padding: 6px 8px; font: inherit; }
  .tkp-btn { all: unset; cursor: pointer; padding: 8px 14px; border-radius: 10px; background: #26262e;
    font-weight: 600; font-size: 13px; }
  .tkp-btn:hover { background: #30303a; }
  .tkp-btn.tkp-primary { background: #fe2c55; }
  .tkp-foot { display: flex; flex-wrap: wrap; gap: 8px; padding: 14px 18px 18px; border-top: 1px solid rgba(255,255,255,.08); }
`;

function row(s, needsReload) {
  let control;
  if (s.type === 'toggle') {
    const input = h('input', { type: 'checkbox' });
    input.checked = !!get(s.key);
    input.addEventListener('change', () => { set(s.key, input.checked); needsReload(s); });
    on(s.key, v => { input.checked = !!v; });
    control = h('label', { class: 'tkp-switch' }, input, h('span'));
  } else if (s.type === 'select') {
    const sel = h('select', null, s.options.map(o => h('option', { value: String(o.value) }, o.label)));
    sel.value = String(get(s.key));
    sel.addEventListener('change', () => {
      const o = s.options.find(x => String(x.value) === sel.value);
      set(s.key, o ? o.value : sel.value);
      needsReload(s);
    });
    on(s.key, v => { sel.value = String(v); });
    control = sel;
  }
  const note = h('div', { class: 'tkp-reload', hidden: true }, 'Reload TikTok to apply');
  const el = h('div', { class: 'tkp-row' },
    h('div', { class: 'tkp-txt' }, h('div', null, s.label), s.desc ? h('p', null, s.desc) : null, note),
    control);
  el.__note = note;
  return el;
}

function download(name, text) {
  const a = h('a', { href: URL.createObjectURL(new Blob([text], { type: 'application/json' })), download: name });
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

function openPanel() {
  if (document.querySelector('.tkp-overlay')) return;
  const rows = new Map();
  const needsReload = s => { if (s.reload && rows.get(s.key)) rows.get(s.key).__note.hidden = false; };

  const groups = [];
  for (const s of SCHEMA) {
    let g = groups.find(x => x.name === s.group);
    if (!g) groups.push(g = { name: s.group, items: [] });
    g.items.push(s);
  }

  const close = () => overlay.remove();
  const file = h('input', { type: 'file', accept: '.json,application/json', hidden: true });
  file.addEventListener('change', async () => {
    const f = file.files && file.files[0];
    if (!f) return;
    try { importJson(await f.text()); alertBox('Settings imported. Reload TikTok to apply everything.'); }
    catch (e) { alertBox("That file isn't a TikTok Plus settings file."); }
  });

  const msg = h('div', { style: { padding: '0 18px', color: '#25f4ee', fontSize: '13px' } });
  const alertBox = t => { msg.textContent = t; };

  const panel = h('div', { class: 'tkp-panel', role: 'dialog', 'aria-label': 'TikTok Plus settings' },
    h('div', { class: 'tkp-head' }, h('b', null, 'TikTok Plus'), h('small', null, VERSION ? 'v' + VERSION : ''),
      h('button', { class: 'tkp-btn', onclick: close }, 'Done')),
    groups.map(g => h('div', { class: 'tkp-group' }, h('h4', null, g.name),
      g.items.map(s => { const r = row(s, needsReload); rows.set(s.key, r); return r; }))),
    msg,
    h('div', { class: 'tkp-foot' },
      h('button', { class: 'tkp-btn', onclick: () => download('tiktok-plus-settings.json', exportJson()) }, 'Export settings'),
      h('button', { class: 'tkp-btn', onclick: () => file.click() }, 'Import settings'),
      h('button', { class: 'tkp-btn', onclick: () => { reset(); alertBox('Back to defaults. Reload TikTok to apply everything.'); } }, 'Reset'),
      h('button', { class: 'tkp-btn tkp-primary', onclick: () => location.reload() }, 'Reload TikTok'),
      file));

  const overlay = h('div', { class: 'tkp-overlay', onclick: e => { if (e.target === overlay) close(); } }, panel);
  overlay.addEventListener('keydown', e => { if (e.key === 'Escape') close(); e.stopPropagation(); });
  document.body.appendChild(overlay);
}

export function startPanel() {
  addStyle('tkp-panel-css', CSS);
  const gear = h('button', { class: 'tkp-gear', title: 'TikTok Plus settings', 'aria-label': 'TikTok Plus settings', onclick: openPanel }, '⚙');
  const mount = () => { if (document.body && !gear.isConnected) document.body.appendChild(gear); };
  mount();
  setInterval(mount, 1500);
}
