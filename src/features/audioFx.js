// Audio effects through the Web Audio API: 10-band equalizer presets, loudness leveling and 8D audio.
// TikTok's player already sends each video through its own Web Audio graph, and a video can only have
// one source node. So at document-start we wrap createMediaElementSource and splice our chain in
// between TikTok's source and wherever TikTok connects it. The chain is neutral (flat) until an effect
// is turned on. Videos TikTok never routes get their own source the first time an effect is on.
import { get, set, on } from '../core/settings.js';
import { h } from '../core/util.js';
import { dockGroup } from '../ui/dock.js';

const BANDS = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
export const EQ_PRESETS = {
  off: { label: 'Off', g: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  bass: { label: 'Bass boost', g: [7, 6, 4, 2, 0, 0, 0, 0, 0, 0] },
  vocal: { label: 'Vocals', g: [-3, -2, -1, 0, 2, 3, 3, 2, 0, -1] },
  treble: { label: 'Treble', g: [0, 0, 0, 0, 0, 1, 2, 4, 5, 6] },
  loud: { label: 'Loudness (smile)', g: [5, 4, 1, 0, -1, 0, 1, 3, 4, 4] },
  club: { label: 'Club', g: [3, 5, 4, 1, 0, 0, 1, 2, 3, 2] },
  podcast: { label: 'Speech clarity', g: [-6, -4, -2, 0, 2, 4, 4, 3, 1, -2] },
};

const chains = new Set();           // every chain we built, so setting changes reach all of them
const byElement = new WeakMap();    // video -> chain
let ownCtx = null;

const anyFx = () => (get('eqPreset') && get('eqPreset') !== 'off') || get('normalize') || get('audio8d');

function makeChain(ctx) {
  const input = ctx.createGain();
  const filters = BANDS.map((f, i) => {
    const b = ctx.createBiquadFilter();
    b.type = i === 0 ? 'lowshelf' : i === BANDS.length - 1 ? 'highshelf' : 'peaking';
    b.frequency.value = f; b.Q.value = 1.1; b.gain.value = 0;
    return b;
  });
  const comp = ctx.createDynamicsCompressor();
  const makeup = ctx.createGain();
  const pan = ctx.createStereoPanner();
  const lfo = ctx.createOscillator();
  const lfoDepth = ctx.createGain();
  lfo.frequency.value = 0.11; lfoDepth.gain.value = 0;
  lfo.connect(lfoDepth); lfoDepth.connect(pan.pan);
  try { lfo.start(); } catch (e) {}
  let node = input;
  for (const f of filters) { node.connect(f); node = f; }
  node.connect(comp); comp.connect(makeup); makeup.connect(pan);
  const chain = { input, output: pan, filters, comp, makeup, lfoDepth };
  chains.add(chain);
  applyTo(chain);
  return chain;
}

function applyTo(c) {
  const preset = EQ_PRESETS[get('eqPreset')] || EQ_PRESETS.off;
  c.filters.forEach((f, i) => { f.gain.value = preset.g[i]; });
  if (get('normalize')) {
    c.comp.threshold.value = -26; c.comp.knee.value = 18; c.comp.ratio.value = 6;
    c.comp.attack.value = 0.004; c.comp.release.value = 0.25; c.makeup.gain.value = 1.5;
  } else {
    c.comp.threshold.value = 0; c.comp.knee.value = 0; c.comp.ratio.value = 1; c.makeup.gain.value = 1;
  }
  c.lfoDepth.gain.value = get('audio8d') ? 0.85 : 0;
}

// Runs at document-start, before TikTok's player creates its audio graph.
export function installAudioHook() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC || !AC.prototype.createMediaElementSource) return;
  const orig = AC.prototype.createMediaElementSource;
  AC.prototype.createMediaElementSource = function (el) {
    const src = orig.call(this, el);
    try {
      const chain = makeChain(this);
      byElement.set(el, chain);
      const connect = src.connect.bind(src);
      const disconnect = src.disconnect.bind(src);
      let wired = false;
      src.connect = function (dest, ...rest) {
        if (!wired) { connect(chain.input); wired = true; }
        return chain.output.connect(dest, ...rest);
      };
      src.disconnect = function (...args) {
        if (!args.length) { try { disconnect(); } catch (e) {} wired = false; try { chain.output.disconnect(); } catch (e) {} return; }
        try { chain.output.disconnect(...args); } catch (e) {}
      };
    } catch (e) {}
    return src;
  };
}

// For a video TikTok didn't route through Web Audio: give it our own source and chain.
function routeOwn(v) {
  if (byElement.has(v) || !anyFx()) return;
  if (!ownCtx) { try { ownCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; } }
  if (ownCtx.state !== 'running') { ownCtx.resume().then(() => routeOwn(v)).catch(() => {}); return; }
  try {
    const src = ownCtx.createMediaElementSource(v); // goes through our wrapper, which builds the chain
    src.connect(ownCtx.destination);
  } catch (e) {}
}

export function startAudioFx() {
  const refresh = () => {
    for (const c of chains) applyTo(c);
    for (const v of document.querySelectorAll('video')) if (!v.paused) routeOwn(v);
  };
  ['eqPreset', 'normalize', 'audio8d'].forEach(k => on(k, refresh));
  document.addEventListener('play', e => { if (e.target instanceof HTMLVideoElement) routeOwn(e.target); }, true);
  document.addEventListener('pointerdown', () => { if (anyFx() && ownCtx && ownCtx.state !== 'running') ownCtx.resume().catch(() => {}); }, true);

  const g = dockGroup(30, () => get('audioDock'));
  const keys = Object.keys(EQ_PRESETS);
  const eqBtn = h('button', { title: 'Equalizer preset (click to cycle)' });
  const nBtn = h('button', { title: 'Loudness leveling' }, '◍');
  const dBtn = h('button', { title: '8D audio' }, '8D');
  const render = () => {
    const p = get('eqPreset') || 'off';
    eqBtn.textContent = p === 'off' ? 'EQ' : 'EQ·' + (EQ_PRESETS[p] || EQ_PRESETS.off).label.split(' ')[0];
    eqBtn.classList.toggle('tkp-on', p !== 'off');
    nBtn.classList.toggle('tkp-on', !!get('normalize'));
    dBtn.classList.toggle('tkp-on', !!get('audio8d'));
  };
  eqBtn.addEventListener('click', () => { const i = keys.indexOf(get('eqPreset') || 'off'); set('eqPreset', keys[(i + 1) % keys.length]); });
  nBtn.addEventListener('click', () => set('normalize', !get('normalize')));
  dBtn.addEventListener('click', () => set('audio8d', !get('audio8d')));
  g.append(h('span', { class: 'tkp-sep' }), eqBtn, nBtn, dBtn);
  ['eqPreset', 'normalize', 'audio8d'].forEach(k => on(k, render));
  render();
}

export const _debug = { chains, byElement };
