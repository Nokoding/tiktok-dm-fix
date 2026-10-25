// Long chat lag fix: the browser skips layout and paint for messages that are off screen,
// so a chat with hundreds of messages types as fast as a new one.
import { get, on } from '../core/settings.js';
import { addStyle, removeStyle } from '../core/util.js';

const CSS = `
  [data-e2e="dm-new-chat-item"] { content-visibility: auto; contain-intrinsic-size: auto 72px; }
  [data-e2e="dm-new-conversation-item"] { content-visibility: auto; contain-intrinsic-size: auto 72px; }
`;

export function startDmLag() {
  const sync = () => (get('dmLagFix') ? addStyle('tkp-dmlag-css', CSS) : removeStyle('tkp-dmlag-css'));
  sync();
  on('dmLagFix', sync);
}
