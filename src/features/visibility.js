// Background play and auto-pause. These are opposites; the settings make them exclusive.
import { get, on } from '../core/settings.js';

let realHidden = () => document.visibilityState === 'hidden';

// Background play: the page always thinks it's visible and focused, so TikTok never pauses.
// Installed at document-start so our listeners run before TikTok's.
export function installBackgroundPlay() {
  if (!get('backgroundPlay')) return;
  try {
    const proto = Document.prototype;
    const hiddenDesc = Object.getOwnPropertyDescriptor(proto, 'hidden');
    const stateDesc = Object.getOwnPropertyDescriptor(proto, 'visibilityState');
    if (stateDesc && stateDesc.get) {
      const origState = stateDesc.get;
      realHidden = () => origState.call(document) === 'hidden';
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (get('backgroundPlay') ? 'visible' : origState.call(document)) });
    }
    if (hiddenDesc && hiddenDesc.get) {
      const origHidden = hiddenDesc.get;
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => (get('backgroundPlay') ? false : origHidden.call(document)) });
    }
    const origHasFocus = Document.prototype.hasFocus;
    document.hasFocus = function () { return get('backgroundPlay') ? true : origHasFocus.call(document); };

    const swallow = e => {
      if (!get('backgroundPlay')) return;
      if (e.target === window || e.target === document) e.stopImmediatePropagation();
    };
    for (const t of ['visibilitychange', 'webkitvisibilitychange', 'blur', 'pagehide']) {
      window.addEventListener(t, swallow, true);
    }
  } catch (e) {}
}

// Auto-pause: pause what's playing when the tab hides, resume it when you come back.
export function startAutoPause() {
  let paused = [];
  const onVis = () => {
    if (!get('autoPause') || get('backgroundPlay')) return;
    if (realHidden()) {
      paused = [...document.querySelectorAll('video')].filter(v => !v.paused);
      paused.forEach(v => v.pause());
    } else {
      paused.forEach(v => { if (v.isConnected) v.play().catch(() => {}); });
      paused = [];
    }
  };
  document.addEventListener('visibilitychange', onVis);
  on('autoPause', v => { if (!v) paused = []; });
}
