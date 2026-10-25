# TikTok DM sync guard

A Tampermonkey userscript for TikTok web.

It does two things:

1. Fixes the DM box going out of sync. After voice typing (Whisper Flow, for example), the box can look empty while TikTok still holds the old text, so the old text gets sent with your new text. The script watches for that mismatch and resyncs TikTok to what you see.
2. Makes Enter send on the dedicated messages page (tiktok.com/messages). Shift+Enter is left alone.

## Install

1. Install Tampermonkey in your browser.
2. Click this link: [https://raw.githubusercontent.com/Nokoding/tiktok-dm-fix/main/tiktok-dm-sync-guard.user.js](https://raw.githubusercontent.com/Nokoding/tiktok-dm-fix/main/tiktok-dm-sync-guard.user.js)
3. Tampermonkey opens its install page. Click Install.

Updates come through Tampermonkey's normal update check.
