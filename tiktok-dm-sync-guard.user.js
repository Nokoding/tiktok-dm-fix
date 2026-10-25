// ==UserScript==
// @name         TikTok DM sync guard
// @namespace    nokoding
// @version      1.2
// @description  Keeps TikTok web's DM box and its internal text in sync, hides the stuck placeholder, and makes Enter send on the messages page.
// @match        https://www.tiktok.com/*
// @run-at       document-idle
// @grant        none
// @updateURL    https://raw.githubusercontent.com/Nokoding/tiktok-dm-fix/main/tiktok-dm-sync-guard.user.js
// @downloadURL  https://raw.githubusercontent.com/Nokoding/tiktok-dm-fix/main/tiktok-dm-sync-guard.user.js
// ==/UserScript==

(function () {
  'use strict';
  // New flag name on purpose, so this still runs if an older copy is also installed.
  if (window.__tkDmSyncGuard12) return;
  window.__tkDmSyncGuard12 = true;

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
  new MutationObserver(queuePlaceholder).observe(document.documentElement, {
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
