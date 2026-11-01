// ============================================================================
// CERRIA TOWN — STANDALONE STORE UI RUNTIME  (`/?ui_only=true#toko1`)
// ----------------------------------------------------------------------------
// For the Hybrid Unity In-App WebView: Unity already renders the 3D town, so
// this runtime renders ONLY the store catalog overlays on a transparent page.
//
//   • No WebGLRenderer / WebGL context is ever created (city, product showcase
//     and Member Card renderers are all bypassed — see js/ui-mode.js).
//   • No town meshes are built and no requestAnimationFrame render loop runs.
//   • The store controllers receive a CPU-only stand-in camera / controls /
//     building list, so their camera choreography code runs harmlessly while
//     the overlay DOM (identical markup & CSS to the 3D site) is shown.
// ============================================================================
import * as THREE from 'three'; // math classes only (Vector3 / PerspectiveCamera / Group) — no renderer
import { STORE_IDS, STORE_SLOT, normalizeStoreId } from '../store_ids.js?v=124';
import { createStrawberryCornerSystem } from '../strawberry_corner.js?v=128';
import { createAtelierBoutiqueSystem } from '../atelier_boutique.js?v=128';
import { createGlowStudioSystem } from '../glow_studio.js?v=128';
import { createMayorOfficeSystem } from '../mayor_office.js?v=124';
import { createTownStores3DSystem } from '../town_stores_3d.js?v=128';
import { registerStoreHost, notifyStoreOpened, notifyStoreClosed } from './unity-bridge.js?v=124';

document.documentElement.classList.add('ui-only');
document.getElementById('loading')?.remove();

// --- CPU-only stand-ins for the 3D town objects the store controllers expect ---
const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 1, 260);
const controls = {
  target: new THREE.Vector3(),
  enabled: false,
  update() {}
};
const stores = [];
STORE_IDS.forEach(id => {
  stores[STORE_SLOT[id]] = { id, g: new THREE.Group() };
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

const base = { camera, controls, stores, chime };
const strawberryCorner = createStrawberryCornerSystem({ ...base, slotAngle: () => 0 });
const glowStudio = createGlowStudioSystem(base);
const atelierBoutique = createAtelierBoutiqueSystem(base);
const mayorOffice = createMayorOfficeSystem(base);
const townStores3D = createTownStores3DSystem(base);

// Permanent store ID → catalog controller (same wiring as the 3D runtime)
const STORE_CONTROLLERS = {
  toko1: { ctl: glowStudio },
  toko2: { ctl: townStores3D, key: 'toko2' },
  toko3: { ctl: atelierBoutique },
  toko4: { ctl: townStores3D, key: 'toko4' },
  toko5: { ctl: strawberryCorner },
  toko6: { ctl: townStores3D, key: 'toko6' },
  toko7: { ctl: mayorOffice }
};

let activeId = null;
let switching = false; // suppress CLOSE_STORE while swapping one store for another

function closeActive() {
  if (!activeId) return false;
  const { ctl } = STORE_CONTROLLERS[activeId];
  if (ctl.isActive) ctl.exit();
  return true;
}

function openStore(id) {
  const entry = STORE_CONTROLLERS[id];
  if (!entry) return false;
  if (activeId === id && entry.ctl.isActive) return true;
  switching = true;
  closeActive();
  switching = false;
  activeId = id;
  const onExit = () => {
    const closedId = activeId;
    activeId = null;
    document.documentElement.classList.remove('ui-only-store-open');
    if (!switching) notifyStoreClosed(closedId);
  };
  document.documentElement.classList.add('ui-only-store-open');
  if (entry.key) entry.ctl.enter(entry.key, onExit);
  else entry.ctl.enter(onExit);
  notifyStoreOpened(id);
  return true;
}

registerStoreHost({
  open: openStore,
  close: closeActive,
  activeStoreId: () => activeId,
  currentStoreId: () => activeId || normalizeStoreId(location.hash)
});

// Open the store named by the URL hash (canonical #toko1–#toko7 or a legacy alias); default toko1.
openStore(normalizeStoreId(location.hash) || 'toko1');

addEventListener('hashchange', () => {
  const id = normalizeStoreId(location.hash);
  if (id && id !== activeId) openStore(id);
});
