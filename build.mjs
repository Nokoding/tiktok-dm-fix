// Bundles src/ into the single userscript Tampermonkey installs.
// The output file name stays the same so the install link and auto-updates keep working.
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const RAW = 'https://raw.githubusercontent.com/Nokoding/tiktok-dm-fix/main/tiktok-dm-sync-guard.user.js';

const header = `// ==UserScript==
// @name         TikTok Plus
// @namespace    nokoding
// @version      ${pkg.version}
// @description  Makes TikTok web better: fixed DM box (Enter sends, no lost letters), photos, videos and group chats in DMs, double audio fix, speed control, background play and more. Settings behind the gear button.
// @match        https://www.tiktok.com/*
// @run-at       document-start
// @grant        none
// @updateURL    ${RAW}
// @downloadURL  ${RAW}
// ==/UserScript==

// Built from https://github.com/Nokoding/tiktok-dm-fix (src/). Edit the source, then run npm run build.
`;

const out = await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  write: false,
  legalComments: 'none',
  charset: 'utf8',
  define: { __TKP_VERSION__: JSON.stringify(pkg.version) },
});

writeFileSync('tiktok-dm-sync-guard.user.js', header + out.outputFiles[0].text);
console.log('built v' + pkg.version, out.outputFiles[0].text.length, 'bytes');
