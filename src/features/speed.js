// Playback speed 0.25x to 4x, re-applied to every new video, with a pill and shortcut keys.
import { get, set, on, SCHEMA } from '../core/settings.js';
import { addStyle, h, isTyping } from '../core/util.js';

const STEPS = SCHEMA.find(s => s.key === 'speed').options.map(o => o.value);

const CSS = `
  .tkp-speed { position: fixed; z-index: 2147483000; right: 18px; bottom: 18px; display: flex;
    align-items: center; gap: 2px; padding: 4px; border-radius: 999px;
    background: rgba(22,22,26,.82); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
    border: 1px solid rgba(255,255,255,.12); color: #fff; font: 600 13px/1 system-ui, sans-serif;
    box-shadow: 0 6px 24px rgba(0,0,0,.35); user-select: none; transition: opacity .2s; }
  .tkp-speed[hidden] { display: none; }
  .tkp-speed button { all: unset; cursor: pointer; width: 28px; height: 28px; border-radius: 50%;
    display: grid; place-items: center; font-size: 16px; color: #fff; }
  .tkp-speed button:hover { background: rgba(255,255,255,.12); }
  .tkp-speed .tkp-speed-val { min-width: 44px; text-align: center; cursor: pointer; }
  .tkp-speed .tkp-speed-val.tkp-fast { color: #25f4ee; }
`;

export function startSpeed() {
  let applying = false;
  const target = () => Number(get('speed')) || 1;
  const apply = v => {
    const s = target();
    if (Math.abs(v.playbackRate - s) > 0.001) {
      applying = true;
      try { v.playbackRate = s; } catch (e) {}
      applying = false;
    }
  };
  const applyAll = () => document.querySelectorAll('video').forEach(apply);

  for (const ev of ['play', 'loadedmetadata', 'ratechange']) {
    document.addEventListener(ev, e => {
      if (!(e.target instanceof HTMLVideoElement)) return;
      if (ev === 'ratechange' && applying) return;
      apply(e.target);
    }, true);
  }
  on('speed', applyAll);

  const step = dir => {
    const i = STEPS.indexOf(target());
    const next = STEPS[Math.max(0, Math.min(STEPS.length - 1, (i < 0 ? STEPS.indexOf(1) : i) + dir))];
    set('speed', next);
  };

  document.addEventListener('keydown', e => {
    if (!get('speedPill') || isTyping(e) || e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.key === '>') { step(1); e.preventDefault(); }
    else if (e.key === '<') { step(-1); e.preventDefault(); }
  }, true);

  addStyle('tkp-speed-css', CSS);
  const val = h('span', { class: 'tkp-speed-val', title: 'Back to 1x', onclick: () => set('speed', 1) });
  const pill = h('div', { class: 'tkp-speed', hidden: true },
    h('button', { title: 'Slower (Shift+,)', onclick: () => step(-1) }, '−'),
    val,
    h('button', { title: 'Faster (Shift+.)', onclick: () => step(1) }, '+'));
  const render = () => {
    val.textContent = target() + 'x';
    val.classList.toggle('tkp-fast', target() !== 1);
  };
  render();
  on('speed', render);

  const mount = () => { if (!pill.isConnected && document.body) document.body.appendChild(pill); };
  setInterval(() => {
    mount();
    const onMessages = location.pathname.startsWith('/messages');
    const hasVideo = [...document.querySelectorAll('video')].some(v => !v.paused && v.isConnected);
    pill.hidden = !get('speedPill') || onMessages || !hasVideo;
  }, 700);
}
