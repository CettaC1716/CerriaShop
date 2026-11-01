import * as THREE from 'three';
import { normalizeStoreId, STORE_SLOT } from './store_ids.js?v=124';
import { storeCatalog, submitOrder } from './js/store-data-manager.js?v=124';
import { UI_ONLY, mountStaticProductArt } from './js/ui-mode.js?v=124';
import { renderCerriaCheckoutStage, bindCerriaCheckoutEvents } from './cerria_checkout.js?v=128';
import { attachCustomModel3DToGroup } from './js/custom-model-loader.js?v=1';

// ============================================================================
// UNIFIED 3D STORE CATALOG & CAMERA CHOREOGRAPHY FOR:
// - toko2: Cozy Bites & Sips (Bakery & Coffee, lot 1 → stores[1])
// - toko4: Circuit & Byte (Tech, Audio & Gaming, lot 3 → stores[3])
// - toko6: Apex Sport (Pro Gear & Tennis Club, lot 4 → stores[4])
// Config keys are PERMANENT store IDs (see store_ids.js); display text may change freely.
// 100% Identical 2-State / 5-Tab Flow to Strawberry Corner:
// - State 1 (HOME): Full isolated 3D building exterior centered at 3/4 Isometric View
// - State 2 (PRODUCT_3D / MENU_GRID / SPECIALS / MY_BAG): Building shrinks to
//   Bottom-Left Corner via camera.setViewOffset + 360° Rotatable 3D Product Showcase
// ============================================================================

const formatIDR = n => 'Rp ' + Math.round(n).toLocaleString('id-ID');

// Display data lives in /data/stores-data.json (toko2/toko4/toko6 .catalog) — live, SWR-refreshed references.
// `storeIdx` (physical 3D lot) is system wiring derived from STORE_SLOT; it is non-enumerable so JSON refreshes never touch it.
export const TOWN_STORE_CONFIGS = Object.fromEntries(
  ['toko2', 'toko4', 'toko6'].map(id => {
    const cfg = storeCatalog(id);
    Object.defineProperty(cfg, 'storeIdx', { value: STORE_SLOT[id], enumerable: false, writable: false });
    return [id, cfg];
  })
);

export function townStoreProductSVG(id, primaryHex = '#D4842A', accentHex = '#6E462A') {
  switch (id) {
    case 'croissant':
      return `<svg viewBox="0 0 120 120" fill="none"><circle cx="60" cy="60" r="46" fill="#FDF5E8"/><ellipse cx="60" cy="76" rx="38" ry="12" fill="#FFFDF9" stroke="#4A3424" stroke-width="2"/><path d="M28 66c4-18 18-28 32-28s28 10 32 28c-8 6-16 2-20-6-4-6-8-8-12-8s-8 2-12 8c-4 8-12 12-20 6z" fill="${primaryHex}" stroke="#4A3424" stroke-width="2.4"/><path d="M44 42c6 8 26 8 32 0M36 52c8 8 40 8 48 0" stroke="${accentHex}" stroke-width="2" stroke-linecap="round"/></svg>`;
    case 'caramellatte':
      return `<svg viewBox="0 0 120 120" fill="none"><circle cx="60" cy="60" r="46" fill="#FDF5E8"/><path d="M40 38h40l-5 52H45l-5-52z" fill="${accentHex}" stroke="#4A3424" stroke-width="2.2"/><path d="M40 38h40l-1.8 20H41.8L40 38z" fill="${primaryHex}"/><path d="M44 58q8 8 16 0t16 0" stroke="${primaryHex}" stroke-width="3" fill="none"/><rect x="46" y="42" width="10" height="9" rx="2" fill="#FFFDF9" opacity="0.85"/><rect x="62" y="45" width="10" height="9" rx="2" fill="#FFFDF9" opacity="0.85"/><line x1="68" y1="22" x2="56" y2="82" stroke="#8C5832" stroke-width="3.8" stroke-linecap="round"/></svg>`;
    case 'espresso':
      return `<svg viewBox="0 0 120 120" fill="none"><circle cx="60" cy="60" r="46" fill="#FDF5E8"/><ellipse cx="58" cy="84" rx="34" ry="8" fill="${accentHex}" opacity="0.35"/><path d="M36 46h42v22c0 12-9 20-21 20s-21-8-21-20V46z" fill="${primaryHex}" stroke="#4A3424" stroke-width="2.4"/><path d="M78 52h8a7 7 0 0 1 0 14h-8" stroke="#4A3424" stroke-width="2.4"/><ellipse cx="57" cy="46" rx="21" ry="6" fill="#6E3F22" stroke="#4A3424" stroke-width="2"/><circle cx="57" cy="46" r="6" fill="#FAF3E4"/></svg>`;
    case 'sourdough':
      return `<svg viewBox="0 0 120 120" fill="none"><circle cx="60" cy="60" r="46" fill="#FDF5E8"/><rect x="36" y="30" width="12" height="38" rx="6" transform="rotate(-14 36 30)" fill="${accentHex}" stroke="#4A3424" stroke-width="2"/><rect x="64" y="28" width="12" height="38" rx="6" transform="rotate(14 64 28)" fill="${accentHex}" stroke="#4A3424" stroke-width="2"/><path d="M30 70c0-18 13-28 30-28s30 10 30 28H30z" fill="${primaryHex}" stroke="#4A3424" stroke-width="2.4"/><path d="M24 68h72l-6 18H30l-6-18z" fill="#C69F76" stroke="#4A3424" stroke-width="2.2"/></svg>`;
    case 'sandwich':
      return `<svg viewBox="0 0 120 120" fill="none"><circle cx="60" cy="60" r="46" fill="#FDF5E8"/><rect x="24" y="64" width="72" height="22" rx="5" fill="#C69F76" stroke="#4A3424" stroke-width="2.2"/><polygon points="30,64 60,34 90,64" fill="${primaryHex}" stroke="#4A3424" stroke-width="2.4"/><path d="M34 62q13-6 26 0t26 0" stroke="${accentHex}" stroke-width="4.5" stroke-linecap="round"/><path d="M38 56h44" stroke="#F4C44E" stroke-width="4" stroke-linecap="round"/></svg>`;
    case 'pastrybox':
      return `<svg viewBox="0 0 120 120" fill="none"><circle cx="60" cy="60" r="46" fill="#FDF5E8"/><rect x="28" y="42" width="64" height="44" rx="6" fill="${primaryHex}" stroke="#4A3424" stroke-width="2.4"/><line x1="60" y1="42" x2="60" y2="86" stroke="${accentHex}" stroke-width="4"/><line x1="28" y1="64" x2="92" y2="64" stroke="${accentHex}" stroke-width="4"/><circle cx="60" cy="40" r="7" fill="${accentHex}"/></svg>`;
    case 'controller':
      return `<svg viewBox="0 0 120 120" fill="none"><circle cx="60" cy="60" r="46" fill="#EBF4FA"/><path d="M36 44h48c12 0 18 14 16 32-2 10-10 12-16 4l-6-10H42l-6 10c-6 8-14 6-16-4-2-18 4-32 16-32z" fill="${primaryHex}" stroke="#1E242C" stroke-width="2.6"/><path d="M40 52v12M34 58h12" stroke="${accentHex}" stroke-width="3.2" stroke-linecap="round"/><circle cx="78" cy="54" r="3.5" fill="${accentHex}"/><circle cx="85" cy="60" r="3.5" fill="#FF3399"/><circle cx="71" cy="60" r="3.5" fill="#00F0FF"/><circle cx="50" cy="64" r="5" fill="#1E242C" stroke="${accentHex}" stroke-width="2"/><circle cx="68" cy="64" r="5" fill="#1E242C" stroke="${accentHex}" stroke-width="2"/></svg>`;
    case 'headphones':
      return `<svg viewBox="0 0 120 120" fill="none"><circle cx="60" cy="60" r="46" fill="#EBF4FA"/><line x1="60" y1="36" x2="60" y2="90" stroke="#9AA6B2" stroke-width="4"/><rect x="44" y="88" width="32" height="6" rx="3" fill="#242830"/><path d="M32 62V52a28 28 0 0 1 56 0v10" stroke="${primaryHex}" stroke-width="6.5" stroke-linecap="round"/><rect x="24" y="54" width="14" height="26" rx="7" fill="${primaryHex}" stroke="${accentHex}" stroke-width="2.4"/><rect x="82" y="54" width="14" height="26" rx="7" fill="${primaryHex}" stroke="${accentHex}" stroke-width="2.4"/></svg>`;
    case 'laptop':
      return `<svg viewBox="0 0 120 120" fill="none"><circle cx="60" cy="60" r="46" fill="#EBF4FA"/><rect x="28" y="34" width="64" height="42" rx="4" fill="#1E242C" stroke="${primaryHex}" stroke-width="2.6"/><rect x="32" y="38" width="56" height="34" rx="2" fill="${accentHex}" opacity="0.85"/><path d="M20 76h80l-6 8H26l-6-8z" fill="${primaryHex}" stroke="#1E242C" stroke-width="2.2"/></svg>`;
    case 'smartphone':
      return `<svg viewBox="0 0 120 120" fill="none"><circle cx="60" cy="60" r="46" fill="#EBF4FA"/><rect x="38" y="22" width="44" height="76" rx="8" fill="${primaryHex}" stroke="#1E242C" stroke-width="2.6"/><rect x="42" y="27" width="36" height="66" rx="5" fill="${accentHex}" opacity="0.88"/><rect x="52" y="30" width="16" height="4" rx="2" fill="#1E242C"/></svg>`;
    case 'earbuds':
      return `<svg viewBox="0 0 120 120" fill="none"><circle cx="60" cy="60" r="46" fill="#EBF4FA"/><rect x="32" y="54" width="56" height="36" rx="16" fill="${primaryHex}" stroke="#1E242C" stroke-width="2.6"/><line x1="34" y1="68" x2="86" y2="68" stroke="${accentHex}" stroke-width="3"/><circle cx="46" cy="40" r="9" fill="${primaryHex}" stroke="${accentHex}" stroke-width="2.4"/><rect x="48" y="44" width="6" height="14" rx="3" fill="${primaryHex}" stroke="#1E242C" stroke-width="2"/><circle cx="74" cy="40" r="9" fill="${primaryHex}" stroke="${accentHex}" stroke-width="2.4"/><rect x="66" y="44" width="6" height="14" rx="3" fill="${primaryHex}" stroke="#1E242C" stroke-width="2"/></svg>`;
    case 'speakers':
      return `<svg viewBox="0 0 120 120" fill="none"><circle cx="60" cy="60" r="46" fill="#EBF4FA"/><rect x="26" y="32" width="30" height="56" rx="4" fill="${primaryHex}" stroke="#1E242C" stroke-width="2.4"/><circle cx="41" cy="46" r="5" fill="${accentHex}"/><circle cx="41" cy="68" r="10" fill="${accentHex}" stroke="#CFD8E2" stroke-width="2"/><rect x="64" y="32" width="30" height="56" rx="4" fill="${primaryHex}" stroke="#1E242C" stroke-width="2.4"/><circle cx="79" cy="46" r="5" fill="${accentHex}"/><circle cx="79" cy="68" r="10" fill="${accentHex}" stroke="#CFD8E2" stroke-width="2"/></svg>`;
    case 'racket':
      return `<svg viewBox="0 0 120 120" fill="none"><circle cx="60" cy="60" r="46" fill="#EEF4FA"/><ellipse cx="52" cy="46" rx="22" ry="26" fill="#FAF6F0" stroke="${primaryHex}" stroke-width="5"/><line x1="40" y1="36" x2="64" y2="36" stroke="#B8C4D0" stroke-width="1.5"/><line x1="36" y1="46" x2="68" y2="46" stroke="#B8C4D0" stroke-width="1.5"/><line x1="40" y1="56" x2="64" y2="56" stroke="#B8C4D0" stroke-width="1.5"/><line x1="52" y1="22" x2="52" y2="70" stroke="#B8C4D0" stroke-width="1.5"/><line x1="52" y1="72" x2="78" y2="96" stroke="${accentHex}" stroke-width="6.5" stroke-linecap="round"/><circle cx="78" cy="66" r="9.5" fill="#D8EE36" stroke="#283038" stroke-width="2.2"/></svg>`;
    case 'shoes':
      return `<svg viewBox="0 0 120 120" fill="none"><circle cx="60" cy="60" r="46" fill="#EEF4FA"/><rect x="28" y="76" width="64" height="14" rx="2" fill="#FFFFFF" stroke="#283038" stroke-width="2"/><path d="M26 70c0-4 4-8 10-8h10l12-16 14 6c10 4 18 8 20 18H26z" fill="${primaryHex}" stroke="#283038" stroke-width="2.4"/><path d="M40 66l24-8-6 10-18-2z" fill="${accentHex}"/><rect x="24" y="70" width="70" height="7" rx="3.5" fill="#FFFDF9" stroke="#283038" stroke-width="2"/></svg>`;
    case 'basketball':
      return `<svg viewBox="0 0 120 120" fill="none"><circle cx="60" cy="60" r="46" fill="#EEF4FA"/><circle cx="60" cy="60" r="30" fill="${primaryHex}" stroke="${accentHex}" stroke-width="2.8"/><line x1="30" y1="60" x2="90" y2="60" stroke="${accentHex}" stroke-width="2.6"/><line x1="60" y1="30" x2="60" y2="90" stroke="${accentHex}" stroke-width="2.6"/><path d="M39 39c10 10 10 32 0 42M81 39c-10 10-10 32 0 42" stroke="${accentHex}" stroke-width="2.6" fill="none"/></svg>`;
    case 'tennisballs':
      return `<svg viewBox="0 0 120 120" fill="none"><circle cx="60" cy="60" r="46" fill="#EEF4FA"/><rect x="42" y="24" width="36" height="72" rx="8" fill="#E6F2FA" stroke="${accentHex}" stroke-width="2.5"/><rect x="40" y="22" width="40" height="8" rx="3" fill="${accentHex}"/><circle cx="60" cy="41" r="10" fill="${primaryHex}" stroke="#283038" stroke-width="2"/><circle cx="60" cy="61" r="10" fill="${primaryHex}" stroke="#283038" stroke-width="2"/><circle cx="60" cy="81" r="10" fill="${primaryHex}" stroke="#283038" stroke-width="2"/></svg>`;
    case 'tennisbag':
      return `<svg viewBox="0 0 120 120" fill="none"><circle cx="60" cy="60" r="46" fill="#EEF4FA"/><rect x="24" y="48" width="72" height="38" rx="12" fill="${primaryHex}" stroke="#283038" stroke-width="2.4"/><polygon points="48,48 64,48 56,86 40,86" fill="${accentHex}"/><path d="M44 48V38a16 16 0 0 1 32 0v10" stroke="#283038" stroke-width="3.5"/></svg>`;
    case 'dumbbell':
      return `<svg viewBox="0 0 120 120" fill="none"><circle cx="60" cy="60" r="46" fill="#EEF4FA"/><rect x="30" y="57" width="60" height="7" rx="3" fill="#B8C2CC" stroke="#283038" stroke-width="2"/><rect x="22" y="42" width="10" height="36" rx="3" fill="${primaryHex}" stroke="#283038" stroke-width="2.2"/><rect x="32" y="46" width="8" height="28" rx="2" fill="${accentHex}" stroke="#283038" stroke-width="2"/><rect x="88" y="42" width="10" height="36" rx="3" fill="${primaryHex}" stroke="#283038" stroke-width="2.2"/><rect x="80" y="46" width="8" height="28" rx="2" fill="${accentHex}" stroke="#283038" stroke-width="2"/></svg>`;
    default:
      return `<svg viewBox="0 0 120 120" fill="none"><circle cx="60" cy="60" r="46" fill="#FDF3EE"/><polygon points="44,32 76,32 86,58 34,58" fill="${primaryHex}" stroke="#3A2820" stroke-width="2.2"/><line x1="60" y1="58" x2="60" y2="86" stroke="${accentHex}" stroke-width="4"/><rect x="42" y="86" width="36" height="8" rx="4" fill="${accentHex}" stroke="#3A2820" stroke-width="2"/></svg>`;
  }
}

// ============================================================================
// PROCEDURAL 3D PRODUCT BUILDER FOR toko2, toko4 & toko6 (360° ROTATABLE)
// ============================================================================
export function buildTownStore3DProduct(itemId, primaryHex = '#D4842A', accentHex = '#6E462A') {
  const group = new THREE.Group();

  const matPrimary = new THREE.MeshStandardMaterial({ color: primaryHex, roughness: 0.42, metalness: 0.14 });
  const matAccent = new THREE.MeshStandardMaterial({ color: accentHex, roughness: 0.45, metalness: 0.18 });
  const matGold = new THREE.MeshStandardMaterial({ color: '#E2B458', roughness: 0.26, metalness: 0.78 });
  const matWood = new THREE.MeshStandardMaterial({ color: '#8C5B38', roughness: 0.68, metalness: 0.08 });
  const matWoodLight = new THREE.MeshStandardMaterial({ color: '#C89862', roughness: 0.64, metalness: 0.06 });
  const matCream = new THREE.MeshStandardMaterial({ color: '#FAF3E8', roughness: 0.45, metalness: 0.05 });
  const matDark = new THREE.MeshStandardMaterial({ color: '#282C30', roughness: 0.42, metalness: 0.35 });
  const matGlass = new THREE.MeshStandardMaterial({
    color: '#EAF6FC',
    roughness: 0.12,
    metalness: 0.15,
    transparent: true,
    opacity: 0.56
  });
  const matGlow = new THREE.MeshStandardMaterial({
    color: '#FFF6E0',
    emissive: '#FFD27D',
    emissiveIntensity: 1.15,
    roughness: 0.2
  });

  group.userData.matPrimary = matPrimary;
  group.userData.matAccent = matAccent;

  // Shared Studio Display Pedestal
  const baseDisc = new THREE.Mesh(new THREE.CylinderGeometry(1.12, 1.20, 0.12, 36), matCream);
  baseDisc.position.y = -1.02;
  const baseRim = new THREE.Mesh(new THREE.TorusGeometry(1.14, 0.026, 12, 48), matGold);
  baseRim.rotation.x = Math.PI / 2;
  baseRim.position.y = -0.96;
  group.add(baseDisc, baseRim);

  // --- STORE #2: COZY BITES & SIPS ---
  if (itemId === 'croissant') {
    // Ceramic plate
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.96, 0.78, 0.09, 32), matCream);
    plate.position.y = -0.90;
    group.add(plate);
    // Layered crescent segments of the 3D Butter Croissant
    const segs = [
      { ang: 0, r: 0.34, len: 0.38, x: 0, z: 0.10, y: -0.56 },
      { ang: 0.45, r: 0.28, len: 0.34, x: -0.32, z: 0.02, y: -0.58 },
      { ang: -0.45, r: 0.28, len: 0.34, x: 0.32, z: 0.02, y: -0.58 },
      { ang: 0.92, r: 0.20, len: 0.30, x: -0.56, z: -0.18, y: -0.62 },
      { ang: -0.92, r: 0.20, len: 0.30, x: 0.56, z: -0.18, y: -0.62 },
      { ang: 1.35, r: 0.13, len: 0.24, x: -0.66, z: -0.40, y: -0.66 },
      { ang: -1.35, r: 0.13, len: 0.24, x: 0.66, z: -0.40, y: -0.66 }
    ];
    for (const s of segs) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(s.r, 20, 16), matPrimary);
      m.scale.set(1.25, 0.85, 0.95);
      m.position.set(s.x, s.y + 0.32, s.z);
      m.rotation.y = s.ang;
      group.add(m);
    }
    // Small butter curl & jam ramekin on side of plate
    const ramekin = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.17, 0.16, 20), matCream);
    ramekin.position.set(0.0, -0.78, -0.48);
    const jam = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.04, 20), matAccent);
    jam.position.set(0.0, -0.70, -0.48);
    group.add(ramekin, jam);
  } else if (itemId === 'espresso') {
    // Saucer
    const saucer = new THREE.Mesh(new THREE.CylinderGeometry(0.84, 0.62, 0.08, 32), matAccent);
    saucer.position.y = -0.88;
    // Espresso Cup Body
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.38, 0.78, 32), matPrimary);
    cup.position.y = -0.46;
    // Rich Crema & Rosetta Latte Art
    const crema = new THREE.Mesh(new THREE.CylinderGeometry(0.49, 0.49, 0.04, 32), new THREE.MeshStandardMaterial({ color: '#6E3F22', roughness: 0.35 }));
    crema.position.y = -0.08;
    const heart = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 12), matCream);
    heart.scale.set(1.2, 0.18, 1.0);
    heart.position.set(0, -0.06, 0);
    // Cup Handle & Brass Spoon
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.048, 12, 24, Math.PI), matPrimary);
    handle.rotation.z = -Math.PI / 2;
    handle.position.set(0.48, -0.44, 0);
    const spoon = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.025, 0.06), matGold);
    spoon.position.set(0.12, -0.82, 0.42);
    spoon.rotation.y = 0.28;
    group.add(saucer, cup, crema, heart, handle, spoon);
  } else if (itemId === 'sourdough') {
    // Woven Bakery Basket + Sourdough Boule + 2 Upright Golden Baguettes
    const basketBottom = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.64, 0.34, 28), matWoodLight);
    basketBottom.position.y = -0.76;
    const basketRim = new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.045, 12, 36), matWood);
    basketRim.rotation.x = Math.PI / 2;
    basketRim.position.y = -0.59;
    // Linen napkin lining inside basket
    const liner = new THREE.Mesh(new THREE.CylinderGeometry(0.76, 0.60, 0.12, 24), matCream);
    liner.position.y = -0.58;
    // Artisan Sourdough Boule (dome) in front of basket
    const boule = new THREE.Mesh(new THREE.SphereGeometry(0.50, 26, 18, 0, Math.PI * 2, 0, Math.PI * 0.58), matPrimary);
    boule.scale.set(1.15, 0.88, 0.96);
    boule.position.set(-0.14, -0.58, 0.14);
    for (const zOff of [-0.02, 0.24]) {
      const score = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.05, 0.06), matCream);
      score.position.set(-0.14, -0.15, zOff);
      score.rotation.y = 0.15;
      group.add(score);
    }
    // 2 Upright Golden French Baguettes leaning in the basket
    for (const [bx, bz, rz, rx] of [
      [0.24, -0.14, -0.26, -0.15],
      [0.44, 0.08, -0.38, 0.12]
    ]) {
      const bag = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.78, 12, 18), matAccent);
      bag.position.set(bx, -0.16, bz);
      bag.rotation.set(rx, 0, rz);
      group.add(bag);
    }
    group.add(basketBottom, basketRim, liner, boule);
  } else if (itemId === 'caramellatte' || itemId === 'icedmatcha') {
    // Wooden Bistro Coaster
    const coaster = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.68, 0.06, 28), matWoodLight);
    coaster.position.y = -0.92;
    // Layered cold milk bottom + rich espresso & salted caramel top swirl
    const bottomLayer = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.41, 0.58, 28), matAccent);
    bottomLayer.position.y = -0.59;
    const topLayer = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.48, 0.56, 28), matPrimary);
    topLayer.position.y = -0.02;
    const caramelRing = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.028, 10, 32), new THREE.MeshStandardMaterial({ color: '#B86222', roughness: 0.28 }));
    caramelRing.rotation.x = Math.PI / 2;
    caramelRing.position.y = -0.28;
    const glassShell = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.43, 1.24, 28), matGlass);
    glassShell.position.y = -0.28;
    // Clear dome lid rim & ice cubes + striped straw
    const lidRim = new THREE.Mesh(new THREE.TorusGeometry(0.54, 0.024, 10, 32), matCream);
    lidRim.rotation.x = Math.PI / 2;
    lidRim.position.y = 0.33;
    for (const [ix, iz] of [[-0.15, 0.12], [0.16, -0.10], [0.02, 0.18], [-0.08, -0.14]]) {
      const ice = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.18), matCream);
      ice.position.set(ix, 0.26, iz);
      ice.rotation.set(0.25, 0.42, 0.12);
      group.add(ice);
    }
    const straw = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 1.48, 14), matWood);
    straw.position.set(0.18, 0.15, 0);
    straw.rotation.z = -0.18;
    group.add(coaster, bottomLayer, topLayer, caramelRing, glassShell, lidRim, straw);
  } else if (itemId === 'sandwich') {
    // Bistro Kraft Takeaway Box Base
    const boxBase = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.30, 1.18), matWoodLight);
    boxBase.position.y = -0.78;
    const napkin = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.04, 1.08), matCream);
    napkin.position.y = -0.62;
    // 2 Thick Gourmet Bistro Sandwich Halves (toasted sourdough bread, melted yellow cheese, greens & smoked filling)
    const matCheese = new THREE.MeshStandardMaterial({ color: '#F4C44E', roughness: 0.42 });
    const matTomato = new THREE.MeshStandardMaterial({ color: '#D94E3B', roughness: 0.45 });
    for (const [sx, sz, ry] of [
      [-0.30, 0.05, 0.18],
      [0.32, -0.05, -0.16]
    ]) {
      const swGrp = new THREE.Group();
      swGrp.position.set(sx, -0.36, sz);
      swGrp.rotation.y = ry;
      const breadBot = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.10, 0.72), matPrimary);
      breadBot.position.y = -0.16;
      const greens = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.06, 0.76), matAccent);
      greens.position.y = -0.08;
      const filling = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.09, 0.68), matWood);
      filling.position.y = -0.01;
      const cheese = new THREE.Mesh(new THREE.BoxGeometry(0.70, 0.04, 0.70), matCheese);
      cheese.position.y = 0.05;
      cheese.rotation.y = 0.08;
      const tomato = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.04, 18), matTomato);
      tomato.position.set(0, 0.08, 0.06);
      const breadTop = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.11, 0.72), matPrimary);
      breadTop.position.y = 0.15;
      // Wooden cocktail pick with olive on top
      const pick = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.52, 8), matWoodLight);
      pick.position.y = 0.16;
      const olive = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), matAccent);
      olive.position.y = 0.34;
      swGrp.add(breadBot, greens, filling, cheese, tomato, breadTop, pick, olive);
      group.add(swGrp);
    }
    group.add(boxBase, napkin);
  } else if (itemId === 'pastrybox') {
    // Gift box base
    const boxBase = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.48, 1.18), matPrimary);
    boxBase.position.y = -0.68;
    // Ribbon cross bands & bow on angled lid
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.12, 1.22), matPrimary);
    lid.position.set(0, -0.18, -0.32);
    lid.rotation.x = -0.42;
    const ribX = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.14, 0.14), matAccent);
    ribX.position.set(0, -0.18, -0.32);
    ribX.rotation.x = -0.42;
    // Assorted pastries inside the open box
    for (const [px, pz] of [[-0.36, 0.18], [0.36, 0.18], [-0.36, -0.18], [0.36, -0.18]]) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), matAccent);
      p.scale.set(1.2, 0.75, 0.9);
      p.position.set(px, -0.40, pz);
      group.add(p);
    }
    group.add(boxBase, lid, ribX);
  }

  // --- STORE #4: CIRCUIT & BYTE (3-STORY TECH & ELECTRONICS STORE) ---
  else if (itemId === 'controller') {
    // Magnetic Display Stand Cradle
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.46, 0.22, 24), matDark);
    stand.position.y = -0.85;
    const ledRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.41, 0.022, 10, 36),
      new THREE.MeshStandardMaterial({ color: accentHex, emissive: accentHex, emissiveIntensity: 0.85 })
    );
    ledRing.rotation.x = Math.PI / 2;
    ledRing.position.y = -0.75;
    group.add(stand, ledRing);

    // Ergonomic Pro Wireless Gaming Controller with Neon LED Accents
    const padGrp = new THREE.Group();
    padGrp.position.set(0, -0.18, 0);
    padGrp.rotation.x = -0.35;

    const matNeon = new THREE.MeshStandardMaterial({
      color: accentHex,
      emissive: accentHex,
      emissiveIntensity: 0.75,
      roughness: 0.25
    });
    group.userData.matAccent = matNeon;

    // Central bridge body + touchpad + neon lightbar
    const centerBody = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.46, 0.22), matPrimary);
    const touchPad = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.24, 0.235), matDark);
    touchPad.position.set(0, 0.09, 0.01);
    const neonBar = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.03, 0.24), matNeon);
    neonBar.position.set(0, 0.22, 0.01);
    padGrp.add(centerBody, touchPad, neonBar);

    // Left & Right Ergonomic Hand Grips + Shoulder Bumpers
    for (const sx of [-1, 1]) {
      const grip = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.48, 12, 18), matPrimary);
      grip.position.set(sx * 0.48, -0.14, 0.02);
      grip.rotation.z = sx * 0.34;
      const bumper = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.20), matDark);
      bumper.position.set(sx * 0.38, 0.25, -0.02);
      bumper.rotation.z = -sx * 0.18;
      padGrp.add(grip, bumper);
    }

    // Dual Hall-Effect Thumbsticks with Glowing Neon Rings
    for (const [tx, ty] of [
      [-0.20, -0.10],
      [0.20, -0.10]
    ]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.016, 10, 24), matNeon);
      ring.position.set(tx, ty, 0.115);
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.05, 0.12, 18), matDark);
      stick.rotation.x = Math.PI / 2;
      stick.position.set(tx, ty, 0.15);
      padGrp.add(ring, stick);
    }

    // Left D-Pad Cross
    const dpadH = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.055, 0.05), matDark);
    dpadH.position.set(-0.36, 0.06, 0.12);
    const dpadV = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.18, 0.05), matDark);
    dpadV.position.set(-0.36, 0.06, 0.12);
    padGrp.add(dpadH, dpadV);

    // Right 4 Action Buttons (A/B/X/Y)
    for (const [bx, by] of [
      [0.36, 0.13],
      [0.36, -0.01],
      [0.29, 0.06],
      [0.43, 0.06]
    ]) {
      const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.05, 14), matNeon);
      btn.rotation.x = Math.PI / 2;
      btn.position.set(bx, by, 0.12);
      padGrp.add(btn);
    }
    group.add(padGrp);
  } else if (itemId === 'headphones') {
    // Brushed Aluminum T-Bar Headphone Display Stand
    const standBase = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.50, 0.08, 28), matDark);
    standBase.position.y = -0.92;
    const standStem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 1.48, 18), matAccent);
    standStem.position.set(0, -0.18, -0.08);
    const standHanger = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.36, 16), matAccent);
    standHanger.rotation.x = Math.PI / 2;
    standHanger.position.set(0, 0.55, 0.04);
    group.add(standBase, standStem, standHanger);

    // Studio ANC Over-Ear Headphones (Arched Headband + Metallic Yokes + Padded Earcups)
    const hpGrp = new THREE.Group();
    hpGrp.position.set(0, 0.08, 0.06);
    const headband = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.055, 16, 36, Math.PI), matPrimary);
    headband.scale.set(0.95, 1.05, 1.2);
    const innerPad = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.035, 12, 32, Math.PI * 0.75), matDark);
    innerPad.rotation.z = Math.PI * 0.125;
    hpGrp.add(headband, innerPad);

    for (const sx of [-1, 1]) {
      // Metallic slider arm
      const slider = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.32, 12), matAccent);
      slider.position.set(sx * 0.44, -0.14, 0);
      // Outer metallic/matte earcup shell
      const cupOuter = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.14, 24), matPrimary);
      cupOuter.rotation.z = Math.PI / 2;
      cupOuter.scale.set(1.25, 1, 0.92);
      cupOuter.position.set(sx * 0.42, -0.32, 0);
      cupOuter.rotation.y = -sx * 0.12;
      // Brushed accent ring & plush memory-foam ear cushion
      const accentRing = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.022, 12, 28), matAccent);
      accentRing.rotation.y = Math.PI / 2;
      accentRing.scale.set(0.92, 1.25, 1);
      accentRing.position.set(sx * 0.48, -0.32, 0);
      const cushion = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.09, 24), matDark);
      cushion.rotation.z = Math.PI / 2;
      cushion.scale.set(1.25, 1, 0.92);
      cushion.position.set(sx * 0.33, -0.32, 0);
      hpGrp.add(slider, cupOuter, accentRing, cushion);
    }
    group.add(hpGrp);
  } else if (itemId === 'laptop') {
    // Sleek CNC Aluminum Ultrabook Pro 15" Laptop on Angled Desk Stand
    const riser = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.12, 0.68), matDark);
    riser.position.set(0, -0.88, -0.04);

    const lapGrp = new THREE.Group();
    lapGrp.position.set(0, -0.80, 0.02);

    // Base chassis + backlit keyboard well + glass trackpad
    const baseDeck = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.055, 0.98), matPrimary);
    baseDeck.position.set(0, 0.03, 0.10);
    const kbWell = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.018, 0.48), matDark);
    kbWell.position.set(0, 0.06, -0.02);
    const trackpad = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.012, 0.26), matDark);
    trackpad.position.set(0, 0.06, 0.38);

    // Hinged Open 15" OLED Display Lid + Glowing Wallpaper Screen
    const lidGrp = new THREE.Group();
    lidGrp.position.set(0, 0.06, -0.38);
    lidGrp.rotation.x = -0.24;

    const lidBack = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.96, 0.038), matPrimary);
    lidBack.position.set(0, 0.48, 0);
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.90, 0.015), matDark);
    bezel.position.set(0, 0.48, 0.02);
    const screenGlow = new THREE.Mesh(
      new THREE.BoxGeometry(1.34, 0.82, 0.012),
      new THREE.MeshStandardMaterial({
        color: accentHex,
        emissive: accentHex,
        emissiveIntensity: 0.65,
        roughness: 0.15
      })
    );
    screenGlow.position.set(0, 0.48, 0.028);
    group.userData.matAccent = screenGlow.material;
    // Floating UI window cards on the glowing laptop screen
    const uiCard1 = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.46, 0.008), matGlow);
    uiCard1.position.set(-0.30, 0.50, 0.036);
    const uiCard2 = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.28, 0.008), matCream);
    uiCard2.position.set(0.32, 0.56, 0.036);

    lidGrp.add(lidBack, bezel, screenGlow, uiCard1, uiCard2);
    lapGrp.add(baseDeck, kbWell, trackpad, lidGrp);
    group.add(riser, lapGrp);
  } else if (itemId === 'smartphone') {
    // Magnetic Charging Dock Pedestal
    const dockBase = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.50, 0.10, 28), matDark);
    dockBase.position.y = -0.90;
    const dockArm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.56, 0.12), matDark);
    dockArm.position.set(0, -0.64, -0.10);
    dockArm.rotation.x = -0.22;
    group.add(dockBase, dockArm);

    // Flagship 5G Smartphone (Bezel-less Glowing Display on Front + Triple-Lens Pro Camera on Back!)
    const phGrp = new THREE.Group();
    phGrp.position.set(0, -0.06, 0.04);
    phGrp.rotation.x = -0.18;

    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.76, 1.54, 0.10), matPrimary);
    // Front bezel & glowing AMOLED display + Dynamic Island pill
    const frontBezel = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.50, 0.015), matDark);
    frontBezel.position.z = 0.05;
    const display = new THREE.Mesh(
      new THREE.BoxGeometry(0.67, 1.44, 0.012),
      new THREE.MeshStandardMaterial({
        color: accentHex,
        emissive: accentHex,
        emissiveIntensity: 0.68,
        roughness: 0.14
      })
    );
    display.position.z = 0.058;
    group.userData.matAccent = display.material;
    const island = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.014), matDark);
    island.position.set(0, 0.64, 0.064);

    // Back Triple-Lens Pro Camera Island (clearly visible when rotated 360°!)
    const camPlateau = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.38, 0.035), matPrimary);
    camPlateau.position.set(-0.14, 0.48, -0.062);
    for (const [lx, ly] of [
      [-0.23, 0.57],
      [-0.23, 0.39],
      [-0.05, 0.48]
    ]) {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.032, 20), matGold);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(lx, ly, -0.082);
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.036, 18), matDark);
      lens.rotation.x = Math.PI / 2;
      lens.position.set(lx, ly, -0.085);
      phGrp.add(ring, lens);
    }

    phGrp.add(frame, frontBezel, display, island, camPlateau);
    group.add(phGrp);
  } else if (itemId === 'earbuds') {
    // SonicPulse TWS Earbuds inside an Open Wireless Charging Case
    const caseGrp = new THREE.Group();
    caseGrp.position.set(0, -0.44, 0);

    // Lower charging case body (rounded capsule-like box)
    const caseBody = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.42, 0.64, 28), matPrimary);
    caseBody.scale.set(1.38, 1, 0.76);
    caseBody.position.y = -0.12;
    const wellTop = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.04, 28), matDark);
    wellTop.scale.set(1.34, 1, 0.72);
    wellTop.position.y = 0.19;
    // Glowing Neon Cyan/Accent LED status bar on front of charging case
    const matLed = new THREE.MeshStandardMaterial({
      color: accentHex,
      emissive: accentHex,
      emissiveIntensity: 0.95,
      roughness: 0.2
    });
    group.userData.matAccent = matLed;
    const ledBar = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.045, 0.04), matLed);
    ledBar.position.set(0, -0.04, 0.34);

    // Hinged Open Top Lid tilted back
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.46, 0.34, 28), matPrimary);
    lid.scale.set(1.38, 1, 0.76);
    lid.position.set(0, 0.42, -0.26);
    lid.rotation.x = -0.78;

    // Left & Right Ergonomic TWS Earbuds hovering/nested above the open charging case
    for (const sx of [-1, 1]) {
      const budGrp = new THREE.Group();
      budGrp.position.set(sx * 0.26, 0.44, 0.04);
      budGrp.rotation.z = -sx * 0.18;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 22, 18), matPrimary);
      head.scale.set(1.15, 0.92, 0.88);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 14), matDark);
      tip.position.set(-sx * 0.14, 0.02, 0);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.044, 0.38, 16), matPrimary);
      stem.position.set(sx * 0.06, -0.20, 0);
      const neonRing = new THREE.Mesh(new THREE.TorusGeometry(0.054, 0.012, 8, 20), matLed);
      neonRing.rotation.x = Math.PI / 2;
      neonRing.position.set(sx * 0.06, -0.32, 0);
      budGrp.add(head, tip, stem, neonRing);
      caseGrp.add(budGrp);
    }

    caseGrp.add(caseBody, wellTop, ledBar, lid);
    group.add(caseGrp);
  } else if (itemId === 'speakers') {
    // Pair of Hi-Fi Bookshelf Studio Speakers (Left & Right Active Monitors on Acoustic Pads)
    for (const [sx, rotY] of [
      [-0.46, 0.18],
      [0.46, -0.18]
    ]) {
      const spk = new THREE.Group();
      spk.position.set(sx, -0.28, 0);
      spk.rotation.y = rotY;

      // Acoustic isolation base pad
      const isoPad = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.08, 0.58), matDark);
      isoPad.position.y = -0.64;
      // Wood/Primary Acoustic Cabinet + Matte Front Baffle
      const cabinet = new THREE.Mesh(new THREE.BoxGeometry(0.66, 1.18, 0.56), matPrimary);
      const baffle = new THREE.Mesh(new THREE.BoxGeometry(0.58, 1.10, 0.04), matAccent);
      baffle.position.z = 0.27;
      // Upper Silk-Dome Tweeter & Waveguide
      const tweeterRing = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.03, 24), matGold);
      tweeterRing.rotation.x = Math.PI / 2;
      tweeterRing.position.set(0, 0.30, 0.29);
      const tweeterDome = new THREE.Mesh(new THREE.SphereGeometry(0.065, 16, 12), matDark);
      tweeterDome.position.set(0, 0.30, 0.295);
      // Lower 5.5" Woven Kevlar/Metallic Woofer Cone & Dust Cap
      const wooferRim = new THREE.Mesh(new THREE.TorusGeometry(0.20, 0.024, 12, 32), matGold);
      wooferRim.position.set(0, -0.14, 0.29);
      const wooferCone = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.08, 0.06, 28), matCream);
      wooferCone.rotation.x = Math.PI / 2;
      wooferCone.position.set(0, -0.14, 0.28);
      const dustCap = new THREE.Mesh(new THREE.SphereGeometry(0.065, 16, 12), matDark);
      dustCap.position.set(0, -0.14, 0.295);
      // Bass reflex slot port at bottom
      const port = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.045, 0.05), matDark);
      port.position.set(0, -0.44, 0.28);

      spk.add(isoPad, cabinet, baffle, tweeterRing, tweeterDome, wooferRim, wooferCone, dustCap, port);
      group.add(spk);
    }
  }

  // --- toko6: APEX SPORT (PRO GEAR & TENNIS CLUB) ---
  else if (itemId === 'racket') {
    const rkGrp = new THREE.Group();
    rkGrp.rotation.z = -0.28;
    // Oval Graphite Racket Hoop + Accent V-Stripe
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.048, 14, 36), matPrimary);
    hoop.scale.set(0.84, 1.12, 1);
    hoop.position.y = 0.28;
    const hoopAccentL = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.26, 0.11), matAccent);
    hoopAccentL.position.set(-0.47, 0.28, 0);
    const hoopAccentR = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.26, 0.11), matAccent);
    hoopAccentR.position.set(0.47, 0.28, 0);
    // Woven Tennis String Grid inside Hoop
    const stringMat = new THREE.MeshBasicMaterial({ color: '#F5F0E4' });
    for (let i = -3; i <= 3; i++) {
      const vStr = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 1.16 * Math.sqrt(Math.max(0.1, 1 - (i / 4.2) ** 2)), 6), stringMat);
      vStr.position.set(i * 0.11, 0.28, 0);
      const hStr = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.88 * Math.sqrt(Math.max(0.1, 1 - (i / 4.2) ** 2)), 6), stringMat);
      hStr.rotation.z = Math.PI / 2;
      hStr.position.set(0, 0.28 + i * 0.14, 0);
      rkGrp.add(vStr, hStr);
    }
    // Split V-Throat & Perforated Pro Grip Handle
    for (const sx of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.030, 0.38, 12), matPrimary);
      arm.position.set(sx * 0.11, -0.44, 0);
      arm.rotation.z = sx * 0.28;
      rkGrp.add(arm);
    }
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.058, 0.54, 16), matAccent);
    handle.position.y = -0.82;
    const buttCap = new THREE.Mesh(new THREE.CylinderGeometry(0.064, 0.064, 0.06, 16), matDark);
    buttCap.position.y = -1.08;
    rkGrp.add(hoop, hoopAccentL, hoopAccentR, handle, buttCap);
    // 2 Optic Neon Yellow Tennis Balls on pedestal
    const ballMat = new THREE.MeshStandardMaterial({ color: '#D8EE36', roughness: 0.62 });
    const b1 = new THREE.Mesh(new THREE.SphereGeometry(0.15, 22, 18), ballMat);
    b1.position.set(0.52, -0.81, 0.28);
    const b2 = new THREE.Mesh(new THREE.SphereGeometry(0.15, 22, 18), ballMat);
    b2.position.set(0.22, -0.81, 0.48);
    group.add(rkGrp, b1, b2);
  } else if (itemId === 'shoes') {
    // White Storefront Display Cube Pedestal (matching the 3 white pedestals in Apex Sport window!)
    const whitePedMat = new THREE.MeshStandardMaterial({ color: '#F8F6F1', roughness: 0.42 });
    const pedBox = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.54, 0.96), whitePedMat);
    pedBox.position.y = -0.68;
    const pedStripe = new THREE.Mesh(new THREE.BoxGeometry(1.54, 0.06, 0.98), matAccent);
    pedStripe.position.y = -0.46;
    group.add(pedBox, pedStripe);

    // Pair of 3D AeroSprint Running Shoes on top of the White Pedestal
    const whiteMidsole = new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.35 });
    const buildShoe = (xOff, zOff, rotY, tiltZ) => {
      const sh = new THREE.Group();
      sh.position.set(xOff, -0.34, zOff);
      sh.rotation.y = rotY;
      sh.rotation.z = tiltZ;
      // Thick Nitro Foam Midsole + Carbon Outsole
      const outsole = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.06, 0.36), matDark);
      outsole.position.set(0, 0.03, 0);
      const midsole = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.14, 0.38), whiteMidsole);
      midsole.position.set(-0.02, 0.12, 0);
      const heelFlare = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.21, 0.14, 18), whiteMidsole);
      heelFlare.position.set(-0.42, 0.12, 0);
      // Engineered Mesh Upper + Toe Box
      const upper = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.24, 0.34), matPrimary);
      upper.position.set(-0.08, 0.28, 0);
      const toeBox = new THREE.Mesh(new THREE.SphereGeometry(0.18, 18, 14), matPrimary);
      toeBox.scale.set(1.55, 0.72, 0.96);
      toeBox.position.set(0.24, 0.22, 0);
      // Dynamic Diagonal Blaze-Orange Speed Swoosh & Heel Counter
      const swooshL = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.08, 0.36), matAccent);
      swooshL.position.set(-0.04, 0.27, 0);
      swooshL.rotation.z = 0.28;
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.16, 0.16, 16), matDark);
      collar.position.set(-0.26, 0.38, 0);
      // White Laces across vamp
      for (let l = 0; l < 4; l++) {
        const lace = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.03, 0.26), whiteMidsole);
        lace.position.set(0.02 + l * 0.075, 0.38 - l * 0.025, 0);
        sh.add(lace);
      }
      sh.add(outsole, midsole, heelFlare, upper, toeBox, swooshL, collar);
      return sh;
    };
    group.add(
      buildShoe(-0.12, 0.16, 0.18, 0.06),
      buildShoe(0.14, -0.20, -0.22, -0.04)
    );
  } else if (itemId === 'basketball') {
    // Black metal display ring cradle on pedestal
    const standRing = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.04, 14, 32), matDark);
    standRing.rotation.x = Math.PI / 2;
    standRing.position.y = -0.78;
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.22, 10), matDark);
      strut.position.set(Math.cos(a) * 0.36, -0.88, Math.sin(a) * 0.36);
      group.add(strut);
    }
    // Official Size-7 Composite Basketball with Deep Seam Channels
    const ballGrp = new THREE.Group();
    ballGrp.position.y = -0.18;
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.64, 36, 28), matPrimary);
    ballGrp.add(sphere);
    // Equatorial, meridian, and curved side seam channels
    const seam1 = new THREE.Mesh(new THREE.TorusGeometry(0.642, 0.016, 10, 48), matAccent);
    const seam2 = new THREE.Mesh(new THREE.TorusGeometry(0.642, 0.016, 10, 48), matAccent);
    seam2.rotation.x = Math.PI / 2;
    const seam3 = new THREE.Mesh(new THREE.TorusGeometry(0.642, 0.016, 10, 48), matAccent);
    seam3.rotation.y = Math.PI / 2;
    const seamSideL = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.015, 10, 40), matAccent);
    seamSideL.position.x = -0.42;
    seamSideL.rotation.y = Math.PI / 2;
    const seamSideR = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.015, 10, 40), matAccent);
    seamSideR.position.x = 0.42;
    seamSideR.rotation.y = Math.PI / 2;
    ballGrp.add(seam1, seam2, seam3, seamSideL, seamSideR);
    group.add(standRing, ballGrp);
  } else if (itemId === 'tennisballs') {
    // Pressurized Clear Cylinder Can + 3 Stacked Neon Tennis Balls inside + 1 Loose Ball beside it
    const canGrp = new THREE.Group();
    canGrp.position.set(-0.18, -0.16, 0);
    // Clear cylinder tube
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 1.52, 28), matGlass);
    const botRim = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.08, 28), matDark);
    botRim.position.y = -0.74;
    const lidCap = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.33, 0.12, 28), matAccent);
    lidCap.position.y = 0.76;
    const labelBand = new THREE.Mesh(new THREE.CylinderGeometry(0.326, 0.326, 0.38, 28), matAccent);
    labelBand.position.y = 0.05;
    canGrp.add(tube, botRim, lidCap, labelBand);

    // 3 Pressurized Tennis Balls stacked inside the tube
    for (const by of [-0.46, 0.02, 0.50]) {
      const tb = new THREE.Mesh(new THREE.SphereGeometry(0.26, 24, 18), matPrimary);
      tb.position.y = by;
      const seam = new THREE.Mesh(new THREE.TorusGeometry(0.262, 0.012, 8, 32), matCream);
      seam.position.y = by;
      seam.rotation.x = 0.65;
      canGrp.add(tb, seam);
    }
    // 1 Extra Tennis Ball resting on the pedestal next to the can
    const looseBall = new THREE.Mesh(new THREE.SphereGeometry(0.27, 24, 18), matPrimary);
    looseBall.position.set(0.46, -0.69, 0.22);
    const looseSeam = new THREE.Mesh(new THREE.TorusGeometry(0.272, 0.014, 8, 32), matCream);
    looseSeam.position.copy(looseBall.position);
    looseSeam.rotation.set(0.8, 0.4, 0);
    group.add(canGrp, looseBall, looseSeam);
  } else if (itemId === 'tennisbag') {
    // Pro Duffel & Racket Tour Bag Body
    const bagBody = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.42, 24), matPrimary);
    bagBody.rotation.z = Math.PI / 2;
    bagBody.scale.set(1, 1, 0.88);
    bagBody.position.y = -0.46;
    // Diagonal Sporty Accent Stripe Band & Ballistic Nylon Straps
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.30, 24), matAccent);
    stripe.rotation.z = Math.PI / 2;
    stripe.scale.set(1, 1, 0.88);
    stripe.position.y = -0.46;
    for (const sx of [-0.36, 0.36]) {
      const strap = new THREE.Mesh(new THREE.CylinderGeometry(0.435, 0.435, 0.08, 24), matDark);
      strap.rotation.z = Math.PI / 2;
      strap.scale.set(1, 1, 0.89);
      strap.position.set(sx, -0.46, 0);
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.032, 12, 24, Math.PI), matDark);
      handle.position.set(sx * 0.5, -0.05, 0);
      group.add(strap, handle);
    }
    // Tennis racket head & handle peeking out of top thermoguard compartment
    const rNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.62, 14), matAccent);
    rNeck.position.set(0.48, 0.05, 0);
    rNeck.rotation.z = -0.52;
    group.add(bagBody, stripe, rNeck);
  } else {
    // Adjustable Dumbbell & Kettlebell Set (Home Fitness)
    const matChrome = new THREE.MeshStandardMaterial({ color: '#D8E0E8', roughness: 0.22, metalness: 0.85 });
    // 1) Adjustable Hex/Plate Dumbbell in foreground
    const dbGrp = new THREE.Group();
    dbGrp.position.set(-0.16, -0.58, 0.22);
    dbGrp.rotation.y = 0.28;
    const gripBar = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.16, 18), matChrome);
    gripBar.rotation.z = Math.PI / 2;
    dbGrp.add(gripBar);
    for (const sx of [-1, 1]) {
      // Inner, middle, and outer cast-iron weight plates (6 radial segments = Hex Plate!)
      const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.11, 6), matPrimary);
      p1.rotation.z = Math.PI / 2;
      p1.position.x = sx * 0.32;
      const p2 = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.09, 6), matAccent);
      p2.rotation.z = Math.PI / 2;
      p2.position.x = sx * 0.44;
      const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.08, 16), matDark);
      dial.rotation.z = Math.PI / 2;
      dial.position.x = sx * 0.54;
      dbGrp.add(p1, p2, dial);
    }
    // 2) Cast-Iron & Vinyl Kettlebell beside the Dumbbell
    const kbGrp = new THREE.Group();
    kbGrp.position.set(0.42, -0.56, -0.24);
    kbGrp.rotation.y = -0.35;
    const kbBell = new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 20), matPrimary);
    kbBell.scale.set(1, 0.92, 1);
    const kbBand = new THREE.Mesh(new THREE.CylinderGeometry(0.342, 0.342, 0.12, 24), matAccent);
    const kbFlatBase = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.08, 24), matDark);
    kbFlatBase.position.y = -0.30;
    const kbHandle = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.048, 14, 28, Math.PI * 1.15), matDark);
    kbHandle.position.y = 0.28;
    kbHandle.rotation.z = -0.22;
    kbGrp.add(kbBell, kbBand, kbFlatBase, kbHandle);
    group.add(dbGrp, kbGrp);
  }

  return group;
}

// ============================================================================
// MAIN UNIFIED STORE CONTROLLER (SUPPORTS toko2, toko4 & toko6)
// ============================================================================
export function createTownStores3DSystem({ camera, controls, stores, chime }) {
  let active = false;
  let activeStoreKey = 'toko2'; // 'toko2' | 'toko4' | 'toko6'
  let state = 'HOME'; // 'HOME' | 'PRODUCT_3D' | 'MENU_GRID' | 'SPECIALS' | 'MY_BAG'
  let filterCat = 'ALL';
  let selectedItem = TOWN_STORE_CONFIGS.toko2.items[0];
  let selectedSizeIdx = 1;
  let selectedVariantIdx = 0;
  let selectedQty = 1;
  let savedVillageRotY = null;
  let onExitCallback = null;

  const bags = {
    toko2: [
      {
        id: 'croissant',
        name: 'Butter Croissant',
        size: 'Duo Set (2 Pcs)',
        variantName: 'Classic Golden Butter',
        variantHex: '#DF9B42',
        accentHex: '#F7E7C4',
        unitPrice: Math.round(38000 * 1.85),
        qty: 1
      }
    ],
    toko4: [
      {
        id: 'controller',
        name: 'Pro Wireless Gaming Controller',
        size: 'Standard Wireless',
        variantName: 'Cyber Matte Black & Cyan LED',
        variantHex: '#242830',
        accentHex: '#00E5FF',
        unitPrice: 1180000,
        qty: 1
      }
    ],
    toko6: [
      {
        id: 'racket',
        name: 'Apex Pro Tennis Racket',
        size: 'Grip L2 (295g Unstrung)',
        variantName: 'Apex Blue & Blaze Orange',
        variantHex: '#215DA6',
        accentHex: '#EB6B2A',
        unitPrice: 1450000,
        qty: 1
      }
    ]
  };

  const camAnim = {
    fromPos: new THREE.Vector3(),
    toPos: new THREE.Vector3(),
    curPos: new THREE.Vector3(),
    fromTarget: new THREE.Vector3(),
    toTarget: new THREE.Vector3(),
    curTarget: new THREE.Vector3(),
    fromOffsetX: 0,
    toOffsetX: 0,
    curOffsetX: 0,
    fromOffsetY: 0,
    toOffsetY: 0,
    curOffsetY: 0,
    t0: 0,
    dur: 760
  };

  const cachedCenter = new THREE.Vector3();
  let cachedMaxY = 4.5;
  let checkoutComplete = false;

  function cubicBezierEase(t) {
    return 1 - Math.pow(1 - t, 3.4);
  }

  function applyCurrentViewOffset() {
    const W = window.innerWidth;
    const H = window.innerHeight;
    if (W <= 767 || (Math.abs(camAnim.curOffsetX) < 0.0005 && Math.abs(camAnim.curOffsetY) < 0.0005)) {
      camera.clearViewOffset();
    } else {
      camera.setViewOffset(W, H, W * camAnim.curOffsetX, H * camAnim.curOffsetY, W, H);
    }
  }

  function currentCfg() {
    return TOWN_STORE_CONFIGS[activeStoreKey] || TOWN_STORE_CONFIGS.toko2;
  }

  function currentBag() {
    return bags[activeStoreKey] || bags.toko2;
  }

  function updateStoreCamera(targetState, instant = false) {
    const cfg = currentCfg();
    const st = stores[cfg.storeIdx];
    const bGroup = st?.g;
    if (!bGroup) return;

    // 1. Keep building group at scale (1, 1, 1) and set 3/4 Right-Front orientation (identical to Strawberry Corner)
    bGroup.scale.set(1, 1, 1);
    bGroup.rotation.y = 0.95;
    bGroup.updateMatrixWorld(true);

    // 2. Automatic Bounding Box from Sidewalk Curb to Rooftop (identical to Strawberry Corner)
    const box = new THREE.Box3().setFromObject(bGroup);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    cachedCenter.copy(center);
    cachedMaxY = box.max.y;

    // 3. Exact Mathematical Camera Distance & ViewOffset per State (100% identical to Strawberry Corner)
    const maxDim = Math.max(size.x, size.y, size.z);
    const fovRad = camera.fov * (Math.PI / 180);
    const baseDist = (maxDim / 2) / Math.tan(fovRad / 2);

    let dist = baseDist * 1.68;
    let targetOffsetX = 0.15;
    let targetOffsetY = 0;
    const isTabletViewport = window.innerWidth >= 768 && window.innerWidth <= 1180;

    if (targetState === 'HOME' || targetState === 'MY_BAG' || targetState === 'RECEIPT') {
      dist = isTabletViewport ? baseDist * 2.18 : baseDist * 1.68;
      targetOffsetX = isTabletViewport ? 0.11 : 0.15;
      targetOffsetY = 0;
    } else if (targetState === 'MENU_GRID' || targetState === 'PRODUCT_3D' || targetState === 'SPECIALS') {
      dist = isTabletViewport ? baseDist * 2.72 : baseDist * 2.38;
      targetOffsetX = isTabletViewport ? 0.41 : 0.40;
      targetOffsetY = -0.18;
    }

    const targetCamPos = new THREE.Vector3(
      center.x + dist * 0.55,
      center.y + size.y * 0.08,
      center.z + dist * 0.85
    );
    const targetLookAt = new THREE.Vector3(
      center.x,
      center.y + size.y * 0.05,
      center.z
    );

    if (instant) {
      camAnim.fromPos.copy(targetCamPos);
      camAnim.toPos.copy(targetCamPos);
      camAnim.curPos.copy(targetCamPos);
      camAnim.fromTarget.copy(targetLookAt);
      camAnim.toTarget.copy(targetLookAt);
      camAnim.curTarget.copy(targetLookAt);
      camAnim.fromOffsetX = camAnim.toOffsetX = camAnim.curOffsetX = targetOffsetX;
      camAnim.fromOffsetY = camAnim.toOffsetY = camAnim.curOffsetY = targetOffsetY;
      camAnim.t0 = performance.now() - 1000;
      camera.position.copy(targetCamPos);
      controls.target.copy(targetLookAt);
      applyCurrentViewOffset();
      camera.lookAt(controls.target);
      camera.updateMatrixWorld();
    } else {
      camAnim.fromPos.copy(camAnim.curPos);
      camAnim.fromTarget.copy(camAnim.curTarget);
      camAnim.toPos.copy(targetCamPos);
      camAnim.toTarget.copy(targetLookAt);
      camAnim.fromOffsetX = camAnim.curOffsetX;
      camAnim.toOffsetX = targetOffsetX;
      camAnim.fromOffsetY = camAnim.curOffsetY;
      camAnim.toOffsetY = targetOffsetY;
      camAnim.t0 = performance.now();
    }
  }

  window.addEventListener('resize', () => {
    if (!active) return;
    updateStoreCamera(state, true);
  });

  // Dedicated 360° Product Showcase WebGL Renderer (sized dynamically like Strawberry Corner)
  let prodRenderer = null;
  let prodScene = null;
  let prodCamera = null;
  let activeProdGroup = null;
  let prodDragging = false;
  let prodLastX = 0;
  let prodLastY = 0;
  let prodRotY = -0.35;
  let prodRotX = 0.14;

  let staticArtHost = null; // ?ui_only=true: SVG art host instead of a WebGL canvas
  function ensureProdRenderer(hostEl) {
    if (UI_ONLY) {
      staticArtHost = hostEl;
      return;
    }
    if (!prodRenderer) {
      const isMobile =
        /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
        window.innerWidth < 1024 ||
        Boolean(navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
      prodRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: !isMobile, powerPreference: 'high-performance' });
      prodRenderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.25 : 2.0));
      prodRenderer.outputColorSpace = THREE.SRGBColorSpace;
      prodRenderer.toneMapping = THREE.ACESFilmicToneMapping;
      prodRenderer.toneMappingExposure = 1.08;

      prodScene = new THREE.Scene();
      prodCamera = new THREE.PerspectiveCamera(32, 1, 0.1, 30);
      prodCamera.position.set(0, 0.35, 4.35);
      prodCamera.lookAt(0, -0.05, 0);

      prodScene.add(new THREE.AmbientLight('#fff7ee', 1.65));
      const keyLight = new THREE.DirectionalLight('#fff2df', 2.25);
      keyLight.position.set(3.2, 5.2, 4.2);
      prodScene.add(keyLight);
      const rimLight = new THREE.DirectionalLight('#f4d2c4', 1.2);
      rimLight.position.set(-3.5, 2.0, -2.5);
      prodScene.add(rimLight);

      const cvs = prodRenderer.domElement;
      cvs.className = 'sc-prod-webgl';

      cvs.addEventListener('pointerdown', e => {
        prodDragging = true;
        prodLastX = e.clientX;
        prodLastY = e.clientY;
        cvs.setPointerCapture?.(e.pointerId);
      });
      cvs.addEventListener('pointermove', e => {
        if (!prodDragging) return;
        const dx = e.clientX - prodLastX;
        const dy = e.clientY - prodLastY;
        prodLastX = e.clientX;
        prodLastY = e.clientY;
        prodRotY += dx * 0.012;
        prodRotX = Math.max(-0.35, Math.min(0.55, prodRotX + dy * 0.008));
      });
      const endDrag = () => {
        prodDragging = false;
      };
      cvs.addEventListener('pointerup', endDrag);
      cvs.addEventListener('pointercancel', endDrag);
    }
    hostEl.innerHTML = '';
    hostEl.appendChild(prodRenderer.domElement);
    const rect = hostEl.getBoundingClientRect();
    const w = Math.max(260, rect.width || 340);
    const h = Math.max(240, rect.height || 270);
    prodRenderer.setSize(w, h);
    prodCamera.aspect = w / h;
    prodCamera.updateProjectionMatrix();
  }

  function mountProduct3D(item, variantIdx = selectedVariantIdx) {
    if (UI_ONLY) {
      const v = item.variants[variantIdx] || item.variants[0];
      mountStaticProductArt(staticArtHost, townStoreProductSVG(item.id, v.hex, v.accent));
      return;
    }
    if (!prodScene) return;
    if (activeProdGroup) {
      prodScene.remove(activeProdGroup);
    }
    const v = item.variants[variantIdx] || item.variants[0];
    activeProdGroup = buildTownStore3DProduct(item.id, v.hex, v.accent);
    if (item.model3dUrl) {
      attachCustomModel3DToGroup(activeProdGroup, item.model3dUrl, 1.7);
    }
    prodRotY = -0.35;
    prodRotX = 0.12;
    activeProdGroup.rotation.set(prodRotX, prodRotY, 0);
    prodScene.add(activeProdGroup);
  }

  // Root DOM Overlay appended inside #app (100% identical to Strawberry Corner)
  const overlay = document.createElement('div');
  overlay.id = 'town-store-overlay';
  overlay.className = 'sc-overlay';
  overlay.style.display = 'none';
  document.getElementById('app').appendChild(overlay);

  function bagCount() {
    return currentBag().reduce((s, it) => s + it.qty, 0);
  }

  function addToBag(item, sizeIdx = selectedSizeIdx, variantIdx = selectedVariantIdx, qty = 1) {
    const bag = currentBag();
    const sz = item.sizes[sizeIdx] || item.sizes[0];
    const vr = item.variants[variantIdx] || item.variants[0];
    const unitPrice = Math.round(item.basePrice * (sz.mult || 1));
    const found = bag.find(b => b.id === item.id && b.size === sz.label && b.variantName === vr.name);
    if (found) {
      found.qty += qty;
    } else {
      bag.push({
        id: item.id,
        name: item.name,
        size: sz.label,
        variantName: vr.name,
        variantHex: vr.hex,
        accentHex: vr.accent,
        unitPrice,
        qty
      });
    }
    chime?.(660, 0.09);
  }

  function setState(nextState, opts = {}) {
    state = nextState;
    const cfg = currentCfg();
    if (opts.item) {
      selectedItem = opts.item;
      selectedSizeIdx = 1;
      selectedVariantIdx = 0;
      selectedQty = 1;
    }
    if (!selectedItem) {
      selectedItem = cfg.items[0];
    }
    if (nextState !== 'MY_BAG') {
      checkoutComplete = false;
    }
    updateStoreCamera(state, !!opts.instant);
    renderOverlay();
    chime?.(540, 0.08);
  }

  function getStoreCalligraphy() {
    const cfg = currentCfg();
    if (cfg?.leftCalligraphy) return cfg.leftCalligraphy;
    if (activeStoreKey === 'toko2') return 'Baked<br>Warm &amp;<br>Fresh Here';
    if (activeStoreKey === 'toko4') return 'Future<br>Tech &amp;<br>Sound';
    return 'Built<br>For Speed<br>&amp; Court';
  }

  function getStoreNoteLines() {
    const cfg = currentCfg();
    if (Array.isArray(cfg?.noteLines) && cfg.noteLines.length >= 3) return cfg.noteLines;
    if (activeStoreKey === 'toko2') return ['Warm', 'Croissants <span>♥</span>', 'Parisian Sips'];
    if (activeStoreKey === 'toko4') return ['OLED &amp; 5G', 'Spatial Audio <span>♥</span>', 'Pro Gaming'];
    return ['Pro Gear', 'Tennis Club <span>♥</span>', 'Every Sprint'];
  }

  function renderStateContent() {
    const cfg = currentCfg();
    const first = cfg.items[0];
    const bestsellers = cfg.items.slice(0, 4);
    const extraItems = cfg.items.slice(2, 6);
    const noteLines = getStoreNoteLines();

    if (state === 'HOME') {
      return `
        <aside class="sc-left-home">
          <h1 class="sc-calligraphy">${getStoreCalligraphy()}</h1>
          <p class="sc-kicker">${cfg.leftKicker || cfg.brandSub}</p>

          <div class="sc-vmenu">
            <button type="button" class="sc-vbtn on" data-ts-nav="HOME"><span>HOME</span> <i>›</i></button>
            <button type="button" class="sc-vbtn" data-ts-nav="MENU_GRID"><span>MENU</span> <i>›</i></button>
            <button type="button" class="sc-vbtn" data-ts-nav="PRODUCT_3D"><span>SHOP</span> <i>›</i></button>
            <button type="button" class="sc-vbtn" data-ts-nav="SPECIALS"><span>EVENTS</span> <i>›</i></button>
            <button type="button" class="sc-vbtn" data-ts-nav="MY_BAG"><span>MY BAG (${bagCount()})</span> <i>›</i></button>
          </div>

          <div class="sc-note-card">
            <div class="sc-note-pin" style="background:${cfg.themeColor};"></div>
            <div>
              <b>${noteLines[0]}</b>
              <b>${noteLines[1]}</b>
              <b>${noteLines[2]}</b>
            </div>
          </div>
        </aside>

        <section class="sc-right-home">
          <!-- Card 1: Hero Card -->
          <div class="sc-card sc-hero-card">
            <div class="sc-hero-copy">
              <span class="sc-eyebrow" style="color:${cfg.themeColor};">${cfg.heroEyebrow || 'SEASON SPECIAL'}</span>
              <h2>${cfg.heroHeadline}</h2>
              <p>${cfg.heroSub || cfg.brandSub}</p>
              <button type="button" class="sc-pill-cta" id="ts-open-catalog" style="background:${cfg.themeColor};">
                ${cfg.ctaLabel || 'Lihat & Pesan Produk →'}
              </button>
            </div>
            <div class="sc-hero-art">
              ${townStoreProductSVG(first.id, first.variants[0].hex, first.variants[0].accent)}
              <canvas class="sc-hero-building-canvas" width="240" height="240" aria-hidden="true"></canvas>
            </div>
          </div>

          <!-- Card 2: Bestsellers 3D -->
          <div class="sc-card">
            <div class="sc-card-head">
              <span>OUR BESTSELLERS</span>
              <button type="button" class="sc-link-btn" data-ts-nav="MENU_GRID" style="color:${cfg.themeColor};">VIEW ALL →</button>
            </div>
            <div class="sc-mini-grid">
              ${bestsellers
                .map(
                  it => `
                <button type="button" class="sc-mini-item" data-ts-pick="${it.id}">
                  <div class="sc-mini-thumb">${townStoreProductSVG(it.id, it.variants[0].hex, it.variants[0].accent)}</div>
                  <b>${it.name}</b>
                  <small>${formatIDR(it.basePrice)}</small>
                </button>
              `
                )
                .join('')}
            </div>
          </div>

          <!-- Card 3: More 3D Items -->
          <div class="sc-card">
            <div class="sc-card-head">
              <span>FEATURED GOODS</span>
              <button type="button" class="sc-link-btn" data-ts-nav="PRODUCT_3D" style="color:${cfg.themeColor};">SHOP NOW →</button>
            </div>
            <div class="sc-mini-grid">
              ${extraItems
                .map(
                  it => `
                <button type="button" class="sc-mini-item" data-ts-pick="${it.id}">
                  <div class="sc-mini-thumb">${townStoreProductSVG(it.id, it.variants[0].hex, it.variants[0].accent)}</div>
                  <b>${it.name}</b>
                  <small>${formatIDR(it.basePrice)}</small>
                </button>
              `
                )
                .join('')}
            </div>
          </div>
        </section>
      `;
    }

    if (state === 'MENU_GRID') {
      const cats = ['ALL', ...new Set(cfg.items.map(i => i.cat))];
      const filtered = filterCat === 'ALL' ? cfg.items : cfg.items.filter(i => i.cat === filterCat);

      return `
        <aside class="sc-left-sub">
          <button type="button" class="sc-back-link" data-ts-nav="HOME">← KEMBALI KE BERANDA TOKO</button>
          <h1 class="sc-calligraphy-sm">Katalog</h1>
          <p class="sc-kicker">${cfg.brandSub}</p>
        </aside>

        <section class="sc-right-panel sc-card">
          <div class="sc-menu-bar">
            <span class="sc-section-tag">KATALOG ${cfg.storeNo} — KLIK ITEM UNTUK PREVIEW 360°</span>
            <div class="sc-filter-pills">
              ${cats
                .map(
                  c => `
                <button type="button" class="${filterCat === c ? 'on' : ''}" data-ts-filter="${c}" style="${filterCat === c ? `background:${cfg.themeColor};border-color:${cfg.themeColor};color:#FFFDF9;` : ''}">
                  ${c}
                </button>
              `
                )
                .join('')}
            </div>
          </div>

          <div class="sc-menu-grid" style="grid-template-columns: repeat(3, minmax(0, 1fr));">
            ${filtered
              .map(
                it => `
              <article class="sc-menu-card" data-ts-card="${it.id}">
                <div class="sc-menu-art">${townStoreProductSVG(it.id, it.variants[0].hex, it.variants[0].accent)}</div>
                <h3>${it.name}</h3>
                <p>${it.sub}</p>
                <div class="sc-menu-foot">
                  <strong>${formatIDR(it.basePrice)}</strong>
                  <button type="button" class="sc-plus-btn" data-ts-quick-add="${it.id}" title="Tambah ke Keranjang">+</button>
                </div>
              </article>
            `
              )
              .join('')}
          </div>
        </section>
      `;
    }

    if (state === 'PRODUCT_3D') {
      const it = selectedItem || cfg.items[0];
      const sz = it.sizes[selectedSizeIdx] || it.sizes[0];
      const vr = it.variants[selectedVariantIdx] || it.variants[0];
      const unitPrice = Math.round(it.basePrice * (sz.mult || 1));
      const totalPrice = unitPrice * selectedQty;
      const tokopediaUrl = `https://www.tokopedia.com/search?st=product&q=${encodeURIComponent(cfg.searchPrefix + it.name + ' ' + vr.name)}`;

      return `
        <aside class="sc-left-sub">
          <button type="button" class="sc-back-link" data-ts-nav="HOME">← KEMBALI KE BERANDA TOKO</button>
          <h1 class="sc-calligraphy-sm">Pesan Produk</h1>
          <p class="sc-kicker">PUTAR 360° &nbsp;·&nbsp; PILIH VARIAN &amp; UKURAN</p>
        </aside>

        <section class="sc-right-panel sc-card sc-showcase-card">
          <div class="sc-showcase-split">
            <!-- Left Side: Second Three.js 360° Product Canvas -->
            <div class="sc-showcase-3d">
              <div class="sc-canvas-wrap" id="ts-prod-canvas-slot"></div>
              <span class="sc-drag-hint">‹ &nbsp; drag untuk memutar produk 360° &nbsp; ›</span>
            </div>

            <!-- Right Side: Product Details, Variants, Sizes, Quantity & Add to Bag -->
            <div class="sc-showcase-info">
              <button type="button" class="sc-back-treats" data-ts-nav="MENU_GRID">← SEMUA KATALOG (${cfg.items.length})</button>
              <span class="sc-prod-cat" style="color:${cfg.themeColor};">${it.cat} · ${vr.name.toUpperCase()}</span>
              <h2 class="sc-prod-title">${it.name}</h2>
              <strong class="sc-prod-price" style="color:${cfg.themeColor};">${formatIDR(totalPrice)}</strong>
              <p class="sc-prod-desc">${it.desc}</p>

              <div class="at-option-block">
                <small class="at-option-label">VARIAN WARNA: <b>${vr.name}</b></small>
                <div class="at-swatch-row">
                  ${it.variants
                    .map(
                      (c, idx) => `
                    <button type="button" class="at-swatch-btn ${idx === selectedVariantIdx ? 'on' : ''}" data-ts-variant="${idx}">
                      <span class="at-swatch-dot" style="background:${c.hex};"></span>
                      <span>${c.name}</span>
                    </button>
                  `
                    )
                    .join('')}
                </div>
              </div>

              <div class="sc-size-row">
                ${it.sizes
                  .map(
                    (s, idx) => `
                  <button type="button" class="sc-size-btn ${idx === selectedSizeIdx ? 'on' : ''}" data-ts-size="${idx}">
                    ${s.label}
                  </button>
                `
                  )
                  .join('')}
              </div>

              <div class="sc-buy-row">
                <div class="sc-qty-box">
                  <button type="button" id="ts-qty-dec">−</button>
                  <span id="ts-qty-val">${selectedQty}</span>
                  <button type="button" id="ts-qty-inc">+</button>
                </div>
                <button type="button" class="sc-add-bag-btn" id="ts-add-bag-main" style="background:${cfg.themeColor};">
                  + MASUKKAN KERANJANG
                </button>
              </div>

              <div class="sc-tokopedia-row">
                <a class="sc-tokopedia-btn" href="${tokopediaUrl}" target="_blank" rel="noopener noreferrer">
                  BELI VIA TOKOPEDIA ↗
                </a>
                <span class="sc-unit-note">(${formatIDR(unitPrice)} / ${sz.label})</span>
              </div>
            </div>
          </div>

          <!-- Bottom Product Thumbnails Strip (100% like Strawberry Corner) -->
          <div class="sc-thumb-strip" style="grid-template-columns: repeat(${cfg.items.length}, minmax(0, 1fr));">
            ${cfg.items
              .map(
                m => `
              <button type="button" class="sc-thumb-btn ${m.id === it.id ? 'on' : ''}" data-ts-switch="${m.id}" title="${m.name}">
                ${townStoreProductSVG(m.id, m.variants[0].hex, m.variants[0].accent)}
              </button>
            `
              )
              .join('')}
          </div>
        </section>
      `;
    }

    if (state === 'SPECIALS') {
      return `
        <aside class="sc-left-sub">
          <button type="button" class="sc-back-link" data-ts-nav="HOME">← KEMBALI KE BERANDA TOKO</button>
          <h1 class="sc-calligraphy-sm">Program</h1>
          <p class="sc-kicker">${cfg.specialsTitle}</p>
        </aside>

        <section class="sc-right-panel sc-card">
          <div class="sc-menu-bar">
            <span class="sc-section-tag">${cfg.specialsTitle}</span>
          </div>
          <div class="sc-basket-list" style="max-height:360px;">
            ${cfg.specials
              .map(
                (sp, idx) => `
              <div class="sc-basket-row" style="padding:14px 16px;">
                <div class="sc-basket-info">
                  <span class="sc-eyebrow" style="color:${cfg.themeColor};margin-bottom:4px;">${sp.date}</span>
                  <b style="font-size:15px;">${sp.title}</b>
                  <small style="display:block;margin-top:3px;line-height:1.4;">${sp.sub}</small>
                </div>
                <button type="button" class="sc-pill-cta" data-ts-special="${idx}" style="background:${cfg.themeColor};flex:none;">
                  ${sp.badge} →
                </button>
              </div>
            `
              )
              .join('')}
          </div>
        </section>
      `;
    }

    // STATE 5: MY_BAG & RECEIPT (1:1 Blibli Checkout Anatomy + Warm Boutique Cerria Town)
    const bag = currentBag();
    const queryItems = bag.map(it => `${it.name} (${it.variantName}, ${it.size})`).join(' ');
    const tokopediaCheckoutUrl = `https://www.tokopedia.com/search?st=product&q=${encodeURIComponent(cfg.searchPrefix + (queryItems || cfg.items[0].name))}`;

    const cleanStoreName = cfg.brandTitle.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&');
    const districtMap = {
      toko2: 'Distrik #2, Cerria Town',
      toko4: 'Distrik #4, Cerria Town',
      toko6: 'Distrik #6, Cerria Town'
    };

    const checkoutItems = bag.map((it, idx) => ({
      id: it.id,
      name: it.name,
      variantLabel: `${it.variantName} · ${it.size}`,
      unitPrice: it.unitPrice,
      qty: it.qty,
      insured: it.insured !== false,
      stockLeft: idx === 0 ? 4 : ((idx % 4) + 2),
      svgHtml: townStoreProductSVG(it.id, it.variantHex, it.accentHex)
    }));

    const recSource = cfg.items.filter(m => !bag.some(b => b.id === m.id));
    const recPool = (recSource.length >= 3 ? recSource : cfg.items).slice(0, 3);
    const recommendations = recPool.map((m, rIdx) => {
      const v = m.variants?.[0] || { hex: '#D97B43', accent: '#FCE8D5' };
      const discBadges = ['40%', '20%', null];
      return {
        id: m.id,
        name: m.name,
        price: m.basePrice,
        discountBadge: discBadges[rIdx % discBadges.length],
        svgHtml: townStoreProductSVG(m.id, v.hex, v.accent)
      };
    });

    return renderCerriaCheckoutStage({
      storeId: activeStoreKey,
      storeName: `${cleanStoreName} Flagship Store`,
      storeLocation: districtMap[activeStoreKey] || `${cfg.storeNo}, Cerria Town`,
      themeColor: '#d9534f',
      items: checkoutItems,
      recommendations,
      checkoutComplete,
      tokopediaUrl: tokopediaCheckoutUrl
    });
  }

  function renderOverlay() {
    const cfg = currentCfg();
    const count = bagCount();
    const isBottomLeft = state === 'MENU_GRID' || state === 'PRODUCT_3D' || state === 'SPECIALS';
    const first = cfg.items[0];
    const cleanBrandSub = (cfg.brandSub || '').split('·')[0].trim();
    const exitBtnLabel = state === 'HOME' ? '← Kembali ke Kota' : '← Kembali';

    overlay.dataset.state = state;
    overlay.innerHTML = `
      <div class="sc-backdrop ${isBottomLeft ? 'mode-bl' : 'mode-center'}"></div>

      <!-- Top Header Navigation (100% identical to Strawberry Corner) -->
      <header class="sc-topbar">
        <div class="sc-brand-wrap">
          <button type="button" class="sc-exit-btn" id="ts-exit-village">${exitBtnLabel}</button>
          <div class="sc-logo" id="ts-logo-home">
            <span class="sc-logo-berry">
              ${townStoreProductSVG(first.id, first.variants[0].hex, first.variants[0].accent)}
            </span>
            <div>
              <strong>${cfg.brandTitle}</strong>
              <small>${cleanBrandSub}</small>
            </div>
          </div>
        </div>

        <nav class="sc-topnav" aria-label="Navigasi Toko">
          <button type="button" class="${state === 'HOME' ? 'on' : ''}" data-ts-nav="HOME">🏠 Home</button>
          <button type="button" class="${state === 'MENU_GRID' ? 'on' : ''}" data-ts-nav="MENU_GRID">☕ Katalog</button>
          <button type="button" class="${state === 'PRODUCT_3D' ? 'on' : ''}" data-ts-nav="PRODUCT_3D">🛍️ Shop</button>
          <button type="button" class="${state === 'SPECIALS' ? 'on' : ''}" data-ts-nav="SPECIALS">📅 Events</button>
          <button type="button" class="${state === 'MY_BAG' ? 'on' : ''}" data-ts-nav="MY_BAG">🛒 My Bag (${count})</button>
        </nav>

        <div class="sc-top-stats">
          <span class="sc-stat-pill"><i class="sc-dot-berry" style="background:${cfg.themeColor};"></i> 1,250 <b>+</b></span>
          <span class="sc-stat-pill"><i class="sc-dot-heart" style="color:${cfg.themeColor};">♥</i> ${count}</span>
        </div>
      </header>

      <!-- Floating "you are here" indicator for MENU_GRID, PRODUCT_3D & SPECIALS -->
      <div class="sc-you-are-here ${isBottomLeft ? 'on' : ''}" id="ts-here-marker">
        <span style="color:${cfg.themeColor};">you are here</span>
        <svg viewBox="0 0 48 48" width="34" height="34" fill="none">
          <path d="M14 6c10 8 14 20 12 34m0 0l-6-7m6 7l7-6" stroke="${cfg.themeColor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>

      <!-- Main Stage Area (Left + Right Panels, Center 100% open for 3D Building!) -->
      <div class="sc-stage">
        ${renderStateContent()}
      </div>

      <!-- Bottom Bar (100% identical to Strawberry Corner) -->
      <footer class="sc-bottombar">
        <button type="button" class="sc-exit-btn sc-bottom-exit-btn" id="ts-exit-village-bottom">${exitBtnLabel}</button>
        <div class="sc-foot-brand">
          <span class="sc-dot-berry" style="background:${cfg.themeColor};"></span>
          <div>
            <b>${cfg.brandTitle.replace(/<[^>]*>/g, '')}</b>
            <small>${cleanBrandSub}</small>
          </div>
        </div>
        <p class="sc-foot-quote">${cfg.hours} <span style="color:${cfg.themeColor};">♥</span></p>
        <div class="sc-foot-icons">
          <button type="button" class="${state === 'HOME' ? 'on' : ''}" data-ts-nav="HOME" title="Home">⌂</button>
          <button type="button" class="${state === 'PRODUCT_3D' ? 'on' : ''}" data-ts-nav="PRODUCT_3D" title="Shop">🛍</button>
          <button type="button" class="${state === 'MENU_GRID' ? 'on' : ''}" data-ts-nav="MENU_GRID" title="Menu">📦</button>
          <button type="button" class="${state === 'SPECIALS' ? 'on' : ''}" data-ts-nav="SPECIALS" title="Events">✨</button>
          <button type="button" class="${state === 'MY_BAG' ? 'on' : ''}" data-ts-nav="MY_BAG" title="My Bag">🛒</button>
        </div>
      </footer>
    `;

    if (state === 'PRODUCT_3D') {
      const slot = overlay.querySelector('#ts-prod-canvas-slot');
      if (slot) {
        ensureProdRenderer(slot);
        mountProduct3D(selectedItem || cfg.items[0], selectedVariantIdx);
      }
    }

    const bag = currentBag();

    const handleBackOrExit = () => {
      if (state === 'HOME') {
        exit();
      } else {
        setState('HOME');
      }
    };
    overlay.querySelector('#ts-exit-village')?.addEventListener('click', handleBackOrExit);
    overlay.querySelector('#ts-exit-village-bottom')?.addEventListener('click', handleBackOrExit);
    overlay.querySelector('#ts-logo-home')?.addEventListener('click', () => setState('HOME'));
    overlay.querySelectorAll('[data-ts-nav]').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-ts-nav');
        setState(target);
      });
    });

    overlay.querySelector('#ts-open-catalog')?.addEventListener('click', () => {
      setState('PRODUCT_3D', { item: selectedItem || cfg.items[0] });
    });
    overlay.querySelectorAll('[data-ts-pick]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-ts-pick');
        const item = cfg.items.find(m => m.id === id) || cfg.items[0];
        setState('PRODUCT_3D', { item });
      });
    });

    overlay.querySelectorAll('[data-ts-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        filterCat = btn.getAttribute('data-ts-filter');
        chime?.(500, 0.06);
        renderOverlay();
      });
    });

    overlay.querySelectorAll('[data-ts-card]').forEach(card => {
      card.addEventListener('click', e => {
        if (e.target.closest('[data-ts-quick-add]')) return;
        const id = card.getAttribute('data-ts-card');
        const item = cfg.items.find(m => m.id === id) || cfg.items[0];
        setState('PRODUCT_3D', { item });
      });
    });

    overlay.querySelectorAll('[data-ts-quick-add]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const id = btn.getAttribute('data-ts-quick-add');
        const item = cfg.items.find(m => m.id === id);
        if (item) {
          addToBag(item, 1, 0, 1);
          btn.textContent = '✓';
          btn.classList.add('added');
          setTimeout(() => {
            renderOverlay();
          }, 450);
        }
      });
    });

    overlay.querySelectorAll('[data-ts-variant]').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedVariantIdx = parseInt(btn.getAttribute('data-ts-variant'), 10) || 0;
        chime?.(580 + selectedVariantIdx * 35, 0.06);
        renderOverlay();
      });
    });

    overlay.querySelectorAll('[data-ts-size]').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedSizeIdx = parseInt(btn.getAttribute('data-ts-size'), 10) || 0;
        chime?.(540 + selectedSizeIdx * 40, 0.06);
        renderOverlay();
      });
    });

    overlay.querySelector('#ts-qty-dec')?.addEventListener('click', () => {
      selectedQty = Math.max(1, selectedQty - 1);
      renderOverlay();
    });
    overlay.querySelector('#ts-qty-inc')?.addEventListener('click', () => {
      selectedQty = Math.min(20, selectedQty + 1);
      renderOverlay();
    });

    overlay.querySelector('#ts-add-bag-main')?.addEventListener('click', e => {
      addToBag(selectedItem, selectedSizeIdx, selectedVariantIdx, selectedQty);
      const btn = e.currentTarget;
      btn.textContent = '✓ DITAMBAHKAN ♥';
      btn.classList.add('added');
      setTimeout(() => {
        if (state === 'PRODUCT_3D') renderOverlay();
      }, 900);
    });

    overlay.querySelectorAll('[data-ts-switch]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-ts-switch');
        const item = cfg.items.find(m => m.id === id);
        if (item) {
          selectedItem = item;
          selectedSizeIdx = 1;
          selectedVariantIdx = 0;
          selectedQty = 1;
          chime?.(560, 0.07);
          renderOverlay();
        }
      });
    });

    overlay.querySelectorAll('[data-ts-special]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-ts-special'), 10) || 0;
        const item = cfg.items[idx % cfg.items.length];
        setState('PRODUCT_3D', { item });
      });
    });

    if (state === 'MY_BAG') {
      const queryItems = bag.map(it => `${it.name} (${it.variantName}, ${it.size})`).join(' ');
      const tokopediaCheckoutUrl = `https://www.tokopedia.com/search?st=product&q=${encodeURIComponent(cfg.searchPrefix + (queryItems || cfg.items[0].name))}`;
      bindCerriaCheckoutEvents(overlay, {
        storeId: activeStoreKey,
        items: bag,
        onDecrementItem: idx => {
          if (bag[idx]) {
            bag[idx].qty--;
            if (bag[idx].qty <= 0) bag.splice(idx, 1);
            renderOverlay();
          }
        },
        onIncrementItem: idx => {
          if (bag[idx]) {
            bag[idx].qty++;
            renderOverlay();
          }
        },
        onRemoveItem: idx => {
          if (bag[idx]) {
            bag.splice(idx, 1);
            renderOverlay();
          }
        },
        onDuplicateItem: idx => {
          if (bag[idx]) {
            bag[idx].qty++;
            renderOverlay();
          }
        },
        onToggleItemProtection: (idx, checked) => {
          if (bag[idx]) {
            bag[idx].insured = checked;
            renderOverlay();
          }
        },
        onAddRecommendedItem: recId => {
          const item = cfg.items.find(m => m.id === recId);
          if (item) {
            addToBag(item, 1, 0, 1);
            renderOverlay();
          }
        },
        onContinueShopping: () => setState('MENU_GRID'),
        onAddMoreItems: () => setState('PRODUCT_3D'),
        onSubmitOrder: paymentMethod => {
          if (paymentMethod === 'tokopedia_affiliate') {
            window.open(tokopediaCheckoutUrl, '_blank', 'noopener,noreferrer');
          }
          checkoutComplete = true;
          renderOverlay();
          submitOrder(activeStoreKey, currentBag(), {
            channel: 'web_modal',
            storeName: currentCfg()?.brandTitle?.replace(/<[^>]*>/g, '') || activeStoreKey,
            paymentMethod
          });
        },
        onFinishOrder: () => {
          checkoutComplete = false;
          setState('HOME');
        },
        onReRender: () => renderOverlay(),
        chime
      });
    }
  }

  function enter(rawStoreKey, onExit) {
    const storeKey = normalizeStoreId(rawStoreKey);
    if (!TOWN_STORE_CONFIGS[storeKey]) return;
    active = true;
    activeStoreKey = storeKey;
    onExitCallback = onExit || null;
    state = 'HOME';
    filterCat = 'ALL';
    checkoutComplete = false;
    const cfg = currentCfg();
    selectedItem = cfg.items[0];
    selectedSizeIdx = 1;
    selectedVariantIdx = 0;
    selectedQty = 1;

    const st = stores[cfg.storeIdx];
    const bGroup = st?.g;
    if (bGroup) {
      if (savedVillageRotY === null) {
        savedVillageRotY = bGroup.rotation.y;
      }
      bGroup.scale.set(1, 1, 1);
    }

    document.getElementById('app')?.classList.add('sc-mode-active');
    overlay.style.display = 'flex';
    camAnim.curPos.copy(camera.position);
    camAnim.curTarget.copy(controls.target);
    camAnim.curOffsetX = 0;
    camAnim.curOffsetY = 0;
    camera.clearViewOffset();
    setState('HOME', { instant: false });
  }

  function exit() {
    if (!active) return;
    const cfg = currentCfg();
    active = false;
    overlay.style.display = 'none';
    document.getElementById('app')?.classList.remove('sc-mode-active');

    const st = stores[cfg.storeIdx];
    const bGroup = st?.g;
    if (bGroup && savedVillageRotY !== null) {
      bGroup.rotation.y = savedVillageRotY;
      bGroup.scale.set(1, 1, 1);
      bGroup.updateMatrixWorld(true);
      savedVillageRotY = null;
    }

    camAnim.fromOffsetX = camAnim.toOffsetX = camAnim.curOffsetX = 0;
    camAnim.fromOffsetY = camAnim.toOffsetY = camAnim.curOffsetY = 0;
    camera.clearViewOffset();
    camera.updateProjectionMatrix();

    if (onExitCallback) onExitCallback();
  }

  const _proj = new THREE.Vector3();
  function update(now, dt) {
    if (!active) return;

    const elapsed = now - camAnim.t0;
    const u = Math.min(1, Math.max(0, elapsed / camAnim.dur));
    const k = cubicBezierEase(u);

    camAnim.curPos.lerpVectors(camAnim.fromPos, camAnim.toPos, k);
    camAnim.curTarget.lerpVectors(camAnim.fromTarget, camAnim.toTarget, k);
    camAnim.curOffsetX = camAnim.fromOffsetX + (camAnim.toOffsetX - camAnim.fromOffsetX) * k;
    camAnim.curOffsetY = camAnim.fromOffsetY + (camAnim.toOffsetY - camAnim.fromOffsetY) * k;

    const cfg = currentCfg();
    const st = stores[cfg.storeIdx];
    const bGroup = st?.g;
    if (bGroup) bGroup.scale.set(1, 1, 1);

    applyCurrentViewOffset();

    camera.position.copy(camAnim.curPos);
    controls.target.copy(camAnim.curTarget);
    camera.lookAt(controls.target);
    camera.updateMatrixWorld();

    // Position the floating "you are here" marker right above the building roof in States 2, 3 & 4
    if (state === 'MENU_GRID' || state === 'PRODUCT_3D' || state === 'SPECIALS') {
      const marker = overlay.querySelector('#ts-here-marker');
      if (marker) {
        _proj.set(cachedCenter.x, cachedMaxY + 0.35, cachedCenter.z).project(camera);
        const sx = (_proj.x * 0.5 + 0.5) * window.innerWidth;
        const sy = (-_proj.y * 0.5 + 0.5) * window.innerHeight;
        marker.style.left = `${Math.max(80, Math.min(window.innerWidth * 0.36, sx))}px`;
        marker.style.top = `${Math.max(150, Math.min(window.innerHeight - 170, sy - 8))}px`;
      }
    }

    if (state === 'PRODUCT_3D' && prodRenderer && prodScene && prodCamera && activeProdGroup) {
      if (!prodDragging) {
        prodRotY += dt * 0.55;
      }
      activeProdGroup.rotation.set(prodRotX, prodRotY, 0);
      prodRenderer.render(prodScene, prodCamera);
    }
  }

  return {
    get isActive() {
      return active;
    },
    get activeStoreIndex() {
      return currentCfg().storeIdx;
    },
    enter,
    exit,
    update
  };
}
