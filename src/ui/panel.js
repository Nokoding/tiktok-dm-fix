// The gear button and settings panel. Built from the settings schema, so every feature shows up.
import { SCHEMA, get, set, on, exportJson, importJson, reset } from '../core/settings.js';
import { addStyle, h } from '../core/util.js';

const VERSION = typeof __TKP_VERSION__ !== 'undefined' ? __TKP_VERSION__ : '';

const CSS = `
  .tkp-gear { position: fixed; z-index: 2147483001; left: 14px; bottom: 14px; width: 40px; height: 40px;
    border-radius: 50%; border: 0; cursor: pointer; background: transparent; color: #fff;
    display: grid; place-items: center; padding: 0; transition: background .15s, transform .15s; }
  html:not([data-theme="dark"]) .tkp-gear { color: #161823; }
  .tkp-gear:hover { background: rgba(255,255,255,.1); transform: scale(1.06); }
  .tkp-gear svg { width: 26px; height: 26px; display: block; }
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
  .tkp-text { width: 170px; background: #22222a; color: #fff; border: 1px solid rgba(255,255,255,.15); border-radius: 8px; padding: 6px 8px; font: inherit; resize: vertical; }
  .tkp-btn { all: unset; cursor: pointer; padding: 8px 14px; border-radius: 10px; background: #26262e;
    font-weight: 600; font-size: 13px; }
  .tkp-btn:hover { background: #30303a; }
  .tkp-btn.tkp-primary { background: #fe2c55; }
  .tkp-foot { display: flex; flex-wrap: wrap; gap: 8px; padding: 14px 18px 18px; border-top: 1px solid rgba(255,255,255,.08); }
`;

// The TikTok outline mark with a small rounded plus at the top right. Built with the DOM (no innerHTML).
function logo() {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none');
  const mk = (d, w) => {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d); p.setAttribute('stroke', 'currentColor'); p.setAttribute('stroke-width', w);
    p.setAttribute('stroke-linejoin', 'round'); p.setAttribute('stroke-linecap', 'round'); p.setAttribute('fill', 'none');
    svg.appendChild(p);
  };
  mk('M16.8217 5.1344C16.0886 4.29394 15.6479 3.19805 15.6479 2H14.7293M16.8217 5.1344C17.4898 5.90063 18.3944 6.45788 19.4245 6.67608C19.7446 6.74574 20.0786 6.78293 20.4266 6.78293V10.2191C18.645 10.2191 16.9932 9.64801 15.6477 8.68211V15.6707C15.6477 19.1627 12.8082 22 9.32386 22C7.50043 22 5.85334 21.2198 4.69806 19.98C3.64486 18.847 2.99994 17.3331 2.99994 15.6707C2.99994 12.2298 5.75592 9.42509 9.17073 9.35079M16.8217 5.1344C16.8039 5.12276 16.7861 5.11101 16.7684 5.09914M6.9855 17.3517C6.64217 16.8781 6.43802 16.2977 6.43802 15.6661C6.43802 14.0734 7.73249 12.7778 9.32394 12.7778C9.62087 12.7778 9.9085 12.8288 10.1776 12.9124V9.40192C9.89921 9.36473 9.61622 9.34149 9.32394 9.34149C9.27287 9.34149 8.86177 9.36884 8.81073 9.36884M14.7244 2H12.2097L12.2051 15.7775C12.1494 17.3192 10.8781 18.5591 9.32386 18.5591C8.35878 18.5591 7.50971 18.0808 6.98079 17.3564', 1.1);
  // small plus with soft, slightly curved arms
  mk('M20.4 0.9Q20.4 2.9 20.4 4.9M18.4 2.9Q20.4 2.9 22.4 2.9', 1.4);
  return svg;
}

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
  } else if (s.type === 'text') {
    const ta = h('textarea', { rows: 2, placeholder: 'word, another word', class: 'tkp-text' });
    ta.value = get(s.key) || '';
    ta.addEventListener('change', () => { set(s.key, ta.value); });
    ta.addEventListener('keydown', e => e.stopPropagation());
    on(s.key, v => { if (document.activeElement !== ta) ta.value = v || ''; });
    control = ta;
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

  const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey, true); };
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

  const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } };
  const overlay = h('div', { class: 'tkp-overlay', onclick: e => { if (e.target === overlay) close(); } }, panel);
  overlay.addEventListener('keydown', e => e.stopPropagation());
  document.addEventListener('keydown', onKey, true);
  document.body.appendChild(overlay);
}

export function startPanel() {
  addStyle('tkp-panel-css', CSS);
  const gear = h('button', { class: 'tkp-gear', title: 'TikTok Plus settings', 'aria-label': 'TikTok Plus settings', onclick: openPanel }, logo());
  const mount = () => { if (document.body && !gear.isConnected) document.body.appendChild(gear); };
  mount();
  setInterval(mount, 1500);
}
