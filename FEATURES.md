# TikTok DM feature inventory

Built from full passes of the Android app (47.5.3, US build), the iOS app (47.4.0) and the live
web app (Oct 2026). Raw dumps live in `reports/full/` on the scan machine.

Sources:
- Android: all 41,923 English UI strings (decoded from `assets/nxstring/nxstring_default.xrsc`,
  XOR 0x0F), plus every class name from 57 dex files and 24 dynamic feature modules
  (`libdex_df_*.so`, including `df_im_bootfinish` and `df_im_enterchat`).
- iOS: 17,395 source file paths from `MusicallyCore` (the `TikTokIM*` repos map every DM screen),
  36,000 IM class names, the built-in `AWEIMSticker.bundle`. The main iOS text table
  (`Languages/en.awelocdata`) is encrypted and was left alone.
- Web: the IM protocol enums, `data-e2e` ids, and the A/B flag reader in the webpack bundles.

## How the web decides what you get

Web DM features are A/B flags read from `abTestVersion.parameters` in the page config.
"v1" is off, "v2" is on.

| flag | what it does | your account |
|---|---|---|
| `web_dm_multimedia_msg` | photo and video sending (button, picker, upload, image/video cards) | off, unlocked by v1.3 |
| `web_dm_group_chat` | group chats on web | off, unlocked by v1.3 |
| `web_dm_sticker_msg_display` | shows received stickers | on |
| `web_dm_live_share_msg` | live share cards | on (v3) |

Photo/video limits from the same config: 10 MB images, 15 MB videos.

The web IM protocol already knows these message types: text, sticker (10002), image (10003),
video (10004), file, audio (10006), location, link, recall (unsend), message property updates
(reactions, pins), template cards (picture, video, sticker, audio, bubble, interaction).

## Feature list

Status key: on web / unlocked (v1.3) / buildable (userscript, client side) /
needs SDK work (web IM client can probably do it, needs study) / app only.

### Composer
- Text, emoji: on web
- Photos and videos: unlocked
- Reply to a message (quote): on web
- Enter to send, sync fix: done (v1.0 to v1.2)
- Stickers: on web for display. Sending needs SDK work (sticker message type exists).
  iOS/Android have a sticker store, favorites, popular stickers, GIPHY panel, AI stickers
  ("AIMoji", "AI Self"), video stickers, custom stickers made from photos, streak sticker sets.
- TikTok emoticons ([happy], [cry], [laughwithtears] ... 47 in `EmoticonsOverseas.bundle`): buildable as a picker
- GIFs (GIPHY): app only for now (needs GIPHY key and a GIF message type)
- Voice messages ("Send text or hold to talk"): app only (audio type exists, no web uploader)
- Quick replies (saved replies with a manage page): buildable
- Smart replies / suggested replies: app only (server AI)
- @mentions in groups: needs SDK work
- Plus panel (camera, share post, story remix, AI canvas): app only
- Drafts per chat: buildable

### Messages
- Reactions: on web
- Delete for me, report: on web
- Unsend for everyone (recall): needs SDK work
- Pin messages (pinned list, top banner): needs SDK work
- Edit message: app only
- Save / star message: app only
- Translation (inline, auto translate): buildable with the browser's translator
- Read status icons: needs SDK work (read commands exist)
- Typing indicator: needs SDK work
- Double tap to react (heart): buildable
- Message timestamps on hover, copy text: buildable

### Chat
- Chat wallpaper (blur, brightness): buildable as a local theme
- Bubble themes (chat appearance): buildable as a local theme
- In-chat search, media gallery (photos, videos, shared posts): buildable from loaded messages
- Mute: on web (icon), toggle needs SDK work
- Nicknames: needs SDK work
- Chat notifications settings, alert tones: app only

### Inbox
- Unread only filter, conversation tags: half built in the web store (`setUnreadOnly`,
  `getConversationListWithFilter`), buildable
- Pin chats to top (stick top): buildable locally
- Archive: buildable locally
- Starred chats: buildable locally
- Message requests: on web
- Inbox search: buildable

### Groups
- Group chats: unlocked
- Polls, join requests, admins, invite links and QR, fan groups, public groups: app only

### Fun and social
- Streaks: shown on web, streak pets app only
- Games, Group Shot, Photo Swap, fortune cookie, greeting cards, AI theater, Easter eggs: app only
- Voice calls: app only (RTC)

## Build order

1. v1.3 (done): photo/video sending and group chats.
2. Composer kit: TikTok emoticon picker, quick replies, per-chat drafts.
3. Chat kit: in-chat search and media gallery, wallpaper and bubble themes, translation,
   double tap to heart, timestamps.
4. Inbox kit: unread filter, pin to top, archive, starred, search.
5. SDK work: sticker sending (resend received and favorite stickers), unsend, pin messages,
   read status, typing.
