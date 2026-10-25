// ==UserScript==
// @name         TikTok Plus
// @namespace    nokoding
// @version      2.0.0
// @description  Makes TikTok web as good as the app: fixed DM box, photos, videos and group chats in DMs, app-style look, playback and audio tools, and more. Settings live behind the gear button.
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
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
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

  // src/core/settings.js
  var KEY = "tkplus:settings:v1";
  var SCHEMA = [
    { group: "Messages", key: "composer", label: "Fixed message box", desc: "Native text box: Enter sends, no lost letters, no ghost text.", type: "toggle", def: true, reload: true },
    { group: "Messages", key: "unlockMedia", label: "Photos and videos in DMs", desc: "Turns on TikTok's own photo and video sending.", type: "toggle", def: true, reload: true },
    { group: "Messages", key: "unlockGroups", label: "Group chats", desc: "Turns on TikTok's own group chats on web.", type: "toggle", def: true, reload: true },
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

  // src/features/speed.js
  var STEPS = SCHEMA.find((s) => s.key === "speed").options.map((o) => o.value);
  var CSS2 = `
  .tkp-speed { position: fixed; z-index: 2147483000; right: 18px; bottom: 18px; display: flex;
    align-items: center; gap: 2px; padding: 4px; border-radius: 999px;
    background: rgba(22,22,26,.82); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
    border: 1px solid rgba(255,255,255,.12); color: #fff; font: 600 13px/1 system-ui, sans-serif;
    box-shadow: 0 6px 24px rgba(0,0,0,.35); user-select: none; transition: opacity .2s; }
  .tkp-speed[hidden] { display: none; }
  .tkp-speed button { all: unset; cursor: pointer; width: 28px; height: 28px; border-radius: 50%;
    display: grid; place-items: center; font-size: 16px; color: #fff; }
  .tkp-speed button:hover { background: rgba(255,255,255,.12); }
  .tkp-speed .tkp-speed-val { min-width: 44px; text-align: center; cursor: pointer; }
  .tkp-speed .tkp-speed-val.tkp-fast { color: #25f4ee; }
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
    addStyle("tkp-speed-css", CSS2);
    const val = h("span", { class: "tkp-speed-val", title: "Back to 1x", onclick: () => set("speed", 1) });
    const pill = h(
      "div",
      { class: "tkp-speed", hidden: true },
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
    const mount = () => {
      if (!pill.isConnected && document.body) document.body.appendChild(pill);
    };
    setInterval(() => {
      mount();
      const onMessages = location.pathname.startsWith("/messages");
      const hasVideo = [...document.querySelectorAll("video")].some((v) => !v.paused && v.isConnected);
      pill.hidden = !get("speedPill") || onMessages || !hasVideo;
    }, 700);
  }

  // src/features/dmLag.js
  var CSS3 = `
  [data-e2e="dm-new-chat-item"] { content-visibility: auto; contain-intrinsic-size: auto 72px; }
  [data-e2e="dm-new-conversation-item"] { content-visibility: auto; contain-intrinsic-size: auto 72px; }
`;
  function startDmLag() {
    const sync = () => get("dmLagFix") ? addStyle("tkp-dmlag-css", CSS3) : removeStyle("tkp-dmlag-css");
    sync();
    on("dmLagFix", sync);
  }

  // src/ui/panel.js
  var VERSION = true ? "2.0.0" : "";
  var CSS4 = `
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
    const groups = [];
    for (const s of SCHEMA) {
      let g = groups.find((x) => x.name === s.group);
      if (!g) groups.push(g = { name: s.group, items: [] });
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
      groups.map((g) => h(
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
    addStyle("tkp-panel-css", CSS4);
    const gear = h("button", { class: "tkp-gear", title: "TikTok Plus settings", "aria-label": "TikTok Plus settings", onclick: openPanel }, "⚙");
    const mount = () => {
      if (document.body && !gear.isConnected) document.body.appendChild(gear);
    };
    mount();
    setInterval(mount, 1500);
  }

  // src/main.js
  if (!window.__tkPlus) {
    window.__tkPlus = { version: true ? "2.0.0" : "" };
    window.__tkDmSyncGuard12 = window.__tkDmSyncGuard13 = window.__tkDmSyncGuard14 = true;
    safe("flags", installFlags);
    safe("codecSwap", installCodecSwap);
    safe("backgroundPlay", installBackgroundPlay);
    safe("watchdog", startWatchdog);
    onReady(() => {
      safe("composer", startComposer);
      safe("autoPause", startAutoPause);
      safe("speed", startSpeed);
      safe("dmLag", startDmLag);
      safe("panel", startPanel);
    });
  }
})();
