// Downloads: video without the watermark, the sound, and every photo of a photo post.
// A download button sits under the share button on each post. Shift+D saves the video you're watching.
import { get } from '../core/settings.js';
import { addStyle, h, findProps, isTyping, activeVideo, toast } from '../core/util.js';
import { openPopover, closePopover } from '../ui/popover.js';

const CSS = `
  .tkp-dl-btn { all: unset; cursor: pointer; width: 48px; height: 48px; margin: 8px auto 0; display: grid; place-items: center;
    border-radius: 50%; background: rgba(255,255,255,.12); font-size: 20px; color: #fff; transition: transform .15s; }
  html:not([data-theme="dark"]) .tkp-dl-btn { background: rgba(22,24,35,.06); color: #161823; }
  .tkp-dl-btn:hover { transform: scale(1.08); }
  .tkp-dl-btn.tkp-busy { opacity: .5; pointer-events: none; }
`;

const clean = s => String(s || '').replace(/[\\/:*?"<>|#\n\r\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
const baseName = it => [it.author && (it.author.uniqueId || it.author), clean(it.desc) || it.id].filter(Boolean).join(' - ') + ' [' + it.id + ']';

// The item behind a post: React props first, TikTok's own video page as the fallback.
async function itemById(id, hint) {
  if (hint && hint.id === String(id) && (hint.imagePost || (hint.video && hint.video.playAddr))) return hint;
  const html = await (await fetch('/@/video/' + id, { credentials: 'include' })).text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const node = doc.getElementById('__UNIVERSAL_DATA_FOR_REHYDRATION__');
  const data = node && JSON.parse(node.textContent);
  const it = data && data.__DEFAULT_SCOPE__ && data.__DEFAULT_SCOPE__['webapp.video-detail'];
  if (!it || !it.itemInfo) throw new Error('TikTok returned no data for this post');
  return it.itemInfo.itemStruct;
}

async function save(url, name) {
  const r = await fetch(url, { credentials: 'include' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const blob = await r.blob();
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}

function videoUrl(it) {
  const v = it.video || {};
  if (v.playAddr) return v.playAddr;
  const br = (v.bitrateInfo || []).map(b => b.PlayAddr && b.PlayAddr.UrlList && b.PlayAddr.UrlList[0]).filter(Boolean);
  return br[0] || v.downloadAddr || '';
}
const images = it => ((it.imagePost && it.imagePost.images) || []).map(i => (i.imageURL && i.imageURL.urlList || [])[0]).filter(Boolean);

async function run(kind, id, hint, btn) {
  if (btn) btn.classList.add('tkp-busy');
  try {
    const it = await itemById(id, hint);
    const name = baseName(it);
    if (kind === 'video') {
      const u = videoUrl(it);
      if (!u) throw new Error('no video on this post');
      toast('Downloading video...');
      await save(u, name + '.mp4');
    } else if (kind === 'audio') {
      const u = it.music && it.music.playUrl;
      if (!u) throw new Error('no sound on this post');
      toast('Downloading sound...');
      await save(u, clean(it.music.title || 'sound') + ' - ' + clean(it.music.authorName || '') + '.mp3');
    } else if (kind === 'photos') {
      const list = images(it);
      if (!list.length) throw new Error('no photos on this post');
      toast('Downloading ' + list.length + ' photo' + (list.length > 1 ? 's' : '') + '...');
      for (let i = 0; i < list.length; i++) await save(list[i], name + ' (' + (i + 1) + ').jpg');
    }
  } catch (e) {
    toast("Download didn't work: " + (e && e.message ? e.message : 'unknown error'));
  } finally { if (btn) btn.classList.remove('tkp-busy'); }
}

function menu(btn, id, hint) {
  openPopover(btn, el => {
    el.append(h('h5', null, 'Download'));
    const row = (label, kind) => {
      const r = h('div', { class: 'tkp-pop-row' }, label);
      r.addEventListener('click', () => { closePopover(); run(kind, id, hint, btn); });
      el.append(r);
    };
    const photo = hint && hint.imagePost;
    if (!photo) row('Video, no watermark', 'video');
    if (photo || !hint) row('All photos', 'photos');
    row('Sound (mp3)', 'audio');
  }, { width: 220 });
}

// The post (id plus React item) that contains an element.
function postOf(el) {
  const p = findProps(el, x => x.item && x.item.id, 40);
  if (p) return { id: String(p.item.id), item: p.item };
  const q = findProps(el, x => x.itemId && /^\d{15,}$/.test(String(x.itemId)), 40);
  if (q) return { id: String(q.itemId), item: null };
  const wrap = el.closest('article, [data-e2e="recommend-list-item-container"]');
  const xg = (wrap || document).querySelector('[id^="xgwrapper-"]');
  const m = xg && xg.id.match(/(\d{15,})$/);
  return m ? { id: m[1], item: null } : null;
}

function currentPost() {
  const m = location.pathname.match(/\/(?:video|photo)\/(\d{15,})/);
  const v = activeVideo();
  const fromVideo = v && postOf(v);
  if (fromVideo) return fromVideo;
  return m ? { id: m[1], item: null } : null;
}

export function startDownloads() {
  addStyle('tkp-dl-css', CSS);
  setInterval(() => {
    const on = get('downloads');
    if (!on) { document.querySelectorAll('.tkp-dl-btn').forEach(b => b.remove()); return; }
    for (const share of document.querySelectorAll('[data-e2e="share-icon"]')) {
      const item = share.closest('[class*="DivActionItem"], [class*="ButtonActionItem"]');
      const bar = item && item.parentElement;
      const host = bar && (bar.querySelector('[data-e2e="share-icon"]') === share && /Availability/.test(bar.className) ? bar.parentElement : bar);
      if (!host || host.querySelector(':scope > .tkp-dl-btn')) continue;
      const btn = h('button', { class: 'tkp-dl-btn', type: 'button', title: 'Download (Shift+D saves the video)' }, '⤓');
      btn.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        const post = postOf(share);
        if (!post) { toast("Couldn't find this post's id."); return; }
        menu(btn, post.id, post.item);
      });
      const after = share.closest('[class*="Availability"]') || item;
      if (after.parentElement === host) after.after(btn); else host.appendChild(btn);
    }
  }, 1000);

  document.addEventListener('keydown', e => {
    if (!get('downloads') || isTyping(e) || e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.key === 'D' && e.shiftKey) {
      const post = currentPost();
      if (!post) return;
      e.preventDefault();
      run(post.item && post.item.imagePost ? 'photos' : 'video', post.id, post.item);
    }
  }, true);
}
