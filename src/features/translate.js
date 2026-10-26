// Translate messages with the browser's built-in, on-device Translator API (Edge 148+, Chrome 138+).
// A "Translate" button appears in the hover actions of each text message. Auto-translate is optional.
import { get } from '../core/settings.js';
import { addStyle, h, toast } from '../core/util.js';

const CSS = `
  .tkp-tr-btn { all: unset; cursor: pointer; width: 28px; height: 28px; display: grid; place-items: center; border-radius: 50%;
    font: 700 11px system-ui, sans-serif; color: #ddd; }
  .tkp-tr-btn:hover { background: rgba(255,255,255,.1); }
  .tkp-tr { margin-top: 4px; padding: 6px 10px; border-radius: 12px; background: rgba(255,255,255,.06); color: rgba(255,255,255,.85);
    font: 13.5px/1.35 system-ui, sans-serif; max-width: 70%; }
  [data-tkp-side="me"] .tkp-tr { margin-left: auto; }
  .tkp-tr small { display: block; opacity: .5; font-size: 11px; margin-bottom: 2px; }
`;

const translators = new Map();
let detector = null;

async function detect(text) {
  if (!('LanguageDetector' in self)) return null;
  if (!detector) detector = await self.LanguageDetector.create();
  const r = await detector.detect(text);
  return r && r[0] && r[0].confidence > 0.4 ? r[0].detectedLanguage : null;
}

async function translate(text) {
  if (!('Translator' in self)) throw new Error('no-api');
  const target = get('translateTo') || 'en';
  const source = await detect(text);
  if (!source || source === 'und') throw new Error('unknown-language');
  if (source === target) return { same: true, source };
  const key = source + '>' + target;
  if (!translators.has(key)) {
    const avail = await self.Translator.availability({ sourceLanguage: source, targetLanguage: target });
    if (avail === 'unavailable') throw new Error('pair-unavailable');
    translators.set(key, self.Translator.create({ sourceLanguage: source, targetLanguage: target }));
  }
  const tr = await translators.get(key);
  return { text: await tr.translate(text), source };
}

async function translateItem(item, quiet) {
  if (item.querySelector('.tkp-tr')) { item.querySelector('.tkp-tr').remove(); return; }
  const textEl = item.querySelector('[data-e2e="dm-new-message-text"]');
  if (!textEl) return;
  const text = textEl.textContent.trim();
  if (!text) return;
  const out = h('div', { class: 'tkp-tr' }, h('small', null, 'Translating...'));
  textEl.parentElement.insertAdjacentElement('afterend', out);
  try {
    const r = await translate(text);
    if (r.same) { out.remove(); if (!quiet) toast('Already in your language.'); return; }
    out.textContent = '';
    out.append(h('small', null, 'Translated from ' + r.source), r.text);
  } catch (e) {
    out.remove();
    if (quiet) return;
    const m = String(e && e.message);
    toast(m === 'no-api' ? "This browser doesn't have the built-in translator. Edge 148 or newer has it."
      : m === 'pair-unavailable' ? "The translator can't do that language pair."
      : m === 'unknown-language' ? "Couldn't tell what language that is."
      : 'Translation failed: ' + m);
  }
}

export function startTranslate() {
  addStyle('tkp-tr-css', CSS);
  const done = new WeakSet();
  setInterval(() => {
    if (!get('translate')) return;
    for (const item of document.querySelectorAll('[data-e2e="dm-new-chat-item"]')) {
      if (!item.querySelector('[data-e2e="dm-new-message-text"]')) continue;
      const actions = item.querySelector('[class*="DivActions"]');
      if (actions && !actions.querySelector('.tkp-tr-btn')) {
        const b = h('button', { class: 'tkp-tr-btn', title: 'Translate', type: 'button' }, 'Aa');
        b.addEventListener('click', e => { e.stopPropagation(); e.preventDefault(); translateItem(item); });
        actions.prepend(b);
      }
      if (get('autoTranslate') && !done.has(item) && item.getAttribute('data-tkp-side') !== 'me') {
        done.add(item);
        translateItem(item, true);
      }
    }
  }, 900);
}
