// Long chat lag fix: the browser skips layout and paint for older messages that are off screen,
// so a chat with hundreds of messages types as fast as a new one.
// Each message keeps its exact measured height, and the newest 30 are left alone, so the chat
// never jumps or loses its place at the bottom.
import { get, on } from '../core/settings.js';
import { addStyle, removeStyle } from '../core/util.js';

const CSS = `[data-tkp-cv] { content-visibility: auto; }`;
const KEEP_NEWEST = 30;

function tagOld() {
  const items = document.querySelectorAll('[data-e2e="dm-new-chat-item"]');
  const stop = items.length - KEEP_NEWEST;
  for (let i = 0; i < stop; i++) {
    const el = items[i];
    if (el.hasAttribute('data-tkp-cv')) continue;
    const hgt = el.getBoundingClientRect().height;
    if (!hgt) continue;
    el.style.containIntrinsicSize = `auto ${Math.round(hgt)}px`;
    el.setAttribute('data-tkp-cv', '');
  }
}

function untagAll() {
  document.querySelectorAll('[data-tkp-cv]').forEach(el => {
    el.removeAttribute('data-tkp-cv');
    el.style.containIntrinsicSize = '';
  });
}

export function startDmLag() {
  let timer = null;
  const sync = () => {
    if (get('dmLagFix')) {
      addStyle('tkp-dmlag-css', CSS);
      if (!timer) timer = setInterval(tagOld, 2000);
      tagOld();
    } else {
      removeStyle('tkp-dmlag-css');
      clearInterval(timer); timer = null;
      untagAll();
    }
  };
  sync();
  on('dmLagFix', sync);
}
