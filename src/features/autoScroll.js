// Auto scroll: when a feed video ends, go to the next one with TikTok's own "next" control.
import { get } from '../core/settings.js';
import { activeVideo, onFeedPage } from '../core/util.js';

export function goNext() {
  const next = document.querySelector('[data-e2e="feed-navigation-next"]');
  if (next && !next.disabled) { next.click(); return true; }
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, bubbles: true }));
  return false;
}

export function startAutoScroll() {
  document.addEventListener('ended', e => {
    const v = e.target;
    if (!(v instanceof HTMLVideoElement) || !get('autoScroll') || !onFeedPage()) return;
    if (v !== activeVideo() && activeVideo()) return;
    setTimeout(goNext, 250);
  }, true);
}
