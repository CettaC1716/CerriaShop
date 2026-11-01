import * as THREE from 'three';
import { storeCatalog, submitOrder } from './js/store-data-manager.js?v=124';
import { UI_ONLY, mountStaticProductArt } from './js/ui-mode.js?v=124';
import { renderCerriaCheckoutStage, bindCerriaCheckoutEvents } from './cerria_checkout.js?v=128';
import { attachCustomModel3DToGroup } from './js/custom-model-loader.js?v=1';

// ============================================================================
// GLOW STUDIO — BEAUTY & CARE (STORE #1)
// 5-STATE CAMERA CHOREOGRAPHY & INTERACTIVE 3D BEAUTY & SKINCARE STORE
// States: HOME | MENU_GRID | PRODUCT_3D | TREATMENTS | MY_BAG
// ============================================================================

// Display data lives in /data/stores-data.json (toko1.catalog.*) — live, SWR-refreshed reference.
export const GLOW_CATALOG = storeCatalog('toko1');
export const GLOW_ITEMS = GLOW_CATALOG.items;

// toko1.catalog.treatments in /data/stores-data.json
export const GLOW_TREATMENTS = GLOW_CATALOG.treatments;

const formatIDR = n => 'Rp ' + Math.round(n).toLocaleString('id-ID');

export function glowProductSVG(id, primaryHex = '#F2C6C2', accentHex = '#E5B568') {
  switch (id) {
    case 'ledmask':
      return `<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="60" cy="60" r="46" fill="#FDF6F0"/>
        <ellipse cx="52" cy="56" rx="24" ry="30" fill="${primaryHex}" stroke="#4A3832" stroke-width="2.4"/>
        <ellipse cx="43" cy="50" rx="5.5" ry="3.5" fill="#FFF8F2" stroke="#4A3832" stroke-width="1.8"/>
        <ellipse cx="61" cy="50" rx="5.5" ry="3.5" fill="#FFF8F2" stroke="#4A3832" stroke-width="1.8"/>
        <path d="M46 68h12" stroke="#4A3832" stroke-width="2.2" stroke-linecap="round"/>
        <line x1="84" y1="42" x2="84" y2="86" stroke="${accentHex}" stroke-width="4" stroke-linecap="round"/>
        <ellipse cx="84" cy="36" rx="10" ry="6" fill="${primaryHex}" stroke="#4A3832" stroke-width="2"/>
      </svg>`;
    case 'brushes':
      return `<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="60" cy="60" r="46" fill="#FDF6F0"/>
        <path d="M46 54L38 28M60 54V24M74 54L82 28" stroke="${accentHex}" stroke-width="4.5" stroke-linecap="round"/>
        <circle cx="37" cy="24" r="9" fill="#5C4438"/><circle cx="60" cy="20" r="10" fill="#5C4438"/><circle cx="83" cy="24" r="8.5" fill="#5C4438"/>
        <rect x="38" y="54" width="44" height="40" rx="7" fill="${primaryHex}" stroke="#4A3832" stroke-width="2.4"/>
        <line x1="48" y1="56" x2="48" y2="92" stroke="#4A3832" stroke-width="1.4" stroke-opacity="0.35"/>
        <line x1="60" y1="56" x2="60" y2="92" stroke="#4A3832" stroke-width="1.4" stroke-opacity="0.35"/>
        <line x1="72" y1="56" x2="72" y2="92" stroke="#4A3832" stroke-width="1.4" stroke-opacity="0.35"/>
      </svg>`;
    case 'dryer':
      return `<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="60" cy="60" r="46" fill="#FDF6F0"/>
        <rect x="55" y="48" width="12" height="42" rx="5" fill="${accentHex}" stroke="#4A3832" stroke-width="2.2"/>
        <rect x="34" y="26" width="46" height="24" rx="12" fill="${primaryHex}" stroke="#4A3832" stroke-width="2.4"/>
        <circle cx="48" cy="38" r="7" fill="#FFF8F2" stroke="${accentHex}" stroke-width="2.5"/>
        <rect x="80" y="31" width="12" height="14" rx="3" fill="${accentHex}" stroke="#4A3832" stroke-width="2"/>
      </svg>`;
    case 'perfume':
      return `<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="60" cy="60" r="46" fill="#FDF6F0"/>
        <rect x="52" y="22" width="16" height="12" rx="3" fill="${accentHex}" stroke="#4A3832" stroke-width="2"/>
        <rect x="55" y="34" width="10" height="8" fill="#4A3832"/>
        <rect x="36" y="42" width="48" height="50" rx="10" fill="${primaryHex}" stroke="#4A3832" stroke-width="2.4"/>
        <rect x="45" y="54" width="30" height="24" rx="3" fill="#FFFDF9" stroke="${accentHex}" stroke-width="1.8"/>
      </svg>`;
    case 'mirror':
      return `<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="60" cy="60" r="46" fill="#FDF6F0"/>
        <rect x="36" y="22" width="48" height="62" rx="8" fill="${primaryHex}" stroke="#4A3832" stroke-width="2.4"/>
        <rect x="43" y="29" width="34" height="48" rx="4" fill="#FFF9F2" stroke="${accentHex}" stroke-width="1.8"/>
        <circle cx="39.5" cy="32" r="2.5" fill="#FFF"/><circle cx="39.5" cy="52" r="2.5" fill="#FFF"/><circle cx="39.5" cy="72" r="2.5" fill="#FFF"/>
        <circle cx="80.5" cy="32" r="2.5" fill="#FFF"/><circle cx="80.5" cy="52" r="2.5" fill="#FFF"/><circle cx="80.5" cy="72" r="2.5" fill="#FFF"/>
        <rect x="42" y="86" width="36" height="8" rx="4" fill="${accentHex}" stroke="#4A3832" stroke-width="2"/>
      </svg>`;
    default:
      return `<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="60" cy="60" r="46" fill="#FDF6F0"/>
        <rect x="34" y="46" width="24" height="44" rx="6" fill="${primaryHex}" stroke="#4A3832" stroke-width="2.2"/>
        <rect x="41" y="30" width="10" height="16" rx="3" fill="${accentHex}" stroke="#4A3832" stroke-width="2"/>
        <rect x="64" y="62" width="28" height="28" rx="6" fill="${primaryHex}" stroke="#4A3832" stroke-width="2.2"/>
        <rect x="62" y="54" width="32" height="9" rx="3" fill="${accentHex}" stroke="#4A3832" stroke-width="2"/>
      </svg>`;
  }
}

// ============================================================================
// DEDICATED 3D BEAUTY & SKINCARE PRODUCT TURNTABLE BUILDER
// ============================================================================
function buildGlow3DProduct(id, primaryHex, accentHex) {
  const g = new THREE.Group();
  const matPrimary = new THREE.MeshStandardMaterial({ color: primaryHex, roughness: 0.36, metalness: 0.08 });
  const matAccent = new THREE.MeshStandardMaterial({ color: accentHex, roughness: 0.26, metalness: 0.65 });
  const matCream = new THREE.MeshStandardMaterial({ color: '#FAF3EB', roughness: 0.55 });
  const matMirror = new THREE.MeshStandardMaterial({
    color: '#FFFDF8',
    emissive: '#FFEAD2',
    emissiveIntensity: 0.45,
    roughness: 0.12,
    metalness: 0.35
  });
  const matBulb = new THREE.MeshBasicMaterial({ color: '#FFF9EA' });
  const matBristleDark = new THREE.MeshStandardMaterial({ color: '#4A362C', roughness: 0.72 });
  const matBristleTip = new THREE.MeshStandardMaterial({ color: '#F5E6DC', roughness: 0.68 });

  const add = (geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.scale.set(sx, sy, sz);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    return m;
  };

  // Shared Chic Blush-Cream Display Plinth with Rose-Gold Rim
  add(new THREE.CylinderGeometry(0.92, 0.98, 0.12, 36), matCream, 0, -0.96, 0);
  add(new THREE.CylinderGeometry(0.95, 0.95, 0.035, 36), matAccent, 0, -0.89, 0);

  if (id === 'ledmask') {
    // Stand column for LED Mask
    add(new THREE.CylinderGeometry(0.05, 0.07, 0.95, 18), matAccent, -0.22, -0.42, -0.12);
    // Sculpted 3D Photon LED Facial Mask dome
    add(new THREE.SphereGeometry(0.58, 28, 24), matPrimary, -0.22, 0.22, 0.04, 0, 0, 0, 0.86, 1.12, 0.52);
    // Glowing LED therapy strips & eye/lip contours
    for (const sx of [-1, 1]) {
      add(new THREE.TorusGeometry(0.12, 0.025, 10, 22), matAccent, -0.22 + sx * 0.19, 0.32, 0.31, 0, sx * 0.22, 0);
      add(new THREE.SphereGeometry(0.032, 10, 10), matBulb, -0.22 + sx * 0.26, 0.12, 0.29);
      add(new THREE.SphereGeometry(0.032, 10, 10), matBulb, -0.22 + sx * 0.18, 0.48, 0.27);
    }
    add(new THREE.TorusGeometry(0.11, 0.022, 10, 20), matAccent, -0.22, -0.02, 0.31, 0.15, 0, 0, 1.35, 0.65, 1);

    // Rose Quartz Dual-Ended Facial Roller on the right
    const rx = 0.48;
    add(new THREE.CylinderGeometry(0.038, 0.045, 0.96, 18), matAccent, rx, 0.02, 0.10, 0, 0, -0.18);
    add(new THREE.CylinderGeometry(0.055, 0.055, 0.52, 20), matPrimary, rx, -0.12, 0.10, 0, 0, -0.18);
    // Top large quartz roller stone + U-frame
    add(new THREE.TorusGeometry(0.18, 0.022, 10, 22, Math.PI), matAccent, rx - 0.09, 0.52, 0.10, 0, 0, -0.18);
    add(new THREE.CylinderGeometry(0.11, 0.11, 0.28, 20), matPrimary, rx - 0.10, 0.62, 0.10, 0, 0, Math.PI / 2 - 0.18);
    // Bottom small under-eye quartz roller
    add(new THREE.CylinderGeometry(0.075, 0.075, 0.18, 18), matPrimary, rx + 0.09, -0.52, 0.10, 0, 0, Math.PI / 2 - 0.18);
  } else if (id === 'brushes') {
    // Fluted Cylindrical Brush Cup Holder
    add(new THREE.CylinderGeometry(0.46, 0.42, 0.86, 28), matPrimary, 0, -0.44, 0);
    add(new THREE.CylinderGeometry(0.475, 0.475, 0.06, 28), matAccent, 0, -0.02, 0);
    for (let k = 0; k < 16; k++) {
      const ang = (k / 16) * Math.PI * 2;
      add(new THREE.CylinderGeometry(0.045, 0.042, 0.82, 10), matPrimary, Math.cos(ang) * 0.44, -0.44, Math.sin(ang) * 0.44);
    }
    // Fan of 7 Pro Makeup Brushes rising from the cup
    const brushConfigs = [
      [-0.24, 0.08, 0.22, -0.12, 0.18, 0.22],
      [0.0, 0.0, 0.0, 0.0, 0.22, 0.26],
      [0.24, -0.06, -0.22, 0.10, 0.17, 0.20],
      [-0.14, -0.16, 0.14, 0.18, 0.14, 0.18],
      [0.15, 0.16, -0.14, -0.18, 0.15, 0.19],
      [-0.04, 0.20, 0.06, -0.22, 0.12, 0.16],
      [0.06, -0.20, -0.06, 0.22, 0.12, 0.16]
    ];
    for (const [bx, bz, rz, rx, brR, brH] of brushConfigs) {
      add(new THREE.CylinderGeometry(0.038, 0.032, 0.78, 14), matCream, bx, 0.22, bz, rx, 0, rz);
      add(new THREE.CylinderGeometry(0.042, 0.038, 0.24, 14), matAccent, bx - Math.sin(rz) * 0.32, 0.56, bz + Math.sin(rx) * 0.32, rx, 0, rz);
      add(new THREE.SphereGeometry(brR, 18, 16), matBristleDark, bx - Math.sin(rz) * 0.52, 0.78, bz + Math.sin(rx) * 0.52, rx, 0, rz, 1.0, brH / brR, 0.78);
      add(new THREE.SphereGeometry(brR * 0.92, 16, 14), matBristleTip, bx - Math.sin(rz) * 0.58, 0.86, bz + Math.sin(rx) * 0.58, rx, 0, rz, 0.95, 0.55, 0.72);
    }
  } else if (id === 'dryer') {
    // Weighted Rose-Gold Display Stand
    add(new THREE.CylinderGeometry(0.38, 0.42, 0.08, 28), matAccent, 0, -0.84, 0);
    // Ergonomic Vertical Handle
    add(new THREE.CylinderGeometry(0.11, 0.10, 1.02, 24), matCream, 0, -0.28, 0);
    add(new THREE.CylinderGeometry(0.116, 0.116, 0.08, 24), matAccent, 0, 0.18, 0);
    // High-Speed Supersonic Cylindrical Barrel with Hollow Ring Center
    add(new THREE.CylinderGeometry(0.34, 0.34, 0.62, 28), matPrimary, 0, 0.48, 0, 0, 0, Math.PI / 2);
    add(new THREE.CylinderGeometry(0.35, 0.35, 0.08, 28), matAccent, -0.28, 0.48, 0, 0, 0, Math.PI / 2);
    add(new THREE.CylinderGeometry(0.20, 0.20, 0.66, 24), matMirror, 0, 0.48, 0, 0, 0, Math.PI / 2);
    // Magnetic Smoothing Styler Nozzle on the front (+X)
    add(new THREE.CylinderGeometry(0.22, 0.28, 0.24, 24), matAccent, 0.40, 0.48, 0, 0, 0, Math.PI / 2);
    add(new THREE.BoxGeometry(0.14, 0.44, 0.14), matPrimary, 0.52, 0.48, 0);
  } else if (id === 'perfume') {
    // Faceted Crystal Eau de Parfum Bottle Body
    add(new THREE.BoxGeometry(0.88, 0.96, 0.46), matPrimary, 0, -0.32, 0);
    add(new THREE.BoxGeometry(0.76, 0.84, 0.52), matPrimary, 0, -0.32, 0);
    // Front Ivory & Gold Framed Label Plate
    add(new THREE.BoxGeometry(0.56, 0.48, 0.04), matAccent, 0, -0.30, 0.26);
    add(new THREE.BoxGeometry(0.50, 0.42, 0.05), matCream, 0, -0.30, 0.265);
    // Golden Collar & Atomizer Neck
    add(new THREE.CylinderGeometry(0.16, 0.18, 0.18, 24), matAccent, 0, 0.25, 0);
    // Satin Bow Ribbon at the neck
    add(new THREE.BoxGeometry(0.46, 0.09, 0.12), matAccent, 0, 0.24, 0.14, 0, 0, 0.08);
    // Faceted Crystal Stopper Cap
    add(new THREE.BoxGeometry(0.42, 0.32, 0.30), matMirror, 0, 0.48, 0);
    add(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 16), matAccent, 0, 0.34, 0);
  } else if (id === 'mirror') {
    // Weighted Vanity Base + Swivel U-Frame
    add(new THREE.BoxGeometry(1.18, 0.09, 0.46), matAccent, 0, -0.82, 0);
    add(new THREE.CylinderGeometry(0.04, 0.04, 1.15, 16), matAccent, -0.56, -0.22, 0);
    add(new THREE.CylinderGeometry(0.04, 0.04, 1.15, 16), matAccent, 0.56, -0.22, 0);
    // Hollywood Vanity Mirror Frame
    add(new THREE.BoxGeometry(1.04, 1.32, 0.10), matPrimary, 0, 0.08, 0);
    add(new THREE.BoxGeometry(0.82, 1.10, 0.11), matMirror, 0, 0.08, 0.01);
    // 12 Glowing Hollywood LED Vanity Bulbs around the perimeter
    const bulbPositions = [
      [-0.44, 0.64], [0, 0.64], [0.44, 0.64],
      [-0.44, 0.26], [0.44, 0.26],
      [-0.44, -0.10], [0.44, -0.10],
      [-0.44, -0.48], [0, -0.48], [0.44, -0.48]
    ];
    for (const [bx, by] of bulbPositions) {
      add(new THREE.SphereGeometry(0.055, 14, 12), matBulb, bx, 0.08 + by, 0.075);
    }
    // Touch sensor dimmer circle on mirror glass
    add(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 18), matAccent, 0, -0.34, 0.065, Math.PI / 2, 0, 0);
  } else {
    // Hydrating Glow Serum Dropper Bottle (Left) + Ceramide Cream Jar (Right)
    const sx = -0.34;
    add(new THREE.CylinderGeometry(0.28, 0.28, 0.82, 28), matPrimary, sx, -0.42, 0.04);
    add(new THREE.SphereGeometry(0.28, 24, 16), matPrimary, sx, -0.02, 0.04, 0, 0, 0, 1, 0.45, 1);
    add(new THREE.BoxGeometry(0.36, 0.46, 0.04), matCream, sx, -0.42, 0.31);
    // Gold dropper collar & white rubber pipette bulb
    add(new THREE.CylinderGeometry(0.13, 0.14, 0.16, 22), matAccent, sx, 0.16, 0.04);
    add(new THREE.CylinderGeometry(0.08, 0.09, 0.26, 20), matCream, sx, 0.36, 0.04);
    add(new THREE.SphereGeometry(0.08, 16, 14), matCream, sx, 0.49, 0.04);

    // Frosted Moisturizer Jar (Right)
    const jx = 0.38;
    add(new THREE.CylinderGeometry(0.36, 0.34, 0.48, 28), matPrimary, jx, -0.60, 0.08);
    add(new THREE.CylinderGeometry(0.37, 0.37, 0.15, 28), matAccent, jx, -0.30, 0.08);
    add(new THREE.BoxGeometry(0.42, 0.24, 0.04), matCream, jx, -0.60, 0.43);
  }

  g.userData.matPrimary = matPrimary;
  g.userData.matAccent = matAccent;
  return g;
}

function cubicBezierEase(p) {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
}

export function createGlowStudioSystem({ camera, controls, stores, chime }) {
  let active = false;
  let state = 'HOME'; // 'HOME' | 'MENU_GRID' | 'PRODUCT_3D' | 'TREATMENTS' | 'MY_BAG'
  let filterCat = 'ALL'; // 'ALL' | 'BEAUTY TOOLS' | 'MAKEUP' | 'SKINCARE' | 'HAIR CARE' | 'FRAGRANCE'
  let selectedItem = GLOW_ITEMS[0];
  let selectedSizeIdx = 1;
  let selectedShadeIdx = 0;
  let selectedQty = 1;
  const _defGs = GLOW_ITEMS[0];
  const _defGsSh = _defGs?.shades?.[0] || { name: 'Rose Quartz', hex: '#F2C6C2', accent: '#E5B568' };
  const _defGsSz = _defGs?.sizes?.[1] || _defGs?.sizes?.[0] || { label: 'Full Size', mult: 1 };
  const bag = _defGs
    ? [
        {
          key: `${_defGs.id}__${_defGsSz.label}__${_defGsSh.name}`,
          id: _defGs.id,
          name: _defGs.name,
          size: _defGsSz.label,
          shadeName: _defGsSh.name,
          shadeHex: _defGsSh.hex,
          accentHex: _defGsSh.accent,
          unitPrice: Math.round(_defGs.basePrice * (_defGsSz.mult || 1)),
          qty: 1,
          insured: true
        }
      ]
    : [];
  let savedVillageRotY = null;

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
    dur: 750
  };

  const cachedCenter = new THREE.Vector3();
  let cachedMaxY = 4.5;
  let checkoutComplete = false;

  function applyCurrentViewOffset() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (w <= 767 || (Math.abs(camAnim.curOffsetX) < 0.0005 && Math.abs(camAnim.curOffsetY) < 0.0005)) {
      camera.clearViewOffset();
    } else {
      camera.setViewOffset(w, h, w * camAnim.curOffsetX, h * camAnim.curOffsetY, w, h);
    }
  }

  function updateGlowCamera(targetState, instant = false) {
    const st = stores[0]; // Store #1: Glow Studio
    if (!st) return;
    const g = st.g;

    // 1. Keep building group at scale (1, 1, 1) and set 3/4 Right-Front orientation (identical to Strawberry Corner)
    g.scale.set(1, 1, 1);
    g.rotation.y = 0.95;
    g.updateMatrixWorld(true);

    // 2. Automatic Bounding Box from Sidewalk Curb to Rooftop Lounge (identical to Strawberry Corner)
    const box = new THREE.Box3().setFromObject(g);
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
    } else if (targetState === 'MENU_GRID' || targetState === 'PRODUCT_3D' || targetState === 'TREATMENTS') {
      dist = isTabletViewport ? baseDist * 2.68 : baseDist * 2.22;
      targetOffsetX = isTabletViewport ? 0.40 : 0.37;
      targetOffsetY = isTabletViewport ? -0.16 : -0.12;
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
    updateGlowCamera(state, true);
  });

  // Dedicated WebGL Renderer for the 360° 3D Beauty Product Showcase
  let prodRenderer = null;
  let prodScene = null;
  let prodCamera = null;
  let activeProdGroup = null;
  let prodDragging = false;
  let prodLastX = 0;
  let prodLastY = 0;
  let prodRotY = 0.35;
  let prodRotX = 0.12;

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
      prodCamera.position.set(0, 0.32, 4.85);
      prodCamera.lookAt(0, -0.06, 0);

      prodScene.add(new THREE.AmbientLight('#fff6f0', 1.65));
      const keyLight = new THREE.DirectionalLight('#fff2e4', 2.25);
      keyLight.position.set(3.2, 5.2, 4.2);
      prodScene.add(keyLight);
      const rimLight = new THREE.DirectionalLight('#f8d4cc', 1.25);
      rimLight.position.set(-3.5, 2.2, -2.5);
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
      const endDrag = () => { prodDragging = false; };
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

  function mountProduct3D(item, shadeIdx = selectedShadeIdx) {
    if (UI_ONLY) {
      const s = item.shades[shadeIdx] || item.shades[0];
      mountStaticProductArt(staticArtHost, glowProductSVG(item.id, s.hex, s.accent));
      return;
    }
    if (!prodScene) return;
    if (activeProdGroup) {
      prodScene.remove(activeProdGroup);
      activeProdGroup = null;
    }
    const sObj = item.shades[shadeIdx] || item.shades[0];
    activeProdGroup = buildGlow3DProduct(item.id, sObj.hex, sObj.accent);
    if (item.model3dUrl) {
      attachCustomModel3DToGroup(activeProdGroup, item.model3dUrl, 1.7);
    }
    activeProdGroup.scale.setScalar(0.84);
    activeProdGroup.position.set(0, 0.12, 0);
    prodRotY = 0.35;
    prodRotX = 0.12;
    activeProdGroup.rotation.set(prodRotX, prodRotY, 0);
    prodScene.add(activeProdGroup);
  }

  // Root DOM Overlay
  const overlay = document.createElement('div');
  overlay.id = 'glow-studio-overlay';
  overlay.className = 'sc-overlay';
  overlay.style.display = 'none';
  document.getElementById('app')?.appendChild(overlay);

  let onExitCallback = null;

  function bagCount() {
    return bag.reduce((s, it) => s + it.qty, 0);
  }

  function addToBag(item, sizeIdx = 1, shadeIdx = 0, qty = 1) {
    const sz = item.sizes[sizeIdx] || item.sizes[1];
    const sh = item.shades[shadeIdx] || item.shades[0];
    const unitPrice = Math.round(item.basePrice * (sz.mult || 1));
    const key = `${item.id}__${sz.label}__${sh.name}`;
    const existing = bag.find(b => b.key === key);
    if (existing) {
      existing.qty += qty;
    } else {
      bag.push({
        key,
        id: item.id,
        name: item.name,
        size: sz.label,
        shadeName: sh.name,
        shadeHex: sh.hex,
        accentHex: sh.accent,
        unitPrice,
        qty
      });
    }
    chime?.(680, 0.09);
  }

  function setState(nextState, opts = {}) {
    state = nextState;
    if (opts.item) {
      selectedItem = opts.item;
      selectedSizeIdx = 1;
      selectedShadeIdx = 0;
      selectedQty = 1;
    }
    if (nextState !== 'MY_BAG') {
      checkoutComplete = false;
    }
    updateGlowCamera(state, !!opts.instant);
    renderOverlay();
    chime?.(540, 0.08);
  }

  function renderStateContent() {
    const cfg = GLOW_CATALOG;
    const themeColor = cfg.themeColor || '#C87D72';
    const noteLines = cfg.noteLines || ['Radiant', 'Skincare <span>♥</span>', 'Parisian Glow'];
    const bestsellers = GLOW_ITEMS.slice(0, 4);
    const extraItems = GLOW_ITEMS.slice(2, 6);

    if (state === 'HOME') {
      return `
        <aside class="sc-left-home">
          <h1 class="sc-calligraphy">${cfg.leftCalligraphy || 'Everyday<br>Parisian<br>Glow'}</h1>
          <p class="sc-kicker">${cfg.leftKicker || 'SKINCARE &nbsp;·&nbsp; GLOW &nbsp;·&nbsp; PARISIAN'}</p>

          <div class="sc-vmenu">
            <button type="button" class="sc-vbtn on" data-gs-nav="HOME"><span>HOME</span> <i>›</i></button>
            <button type="button" class="sc-vbtn" data-gs-nav="MENU_GRID"><span>MENU</span> <i>›</i></button>
            <button type="button" class="sc-vbtn" data-gs-nav="PRODUCT_3D"><span>SHOP</span> <i>›</i></button>
            <button type="button" class="sc-vbtn" data-gs-nav="TREATMENTS"><span>EVENTS</span> <i>›</i></button>
            <button type="button" class="sc-vbtn" data-gs-nav="MY_BAG"><span>MY BAG (${bagCount()})</span> <i>›</i></button>
          </div>

          <div class="sc-note-card">
            <div class="sc-note-pin" style="background:${themeColor};"></div>
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
              <span class="sc-eyebrow" style="color:${themeColor};">${cfg.heroEyebrow || 'SEASON SPECIAL'}</span>
              <h2>${cfg.heroHeadline || 'Everyday<br>Glow <span>♥</span>'}</h2>
              <p>${cfg.heroSub || 'RADIANT DAILY CARE'}</p>
              <button type="button" class="sc-pill-cta" id="gs-open-catalog" style="background:${themeColor};">${cfg.ctaLabel || 'Lihat &amp; Pesan Produk →'}</button>
            </div>
            <div class="sc-hero-art">
              ${glowProductSVG('mirror', '#FAF3EB', '#E2B262')}
              <canvas class="sc-hero-building-canvas" width="240" height="240" aria-hidden="true"></canvas>
            </div>
          </div>

          <!-- Card 2: Bestsellers 3D -->
          <div class="sc-card">
            <div class="sc-card-head">
              <span>${cfg.bestsellersTitle || 'OUR BESTSELLERS'}</span>
              <button type="button" class="sc-link-btn" data-gs-nav="MENU_GRID" style="color:${themeColor};">VIEW ALL →</button>
            </div>
            <div class="sc-mini-grid">
              ${bestsellers
                .map(
                  it => `
                <button type="button" class="sc-mini-item" data-gs-pick="${it.id}">
                  <div class="sc-mini-thumb">${glowProductSVG(it.id, it.shades[0].hex, it.shades[0].accent)}</div>
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
              <span>${cfg.featuredTitle || 'FEATURED GOODS'}</span>
              <button type="button" class="sc-link-btn" data-gs-nav="PRODUCT_3D" style="color:${themeColor};">SHOP NOW →</button>
            </div>
            <div class="sc-mini-grid">
              ${extraItems
                .map(
                  it => `
                <button type="button" class="sc-mini-item" data-gs-pick="${it.id}">
                  <div class="sc-mini-thumb">${glowProductSVG(it.id, it.shades[0].hex, it.shades[0].accent)}</div>
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
      const cats = ['ALL', 'BEAUTY TOOLS', 'MAKEUP', 'SKINCARE', 'HAIR CARE', 'FRAGRANCE'];
      const filtered = filterCat === 'ALL' ? GLOW_ITEMS : GLOW_ITEMS.filter(i => i.cat === filterCat);

      return `
        <aside class="sc-left-sub">
          <button type="button" class="sc-back-link" data-gs-nav="HOME">← KEMBALI KE BERANDA TOKO</button>
          <h1 class="sc-calligraphy-sm">Katalog</h1>
          <p class="sc-kicker">BEAUTY &nbsp;·&nbsp; SKINCARE &nbsp;·&nbsp; MAKEUP TOOLS</p>
        </aside>

        <section class="sc-right-panel sc-card">
          <div class="sc-menu-bar">
            <span class="sc-section-tag">KATALOG GLOW STUDIO — KLIK PRODUK UNTUK PREVIEW 360°</span>
            <div class="sc-filter-pills">
              ${cats
                .map(
                  c => `
                <button type="button" class="${filterCat === c ? 'on' : ''}" data-gs-filter="${c}" style="${filterCat === c ? 'background:#C87D72;border-color:#C87D72;color:#FFFDF9;' : ''}">
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
              <article class="sc-menu-card" data-gs-card="${it.id}">
                <div class="sc-menu-art">${glowProductSVG(it.id, it.shades[0].hex, it.shades[0].accent)}</div>
                <h3>${it.name}</h3>
                <p>${it.sub}</p>
                <div class="sc-menu-foot">
                  <strong>${formatIDR(it.basePrice)}</strong>
                  <button type="button" class="sc-plus-btn" data-gs-quick-add="${it.id}" title="Tambah ke Keranjang">+</button>
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
      const it = selectedItem || GLOW_ITEMS[0];
      const sz = it.sizes[selectedSizeIdx] || it.sizes[1];
      const sh = it.shades[selectedShadeIdx] || it.shades[0];
      const unitPrice = Math.round(it.basePrice * (sz.mult || 1));
      const totalPrice = unitPrice * selectedQty;
      const tokopediaUrl = `https://www.tokopedia.com/search?st=product&q=${encodeURIComponent('Glow Studio ' + it.name + ' ' + sh.name)}`;

      return `
        <aside class="sc-left-sub">
          <button type="button" class="sc-back-link" data-gs-nav="HOME">← KEMBALI KE BERANDA TOKO</button>
          <h1 class="sc-calligraphy-sm">Pesan Produk</h1>
          <p class="sc-kicker">PUTAR 360° &nbsp;·&nbsp; PILIH SHADE &amp; UKURAN</p>
        </aside>

        <section class="sc-right-panel sc-card sc-showcase-card">
          <div class="sc-showcase-top-bar">
            <button type="button" class="sc-back-treats" data-gs-nav="MENU_GRID">← SEMUA KATALOG (${GLOW_ITEMS.length})</button>
          </div>
          <div class="sc-showcase-split">
            <div class="sc-showcase-3d">
              <div class="sc-canvas-wrap" id="gs-prod-canvas-slot"></div>
              <span class="sc-drag-hint">‹ &nbsp; drag untuk memutar produk 360° &nbsp; ›</span>
            </div>

            <div class="sc-showcase-info">
              <span class="sc-prod-cat" style="color:#C87D72;">${it.cat} · ${sh.name.toUpperCase()}</span>
              <h2 class="sc-prod-title">${it.name}</h2>
              <strong class="sc-prod-price" style="color:#C87D72;">${formatIDR(totalPrice)}</strong>
              <p class="sc-prod-desc">${it.desc}</p>

              <div class="at-option-block">
                <small class="at-option-label">PILIH SHADE / VARIAN WARNA: <b>${sh.name}</b></small>
                <div class="at-swatch-row">
                  ${it.shades
                    .map(
                      (c, idx) => `
                    <button type="button" class="at-swatch-btn ${idx === selectedShadeIdx ? 'on' : ''}" data-gs-shade="${idx}">
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
                  <button type="button" class="sc-size-btn ${idx === selectedSizeIdx ? 'on' : ''}" data-gs-size="${idx}">
                    ${s.label}
                  </button>
                `
                  )
                  .join('')}
              </div>

              <div class="sc-buy-row">
                <div class="sc-qty-box">
                  <button type="button" id="gs-qty-dec">−</button>
                  <span id="gs-qty-val">${selectedQty}</span>
                  <button type="button" id="gs-qty-inc">+</button>
                </div>
                <button type="button" class="sc-add-bag-btn" id="gs-add-bag-main" style="background:#C87D72;">
                  + MASUKKAN KERANJANG
                </button>
              </div>
            </div>
          </div>

          <div class="sc-thumb-strip" style="grid-template-columns: repeat(${GLOW_ITEMS.length}, minmax(0, 1fr));">
            ${GLOW_ITEMS.map(
              m => `
              <button type="button" class="sc-thumb-btn ${m.id === it.id ? 'on' : ''}" data-gs-switch="${m.id}" title="${m.name}">
                <span class="sc-thumb-art">${glowProductSVG(m.id, m.shades[0].hex, m.shades[0].accent)}</span>
                <span class="sc-thumb-label">${m.name}</span>
              </button>
            `
            ).join('')}
          </div>
        </section>
      `;
    }

    if (state === 'TREATMENTS') {
      return `
        <aside class="sc-left-sub">
          <button type="button" class="sc-back-link" data-gs-nav="HOME">← KEMBALI KE BERANDA TOKO</button>
          <h1 class="sc-calligraphy-sm">Beauty Bar</h1>
          <p class="sc-kicker">ROOFTOP LOUNGE &amp; SKINCARE RITUALS</p>
        </aside>

        <section class="sc-right-panel sc-card sc-treatments-panel">
          <div class="sc-menu-bar">
            <span class="sc-section-tag">GLOW STUDIO BEAUTY BAR &amp; ROOFTOP LOUNGE RITUALS</span>
          </div>
          <div class="sc-basket-list sc-ritual-list">
            ${GLOW_TREATMENTS.map(
              (tr, idx) => `
              <div class="sc-basket-row sc-ritual-row">
                <div class="sc-basket-info sc-ritual-info">
                  <span class="sc-eyebrow sc-ritual-eyebrow" style="color:#C87D72;">${tr.date}</span>
                  <b class="sc-ritual-title">${tr.title}</b>
                  <small class="sc-ritual-sub">${tr.sub}</small>
                </div>
                <button type="button" class="sc-pill-cta sc-ritual-cta" data-gs-ritual="${idx}" style="background:#C87D72;flex:none;">
                  ${tr.badge} →
                </button>
              </div>
            `
            ).join('')}
          </div>
        </section>
      `;
    }

    // STATE 5: MY_BAG & RECEIPT (1:1 Blibli Checkout Anatomy + Warm Boutique Cerria Town)
    const queryItems = bag.map(it => `${it.name} (${it.shadeName}, ${it.size})`).join(' ');
    const tokopediaCheckoutUrl = `https://www.tokopedia.com/search?st=product&q=${encodeURIComponent('Glow Studio Beauty ' + (queryItems || 'Skincare LED Mask'))}`;

    const checkoutItems = bag.map((it, idx) => ({
      id: it.id,
      name: it.name,
      variantLabel: `${it.shadeName} · ${it.size}`,
      unitPrice: it.unitPrice,
      qty: it.qty,
      insured: it.insured !== false,
      stockLeft: idx === 0 ? 4 : ((idx % 4) + 2),
      svgHtml: glowProductSVG(it.id, it.shadeHex, it.accentHex)
    }));

    const recSource = GLOW_ITEMS.filter(m => !bag.some(b => b.id === m.id));
    const recPool = (recSource.length >= 3 ? recSource : GLOW_ITEMS).slice(0, 3);
    const recommendations = recPool.map((m, rIdx) => {
      const sh = m.shades?.[0] || { hex: '#F2C6C2', accent: '#E5B568' };
      const discBadges = ['40%', '20%', null];
      return {
        id: m.id,
        name: m.name,
        price: m.basePrice,
        discountBadge: discBadges[rIdx % discBadges.length],
        svgHtml: glowProductSVG(m.id, sh.hex, sh.accent)
      };
    });

    return renderCerriaCheckoutStage({
      storeId: 'toko1',
      storeName: 'Glow Studio Flagship Store',
      storeLocation: 'Distrik #1, Cerria Town',
      themeColor: '#d9534f',
      items: checkoutItems,
      recommendations,
      checkoutComplete,
      tokopediaUrl: tokopediaCheckoutUrl
    });
  }

  function renderOverlay() {
    const cfg = GLOW_CATALOG;
    const themeColor = cfg.themeColor || '#C87D72';
    const brandTitle = cfg.brandTitle || 'Glow Studio';
    const brandSub = (cfg.brandSub || 'BEAUTY STUDIO').split('·')[0].trim();
    const count = bagCount();
    const isBottomLeft = state === 'MENU_GRID' || state === 'PRODUCT_3D' || state === 'TREATMENTS';
    const exitBtnLabel = state === 'HOME' ? '← Kembali ke Kota' : '← Kembali';

    overlay.dataset.state = state;
    overlay.innerHTML = `
      <div class="sc-backdrop ${isBottomLeft ? 'mode-bl' : 'mode-center'}"></div>

      <!-- Top Header Navigation (100% identical to Strawberry Corner) -->
      <header class="sc-topbar">
        <div class="sc-brand-wrap">
          <button type="button" class="sc-exit-btn" id="gs-exit-village">${exitBtnLabel}</button>
          <div class="sc-logo" id="gs-logo-home">
            <span class="sc-logo-berry">
              ${glowProductSVG('mirror', '#FAF3EB', '#E2B262')}
            </span>
            <div>
              <strong>${brandTitle}</strong>
              <small>${brandSub}</small>
            </div>
          </div>
        </div>

        <nav class="sc-topnav" aria-label="Navigasi Glow Studio">
          <button type="button" class="${state === 'HOME' ? 'on' : ''}" data-gs-nav="HOME">🏠 Home</button>
          <button type="button" class="${state === 'MENU_GRID' ? 'on' : ''}" data-gs-nav="MENU_GRID">☕ Katalog</button>
          <button type="button" class="${state === 'PRODUCT_3D' ? 'on' : ''}" data-gs-nav="PRODUCT_3D">🛍️ Shop</button>
          <button type="button" class="${state === 'TREATMENTS' ? 'on' : ''}" data-gs-nav="TREATMENTS">📅 Events</button>
          <button type="button" class="${state === 'MY_BAG' ? 'on' : ''}" data-gs-nav="MY_BAG">🛒 My Bag (${count})</button>
        </nav>

        <div class="sc-top-stats">
          <span class="sc-stat-pill"><i class="sc-dot-berry" style="background:${themeColor};"></i> 1,250 <b>+</b></span>
          <span class="sc-stat-pill"><i class="sc-dot-heart" style="color:${themeColor};">♥</i> ${count}</span>
        </div>
      </header>

      <!-- Floating "you are here" indicator -->
      <div class="sc-you-are-here ${isBottomLeft ? 'on' : ''}" id="gs-here-marker">
        <span style="color:${themeColor};">you are here</span>
        <svg viewBox="0 0 48 48" width="34" height="34" fill="none">
          <path d="M14 6c10 8 14 20 12 34m0 0l-6-7m6 7l7-6" stroke="${themeColor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>

      <!-- Main Stage Area -->
      <div class="sc-stage">
        ${renderStateContent()}
      </div>

      <!-- Bottom Bar -->
      <footer class="sc-bottombar">
        <button type="button" class="sc-exit-btn sc-bottom-exit-btn" id="gs-exit-village-bottom">${exitBtnLabel}</button>
        <div class="sc-foot-brand">
          <span class="sc-dot-berry" style="background:${themeColor};"></span>
          <div>
            <b>${brandTitle}</b>
            <small>${brandSub}</small>
          </div>
        </div>
        <p class="sc-foot-quote">${cfg.footerQuote || 'Everyday Parisian Glow &amp; Rooftop Care.'} <span style="color:${themeColor};">♥</span></p>
        <div class="sc-foot-icons">
          <button type="button" class="${state === 'HOME' ? 'on' : ''}" data-gs-nav="HOME" title="Home">⌂</button>
          <button type="button" class="${state === 'PRODUCT_3D' ? 'on' : ''}" data-gs-nav="PRODUCT_3D" title="Shop">🛍</button>
          <button type="button" class="${state === 'MENU_GRID' ? 'on' : ''}" data-gs-nav="MENU_GRID" title="Menu">📦</button>
          <button type="button" class="${state === 'TREATMENTS' ? 'on' : ''}" data-gs-nav="TREATMENTS" title="Events">✨</button>
          <button type="button" class="${state === 'MY_BAG' ? 'on' : ''}" data-gs-nav="MY_BAG" title="My Bag">🛒</button>
        </div>
      </footer>
    `;

    if (state === 'PRODUCT_3D') {
      const slot = overlay.querySelector('#gs-prod-canvas-slot');
      if (slot) {
        ensureProdRenderer(slot);
        mountProduct3D(selectedItem || GLOW_ITEMS[0], selectedShadeIdx);
      }
    }

    const handleBackOrExit = () => {
      if (state === 'HOME') {
        exit();
      } else {
        setState('HOME');
      }
    };
    overlay.querySelector('#gs-exit-village')?.addEventListener('click', handleBackOrExit);
    overlay.querySelector('#gs-exit-village-bottom')?.addEventListener('click', handleBackOrExit);
    overlay.querySelector('#gs-logo-home')?.addEventListener('click', () => setState('HOME'));
    overlay.querySelectorAll('[data-gs-nav]').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-gs-nav');
        setState(target);
      });
    });

    overlay.querySelector('#gs-open-catalog')?.addEventListener('click', () => {
      setState('PRODUCT_3D', { item: selectedItem || GLOW_ITEMS[0] });
    });
    overlay.querySelectorAll('[data-gs-pick]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-gs-pick');
        const item = GLOW_ITEMS.find(m => m.id === id) || GLOW_ITEMS[0];
        setState('PRODUCT_3D', { item });
      });
    });

    overlay.querySelectorAll('[data-gs-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        filterCat = btn.getAttribute('data-gs-filter');
        chime?.(500, 0.06);
        renderOverlay();
      });
    });
    overlay.querySelectorAll('[data-gs-card]').forEach(card => {
      card.addEventListener('click', e => {
        if (e.target.closest('[data-gs-quick-add]')) return;
        const id = card.getAttribute('data-gs-card');
        const item = GLOW_ITEMS.find(m => m.id === id) || GLOW_ITEMS[0];
        setState('PRODUCT_3D', { item });
      });
    });
    overlay.querySelectorAll('[data-gs-quick-add]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const id = btn.getAttribute('data-gs-quick-add');
        const item = GLOW_ITEMS.find(m => m.id === id);
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

    overlay.querySelectorAll('[data-gs-shade]').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedShadeIdx = parseInt(btn.getAttribute('data-gs-shade'), 10) || 0;
        chime?.(580 + selectedShadeIdx * 35, 0.06);
        renderOverlay();
      });
    });

    overlay.querySelectorAll('[data-gs-size]').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedSizeIdx = parseInt(btn.getAttribute('data-gs-size'), 10) || 0;
        chime?.(540 + selectedSizeIdx * 40, 0.06);
        renderOverlay();
      });
    });

    overlay.querySelector('#gs-qty-dec')?.addEventListener('click', () => {
      selectedQty = Math.max(1, selectedQty - 1);
      renderOverlay();
    });
    overlay.querySelector('#gs-qty-inc')?.addEventListener('click', () => {
      selectedQty = Math.min(20, selectedQty + 1);
      renderOverlay();
    });

    overlay.querySelector('#gs-add-bag-main')?.addEventListener('click', e => {
      addToBag(selectedItem, selectedSizeIdx, selectedShadeIdx, selectedQty);
      const btn = e.currentTarget;
      btn.textContent = '✓ DITAMBAHKAN ♥';
      btn.classList.add('added');
      setTimeout(() => {
        if (state === 'PRODUCT_3D') renderOverlay();
      }, 900);
    });

    overlay.querySelectorAll('[data-gs-switch]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-gs-switch');
        const item = GLOW_ITEMS.find(m => m.id === id);
        if (item) {
          selectedItem = item;
          selectedSizeIdx = 1;
          selectedShadeIdx = 0;
          selectedQty = 1;
          chime?.(560, 0.07);
          renderOverlay();
        }
      });
    });

    overlay.querySelectorAll('[data-gs-ritual]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-gs-ritual'), 10) || 0;
        const item = GLOW_ITEMS[idx % GLOW_ITEMS.length];
        setState('PRODUCT_3D', { item });
      });
    });

    if (state === 'MY_BAG') {
      const queryItems = bag.map(it => `${it.name} (${it.shadeName}, ${it.size})`).join(' ');
      const tokopediaCheckoutUrl = `https://www.tokopedia.com/search?st=product&q=${encodeURIComponent('Glow Studio Beauty ' + (queryItems || 'Skincare LED Mask'))}`;
      bindCerriaCheckoutEvents(overlay, {
        storeId: 'toko1',
        items: bag,
        onDecrementItem: idx => {
          if (bag[idx]) {
            bag[idx].qty -= 1;
            if (bag[idx].qty <= 0) bag.splice(idx, 1);
            renderOverlay();
          }
        },
        onIncrementItem: idx => {
          if (bag[idx]) {
            bag[idx].qty += 1;
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
            bag[idx].qty += 1;
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
          const item = GLOW_ITEMS.find(m => m.id === recId);
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
          submitOrder('toko1', bag, { channel: 'web_modal', storeName: 'Glow Studio', paymentMethod });
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

  function enter(exitCb) {
    onExitCallback = exitCb;
    active = true;
    state = 'HOME';
    checkoutComplete = false;
    const st = stores[0];
    if (st?.g) {
      if (savedVillageRotY === null) {
        savedVillageRotY = st.g.rotation.y;
      }
      st.g.scale.set(1, 1, 1);
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
    active = false;
    overlay.style.display = 'none';
    document.getElementById('app')?.classList.remove('sc-mode-active');
    const st = stores[0];
    if (st?.g) {
      st.g.scale.set(1, 1, 1);
      if (savedVillageRotY !== null) {
        st.g.rotation.y = savedVillageRotY;
      }
      st.g.updateMatrixWorld(true);
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
    const rawP = Math.min(1, Math.max(0, elapsed / camAnim.dur));
    const e = cubicBezierEase(rawP);

    camAnim.curPos.lerpVectors(camAnim.fromPos, camAnim.toPos, e);
    camAnim.curTarget.lerpVectors(camAnim.fromTarget, camAnim.toTarget, e);
    camAnim.curOffsetX = camAnim.fromOffsetX + (camAnim.toOffsetX - camAnim.fromOffsetX) * e;
    camAnim.curOffsetY = camAnim.fromOffsetY + (camAnim.toOffsetY - camAnim.fromOffsetY) * e;

    if (stores[0]?.g) stores[0].g.scale.set(1, 1, 1);

    applyCurrentViewOffset();

    camera.position.copy(camAnim.curPos);
    controls.target.copy(camAnim.curTarget);
    camera.lookAt(controls.target);
    camera.updateMatrixWorld();

    if (state === 'MENU_GRID' || state === 'PRODUCT_3D' || state === 'TREATMENTS') {
      const marker = overlay.querySelector('#gs-here-marker');
      if (marker) {
        _proj.set(cachedCenter.x, cachedMaxY + 0.35, cachedCenter.z).project(camera);
        const sx = (_proj.x * 0.5 + 0.5) * window.innerWidth;
        const sy = (-_proj.y * 0.5 + 0.5) * window.innerHeight;
        marker.style.left = `${Math.max(48, Math.min(window.innerWidth * 0.32, sx))}px`;
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
    enter,
    exit,
    update
  };
}
