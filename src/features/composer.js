// The fixed message box. TikTok's box is a Draft.js editor that keeps a hidden copy of the text and
// lets the two drift apart (eaten first letters, sent messages coming back, Enter dying). We hide it
// and put a native textarea on top. Text only flows one way: our box -> TikTok. TikTok still does the
// sending, drafts, replies and emoji. Nothing on screen is ever copied back into TikTok.
import { get } from '../core/settings.js';
import { addStyle, findProps } from '../core/util.js';

const CSS = `
  [data-tkdm] .DraftEditor-root { position: absolute !important; opacity: 0 !important;
    pointer-events: none !important; height: 0 !important; overflow: hidden !important; }
  .tkdm-input { display: block; width: 100%; box-sizing: border-box; min-height: 20px;
    max-height: 160px; padding: 0; margin: 0; border: 0; outline: 0; resize: none;
    background: transparent; color: inherit; font: inherit; font-size: 15px; line-height: 20px;
    overflow-y: auto; caret-color: var(--tkp-accent, #fe2c55); }
  .tkdm-input::placeholder { color: rgba(255,255,255,.45); }
  [data-tkdm-sending] .tkdm-input { opacity: .55; }
`;

const isDraft = p => p.editorState && p.editorState.getCurrentContent && typeof p.onChange === 'function';
const draftCtx = box => findProps(box.querySelector('.public-DraftEditor-content'), isDraft);
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

// Other features (quick replies, emoticons, stickers) insert text through this.
export function insertText(text) {
  const st = [...boxes].find(s => s.box.isConnected);
  if (!st) return false;
  const ta = st.ta;
  const a = ta.selectionStart ?? ta.value.length, b = ta.selectionEnd ?? ta.value.length;
  ta.value = ta.value.slice(0, a) + text + ta.value.slice(b);
  ta.focus();
  ta.setSelectionRange(a + text.length, a + text.length);
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}

export function activeBox() {
  return [...boxes].find(s => s.box.isConnected) || null;
}

function attach(box) {
  if (box.__tkdm) return;
  const p0 = draftCtx(box);
  if (!p0) return; // editor not ready yet, the observer tries again
  box.__tkdm = true;
  addStyle('tkdm-style', CSS);

  const ta = document.createElement('textarea');
  ta.className = 'tkdm-input';
  ta.rows = 1;
  ta.spellcheck = true;
  const ph = box.querySelector('.public-DraftEditorPlaceholder-root');
  ta.placeholder = (ph && ph.textContent.trim()) || 'Send a message...';
  box.setAttribute('data-tkdm', '1'); // an attribute, because React rewrites className
  box.appendChild(ta);

  const st = { box, ta, lastPushed: modelText(p0), lastLocal: 0, seen: null, sending: false };
  ta.value = st.lastPushed; // picks up a saved draft
  boxes.add(st);

  st.grow = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'; };
  st.grow();

  st.push = () => {
    const p = draftCtx(box);
    if (!p) return;
    if (modelText(p) !== ta.value) setModel(p, ta.value);
    st.lastPushed = ta.value;
  };

  ta.addEventListener('input', () => { st.lastLocal = Date.now(); st.push(); st.grow(); });
  ta.addEventListener('keydown', e => {
    e.stopPropagation(); // keep TikTok's page shortcuts out of the box
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey && !e.isComposing && e.keyCode !== 229) {
      e.preventDefault();
      send(st);
    }
  });
  ['keyup', 'keypress'].forEach(t => ta.addEventListener(t, e => e.stopPropagation()));
}

export function send(st) {
  st = st || activeBox();
  if (!st || st.sending) return;
  const text = st.ta.value;
  if (!text.trim()) return;
  st.sending = true;
  st.box.setAttribute('data-tkdm-sending', '1');
  st.push();
  const bottom = st.box.closest('[data-e2e="dm-new-chat-bottom"]') || document;
  const started = Date.now();
  const done = () => { st.sending = false; st.box.removeAttribute('data-tkdm-sending'); st.ta.focus(); };
  const tryClick = () => {
    const p = draftCtx(st.box);
    const ready = p && modelText(p) === text;
    const btn = bottom.querySelector('[data-e2e="dm-new-send-btn"]');
    if (ready && btn) {
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      if (st.ta.value === text) st.ta.value = '';
      st.lastPushed = '';
      st.grow();
      // Make sure TikTok's copy (and its saved draft) ends up empty too.
      setTimeout(() => { const q = draftCtx(st.box); if (q && modelText(q) !== '' && st.ta.value === '') setModel(q, ''); }, 400);
      done();
    } else if (Date.now() - started < 2000) {
      setTimeout(tryClick, 40);
    } else {
      done(); // gave up: the text stays in the box, nothing is lost
    }
  };
  setTimeout(tryClick, 30);
}

export function startComposer() {
  if (!get('composer')) return;

  // Changes from TikTok's side: emoji picker, switching chats, clearing after a send. Only taken
  // when you're not typing and the value has held still, so a lagging copy can't overwrite you.
  setInterval(() => {
    for (const st of boxes) {
      if (!st.box.isConnected) { boxes.delete(st); continue; }
      if (!st.ta.isConnected) st.box.appendChild(st.ta);
      if (!st.box.hasAttribute('data-tkdm')) st.box.setAttribute('data-tkdm', '1');
      const p = draftCtx(st.box);
      if (!p || st.sending) continue;
      const m = modelText(p);
      if (m === st.lastPushed) { st.seen = null; continue; }
      if (Date.now() - st.lastLocal < 600) { st.seen = null; continue; }
      if (st.seen !== m) { st.seen = m; continue; }
      st.seen = null;
      st.ta.value = m;
      st.lastPushed = m;
      st.grow();
    }
  }, 150);

  // Anything that focuses TikTok's hidden editor (clicking the bar, the emoji picker) lands in ours.
  document.addEventListener('focusin', e => {
    const box = e.target.closest && e.target.closest('[data-tkdm]');
    if (!box || e.target.classList.contains('tkdm-input')) return;
    if (e.target.closest('.DraftEditor-root')) {
      const ta = box.querySelector('.tkdm-input');
      if (ta) setTimeout(() => { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }, 0);
    }
  }, true);

  const scan = () => document.querySelectorAll('[data-e2e="dm-new-input-editor"]').forEach(attach);
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; scan(); });
  }).observe(document.documentElement, { childList: true, subtree: true });
  setInterval(scan, 1000);
  scan();
}
