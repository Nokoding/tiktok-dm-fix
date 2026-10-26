// DM extras: time on hover, TikTok emoticons (picker plus emoji preview), and a media gallery per chat.
// All of it reads what's already loaded on the page. Nothing here talks to TikTok's servers.
import { get } from '../core/settings.js';
import { addStyle, h, fiberOf, toast } from '../core/util.js';
import { openPopover, closePopover } from '../ui/popover.js';
import { insertText } from './composer.js';
import { headerHost, composerSlot } from './msgTools.js';

// TikTok's hidden emoticons. The apps draw them as little faces. On web they stay as text,
// so we show the closest emoji (the token itself still goes out).
export const EMOTICONS = [
  ['smile', '🙂'], ['happy', '😊'], ['angry', '😠'], ['cry', '😢'], ['embarrassed', '😳'], ['surprised', '😮'],
  ['wronged', '🥺'], ['shout', '😫'], ['flushed', '😳'], ['yummy', '😋'], ['complacent', '😌'], ['drool', '🤤'],
  ['scream', '😱'], ['weep', '😭'], ['speechless', '😶'], ['funnyface', '🤪'], ['laughwithtears', '😂'],
  ['wicked', '😏'], ['facewithrollingeyes', '🙄'], ['sulk', '😒'], ['thinking', '🤔'], ['lovely', '🥰'],
  ['greedy', '🤑'], ['wow', '🤩'], ['joyful', '😁'], ['hehe', '😆'], ['slap', '🤚'], ['tears', '🥲'],
  ['stun', '😵'], ['cute', '😚'], ['blink', '😉'], ['disdain', '😑'], ['astonish', '😲'], ['rage', '😡'],
  ['cool', '😎'], ['excited', '🤗'], ['proud', '😤'], ['smileface', '😃'], ['evil', '😈'], ['angel', '😇'],
  ['laugh', '😄'], ['pride', '🫡'], ['nap', '😴'], ['loveface', '😍'], ['awkward', '😅'], ['shock', '🫨'], ['funny', '🤭'],
];
const EMO = new Map(EMOTICONS);
const EMO_RE = new RegExp('\\[(' + EMOTICONS.map(e => e[0]).join('|') + ')\\]', 'g');

const CSS = `
  [data-e2e="dm-new-chat-item"] { position: relative; }
  .tkp-ts { position: absolute; top: 50%; transform: translateY(-50%); font: 600 11px/1 system-ui, sans-serif;
    opacity: 0; pointer-events: none; transition: opacity .12s; color: rgba(255,255,255,.55); white-space: nowrap; z-index: 2; }
  html:not([data-theme="dark"]) .tkp-ts { color: rgba(22,24,35,.5); }
  [data-e2e="dm-new-chat-item"]:hover > .tkp-ts { opacity: 1; }
  .tkp-ts.tkp-left { left: 10px; } .tkp-ts.tkp-right { right: 10px; }
  .tkp-emo-btn { all: unset; cursor: pointer; width: 28px; height: 28px; display: grid; place-items: center;
    border-radius: 50%; font: 700 12px/1 system-ui, sans-serif; opacity: .85; }
  .tkp-emo-btn:hover { background: rgba(255,255,255,.08); opacity: 1; }
  .tkp-emo-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 2px; }
  .tkp-emo-grid button { all: unset; cursor: pointer; display: grid; place-items: center; height: 40px; border-radius: 10px; font-size: 22px; }
  .tkp-emo-grid button:hover { background: rgba(255,255,255,.1); }
  .tkp-gal-tabs { display: flex; gap: 6px; margin: 0 4px 8px; }
  .tkp-gal-tabs button { all: unset; cursor: pointer; padding: 5px 10px; border-radius: 999px; font-size: 12.5px; font-weight: 600; background: #2a2a33; }
  .tkp-gal-tabs button.tkp-on { background: var(--tkp-a, #fe2c55); }
  .tkp-gal-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .tkp-gal-grid a { position: relative; display: block; aspect-ratio: 3/4; border-radius: 10px; overflow: hidden; background: #22222a; }
  .tkp-gal-grid img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .tkp-gal-grid span { position: absolute; left: 0; right: 0; bottom: 0; padding: 14px 6px 5px; font-size: 11px; line-height: 1.2;
    background: linear-gradient(transparent, rgba(0,0,0,.75)); color: #fff; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .tkp-gal-link { display: block; padding: 8px; border-radius: 10px; color: inherit; text-decoration: none; word-break: break-all; font-size: 13px; }
  .tkp-gal-link:hover { background: rgba(255,255,255,.08); }
`;

// The message object TikTok keeps in a hook a few levels above each chat row.
export function msgOf(item) {
  let f = fiberOf(item);
  for (let n = 0; f && n < 6; n++, f = f.return) {
    let s = f.memoizedState, i = 0;
    while (s && i < 40) {
      const m = s.memoizedState;
      for (const c of [m, m && m[0]]) if (c && typeof c === 'object' && c.clientId && c.createdAt) return c;
      s = s.next; i++;
    }
  }
  return null;
}
const contentOf = m => { let c = m.content; if (typeof c === 'string') { try { c = JSON.parse(c); } catch (e) { c = { text: c }; } } return c || {}; };

function fmtTime(d) {
  const now = new Date();
  const t = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return t;
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Yesterday ' + t;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' }) + ', ' + t;
}

function timestamps() {
  for (const item of document.querySelectorAll('[data-e2e="dm-new-chat-item"]')) {
    if (item.querySelector(':scope > .tkp-ts')) continue;
    const m = msgOf(item);
    if (!m) continue;
    const d = m.createdAt instanceof Date ? m.createdAt : new Date(m.createdAt);
    if (isNaN(d)) continue;
    const mine = m.isFromMe || item.getAttribute('data-tkp-side') === 'me';
    const el = h('span', { class: 'tkp-ts ' + (mine ? 'tkp-left' : 'tkp-right') }, fmtTime(d));
    item.appendChild(el);
    item.title = d.toLocaleString();
  }
}

// Swap [token] for the matching emoji inside message text (text nodes only, so React stays happy).
function renderEmoticons() {
  for (const t of document.querySelectorAll('[data-e2e="dm-new-message-text"], [data-e2e="dm-new-conversation-item"] p')) {
    const walker = document.createTreeWalker(t, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      if (n.nodeValue.indexOf('[') < 0) continue;
      const v = n.nodeValue.replace(EMO_RE, (all, k) => EMO.get(k) || all);
      if (v !== n.nodeValue) n.nodeValue = v;
    }
  }
}

function emoticonPicker(el) {
  el.append(h('h5', null, 'TikTok emoticons'));
  const grid = h('div', { class: 'tkp-emo-grid' });
  for (const [k, e] of EMOTICONS) {
    const b = h('button', { type: 'button', title: '[' + k + ']' }, e);
    b.addEventListener('click', ev => { ev.preventDefault(); if (!ev.shiftKey) closePopover(); insertText('[' + k + ']'); });
    grid.append(b);
  }
  el.append(grid, h('div', { class: 'tkp-hint' }, 'Sends the [token]. The TikTok app shows it as its own animated face. Shift-click to add several.'));
}

function galleryData() {
  const posts = [], links = [], photos = [], seen = new Set();
  for (const item of document.querySelectorAll('[data-e2e="dm-new-chat-item"]')) {
    const m = msgOf(item);
    if (!m || m.isRecalled) continue;
    const c = contentOf(m);
    if (c.itemId && !seen.has(c.itemId)) {
      seen.add(c.itemId);
      const cover = c.cover_url && c.cover_url.url_list && c.cover_url.url_list[0];
      posts.push({ id: c.itemId, cover, title: c.content_title || c.content_name || '', item });
    }
    if (m.pictureUrl) photos.push({ src: typeof m.pictureUrl === 'string' ? m.pictureUrl : (m.pictureUrl.url_list || [])[0], item });
    const text = c.text || '';
    for (const u of text.match(/https?:\/\/[^\s<>"]+/g) || []) links.push({ url: u, item });
  }
  return { posts, links, photos };
}

function gallery(el) {
  const data = galleryData();
  const tabs = h('div', { class: 'tkp-gal-tabs' });
  const body = h('div');
  const jump = item => { closePopover(); item.scrollIntoView({ block: 'center', behavior: 'smooth' }); item.classList.add('tkp-flash'); setTimeout(() => item.classList.remove('tkp-flash'), 1500); };
  const show = which => {
    [...tabs.children].forEach(b => b.classList.toggle('tkp-on', b.dataset.k === which));
    body.textContent = '';
    if (which === 'posts') {
      if (!data.posts.length) body.append(h('div', { class: 'tkp-hint' }, 'No shared posts in the loaded part of this chat. Scroll up to load older messages.'));
      const g = h('div', { class: 'tkp-gal-grid' });
      for (const p of data.posts.slice().reverse()) {
        const a = h('a', { href: '/@/video/' + p.id, target: '_blank', rel: 'noopener', title: p.title },
          p.cover ? h('img', { src: p.cover, loading: 'lazy', referrerpolicy: 'no-referrer', alt: '' }) : null,
          p.title ? h('span', null, p.title) : null);
        a.addEventListener('contextmenu', e => { e.preventDefault(); jump(p.item); });
        g.append(a);
      }
      body.append(g);
      if (data.posts.length) body.append(h('div', { class: 'tkp-hint' }, 'Click opens the post. Right-click jumps to it in the chat.'));
    } else if (which === 'photos') {
      if (!data.photos.length) body.append(h('div', { class: 'tkp-hint' }, 'No photos in the loaded part of this chat.'));
      const g = h('div', { class: 'tkp-gal-grid' });
      for (const p of data.photos.slice().reverse()) {
        const a = h('a', { href: p.src, target: '_blank', rel: 'noopener' }, h('img', { src: p.src, loading: 'lazy', alt: '' }));
        a.addEventListener('contextmenu', e => { e.preventDefault(); jump(p.item); });
        g.append(a);
      }
      body.append(g);
    } else {
      if (!data.links.length) body.append(h('div', { class: 'tkp-hint' }, 'No links in the loaded part of this chat.'));
      for (const l of data.links.slice().reverse()) {
        const a = h('a', { class: 'tkp-gal-link', href: l.url, target: '_blank', rel: 'noopener noreferrer' }, l.url);
        a.addEventListener('contextmenu', e => { e.preventDefault(); jump(l.item); });
        body.append(a);
      }
    }
  };
  for (const [k, label] of [['posts', 'Posts ' + data.posts.length], ['photos', 'Photos ' + data.photos.length], ['links', 'Links ' + data.links.length]]) {
    const b = h('button', { type: 'button', 'data-k': k }, label);
    b.addEventListener('click', () => show(k));
    tabs.append(b);
  }
  el.append(h('h5', null, 'Shared in this chat'), tabs, body);
  show('posts');
}

export function startDmExtras() {
  addStyle('tkp-dmx-css', CSS);
  setInterval(() => {
    if (!location.pathname.startsWith('/messages')) return;
    if (get('hoverTimes')) timestamps();
    else document.querySelectorAll('.tkp-ts').forEach(x => x.remove());
    if (get('emoticons')) {
      renderEmoticons();
      for (const emoji of document.querySelectorAll('[data-e2e="dm-new-emoji-btn"]')) {
        const slot = composerSlot(emoji);
        if (!slot || slot.querySelector('.tkp-emo-btn')) continue;
        const b = h('button', { class: 'tkp-emo-btn', type: 'button', title: 'TikTok emoticons' }, '[:)]');
        b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); openPopover(b, emoticonPicker, { width: 300 }); });
        slot.append(b);
      }
    } else document.querySelectorAll('.tkp-emo-btn').forEach(x => x.remove());
    const host = get('mediaGallery') ? headerHost() : null;
    if (host && !host.querySelector('.tkp-gal-btn')) {
      const b = h('button', { class: 'tkp-hdr-btn tkp-gal-btn', type: 'button', title: 'Shared posts, photos and links' }, '🖼');
      b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); openPopover(b, gallery, { width: 340 }); });
      host.appendChild(b);
    }
    if (!get('mediaGallery')) document.querySelectorAll('.tkp-gal-btn').forEach(x => x.remove());
  }, 900);
  void toast;
}
