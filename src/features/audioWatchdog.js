// Double audio fix: only one video makes sound. Videos that got detached from the page but keep
// playing ("zombies") and unmuted videos scrolled off screen are paused.
import { get } from '../core/settings.js';

function visibleRatio(el) {
  const r = el.getBoundingClientRect();
  const area = r.width * r.height;
  if (!area) return 0;
  const w = Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0));
  const hgt = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
  return (w * hgt) / area;
}

export function startWatchdog() {
  const playing = new Set();

  document.addEventListener('play', e => {
    const v = e.target;
    if (!(v instanceof HTMLMediaElement)) return;
    playing.add(v);
    if (!get('audioWatchdog') || v.muted) return;
    for (const o of playing) {
      if (o !== v && !o.paused && !o.muted && o !== document.pictureInPictureElement) o.pause();
    }
  }, true);

  setInterval(() => {
    for (const v of [...playing]) {
      if (v.paused) { playing.delete(v); continue; }
      if (!get('audioWatchdog')) continue;
      if (!v.isConnected) {
        v.pause(); v.muted = true; playing.delete(v);
        continue;
      }
      if (v === document.pictureInPictureElement || v.muted) continue;
      if (visibleRatio(v) < 0.15) v.pause();
    }
  }, 1000);
}
