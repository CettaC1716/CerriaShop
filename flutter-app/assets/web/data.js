import { BUILDINGS_BY_LOT } from './js/store-data-manager.js?v=124';
// Store logo marks keyed by permanent store ID (see store_ids.js).
export const MARKS = {
  toko1: {
    view: '0 0 24 24',
    fill: '#c87d72',
    d: 'M12 2.2l2.3 6.3 6.5 2.3-6.5 2.3-2.3 6.3-2.3-6.3-6.5-2.3 6.5-2.3L12 2.2zm0 5.4a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4z'
  },
  toko2: {
    view: '0 0 24 24',
    fill: '#d4842a',
    d: 'M5 10h11v4a5.5 5.5 0 0 1-11 0v-4zm12.5 1H19a2 2 0 0 1 0 4h-1.5v-4zM3.5 18h14v2h-14v-2zM8 4.5c1 1.2 1 2.4 0 3.6M11.5 4c1 1.2 1 2.4 0 3.6'
  },
  toko3: {
    view: '0 0 24 24',
    fill: '#a85d44',
    d: 'M12 3a2.5 2.5 0 0 1 2.4 3.2c-.3.9-1.2 1.4-1.7 2L21 13.5c.7.5.9 1.4.4 2.1-.3.5-.8.8-1.4.8H4c-.8 0-1.5-.7-1.5-1.5 0-.5.2-1 .7-1.3l8.3-5.3V7.5c0-.6.5-1 1-1s.9-.4.9-.9A1 1 0 0 0 12 4.5a1 1 0 0 0-1 1H9.5A2.5 2.5 0 0 1 12 3zm-5.2 11.4h10.4L12 11l-5.2 3.4zM6 18h12v2.5H6V18z'
  },
  toko4: {
    view: '0 0 24 24',
    fill: '#3d7ea6',
    d: 'M12 2l3.2 6.8L22 12l-6.8 3.2L12 22l-3.2-6.8L2 12l6.8-3.2L12 2zm0 6.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4z'
  },
  toko6: {
    view: '0 0 24 24',
    fill: '#c95b3c',
    d: 'M12 2.4l8.4 4.8v9.6L12 21.6l-8.4-4.8V7.2L12 2.4zm0 2.5L6.2 8.2 12 11.5l5.8-3.3L12 4.9zm-6.4 5.2v5.5l5.4 3.1v-5.5L5.6 10.1zm12.8 0l-5.4 3.1v5.5l5.4-3.1v-5.5z'
  },
  toko5: {
    view: '0 0 24 24',
    fill: '#c84b31',
    d: 'M12 3.2c1.4-1.2 3.4-1.4 4.8-.6-1.1 1.3-1.2 2.4-.3 3.2 2.9 1.1 4.3 4 3.6 7.4-.8 3.9-4.4 8-8.1 8.6-3.7-.6-7.3-4.7-8.1-8.6-.7-3.4.7-6.3 3.6-7.4.9-.8.8-1.9-.3-3.2 1.4-.8 3.4-.6 4.8.6zm-2.2 6.3a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm4.4 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm-2.2 3.2a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm-3 2.4a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm6 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2z'
  },
  toko7: {
    view: '0 0 24 24',
    fill: '#6E828A',
    d: 'M12 2l2.2 2.2H11v1.6l8 4.2v2h-1.5v7.5H19v2H5v-2h1.5V12H5v-2l8-4.2V4.2h-1.2L12 2zm0 6.2a2.3 2.3 0 1 0 0 4.6 2.3 2.3 0 0 0 0-4.6zm-4.5 4.3v7h3v-5h3v5h3v-7h-9z'
  }
};

export const ICONS = {
  ctx: '<svg viewBox="0 0 16 16"><rect x="2.5" y="2.5" width="11" height="11" rx="2"/><path d="M5.5 8h5M8 5.5v5"/></svg>',
  modes: '<svg viewBox="0 0 16 16"><rect x="2" y="3" width="12" height="10" rx="2"/><path d="M4 11l3-3 2 2 3-3"/></svg>',
  clock: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="5.5"/><path d="M8 5v3.2l2.3 1.5"/></svg>',
  compass: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="5.5"/><path d="M6.4 9.6l1-3.2 3.2-1-1 3.2-3.2 1z"/></svg>',
  star: '<svg viewBox="0 0 16 16"><path d="M8 2.2l1.6 4.2 4.2 1.6-4.2 1.6L8 13.8 6.4 9.6 2.2 8l4.2-1.6L8 2.2z"/></svg>',
  grid: '<svg viewBox="0 0 16 16"><rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="9" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="2.5" y="9" width="4.5" height="4.5" rx="1"/><rect x="9" y="9" width="4.5" height="4.5" rx="1"/></svg>',
  shield: '<svg viewBox="0 0 16 16"><path d="M8 2.2l5 2v3.6c0 3.1-2.1 5.2-5 6.2-2.9-1-5-3.1-5-6.2V4.2l5-2z"/><path d="M6 8.1l1.4 1.4 2.8-2.8"/></svg>',
  sun: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="3.2"/><path d="M8 1.8v1.6M8 12.6v1.6M1.8 8h1.6M12.6 8h1.6M3.6 3.6l1.1 1.1M11.3 11.3l1.1 1.1M12.4 3.6l-1.1 1.1M4.7 11.3l-1.1 1.1"/></svg>',
  layers: '<svg viewBox="0 0 16 16"><path d="M8 2.5l5.5 3-5.5 3-5.5-3L8 2.5zM2.5 8.5L8 11.5l5.5-3M2.5 11.2L8 14.2l5.5-3"/></svg>',
  orbit: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="2"/><ellipse cx="8" cy="8" rx="6" ry="2.6" transform="rotate(-28 8 8)"/></svg>',
  cube: '<svg viewBox="0 0 16 16"><path d="M8 2.2l5.2 3v5.6L8 13.8l-5.2-3V5.2L8 2.2zM2.8 5.2L8 8.2l5.2-3M8 8.2v5.6"/></svg>',
  people: '<svg viewBox="0 0 16 16"><circle cx="6" cy="5.5" r="2.2"/><path d="M2 13c.4-2.4 2-3.6 4-3.6s3.6 1.2 4 3.6M10.5 3.6a2 2 0 010 3.8M11.6 9.6c1.3.4 2.1 1.6 2.4 3.4"/></svg>'
};

// BUILDINGS_DATA is ordered by PHYSICAL 3D LOT (index === village `stores[]` index), not by store number.
// Lot 4 hosts toko6 (Apex Sport) and lot 5 hosts toko5 (Strawberry Corner) — see STORE_SLOT in store_ids.js.
// Navigation order (toko1 → toko7) is derived from NAV_ORDER, never from this array order.
// Info-card display data lives in /data/stores-data.json (`<tokoN>.card`); rows are `{ id, ...card }`
// and are patched in place when the Smart Cache revalidates.
export const BUILDINGS_DATA = BUILDINGS_BY_LOT;
