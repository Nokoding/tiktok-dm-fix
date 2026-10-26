// ==UserScript==
// @name         TikTok Plus
// @namespace    nokoding
// @version      2.2.0
// @description  Makes TikTok web better: fixed DM box (Enter sends, no lost letters), photos, videos and group chats in DMs, double audio fix, speed control, background play and more. Settings behind the gear button.
// @match        https://www.tiktok.com/*
// @run-at       document-start
// @grant        none
// @updateURL    https://raw.githubusercontent.com/Nokoding/tiktok-dm-fix/main/tiktok-dm-sync-guard.user.js
// @downloadURL  https://raw.githubusercontent.com/Nokoding/tiktok-dm-fix/main/tiktok-dm-sync-guard.user.js
// ==/UserScript==

// Built from https://github.com/Nokoding/tiktok-dm-fix (src/). Edit the source, then run npm run build.
(() => {
  // src/core/util.js
  var log = (...a) => {
    try {
      console.debug("[TikTok Plus]", ...a);
    } catch (e) {
    }
  };
  function safe(name, fn) {
    try {
      return fn();
    } catch (e) {
      log(name + " failed", e);
    }
  }
  function addStyle(id, css) {
    let s = document.getElementById(id);
    if (!s) {
      s = document.createElement("style");
      s.id = id;
      (document.head || document.documentElement).appendChild(s);
    }
    if (s.textContent !== css) s.textContent = css;
    return s;
  }
  function removeStyle(id) {
    const s = document.getElementById(id);
    if (s) s.remove();
  }
  function onReady(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn, { once: true });
    else fn();
  }
  function h(tag2, props, ...kids) {
    const el = document.createElement(tag2);
    if (props) {
      for (const k in props) {
        const v = props[k];
        if (v == null || v === false) continue;
        if (k === "style" && typeof v === "object") Object.assign(el.style, v);
        else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === "class") el.className = v;
        else if (k in el && typeof v !== "string") el[k] = v;
        else el.setAttribute(k, v === true ? "" : v);
      }
    }
    for (const kid of kids.flat()) {
      if (kid == null || kid === false) continue;
      el.appendChild(typeof kid === "string" || typeof kid === "number" ? document.createTextNode(String(kid)) : kid);
    }
    return el;
  }
  function fiberOf(el) {
    if (!el) return null;
    const k = Object.keys(el).find((x) => x.startsWith("__reactFiber$"));
    return k ? el[k] : null;
  }
  function findProps(el, test, max = 60) {
    let f = fiberOf(el), n = 0;
    while (f && n < max) {
      const p = f.memoizedProps;
      if (p && typeof p === "object" && test(p)) return p;
      f = f.return;
      n++;
    }
    return null;
  }
  function isTyping(e) {
    const t = e.target;
    if (!t || !t.tagName) return false;
    return t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
  }
  function activeVideo() {
    let best = null, bestScore = -1;
    for (const v of document.querySelectorAll("video")) {
      if (!v.isConnected) continue;
      const r = v.getBoundingClientRect();
      const w = Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0));
      const hh = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
      const score = w * hh + (v.paused ? 0 : 1e9);
      if (w * hh > 0 && score > bestScore) {
        best = v;
        bestScore = score;
      }
    }
    return best;
  }
  function onFeedPage() {
    const p = location.pathname;
    return p === "/" || p.startsWith("/foryou") || p.startsWith("/following") || p.startsWith("/friends") || p.startsWith("/explore");
  }
  function toast(text, ms = 2600) {
    addStyle("tkp-toast-css", `.tkp-toast { position: fixed; z-index: 2147483004; left: 50%; bottom: 84px;
    transform: translateX(-50%); background: rgba(24,24,30,.96); color: #fff; padding: 10px 16px;
    border-radius: 12px; font: 13.5px/1.35 system-ui, sans-serif; border: 1px solid rgba(255,255,255,.1);
    box-shadow: 0 10px 30px rgba(0,0,0,.45); max-width: min(420px, 90vw); text-align: center; }`);
    const el = h("div", { class: "tkp-toast", role: "status" }, text);
    document.body.appendChild(el);
    setTimeout(() => el.remove(), ms);
  }

  // src/core/settings.js
  var KEY = "tkplus:settings:v1";
  var SCHEMA = [
    { group: "Messages", key: "composer", label: "Fixed message box", desc: "Native text box: Enter sends, no lost letters, no ghost text.", type: "toggle", def: true, reload: true },
    { group: "Messages", key: "unlockMedia", label: "Photo button in DMs", desc: "Shows TikTok's hidden photo and video button. TikTok's server still refuses web photos on most accounts, so sends may fail.", type: "toggle", def: false, reload: true },
    { group: "Messages", key: "unlockGroups", label: "Group chats", desc: "Turns on TikTok's own group chats on web.", type: "toggle", def: true, reload: true },
    { group: "Look", key: "appLook", label: "App-style look", desc: "Gradient bubbles that group like the app, pill message box, livelier inbox.", type: "toggle", def: true },
    {
      group: "Look",
      key: "accent",
      label: "Accent color",
      desc: "Your bubbles, the send button and highlights.",
      type: "select",
      def: "tiktok",
      options: [["tiktok", "TikTok (pink and cyan)"], ["neon", "Neon (purple and pink)"], ["ocean", "Ocean (blue)"], ["sunset", "Sunset (orange)"], ["mint", "Mint (green)"], ["classic", "Classic TikTok blue"]].map(([value, label]) => ({ value, label }))
    },
    { group: "Messages", key: "dmLagFix", label: "Long chat lag fix", desc: "Off-screen messages stop costing anything while you type.", type: "toggle", def: true },
    { group: "Playback", key: "audioWatchdog", label: "Double audio fix", desc: "Only one video plays sound. Hidden and off-screen videos get paused.", type: "toggle", def: true },
    { group: "Playback", key: "backgroundPlay", label: "Background play", desc: "Keeps playing when you switch tabs or windows.", type: "toggle", def: false, reload: true, conflicts: "autoPause" },
    { group: "Playback", key: "autoPause", label: "Pause when tab is hidden", desc: "Pauses on tab switch and resumes when you come back.", type: "toggle", def: false, conflicts: "backgroundPlay" },
    { group: "Playback", key: "speedPill", label: "Speed control", desc: "Speed pill on videos. Shift+. faster, Shift+, slower.", type: "toggle", def: true },
    {
      group: "Playback",
      key: "speed",
      label: "Playback speed",
      desc: "Applied to every video.",
      type: "select",
      def: 1,
      options: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4].map((v) => ({ value: v, label: v + "x" }))
    },
    { group: "Playback", key: "pip", label: "Picture-in-picture button", desc: "Pop the video out into a floating window. Shift+P.", type: "toggle", def: true },
    { group: "Playback", key: "pipAuto", label: "Pop out on tab switch", desc: "Tries to start picture-in-picture when you leave the tab. Edge allows it only sometimes.", type: "toggle", def: false },
    { group: "Playback", key: "autoScroll", label: "Auto scroll", desc: "Goes to the next video when one ends.", type: "toggle", def: false },
    { group: "Audio", key: "audioDock", label: "Audio buttons on the player", desc: "EQ, loudness and 8D buttons next to the speed control.", type: "toggle", def: true },
    {
      group: "Audio",
      key: "eqPreset",
      label: "Equalizer",
      desc: "Applies to every video.",
      type: "select",
      def: "off",
      options: [["off", "Off"], ["bass", "Bass boost"], ["vocal", "Vocals"], ["treble", "Treble"], ["loud", "Loudness (smile)"], ["club", "Club"], ["podcast", "Speech clarity"]].map(([value, label]) => ({ value, label }))
    },
    { group: "Audio", key: "normalize", label: "Loudness leveling", desc: "Evens out quiet and loud videos.", type: "toggle", def: false },
    { group: "Audio", key: "audio8d", label: "8D audio", desc: "Sound slowly circles around you. Best with headphones.", type: "toggle", def: false },
    {
      group: "Feed",
      key: "cleanMode",
      label: "Clean mode",
      desc: "Hides clutter. Ultra also hides captions until you hover.",
      type: "select",
      def: "off",
      options: [["off", "Off"], ["clean", "Clean"], ["ultra", "Ultra clean"]].map(([value, label]) => ({ value, label }))
    },
    { group: "Feed", key: "commentBlur", label: "Blur comments", desc: "Comments stay blurred until you hover them.", type: "toggle", def: false },
    { group: "Feed", key: "keywordFilter", label: "Keyword filter", desc: "Comma separated. Matches captions, sounds and usernames.", type: "text", def: "" },
    { group: "Feed", key: "keywordSkip", label: "Skip filtered videos", desc: "Jumps past videos that match your keywords.", type: "toggle", def: true },
    { group: "Playback", key: "codecSwap", label: "Stutter fix (H.264 only)", desc: "Blocks HEVC so TikTok serves H.264. Try it if videos stutter.", type: "toggle", def: false, reload: true }
  ];
  var DEFAULTS = Object.fromEntries(SCHEMA.map((s) => [s.key, s.def]));
  var state = load();
  var subs = /* @__PURE__ */ new Map();
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return Object.assign({}, DEFAULTS, raw ? JSON.parse(raw) : {});
    } catch (e) {
      return Object.assign({}, DEFAULTS);
    }
  }
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
    }
  }
  var get = (k) => state[k];
  function set(k, v) {
    if (state[k] === v) return;
    state[k] = v;
    const s = SCHEMA.find((x) => x.key === k);
    if (s && s.conflicts && v === true && state[s.conflicts] === true) {
      state[s.conflicts] = false;
      emit(s.conflicts, false);
    }
    save();
    emit(k, v);
  }
  function on(k, fn) {
    if (!subs.has(k)) subs.set(k, /* @__PURE__ */ new Set());
    subs.get(k).add(fn);
    return () => subs.get(k).delete(fn);
  }
  function emit(k, v) {
    for (const fn of subs.get(k) || []) {
      try {
        fn(v);
      } catch (e) {
      }
    }
    for (const fn of subs.get("*") || []) {
      try {
        fn(k, v);
      } catch (e) {
      }
    }
  }
  function exportJson() {
    return JSON.stringify({ app: "TikTok Plus", version: 1, settings: state }, null, 2);
  }
  function importJson(text) {
    const data = JSON.parse(text);
    const incoming = data && data.settings ? data.settings : data;
    for (const k in incoming) if (k in DEFAULTS) set(k, incoming[k]);
  }
  function reset() {
    for (const k in DEFAULTS) set(k, DEFAULTS[k]);
  }
  try {
    window.addEventListener("storage", (e) => {
      if (e.key !== KEY) return;
      const next = load();
      for (const k in next) if (next[k] !== state[k]) {
        state[k] = next[k];
        emit(k, next[k]);
      }
    });
  } catch (e) {
  }

  // src/features/flags.js
  function wanted() {
    const f = {};
    if (get("unlockMedia")) f.web_dm_multimedia_msg = "v2";
    if (get("unlockGroups")) f.web_dm_group_chat = "v2";
    return f;
  }
  function patchAb(ab, flags) {
    if (!ab || typeof ab !== "object") return false;
    if (!ab.parameters || typeof ab.parameters !== "object") ab.parameters = {};
    for (const k in flags) {
      const cur = ab.parameters[k];
      if (!cur || cur.vid !== flags[k]) ab.parameters[k] = Object.assign({}, cur, { vid: flags[k] });
    }
    return true;
  }
  function installFlags() {
    const flags = wanted();
    if (!Object.keys(flags).length) return;
    const patchLive = () => {
      try {
        let fiber = null;
        for (const el of document.querySelectorAll("body > *, #app, #app > *")) {
          const k = Object.keys(el).find((x) => x.startsWith("__reactFiber$"));
          if (k) {
            fiber = el[k];
            break;
          }
        }
        if (!fiber) return;
        while (fiber.return) fiber = fiber.return;
        const stack = [fiber];
        let n = 0;
        while (stack.length && n < 2e4) {
          const f = stack.pop();
          n++;
          let st = f.memoizedState, c = 0;
          while (st && c < 30) {
            const q = st.memoizedState;
            if (q && typeof q === "object" && q.abTestVersion) patchAb(q.abTestVersion, flags);
            st = st.next;
            c++;
          }
          if (f.sibling) stack.push(f.sibling);
          if (f.child) stack.push(f.child);
        }
      } catch (e) {
      }
    };
    let ready = false;
    setInterval(() => {
      if (!ready) ready = !!document.querySelector('[data-e2e="dm-new-conversation-nickname"], [data-e2e="dm-new-chat-nickname"]');
      if (ready) patchLive();
    }, 1500);
  }

  // src/features/codecSwap.js
  var HEVC = /hvc1|hev1|hevc|h\.?265/i;
  function installCodecSwap() {
    if (!get("codecSwap")) return;
    try {
      if (window.MediaSource && MediaSource.isTypeSupported) {
        const orig = MediaSource.isTypeSupported.bind(MediaSource);
        MediaSource.isTypeSupported = (type) => HEVC.test(String(type)) ? false : orig(type);
      }
      const origCan = HTMLMediaElement.prototype.canPlayType;
      HTMLMediaElement.prototype.canPlayType = function(type) {
        return HEVC.test(String(type)) ? "" : origCan.call(this, type);
      };
      if (navigator.mediaCapabilities && navigator.mediaCapabilities.decodingInfo) {
        const mc = navigator.mediaCapabilities;
        const origInfo = mc.decodingInfo.bind(mc);
        mc.decodingInfo = (cfg) => {
          const t = cfg && cfg.video && cfg.video.contentType;
          if (t && HEVC.test(t)) return Promise.resolve({ supported: false, smooth: false, powerEfficient: false });
          return origInfo(cfg);
        };
      }
    } catch (e) {
    }
  }

  // src/features/visibility.js
  var realHidden = () => document.visibilityState === "hidden";
  function installBackgroundPlay() {
    if (!get("backgroundPlay")) return;
    try {
      const proto = Document.prototype;
      const hiddenDesc = Object.getOwnPropertyDescriptor(proto, "hidden");
      const stateDesc = Object.getOwnPropertyDescriptor(proto, "visibilityState");
      if (stateDesc && stateDesc.get) {
        const origState = stateDesc.get;
        realHidden = () => origState.call(document) === "hidden";
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => get("backgroundPlay") ? "visible" : origState.call(document) });
      }
      if (hiddenDesc && hiddenDesc.get) {
        const origHidden = hiddenDesc.get;
        Object.defineProperty(document, "hidden", { configurable: true, get: () => get("backgroundPlay") ? false : origHidden.call(document) });
      }
      const origHasFocus = Document.prototype.hasFocus;
      document.hasFocus = function() {
        return get("backgroundPlay") ? true : origHasFocus.call(document);
      };
      const swallow = (e) => {
        if (!get("backgroundPlay")) return;
        if (e.target === window || e.target === document) e.stopImmediatePropagation();
      };
      for (const t of ["visibilitychange", "webkitvisibilitychange", "blur", "pagehide"]) {
        window.addEventListener(t, swallow, true);
      }
    } catch (e) {
    }
  }
  function startAutoPause() {
    let paused = [];
    const onVis = () => {
      if (!get("autoPause") || get("backgroundPlay")) return;
      if (realHidden()) {
        paused = [...document.querySelectorAll("video")].filter((v) => !v.paused);
        paused.forEach((v) => v.pause());
      } else {
        paused.forEach((v) => {
          if (v.isConnected) v.play().catch(() => {
          });
        });
        paused = [];
      }
    };
    document.addEventListener("visibilitychange", onVis);
    on("autoPause", (v) => {
      if (!v) paused = [];
    });
  }

  // src/features/composer.js
  var CSS = `
  [data-tkdm] .DraftEditor-root { position: absolute !important; opacity: 0 !important;
    pointer-events: none !important; height: 0 !important; overflow: hidden !important; }
  .tkdm-input { display: block; width: 100%; box-sizing: border-box; min-height: 20px;
    max-height: 160px; padding: 0; margin: 0; border: 0; outline: 0; resize: none;
    background: transparent; color: inherit; font: inherit; font-size: 15px; line-height: 20px;
    overflow-y: auto; caret-color: var(--tkp-accent, #fe2c55); }
  .tkdm-input::placeholder { color: rgba(255,255,255,.45); }
  [data-tkdm-sending] .tkdm-input { opacity: .55; }
`;
  var isDraft = (p) => p.editorState && p.editorState.getCurrentContent && typeof p.onChange === "function";
  var draftCtx = (box) => findProps(box.querySelector(".public-DraftEditor-content"), isDraft);
  var modelText = (p) => p.editorState.getCurrentContent().getPlainText();
  function setModel(p, text) {
    const es = p.editorState;
    const ES = es.constructor;
    const CS = es.getCurrentContent().constructor;
    let next = ES.push(es, CS.createFromText(text), "insert-characters");
    next = ES.moveSelectionToEnd(next);
    p.onChange(next);
  }
  var boxes = /* @__PURE__ */ new Set();
  function activeBox() {
    return [...boxes].find((s) => s.box.isConnected) || null;
  }
  function attach(box) {
    if (box.__tkdm) return;
    const p0 = draftCtx(box);
    if (!p0) return;
    box.__tkdm = true;
    addStyle("tkdm-style", CSS);
    const ta = document.createElement("textarea");
    ta.className = "tkdm-input";
    ta.rows = 1;
    ta.spellcheck = true;
    const ph = box.querySelector(".public-DraftEditorPlaceholder-root");
    ta.placeholder = ph && ph.textContent.trim() || "Send a message...";
    box.setAttribute("data-tkdm", "1");
    box.appendChild(ta);
    const st = { box, ta, lastPushed: modelText(p0), lastLocal: 0, seen: null, sending: false };
    ta.value = st.lastPushed;
    boxes.add(st);
    st.grow = () => {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
    };
    st.grow();
    st.push = () => {
      const p = draftCtx(box);
      if (!p) return;
      if (modelText(p) !== ta.value) setModel(p, ta.value);
      st.lastPushed = ta.value;
    };
    ta.addEventListener("input", () => {
      st.lastLocal = Date.now();
      st.push();
      st.grow();
    });
    ta.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey && !e.isComposing && e.keyCode !== 229) {
        e.preventDefault();
        send(st);
      }
    });
    ["keyup", "keypress"].forEach((t) => ta.addEventListener(t, (e) => e.stopPropagation()));
  }
  function send(st) {
    st = st || activeBox();
    if (!st || st.sending) return;
    const text = st.ta.value;
    if (!text.trim()) return;
    st.sending = true;
    st.box.setAttribute("data-tkdm-sending", "1");
    st.push();
    const bottom = st.box.closest('[data-e2e="dm-new-chat-bottom"]') || document;
    const started = Date.now();
    const done = () => {
      st.sending = false;
      st.box.removeAttribute("data-tkdm-sending");
      st.ta.focus();
    };
    const tryClick = () => {
      const p = draftCtx(st.box);
      const ready = p && modelText(p) === text;
      const btn = bottom.querySelector('[data-e2e="dm-new-send-btn"]');
      if (ready && btn) {
        btn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
        if (st.ta.value === text) st.ta.value = "";
        st.lastPushed = "";
        st.grow();
        setTimeout(() => {
          const q = draftCtx(st.box);
          if (q && modelText(q) !== "" && st.ta.value === "") setModel(q, "");
        }, 400);
        done();
      } else if (Date.now() - started < 2e3) {
        setTimeout(tryClick, 40);
      } else {
        done();
      }
    };
    setTimeout(tryClick, 30);
  }
  function startComposer() {
    if (!get("composer")) return;
    setInterval(() => {
      for (const st of boxes) {
        if (!st.box.isConnected) {
          boxes.delete(st);
          continue;
        }
        if (!st.ta.isConnected) st.box.appendChild(st.ta);
        if (!st.box.hasAttribute("data-tkdm")) st.box.setAttribute("data-tkdm", "1");
        const p = draftCtx(st.box);
        if (!p || st.sending) continue;
        const m = modelText(p);
        if (m === st.lastPushed) {
          st.seen = null;
          continue;
        }
        if (Date.now() - st.lastLocal < 600) {
          st.seen = null;
          continue;
        }
        if (st.seen !== m) {
          st.seen = m;
          continue;
        }
        st.seen = null;
        st.ta.value = m;
        st.lastPushed = m;
        st.grow();
      }
    }, 150);
    document.addEventListener("focusin", (e) => {
      const box = e.target.closest && e.target.closest("[data-tkdm]");
      if (!box || e.target.classList.contains("tkdm-input")) return;
      if (e.target.closest(".DraftEditor-root")) {
        const ta = box.querySelector(".tkdm-input");
        if (ta) setTimeout(() => {
          ta.focus();
          ta.setSelectionRange(ta.value.length, ta.value.length);
        }, 0);
      }
    }, true);
    const scan = () => document.querySelectorAll('[data-e2e="dm-new-input-editor"]').forEach(attach);
    let queued = false;
    new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        scan();
      });
    }).observe(document.documentElement, { childList: true, subtree: true });
    setInterval(scan, 1e3);
    scan();
  }

  // src/features/audioWatchdog.js
  function visibleRatio(el) {
    const r = el.getBoundingClientRect();
    const area = r.width * r.height;
    if (!area) return 0;
    const w = Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0));
    const hgt = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
    return w * hgt / area;
  }
  function startWatchdog() {
    const playing = /* @__PURE__ */ new Set();
    document.addEventListener("play", (e) => {
      const v = e.target;
      if (!(v instanceof HTMLMediaElement)) return;
      playing.add(v);
      if (!get("audioWatchdog") || v.muted) return;
      for (const o of playing) {
        if (o !== v && !o.paused && !o.muted && o !== document.pictureInPictureElement) o.pause();
      }
    }, true);
    setInterval(() => {
      for (const v of [...playing]) {
        if (v.paused) {
          playing.delete(v);
          continue;
        }
        if (!get("audioWatchdog")) continue;
        if (!v.isConnected) {
          v.pause();
          v.muted = true;
          playing.delete(v);
          continue;
        }
        if (v === document.pictureInPictureElement || v.muted) continue;
        if (visibleRatio(v) < 0.15) v.pause();
      }
    }, 1e3);
  }

  // src/ui/dock.js
  var CSS2 = `
  .tkp-dock { position: fixed; z-index: 2147483000; right: 18px; bottom: 18px; display: flex;
    align-items: center; gap: 2px; padding: 4px; border-radius: 999px;
    background: rgba(22,22,26,.82); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
    border: 1px solid rgba(255,255,255,.12); color: #fff; font: 600 13px/1 system-ui, sans-serif;
    box-shadow: 0 6px 24px rgba(0,0,0,.35); user-select: none; }
  .tkp-dock[hidden] { display: none; }
  .tkp-dock button { all: unset; cursor: pointer; min-width: 28px; height: 28px; padding: 0 4px; box-sizing: border-box;
    border-radius: 999px; display: grid; place-items: center; font-size: 15px; color: #fff; }
  .tkp-dock button:hover { background: rgba(255,255,255,.12); }
  .tkp-dock button.tkp-on { color: #25f4ee; }
  .tkp-dock .tkp-sep { width: 1px; height: 18px; background: rgba(255,255,255,.15); margin: 0 3px; }
  .tkp-dock-group { display: flex; align-items: center; gap: 2px; }
  .tkp-dock-group[hidden] { display: none; }
`;
  var dock = null;
  var groups = [];
  function dockGroup(order, visible) {
    ensure();
    const g = h("div", { class: "tkp-dock-group" });
    g.__order = order;
    g.__visible = visible || (() => true);
    groups.push(g);
    groups.sort((a, b) => a.__order - b.__order);
    groups.forEach((x) => dock.appendChild(x));
    return g;
  }
  function ensure() {
    if (dock) return;
    addStyle("tkp-dock-css", CSS2);
    dock = h("div", { class: "tkp-dock", hidden: true });
    setInterval(() => {
      if (!dock.isConnected && document.body) document.body.appendChild(dock);
      const onMessages = location.pathname.startsWith("/messages");
      const playing = [...document.querySelectorAll("video")].some((v) => !v.paused && v.isConnected) || !!document.pictureInPictureElement;
      let any = false;
      for (const g of groups) {
        const vis = !!g.__visible();
        g.hidden = !vis;
        any = any || vis;
      }
      dock.hidden = onMessages || !playing || !any;
    }, 600);
  }

  // src/features/speed.js
  var STEPS = SCHEMA.find((s) => s.key === "speed").options.map((o) => o.value);
  var CSS3 = `
  .tkp-speed-val { min-width: 44px; text-align: center; cursor: pointer; font-weight: 700; }
  .tkp-speed-val.tkp-fast { color: #25f4ee; }
`;
  function startSpeed() {
    let applying = false;
    const target = () => Number(get("speed")) || 1;
    const apply = (v) => {
      const s = target();
      if (Math.abs(v.playbackRate - s) > 1e-3) {
        applying = true;
        try {
          v.playbackRate = s;
        } catch (e) {
        }
        applying = false;
      }
    };
    const applyAll = () => document.querySelectorAll("video").forEach(apply);
    for (const ev of ["play", "loadedmetadata", "ratechange"]) {
      document.addEventListener(ev, (e) => {
        if (!(e.target instanceof HTMLVideoElement)) return;
        if (ev === "ratechange" && applying) return;
        apply(e.target);
      }, true);
    }
    on("speed", applyAll);
    const step = (dir) => {
      const i = STEPS.indexOf(target());
      const next = STEPS[Math.max(0, Math.min(STEPS.length - 1, (i < 0 ? STEPS.indexOf(1) : i) + dir))];
      set("speed", next);
    };
    document.addEventListener("keydown", (e) => {
      if (!get("speedPill") || isTyping(e) || e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.key === ">") {
        step(1);
        e.preventDefault();
      } else if (e.key === "<") {
        step(-1);
        e.preventDefault();
      }
    }, true);
    addStyle("tkp-speed-css", CSS3);
    const g = dockGroup(10, () => get("speedPill"));
    const val = h("span", { class: "tkp-speed-val", title: "Back to 1x", onclick: () => set("speed", 1) });
    g.append(
      h("button", { title: "Slower (Shift+,)", onclick: () => step(-1) }, "−"),
      val,
      h("button", { title: "Faster (Shift+.)", onclick: () => step(1) }, "+")
    );
    const render = () => {
      val.textContent = target() + "x";
      val.classList.toggle("tkp-fast", target() !== 1);
    };
    render();
    on("speed", render);
  }

  // src/features/dmLag.js
  var CSS4 = `[data-tkp-cv] { content-visibility: auto; }`;
  var KEEP_NEWEST = 30;
  function tagOld() {
    const items = document.querySelectorAll('[data-e2e="dm-new-chat-item"]');
    const stop = items.length - KEEP_NEWEST;
    for (let i = 0; i < stop; i++) {
      const el = items[i];
      if (el.hasAttribute("data-tkp-cv")) continue;
      const hgt = el.getBoundingClientRect().height;
      if (!hgt) continue;
      el.style.containIntrinsicSize = `auto ${Math.round(hgt)}px`;
      el.setAttribute("data-tkp-cv", "");
    }
  }
  function untagAll() {
    document.querySelectorAll("[data-tkp-cv]").forEach((el) => {
      el.removeAttribute("data-tkp-cv");
      el.style.containIntrinsicSize = "";
    });
  }
  function startDmLag() {
    let timer = null;
    const sync = () => {
      if (get("dmLagFix")) {
        addStyle("tkp-dmlag-css", CSS4);
        if (!timer) timer = setInterval(tagOld, 2e3);
        tagOld();
      } else {
        removeStyle("tkp-dmlag-css");
        clearInterval(timer);
        timer = null;
        untagAll();
      }
    };
    sync();
    on("dmLagFix", sync);
  }

  // src/features/look.js
  var ACCENTS = {
    tiktok: { label: "TikTok (pink and cyan)", a: "#fe2c55", b: "#25f4ee", me: "linear-gradient(135deg, #fe2c55 0%, #ff4f7a 45%, #ff7a59 100%)" },
    neon: { label: "Neon (purple and pink)", a: "#b14dff", b: "#ff4fd8", me: "linear-gradient(135deg, #7b2ff7 0%, #b14dff 50%, #ff4fd8 100%)" },
    ocean: { label: "Ocean (blue)", a: "#2f80ff", b: "#25f4ee", me: "linear-gradient(135deg, #1f5bff 0%, #2f80ff 50%, #22c4e8 100%)" },
    sunset: { label: "Sunset (orange)", a: "#ff7a1a", b: "#ffcc33", me: "linear-gradient(135deg, #ff4e50 0%, #ff7a1a 55%, #ffb627 100%)" },
    mint: { label: "Mint (green)", a: "#14c38e", b: "#7cf5c3", me: "linear-gradient(135deg, #0f9b6c 0%, #14c38e 55%, #3fe0b0 100%)" },
    classic: { label: "Classic TikTok blue", a: "#00a2c9", b: "#25f4ee", me: "linear-gradient(135deg, #0087a8 0%, #00a2c9 100%)" }
  };
  var ITEM = '[data-e2e="dm-new-chat-item"]';
  var TEXT = '[data-e2e="dm-new-message-text"]';
  function vars() {
    const ac = ACCENTS[get("accent")] || ACCENTS.tiktok;
    return `:root { --tkp-a: ${ac.a}; --tkp-b: ${ac.b}; --tkp-me: ${ac.me};
    --tkp-them: #2a2a31; --tkp-them-text: #f1f1f3; --tkp-r: 20px; --tkp-r-tight: 6px; }`;
  }
  var CSS5 = `
/* ---------- bubbles ---------- */
${ITEM} ${TEXT} {
  padding: 9px 14px !important; border-radius: var(--tkp-r) !important; font-size: 15px !important;
  line-height: 1.38 !important; box-shadow: 0 1px 1px rgba(0,0,0,.25); transition: transform .15s ease;
}
${ITEM} ${TEXT} p { color: inherit !important; }
[data-tkp-side="me"] ${TEXT} { background: var(--tkp-me) !important; color: #fff !important; }
[data-tkp-side="them"] ${TEXT} { background: var(--tkp-them) !important; color: var(--tkp-them-text) !important; }

/* grouped corners, like the app */
[data-tkp-side="me"][data-tkp-pos="first"] ${TEXT} { border-bottom-right-radius: var(--tkp-r-tight) !important; }
[data-tkp-side="me"][data-tkp-pos="middle"] ${TEXT} { border-top-right-radius: var(--tkp-r-tight) !important; border-bottom-right-radius: var(--tkp-r-tight) !important; }
[data-tkp-side="me"][data-tkp-pos="last"] ${TEXT} { border-top-right-radius: var(--tkp-r-tight) !important; }
[data-tkp-side="them"][data-tkp-pos="first"] ${TEXT} { border-bottom-left-radius: var(--tkp-r-tight) !important; }
[data-tkp-side="them"][data-tkp-pos="middle"] ${TEXT} { border-top-left-radius: var(--tkp-r-tight) !important; border-bottom-left-radius: var(--tkp-r-tight) !important; }
[data-tkp-side="them"][data-tkp-pos="last"] ${TEXT} { border-top-left-radius: var(--tkp-r-tight) !important; }

/* tighter runs, avatar only on the last message of a run */
${ITEM}[data-tkp-pos="middle"], ${ITEM}[data-tkp-pos="last"] { margin-top: -14px !important; }
${ITEM}[data-tkp-pos="first"] [data-e2e="chat-avatar"], ${ITEM}[data-tkp-pos="middle"] [data-e2e="chat-avatar"] { visibility: hidden !important; }

/* pop-in for new messages */
@keyframes tkp-pop { from { transform: translateY(10px) scale(.92); opacity: 0; } to { transform: none; opacity: 1; } }
${ITEM}[data-tkp-new] ${TEXT}, ${ITEM}[data-tkp-new] [data-e2e="dm-new-shared-video"] { animation: tkp-pop .28s cubic-bezier(.2,1.2,.4,1) both; }

/* hover actions as a small floating pill */
${ITEM} [class*="DivActions"] { background: rgba(30,30,36,.92); border-radius: 999px; padding: 2px 4px; box-shadow: 0 4px 14px rgba(0,0,0,.35); }

/* shared videos and media cards */
${ITEM} [data-e2e="dm-new-shared-video"], ${ITEM} [data-e2e="dm-new-image-card"], ${ITEM} [data-e2e="dm-new-video-card"] {
  border-radius: 18px !important; overflow: hidden !important; box-shadow: 0 6px 20px rgba(0,0,0,.35); }

/* reactions under a bubble */
${ITEM} [data-e2e="dm-new-reaction-display"] { background: #1f1f25 !important; border: 2px solid #0e0e11 !important; border-radius: 999px !important; }

/* day separators */
[data-e2e="dm-new-time-separator"] { display: flex; justify-content: center; }
[data-e2e="dm-new-time-separator"] > * , [data-e2e="dm-new-time-separator"] { font-size: 11.5px !important; letter-spacing: .02em; }
[data-e2e="dm-new-time-separator"] { color: rgba(255,255,255,.55) !important; }

/* chat background: soft accent glow */
[data-e2e="dm-new-message-list"] { background:
  radial-gradient(1200px 500px at 110% 110%, color-mix(in srgb, var(--tkp-a) 14%, transparent), transparent 60%),
  radial-gradient(900px 420px at -10% -10%, color-mix(in srgb, var(--tkp-b) 9%, transparent), transparent 60%) !important; }

/* ---------- composer ---------- */
[data-e2e="dm-new-chat-bottom"] { background: transparent !important; }
[data-e2e="message-input-area"] {
  border-radius: 26px !important; background: #1d1d23 !important; border: 1px solid rgba(255,255,255,.08) !important;
  transition: border-color .2s, box-shadow .2s; }
[data-e2e="message-input-area"]:focus-within {
  border-color: color-mix(in srgb, var(--tkp-a) 60%, transparent) !important;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--tkp-a) 18%, transparent); }
.tkdm-input { caret-color: var(--tkp-a) !important; }
[data-e2e="dm-new-emoji-btn"], [data-e2e="dm-new-media-btn"] { transition: transform .15s; }
[data-e2e="dm-new-emoji-btn"]:hover, [data-e2e="dm-new-media-btn"]:hover { transform: scale(1.12); }
@keyframes tkp-send-in { from { transform: scale(.4) rotate(-30deg); opacity: 0; } to { transform: none; opacity: 1; } }
[data-e2e="dm-new-send-btn"] { animation: tkp-send-in .22s cubic-bezier(.2,1.3,.4,1) both; filter: drop-shadow(0 2px 6px color-mix(in srgb, var(--tkp-a) 55%, transparent)); }
[data-e2e="dm-new-send-btn"] path { fill: var(--tkp-a) !important; }

/* ---------- header ---------- */
[data-e2e="top-chat-avatar"] { padding: 2px; border-radius: 50%; background: linear-gradient(135deg, var(--tkp-a), var(--tkp-b)); }
[data-e2e="top-chat-avatar"] img { border: 2px solid #121216; border-radius: 50%; }
[data-e2e="dm-new-chat-nickname"] { font-weight: 700 !important; }

/* ---------- inbox ---------- */
[data-e2e="dm-new-conversation-item"] { border-radius: 14px !important; margin: 2px 6px !important; transition: background .15s, transform .15s; }
[data-e2e="dm-new-conversation-item"]:hover { transform: translateX(2px); }
[data-e2e="dm-new-conversation-avatar"] img { transition: transform .2s; }
[data-e2e="dm-new-conversation-item"]:hover [data-e2e="dm-new-conversation-avatar"] img { transform: scale(1.05); }
[data-e2e="dm-new-conversation-item"][data-tkp-unread] [data-e2e="dm-new-conversation-avatar"] > span {
  box-shadow: 0 0 0 2px #0e0e11, 0 0 0 4px var(--tkp-a); border-radius: 50%; }
[data-e2e="dm-new-conversation-item"][data-tkp-unread] [data-e2e="dm-new-conversation-nickname"] { font-weight: 800 !important; }
[data-e2e="dm-new-conversation-unread"] { background: linear-gradient(135deg, var(--tkp-a), color-mix(in srgb, var(--tkp-a) 60%, var(--tkp-b))) !important; }
[data-e2e="dm-total-unread-count"] { background: var(--tkp-a) !important; }
`;
  var seen = /* @__PURE__ */ new WeakSet();
  var primed = false;
  var lastList = null;
  var sideCache = /* @__PURE__ */ new WeakMap();
  function sideOf(item) {
    if (sideCache.has(item)) return sideCache.get(item);
    const s = measureSide(item);
    if (s) sideCache.set(item, s);
    return s;
  }
  function measureSide(item) {
    const hc = item.querySelector('[class*="DivMessageHorizontalContainer"]') || item.firstElementChild && item.firstElementChild.firstElementChild;
    if (!hc) return "";
    return getComputedStyle(hc).flexDirection === "row-reverse" ? "me" : "them";
  }
  function setAttr(el, k, v) {
    if (v == null) {
      if (el.hasAttribute(k)) el.removeAttribute(k);
    } else if (el.getAttribute(k) !== v) el.setAttribute(k, v);
  }
  function tag() {
    if (!document.querySelector(ITEM + ', [data-e2e="dm-new-conversation-item"]')) return;
    const list = document.querySelector('[data-e2e="dm-new-message-list"]');
    if (list !== lastList) {
      lastList = list;
      primed = false;
    }
    const nodes = document.querySelectorAll(ITEM + ', [data-e2e="dm-new-time-separator"]');
    const rows = [];
    for (const n of nodes) {
      if (n.getAttribute("data-e2e") === "dm-new-time-separator") {
        rows.push(null);
        continue;
      }
      rows.push({ el: n, side: sideOf(n) });
    }
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r) continue;
      const prev = rows[i - 1], next = rows[i + 1];
      const joinPrev = prev && prev.side === r.side;
      const joinNext = next && next.side === r.side;
      const pos = joinPrev && joinNext ? "middle" : joinPrev ? "last" : joinNext ? "first" : "single";
      setAttr(r.el, "data-tkp-side", r.side || null);
      setAttr(r.el, "data-tkp-pos", pos);
      if (!seen.has(r.el)) {
        seen.add(r.el);
        if (primed) {
          r.el.setAttribute("data-tkp-new", "");
          setTimeout(() => r.el.removeAttribute("data-tkp-new"), 700);
        }
      }
    }
    if (rows.length) primed = true;
    for (const c of document.querySelectorAll('[data-e2e="dm-new-conversation-item"]')) {
      setAttr(c, "data-tkp-unread", c.querySelector('[data-e2e="dm-new-conversation-unread"]') ? "" : null);
    }
  }
  function startLook() {
    let obs = null, queued = false, timer = null;
    const queue = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        try {
          tag();
        } catch (e) {
        }
      });
    };
    const sync = () => {
      if (get("appLook")) {
        addStyle("tkp-look-vars", vars());
        addStyle("tkp-look-css", CSS5);
        if (!obs) {
          obs = new MutationObserver(queue);
          obs.observe(document.documentElement, { childList: true, subtree: true });
          timer = setInterval(queue, 1500);
        }
        queue();
      } else {
        removeStyle("tkp-look-vars");
        removeStyle("tkp-look-css");
        if (obs) {
          obs.disconnect();
          obs = null;
          clearInterval(timer);
        }
      }
    };
    sync();
    on("appLook", sync);
    on("accent", () => {
      if (get("appLook")) addStyle("tkp-look-vars", vars());
    });
  }

  // src/features/pip.js
  async function toggle() {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        return;
      }
      const v = activeVideo();
      if (!v) return;
      v.removeAttribute("disablepictureinpicture");
      v.disablePictureInPicture = false;
      await v.requestPictureInPicture();
    } catch (e) {
      toast("Picture-in-picture didn't start: " + (e && e.message ? e.message : "blocked by the browser"));
    }
  }
  function startPip() {
    if (!document.pictureInPictureEnabled) return;
    const g = dockGroup(20, () => get("pip"));
    const btn = h("button", { title: "Picture-in-picture (Shift+P)", onclick: toggle }, "⧉");
    g.append(btn);
    const sync = () => btn.classList.toggle("tkp-on", !!document.pictureInPictureElement);
    document.addEventListener("enterpictureinpicture", sync, true);
    document.addEventListener("leavepictureinpicture", sync, true);
    document.addEventListener("keydown", (e) => {
      if (!get("pip") || isTyping(e) || e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.key === "P" && e.shiftKey) {
        e.preventDefault();
        toggle();
      }
    }, true);
    document.addEventListener("visibilitychange", () => {
      if (!get("pip") || !get("pipAuto")) return;
      if (document.visibilityState === "hidden" && !document.pictureInPictureElement) {
        const v = activeVideo();
        if (v && !v.paused) {
          v.removeAttribute("disablepictureinpicture");
          v.requestPictureInPicture().catch(() => {
          });
        }
      }
    });
    try {
      navigator.mediaSession.setActionHandler("enterpictureinpicture", async () => {
        if (!get("pip") || !get("pipAuto")) return;
        const v = activeVideo();
        if (v) {
          v.removeAttribute("disablepictureinpicture");
          await v.requestPictureInPicture();
        }
      });
    } catch (e) {
    }
    on("pip", sync);
  }

  // src/features/audioFx.js
  var BANDS = [32, 64, 125, 250, 500, 1e3, 2e3, 4e3, 8e3, 16e3];
  var EQ_PRESETS = {
    off: { label: "Off", g: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    bass: { label: "Bass boost", g: [7, 6, 4, 2, 0, 0, 0, 0, 0, 0] },
    vocal: { label: "Vocals", g: [-3, -2, -1, 0, 2, 3, 3, 2, 0, -1] },
    treble: { label: "Treble", g: [0, 0, 0, 0, 0, 1, 2, 4, 5, 6] },
    loud: { label: "Loudness (smile)", g: [5, 4, 1, 0, -1, 0, 1, 3, 4, 4] },
    club: { label: "Club", g: [3, 5, 4, 1, 0, 0, 1, 2, 3, 2] },
    podcast: { label: "Speech clarity", g: [-6, -4, -2, 0, 2, 4, 4, 3, 1, -2] }
  };
  var chains = /* @__PURE__ */ new Set();
  var byElement = /* @__PURE__ */ new WeakMap();
  var ownCtx = null;
  var anyFx = () => get("eqPreset") && get("eqPreset") !== "off" || get("normalize") || get("audio8d");
  function makeChain(ctx) {
    const input = ctx.createGain();
    const filters = BANDS.map((f, i) => {
      const b = ctx.createBiquadFilter();
      b.type = i === 0 ? "lowshelf" : i === BANDS.length - 1 ? "highshelf" : "peaking";
      b.frequency.value = f;
      b.Q.value = 1.1;
      b.gain.value = 0;
      return b;
    });
    const comp = ctx.createDynamicsCompressor();
    const makeup = ctx.createGain();
    const pan = ctx.createStereoPanner();
    const lfo = ctx.createOscillator();
    const lfoDepth = ctx.createGain();
    lfo.frequency.value = 0.11;
    lfoDepth.gain.value = 0;
    lfo.connect(lfoDepth);
    lfoDepth.connect(pan.pan);
    try {
      lfo.start();
    } catch (e) {
    }
    let node = input;
    for (const f of filters) {
      node.connect(f);
      node = f;
    }
    node.connect(comp);
    comp.connect(makeup);
    makeup.connect(pan);
    const chain = { input, output: pan, filters, comp, makeup, lfoDepth };
    chains.add(chain);
    applyTo(chain);
    return chain;
  }
  function applyTo(c) {
    const preset = EQ_PRESETS[get("eqPreset")] || EQ_PRESETS.off;
    c.filters.forEach((f, i) => {
      f.gain.value = preset.g[i];
    });
    if (get("normalize")) {
      c.comp.threshold.value = -26;
      c.comp.knee.value = 18;
      c.comp.ratio.value = 6;
      c.comp.attack.value = 4e-3;
      c.comp.release.value = 0.25;
      c.makeup.gain.value = 1.5;
    } else {
      c.comp.threshold.value = 0;
      c.comp.knee.value = 0;
      c.comp.ratio.value = 1;
      c.makeup.gain.value = 1;
    }
    c.lfoDepth.gain.value = get("audio8d") ? 0.85 : 0;
  }
  function installAudioHook() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC || !AC.prototype.createMediaElementSource) return;
    const orig = AC.prototype.createMediaElementSource;
    AC.prototype.createMediaElementSource = function(el) {
      const src = orig.call(this, el);
      try {
        const chain = makeChain(this);
        byElement.set(el, chain);
        const connect = src.connect.bind(src);
        const disconnect = src.disconnect.bind(src);
        let wired = false;
        src.connect = function(dest, ...rest) {
          if (!wired) {
            connect(chain.input);
            wired = true;
          }
          return chain.output.connect(dest, ...rest);
        };
        src.disconnect = function(...args) {
          if (!args.length) {
            try {
              disconnect();
            } catch (e) {
            }
            wired = false;
            try {
              chain.output.disconnect();
            } catch (e) {
            }
            return;
          }
          try {
            chain.output.disconnect(...args);
          } catch (e) {
          }
        };
      } catch (e) {
      }
      return src;
    };
  }
  function routeOwn(v) {
    if (byElement.has(v) || !anyFx()) return;
    if (!ownCtx) {
      try {
        ownCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        return;
      }
    }
    if (ownCtx.state !== "running") {
      ownCtx.resume().then(() => routeOwn(v)).catch(() => {
      });
      return;
    }
    try {
      const src = ownCtx.createMediaElementSource(v);
      src.connect(ownCtx.destination);
    } catch (e) {
    }
  }
  function startAudioFx() {
    const refresh = () => {
      for (const c of chains) applyTo(c);
      for (const v of document.querySelectorAll("video")) if (!v.paused) routeOwn(v);
    };
    ["eqPreset", "normalize", "audio8d"].forEach((k) => on(k, refresh));
    document.addEventListener("play", (e) => {
      if (e.target instanceof HTMLVideoElement) routeOwn(e.target);
    }, true);
    document.addEventListener("pointerdown", () => {
      if (anyFx() && ownCtx && ownCtx.state !== "running") ownCtx.resume().catch(() => {
      });
    }, true);
    const g = dockGroup(30, () => get("audioDock"));
    const keys = Object.keys(EQ_PRESETS);
    const eqBtn = h("button", { title: "Equalizer preset (click to cycle)" });
    const nBtn = h("button", { title: "Loudness leveling" }, "◍");
    const dBtn = h("button", { title: "8D audio" }, "8D");
    const render = () => {
      const p = get("eqPreset") || "off";
      eqBtn.textContent = p === "off" ? "EQ" : "EQ·" + (EQ_PRESETS[p] || EQ_PRESETS.off).label.split(" ")[0];
      eqBtn.classList.toggle("tkp-on", p !== "off");
      nBtn.classList.toggle("tkp-on", !!get("normalize"));
      dBtn.classList.toggle("tkp-on", !!get("audio8d"));
    };
    eqBtn.addEventListener("click", () => {
      const i = keys.indexOf(get("eqPreset") || "off");
      set("eqPreset", keys[(i + 1) % keys.length]);
    });
    nBtn.addEventListener("click", () => set("normalize", !get("normalize")));
    dBtn.addEventListener("click", () => set("audio8d", !get("audio8d")));
    g.append(h("span", { class: "tkp-sep" }), eqBtn, nBtn, dBtn);
    ["eqPreset", "normalize", "audio8d"].forEach((k) => on(k, render));
    render();
  }

  // src/features/autoScroll.js
  function goNext() {
    const next = document.querySelector('[data-e2e="feed-navigation-next"]');
    if (next && !next.disabled) {
      next.click();
      return true;
    }
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", code: "ArrowDown", keyCode: 40, bubbles: true }));
    return false;
  }
  function startAutoScroll() {
    document.addEventListener("ended", (e) => {
      const v = e.target;
      if (!(v instanceof HTMLVideoElement) || !get("autoScroll") || !onFeedPage()) return;
      if (v !== activeVideo() && activeVideo()) return;
      setTimeout(goNext, 250);
    }, true);
  }

  // src/features/feedClean.js
  var CLEAN = `
  [data-e2e="top-right-action-bar-get-coin"], [data-e2e="copyright"],
  [data-e2e="nav-short-drama"], [data-e2e="nav-shop"] { display: none !important; }
  [data-e2e="following-accounts"], [data-e2e="following-see-all"] { display: none !important; }
`;
  var ULTRA = CLEAN + `
  [data-e2e="nav-live"], [data-e2e="nav-activity"], [data-e2e="top-right-action-bar-get-coin"] { display: none !important; }
  [data-e2e="recommend-list-item-container"] [class*="DivMediaCardOverlayBottom"] { opacity: 0; transition: opacity .2s; }
  [data-e2e="recommend-list-item-container"]:hover [class*="DivMediaCardOverlayBottom"] { opacity: 1; }
  [data-e2e="recommend-list-item-container"] [class*="DivMediaCardOverlayTop"] { opacity: 0; }
  [data-e2e="recommend-list-item-container"]:hover [class*="DivMediaCardOverlayTop"] { opacity: 1; }
  [data-e2e="recommend-list-item-container"] * { transition-duration: 0s !important; }
`;
  var BLUR = `
  [data-e2e^="comment-level"] p, [data-e2e="comment-text"], [data-e2e^="comment-level"] [data-e2e="comment-level-1"] {
    filter: blur(6px); transition: filter .15s; }
  [data-e2e^="comment-level"]:hover p, [data-e2e^="comment-level"]:hover [data-e2e="comment-text"] { filter: none; }
`;
  var FILTERED = `
  [data-tkp-filtered] [class*="DivBasicPlayerWrapper"] { filter: blur(24px) brightness(.5); }
  [data-tkp-filtered]::after { content: attr(data-tkp-filtered); position: absolute; left: 50%; top: 40%;
    transform: translateX(-50%); z-index: 5; padding: 8px 14px; border-radius: 10px; background: rgba(0,0,0,.7);
    color: #fff; font: 600 13px system-ui, sans-serif; pointer-events: none; }
  [data-tkp-filtered] { position: relative; }
`;
  function words() {
    return String(get("keywordFilter") || "").split(/[,\n]/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  }
  function itemText(item) {
    const parts = [];
    for (const sel of ['[data-e2e="video-desc"]', '[data-e2e="video-music"]', '[data-e2e="video-author-uniqueid"]', '[data-e2e="video-author-avatar"]']) {
      const el = item.querySelector(sel);
      if (el) parts.push(el.textContent, el.getAttribute("href") || "", el.getAttribute("aria-label") || "");
    }
    return parts.join(" ").toLowerCase();
  }
  function startFeedClean() {
    const sync = () => {
      const mode = get("cleanMode");
      if (mode === "ultra") addStyle("tkp-clean-css", ULTRA);
      else if (mode === "clean") addStyle("tkp-clean-css", CLEAN);
      else removeStyle("tkp-clean-css");
      if (get("commentBlur")) addStyle("tkp-blur-css", BLUR);
      else removeStyle("tkp-blur-css");
    };
    sync();
    on("cleanMode", sync);
    on("commentBlur", sync);
    addStyle("tkp-filter-css", FILTERED);
    let lastSkipped = null;
    setInterval(() => {
      const list = words();
      const items = document.querySelectorAll('[data-e2e="recommend-list-item-container"]');
      for (const item2 of items) {
        const hit = list.length ? list.find((w) => itemText(item2).includes(w)) : null;
        if (hit) item2.setAttribute("data-tkp-filtered", "Filtered: " + hit);
        else if (item2.hasAttribute("data-tkp-filtered")) item2.removeAttribute("data-tkp-filtered");
      }
      if (!list.length || !onFeedPage()) return;
      const v = activeVideo();
      const item = v && v.closest('[data-e2e="recommend-list-item-container"]');
      if (item && item.hasAttribute("data-tkp-filtered") && item !== lastSkipped) {
        lastSkipped = item;
        if (get("keywordSkip")) goNext();
      }
    }, 700);
  }

  // src/ui/panel.js
  var VERSION = true ? "2.2.0" : "";
  var CSS6 = `
  .tkp-gear { position: fixed; z-index: 2147483001; left: 14px; bottom: 14px; width: 40px; height: 40px;
    border-radius: 50%; border: 1px solid rgba(255,255,255,.14); cursor: pointer;
    background: linear-gradient(135deg, rgba(254,44,85,.9), rgba(37,244,238,.75));
    box-shadow: 0 6px 22px rgba(0,0,0,.4); display: grid; place-items: center; color: #fff;
    font-size: 20px; line-height: 1; transition: transform .25s; padding: 0; }
  .tkp-gear:hover { transform: rotate(60deg) scale(1.06); }
  .tkp-overlay { position: fixed; inset: 0; z-index: 2147483002; background: rgba(0,0,0,.45);
    backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px); display: grid; place-items: center; }
  .tkp-panel { width: min(520px, calc(100vw - 32px)); max-height: min(80vh, 760px); overflow: auto;
    background: #141418; color: #f1f1f2; border: 1px solid rgba(255,255,255,.1); border-radius: 18px;
    box-shadow: 0 24px 80px rgba(0,0,0,.6); font: 14px/1.4 system-ui, -apple-system, Segoe UI, sans-serif; }
  .tkp-head { position: sticky; top: 0; display: flex; align-items: center; gap: 10px; padding: 16px 18px;
    background: rgba(20,20,24,.96); border-bottom: 1px solid rgba(255,255,255,.08); }
  .tkp-head b { font-size: 17px; background: linear-gradient(90deg, #fe2c55, #25f4ee);
    -webkit-background-clip: text; background-clip: text; color: transparent; }
  .tkp-head small { opacity: .5; }
  .tkp-head button { margin-left: auto; }
  .tkp-group { padding: 6px 18px 10px; }
  .tkp-group h4 { margin: 12px 0 4px; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; opacity: .55; }
  .tkp-row { display: flex; align-items: center; gap: 14px; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,.05); }
  .tkp-row:last-child { border-bottom: 0; }
  .tkp-row .tkp-txt { flex: 1; }
  .tkp-row .tkp-txt div { font-weight: 600; }
  .tkp-row .tkp-txt p { margin: 2px 0 0; font-size: 12.5px; opacity: .6; }
  .tkp-row .tkp-reload { color: #ffb020; font-size: 12px; margin-top: 3px; }
  .tkp-switch { position: relative; width: 42px; height: 24px; flex: none; }
  .tkp-switch input { opacity: 0; width: 0; height: 0; position: absolute; }
  .tkp-switch span { position: absolute; inset: 0; border-radius: 999px; background: #3a3a40; transition: .2s; cursor: pointer; }
  .tkp-switch span::after { content: ''; position: absolute; left: 3px; top: 3px; width: 18px; height: 18px;
    border-radius: 50%; background: #fff; transition: .2s; }
  .tkp-switch input:checked + span { background: #fe2c55; }
  .tkp-switch input:checked + span::after { transform: translateX(18px); }
  .tkp-panel select { background: #22222a; color: #fff; border: 1px solid rgba(255,255,255,.15);
    border-radius: 8px; padding: 6px 8px; font: inherit; }
  .tkp-text { width: 170px; background: #22222a; color: #fff; border: 1px solid rgba(255,255,255,.15); border-radius: 8px; padding: 6px 8px; font: inherit; resize: vertical; }
  .tkp-btn { all: unset; cursor: pointer; padding: 8px 14px; border-radius: 10px; background: #26262e;
    font-weight: 600; font-size: 13px; }
  .tkp-btn:hover { background: #30303a; }
  .tkp-btn.tkp-primary { background: #fe2c55; }
  .tkp-foot { display: flex; flex-wrap: wrap; gap: 8px; padding: 14px 18px 18px; border-top: 1px solid rgba(255,255,255,.08); }
`;
  function row(s, needsReload) {
    let control;
    if (s.type === "toggle") {
      const input = h("input", { type: "checkbox" });
      input.checked = !!get(s.key);
      input.addEventListener("change", () => {
        set(s.key, input.checked);
        needsReload(s);
      });
      on(s.key, (v) => {
        input.checked = !!v;
      });
      control = h("label", { class: "tkp-switch" }, input, h("span"));
    } else if (s.type === "select") {
      const sel = h("select", null, s.options.map((o) => h("option", { value: String(o.value) }, o.label)));
      sel.value = String(get(s.key));
      sel.addEventListener("change", () => {
        const o = s.options.find((x) => String(x.value) === sel.value);
        set(s.key, o ? o.value : sel.value);
        needsReload(s);
      });
      on(s.key, (v) => {
        sel.value = String(v);
      });
      control = sel;
    } else if (s.type === "text") {
      const ta = h("textarea", { rows: 2, placeholder: "word, another word", class: "tkp-text" });
      ta.value = get(s.key) || "";
      ta.addEventListener("change", () => {
        set(s.key, ta.value);
      });
      ta.addEventListener("keydown", (e) => e.stopPropagation());
      on(s.key, (v) => {
        if (document.activeElement !== ta) ta.value = v || "";
      });
      control = ta;
    }
    const note = h("div", { class: "tkp-reload", hidden: true }, "Reload TikTok to apply");
    const el = h(
      "div",
      { class: "tkp-row" },
      h("div", { class: "tkp-txt" }, h("div", null, s.label), s.desc ? h("p", null, s.desc) : null, note),
      control
    );
    el.__note = note;
    return el;
  }
  function download(name, text) {
    const a = h("a", { href: URL.createObjectURL(new Blob([text], { type: "application/json" })), download: name });
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 1e3);
  }
  function openPanel() {
    if (document.querySelector(".tkp-overlay")) return;
    const rows = /* @__PURE__ */ new Map();
    const needsReload = (s) => {
      if (s.reload && rows.get(s.key)) rows.get(s.key).__note.hidden = false;
    };
    const groups2 = [];
    for (const s of SCHEMA) {
      let g = groups2.find((x) => x.name === s.group);
      if (!g) groups2.push(g = { name: s.group, items: [] });
      g.items.push(s);
    }
    const close = () => {
      overlay.remove();
      document.removeEventListener("keydown", onKey, true);
    };
    const file = h("input", { type: "file", accept: ".json,application/json", hidden: true });
    file.addEventListener("change", async () => {
      const f = file.files && file.files[0];
      if (!f) return;
      try {
        importJson(await f.text());
        alertBox("Settings imported. Reload TikTok to apply everything.");
      } catch (e) {
        alertBox("That file isn't a TikTok Plus settings file.");
      }
    });
    const msg = h("div", { style: { padding: "0 18px", color: "#25f4ee", fontSize: "13px" } });
    const alertBox = (t) => {
      msg.textContent = t;
    };
    const panel = h(
      "div",
      { class: "tkp-panel", role: "dialog", "aria-label": "TikTok Plus settings" },
      h(
        "div",
        { class: "tkp-head" },
        h("b", null, "TikTok Plus"),
        h("small", null, VERSION ? "v" + VERSION : ""),
        h("button", { class: "tkp-btn", onclick: close }, "Done")
      ),
      groups2.map((g) => h(
        "div",
        { class: "tkp-group" },
        h("h4", null, g.name),
        g.items.map((s) => {
          const r = row(s, needsReload);
          rows.set(s.key, r);
          return r;
        })
      )),
      msg,
      h(
        "div",
        { class: "tkp-foot" },
        h("button", { class: "tkp-btn", onclick: () => download("tiktok-plus-settings.json", exportJson()) }, "Export settings"),
        h("button", { class: "tkp-btn", onclick: () => file.click() }, "Import settings"),
        h("button", { class: "tkp-btn", onclick: () => {
          reset();
          alertBox("Back to defaults. Reload TikTok to apply everything.");
        } }, "Reset"),
        h("button", { class: "tkp-btn tkp-primary", onclick: () => location.reload() }, "Reload TikTok"),
        file
      )
    );
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    };
    const overlay = h("div", { class: "tkp-overlay", onclick: (e) => {
      if (e.target === overlay) close();
    } }, panel);
    overlay.addEventListener("keydown", (e) => e.stopPropagation());
    document.addEventListener("keydown", onKey, true);
    document.body.appendChild(overlay);
  }
  function startPanel() {
    addStyle("tkp-panel-css", CSS6);
    const gear = h("button", { class: "tkp-gear", title: "TikTok Plus settings", "aria-label": "TikTok Plus settings", onclick: openPanel }, "⚙");
    const mount = () => {
      if (document.body && !gear.isConnected) document.body.appendChild(gear);
    };
    mount();
    setInterval(mount, 1500);
  }

  // src/main.js
  if (!window.__tkPlus) {
    window.__tkPlus = { version: true ? "2.2.0" : "" };
    window.__tkDmSyncGuard12 = window.__tkDmSyncGuard13 = window.__tkDmSyncGuard14 = true;
    safe("flags", installFlags);
    safe("codecSwap", installCodecSwap);
    safe("backgroundPlay", installBackgroundPlay);
    safe("audioHook", installAudioHook);
    safe("watchdog", startWatchdog);
    onReady(() => {
      safe("composer", startComposer);
      safe("autoPause", startAutoPause);
      safe("speed", startSpeed);
      safe("dmLag", startDmLag);
      safe("look", startLook);
      safe("pip", startPip);
      safe("audioFx", startAudioFx);
      safe("autoScroll", startAutoScroll);
      safe("feedClean", startFeedClean);
      safe("panel", startPanel);
    });
  }
})();
