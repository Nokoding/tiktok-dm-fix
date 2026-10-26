# TikTok Plus

A Tampermonkey userscript that makes TikTok web better, with the goal of matching the phone apps.
The full feature list and build plan is in [FEATURES.md](FEATURES.md).

## What it does now (v2.0)

- Fixed DM box: a plain text box replaces TikTok's buggy one. Enter sends, Shift+Enter makes a new
  line, no eaten first letters, no old messages coming back. Works with voice typing like Whisper Flow.
- Photos, videos and group chats in DMs (TikTok's own features, switched on).
- Double audio fix: only one video plays sound.
- Speed control: 0.25x to 4x, a speed pill on videos, Shift+. and Shift+, to change it.
- Background play, or pause when you switch tabs (pick one).
- Stutter fix: forces H.264 instead of HEVC (off by default).
- Long chat lag fix.

Everything can be switched on or off from the gear button in the bottom-left corner. Settings
can be exported to a file and imported on another computer.

## Install

1. Install Tampermonkey in your browser.
2. Click this link: [https://raw.githubusercontent.com/Nokoding/tiktok-dm-fix/main/tiktok-dm-sync-guard.user.js](https://raw.githubusercontent.com/Nokoding/tiktok-dm-fix/main/tiktok-dm-sync-guard.user.js)
3. Tampermonkey opens its install page. Click Install.

Updates come through Tampermonkey's update check (Utilities, then "Check for userscript updates"
to get one right away).

## Building from source

The script is built from `src/` with esbuild:

```
npm install
npm run build
```

That writes `tiktok-dm-sync-guard.user.js`. The file name stays the same so the install link keeps working.
