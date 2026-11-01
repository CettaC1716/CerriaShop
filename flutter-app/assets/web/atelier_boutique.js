import * as THREE from 'three';
import { storeCatalog, submitOrder } from './js/store-data-manager.js?v=124';
import { UI_ONLY, mountStaticProductArt } from './js/ui-mode.js?v=124';
import { renderCerriaCheckoutStage, bindCerriaCheckoutEvents } from './cerria_checkout.js?v=128';
import { attachCustomModel3DToGroup } from './js/custom-model-loader.js?v=1';

// ============================================================================
// ATELIER & BOUTIQUE (STORE #3) — 5-STATE CAMERA CHOREOGRAPHY & 3D FASHION STORE
// States: HOME | MENU_GRID | PRODUCT_3D | LOOKBOOK | MY_BAG
// ============================================================================

// Display data lives in /data/stores-data.json (toko3.catalog.*) — live, SWR-refreshed reference.
export const ATELIER_CATALOG = storeCatalog('toko3');
export const ATELIER_ITEMS = ATELIER_CATALOG.items;

// toko3.catalog.lookbooks in /data/stores-data.json
export const ATELIER_LOOKBOOKS = ATELIER_CATALOG.lookbooks;

const formatIDR = n => 'Rp ' + Math.round(n).toLocaleString('id-ID');

export function atelierProductSVG(id, primaryHex = '#C8A378', trimHex = '#4A3525') {
  switch (id) {
    case 'trench':
      return `<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="60" cy="60" r="46" fill="#F5EDE0"/>
        <path d="M56 16h8v10h-8z" fill="#8C623E"/>
        <path d="M40 28l12-4h16l12 4 10 38-10 4-6-22-4 50H50l-4-50-6 22-10-4 10-38z" fill="${primaryHex}" stroke="#2B2D2F" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M48 26l12 18 12-18" stroke="${trimHex}" stroke-width="2.5" stroke-linecap="round"/>
        <rect x="46" y="56" width="28" height="6" rx="2" fill="${trimHex}"/>
        <rect x="57" y="55" width="6" height="8" rx="1" stroke="#E5B548" stroke-width="2"/>
        <circle cx="55" cy="46" r="2" fill="${trimHex}"/><circle cx="65" cy="46" r="2" fill="${trimHex}"/>
        <circle cx="55" cy="68" r="2" fill="${trimHex}"/><circle cx="65" cy="68" r="2" fill="${trimHex}"/>
      </svg>`;
    case 'dress':
      return `<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="60" cy="60" r="46" fill="#F5EDE0"/>
        <path d="M48 24h24l-3 26 16 46H35l16-46-3-26z" fill="${primaryHex}" stroke="#2B2D2F" stroke-width="2.5" stroke-linejoin="round"/>
        <rect x="47" y="48" width="26" height="5" rx="2" fill="${trimHex}"/>
        <path d="M52 53l-8 43M60 53v43M68 53l8 43" stroke="#2B2D2F" stroke-width="1.6" stroke-opacity="0.45"/>
      </svg>`;
    case 'blazer':
      return `<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="60" cy="60" r="46" fill="#F5EDE0"/>
        <path d="M52 24h16l8 30H44l8-30z" fill="${trimHex}"/>
        <path d="M36 30l14-6 10 24 10-24 14 6 8 46-11 3-4-26-3 35H46l-3-35-4 26-11-3 8-46z" fill="${primaryHex}" stroke="#2B2D2F" stroke-width="2.5" stroke-linejoin="round"/>
        <circle cx="60" cy="58" r="2.3" fill="#E5B548"/><circle cx="60" cy="67" r="2.3" fill="#E5B548"/>
      </svg>`;
    case 'handbag':
      return `<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="60" cy="60" r="46" fill="#F5EDE0"/>
        <path d="M46 44c0-11 6-18 14-18s14 7 14 18" stroke="#2B2D2F" stroke-width="3.5" stroke-linecap="round"/>
        <rect x="32" y="44" width="56" height="44" rx="7" fill="${primaryHex}" stroke="#2B2D2F" stroke-width="2.5"/>
        <path d="M32 54l28 12 28-12" stroke="#2B2D2F" stroke-width="2.2"/>
        <rect x="55" y="59" width="10" height="10" rx="2" fill="${trimHex}" stroke="#2B2D2F" stroke-width="1.8"/>
      </svg>`;
    case 'hat':
      return `<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="60" cy="60" r="46" fill="#F5EDE0"/>
        <ellipse cx="60" cy="72" rx="42" ry="12" fill="${primaryHex}" stroke="#2B2D2F" stroke-width="2.5"/>
        <path d="M38 68c2-22 10-30 22-28 12-2 20 6 22 28" fill="${primaryHex}" stroke="#2B2D2F" stroke-width="2.5"/>
        <path d="M38 64c14 5 30 5 44 0v6c-14 5-30 5-44 0v-6z" fill="${trimHex}"/>
      </svg>`;
    default:
      return `<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="60" cy="60" r="46" fill="#F5EDE0"/>
        <path d="M38 32l12-5 10 18 10-18 12 5 9 42-11 3-4-24-3 35H47l-3-35-4 24-11-3 9-42z" fill="${primaryHex}" stroke="#2B2D2F" stroke-width="2.5" stroke-linejoin="round"/>
        <circle cx="60" cy="52" r="2.2" fill="${trimHex}"/><circle cx="60" cy="62" r="2.2" fill="${trimHex}"/><circle cx="60" cy="72" r="2.2" fill="${trimHex}"/>
      </svg>`;
  }
}

// ============================================================================
// DEDICATED 3D MANNEQUIN & APPAREL TURNTABLE BUILDER
// ============================================================================
function buildAtelier3DProduct(id, primaryHex, trimHex) {
  const g = new THREE.Group();
  const matPrimary = new THREE.MeshStandardMaterial({ color: primaryHex, roughness: 0.62 });
  const matTrim = new THREE.MeshStandardMaterial({ color: trimHex, roughness: 0.52 });
  const matMannequin = new THREE.MeshStandardMaterial({ color: '#EAE0CE', roughness: 0.72 });
  const matWood = new THREE.MeshStandardMaterial({ color: '#6E4B2E', roughness: 0.68 });
  const matBrass = new THREE.MeshStandardMaterial({ color: '#E2B24A', roughness: 0.28, metalness: 0.68 });
  const matDark = new THREE.MeshStandardMaterial({ color: '#26282A', roughness: 0.48, metalness: 0.35 });

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

  // Shared Tailored Mannequin Stand (Wooden Tripod Base + Brass Pole + Neck Finial)
  add(new THREE.CylinderGeometry(0.46, 0.52, 0.08, 28), matWood, 0, -1.08, 0);
  add(new THREE.CylinderGeometry(0.18, 0.24, 0.10, 20), matBrass, 0, -1.00, 0);
  add(new THREE.CylinderGeometry(0.045, 0.045, 1.85, 16), matBrass, 0, -0.05, 0);

  if (id === 'trench') {
    // Mannequin neck & wooden finial
    add(new THREE.CylinderGeometry(0.12, 0.14, 0.22, 20), matMannequin, 0, 0.92, 0);
    add(new THREE.SphereGeometry(0.10, 16, 14), matWood, 0, 1.08, 0);
    // Upper torso & structured shoulders of the Trench Coat
    add(new THREE.CylinderGeometry(0.44, 0.34, 0.72, 24), matPrimary, 0, 0.48, 0, 0, 0, 0, 1.15, 1, 0.68);
    // Flared lower trench coat skirt
    add(new THREE.CylinderGeometry(0.35, 0.56, 0.96, 26), matPrimary, 0, -0.32, 0, 0, 0, 0, 1.12, 1, 0.72);
    // Tailored sleeves (left & right) + cuff straps
    for (const s of [-1, 1]) {
      add(new THREE.CylinderGeometry(0.13, 0.11, 0.88, 18), matPrimary, s * 0.56, 0.24, 0, 0, 0, -s * 0.18);
      add(new THREE.TorusGeometry(0.115, 0.022, 10, 20), matTrim, s * 0.62, -0.10, 0, Math.PI / 2, -s * 0.18, 0);
    }
    // Storm lapels & collar
    add(new THREE.BoxGeometry(0.22, 0.48, 0.06), matTrim, -0.14, 0.56, 0.24, 0, 0, -0.28);
    add(new THREE.BoxGeometry(0.22, 0.48, 0.06), matTrim, 0.14, 0.56, 0.24, 0, 0, 0.28);
    // Cinched waist belt + gold buckle
    add(new THREE.CylinderGeometry(0.37, 0.37, 0.11, 24), matTrim, 0, 0.12, 0, 0, 0, 0, 1.14, 1, 0.72);
    add(new THREE.BoxGeometry(0.14, 0.14, 0.05), matBrass, 0, 0.12, 0.26);
    // Double-breasted buttons
    for (const bx of [-0.11, 0.11]) {
      for (const by of [0.34, 0.12, -0.12, -0.36]) {
        add(new THREE.CylinderGeometry(0.032, 0.032, 0.03, 14), matBrass, bx, by, 0.26, Math.PI / 2, 0, 0);
      }
    }
  } else if (id === 'dress') {
    // Dress form neck & brass finial
    add(new THREE.CylinderGeometry(0.11, 0.13, 0.24, 20), matMannequin, 0, 0.94, 0);
    add(new THREE.SphereGeometry(0.09, 16, 14), matBrass, 0, 1.10, 0);
    // Fitted sleeveless bodice
    add(new THREE.CylinderGeometry(0.38, 0.28, 0.66, 24), matPrimary, 0, 0.52, 0, 0, 0, 0, 1.08, 1, 0.66);
    // Contrast waist sash & bow
    add(new THREE.CylinderGeometry(0.30, 0.30, 0.12, 24), matTrim, 0, 0.18, 0, 0, 0, 0, 1.10, 1, 0.68);
    add(new THREE.BoxGeometry(0.24, 0.10, 0.06), matTrim, 0, 0.18, 0.22);
    // Pleated A-line midi skirt
    add(new THREE.CylinderGeometry(0.30, 0.66, 1.04, 28), matPrimary, 0, -0.38, 0, 0, 0, 0, 1.08, 1, 0.76);
    for (let k = 0; k < 12; k++) {
      const ang = (k / 12) * Math.PI * 2;
      add(
        new THREE.BoxGeometry(0.06, 0.98, 0.06),
        k % 2 === 0 ? matPrimary : matTrim,
        Math.cos(ang) * 0.44,
        -0.38,
        Math.sin(ang) * 0.32,
        0,
        -ang,
        0
      );
    }
  } else if (id === 'blazer') {
    // Mannequin neck & crisp inner shirt collar
    add(new THREE.CylinderGeometry(0.12, 0.14, 0.24, 20), matMannequin, 0, 0.92, 0);
    add(new THREE.CylinderGeometry(0.34, 0.30, 0.68, 20), matTrim, 0, 0.48, 0, 0, 0, 0, 1.04, 1, 0.60);
    // Structured Tailored Wool Blazer torso
    add(new THREE.CylinderGeometry(0.45, 0.39, 0.92, 24), matPrimary, 0, 0.34, 0, 0, 0, 0, 1.16, 1, 0.68);
    // Sleeves
    for (const s of [-1, 1]) {
      add(new THREE.CylinderGeometry(0.135, 0.115, 0.86, 18), matPrimary, s * 0.57, 0.28, 0, 0, 0, -s * 0.15);
      add(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 16), matTrim, s * 0.63, -0.14, 0, 0, 0, -s * 0.15);
    }
    // Peak lapels & pocket flaps
    add(new THREE.BoxGeometry(0.18, 0.54, 0.05), matPrimary, -0.15, 0.50, 0.25, 0, 0, -0.26);
    add(new THREE.BoxGeometry(0.18, 0.54, 0.05), matPrimary, 0.15, 0.50, 0.25, 0, 0, 0.26);
    add(new THREE.BoxGeometry(0.24, 0.07, 0.04), matTrim, -0.24, 0.04, 0.25);
    add(new THREE.BoxGeometry(0.24, 0.07, 0.04), matTrim, 0.24, 0.04, 0.25);
    // 2 Brass blazer buttons
    add(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 14), matBrass, 0, 0.20, 0.26, Math.PI / 2, 0, 0);
    add(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 14), matBrass, 0, 0.02, 0.26, Math.PI / 2, 0, 0);
  } else if (id === 'handbag') {
    // Display pedestal top platform
    add(new THREE.CylinderGeometry(0.56, 0.56, 0.08, 28), matWood, 0, -0.42, 0);
    // Structured Artisan Leather Satchel body
    add(new THREE.BoxGeometry(1.12, 0.82, 0.44), matPrimary, 0, 0.04, 0);
    // Front curved flap
    add(new THREE.BoxGeometry(1.14, 0.36, 0.46), matPrimary, 0, 0.28, 0.01);
    // Contrast leather straps
    for (const sx of [-0.34, 0.34]) {
      add(new THREE.BoxGeometry(0.09, 0.84, 0.47), matTrim, sx, 0.04, 0);
    }
    // Brass turn-lock clasp
    add(new THREE.BoxGeometry(0.18, 0.16, 0.06), matBrass, 0, 0.10, 0.24);
    add(new THREE.CylinderGeometry(0.04, 0.04, 0.08, 14), matBrass, 0, 0.10, 0.27, Math.PI / 2, 0, 0);
    // Twin rolled leather top handles
    add(new THREE.TorusGeometry(0.26, 0.042, 12, 28, Math.PI), matDark, 0, 0.45, 0.08);
    add(new THREE.TorusGeometry(0.26, 0.042, 12, 28, Math.PI), matDark, 0, 0.45, -0.08);
  } else if (id === 'hat') {
    // Turned wooden hat stand dome
    add(new THREE.SphereGeometry(0.32, 20, 16), matWood, 0, 0.12, 0);
    // Wide curved fedora brim
    add(new THREE.CylinderGeometry(0.86, 0.88, 0.055, 36), matPrimary, 0, 0.26, 0, 0.08, 0, 0, 1.0, 1.0, 1.08);
    // Grosgrain ribbon band + brass pin
    add(new THREE.CylinderGeometry(0.47, 0.48, 0.12, 28), matTrim, 0, 0.34, 0, 0.08, 0, 0);
    add(new THREE.BoxGeometry(0.14, 0.12, 0.04), matBrass, 0.44, 0.35, 0.12, 0, 0.3, 0);
    // Sculpted fedora crown
    add(new THREE.CylinderGeometry(0.40, 0.46, 0.42, 28), matPrimary, 0, 0.52, 0, 0.08, 0, 0);
    add(new THREE.SphereGeometry(0.40, 24, 16), matPrimary, 0, 0.70, 0, 0, 0, 0, 1.0, 0.32, 1.05);
  } else {
    // Cashmere Knit Cardigan on mannequin torso
    add(new THREE.CylinderGeometry(0.12, 0.14, 0.22, 20), matMannequin, 0, 0.92, 0);
    add(new THREE.CylinderGeometry(0.34, 0.30, 0.68, 20), matMannequin, 0, 0.48, 0, 0, 0, 0, 1.04, 1, 0.60);
    add(new THREE.CylinderGeometry(0.44, 0.40, 0.88, 24), matPrimary, 0, 0.32, 0, 0, 0, 0, 1.14, 1, 0.68);
    for (const s of [-1, 1]) {
      add(new THREE.CylinderGeometry(0.13, 0.11, 0.84, 18), matPrimary, s * 0.55, 0.26, 0, 0, 0, -s * 0.16);
      add(new THREE.CylinderGeometry(0.112, 0.112, 0.09, 16), matTrim, s * 0.61, -0.14, 0, 0, 0, -s * 0.16);
    }
    // Ribbed center placket & wooden buttons
    add(new THREE.BoxGeometry(0.10, 0.86, 0.04), matTrim, 0, 0.32, 0.25);
    for (const by of [0.36, 0.16, -0.04, -0.24]) {
      add(new THREE.CylinderGeometry(0.034, 0.034, 0.03, 14), matWood, 0, by, 0.27, Math.PI / 2, 0, 0);
    }
  }

  g.userData.matPrimary = matPrimary;
  g.userData.matTrim = matTrim;
  return g;
}

function cubicBezierEase(p) {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
}

export function createAtelierBoutiqueSystem({ camera, controls, stores, chime }) {
  let active = false;
  let state = 'HOME'; // 'HOME' | 'MENU_GRID' | 'PRODUCT_3D' | 'LOOKBOOK' | 'MY_BAG'
  let filterCat = 'ALL'; // 'ALL' | 'OUTERWEAR' | 'DRESSES' | 'TAILORING' | 'ACCESSORIES'
  let selectedItem = ATELIER_ITEMS[0];
  let selectedSizeIdx = 1; // 'M'
  let selectedColorIdx = 0;
  let selectedQty = 1;
  const _defAt = ATELIER_ITEMS[0];
  const _defAtCol = _defAt?.colors?.[0] || { name: 'Warm Camel', hex: '#C8A378', trim: '#5C3E28' };
  const _defAtSz = _defAt?.sizes?.[1] || _defAt?.sizes?.[0] || { label: 'M' };
  const bag = _defAt
    ? [
        {
          key: `${_defAt.id}__${_defAtSz.label}__${_defAtCol.name}`,
          id: _defAt.id,
          name: _defAt.name,
          size: _defAtSz.label,
          colorName: _defAtCol.name,
          colorHex: _defAtCol.hex,
          trimHex: _defAtCol.trim,
          unitPrice: _defAt.basePrice,
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

  function updateAtelierCamera(targetState, instant = false) {
    const st = stores[2]; // Store #3: Atelier & Boutique
    if (!st) return;
    const g = st.g;

    // 1. Keep building group at scale (1, 1, 1) and set 3/4 Right-Front orientation (identical to Strawberry Corner)
    g.scale.set(1, 1, 1);
    g.rotation.y = 0.95;
    g.updateMatrixWorld(true);

    // 2. Automatic Bounding Box from Sidewalk Curb to Rooftop Billboard (identical to Strawberry Corner)
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
    } else if (targetState === 'MENU_GRID' || targetState === 'PRODUCT_3D' || targetState === 'LOOKBOOK') {
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
    updateAtelierCamera(state, true);
  });

  // Dedicated WebGL Renderer for the 360° 3D Mannequin & Apparel Showcase
  let prodRenderer = null;
  let prodScene = null;
  let prodCamera = null;
  let activeProdGroup = null;
  let prodDragging = false;
  let prodLastX = 0;
  let prodLastY = 0;
  let prodRotY = 0.38;
  let prodRotX = 0.08;

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
      prodCamera.lookAt(0, 0.02, 0);

      prodScene.add(new THREE.AmbientLight('#fff6ea', 1.55));
      const keyLight = new THREE.DirectionalLight('#fff2de', 2.2);
      keyLight.position.set(3.2, 5.2, 4.2);
      prodScene.add(keyLight);
      const rimLight = new THREE.DirectionalLight('#f4d2b8', 1.15);
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
        prodRotX = Math.max(-0.35, Math.min(0.45, prodRotX + dy * 0.008));
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

  function mountProduct3D(item, colorIdx = selectedColorIdx) {
    if (UI_ONLY) {
      const c = item.colors[colorIdx] || item.colors[0];
      mountStaticProductArt(staticArtHost, atelierProductSVG(item.id, c.hex, c.trim));
      return;
    }
    if (!prodScene) return;
    if (activeProdGroup) {
      prodScene.remove(activeProdGroup);
      activeProdGroup = null;
    }
    const cObj = item.colors[colorIdx] || item.colors[0];
    activeProdGroup = buildAtelier3DProduct(item.id, cObj.hex, cObj.trim);
    if (item.model3dUrl) {
      attachCustomModel3DToGroup(activeProdGroup, item.model3dUrl, 1.7);
    }
    prodRotY = 0.38;
    prodRotX = 0.08;
    activeProdGroup.rotation.set(prodRotX, prodRotY, 0);
    prodScene.add(activeProdGroup);
  }

  // Root DOM Overlay
  const overlay = document.createElement('div');
  overlay.id = 'atelier-boutique-overlay';
  overlay.className = 'sc-overlay';
  overlay.style.display = 'none';
  document.getElementById('app')?.appendChild(overlay);

  let onExitCallback = null;

  function bagCount() {
    return bag.reduce((s, it) => s + it.qty, 0);
  }

  function addToBag(item, sizeIdx = 1, colorIdx = 0, qty = 1) {
    const sz = item.sizes[sizeIdx] || item.sizes[1];
    const col = item.colors[colorIdx] || item.colors[0];
    const unitPrice = item.basePrice;
    const key = `${item.id}__${sz.label}__${col.name}`;
    const existing = bag.find(b => b.key === key);
    if (existing) {
      existing.qty += qty;
    } else {
      bag.push({
        key,
        id: item.id,
        name: item.name,
        size: sz.label,
        colorName: col.name,
        colorHex: col.hex,
        trimHex: col.trim,
        unitPrice,
        qty
      });
    }
    chime?.(660, 0.09);
  }

  function setState(nextState, opts = {}) {
    state = nextState;
    if (opts.item) {
      selectedItem = opts.item;
      selectedSizeIdx = 1;
      selectedColorIdx = 0;
      selectedQty = 1;
    }
    if (nextState !== 'MY_BAG') {
      checkoutComplete = false;
    }
    updateAtelierCamera(state, !!opts.instant);
    renderOverlay();
    chime?.(540, 0.08);
  }

  function renderStateContent() {
    const cfg = ATELIER_CATALOG;
    const themeColor = cfg.themeColor || '#A85D44';
    const noteLines = cfg.noteLines || ['Tailored', 'Silhouette <span>♥</span>', 'Modern Craft'];
    const bestsellers = ATELIER_ITEMS.slice(0, 4);
    const extraItems = ATELIER_ITEMS.slice(2, 6);

    if (state === 'HOME') {
      return `
        <aside class="sc-left-home">
          <h1 class="sc-calligraphy">${cfg.leftCalligraphy || 'Tailored<br>For Art<br>&amp; Style'}</h1>
          <p class="sc-kicker">${cfg.leftKicker || 'TAILORED &nbsp;·&nbsp; CRAFT &nbsp;·&nbsp; SILHOUETTE'}</p>

          <div class="sc-vmenu">
            <button type="button" class="sc-vbtn on" data-at-nav="HOME"><span>HOME</span> <i>›</i></button>
            <button type="button" class="sc-vbtn" data-at-nav="MENU_GRID"><span>MENU</span> <i>›</i></button>
            <button type="button" class="sc-vbtn" data-at-nav="PRODUCT_3D"><span>SHOP</span> <i>›</i></button>
            <button type="button" class="sc-vbtn" data-at-nav="LOOKBOOK"><span>EVENTS</span> <i>›</i></button>
            <button type="button" class="sc-vbtn" data-at-nav="MY_BAG"><span>MY BAG (${bagCount()})</span> <i>›</i></button>
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
              <h2>${cfg.heroHeadline || 'Tailored<br>Style <span>♥</span>'}</h2>
              <p>${cfg.heroSub || 'MODERN ARTISAN WEAR'}</p>
              <button type="button" class="sc-pill-cta" id="at-open-catalog" style="background:${themeColor};">${cfg.ctaLabel || 'Lihat &amp; Pesan Produk →'}</button>
            </div>
            <div class="sc-hero-art">
              ${atelierProductSVG('trench', '#C8A378', '#5C3E28')}
              <canvas class="sc-hero-building-canvas" width="240" height="240" aria-hidden="true"></canvas>
            </div>
          </div>

          <!-- Card 2: Bestsellers 3D -->
          <div class="sc-card">
            <div class="sc-card-head">
              <span>${cfg.bestsellersTitle || 'OUR BESTSELLERS'}</span>
              <button type="button" class="sc-link-btn" data-at-nav="MENU_GRID" style="color:${themeColor};">VIEW ALL →</button>
            </div>
            <div class="sc-mini-grid">
              ${bestsellers
                .map(
                  it => `
                <button type="button" class="sc-mini-item" data-at-pick="${it.id}">
                  <div class="sc-mini-thumb">${atelierProductSVG(it.id, it.colors[0].hex, it.colors[0].trim)}</div>
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
              <button type="button" class="sc-link-btn" data-at-nav="PRODUCT_3D" style="color:${themeColor};">SHOP NOW →</button>
            </div>
            <div class="sc-mini-grid">
              ${extraItems
                .map(
                  it => `
                <button type="button" class="sc-mini-item" data-at-pick="${it.id}">
                  <div class="sc-mini-thumb">${atelierProductSVG(it.id, it.colors[0].hex, it.colors[0].trim)}</div>
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
      const counts = {
        ALL: ATELIER_ITEMS.length,
        OUTERWEAR: ATELIER_ITEMS.filter(i => i.cat === 'OUTERWEAR').length,
        DRESSES: ATELIER_ITEMS.filter(i => i.cat === 'DRESSES').length,
        TAILORING: ATELIER_ITEMS.filter(i => i.cat === 'TAILORING').length,
        ACCESSORIES: ATELIER_ITEMS.filter(i => i.cat === 'ACCESSORIES').length
      };
      const filtered = filterCat === 'ALL' ? ATELIER_ITEMS : ATELIER_ITEMS.filter(i => i.cat === filterCat);

      return `
        <aside class="sc-left-sub">
          <button type="button" class="sc-back-link" data-at-nav="HOME">← KEMBALI KE BERANDA TOKO</button>
          <h1 class="sc-calligraphy-sm">Katalog</h1>
          <p class="sc-kicker">READY-TO-WEAR &nbsp;·&nbsp; TAILORING &nbsp;·&nbsp; LEATHER</p>
        </aside>

        <section class="sc-right-panel sc-card">
          <div class="sc-menu-bar">
            <span class="sc-section-tag">KOLEKSI UNGGULAN — PILIH KOLEKSI UNTUK PREVIEW 360°</span>
            <div class="sc-filter-pills">
              ${['ALL', 'OUTERWEAR', 'DRESSES', 'TAILORING', 'ACCESSORIES']
                .map(
                  c => `
                <button type="button" class="${filterCat === c ? 'on' : ''}" data-at-filter="${c}" style="${filterCat === c ? 'background:#A85D44;border-color:#A85D44;color:#FFFDF9;' : ''}">
                  ${c} <b>${counts[c]}</b>
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
              <article class="sc-menu-card" data-at-card="${it.id}">
                <div class="sc-menu-art">${atelierProductSVG(it.id, it.colors[0].hex, it.colors[0].trim)}</div>
                <h3>${it.name}</h3>
                <p>${it.sub}</p>
                <div class="sc-menu-foot">
                  <strong>${formatIDR(it.basePrice)}</strong>
                  <button type="button" class="sc-plus-btn" data-at-quick-add="${it.id}" title="Tambah ke Keranjang">+</button>
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
      const it = selectedItem || ATELIER_ITEMS[0];
      const sz = it.sizes[selectedSizeIdx] || it.sizes[1];
      const col = it.colors[selectedColorIdx] || it.colors[0];
      const totalPrice = it.basePrice * selectedQty;
      const tokopediaUrl = `https://www.tokopedia.com/search?st=product&q=${encodeURIComponent('Atelier Boutique ' + it.name + ' ' + col.name)}`;

      return `
        <aside class="sc-left-sub">
          <button type="button" class="sc-back-link" data-at-nav="HOME">← KEMBALI KE BERANDA TOKO</button>
          <h1 class="sc-calligraphy-sm">Pesan Produk</h1>
          <p class="sc-kicker">PUTAR MANEKIN 360° &nbsp;·&nbsp; PILIH WARNA &amp; UKURAN</p>
        </aside>

        <section class="sc-right-panel sc-card sc-showcase-card">
          <div class="sc-showcase-top-bar">
            <button type="button" class="sc-back-treats" data-at-nav="MENU_GRID">← SEMUA KOLEKSI (${ATELIER_ITEMS.length})</button>
          </div>
          <div class="sc-showcase-split">
            <div class="sc-showcase-3d">
              <div class="sc-canvas-wrap" id="at-prod-canvas-slot"></div>
              <span class="sc-drag-hint">‹ &nbsp; drag untuk memutar manekin 360° &nbsp; ›</span>
            </div>

            <div class="sc-showcase-info">
              <span class="sc-prod-cat" style="color:#A85D44;">${it.cat} · ${col.name.toUpperCase()}</span>
              <h2 class="sc-prod-title">${it.name}</h2>
              <strong class="sc-prod-price" style="color:#A85D44;">${formatIDR(totalPrice)}</strong>
              <p class="sc-prod-desc">${it.desc}</p>

              <div class="at-option-block">
                <small class="at-option-label">WARNA KAIN REAL-TIME: <b>${col.name}</b></small>
                <div class="at-swatch-row">
                  ${it.colors
                    .map(
                      (c, idx) => `
                    <button type="button" class="at-swatch-btn ${idx === selectedColorIdx ? 'on' : ''}" data-at-color="${idx}">
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
                  <button type="button" class="sc-size-btn ${idx === selectedSizeIdx ? 'on' : ''}" data-at-size="${idx}">
                    ${s.label}
                  </button>
                `
                  )
                  .join('')}
              </div>

              <div class="sc-buy-row">
                <div class="sc-qty-box">
                  <button type="button" id="at-qty-dec">−</button>
                  <span id="at-qty-val">${selectedQty}</span>
                  <button type="button" id="at-qty-inc">+</button>
                </div>
                <button type="button" class="sc-add-bag-btn" id="at-add-bag-main" style="background:#A85D44;">
                  + MASUKKAN KERANJANG
                </button>
              </div>
            </div>
          </div>

          <div class="sc-thumb-strip" style="grid-template-columns: repeat(${ATELIER_ITEMS.length}, minmax(0, 1fr));">
            ${ATELIER_ITEMS.map(
              m => `
              <button type="button" class="sc-thumb-btn ${m.id === it.id ? 'on' : ''}" data-at-switch="${m.id}" title="${m.name}">
                <span class="sc-thumb-art">${atelierProductSVG(m.id, m.colors[0].hex, m.colors[0].trim)}</span>
                <span class="sc-thumb-label">${m.name}</span>
              </button>
            `
            ).join('')}
          </div>
        </section>
      `;
    }

    if (state === 'LOOKBOOK') {
      return `
        <aside class="sc-left-sub">
          <button type="button" class="sc-back-link" data-at-nav="HOME">← KEMBALI KE BERANDA TOKO</button>
          <h1 class="sc-calligraphy-sm">Lookbook</h1>
          <p class="sc-kicker">NEW SEASON EDITORIAL SETS</p>
        </aside>

        <section class="sc-right-panel sc-card sc-treatments-panel">
          <div class="sc-menu-bar">
            <span class="sc-section-tag">4 LOOKBOOK SET EKSKLUSIF — NEW SEASON COLLECTION</span>
          </div>
          <div class="sc-basket-list sc-ritual-list">
            ${ATELIER_LOOKBOOKS.map(
              (lb, idx) => `
              <div class="sc-basket-row sc-ritual-row">
                <div class="sc-basket-info sc-ritual-info">
                  <span class="sc-eyebrow sc-ritual-eyebrow" style="color:#A85D44;">${lb.date}</span>
                  <b class="sc-ritual-title">${lb.title}</b>
                  <small class="sc-ritual-sub">${lb.sub}</small>
                </div>
                <button type="button" class="sc-pill-cta sc-ritual-cta" data-at-look="${idx}" style="background:#A85D44;flex:none;">
                  ${lb.badge} →
                </button>
              </div>
            `
            ).join('')}
          </div>
        </section>
      `;
    }

    // STATE 5: MY_BAG & RECEIPT (1:1 Blibli Checkout Anatomy + Warm Boutique Cerria Town)
    const queryItems = bag.map(it => `${it.name} (${it.colorName}, Size ${it.size})`).join(' ');
    const tokopediaCheckoutUrl = `https://www.tokopedia.com/search?st=product&q=${encodeURIComponent('Atelier Boutique ' + (queryItems || 'Fashion Coat Dress'))}`;

    const checkoutItems = bag.map((it, idx) => ({
      id: it.id,
      name: it.name,
      variantLabel: `Size ${it.size} · ${it.colorName}`,
      unitPrice: it.unitPrice,
      qty: it.qty,
      insured: it.insured !== false,
      stockLeft: idx === 0 ? 4 : ((idx % 4) + 2),
      svgHtml: atelierProductSVG(it.id, it.colorHex, it.trimHex)
    }));

    const recSource = ATELIER_ITEMS.filter(m => !bag.some(b => b.id === m.id));
    const recPool = (recSource.length >= 3 ? recSource : ATELIER_ITEMS).slice(0, 3);
    const recommendations = recPool.map((m, rIdx) => {
      const col = m.colors?.[0] || { hex: '#C8A378', trim: '#4A3525' };
      const discBadges = ['40%', '20%', null];
      return {
        id: m.id,
        name: m.name,
        price: m.basePrice,
        discountBadge: discBadges[rIdx % discBadges.length],
        svgHtml: atelierProductSVG(m.id, col.hex, col.trim)
      };
    });

    return renderCerriaCheckoutStage({
      storeId: 'toko3',
      storeName: 'Atelier & Boutique Flagship Store',
      storeLocation: 'Distrik #3, Cerria Town',
      themeColor: '#d9534f',
      items: checkoutItems,
      recommendations,
      checkoutComplete,
      tokopediaUrl: tokopediaCheckoutUrl
    });
  }

  function renderOverlay() {
    const cfg = ATELIER_CATALOG;
    const themeColor = cfg.themeColor || '#A85D44';
    const brandTitle = cfg.brandTitle || 'Atelier &amp; Boutique';
    const brandSub = (cfg.brandSub || 'FASHION HOUSE').split('·')[0].trim();
    const count = bagCount();
    const isBottomLeft = state === 'MENU_GRID' || state === 'PRODUCT_3D' || state === 'LOOKBOOK';
    const exitBtnLabel = state === 'HOME' ? '← Kembali ke Kota' : '← Kembali';

    overlay.dataset.state = state;
    overlay.innerHTML = `
      <div class="sc-backdrop ${isBottomLeft ? 'mode-bl' : 'mode-center'}"></div>

      <!-- Top Header Navigation (100% identical to Strawberry Corner) -->
      <header class="sc-topbar">
        <div class="sc-brand-wrap">
          <button type="button" class="sc-exit-btn" id="at-exit-village">${exitBtnLabel}</button>
          <div class="sc-logo" id="at-logo-home">
            <span class="sc-logo-berry">
              ${atelierProductSVG('trench', '#C8A378', '#5C3E28')}
            </span>
            <div>
              <strong>${brandTitle}</strong>
              <small>${brandSub}</small>
            </div>
          </div>
        </div>

        <nav class="sc-topnav" aria-label="Navigasi Atelier & Boutique">
          <button type="button" class="${state === 'HOME' ? 'on' : ''}" data-at-nav="HOME">🏠 Home</button>
          <button type="button" class="${state === 'MENU_GRID' ? 'on' : ''}" data-at-nav="MENU_GRID">☕ Katalog</button>
          <button type="button" class="${state === 'PRODUCT_3D' ? 'on' : ''}" data-at-nav="PRODUCT_3D">🛍️ Shop</button>
          <button type="button" class="${state === 'LOOKBOOK' ? 'on' : ''}" data-at-nav="LOOKBOOK">📅 Events</button>
          <button type="button" class="${state === 'MY_BAG' ? 'on' : ''}" data-at-nav="MY_BAG">🛒 My Bag (${count})</button>
        </nav>

        <div class="sc-top-stats">
          <span class="sc-stat-pill"><i class="sc-dot-berry" style="background:${themeColor};"></i> 1,250 <b>+</b></span>
          <span class="sc-stat-pill"><i class="sc-dot-heart" style="color:${themeColor};">♥</i> ${count}</span>
        </div>
      </header>

      <!-- Floating "you are here" indicator -->
      <div class="sc-you-are-here ${isBottomLeft ? 'on' : ''}" id="at-here-marker">
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
        <button type="button" class="sc-exit-btn sc-bottom-exit-btn" id="at-exit-village-bottom">${exitBtnLabel}</button>
        <div class="sc-foot-brand">
          <span class="sc-dot-berry" style="background:${themeColor};"></span>
          <div>
            <b>${brandTitle}</b>
            <small>${brandSub}</small>
          </div>
        </div>
        <p class="sc-foot-quote">${cfg.footerQuote || 'Tailored silhouettes for everyday art.'} <span style="color:${themeColor};">♥</span></p>
        <div class="sc-foot-icons">
          <button type="button" class="${state === 'HOME' ? 'on' : ''}" data-at-nav="HOME" title="Home">⌂</button>
          <button type="button" class="${state === 'PRODUCT_3D' ? 'on' : ''}" data-at-nav="PRODUCT_3D" title="Shop">🛍</button>
          <button type="button" class="${state === 'MENU_GRID' ? 'on' : ''}" data-at-nav="MENU_GRID" title="Menu">📦</button>
          <button type="button" class="${state === 'LOOKBOOK' ? 'on' : ''}" data-at-nav="LOOKBOOK" title="Events">✨</button>
          <button type="button" class="${state === 'MY_BAG' ? 'on' : ''}" data-at-nav="MY_BAG" title="My Bag">🛒</button>
        </div>
      </footer>
    `;

    if (state === 'PRODUCT_3D') {
      const slot = overlay.querySelector('#at-prod-canvas-slot');
      if (slot) {
        ensureProdRenderer(slot);
        mountProduct3D(selectedItem || ATELIER_ITEMS[0], selectedColorIdx);
      }
    }

    const handleBackOrExit = () => {
      if (state === 'HOME') {
        exit();
      } else {
        setState('HOME');
      }
    };
    overlay.querySelector('#at-exit-village')?.addEventListener('click', handleBackOrExit);
    overlay.querySelector('#at-exit-village-bottom')?.addEventListener('click', handleBackOrExit);
    overlay.querySelector('#at-logo-home')?.addEventListener('click', () => setState('HOME'));
    overlay.querySelectorAll('[data-at-nav]').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-at-nav');
        setState(target);
      });
    });

    overlay.querySelector('#at-open-catalog')?.addEventListener('click', () => {
      setState('PRODUCT_3D', { item: selectedItem || ATELIER_ITEMS[0] });
    });
    overlay.querySelectorAll('[data-at-pick]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-at-pick');
        const item = ATELIER_ITEMS.find(m => m.id === id) || ATELIER_ITEMS[0];
        setState('PRODUCT_3D', { item });
      });
    });

    overlay.querySelectorAll('[data-at-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        filterCat = btn.getAttribute('data-at-filter');
        chime?.(500, 0.06);
        renderOverlay();
      });
    });
    overlay.querySelectorAll('[data-at-card]').forEach(card => {
      card.addEventListener('click', e => {
        if (e.target.closest('[data-at-quick-add]')) return;
        const id = card.getAttribute('data-at-card');
        const item = ATELIER_ITEMS.find(m => m.id === id) || ATELIER_ITEMS[0];
        setState('PRODUCT_3D', { item });
      });
    });
    overlay.querySelectorAll('[data-at-quick-add]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const id = btn.getAttribute('data-at-quick-add');
        const item = ATELIER_ITEMS.find(m => m.id === id);
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

    overlay.querySelectorAll('[data-at-color]').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedColorIdx = parseInt(btn.getAttribute('data-at-color'), 10) || 0;
        chime?.(580 + selectedColorIdx * 35, 0.06);
        renderOverlay();
      });
    });

    overlay.querySelectorAll('[data-at-size]').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedSizeIdx = parseInt(btn.getAttribute('data-at-size'), 10) || 0;
        chime?.(540 + selectedSizeIdx * 40, 0.06);
        renderOverlay();
      });
    });

    overlay.querySelector('#at-qty-dec')?.addEventListener('click', () => {
      selectedQty = Math.max(1, selectedQty - 1);
      renderOverlay();
    });
    overlay.querySelector('#at-qty-inc')?.addEventListener('click', () => {
      selectedQty = Math.min(20, selectedQty + 1);
      renderOverlay();
    });

    overlay.querySelector('#at-add-bag-main')?.addEventListener('click', e => {
      addToBag(selectedItem, selectedSizeIdx, selectedColorIdx, selectedQty);
      const btn = e.currentTarget;
      btn.textContent = '✓ DITAMBAHKAN ♥';
      btn.classList.add('added');
      setTimeout(() => {
        if (state === 'PRODUCT_3D') renderOverlay();
      }, 900);
    });

    overlay.querySelectorAll('[data-at-switch]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-at-switch');
        const item = ATELIER_ITEMS.find(m => m.id === id);
        if (item) {
          selectedItem = item;
          selectedSizeIdx = 1;
          selectedColorIdx = 0;
          selectedQty = 1;
          chime?.(560, 0.07);
          renderOverlay();
        }
      });
    });

    overlay.querySelectorAll('[data-at-look]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-at-look'), 10) || 0;
        const item = ATELIER_ITEMS[idx % ATELIER_ITEMS.length];
        setState('PRODUCT_3D', { item });
      });
    });

    if (state === 'MY_BAG') {
      const queryItems = bag.map(it => `${it.name} (${it.colorName}, Size ${it.size})`).join(' ');
      const tokopediaCheckoutUrl = `https://www.tokopedia.com/search?st=product&q=${encodeURIComponent('Atelier Boutique ' + (queryItems || 'Fashion Coat Dress'))}`;
      bindCerriaCheckoutEvents(overlay, {
        storeId: 'toko3',
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
          const item = ATELIER_ITEMS.find(m => m.id === recId);
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
          submitOrder('toko3', bag, { channel: 'web_modal', storeName: 'Atelier & Boutique', paymentMethod });
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
    const st = stores[2];
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
    const st = stores[2];
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

    if (stores[2]?.g) stores[2].g.scale.set(1, 1, 1);

    applyCurrentViewOffset();

    camera.position.copy(camAnim.curPos);
    controls.target.copy(camAnim.curTarget);
    camera.lookAt(controls.target);
    camera.updateMatrixWorld();

    if (state === 'MENU_GRID' || state === 'PRODUCT_3D' || state === 'LOOKBOOK') {
      const marker = overlay.querySelector('#at-here-marker');
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
    enter,
    exit,
    update
  };
}
