// Clean mode, comment blur and the keyword filter for the video feed.
import { get, on } from '../core/settings.js';
import { addStyle, removeStyle, activeVideo, onFeedPage } from '../core/util.js';
import { goNext } from './autoScroll.js';

const CLEAN = `
  [data-e2e="top-right-action-bar-get-coin"], [data-e2e="copyright"],
  [data-e2e="nav-short-drama"], [data-e2e="nav-shop"] { display: none !important; }
  [data-e2e="following-accounts"], [data-e2e="following-see-all"] { display: none !important; }
`;
const ULTRA = CLEAN + `
  [data-e2e="nav-live"], [data-e2e="nav-activity"], [data-e2e="top-right-action-bar-get-coin"] { display: none !important; }
  [data-e2e="recommend-list-item-container"] [class*="DivMediaCardOverlayBottom"] { opacity: 0; transition: opacity .2s; }
  [data-e2e="recommend-list-item-container"]:hover [class*="DivMediaCardOverlayBottom"] { opacity: 1; }
  [data-e2e="recommend-list-item-container"] [class*="DivMediaCardOverlayTop"] { opacity: 0; }
  [data-e2e="recommend-list-item-container"]:hover [class*="DivMediaCardOverlayTop"] { opacity: 1; }
  [data-e2e="recommend-list-item-container"] * { transition-duration: 0s !important; }
`;
const BLUR = `
  [data-e2e^="comment-level"] p, [data-e2e="comment-text"], [data-e2e^="comment-level"] [data-e2e="comment-level-1"] {
    filter: blur(6px); transition: filter .15s; }
  [data-e2e^="comment-level"]:hover p, [data-e2e^="comment-level"]:hover [data-e2e="comment-text"] { filter: none; }
`;
const FILTERED = `
  [data-tkp-filtered] [class*="DivBasicPlayerWrapper"] { filter: blur(24px) brightness(.5); }
  [data-tkp-filtered]::after { content: attr(data-tkp-filtered); position: absolute; left: 50%; top: 40%;
    transform: translateX(-50%); z-index: 5; padding: 8px 14px; border-radius: 10px; background: rgba(0,0,0,.7);
    color: #fff; font: 600 13px system-ui, sans-serif; pointer-events: none; }
  [data-tkp-filtered] { position: relative; }
`;

function words() {
  return String(get('keywordFilter') || '').split(/[,\n]/).map(s => s.trim().toLowerCase()).filter(Boolean);
}

function itemText(item) {
  const parts = [];
  for (const sel of ['[data-e2e="video-desc"]', '[data-e2e="video-music"]', '[data-e2e="video-author-uniqueid"]', '[data-e2e="video-author-avatar"]']) {
    const el = item.querySelector(sel);
    if (el) parts.push(el.textContent, el.getAttribute('href') || '', el.getAttribute('aria-label') || '');
  }
  return parts.join(' ').toLowerCase();
}

export function startFeedClean() {
  const sync = () => {
    const mode = get('cleanMode');
    if (mode === 'ultra') addStyle('tkp-clean-css', ULTRA);
    else if (mode === 'clean') addStyle('tkp-clean-css', CLEAN);
    else removeStyle('tkp-clean-css');
    if (get('commentBlur')) addStyle('tkp-blur-css', BLUR); else removeStyle('tkp-blur-css');
  };
  sync();
  on('cleanMode', sync);
  on('commentBlur', sync);

  addStyle('tkp-filter-css', FILTERED);
  let lastSkipped = null;
  setInterval(() => {
    const list = words();
    const items = document.querySelectorAll('[data-e2e="recommend-list-item-container"]');
    for (const item of items) {
      const hit = list.length ? list.find(w => itemText(item).includes(w)) : null;
      if (hit) item.setAttribute('data-tkp-filtered', 'Filtered: ' + hit);
      else if (item.hasAttribute('data-tkp-filtered')) item.removeAttribute('data-tkp-filtered');
    }
    if (!list.length || !onFeedPage()) return;
    const v = activeVideo();
    const item = v && v.closest('[data-e2e="recommend-list-item-container"]');
    if (item && item.hasAttribute('data-tkp-filtered') && item !== lastSkipped) {
      lastSkipped = item;
      if (get('keywordSkip')) goNext();
    }
  }, 700);
}
