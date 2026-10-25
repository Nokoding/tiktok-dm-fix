# TikTok Plus: feature list and build plan

One userscript that makes TikTok web as good as the apps, then better. It covers DMs (everything
the iOS and Android apps have), the rest of the site (the "web enhancer" features from Tiktok Pro
Tools, TikTok Web Helper, TikTok Fix Pack and TikClient), and a full visual revamp.

Sources behind this plan:
- Full passes of TikTok Android 47.5.3 (US build), iOS 47.4.0 and the live web bundles (Oct 2026).
  Android: all 41,923 English UI strings, every class in 57 dex files plus 24 feature modules.
  iOS: 17,395 source paths, 36,000 IM class names, the built-in sticker bundle.
- The web IM protocol enums, A/B flags and `data-e2e` ids read from tiktok.com's own code.
- Research report (Oct 25 2026): TikTok/Douyin IM reverse engineering (Bibizyanov/TiktokAPI-Research,
  mautrix-tiktok, douyin-im-export, douyin-wss), Vencord and WA-JS module patterns, MediaRecorder,
  Translator API, GIPHY terms.
- The enhancer extensions from the AI Mode transcript (Tiktok Pro Tools, TikTok Web Helper,
  TikTok Fix Pack, TikClient, SideTok).

Ground rules:
- Every action that touches TikTok's servers starts from a click or a key you press. No loops,
  no auto-send, no auto-like, no bulk anything. That is what gets accounts flagged.
- Sends go through TikTok's own web client code (the page signs its own requests). No forged requests.
- Features TikTok's servers can't do are rebuilt locally and stored on your device.
- Every feature can be switched off in the settings panel.

Status key: DONE / NEXT (current milestone) / PLANNED.

---

## Part A. Site fixes and enhancer features (from the AI Mode transcript)

How the web player works (checked live): feed videos play from in-page `blob:` streams
(MediaSource), so audio processing through the Web Audio API works with no cross-site blocks.

| Feature | How | Status |
|---|---|---|
| Double audio fix ("zombie watchdog") | Pause every `<video>` that is off screen, detached or not the active one. Watch with IntersectionObserver plus a 1s check. | NEXT |
| HEVC codec swap (stutter fix) | At document-start, make `MediaSource.isTypeSupported` and `canPlayType` say no to `hvc1`/`hev1`, so TikTok serves H.264. Toggle, off by default (Edge plays HEVC fine on most PCs). | NEXT |
| Long DM chat lag fix | CSS `content-visibility: auto` plus `contain-intrinsic-size` on message rows, so off-screen messages cost nothing while you type. | NEXT |
| Background play | Make `document.hidden`/`visibilityState` read "visible" and swallow `visibilitychange`/`blur` pauses, only while the toggle is on. | NEXT |
| Auto-pause on tab switch | The opposite toggle: pause when the tab hides, resume when it comes back. | NEXT |
| Playback speed 0.25x to 4x | Speed pill on the player. Re-apply on every new video (`play`, `loadedmetadata`, `ratechange`). Shortcut keys. | NEXT |
| Picture-in-Picture | PiP button on the player. Auto-PiP when you scroll away or switch tabs, where Edge allows it. | PLANNED |
| Equalizer presets | Web Audio chain per video: BiquadFilter bank (bass boost, vocal, treble, flat, custom 10-band). | PLANNED |
| Volume normalization | DynamicsCompressor plus gain in the same chain. | PLANNED |
| 8D / 360 audio | StereoPanner (or PannerNode) swept slowly, with a little reverb. | PLANNED |
| Auto scroll | When a video ends, go to the next one (TikTok's own next control or ArrowDown). | PLANNED |
| Clean mode / ultra clean | CSS hides side clutter, overlays, promos and hover effects that cause stutter. Levels: off, clean, ultra. | PLANNED |
| Comment blur | Blur comments until hover or click. | PLANNED |
| Keyword filter | Hide feed videos whose caption, sound or hashtags match your list. Skip them automatically. | PLANNED |
| Download video (no watermark), audio, photo carousels | Read the item's play address from TikTok's page data or React props, fetch the blob, save it with a clean file name. Photo posts save each image. | PLANNED |
| Mobile layout | Optional narrow, phone-style layout (CSS), covers what TikClient and SideTok do. | PLANNED |

## Part B. DMs: fixes and unlocks

| Feature | How | Status |
|---|---|---|
| Enter sends, no lost letters, no ghost text | Native textarea replaces TikTok's Draft.js box. Text flows one way into TikTok. | DONE v1.4 |
| Photo and video sending | Flip `web_dm_multimedia_msg` to "v2". TikTok's own uploader and cards. | DONE v1.3 |
| Group chats on web | Flip `web_dm_group_chat` to "v2". | DONE v1.3 |
| Unread-only filter, conversation tags | Already half-built in TikTok's web store (`setUnreadOnly`, `getConversationListWithFilter`). Add the UI. | PLANNED |

## Part C. DMs: everything the apps have

Approach for anything that has to reach TikTok's servers: find TikTok's IM client modules at
runtime (webpack chunk push, matched by property names and code, never by numeric id), then call
its own `sendMessage`/`batchSendMessages`/property and recall functions. Payloads get dumped from
the live client first (recon harness, milestone 3), then wired up.

### Composer
| Feature | How | Status |
|---|---|---|
| Native box, auto-grow, Shift+Enter newline | Done in v1.4 | DONE |
| TikTok emoticons ([happy], [cry] ... 47 of them) | Picker that inserts the text token. TikTok's renderer draws the image. | PLANNED |
| Stickers: send | STICKER (10002) / sticker card (1805) through the client. Sources: stickers you've received (resend), your favorites, popular stickers if the web client can fetch the store. | PLANNED |
| Sticker favorites and recents | Local, with a "save sticker" action on received stickers. | PLANNED |
| Custom stickers from your images | Upload through the StickerCreation upload scene, if the server accepts it from web. Otherwise send as an image. | PLANNED |
| GIFs | GIPHY search panel (free key, "Powered by GIPHY" shown). Send as a sticker or image message. | PLANNED |
| Voice messages (hold to talk, 60s) | MediaRecorder, then AUDIO (10006) through the multimedia upload. Transcode if TikTok rejects webm/opus. | PLANNED |
| Quick replies | Saved replies with a manager. Type `/` to search them. Local. | PLANNED |
| Per-chat drafts | TikTok already keeps drafts. The new box loads them. | DONE |
| @mentions in groups | Member picker on `@`, mention entities in the text payload. | PLANNED |
| Reply / quote | TikTok's own, kept working. | DONE |

### Messages
| Feature | How | Status |
|---|---|---|
| Reactions | TikTok's own on web. Add double-click to heart, quick reaction bar. | PLANNED |
| Unsend for everyone | RECALL (50021) through the client. | PLANNED |
| Pin messages | Message property through the client. If the server refuses it from web: local pins with a pin bar. | PLANNED |
| Edit message | Local "edited" overlay only, unless the client has a real edit call. | PLANNED |
| Save / star messages | Local, with a saved-messages panel. | PLANNED |
| Translate | Edge's built-in Translator API (on-device). Per message and auto per chat. | PLANNED |
| Read status, typing indicator | Read from TikTok's IM store or socket events, show seen ticks and "typing...". | PLANNED |
| Timestamps on hover, copy text | Local. | PLANNED |
| Smart / suggested replies | Local suggestions (short canned replies). The app's AI version is server-side. | PLANNED |

### Chat
| Feature | How | Status |
|---|---|---|
| Wallpapers (blur, brightness) | Local, per chat, your own images or presets. | PLANNED |
| Bubble themes (chat appearance) | Local, per chat. | PLANNED |
| Search in chat, media gallery | Index loaded history locally (MiniSearch style), tabs for photos, videos, shared posts. | PLANNED |
| Nicknames | Local nickname override. | PLANNED |
| Mute | TikTok's own if the client exposes it. Otherwise local notification mute. | PLANNED |

### Inbox
| Feature | How | Status |
|---|---|---|
| Filters (unread, groups, requests, starred) | TikTok's half-built filter plus local tags. | PLANNED |
| Pin chats to top, archive, star | Local. | PLANNED |
| Inbox search | Local over loaded conversations. | PLANNED |

### Fun and social (rebuilt locally, visible to you)
| Feature | How | Status |
|---|---|---|
| Streaks | Read TikTok's streak data, show flame counts and an at-risk warning. | PLANNED |
| Streak pets | Local pet that grows with your streak. | PLANNED |
| Fortune cookie, greeting cards, games | Local mini cards. Sending them as real messages isn't possible from web, so they render for you only, or go out as plain text or an image. | PLANNED |
| Nudge | Sends a short preset message or emoticon. Real nudges are app-only. | PLANNED |
| Voice and video calls | App-only. Out of scope. | NO |

## Part D. The revamp (make it look like the app, with more life)

- A theme engine: CSS variables for every surface, light and dark, accent color pick (TikTok pink
  and cyan by default, plus custom).
- Chat: rounded gradient bubbles for your messages, grouped bubbles with tails, avatars only on the
  last bubble of a group, soft send animation, reaction pills, day separators, timestamps on hover.
- Composer: a floating pill box with buttons for emoticons, stickers, GIFs, voice, media and quick
  replies. Send button that animates in.
- Inbox: bigger avatars, online dots, streak flames, unread badges, pinned section, filter chips.
- Wallpapers and per-chat bubble themes (Part C).
- Settings panel: one gear button, every feature toggle, export and import settings as a file
  (so a second computer can match yours).

## Build plan

The script is getting big, so it moves from one hand-edited file to source modules in `src/`,
bundled into the same `tiktok-dm-sync-guard.user.js` (same install link, same auto-updates).

1. Foundation (NEXT): `src/` modules plus an esbuild bundle step, settings store and gear panel,
   theme engine. Ship Part A's NEXT items (double audio fix, codec swap toggle, DM lag fix,
   background play, auto-pause, speed).
2. Revamp pass 1: chat bubbles, composer pill, inbox styling (Part D).
3. Recon harness: find TikTok's IM client modules, log real payloads for sticker, recall,
   property (reactions and pins), read and typing events.
4. Composer kit: emoticons, stickers (send, favorites), GIFs, quick replies.
5. Message actions: unsend, pins, save, translate, read and typing display.
6. Voice messages.
7. Player extras: PiP, equalizer, normalization, 8D, auto scroll, clean mode, comment blur,
   keyword filter, downloads.
8. Inbox kit and fun extras: filters, pins, archive, star, search, streak display and pets,
   wallpapers, nicknames.

Each milestone ships as a version bump, so Tampermonkey picks it up.
