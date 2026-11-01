// ============================================================================
// CERRIA TOWN — FULL HYBRID UNITY UI OVERLAY RUNTIME (`?mode=unity-ui-overlay`)
// File: /js/unity-ui-overlay-app.js
// ----------------------------------------------------------------------------
// Merender 100% UI HTML/CSS/JS asli Cerria Town secara transparan di atas
// mesin 3D Unity (tanpa membuat WebGLRenderer di browser):
//   • Header "Cerria Town" + tombol "← Prev", "1 / 7", "Next →"
//   • Balon putih di atas atap gedung (#speech, mis. "22 Menu Bakery & Coffee")
//   • Tag toko tetangga kiri-kanan (#tag-left & #tag-right)
//   • Kartu ringkasan toko (#details-card) & tombol "Tampilkan Info ↑" (#reopen-card)
//   • Modal Katalog Produk Supabase (Glow Studio, Cozy Bites, Atelier, Circuit & Byte,
//     Strawberry Corner, Apex Sport, Balai Warga)
//   • Bottom Dock Radio (CozyAudioEngine), Siklus Waktu, Jam & Cuaca,
//     Pengaturan (#cozy-settings-popover), dan Panduan (dialog#info)
//   • Jembatan Dua Arah (JS <-> C# CerriaHybridWebViewBridge.cs):
//       - JS -> Unity: `window.unityBridge.send(JSON.stringify({ type, payload }))`
//       - Unity -> JS: `window.CerriaUnityOverlay.updateScreenAnchors(...)`
// ============================================================================
import * as THREE from 'three';
import { BUILDINGS_DATA, ICONS, MARKS } from '../data.js?v=124';
import { STORE_IDS, NAV_ORDER, normalizeStoreId, storeNumber, slotOf } from '../store_ids.js?v=124';
import { onStoresUpdated } from './store-data-manager.js?v=124';
import {
  unityBridge,
  registerStoreHost,
  notifyStoreOpened,
  notifyStoreClosed
} from './unity-bridge.js?v=124';
import { createStrawberryCornerSystem } from '../strawberry_corner.js?v=128';
import { createAtelierBoutiqueSystem } from '../atelier_boutique.js?v=128';
import { createGlowStudioSystem } from '../glow_studio.js?v=128';
import { createMayorOfficeSystem } from '../mayor_office.js?v=124';
import { createTownStores3DSystem } from '../town_stores_3d.js?v=128';
import { CozyAudioEngine } from '../cozy_audio.js?v=124';

document.documentElement.classList.add('unity-ui-overlay');
document.getElementById('loading')?.remove();

const LOTS = BUILDINGS_DATA.length;
const STYLE_HEIGHT = {
  bistro: 5.2,
  boutique: 6.4,
  tech: 6.2,
  sport: 6.5,
  glow: 5.8,
  strawberry: 5.9,
  mayor: 6.8
};
const slotAngle = i => Math.PI / 4 + i * (Math.PI / 2);
const logoSVG = (id, fill) => {
  const m = MARKS[normalizeStoreId(id)] || MARKS.toko1;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${m.view}"><path fill-rule="evenodd" fill="${fill || m.fill}" d="${m.d}"/></svg>`;
};

const $ = id => document.getElementById(id);
const tabsEl = $('tabs');
const speechEl = $('speech');
const tagLeft = $('tag-left');
const tagRight = $('tag-right');
const hintEl = $('ui-hint');
const detailsCard = $('details-card');
const reopenCardBtn = $('reopen-card');
const reopenLabel = $('reopen-label');
const infoModal = $('info');
const cozySettingsBtn = $('cozy-settings-btn');
const cozySettingsPopover = $('cozy-settings-popover');
const cozySettingsClose = $('cozy-settings-close');
const cozyHubRoot = $('cozy-hub-root');

let hintTimer = 0;
function showHint(msg) {
  if (!hintEl) return;
  hintEl.textContent = msg;
  hintEl.classList.add('on');
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => hintEl.classList.remove('on'), 1600);
}

// --- CPU-only stand-ins for the 3D town objects that store catalog controllers expect ---
const camera = new THREE.PerspectiveCamera(27, window.innerWidth / window.innerHeight, 0.5, 280);
const controls = {
  target: new THREE.Vector3(),
  enabled: false,
  update() {}
};

// Default 3D world positions for each physical slot (matching village.js / cerria-scene-metadata.json)
const DEFAULT_SLOT_COORDS = [
  { id: 'toko2', style: 'bistro', x: 8.2, z: 8.2, h: STYLE_HEIGHT.bistro || 5.2 },
  { id: 'toko3', style: 'boutique', x: 24.6, z: 8.2, h: STYLE_HEIGHT.boutique || 6.4 },
  { id: 'toko4', style: 'tech', x: 24.6, z: 24.6, h: STYLE_HEIGHT.tech || 6.2 },
  { id: 'toko6', style: 'sport', x: 8.2, z: 24.6, h: STYLE_HEIGHT.sport || 6.5 },
  { id: 'toko1', style: 'glow', x: 16.4, z: 8.2, h: STYLE_HEIGHT.glow || 5.8 },
  { id: 'toko5', style: 'strawberry', x: 16.4, z: 24.6, h: STYLE_HEIGHT.strawberry || 5.9 },
  { id: 'toko7', style: 'mayor', x: 41.0, z: 8.2, h: STYLE_HEIGHT.mayor || 6.8 }
];

const stores = BUILDINGS_DATA.map((lab, slotIdx) => {
  const def = DEFAULT_SLOT_COORDS[slotIdx] || { x: 16.4, z: 16.4, h: 6.0, style: 'glow' };
  const g = new THREE.Group();
  g.position.set(def.x, 0, def.z);
  return {
    id: lab.id,
    style: def.style,
    lab,
    g,
    label: new THREE.Vector3(def.x, def.h + 1.1, def.z),
    atlas: { setScale() {} }
  };
});

let actx = null;
function chime(freq = 520, dur = 0.09) {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(freq, actx.currentTime);
    o.frequency.exponentialRampToValueAtTime(freq * 1.25, actx.currentTime + dur);
    g.gain.setValueAtTime(0.05, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0008, actx.currentTime + dur);
    o.connect(g).connect(actx.destination);
    o.start();
    o.stop(actx.currentTime + dur);
  } catch {}
}

// --- Instantiate all 7 Store Catalog Controllers (Supabase integrated) ---
const base = { camera, controls, stores, chime };
const strawberryCorner = createStrawberryCornerSystem({
  ...base,
  slotAngle: () => 0,
  getPocketParkMatchmaking: () => null,
  onParkModeChange() {}
});
const glowStudio = createGlowStudioSystem(base);
const atelierBoutique = createAtelierBoutiqueSystem(base);
const mayorOffice = createMayorOfficeSystem(base);
const townStores3D = createTownStores3DSystem(base);

const STORE_CONTROLLERS = {
  toko1: { ctl: glowStudio },
  toko2: { ctl: townStores3D, key: 'toko2' },
  toko3: { ctl: atelierBoutique },
  toko4: { ctl: townStores3D, key: 'toko4' },
  toko5: { ctl: strawberryCorner },
  toko6: { ctl: townStores3D, key: 'toko6' },
  toko7: { ctl: mayorOffice }
};

let selected = slotOf('toko1') ?? 4;
let over = false;
let cardClosed = false;
let activeStoreId = null;
let switchingStoreModal = false;
let suppressUnityEcho = false;

// Live 2D Screen Anchors pushed from Unity (`Camera.WorldToScreenPoint`)
// Keyed by storeId ('toko1' .. 'toko7'): { roofX, roofY, roofZ, labelX, labelY, labelZ }
const unityScreenAnchors = {};
let hasUnityScreenAnchors = false;

function isAnyStoreViewActive() {
  return Boolean(
    activeStoreId ||
    strawberryCorner.isActive ||
    glowStudio.isActive ||
    atelierBoutique.isActive ||
    mayorOffice.isActive ||
    townStores3D.isActive
  );
}

// ============================================================================
// 1. STORE SUMMARY CARD (#details-card) & REOPEN PILL (#reopen-card)
// ============================================================================
let rollRAF = 0;
function rollTokens(targetStr) {
  cancelAnimationFrame(rollRAF);
  const el = $('tokens');
  if (!el) return;
  if (String(targetStr).includes('/')) {
    el.textContent = targetStr;
    return;
  }
  const target = parseFloat(targetStr) || 0;
  el.textContent = Math.round(target).toString();
}

function setCardClosed(closed, notifyUnity = true) {
  cardClosed = Boolean(closed);
  detailsCard?.classList.toggle('closed', cardClosed);
  reopenCardBtn?.classList.toggle('on', cardClosed);
  document.getElementById('app')?.classList.toggle('card-open', !cardClosed);
  const shortSpan = reopenCardBtn?.querySelector('.reopen-cta-short');
  if (shortSpan) shortSpan.textContent = cardClosed ? 'Info ↑' : 'Info ↓';
  if (notifyUnity && !suppressUnityEcho) {
    unityBridge.send(
      JSON.stringify({
        type: 'SET_CARD_CLOSED',
        payload: { closed: cardClosed, storeId: BUILDINGS_DATA[selected]?.id }
      })
    );
  }
}
document.getElementById('app')?.classList.toggle('card-open', !cardClosed);

$('close-card')?.addEventListener('click', () => {
  setCardClosed(true);
  chime(360, 0.07);
});

reopenCardBtn?.addEventListener('click', () => {
  if (window.innerWidth <= 767) {
    setCardClosed(!cardClosed);
  } else {
    setCardClosed(false);
  }
  chime(520, 0.08);
});

function renderCard(idx) {
  const d = BUILDINGS_DATA[idx];
  if (!d) return;
  if ($('lab-mark')) $('lab-mark').innerHTML = logoSVG(d.id);
  if ($('lab')) $('lab').textContent = d.sign;
  if ($('lab-line')) $('lab-line').textContent = (d.subtitle || '').split('·')[0].trim();
  if ($('model')) $('model').textContent = d.title;
  if ($('badge')) $('badge').textContent = d.badge;
  if (reopenLabel) {
    reopenLabel.textContent = d.title;
  }
  detailsCard?.classList.toggle('closed', cardClosed);
  reopenCardBtn?.classList.toggle('on', cardClosed);
  document.getElementById('app')?.classList.toggle('card-open', !cardClosed);
  rollTokens(d.metric);
  if ($('tokens-unit')) $('tokens-unit').textContent = d.unit;
  if ($('growth')) $('growth').textContent = '';
  if ($('district-no')) $('district-no').textContent = over ? 'Kota' : `${storeNumber(d.id)} / ${STORE_IDS.length}`;

  if ($('features')) {
    $('features').innerHTML = (d.specs || [])
      .map(
        s =>
          `<span title="${s.value} · ${s.label}"><i>${ICONS[s.icon] || ICONS.people}</i><span><b>${s.value}</b><small>${s.label}</small></span></span>`
      )
      .join('');
  }

  if (speechEl && d.checks?.length) {
    speechEl.textContent = d.checks[0];
  }
  const openBtn = $('open-module');
  if (openBtn) openBtn.textContent = d.ctaLabel || 'Masuk Toko →';
  const metaEl = $('card-meta');
  if (metaEl) metaEl.textContent = d.cardMeta || 'Klik tombol Masuk Toko untuk melihat katalog';

  updateAnchorsOverlay();
}

// ============================================================================
// 2. FLOATING ROOF SPEECH BALLOON (#speech) & LEFT/RIGHT NEIGHBOR TAGS
// ============================================================================
let leftNeighborIdx = 4;
let rightNeighborIdx = 1;

function getScreenPointForStore(slotIdx, isRoofSpeech = false) {
  const st = stores[slotIdx];
  if (!st) return [window.innerWidth * 0.5, window.innerHeight * 0.42, 0.5];

  const uAnchor = unityScreenAnchors[st.id];
  if (hasUnityScreenAnchors && uAnchor) {
    const sx = isRoofSpeech ? uAnchor.roofX : uAnchor.labelX;
    const sy = isRoofSpeech ? uAnchor.roofY : uAnchor.labelY;
    const sz = isRoofSpeech ? uAnchor.roofZ : uAnchor.labelZ;
    return [sx, sy, sz];
  }

  // Default 1:1 High-Angle Diorama screen projection before first Unity frame arrives
  if (slotIdx === selected) {
    return [window.innerWidth * 0.51, window.innerHeight * 0.34, 0.4];
  }
  const navPos = NAV_ORDER.indexOf(selected);
  const prevIdx = NAV_ORDER[(navPos - 1 + NAV_ORDER.length) % NAV_ORDER.length];
  if (slotIdx === prevIdx) {
    return [window.innerWidth * 0.16, window.innerHeight * 0.43, 0.5];
  }
  return [window.innerWidth * 0.84, window.innerHeight * 0.43, 0.5];
}

function updateAnchorsOverlay() {
  if (!speechEl || !tagLeft || !tagRight) return;
  if (over || isAnyStoreViewActive()) {
    speechEl.classList.remove('on');
    tagLeft.classList.remove('on');
    tagRight.classList.remove('on');
    return;
  }

  const s = stores[selected];
  const [sx, sy, sz] = getScreenPointForStore(selected, true);
  if (sz > 0 && sz < 1.5) {
    speechEl.style.transform = `translate(${Math.round(sx)}px, ${Math.round(sy)}px) translate(-16px, -100%)`;
    if (s?.lab?.checks?.length) {
      speechEl.textContent = s.lab.checks[0];
    }
    speechEl.classList.add('on');
  } else {
    speechEl.classList.remove('on');
  }

  const isSmallOrMediumScreen = window.innerWidth <= 767 || window.innerWidth < window.innerHeight;
  if ((!cardClosed && isSmallOrMediumScreen) || infoModal?.open) {
    tagLeft.classList.remove('on');
    tagRight.classList.remove('on');
    return;
  }

  const navPos = NAV_ORDER.indexOf(selected);
  const prevIdx = NAV_ORDER[(navPos - 1 + NAV_ORDER.length) % NAV_ORDER.length];
  const nextIdx = NAV_ORDER[(navPos + 1) % NAV_ORDER.length];
  const candidates = [prevIdx, nextIdx].map(idx => {
    const st = stores[idx];
    const [px, py, pz] = getScreenPointForStore(idx, false);
    return { idx, st, px, py, pz };
  });
  candidates.sort((a, b) => a.px - b.px);
  const leftC = candidates[0];
  const rightC = candidates[1];

  leftNeighborIdx = leftC.idx;
  rightNeighborIdx = rightC.idx;

  const placePill = (el, c, isRight) => {
    const d = c.st.lab;
    el.querySelector('b').textContent = d.pillTitle || `${d.sign} · ${d.title}`;
    el.querySelector('span').textContent = `${d.metric} ${d.unit.split(' ')[0]} · ${d.friends} pengunjung`;
    const w = el.offsetWidth || 168;
    const half = w / 2 + 24;
    const x = isRight
      ? Math.max(window.innerWidth * 0.68 + half * 0.35, Math.min(window.innerWidth - half, c.px))
      : Math.max(half, Math.min(window.innerWidth * 0.32 - half * 0.35, c.px));
    const y = Math.max(230, Math.min(window.innerHeight - 250, c.py));
    el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -100%)`;
    el.classList.add('on');
  };

  placePill(tagLeft, leftC, false);
  placePill(tagRight, rightC, true);
}

// ============================================================================
// 3. NAVIGATION & STORE CATALOG MODAL ACTIONS (JS -> UNITY BRIDGE)
// ============================================================================
function select(idx, fromExternal = false) {
  const next = ((idx % LOTS) + LOTS) % LOTS;
  over = false;
  selected = next;
  const storeId = BUILDINGS_DATA[selected].id;
  renderCard(selected);
  chime(460 + selected * 55, 0.08);
  if (!fromExternal) {
    history.replaceState(null, '', location.pathname + location.search + '#' + storeId);
  }
  if (!suppressUnityEcho) {
    unityBridge.send(
      JSON.stringify({
        type: 'SELECT_STORE',
        payload: {
          storeId,
          slot: selected,
          number: storeNumber(storeId)
        }
      })
    );
  }
}

function stepStore(delta) {
  const pos = NAV_ORDER.indexOf(selected);
  select(NAV_ORDER[(pos + delta + NAV_ORDER.length) % NAV_ORDER.length]);
}

function setOverview(flag) {
  over = Boolean(flag);
  renderCard(selected);
  chime(over ? 380 : 540, 0.1);
  showHint(over ? 'Tampilan seluruh Cerria Town' : `Fokus: ${BUILDINGS_DATA[selected].title}`);
  if (!suppressUnityEcho) {
    unityBridge.send(
      JSON.stringify({
        type: 'SET_OVERVIEW',
        payload: { overview: over, storeId: BUILDINGS_DATA[selected]?.id }
      })
    );
  }
}

function openStoreCatalogById(storeId) {
  const cleanId = normalizeStoreId(storeId) || BUILDINGS_DATA[selected]?.id || 'toko1';
  const entry = STORE_CONTROLLERS[cleanId];
  if (!entry) return false;

  const targetSlot = slotOf(cleanId);
  if (targetSlot != null && targetSlot !== selected) {
    select(targetSlot, true);
  }
  if (activeStoreId === cleanId && entry.ctl.isActive) return true;

  switchingStoreModal = true;
  closeActiveStoreCatalog();
  switchingStoreModal = false;

  activeStoreId = cleanId;
  document.documentElement.classList.add('unity-store-modal-open');
  updateAnchorsOverlay();

  const onExit = () => {
    const closedId = activeStoreId;
    activeStoreId = null;
    document.documentElement.classList.remove('unity-store-modal-open');
    updateAnchorsOverlay();
    if (!switchingStoreModal) {
      notifyStoreClosed(closedId);
      if (!suppressUnityEcho) {
        unityBridge.send(
          JSON.stringify({
            type: 'CLOSE_STORE',
            payload: { storeId: closedId }
          })
        );
      }
    }
  };

  if (entry.key) entry.ctl.enter(entry.key, onExit);
  else entry.ctl.enter(onExit);

  paintUnityOverlayHeroBuilding(cleanId);
  notifyStoreOpened(cleanId);
  if (!suppressUnityEcho) {
    unityBridge.send(
      JSON.stringify({
        type: 'OPEN_STORE',
        payload: { storeId: cleanId }
      })
    );
  }
  return true;
}

function closeActiveStoreCatalog() {
  if (!activeStoreId) return false;
  const entry = STORE_CONTROLLERS[activeStoreId];
  if (entry?.ctl?.isActive) {
    entry.ctl.exit();
    return true;
  }
  activeStoreId = null;
  document.documentElement.classList.remove('unity-store-modal-open');
  updateAnchorsOverlay();
  return false;
}

const STORE_ISO_PALETTE = {
  toko1: { wallL: '#F5E4DC', wallR: '#E4C8BC', roof: '#C87D72', awning: '#D98B80', sign: 'GLOW', glow: '#FFE5B8' },
  toko2: { wallL: '#F6E8D5', wallR: '#E2CDB2', roof: '#B87348', awning: '#D48856', sign: 'COZY', glow: '#FFE2AE' },
  toko3: { wallL: '#EFE5D8', wallR: '#D9C8B4', roof: '#8E4E38', awning: '#A85D44', sign: 'ATELIER', glow: '#FFE6BA' },
  toko4: { wallL: '#E4E9F0', wallR: '#C8D2DF', roof: '#34495E', awning: '#2980B9', sign: 'CIRCUIT', glow: '#A8F0FF' },
  toko5: { wallL: '#FFF4EC', wallR: '#F0D9CA', roof: '#D9483B', awning: '#E46C5E', sign: 'BERRY', glow: '#FFE6B5' },
  toko6: { wallL: '#E8EEF5', wallR: '#CBD7E6', roof: '#215DA6', awning: '#EB6B2A', sign: 'APEX', glow: '#FFF0C2' },
  toko7: { wallL: '#F4EDE0', wallR: '#DDD1BC', roof: '#566A73', awning: '#6E828A', sign: 'MAYOR', glow: '#FFE8B8' }
};

function paintUnityOverlayHeroBuilding(storeId) {
  const pal = STORE_ISO_PALETTE[storeId] || STORE_ISO_PALETTE.toko1;
  const canvases = document.querySelectorAll('.sc-overlay .sc-hero-building-canvas');
  canvases.forEach(cvs => {
    const ctx = cvs.getContext('2d');
    if (!ctx) return;
    const w = cvs.width || 240;
    const h = cvs.height || 240;
    ctx.clearRect(0, 0, w, h);

    // Warm cream background matching studio diorama
    const bgGrad = ctx.createRadialGradient(w * 0.5, h * 0.45, 16, w * 0.5, h * 0.5, w * 0.65);
    bgGrad.addColorStop(0, '#FFFDF8');
    bgGrad.addColorStop(1, '#EFE2CE');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Isometric ground shadow & plaza base
    ctx.fillStyle = 'rgba(56, 34, 24, 0.12)';
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.81, 78, 22, 0, 0, Math.PI * 2);
    ctx.fill();

    const cx = w * 0.5;
    const baseY = h * 0.78;
    const bw = 58;
    const bh = 78;
    const isoY = 24;

    // Left 3D Facade Wall
    ctx.fillStyle = pal.wallL;
    ctx.beginPath();
    ctx.moveTo(cx - bw, baseY - isoY);
    ctx.lineTo(cx, baseY);
    ctx.lineTo(cx, baseY - bh);
    ctx.lineTo(cx - bw, baseY - bh - isoY);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(56, 34, 24, 0.25)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Right 3D Facade Wall
    ctx.fillStyle = pal.wallR;
    ctx.beginPath();
    ctx.moveTo(cx, baseY);
    ctx.lineTo(cx + bw, baseY - isoY);
    ctx.lineTo(cx + bw, baseY - bh - isoY);
    ctx.lineTo(cx, baseY - bh);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Isometric Roof Deck
    ctx.fillStyle = pal.roof;
    ctx.beginPath();
    ctx.moveTo(cx, baseY - bh);
    ctx.lineTo(cx + bw + 4, baseY - bh - isoY);
    ctx.lineTo(cx, baseY - bh - isoY * 2);
    ctx.lineTo(cx - bw - 4, baseY - bh - isoY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Glowing Storefront Windows & Door
    ctx.fillStyle = pal.glow;
    ctx.beginPath();
    ctx.moveTo(cx - bw * 0.72, baseY - isoY * 0.72 - 12);
    ctx.lineTo(cx - bw * 0.16, baseY - isoY * 0.16 - 12);
    ctx.lineTo(cx - bw * 0.16, baseY - isoY * 0.16 - 42);
    ctx.lineTo(cx - bw * 0.72, baseY - isoY * 0.72 - 42);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx + bw * 0.16, baseY - isoY * 0.16 - 12);
    ctx.lineTo(cx + bw * 0.72, baseY - isoY * 0.72 - 12);
    ctx.lineTo(cx + bw * 0.72, baseY - isoY * 0.72 - 42);
    ctx.lineTo(cx + bw * 0.16, baseY - isoY * 0.16 - 42);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Striped Awning Canopy
    ctx.fillStyle = pal.awning;
    ctx.beginPath();
    ctx.moveTo(cx - bw * 0.82, baseY - isoY * 0.82 - 42);
    ctx.lineTo(cx, baseY - 38);
    ctx.lineTo(cx, baseY - 50);
    ctx.lineTo(cx - bw * 0.76, baseY - isoY * 0.76 - 52);
    ctx.closePath();
    ctx.fill();

    // Rooftop 3D Signboard Pill
    ctx.fillStyle = '#2B1E17';
    ctx.beginPath();
    ctx.roundRect(cx - 42, baseY - bh - isoY * 2 - 22, 84, 24, 8);
    ctx.fill();
    ctx.fillStyle = '#FFFDF8';
    ctx.font = '800 13px "DM Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(pal.sign, cx, baseY - bh - isoY * 2 - 6);
  });
}

document.addEventListener('click', e => {
  if (activeStoreId && e.target.closest('[data-gs-nav="HOME"], [data-ts-nav="HOME"], [data-at-nav="HOME"], [data-nav="HOME"], [data-mayor-nav="HOME"]')) {
    requestAnimationFrame(() => paintUnityOverlayHeroBuilding(activeStoreId));
  }
});

$('prev')?.addEventListener('click', () => stepStore(-1));
$('next')?.addEventListener('click', () => stepStore(1));
$('brand-home')?.addEventListener('click', e => {
  e.preventDefault();
  select(slotOf('toko1'));
});
tagLeft?.addEventListener('click', () => select(leftNeighborIdx));
tagRight?.addEventListener('click', () => select(rightNeighborIdx));
speechEl?.addEventListener('click', () => openStoreCatalogById(BUILDINGS_DATA[selected]?.id));
$('open-module')?.addEventListener('click', () => openStoreCatalogById(BUILDINGS_DATA[selected]?.id));
$('exit-building')?.addEventListener('click', () => closeActiveStoreCatalog());

// ============================================================================
// 4. BOTTOM DOCK BAR (RADIO, TIME/MOOD CYCLE, WEATHER, SETTINGS, GUIDE)
// ============================================================================
let paused = false;
const SPEEDS = [
  [1, '1× Nyata'],
  [2, '2×'],
  [4, '4×'],
  [8, '8× Timelapse']
];
let speedIdx = 0;
let timeScale = SPEEDS[speedIdx][0];
let cycleOn = false;
let daytime = 20.5; // Default Warm Night Atmosphere matching Unity 3D scene
let cityLightMult = 1.0;
let dofEnabled = true;
let shutter = 0.18;

const WEATHER_STATES = [
  { id: 'sunny', label: 'Cerah', nightLabel: 'Cerah', tempOffset: +2 },
  { id: 'breezy', label: 'Cerah Berangin', nightLabel: 'Sejuk Berbintang', tempOffset: 0 },
  { id: 'cloudy', label: 'Berawan', nightLabel: 'Berawan Sejuk', tempOffset: -1 },
  { id: 'overcast', label: 'Mendung', nightLabel: 'Mendung Syahdu', tempOffset: -2 },
  { id: 'light_rain', label: 'Hujan Ringan', nightLabel: 'Hujan Ringan', tempOffset: -3 }
];
let currentWeatherIdx = 1; // Default: Sejuk Berbintang (21°C) at night

if ($('daytime')) $('daytime').value = String(daytime);
if ($('cycle')) $('cycle').checked = false;
if ($('city-lights')) $('city-lights').value = String(cityLightMult);
if ($('city-lights-val')) $('city-lights-val').textContent = '100%';
if ($('dof')) $('dof').checked = true;
if ($('shutter')) $('shutter').value = String(shutter);
if ($('shutter-val')) $('shutter-val').textContent = `${shutter.toFixed(2)}s`;

const PAUSE_SVG =
  '<svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor" aria-hidden="true"><rect x="3" y="2.5" width="3.2" height="11" rx="0.8"/><rect x="9.8" y="2.5" width="3.2" height="11" rx="0.8"/></svg>';
const PLAY_SVG =
  '<svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor" aria-hidden="true"><path d="M4 2.5l9 5.5-9 5.5V2.5z"/></svg>';

function formatClock(h) {
  const wh = ((h % 24) + 24) % 24;
  const hh = Math.floor(wh);
  const mm = Math.floor((wh - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

const HARI_SINGKAT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const BULAN_SINGKAT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
function formatShortDate() {
  const now = new Date();
  return `${HARI_SINGKAT[now.getDay()]}, ${now.getDate()} ${BULAN_SINGKAT[now.getMonth()]}`;
}

function getTownMoodAndClimate(h) {
  const wh = ((h % 24) + 24) % 24;
  const wState = WEATHER_STATES[currentWeatherIdx] || WEATHER_STATES[1];
  let baseTemp = 21;
  let mood = '🌙 Night';
  let track = 'Midnight Lo-Fi · Cozy Starlight Breeze — Cerria Town Radio';
  let isNightOrDusk = true;

  if (wh >= 5.2 && wh < 7.5) {
    baseTemp = 22;
    mood = '🌄 Dawn';
    track = 'Sunny Morning Bossa · Gentle Town Stroll — Cerria Town Radio';
    isNightOrDusk = false;
  } else if (wh >= 16.5 && wh < 19.0) {
    baseTemp = 23;
    mood = '🌅 Dusk';
    track = 'Sunny Morning Bossa · Gentle Town Stroll — Cerria Town Radio';
    isNightOrDusk = false;
  } else if (wh >= 7.5 && wh < 16.5) {
    baseTemp = 25;
    mood = '☀️ Day';
    track = 'Sunny Morning Bossa · Gentle Town Stroll — Cerria Town Radio';
    isNightOrDusk = false;
  }

  const finalTemp = Math.round(baseTemp + wState.tempOffset);
  const weatherLabel = isNightOrDusk ? wState.nightLabel || wState.label : wState.label;

  return {
    mood,
    climate: `${finalTemp}°C · ${weatherLabel}`,
    track
  };
}

const cozyAudio = new CozyAudioEngine();
const cozyAudioPill = $('cozy-audio-pill');
const cozyMusicBtn = $('cozy-music-toggle');
const cozyMoodTag = $('cozy-mood-tag');
const cozyVolSlider = $('cozy-music-vol');
const cozyMuteBtn = $('cozy-mute-btn');
const cozyVolVal = $('cozy-vol-val');
const cozyPlayBadge = $('cozy-play-badge');
let savedVolBeforeMute = 0.42;

function updateHubWeatherAndClock(h) {
  const clockStr = formatClock(h);
  if ($('clock')) $('clock').textContent = clockStr;
  if ($('hub-clock')) $('hub-clock').textContent = clockStr;
  if ($('hub-date')) $('hub-date').textContent = formatShortDate();
  const info = getTownMoodAndClimate(h);
  if ($('hub-climate')) $('hub-climate').textContent = info.climate;
  if ($('cozy-music-label')) $('cozy-music-label').textContent = info.track;
  if ($('cozy-music-label-dup')) $('cozy-music-label-dup').textContent = info.track;
  if (cozyMoodTag) {
    cozyMoodTag.textContent = info.mood;
  }
}

function syncCozyAudioUI(status) {
  if (!cozyAudioPill || !cozyMusicBtn || !cozyMoodTag) return;
  cozyAudioPill.classList.toggle('on', status.enabled);
  cozyAudioPill.classList.toggle('playing', status.playing);
  cozyMusicBtn.setAttribute('aria-pressed', String(status.enabled));
  if (cozyPlayBadge) {
    cozyPlayBadge.textContent = status.enabled ? '❚❚' : '▶';
  }
  const info = getTownMoodAndClimate(daytime);
  cozyMoodTag.textContent = info.mood;
  if (cozyMuteBtn) {
    const isMuted = !status.enabled || status.volume <= 0.001;
    cozyMuteBtn.classList.toggle('muted', isMuted);
    cozyMuteBtn.textContent = isMuted ? '🔇 Mute' : '🔊 Aktif';
  }
  if (cozyVolVal) {
    cozyVolVal.textContent = status.enabled ? `${Math.round(status.volume * 100)}%` : '0%';
  }
}

cozyAudio.onStateChange = syncCozyAudioUI;
cozyAudio.setTimeOfDay(daytime);
updateHubWeatherAndClock(daytime);
syncCozyAudioUI(cozyAudio.getStatus());

// Klik pada pill #cozy-mood-tag ("🌙 Night" / "🌄 Dawn" / "☀️ Day" / "🌅 Dusk") langsung mengubah waktu kota di Unity!
if (cozyMoodTag) {
  cozyMoodTag.style.cursor = 'pointer';
  cozyMoodTag.title = 'Klik untuk mengganti suasana waktu (Malam / Pagi / Siang / Senja)';
  cozyMoodTag.addEventListener('click', e => {
    e.stopPropagation();
    const wh = ((daytime % 24) + 24) % 24;
    if (wh >= 19.0 || wh < 5.2) {
      daytime = 6.4; // Night -> Dawn
    } else if (wh >= 5.2 && wh < 7.5) {
      daytime = 13.0; // Dawn -> Day
    } else if (wh >= 7.5 && wh < 16.5) {
      daytime = 17.6; // Day -> Dusk
    } else {
      daytime = 20.5; // Dusk -> Night
    }
    if ($('daytime')) $('daytime').value = String(daytime);
    cozyAudio.setTimeOfDay(daytime);
    updateHubWeatherAndClock(daytime);
    const info = getTownMoodAndClimate(daytime);
    showHint(`${info.mood} · ${formatClock(daytime)} (${info.climate})`);
    unityBridge.send(
      JSON.stringify({
        type: 'SET_TIME_OF_DAY',
        payload: { hour: daytime }
      })
    );
  });
}

function syncWeatherModeButtons(idx) {
  const mode = idx === 4 ? 'rain' : (idx === 3 || idx === 2 ? 'fog' : 'clear');
  document.querySelectorAll('.cozy-weather-opt').forEach(btn => {
    btn.classList.toggle('on', btn.dataset.weatherMode === mode);
  });
}

function setWeatherByIndex(idx, notifyUnity = true) {
  currentWeatherIdx = ((idx % WEATHER_STATES.length) + WEATHER_STATES.length) % WEATHER_STATES.length;
  syncWeatherModeButtons(currentWeatherIdx);
  updateHubWeatherAndClock(daytime);
  const info = getTownMoodAndClimate(daytime);
  showHint(`🌦️ Cuaca: ${info.climate}`);
  if (notifyUnity && !suppressUnityEcho) {
    const mode = currentWeatherIdx === 4 ? 'rain' : (currentWeatherIdx === 3 || currentWeatherIdx === 2 ? 'fog' : 'clear');
    unityBridge.send(
      JSON.stringify({
        type: 'SET_WEATHER',
        weather: mode,
        weatherIndex: currentWeatherIdx,
        payload: {
          weather: mode,
          weatherId: WEATHER_STATES[currentWeatherIdx].id,
          weatherIndex: currentWeatherIdx,
          climate: info.climate
        }
      })
    );
  }
}

$('cozy-hub-weather')?.addEventListener('click', e => {
  e.stopPropagation();
  const nextIdx = (currentWeatherIdx === 0 || currentWeatherIdx === 1 || currentWeatherIdx === 2)
    ? 4
    : (currentWeatherIdx === 4 ? 3 : 1);
  setWeatherByIndex(nextIdx, true);
});

document.querySelectorAll('.cozy-weather-opt').forEach(btn => {
  btn.addEventListener('click', e => {
    e.stopPropagation();
    const idx = parseInt(btn.dataset.weatherIdx || '1', 10);
    setWeatherByIndex(idx, true);
  });
});

cozyMusicBtn?.addEventListener('click', async e => {
  e.stopPropagation();
  const enabled = await cozyAudio.toggle();
  showHint(enabled ? '🎵 Cerria Town Radio aktif' : '🔇 Radio dijeda');
  unityBridge.send(
    JSON.stringify({
      type: 'SET_AUDIO_STATE',
      payload: { enabled, volume: cozyAudio.volume }
    })
  );
});

cozyMuteBtn?.addEventListener('click', async e => {
  e.stopPropagation();
  if (cozyAudio.isEnabled && cozyAudio.volume > 0.01) {
    savedVolBeforeMute = cozyAudio.volume;
    await cozyAudio.toggle();
  } else {
    if (cozyAudio.volume <= 0.01) {
      cozyAudio.setVolume(savedVolBeforeMute || 0.42);
      if (cozyVolSlider) cozyVolSlider.value = String(savedVolBeforeMute || 0.42);
    }
    if (!cozyAudio.isEnabled) await cozyAudio.toggle();
  }
  unityBridge.send(
    JSON.stringify({
      type: 'SET_AUDIO_STATE',
      payload: { enabled: cozyAudio.isEnabled, volume: cozyAudio.volume }
    })
  );
});

cozyVolSlider?.addEventListener('input', e => {
  const v = parseFloat(e.target.value);
  if (v > 0.01) savedVolBeforeMute = v;
  cozyAudio.setVolume(v);
  if (cozyVolVal) cozyVolVal.textContent = `${Math.round(v * 100)}%`;
  if (v > 0 && !cozyAudio.isEnabled) {
    cozyAudio.toggle();
  }
  unityBridge.send(
    JSON.stringify({
      type: 'SET_AUDIO_STATE',
      payload: { enabled: cozyAudio.isEnabled, volume: v }
    })
  );
});

function setSettingsOpen(open) {
  if (!cozySettingsPopover || !cozySettingsBtn) return;
  cozySettingsPopover.classList.toggle('open', open);
  cozySettingsPopover.setAttribute('aria-hidden', String(!open));
  cozySettingsBtn.setAttribute('aria-expanded', String(open));
}

cozySettingsBtn?.addEventListener('click', e => {
  e.stopPropagation();
  setSettingsOpen(!cozySettingsPopover?.classList.contains('open'));
});

cozySettingsClose?.addEventListener('click', e => {
  e.stopPropagation();
  setSettingsOpen(false);
});

document.addEventListener('pointerdown', e => {
  if (!cozySettingsPopover?.classList.contains('open')) return;
  if (cozyHubRoot && !cozyHubRoot.contains(e.target)) {
    setSettingsOpen(false);
  }
});

// Prevent camera/overlay drag listeners from stealing pointer/touch events on Settings Popover sliders & toggles
if (cozySettingsPopover) {
  const stopDragPropagation = e => {
    e.stopPropagation();
  };
  ['pointerdown', 'pointermove', 'mousedown', 'mousemove', 'touchstart', 'touchmove', 'wheel'].forEach(evtName => {
    cozySettingsPopover.addEventListener(evtName, stopDragPropagation, { passive: true });
  });
  cozySettingsPopover
    .querySelectorAll('input[type="range"], input[type="checkbox"], .cozy-toggle-chip, button')
    .forEach(ctrl => {
      ['pointerdown', 'pointermove', 'mousedown', 'mousemove', 'touchstart', 'touchmove'].forEach(evtName => {
        ctrl.addEventListener(evtName, stopDragPropagation, { passive: true });
      });
    });
}

$('about')?.addEventListener('click', () => infoModal?.showModal());
$('cozy-open-guide-btn')?.addEventListener('click', e => {
  e.stopPropagation();
  setSettingsOpen(false);
  infoModal?.showModal();
});
$('close-info')?.addEventListener('click', () => infoModal?.close());
infoModal?.addEventListener('click', e => {
  if (e.target === infoModal) infoModal.close();
});

$('daytime')?.addEventListener('input', e => {
  daytime = parseFloat(e.target.value);
  cycleOn = false;
  if ($('cycle')) $('cycle').checked = false;
  cozyAudio.setTimeOfDay(daytime);
  updateHubWeatherAndClock(daytime);
  unityBridge.send(
    JSON.stringify({
      type: 'SET_TIME_OF_DAY',
      payload: { hour: daytime }
    })
  );
});

$('city-lights')?.addEventListener('input', e => {
  cityLightMult = parseFloat(e.target.value);
  const pct = `${Math.round(cityLightMult * 100)}%`;
  if ($('city-lights-val')) $('city-lights-val').textContent = pct;
  showHint(`💡 Terang Kota ${pct}`);
  unityBridge.send(
    JSON.stringify({
      type: 'SET_CITY_LIGHTS',
      payload: { multiplier: cityLightMult }
    })
  );
});

$('pause')?.addEventListener('click', () => {
  paused = !paused;
  const pauseBtn = $('pause');
  if (pauseBtn) {
    pauseBtn.innerHTML = `${paused ? PLAY_SVG : PAUSE_SVG}<span>${paused ? 'Jalan' : 'Jeda'}</span>`;
    pauseBtn.classList.toggle('paused', paused);
  }
  showHint(paused ? '⏸️ Simulasi dijeda' : '▶️ Simulasi dilanjutkan');
  unityBridge.send(
    JSON.stringify({
      type: 'SET_SIM_SPEED',
      payload: { paused, speedMultiplier: paused ? 0 : timeScale }
    })
  );
});

const speedOptBtns = document.querySelectorAll('.cozy-spd-opt');
function setSpeed(idx, notifyUnity = true) {
  speedIdx = ((idx % SPEEDS.length) + SPEEDS.length) % SPEEDS.length;
  timeScale = SPEEDS[speedIdx][0];
  if ($('speed')) $('speed').textContent = SPEEDS[speedIdx][1];
  speedOptBtns.forEach(btn => {
    const bIdx = parseInt(btn.getAttribute('data-speed-idx') || '0', 10);
    btn.classList.toggle('on', bIdx === speedIdx);
  });
  if (notifyUnity) {
    showHint(`🏃 Kecepatan ${SPEEDS[speedIdx][1]}`);
    unityBridge.send(
      JSON.stringify({
        type: 'SET_SIM_SPEED',
        payload: { paused, speedMultiplier: timeScale }
      })
    );
  }
}
$('speed')?.addEventListener('click', () => setSpeed(speedIdx + 1));
speedOptBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const bIdx = parseInt(btn.getAttribute('data-speed-idx') || '0', 10);
    setSpeed(bIdx);
  });
});

$('dof')?.addEventListener('change', e => {
  dofEnabled = Boolean(e.target.checked);
  showHint(dofEnabled ? '📷 Macro DOF aktif' : '📷 Macro DOF nonaktif');
  unityBridge.send(
    JSON.stringify({
      type: 'SET_DOF',
      payload: { enabled: dofEnabled, shutter }
    })
  );
});

$('shutter')?.addEventListener('input', e => {
  shutter = parseFloat(e.target.value);
  if ($('shutter-val')) $('shutter-val').textContent = `${shutter.toFixed(2)}s`;
  unityBridge.send(
    JSON.stringify({
      type: 'SET_SHUTTER',
      payload: { shutter, dofEnabled }
    })
  );
});

$('cycle')?.addEventListener('change', e => {
  cycleOn = Boolean(e.target.checked);
  showHint(cycleOn ? '🌗 Siklus waktu otomatis aktif' : '🌗 Siklus waktu otomatis dimatikan');
  unityBridge.send(
    JSON.stringify({
      type: 'SET_AUTO_CYCLE',
      payload: { enabled: cycleOn }
    })
  );
});

// ============================================================================
// 5. GLOBAL API FOR UNITY -> JS SYNCHRONIZATION (`window.CerriaUnityOverlay`)
// ============================================================================
function handleUnityCommand(msg) {
  if (!msg || typeof msg !== 'object') return;
  const type = String(msg.type || '').toUpperCase();
  const payload = msg.payload || msg;

  suppressUnityEcho = true;
  try {
    if (type === 'SYNC_UNITY_STATE' || type === 'UPDATE_ANCHORS') {
      if (payload.anchors && typeof payload.anchors === 'object') {
        Object.assign(unityScreenAnchors, payload.anchors);
        hasUnityScreenAnchors = true;
      }
      if (payload.selectedStoreId) {
        const sSlot = slotOf(payload.selectedStoreId);
        if (sSlot != null && sSlot !== selected) {
          selected = sSlot;
          renderCard(selected);
        }
      }
      if (typeof payload.timeOfDay === 'number' && Math.abs(payload.timeOfDay - daytime) > 0.05) {
        daytime = payload.timeOfDay;
        if ($('daytime')) $('daytime').value = String(daytime);
        cozyAudio.setTimeOfDay(daytime);
        updateHubWeatherAndClock(daytime);
      }
      if (typeof payload.cityLightMultiplier === 'number') {
        cityLightMult = payload.cityLightMultiplier;
        if ($('city-lights')) $('city-lights').value = String(cityLightMult);
        if ($('city-lights-val')) $('city-lights-val').textContent = `${Math.round(cityLightMult * 100)}%`;
      }
      if (typeof payload.autoCycleTime === 'boolean') {
        cycleOn = payload.autoCycleTime;
        if ($('cycle')) $('cycle').checked = cycleOn;
      }
      if (typeof payload.paused === 'boolean') {
        paused = payload.paused;
        const pauseBtn = $('pause');
        if (pauseBtn) {
          pauseBtn.innerHTML = `${paused ? PLAY_SVG : PAUSE_SVG}<span>${paused ? 'Jalan' : 'Jeda'}</span>`;
          pauseBtn.classList.toggle('paused', paused);
        }
      }
      if (typeof payload.timeScale === 'number') {
        const matchIdx = SPEEDS.findIndex(s => Math.abs(s[0] - payload.timeScale) < 0.1);
        if (matchIdx >= 0) setSpeed(matchIdx, false);
      }
      if (typeof payload.dofEnabled === 'boolean') {
        dofEnabled = payload.dofEnabled;
        if ($('dof')) $('dof').checked = dofEnabled;
      }
      if (typeof payload.shutter === 'number') {
        shutter = payload.shutter;
        if ($('shutter')) $('shutter').value = String(shutter);
        if ($('shutter-val')) $('shutter-val').textContent = `${shutter.toFixed(2)}s`;
      }
      if (typeof payload.weatherIndex === 'number') {
        setWeatherByIndex(payload.weatherIndex, false);
      }
      updateAnchorsOverlay();
    } else if (type === 'SELECT_STORE') {
      const sSlot = slotOf(payload.storeId);
      if (sSlot != null) select(sSlot, true);
    } else if (type === 'OPEN_STORE') {
      openStoreCatalogById(payload.storeId);
    } else if (type === 'CLOSE_STORE') {
      closeActiveStoreCatalog();
    } else if (type === 'SET_CARD_CLOSED') {
      setCardClosed(Boolean(payload.closed), false);
    } else if (type === 'SET_TIME_OF_DAY') {
      if (typeof payload.hour === 'number') {
        daytime = payload.hour;
        if ($('daytime')) $('daytime').value = String(daytime);
        cozyAudio.setTimeOfDay(daytime);
        updateHubWeatherAndClock(daytime);
      }
    }
  } finally {
    suppressUnityEcho = false;
  }
}

window.CerriaUnityOverlay = Object.freeze({
  updateScreenAnchors(anchorsMap) {
    handleUnityCommand({ type: 'UPDATE_ANCHORS', payload: { anchors: anchorsMap } });
  },
  onUnityState(stateObj) {
    handleUnityCommand({ type: 'SYNC_UNITY_STATE', payload: stateObj });
  },
  selectStore(storeId, options = {}) {
    suppressUnityEcho = Boolean(options.silent);
    try {
      const sSlot = slotOf(storeId);
      if (sSlot != null) select(sSlot, true);
      if (options.cardClosed !== undefined) setCardClosed(Boolean(options.cardClosed), false);
    } finally {
      suppressUnityEcho = false;
    }
  },
  setCardClosed(closed) {
    setCardClosed(Boolean(closed), false);
  },
  setSettingsOpen(open) {
    setSettingsOpen(Boolean(open));
  },
  setGuideOpen(open) {
    if (open) infoModal?.showModal();
    else infoModal?.close();
  },
  openStoreCatalog: openStoreCatalogById,
  closeStoreCatalog: closeActiveStoreCatalog,
  setTimeOfDay(hour) {
    daytime = Number(hour) || 20.5;
    if ($('daytime')) $('daytime').value = String(daytime);
    cozyAudio.setTimeOfDay(daytime);
    updateHubWeatherAndClock(daytime);
  },
  getState() {
    const d = BUILDINGS_DATA[selected];
    return {
      selectedStoreId: d?.id || 'toko1',
      selectedSlot: selected,
      storeNumber: storeNumber(d?.id || 'toko1'),
      cardClosed,
      activeStoreModalId: activeStoreId,
      daytime,
      cityLightMult,
      cycleOn,
      paused,
      timeScale,
      dofEnabled,
      shutter,
      leftNeighborStoreId: BUILDINGS_DATA[leftNeighborIdx]?.id,
      rightNeighborStoreId: BUILDINGS_DATA[rightNeighborIdx]?.id
    };
  },
  getInteractiveHitMap() {
    const selectors = [
      { id: 'brand-home', action: 'SELECT_STORE:toko1' },
      { id: 'prev', action: 'STEP_PREV' },
      { id: 'next', action: 'STEP_NEXT' },
      { id: 'speech', action: 'OPEN_ACTIVE_STORE' },
      { id: 'tag-left', action: 'SELECT_LEFT_NEIGHBOR' },
      { id: 'tag-right', action: 'SELECT_RIGHT_NEIGHBOR' },
      { id: 'close-card', action: 'CLOSE_DETAILS_CARD' },
      { id: 'reopen-card', action: 'OPEN_DETAILS_CARD' },
      { id: 'open-module', action: 'OPEN_ACTIVE_STORE' },
      { id: 'cozy-music-toggle', action: 'TOGGLE_RADIO' },
      { id: 'cozy-mood-tag', action: 'CYCLE_TIME_OF_DAY' },
      { id: 'cozy-hub-weather', action: 'CYCLE_WEATHER' },
      { id: 'cozy-settings-btn', action: 'TOGGLE_SETTINGS' },
      { id: 'about', action: 'OPEN_GUIDE' },
      { id: 'cozy-open-guide-btn', action: 'OPEN_GUIDE' },
      // Controls inside #cozy-settings-popover (active when settings popover is open)
      { id: 'cozy-settings-close', action: 'CLOSE_SETTINGS' },
      { id: 'cozy-mute-btn', action: 'TOGGLE_MUTE' },
      { id: 'cozy-music-vol', action: 'SLIDER_MUSIC_VOL' },
      { id: 'city-lights', action: 'SLIDER_CITY_LIGHTS' },
      { id: 'speed', action: 'CYCLE_SPEED' },
      { id: 'pause', action: 'TOGGLE_PAUSE' },
      { selector: '.cozy-spd-opt[data-speed-idx="0"]', id: 'spd-0', action: 'SET_SPEED:0' },
      { selector: '.cozy-spd-opt[data-speed-idx="1"]', id: 'spd-1', action: 'SET_SPEED:1' },
      { selector: '.cozy-spd-opt[data-speed-idx="2"]', id: 'spd-2', action: 'SET_SPEED:2' },
      { selector: '.cozy-spd-opt[data-speed-idx="3"]', id: 'spd-3', action: 'SET_SPEED:3' },
      { selector: 'label:has(#cycle)', id: 'cycle-chip', action: 'TOGGLE_AUTO_CYCLE' },
      { id: 'daytime', action: 'SLIDER_DAYTIME' },
      { id: 'cozy-weather-clear', action: 'SET_WEATHER:clear' },
      { id: 'cozy-weather-rain', action: 'SET_WEATHER:rain' },
      { id: 'cozy-weather-fog', action: 'SET_WEATHER:fog' },
      { selector: 'label:has(#dof)', id: 'dof-chip', action: 'TOGGLE_DOF' },
      { id: 'shutter', action: 'SLIDER_SHUTTER' }
    ];
    const w = window.innerWidth || 1920;
    const h = window.innerHeight || 1080;
    const rects = [];
    for (const item of selectors) {
      const el = item.selector ? document.querySelector(item.selector) : document.getElementById(item.id);
      if (!el) continue;
      const cs = window.getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) continue;
      // Also check if an ancestor like #cozy-settings-popover is hidden
      const pop = el.closest('#cozy-settings-popover');
      if (pop && !pop.classList.contains('open')) continue;
      const r = el.getBoundingClientRect();
      if (r.width <= 2 || r.height <= 2) continue;
      rects.push({
        id: item.id,
        action: item.action,
        x: r.left / w,
        y: r.top / h,
        width: r.width / w,
        height: r.height / h,
        pxLeft: Math.round(r.left),
        pxTop: Math.round(r.top),
        pxWidth: Math.round(r.width),
        pxHeight: Math.round(r.height)
      });
    }
    return {
      viewportWidth: w,
      viewportHeight: h,
      rects
    };
  }
});

// Register with window.CerriaBridge
registerStoreHost({
  open: openStoreCatalogById,
  close: closeActiveStoreCatalog,
  activeStoreId: () => activeStoreId,
  currentStoreId: () => BUILDINGS_DATA[selected]?.id || 'toko1',
  onUnityCommand: handleUnityCommand
});

onStoresUpdated(() => {
  if (!isAnyStoreViewActive()) renderCard(selected);
});

window.addEventListener('resize', () => updateAnchorsOverlay());
window.addEventListener('hashchange', () => {
  const id = normalizeStoreId(location.hash);
  if (id) {
    const s = slotOf(id);
    if (s != null && s !== selected) select(s, true);
  }
});

// Initialize initial store from URL hash or default toko1
const initId = normalizeStoreId(location.hash) || 'toko1';
select(slotOf(initId) ?? slotOf('toko1'), true);
updateAnchorsOverlay();
