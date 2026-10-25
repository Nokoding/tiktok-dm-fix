// Settings live in this browser's localStorage. Export/import moves them to another computer.
const KEY = 'tkplus:settings:v1';

// Every feature has an entry here. The panel is built from this list.
// reload: true means the change only takes effect after a page reload.
export const SCHEMA = [
  { group: 'Messages', key: 'composer', label: 'Fixed message box', desc: 'Native text box: Enter sends, no lost letters, no ghost text.', type: 'toggle', def: true, reload: true },
  { group: 'Messages', key: 'unlockMedia', label: 'Photos and videos in DMs', desc: "Turns on TikTok's own photo and video sending.", type: 'toggle', def: true, reload: true },
  { group: 'Messages', key: 'unlockGroups', label: 'Group chats', desc: "Turns on TikTok's own group chats on web.", type: 'toggle', def: true, reload: true },
  { group: 'Messages', key: 'dmLagFix', label: 'Long chat lag fix', desc: 'Off-screen messages stop costing anything while you type.', type: 'toggle', def: true },

  { group: 'Playback', key: 'audioWatchdog', label: 'Double audio fix', desc: 'Only one video plays sound. Hidden and off-screen videos get paused.', type: 'toggle', def: true },
  { group: 'Playback', key: 'backgroundPlay', label: 'Background play', desc: 'Keeps playing when you switch tabs or windows.', type: 'toggle', def: false, reload: true, conflicts: 'autoPause' },
  { group: 'Playback', key: 'autoPause', label: 'Pause when tab is hidden', desc: 'Pauses on tab switch and resumes when you come back.', type: 'toggle', def: false, conflicts: 'backgroundPlay' },
  { group: 'Playback', key: 'speedPill', label: 'Speed control', desc: 'Speed pill on videos. Shift+. faster, Shift+, slower.', type: 'toggle', def: true },
  { group: 'Playback', key: 'speed', label: 'Playback speed', desc: 'Applied to every video.', type: 'select', def: 1,
    options: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4].map(v => ({ value: v, label: v + 'x' })) },
  { group: 'Playback', key: 'codecSwap', label: 'Stutter fix (H.264 only)', desc: 'Blocks HEVC so TikTok serves H.264. Try it if videos stutter.', type: 'toggle', def: false, reload: true },
];

const DEFAULTS = Object.fromEntries(SCHEMA.map(s => [s.key, s.def]));

let state = load();
const subs = new Map();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return Object.assign({}, DEFAULTS, raw ? JSON.parse(raw) : {});
  } catch (e) {
    return Object.assign({}, DEFAULTS);
  }
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
}

export const get = k => state[k];
export const all = () => Object.assign({}, state);

export function set(k, v) {
  if (state[k] === v) return;
  state[k] = v;
  const s = SCHEMA.find(x => x.key === k);
  if (s && s.conflicts && v === true && state[s.conflicts] === true) {
    state[s.conflicts] = false;
    emit(s.conflicts, false);
  }
  save();
  emit(k, v);
}

export function on(k, fn) {
  if (!subs.has(k)) subs.set(k, new Set());
  subs.get(k).add(fn);
  return () => subs.get(k).delete(fn);
}

function emit(k, v) {
  for (const fn of subs.get(k) || []) { try { fn(v); } catch (e) {} }
  for (const fn of subs.get('*') || []) { try { fn(k, v); } catch (e) {} }
}

export function exportJson() {
  return JSON.stringify({ app: 'TikTok Plus', version: 1, settings: state }, null, 2);
}

export function importJson(text) {
  const data = JSON.parse(text);
  const incoming = data && data.settings ? data.settings : data;
  for (const k in incoming) if (k in DEFAULTS) set(k, incoming[k]);
}

export function reset() {
  for (const k in DEFAULTS) set(k, DEFAULTS[k]);
}

// Keep two tabs in sync.
try {
  window.addEventListener('storage', e => {
    if (e.key !== KEY) return;
    const next = load();
    for (const k in next) if (next[k] !== state[k]) { state[k] = next[k]; emit(k, next[k]); }
  });
} catch (e) {}
