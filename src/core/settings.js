// Settings live in this browser's localStorage. Export/import moves them to another computer.
const KEY = 'tkplus:settings:v1';

// Every feature has an entry here. The panel is built from this list.
// reload: true means the change only takes effect after a page reload.
export const SCHEMA = [
  { group: 'Messages', key: 'composer', label: 'Fixed message box', desc: 'Native text box: Enter sends, no lost letters, no ghost text.', type: 'toggle', def: true, reload: true },
  { group: 'Messages', key: 'unlockMedia', label: 'Photo button in DMs', desc: "Shows TikTok's hidden photo and video button. TikTok's server still refuses web photos on most accounts, so sends may fail.", type: 'toggle', def: false, reload: true },
  { group: 'Messages', key: 'unlockGroups', label: 'Group chats', desc: "Turns on TikTok's own group chats on web.", type: 'toggle', def: true, reload: true },
  { group: 'Look', key: 'appLook', label: 'App-style look', desc: 'Gradient bubbles that group like the app, pill message box, livelier inbox.', type: 'toggle', def: true },
  { group: 'Look', key: 'accent', label: 'Accent color', desc: 'Your bubbles, the send button and highlights.', type: 'select', def: 'tiktok',
    options: [['tiktok', 'TikTok (pink and cyan)'], ['neon', 'Neon (purple and pink)'], ['ocean', 'Ocean (blue)'], ['sunset', 'Sunset (orange)'], ['mint', 'Mint (green)'], ['classic', 'Classic TikTok blue']].map(([value, label]) => ({ value, label })) },
  { group: 'Messages', key: 'quickReplies', label: 'Quick replies', desc: 'Saved replies behind the lightning button. Type / in the box to search them.', type: 'toggle', def: true },
  { group: 'Messages', key: 'chatThemes', label: 'Chat wallpapers and bubble colors', desc: 'Paint button in the chat header. Per chat, saved on this device.', type: 'toggle', def: true },
  { group: 'Messages', key: 'inboxTools', label: 'Inbox search, filters, pins and archive', desc: 'Pins and archive are saved on this device.', type: 'toggle', def: true },
  { group: 'Messages', key: 'translate', label: 'Translate button', desc: "Uses the browser's built-in translator, on your device.", type: 'toggle', def: true },
  { group: 'Messages', key: 'autoTranslate', label: 'Auto-translate incoming messages', desc: 'Only translates messages not already in your language.', type: 'toggle', def: false },
  { group: 'Messages', key: 'translateTo', label: 'Translate into', type: 'select', def: 'en',
    options: [['en', 'English'], ['es', 'Spanish'], ['fr', 'French'], ['pt', 'Portuguese'], ['de', 'German'], ['it', 'Italian'], ['ja', 'Japanese'], ['ko', 'Korean'], ['zh', 'Chinese'], ['ar', 'Arabic'], ['hi', 'Hindi'], ['ru', 'Russian']].map(([value, label]) => ({ value, label })) },
  { group: 'Messages', key: 'msgTools', label: 'Copy and save messages', desc: 'Copy and bookmark buttons on messages. Saved list in the chat header.', type: 'toggle', def: true },
  { group: 'Messages', key: 'chatSearch', label: 'Search in chat', desc: 'Magnifier in the chat header. Searches loaded messages.', type: 'toggle', def: true },
  { group: 'Messages', key: 'nicknames', label: 'Nicknames', desc: 'Your own names for people. Pencil in the chat header.', type: 'toggle', def: true },
  { group: 'Messages', key: 'smartReplies', label: 'Smart reply chips', desc: 'Quick suggestions above the box based on their last message.', type: 'toggle', def: true },
  { group: 'Messages', key: 'funExtras', label: 'Fortune cookie, nudge, greeting cards', desc: 'Gift button next to emoji. Fills the box, you send.', type: 'toggle', def: true },
  { group: 'Messages', key: 'streaks', label: 'Streak flames', desc: 'Flame badges with day counts in the inbox.', type: 'toggle', def: true },
  { group: 'Messages', key: 'streakPet', label: 'Streak pets', desc: 'A pet in the chat header that grows with your streak.', type: 'toggle', def: true },
  { group: 'Messages', key: 'hoverTimes', label: 'Times on hover', desc: 'Hover a message to see when it was sent.', type: 'toggle', def: true },
  { group: 'Messages', key: 'emoticons', label: 'TikTok emoticons', desc: 'Picker for the app\'s [happy]-style faces, shown as emoji here.', type: 'toggle', def: true },
  { group: 'Messages', key: 'mediaGallery', label: 'Shared media gallery', desc: 'Picture button in the chat header: posts, photos and links from the chat.', type: 'toggle', def: true },
  { group: 'Messages', key: 'dmLagFix', label: 'Long chat lag fix', desc: 'Off-screen messages stop costing anything while you type.', type: 'toggle', def: true },

  { group: 'Playback', key: 'audioWatchdog', label: 'Double audio fix', desc: 'Only one video plays sound. Hidden and off-screen videos get paused.', type: 'toggle', def: true },
  { group: 'Playback', key: 'backgroundPlay', label: 'Background play', desc: 'Keeps playing when you switch tabs or windows.', type: 'toggle', def: false, reload: true, conflicts: 'autoPause' },
  { group: 'Playback', key: 'autoPause', label: 'Pause when tab is hidden', desc: 'Pauses on tab switch and resumes when you come back.', type: 'toggle', def: false, conflicts: 'backgroundPlay' },
  { group: 'Playback', key: 'speedPill', label: 'Speed control', desc: 'Speed pill on videos. Shift+. faster, Shift+, slower.', type: 'toggle', def: true },
  { group: 'Playback', key: 'speed', label: 'Playback speed', desc: 'Applied to every video.', type: 'select', def: 1,
    options: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4].map(v => ({ value: v, label: v + 'x' })) },
  { group: 'Playback', key: 'pip', label: 'Picture-in-picture button', desc: 'Pop the video out into a floating window. Shift+P.', type: 'toggle', def: true },
  { group: 'Playback', key: 'pipAuto', label: 'Pop out on tab switch', desc: 'Tries to start picture-in-picture when you leave the tab. Edge allows it only sometimes.', type: 'toggle', def: false },
  { group: 'Playback', key: 'autoScroll', label: 'Auto scroll', desc: 'Goes to the next video when one ends.', type: 'toggle', def: false },
  { group: 'Audio', key: 'audioDock', label: 'Audio buttons on the player', desc: 'EQ, loudness and 8D buttons next to the speed control.', type: 'toggle', def: true },
  { group: 'Audio', key: 'eqPreset', label: 'Equalizer', desc: 'Applies to every video.', type: 'select', def: 'off',
    options: [['off', 'Off'], ['bass', 'Bass boost'], ['vocal', 'Vocals'], ['treble', 'Treble'], ['loud', 'Loudness (smile)'], ['club', 'Club'], ['podcast', 'Speech clarity']].map(([value, label]) => ({ value, label })) },
  { group: 'Audio', key: 'normalize', label: 'Loudness leveling', desc: 'Evens out quiet and loud videos.', type: 'toggle', def: false },
  { group: 'Audio', key: 'audio8d', label: '8D audio', desc: 'Sound slowly circles around you. Best with headphones.', type: 'toggle', def: false },
  { group: 'Feed', key: 'cleanMode', label: 'Clean mode', desc: 'Hides clutter. Ultra also hides captions until you hover.', type: 'select', def: 'off',
    options: [['off', 'Off'], ['clean', 'Clean'], ['ultra', 'Ultra clean']].map(([value, label]) => ({ value, label })) },
  { group: 'Feed', key: 'commentBlur', label: 'Blur comments', desc: 'Comments stay blurred until you hover them.', type: 'toggle', def: false },
  { group: 'Feed', key: 'mobileLayout', label: 'Phone-style layout', desc: 'Narrow, rounded feed in the middle of the screen.', type: 'toggle', def: false },
  { group: 'Feed', key: 'downloads', label: 'Download button', desc: 'Under the share button: video without watermark, sound, photos. Shift+D saves the video.', type: 'toggle', def: true },
  { group: 'Feed', key: 'keywordFilter', label: 'Keyword filter', desc: 'Comma separated. Matches captions, sounds and usernames.', type: 'text', def: '' },
  { group: 'Feed', key: 'keywordSkip', label: 'Skip filtered videos', desc: 'Jumps past videos that match your keywords.', type: 'toggle', def: true },
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
