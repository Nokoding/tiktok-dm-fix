// ==UserScript==
// @name         TikTok DM sync guard
// @namespace    nokoding
// @version      1.3
// @description  Fixes TikTok web DMs (box sync, stuck placeholder, Enter to send) and turns on the photo/video sending and group chats TikTok already built into the web app.
// @match        https://www.tiktok.com/*
// @run-at       document-start
// @grant        none
// @updateURL    https://raw.githubusercontent.com/Nokoding/tiktok-dm-fix/main/tiktok-dm-sync-guard.user.js
// @downloadURL  https://raw.githubusercontent.com/Nokoding/tiktok-dm-fix/main/tiktok-dm-sync-guard.user.js
// ==/UserScript==

(function () {
  'use strict';
  // New flag name on purpose, so this still runs if an older copy is also installed.
  if (window.__tkDmSyncGuard13) return;
  window.__tkDmSyncGuard13 = true;

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

  // 1) The page config is read with JSON.parse. Patch big parses that carry abTestVersion.
  try {
    const origParse = JSON.parse;
    JSON.parse = function (text, reviver) {
      const out = origParse.call(this, text, reviver);
      try {
        if (typeof text === 'string' && text.length > 5000 && text.indexOf('abTestVersion') !== -1) patchTree(out, 0);
      } catch (e) {}
      return out;
    };
  } catch (e) {}

  // 2) Backup: rewrite the config script tag as soon as the parser adds it.
  function patchScriptTag(el) {
    try {
      if (el.__tkPatched) return;
      el.__tkPatched = true;
      const data = JSON.parse(el.textContent);
      if (patchTree(data, 0)) el.textContent = JSON.stringify(data);
    } catch (e) {}
  }
  try {
    const mo = new MutationObserver(() => {
      const el = document.getElementById('__UNIVERSAL_DATA_FOR_REHYDRATION__');
      if (el && el.textContent.length) { patchScriptTag(el); mo.disconnect(); }
    });
    mo.observe(document.documentElement || document, { childList: true, subtree: true });
    setTimeout(() => mo.disconnect(), 30000);
  } catch (e) {}

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
  setInterval(patchLive, 5000);

  // What you see in the box is the truth. Trailing newlines and nbsp are ignored.
  const norm = s => (s || '').replace(/\u00a0/g, ' ').replace(/\r/g, '').replace(/\n+$/, '');

  // Finds the Draft.js editor and TikTok's own copy of the text through React.
  function getCtx() {
    const ed = document.querySelector('.public-DraftEditor-content');
    if (!ed) return null;
    const key = Object.keys(ed).find(k => k.startsWith('__reactFiber$'));
    if (!key) return null;
    let f = ed[key], depth = 0;
    while (f && depth < 60) {
      const p = f.memoizedProps || {};
      if (p.editorState && p.editorState.getCurrentContent && typeof p.onChange === 'function') {
        return { ed, props: p };
      }
      f = f.return;
      depth++;
    }
    return null;
  }

  // Overwrites TikTok's copy of the text with the given text.
  function resync(c, text) {
    const es = c.props.editorState;
    const EditorState = es.constructor;
    const ContentState = es.getCurrentContent().constructor;
    let next = EditorState.push(es, ContentState.createFromText(text), 'insert-characters');
    next = EditorState.moveFocusToEnd(next);
    c.props.onChange(next);
  }

  // ---- Part 1: sync guard ----
  let pendingSig = '';
  let pendingSince = 0;
  let lastFixedSig = '';
  let lastFixedAt = 0;
  let composing = false;
  let composingSince = 0;

  document.addEventListener('compositionstart', () => { composing = true; composingSince = Date.now(); }, true);
  document.addEventListener('compositionend', () => { composing = false; }, true);

  setInterval(() => {
    try {
      const c = getCtx();
      // A composition that never ends (some dictation tools do this) must not freeze the guard.
      if (composing && Date.now() - composingSince > 1500) composing = false;
      if (!c || composing) { pendingSig = ''; return; }

      const dom = norm(c.ed.innerText);
      const model = norm(c.props.editorState.getCurrentContent().getPlainText());

      if (dom === model) { pendingSig = ''; lastFixedSig = ''; return; }

      // Only act when the mismatch has lasted a moment, so normal typing is never touched.
      const sig = dom + '\u0000' + model;
      if (sig !== pendingSig) { pendingSig = sig; pendingSince = Date.now(); return; }
      if (Date.now() - pendingSince < 120) return;
      // Same mismatch again right after a fix: wait a second before retrying instead of never.
      if (sig === lastFixedSig && Date.now() - lastFixedAt < 1000) return;

      lastFixedSig = sig;
      lastFixedAt = Date.now();
      resync(c, dom);
    } catch (e) {
      // Stay quiet. If TikTok changes its editor, the script just stops helping.
    }
  }, 50);

  // ---- Part 1b: placeholder ----
  // The grey "Send a message..." text shows whenever TikTok's copy of the text is empty, even if
  // the box has real text in it. Hide it the moment the box has text, without waiting for a resync.
  let phQueued = false;
  function fixPlaceholder() {
    phQueued = false;
    const ed = document.querySelector('.public-DraftEditor-content');
    if (!ed) return;
    const root = ed.closest('.DraftEditor-root');
    const ph = root && root.querySelector('.public-DraftEditorPlaceholder-root');
    if (!ph) return;
    const hasText = ed.textContent.replace(/[\u200b\s]/g, '') !== '';
    const want = hasText ? 'none' : '';
    if (ph.style.display !== want) ph.style.display = want;
  }
  function queuePlaceholder() {
    if (phQueued) return;
    phQueued = true;
    requestAnimationFrame(fixPlaceholder);
  }
  new MutationObserver(queuePlaceholder).observe(document.documentElement || document, {
    childList: true, subtree: true, characterData: true
  });
  setInterval(queuePlaceholder, 250);

  // ---- Part 2: Enter sends ----
  // On the messages page TikTok never sees the Enter keydown, so Enter falls through as a
  // plain newline. We catch it at the keypress (and the newline input as a backup) and click Send.
  let sendLock = false;

  function enterToSend(e) {
    const ed = document.querySelector('.public-DraftEditor-content');
    if (!ed || !ed.contains(e.target)) return;

    e.preventDefault();
    e.stopImmediatePropagation();
    if (sendLock) return;

    const c = getCtx();
    if (!c) return;
    const text = norm(c.ed.innerText);
    if (!text.trim()) return; // empty box: swallow the Enter, send nothing

    sendLock = true;
    if (norm(c.props.editorState.getCurrentContent().getPlainText()) !== text) resync(c, text);

    setTimeout(() => {
      const btn = document.querySelector('[data-e2e="dm-new-send-btn"]');
      if (btn) btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      setTimeout(() => { sendLock = false; }, 500);
    }, 150);
  }

  document.addEventListener('keypress', e => {
    if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey || e.isComposing) return;
    enterToSend(e);
  }, true);

  document.addEventListener('beforeinput', e => {
    if (e.inputType !== 'insertParagraph') return;
    enterToSend(e);
  }, true);
})();
