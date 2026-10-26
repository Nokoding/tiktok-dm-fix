// Mobile layout: a narrow, phone-style feed in the middle of the screen (what TikClient and SideTok do).
import { get, on } from '../core/settings.js';
import { addStyle, removeStyle } from '../core/util.js';

const CSS = `
  @media (min-width: 700px) {
    [data-e2e="recommend-list-item-container"] { max-width: 430px !important; margin-left: auto !important; margin-right: auto !important; }
    [data-e2e="recommend-list-item-container"] section[data-e2e="feed-video"] { border-radius: 22px !important; overflow: hidden !important; }
    [data-e2e="following-accounts"], [data-e2e="copyright"] { display: none !important; }
  }
`;

export function startMobileLayout() {
  const sync = () => (get('mobileLayout') ? addStyle('tkp-mobile-css', CSS) : removeStyle('tkp-mobile-css'));
  sync();
  on('mobileLayout', sync);
}
