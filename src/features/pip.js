// Picture-in-picture: a dock button and Shift+P. Optionally pops the video out when you switch tabs
// (Edge only allows that automatically in some cases, so the button is the reliable way).
import { get, on } from '../core/settings.js';
import { h, activeVideo, isTyping, toast } from '../core/util.js';
import { dockGroup } from '../ui/dock.js';

async function toggle() {
  try {
    if (document.pictureInPictureElement) { await document.exitPictureInPicture(); return; }
    const v = activeVideo();
    if (!v) return;
    v.removeAttribute('disablepictureinpicture');
    v.disablePictureInPicture = false;
    await v.requestPictureInPicture();
  } catch (e) {
    toast("Picture-in-picture didn't start: " + (e && e.message ? e.message : 'blocked by the browser'));
  }
}

export function startPip() {
  if (!document.pictureInPictureEnabled) return;
  const g = dockGroup(20, () => get('pip'));
  const btn = h('button', { title: 'Picture-in-picture (Shift+P)', onclick: toggle }, '⧉');
  g.append(btn);
  const sync = () => btn.classList.toggle('tkp-on', !!document.pictureInPictureElement);
  document.addEventListener('enterpictureinpicture', sync, true);
  document.addEventListener('leavepictureinpicture', sync, true);

  document.addEventListener('keydown', e => {
    if (!get('pip') || isTyping(e) || e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.key === 'P' && e.shiftKey) { e.preventDefault(); toggle(); }
  }, true);

  // Auto pop-out on tab switch, when the browser allows it.
  document.addEventListener('visibilitychange', () => {
    if (!get('pip') || !get('pipAuto')) return;
    if (document.visibilityState === 'hidden' && !document.pictureInPictureElement) {
      const v = activeVideo();
      if (v && !v.paused) { v.removeAttribute('disablepictureinpicture'); v.requestPictureInPicture().catch(() => {}); }
    }
  });
  try {
    navigator.mediaSession.setActionHandler('enterpictureinpicture', async () => {
      if (!get('pip') || !get('pipAuto')) return;
      const v = activeVideo();
      if (v) { v.removeAttribute('disablepictureinpicture'); await v.requestPictureInPicture(); }
    });
  } catch (e) {}
  on('pip', sync);
}
