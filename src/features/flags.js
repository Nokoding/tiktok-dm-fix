// Turns on web DM features TikTok already built but hides behind A/B flags ("v1" off, "v2" on).
// Runs at document-start, before TikTok reads its page config.
import { get } from '../core/settings.js';

function wanted() {
  const f = {};
  if (get('unlockMedia')) f.web_dm_multimedia_msg = 'v2';
  if (get('unlockGroups')) f.web_dm_group_chat = 'v2';
  return f;
}

function patchAb(ab, flags) {
  if (!ab || typeof ab !== 'object') return false;
  if (!ab.parameters || typeof ab.parameters !== 'object') ab.parameters = {};
  for (const k in flags) {
    const cur = ab.parameters[k];
    if (!cur || cur.vid !== flags[k]) ab.parameters[k] = Object.assign({}, cur, { vid: flags[k] });
  }
  return true;
}

function patchTree(o, flags, depth) {
  if (!o || typeof o !== 'object' || depth > 5) return false;
  let hit = false;
  for (const k in o) {
    if (k === 'abTestVersion') hit = patchAb(o[k], flags) || hit;
    else if (o[k] && typeof o[k] === 'object') hit = patchTree(o[k], flags, depth + 1) || hit;
  }
  return hit;
}

export function installFlags() {
  const flags = wanted();
  if (!Object.keys(flags).length) return;

  // Flags are flipped only after TikTok's message client has started. Flipping them in the page
  // config before startup (v1.3/v1.4) made the client fail to load and the inbox hang.
  // A chat opened after the flip gets the photo button and group chats.

  const patchLive = () => {
    try {
      let fiber = null;
      for (const el of document.querySelectorAll('body > *, #app, #app > *')) {
        const k = Object.keys(el).find(x => x.startsWith('__reactFiber$'));
        if (k) { fiber = el[k]; break; }
      }
      if (!fiber) return;
      while (fiber.return) fiber = fiber.return;
      const stack = [fiber];
      let n = 0;
      while (stack.length && n < 20000) {
        const f = stack.pop(); n++;
        let st = f.memoizedState, c = 0;
        while (st && c < 30) {
          const q = st.memoizedState;
          if (q && typeof q === 'object' && q.abTestVersion) patchAb(q.abTestVersion, flags);
          st = st.next; c++;
        }
        if (f.sibling) stack.push(f.sibling);
        if (f.child) stack.push(f.child);
      }
    } catch (e) {}
  };
  // Wait until a real conversation has rendered once (the message client is up), then flip.
  let ready = false;
  setInterval(() => {
    if (!ready) ready = !!document.querySelector('[data-e2e="dm-new-conversation-nickname"], [data-e2e="dm-new-chat-nickname"]');
    if (ready) patchLive();
  }, 1500);
}
