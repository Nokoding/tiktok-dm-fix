// Stutter fix: tell TikTok the browser can't play HEVC, so it serves H.264 instead.
// Same idea as the Firefox "TikTok Fix Pack". Off by default, needs a reload.
import { get } from '../core/settings.js';

const HEVC = /hvc1|hev1|hevc|h\.?265/i;

export function installCodecSwap() {
  if (!get('codecSwap')) return;
  try {
    if (window.MediaSource && MediaSource.isTypeSupported) {
      const orig = MediaSource.isTypeSupported.bind(MediaSource);
      MediaSource.isTypeSupported = type => (HEVC.test(String(type)) ? false : orig(type));
    }
    const origCan = HTMLMediaElement.prototype.canPlayType;
    HTMLMediaElement.prototype.canPlayType = function (type) {
      return HEVC.test(String(type)) ? '' : origCan.call(this, type);
    };
    if (navigator.mediaCapabilities && navigator.mediaCapabilities.decodingInfo) {
      const mc = navigator.mediaCapabilities;
      const origInfo = mc.decodingInfo.bind(mc);
      mc.decodingInfo = cfg => {
        const t = cfg && cfg.video && cfg.video.contentType;
        if (t && HEVC.test(t)) return Promise.resolve({ supported: false, smooth: false, powerEfficient: false });
        return origInfo(cfg);
      };
    }
  } catch (e) {}
}
