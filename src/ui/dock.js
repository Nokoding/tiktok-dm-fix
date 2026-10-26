// The floating player dock (bottom right). Speed, picture-in-picture and audio effects live here.
// Shows only while a video plays and you're not on the messages page.
import { addStyle, h } from '../core/util.js';

const CSS = `
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

let dock = null;
const groups = [];

export function dockGroup(order, visible) {
  ensure();
  const g = h('div', { class: 'tkp-dock-group' });
  g.__order = order;
  g.__visible = visible || (() => true);
  groups.push(g);
  groups.sort((a, b) => a.__order - b.__order);
  groups.forEach(x => dock.appendChild(x));
  return g;
}

function ensure() {
  if (dock) return;
  addStyle('tkp-dock-css', CSS);
  dock = h('div', { class: 'tkp-dock', hidden: true });
  setInterval(() => {
    if (!dock.isConnected && document.body) document.body.appendChild(dock);
    const onMessages = location.pathname.startsWith('/messages');
    const playing = [...document.querySelectorAll('video')].some(v => !v.paused && v.isConnected) || !!document.pictureInPictureElement;
    let any = false;
    for (const g of groups) { const vis = !!g.__visible(); g.hidden = !vis; any = any || vis; }
    dock.hidden = onMessages || !playing || !any;
  }, 600);
}
