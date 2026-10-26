// TikTok Plus entry point. Hooks that must beat TikTok's own code run right away (document-start);
// everything else waits for the page.
import { safe, onReady } from './core/util.js';
import { installFlags } from './features/flags.js';
import { installCodecSwap } from './features/codecSwap.js';
import { installBackgroundPlay, startAutoPause } from './features/visibility.js';
import { startComposer } from './features/composer.js';
import { startWatchdog } from './features/audioWatchdog.js';
import { startSpeed } from './features/speed.js';
import { startDmLag } from './features/dmLag.js';
import { startLook } from './features/look.js';
import { startPanel } from './ui/panel.js';

if (!window.__tkPlus) {
  window.__tkPlus = { version: typeof __TKP_VERSION__ !== 'undefined' ? __TKP_VERSION__ : '' };
  // Older copies of the script (v1.x) check these and stand down.
  window.__tkDmSyncGuard12 = window.__tkDmSyncGuard13 = window.__tkDmSyncGuard14 = true;

  safe('flags', installFlags);
  safe('codecSwap', installCodecSwap);
  safe('backgroundPlay', installBackgroundPlay);

  // Media events are caught from the start, so no early video slips past.
  safe('watchdog', startWatchdog);

  onReady(() => {
    safe('composer', startComposer);
    safe('autoPause', startAutoPause);
    safe('speed', startSpeed);
    safe('dmLag', startDmLag);
    safe('look', startLook);
    safe('panel', startPanel);
  });
}
