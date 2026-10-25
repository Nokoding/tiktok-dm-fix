// ==UserScript==
// @name         TikTok DM sync guard
// @namespace    nokoding
// @version      1.4.2
// @description  Replaces TikTok web's buggy DM box with a native one (Enter sends, no lost letters, no stuck messages) and turns on the photo/video sending and group chats TikTok already built into the web app.
// @match        https://www.tiktok.com/*
// @run-at       document-start
// @grant        none
// @updateURL    https://raw.githubusercontent.com/Nokoding/tiktok-dm-fix/main/tiktok-dm-sync-guard.user.js
// @downloadURL  https://raw.githubusercontent.com/Nokoding/tiktok-dm-fix/main/tiktok-dm-sync-guard.user.js
// ==/UserScript==

(function () {
  'use strict';
  // New flag name on purpose, so this still runs if an older copy is also installed.
  if (window.__tkDmSyncGuard14) return;
  window.__tkDmSyncGuard14 = true;

  // ---- Part 0: unlock web DM features ----
  // TikTok's web app already has photo/video sending and group chats, but hides them behind
  // A/B flags ("v1" = off, "v2" = on). This flips them on before the app reads its config.
  const FLAGS = { web_dm_multimedia_msg: 'v2', web_dm_group_chat: 'v2' };

  function patchAb(ab) {
    if (!ab || typeof ab !== 'object') return false;
    if (!ab.parameters || typeof ab.parameters !== 'object') ab.parameters = {};
    for (const k in FLAGS) {
      const cur = ab.parameters[k];
      if (!cur || cur.vid !== FLAGS[k]) ab.parameters[k] = Object.assign({}, cur, { vid: FLAGS[k] });
    }
    return true;
  }

  function patchTree(o, depth) {
    if (!o || typeof o !== 'object' || depth > 5) return false;
    let hit = false;
    for (const k in o) {
      if (k === 'abTestVersion') hit = patchAb(o[k]) || hit;
      else if (o[k] && typeof o[k] === 'object') hit = patchTree(o[k], depth + 1) || hit;
    }
    return hit;
  }

  // v1.4.1: flags are no longer patched before TikTok starts. Doing that broke the inbox on
  // load (TikTok's message client failed to start). They're flipped after load instead.

  // 3) Last resort: patch the live copy React holds, in case the app got its config another way.
  function patchLive() {
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
          if (q && typeof q === 'object' && q.abTestVersion) patchAb(q.abTestVersion);
          st = st.next; c++;
        }
        if (f.sibling) stack.push(f.sibling);
        if (f.child) stack.push(f.child);
      }
    } catch (e) {}
  }
  // Wait until a real conversation has rendered once (the message client is up), then flip.
  let flagsReady = false;
  setInterval(() => {
    if (!flagsReady) flagsReady = !!document.querySelector('[data-e2e="dm-new-conversation-nickname"], [data-e2e="dm-new-chat-nickname"]');
    if (flagsReady) patchLive();
  }, 1500);

  // ---- Part 1: our own message box ----
  // TikTok's box is a Draft.js editor that keeps a hidden copy of the text and lets the two drift
  // apart (eaten first letters, old messages coming back, Enter dying). We hide it and put a plain
  // native textarea on top. Text only ever flows one way: our box -> TikTok. TikTok still does the
  // sending, drafts, replies and emoji. We never copy what is on screen back into TikTok.

  const CSS = `
    [data-tkdm] .DraftEditor-root { position: absolute !important; opacity: 0 !important;
      pointer-events: none !important; height: 0 !important; overflow: hidden !important; }
    .tkdm-input { display: block; width: 100%; box-sizing: border-box; min-height: 20px;
      max-height: 160px; padding: 0; margin: 0; border: 0; outline: 0; resize: none;
      background: transparent; color: inherit; font: inherit; font-size: 15px; line-height: 20px;
      overflow-y: auto; caret-color: #fe2c55; }
    .tkdm-input::placeholder { color: rgba(255,255,255,.45); }
    [data-tkdm-sending] .tkdm-input { opacity: .55; }
  `;
  function addStyle() {
    if (document.getElementById('tkdm-style')) return;
    const s = document.createElement('style');
    s.id = 'tkdm-style';
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  // TikTok's own copy of the text (Draft.js EditorState), found through React.
  function draftCtx(box) {
    const ed = box.querySelector('.public-DraftEditor-content');
    if (!ed) return null;
    const key = Object.keys(ed).find(k => k.startsWith('__reactFiber$'));
    if (!key) return null;
    let f = ed[key], depth = 0;
    while (f && depth < 60) {
      const p = f.memoizedProps || {};
      if (p.editorState && p.editorState.getCurrentContent && typeof p.onChange === 'function') return p;
      f = f.return; depth++;
    }
    return null;
  }
  const modelText = p => p.editorState.getCurrentContent().getPlainText();
  function setModel(p, text) {
    const es = p.editorState;
    const ES = es.constructor;
    const CS = es.getCurrentContent().constructor;
    let next = ES.push(es, CS.createFromText(text), 'insert-characters');
    next = ES.moveSelectionToEnd(next); // selection only, never steals focus from our box
    p.onChange(next);
  }

  const boxes = new Set();

  function attach(box) {
    if (box.__tkdm) return;
    const p0 = draftCtx(box);
    if (!p0) return; // editor not ready yet, the observer will try again
    box.__tkdm = true;
    addStyle();

    const ta = document.createElement('textarea');
    ta.className = 'tkdm-input';
    ta.rows = 1;
    ta.spellcheck = true;
    const ph = box.querySelector('.public-DraftEditorPlaceholder-root');
    ta.placeholder = (ph && ph.textContent.trim()) || 'Send a message...';
    box.setAttribute('data-tkdm', '1'); // an attribute, because React rewrites className
    box.appendChild(ta);

    const st = { box, ta, lastPushed: modelText(p0), lastLocal: 0, sentAt: 0, seen: null, sending: false };
    ta.value = st.lastPushed; // picks up a saved draft
    boxes.add(st);

    const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'; };
    st.grow = grow;
    grow();

    st.push = () => {
      const p = draftCtx(box);
      if (!p) return;
      if (modelText(p) !== ta.value) setModel(p, ta.value);
      st.lastPushed = ta.value;
    };

    ta.addEventListener('input', () => { st.lastLocal = Date.now(); st.push(); grow(); });
    ta.addEventListener('keydown', e => {
      e.stopPropagation(); // keep TikTok's global shortcuts out of our box
      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey && !e.isComposing && e.keyCode !== 229) {
        e.preventDefault();
        send(st);
      }
    });
    ['keyup', 'keypress'].forEach(t => ta.addEventListener(t, e => e.stopPropagation()));
  }

  function send(st) {
    if (st.sending) return;
    const text = st.ta.value;
    if (!text.trim()) return;
    st.sending = true;
    st.box.setAttribute('data-tkdm-sending', '1');
    st.push();
    const bottom = st.box.closest('[data-e2e="dm-new-chat-bottom"]') || st.box.parentElement.parentElement.parentElement || document;
    const started = Date.now();
    const tryClick = () => {
      const p = draftCtx(st.box);
      const ready = p && modelText(p) === text;
      const btn = bottom.querySelector('[data-e2e="dm-new-send-btn"]');
      if (ready && btn) {
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        st.sentAt = Date.now();
        if (st.ta.value === text) st.ta.value = '';
        st.lastPushed = '';
        st.grow();
        // Make sure TikTok's copy (and its saved draft) is empty too.
        setTimeout(() => { const q = draftCtx(st.box); if (q && modelText(q) !== '' && st.ta.value === '') setModel(q, ''); }, 400);
        done();
      } else if (Date.now() - started < 2000) {
        setTimeout(tryClick, 40);
      } else {
        done(); // gave up: the text stays in the box, nothing is lost
      }
    };
    const done = () => { st.sending = false; st.box.removeAttribute('data-tkdm-sending'); st.ta.focus(); };
    setTimeout(tryClick, 30);
  }

  // Changes that come from TikTok's side: emoji picker, switching chats, clearing after a send.
  // Only taken when the user is not typing and the value has held still, so a lagging copy can
  // never overwrite what you typed.
  setInterval(() => {
    for (const st of boxes) {
      if (!st.box.isConnected) { boxes.delete(st); continue; }
      if (!st.ta.isConnected) { st.box.appendChild(st.ta); }
      if (!st.box.hasAttribute('data-tkdm')) st.box.setAttribute('data-tkdm', '1');
      const p = draftCtx(st.box);
      if (!p || st.sending) continue;
      const m = modelText(p);
      if (m === st.lastPushed) { st.seen = null; continue; }
      if (Date.now() - st.lastLocal < 600) { st.seen = null; continue; }
      if (st.seen !== m) { st.seen = m; continue; } // wait for a second look
      st.seen = null;
      st.ta.value = m;
      st.lastPushed = m;
      st.grow();
    }
  }, 150);

  // Anything that tries to focus TikTok's hidden editor (clicking the bar, emoji picker) lands in ours.
  document.addEventListener('focusin', e => {
    const box = e.target.closest && e.target.closest('[data-tkdm]');
    if (!box || e.target.classList.contains('tkdm-input')) return;
    if (e.target.closest('.DraftEditor-root')) {
      const ta = box.querySelector('.tkdm-input');
      if (ta) setTimeout(() => { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }, 0);
    }
  }, true);

  // Find message boxes as they appear (messages page, side drawer, chat switches).
  const scan = () => document.querySelectorAll('[data-e2e="dm-new-input-editor"]').forEach(attach);
  new MutationObserver(scan).observe(document.documentElement || document, { childList: true, subtree: true });
  setInterval(scan, 1000);
})();
