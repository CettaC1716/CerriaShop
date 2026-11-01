import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BUILDINGS_DATA, ICONS } from './data.js?v=124';
import { STORE_IDS, NAV_ORDER, normalizeStoreId, storeNumber, slotOf } from './store_ids.js?v=124';
import { onStoresUpdated } from './js/store-data-manager.js?v=124';
import { registerStoreHost, notifyStoreOpened, notifyStoreClosed } from './js/unity-bridge.js?v=124';
import {
  isFlutter3DCanvasMode,
  postToFlutter,
  registerFlutterBridgeHost
} from './js/flutter-bridge.js?v=124';
import {
  A, PITCH, BLOCK, RING, LOTS, TOWN, slotAngle, isMobile,
  logoSVG, loadAllMarks, worldTone, cityTone, patch, mat, glowMat,
  updateFakeLights, solid, unitBox, unitCyl, crownGeo,
  roundedBox, lotGeometry, Batch, random, pavingTex, sidewalkTileTex, cobbleWalkwayTex,
  grassTex, radialTex, STYLE_HEIGHT, stores, links, buildAllStores,
  updateStrawberryAmbient, updateMayorAmbient, updateTennisCourt,
  buildTamanKota, buildUrbanPocketPark, getPocketParkElevationY,
  resolvePocketParkObstacleCollision, getPocketParkMatchmaking, updateTamanKota,
  getStreetlightDayNightFactor,
  NPC_PALETTES, NPC_SHARED_GEOS, uWindTime, uWindStrength
} from './village.js?v=135';
import { createStrawberryCornerSystem } from './strawberry_corner.js?v=135';
import { createAtelierBoutiqueSystem } from './atelier_boutique.js?v=128';
import { createGlowStudioSystem } from './glow_studio.js?v=128';
import { createMayorOfficeSystem } from './mayor_office.js?v=133';
import { createTownStores3DSystem } from './town_stores_3d.js?v=128';
import { createTrafficSystem } from './traffic_system.js?v=124';
import { CozyAudioEngine } from './cozy_audio.js?v=124';
import { createAmbientNatureSystem } from './ambient_nature.js?v=124';
import {
  registerUnityExporterContext,
  exportCerriaTownToGLB,
  exportCerriaSceneMetadata
} from './js/unity-glb-exporter.js?v=126';

// Staged Loading & Real GPU Pre-Warm Controller
const loadingOverlay = document.getElementById('loading');
const loadingBarFill = document.getElementById('loading-bar-fill');
const loadingPctEl = document.getElementById('loading-pct');
const loadingStatusEl = document.getElementById('loading-status');
const loadingSubEl = document.getElementById('loading-sub');

const isAutoExportGlb =
  typeof location !== 'undefined' &&
  new URLSearchParams(location.search).get('auto_export_glb') === 'true';

if (isAutoExportGlb && typeof window !== 'undefined') {
  window.addEventListener('error', e => {
    fetch('/__export_error', {
      method: 'POST',
      body: String(e?.error?.stack || e?.message || e)
    }).catch(() => {});
  });
  window.addEventListener('unhandledrejection', e => {
    fetch('/__export_error', {
      method: 'POST',
      body: String(e?.reason?.stack || e?.reason?.message || e?.reason || e)
    }).catch(() => {});
  });
}

const nextAnimationFrame = () =>
  isAutoExportGlb
    ? Promise.resolve()
    : new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

const isFlutterCanvas = isFlutter3DCanvasMode();
const isMobileOrWebView = isMobile || isFlutterCanvas;

async function setLoadingProgress(pct, statusText, subText) {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  if (loadingBarFill) loadingBarFill.style.width = `${clamped}%`;
  if (loadingPctEl) loadingPctEl.textContent = `${clamped}%`;
  if (loadingStatusEl) loadingStatusEl.textContent = clamped >= 100 ? 'Cerria Town Siap Dijelajahi!' : 'Memuat Cerria Town…';
  if (loadingSubEl) {
    loadingSubEl.textContent = '';
    loadingSubEl.style.display = 'none';
  }
  postToFlutter({
    type: 'LOADING_PROGRESS',
    pct: clamped,
    status: 'Memuat Cerria Town…',
    sub: ''
  });
  if (!isFlutterCanvas) {
    await nextAnimationFrame();
  }
}

await setLoadingProgress(15, 'Memuat Aset & Tipografi…', 'Menyiapkan ikon toko dan font Cerria Town');
await loadAllMarks();

// 1. Auto Mobile / Low-End Device Detection: `isMobile` is shared from village.js (single source of truth)

// Stage 1 (25%): Buat Jalanan, Langit, & Pencahayaan
await setLoadingProgress(25, 'Buat Jalanan, Langit, & Pencahayaan…', 'Menyiapkan kanvas 3D, atmosfer langit, dan pencahayaan matahari');

const container = document.getElementById('world');
const scene = new THREE.Scene();
window.__CERRIA_SCENE__ = scene;
scene.background = new THREE.Color('#87CEEB');
scene.fog = new THREE.Fog('#87CEEB', 120, 260);

// Adaptive 3-Tier Graphics Detection (Preserves High Visual Quality on Modern Phones while Keeping 60 FPS Locked)
const hwThreads = typeof navigator !== 'undefined' ? Number(navigator.hardwareConcurrency || 4) : 4;
const hwMemGb = typeof navigator !== 'undefined' ? Number(navigator.deviceMemory || 4) : 4;
const isHighCapabilityMobile = isMobileOrWebView && (hwMemGb >= 6 || hwThreads >= 8);
let graphicsQualityTier = !isMobileOrWebView ? 'ultra' : 'balanced';

const camera = new THREE.PerspectiveCamera(30, 1, 1.0, 260);
const renderer = new THREE.WebGLRenderer({
  antialias: !isMobileOrWebView,
  powerPreference: 'high-performance'
});
const initialMaxPixelRatio =
  graphicsQualityTier === 'ultra' ? 2.0 : isHighCapabilityMobile ? 1.35 : 1.2;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, initialMaxPixelRatio));
// Always keep ACESFilmicToneMapping active so warm pastel lighting & sunset/night glow stay rich on mobile & Flutter
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
renderer.shadowMap.enabled = graphicsQualityTier === 'ultra';
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

const hemi = new THREE.HemisphereLight('#DCE8F5', '#E8D8C0', 0.68);
scene.add(hemi);

const sun = new THREE.DirectionalLight('#fff1d6', 1.18);
sun.castShadow = graphicsQualityTier === 'ultra';
const shadowMapSize = graphicsQualityTier === 'ultra' ? 2048 : 1024;
sun.shadow.mapSize.set(shadowMapSize, shadowMapSize);
Object.assign(sun.shadow.camera, { near: 5, far: 95, left: -24, right: 24, top: 24, bottom: -24 });
sun.shadow.bias = -0.0008;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

const exteriorTownGroup = new THREE.Group();
exteriorTownGroup.name = 'CerriaTown_Root';
const world = exteriorTownGroup;
scene.add(exteriorTownGroup);

// Structured Unity Hierarchy Groups inside exteriorTownGroup (preserves setStoreStageIsolation 100%)
const roadsAndSidewalksGroup = new THREE.Group();
roadsAndSidewalksGroup.name = 'Environment_RoadsAndSidewalks';
const treesAndDecorGroup = new THREE.Group();
treesAndDecorGroup.name = 'Environment_TreesAndDecor';
const vehiclesGroup = new THREE.Group();
vehiclesGroup.name = 'Dynamic_Vehicles';
const npcsGroup = new THREE.Group();
npcsGroup.name = 'Dynamic_NPCs';
world.add(roadsAndSidewalksGroup, treesAndDecorGroup, vehiclesGroup, npcsGroup);

const maxAniso = renderer.capabilities.getMaxAnisotropy();

// Stage 2 (50%): Rakit Gedung Pos 1 s/d Pos 7 (bertahap per gedung agar CPU HP tidak freeze)
for (let sIdx = 0; sIdx < BUILDINGS_DATA.length; sIdx++) {
  const stepPct = Math.round(24 + ((sIdx + 1) / BUILDINGS_DATA.length) * 26); // 28% -> 50%
  const bTitle = BUILDINGS_DATA[sIdx].title;
  await setLoadingProgress(
    stepPct,
    'Rakit Gedung Pos 1 s/d Pos 7…',
    `Merakit Pos ${sIdx + 1}/${BUILDINGS_DATA.length} · ${bTitle}`
  );
  buildAllStores(world, maxAniso, sIdx);
}

// Tropical Village Environment: Grass base (#7da068), Cobblestone walkways (#d8cfc4), Fences, Trees, Lanterns (#FFE8B0)
const M = {
  grassBase: mat('#7da068', { map: grassTex, roughness: 0.94 }),
  walkway: mat('#d8cfc4', { map: cobbleWalkwayTex, roughness: 0.65 }),
  stoneStripe: mat('#eee6da', { roughness: 0.65 }),
  curb: mat('#bfb4a6', { roughness: 0.65 }),
  paving: mat('#d8cfc4', { map: pavingTex, roughness: 0.65 }),
  bgSidewalk: mat('#C4BEB4', { map: sidewalkTileTex, roughness: 0.65 }),
  park: mat('#6f9659', { roughness: 0.95 }),
  wood: mat('#8e5d3b', { roughness: 0.85 }),
  water: mat('#5da7b5', { roughness: 0.18, metalness: 0.2, emissive: '#296878', emissiveIntensity: 0.35 }),
  trunk: mat('#735138', { roughness: 0.92 }),
  iron: mat('#383d39', { roughness: 0.5, metalness: 0.4 }),
  stonePillar: mat('#d9d0c1', { roughness: 0.86 }),
  stoneCap: mat('#ebe3d5', { roughness: 0.78 }),
  bushA: mat('#568544', { roughness: 0.9 }),
  bushB: mat('#6d9e54', { roughness: 0.88 }),
  flowerPink: mat('#f28ca8', { roughness: 0.75 }),
  flowerYellow: mat('#ffd166', { roughness: 0.75 }),
  gardenRock: mat('#9e988e', { roughness: 0.92 }),
  lamp: mat('#FFF4D4', { emissive: '#FFD89B', emissiveIntensity: 0.9, roughness: 0.32 })
};

// All Pos 1 – Pos 7 sidewalk streetlamp PointLights (#FFD89B, intensity: 1.0, distance: 9, decay: 2.0)
// and soft emissive bollard rings (emissiveIntensity: 0.9, no PointLight) are synchronized with the day/night curve.

const b = new Batch();
const SPAN = 236;
const LINES = [-3, -2, -1, 0, 1, 2, 3, 4, 5].map(k => k * PITCH);

// Base ground plane: top surface strictly at y = 0.0 (Road asphalt = 0.03, Markings = 0.055, Glow = 0.08, Sidewalk = 0.15)
b.box(M.grassBase, PITCH, -0.20, PITCH, SPAN, 0.40, SPAN);

const isStoreLot = (x, z) => stores.some(s => Math.hypot(x - s.g.position.x, z - s.g.position.z) < 2.5);

const lotCentres = [];
for (let i = -3; i <= 4; i++) {
  for (let j = -3; j <= 4; j++) {
    const x = (i + 0.5) * PITCH;
    const z = (j + 0.5) * PITCH;
    if (!isStoreLot(x, z)) lotCentres.push([x, z, i, j]);
  }
}

const trees = [];
const buildings = [];
const tamanKotaSites = [];
const dummy = new THREE.Object3D();

const addFence = (x0, z0, x1, z1, yBase = 0.15) => {
  const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz);
  const steps = Math.max(2, Math.round(len / 1.8));
  const ang = Math.atan2(dx, dz);
  const nx = Math.cos(ang), nz = -Math.sin(ang);

  // Low stone plinth curb along the fence line
  b.box(M.stonePillar, (x0 + x1) / 2, yBase + 0.06, (z0 + z1) / 2, 0.12, 0.12, len, { ry: ang });
  // Twin dark wrought-iron horizontal rails
  b.box(M.iron, (x0 + x1) / 2, yBase + 0.18, (z0 + z1) / 2, 0.032, 0.032, len, { ry: ang });
  b.box(M.iron, (x0 + x1) / 2, yBase + 0.42, (z0 + z1) / 2, 0.032, 0.032, len, { ry: ang });

  for (let k = 0; k <= steps; k++) {
    const t = k / steps;
    const px = x0 + dx * t, pz = z0 + dz * t;
    // Warm cream stone pillar + stepped stone cap + wrought-iron finial
    b.box(M.stonePillar, px, yBase + 0.27, pz, 0.18, 0.54, 0.18, { ry: ang });
    b.box(M.stoneCap, px, yBase + 0.56, pz, 0.23, 0.055, 0.23, { ry: ang });
    b.cyl(M.iron, px, yBase + 0.62, pz, 0.045, 0.07);

    if (k < steps) {
      const nextX = x0 + dx * ((k + 1) / steps);
      const nextZ = z0 + dz * ((k + 1) / steps);
      // Vertical wrought-iron bars between stone pillars
      const pickets = 4;
      for (let p = 1; p <= pickets; p++) {
        const pt = p / (pickets + 1);
        const bx = px + (nextX - px) * pt;
        const bz = pz + (nextZ - pz) * pt;
        b.cyl(M.iron, bx, yBase + 0.29, bz, 0.014, 0.34);
        b.box(M.iron, bx, yBase + 0.47, bz, 0.026, 0.045, 0.026, { ry: ang });
      }
      // Alternating hanging flower planter / climbing ivy cluster
      const mx = (px + nextX) * 0.5, mz = (pz + nextZ) * 0.5;
      if (k % 2 === 0) {
        b.box(M.wood, mx + nx * 0.04, yBase + 0.41, mz + nz * 0.04, 0.11, 0.08, 0.34, { ry: ang });
        b.box(M.bushB, mx + nx * 0.04, yBase + 0.46, mz + nz * 0.04, 0.13, 0.06, 0.32, { ry: ang });
        b.cyl(k % 4 === 0 ? M.flowerPink : M.flowerYellow, mx + nx * 0.04, yBase + 0.50, mz + nz * 0.04, 0.05, 0.05);
      } else {
        b.cyl(M.bushA, px + nx * 0.07, yBase + 0.20, pz + nz * 0.07, 0.13, 0.16);
      }
    }
  }
};

const addParkBench = (bx, bz, ry, yBase = 0.15) => {
  const cos = Math.cos(ry), sin = Math.sin(ry);
  // Warm wooden seat + wrought-iron legs & backrest
  b.box(M.wood, bx, yBase + 0.16, bz, 1.15, 0.05, 0.36, { ry });
  b.box(M.iron, bx - cos * 0.46, yBase + 0.09, bz + sin * 0.46, 0.06, 0.18, 0.34, { ry });
  b.box(M.iron, bx + cos * 0.46, yBase + 0.09, bz - sin * 0.46, 0.06, 0.18, 0.34, { ry });
  b.box(M.iron, bx - sin * 0.14, yBase + 0.28, bz - cos * 0.14, 1.12, 0.16, 0.04, { ry });
};

const addFloweringBush = (bx, bz, scale = 1, yBase = 0.15) => {
  b.cyl(M.bushA, bx, yBase + 0.14 * scale, bz, 0.34 * scale, 0.26 * scale);
  b.cyl(M.bushB, bx + 0.08 * scale, yBase + 0.24 * scale, bz - 0.06 * scale, 0.24 * scale, 0.20 * scale);
  b.cyl(M.flowerPink, bx - 0.08 * scale, yBase + 0.28 * scale, bz + 0.07 * scale, 0.07 * scale, 0.06 * scale);
  b.cyl(M.flowerYellow, bx + 0.10 * scale, yBase + 0.31 * scale, bz - 0.04 * scale, 0.06 * scale, 0.06 * scale);
};

const addBollardLamp = (lx, lz, yBase = 0.15) => {
  b.cyl(M.iron, lx, yBase + 0.22, lz, 0.055, 0.44);
  b.cyl(M.lamp, lx, yBase + 0.48, lz, 0.075, 0.14);
  b.cyl(M.iron, lx, yBase + 0.56, lz, 0.095, 0.03);
};

for (const [x, z, i, j] of lotCentres) {
  const dist = Math.hypot(x - PITCH, z - PITCH);
  if (dist > 86) continue;

  // Lot (i === 1, j === 0) at (x = 1.5 * PITCH, z = 0.5 * PITCH) is merged into the Pos 5 (Apex Sport) Unified Superblock
  // ([Gedung Sebelah / Background] <---> [Lapangan Tenis] <---> [Apex Sport]) built at y = 0.195 in village.js!
  if (i === 1 && j === 0) {
    const bx = x - 1.95, bz = z - 0.90, w = 3.85, h = 4.65, d = 5.10;
    buildings.push([bx, bz, w, h, d, 0.72]);
    b.box(mat('#c26345', { roughness: 0.85 }, cityTone), bx, 0.195 + h + 0.15, bz, w + 0.22, 0.28, d + 0.22);
    continue;
  }

  // Lot (i === 0, j === 1) at (x = 7.4, z = 22.2) is merged with Pos #7 (Mayor's Office at x = 22.2, z = 22.2)
  // into the Unified Civic Plaza & Central Park Superblock built in village.js!
  if (i === 0 && j === 1) {
    continue;
  }

  const square = (i === 0 || i === 1) && (j === 0 || j === 1);
  const park = !square && ((i * 7 + j * 13) & 3) === 0;

  if (square) {
    // Disjoint stepped sidewalk layers with rounded corners (cornerRadius = 1.2): curb 0.00 -> 0.147, top surface 0.125 -> 0.150
    b.add(M.curb, lotGeometry(BLOCK, 1.2, 0.147), x, 0, z);
    b.add(M.paving, lotGeometry(BLOCK - 0.28, 1.06, 0.025), x, 0.125, z);
    // Scaled-down village plaza fountain (58% radius, 70% height) so it fits proportionally
    b.cyl(M.curb, x, 0.24, z, 1.07, 0.25);
    b.cyl(M.water, x, 0.38, z, 0.90, 0.055);
    b.cyl(M.curb, x, 0.49, z, 0.20, 0.35);
    // Wooden benches with wrought-iron backrests
    for (const [bx, bz, ry] of [[-2.4, 0, Math.PI / 2], [2.4, 0, -Math.PI / 2], [0, -2.4, 0], [0, 2.4, Math.PI]]) {
      addParkBench(x + bx, z + bz, ry, 0.15);
    }
    // Flowering bushes and short warm bollard lanterns around the square
    for (const [fx, fz] of [[-2.4, -2.4], [2.4, -2.4], [-2.4, 2.4], [2.4, 2.4]]) {
      addFloweringBush(x + fx, z + fz, 0.92, 0.15);
    }
    for (const [lx, lz] of [[-1.7, -1.7], [1.7, -1.7], [-1.7, 1.7], [1.7, 1.7]]) {
      addBollardLamp(x + lx, z + lz, 0.15);
    }
    for (const [dx, dz] of [[-3.4, -3.4], [3.4, -3.4], [-3.4, 3.4], [3.4, 3.4]]) {
      trees.push([x + dx, z + dz, 0.9 + random() * 0.25]);
    }
  } else if (park) {
    // Full Architectural Landscape Taman Kota on the park blocks directly adjacent to Pos #6 (Strawberry Corner at i = 2, j = -1).
    // Lot (i === 2, j === -2) opens its +Z border (openWestBorder = true) and seamlessly merges with the
    // Contemporary Urban Pocket Park built on the former E-W road segment at (x = 2.5 * PITCH, z = -PITCH)!
    if ((i === 2 && j === -2) || (i === 3 && j === -1)) {
      const isDoublePark = i === 2 && j === -2;
      const tkGroup = buildTamanKota(treesAndDecorGroup, x, z, Math.PI / 2, isDoublePark);
      tamanKotaSites.push({ g: tkGroup, style: 'taman_kota' });
      if (isDoublePark) {
        const pocketGroup = buildUrbanPocketPark(treesAndDecorGroup, 2.5 * PITCH, -PITCH);
        tamanKotaSites.push({ g: pocketGroup, style: 'urban_pocket_park' });
      }
      continue;
    }
    // Rounded sidewalk corners (cornerRadius = 1.2) on park blocks: pedestrian stone tiles on outer sidewalk, green lawn inside fenced garden
    b.add(M.curb, lotGeometry(BLOCK, 1.2, 0.147), x, 0, z);
    b.add(M.paving, lotGeometry(BLOCK - 0.28, 1.06, 0.025), x, 0.125, z);
    b.box(M.park, x, 0.142, z, 4.66, 0.018, 6.06, { r: 0.04 });
    // Inner garden fence set back at |z| = 3.05, |x| <= 2.35 (leaving > 2.45 units of outer sidewalk and > 4.6 units from every crosswalk/corner)
    addFence(x - 2.35, z - 3.05, x + 2.35, z - 3.05);
    addFence(x - 2.35, z + 3.05, x + 2.35, z + 3.05);
    // Natural stone stepping stones & garden rocks
    for (let s = -3; s <= 3; s++) {
      const sx = x + s * 0.82 + (random() - 0.5) * 0.14;
      const sz = z + Math.sin(s * 0.8) * 0.55;
      b.cyl(M.stoneStripe, sx, 0.162, sz, 0.26 + random() * 0.06, 0.028);
    }
    for (const [rx, rz, rs] of [[-2.2, -1.4, 0.22], [2.1, 1.5, 0.26], [-1.6, 2.0, 0.20]]) {
      b.cyl(M.gardenRock, x + rx, 0.22, z + rz, rs, rs * 0.75);
    }
    // Wooden benches with wrought-iron backrests & short warm bollard lanterns inside the park
    addParkBench(x - 1.5, z - 2.2, 0, 0.15);
    addParkBench(x + 1.5, z + 2.2, Math.PI, 0.15);
    addBollardLamp(x - 2.3, z - 2.1, 0.15);
    addBollardLamp(x + 2.3, z + 2.1, 0.15);
    // Flowering bushes inside the park (clear of the 2.2-unit outer sidewalk)
    for (const [fx, fz] of [[-2.5, -2.5], [2.5, -2.5], [-2.5, 2.5], [2.5, 2.5], [0, -2.6]]) {
      addFloweringBush(x + fx, z + fz, 0.85 + random() * 0.2, 0.15);
    }
    const n = 4 + Math.floor(random() * 4);
    for (let k = 0; k < n; k++) {
      trees.push([x + (random() - 0.5) * 5.2, z + (random() - 0.5) * 5.2, 0.85 + random() * 0.5]);
    }
  } else {
    // Background building block: Rounded concrete sidewalk base (#C4BEB4, cornerRadius = 1.2, top at y = 0.15)
    b.add(M.curb, lotGeometry(BLOCK, 1.2, 0.147), x, 0, z);
    b.add(M.bgSidewalk, lotGeometry(BLOCK - 0.28, 1.06, 0.025), x, 0.125, z);
    // Surrounding tropical village cottages with warm terracotta roofs
    const near = dist < 30;
    const sub = near && random() > 0.35 ? 2 : 1;
    for (let sx = 0; sx < sub; sx++) {
      for (let sz = 0; sz < sub; sz++) {
        const cell = (BLOCK - 2.2) / sub;
        const bx = x + (sub === 1 ? 0 : (sx - 0.5) * cell);
        const bz = z + (sub === 1 ? 0 : (sz - 0.5) * cell);
        const w = cell * (0.68 + random() * 0.2);
        const d = cell * (0.68 + random() * 0.2);
        const h = (near ? 2.4 + random() * 3.8 : 2.2 + random() * (dist < 46 ? 4.8 : 3.2)) * (sub === 2 ? 0.85 : 1);
        buildings.push([bx, bz, w, h, d, 0.58 + random() * 0.35]);
        // Warm terracotta roof cap on top of village cottages (sitting cleanly above 0.15 + h)
        b.box(mat('#c26345', { roughness: 0.85 }, cityTone), bx, 0.15 + h + 0.15, bz, w + 0.22, 0.28, d + 0.22);
      }
    }
    addFloweringBush(x - 3.65, z - 3.85, 0.82, 0.15);
    if (near) addBollardLamp(x + 3.65, z - 3.85, 0.15);
    if (random() > 0.3) trees.push([x + 4.15, z - 4.15, 0.82]);
  }
}

b.build(roadsAndSidewalksGroup);

// Surrounding background village buildings: CanvasTexture + emissiveMap directly on BoxGeometry walls (0% Parallax, 0% Z-Fighting)
const uWindowGlow = { value: 1 };
const cottagePalette = ['#e4dbd0', '#dad0c1', '#dfd1be', '#d2c5b3'];

function createCityFacadeMaterial(variantIdx, wallHex) {
  const S = 512;
  const diffCanvas = document.createElement('canvas');
  diffCanvas.width = diffCanvas.height = S;
  const dc = diffCanvas.getContext('2d');

  const emCanvas = document.createElement('canvas');
  emCanvas.width = emCanvas.height = S;
  const ec = emCanvas.getContext('2d');

  // Solid wall base on diffuse, pure black (off) on emissive
  dc.fillStyle = wallHex;
  dc.fillRect(0, 0, S, S);
  ec.fillStyle = '#000000';
  ec.fillRect(0, 0, S, S);

  // Subtle horizontal floor stringcourses & cornice band
  dc.fillStyle = '#00000010';
  dc.fillRect(0, 0, S, 18);
  dc.fillRect(0, S - 22, S, 22);
  const cols = 4;
  const rows = 3;
  for (let r = 1; r < rows; r++) {
    dc.fillRect(0, Math.round((r * S) / rows) - 3, S, 6);
  }

  // Draw crisp window grid directly onto the wall CanvasTexture (no floating planes)
  const padX = 34;
  const padY = 42;
  const cellW = (S - padX * 2) / cols;
  const cellH = (S - padY * 2) / rows;
  const winW = Math.round(cellW * 0.54);
  const winH = Math.round(cellH * 0.58);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const wx = Math.round(padX + c * cellW + (cellW - winW) * 0.5);
      const wy = Math.round(padY + r * cellH + (cellH - winH) * 0.5);

      // Deterministic lit/unlit pattern per variant, row, and column
      const hash = Math.sin((c + 1) * 12.9898 + (r + 1) * 78.233 + variantIdx * 37.719) * 43758.5453;
      const frac = hash - Math.floor(hash);
      const isLit = frac > 0.22;

      // Recessed window frame & sill on diffuse texture
      dc.fillStyle = '#38342f';
      dc.fillRect(wx - 4, wy - 4, winW + 8, winH + 8);
      dc.fillStyle = '#b9ad9c';
      dc.fillRect(wx - 6, wy + winH + 2, winW + 12, 6);

      if (isLit) {
        const warmTint = frac > 0.72 ? '#ffdfa0' : '#ffca7a';
        dc.fillStyle = warmTint;
        dc.fillRect(wx, wy, winW, winH);

        // Single-layer emissive window glow directly on the wall surface
        ec.fillStyle = warmTint;
        ec.fillRect(wx, wy, winW, winH);

        // Subtle interior mullion crossbars drawn inside the texture (0 geometry offset)
        dc.fillStyle = '#38342f';
        dc.fillRect(wx + Math.floor(winW / 2) - 2, wy, 4, winH);
        dc.fillRect(wx, wy + Math.floor(winH * 0.45), winW, 3);
        ec.fillStyle = '#241a10';
        ec.fillRect(wx + Math.floor(winW / 2) - 2, wy, 4, winH);
        ec.fillRect(wx, wy + Math.floor(winH * 0.45), winW, 3);
      } else {
        // Unlit dark glass pane with subtle sky reflection
        dc.fillStyle = '#2b3531';
        dc.fillRect(wx, wy, winW, winH);
        dc.fillStyle = '#3b4843';
        dc.fillRect(wx + 2, wy + 2, winW - 4, Math.floor(winH * 0.38));
        dc.fillStyle = '#38342f';
        dc.fillRect(wx + Math.floor(winW / 2) - 2, wy, 4, winH);
      }
    }
  }

  const diffTex = new THREE.CanvasTexture(diffCanvas);
  diffTex.colorSpace = THREE.SRGBColorSpace;
  diffTex.anisotropy = maxAniso;

  const emTex = new THREE.CanvasTexture(emCanvas);
  emTex.colorSpace = THREE.SRGBColorSpace;
  emTex.anisotropy = maxAniso;

  return patch(
    new THREE.MeshStandardMaterial({
      map: diffTex,
      roughness: 0.86,
      emissive: '#ffffff',
      emissiveMap: emTex,
      emissiveIntensity: 0.9
    }),
    cityTone
  );
}

const cityMaterials = cottagePalette.map((hex, i) => createCityFacadeMaterial(i, hex));

// BoxGeometry with top (+Y) and bottom (-Y) UVs pinned to solid wall corner (0.01, 0.01) so windows only appear on the 4 vertical walls
const cityBoxGeo = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
{
  const uv = cityBoxGeo.attributes.uv;
  for (let v = 12; v < 24; v++) {
    uv.setXY(v, 0.01, 0.01);
  }
  uv.needsUpdate = true;
}

const cityBatch = new Batch();
buildings.forEach(([x, z, w, h, d], idx) => {
  const matVariant = cityMaterials[idx % cityMaterials.length];
  cityBatch.add(matVariant, cityBoxGeo, x, 0.15 + h / 2, z, w, h, d);
});
cityBatch.build(treesAndDecorGroup);

// Instanced low-poly trees across the village
const crownMat = mat('#689648', { flatShading: true });
const crowns = new THREE.InstancedMesh(crownGeo, crownMat, trees.length);
crowns.name = 'Environment_TreeCrowns';
const trunks = new THREE.InstancedMesh(unitCyl, M.trunk, trees.length);
trunks.name = 'Environment_TreeTrunks';
crowns.castShadow = crowns.receiveShadow = trunks.castShadow = true;
const treeColor = new THREE.Color();
trees.forEach(([x, z, s], idx) => {
  dummy.position.set(x, 0.15 + 0.55 * s, z);
  dummy.scale.set(0.11 * s, 1.1 * s, 0.11 * s);
  dummy.rotation.set(0, 0, 0);
  dummy.updateMatrix();
  trunks.setMatrixAt(idx, dummy.matrix);
  dummy.position.set(x, 0.15 + 1.38 * s, z);
  dummy.scale.set(0.76 * s, 0.96 * s, 0.76 * s);
  dummy.rotation.set(idx * 1.1, idx * 1.7, 0);
  dummy.updateMatrix();
  crowns.setMatrixAt(idx, dummy.matrix);
  treeColor.setHSL(0.27 + (random() - 0.5) * 0.05, 0.36, 0.44 + (random() - 0.5) * 0.08);
  crowns.setColorAt(idx, treeColor);
});
treesAndDecorGroup.add(trunks, crowns);

// Stage 3 (75%): Buat Dekorasi, Pohon, Mobil, & NPC
await setLoadingProgress(65, 'Buat Dekorasi, Pohon, Mobil, & NPC…', 'Menata taman kota, pepohonan, dan marka jalan raya');

const LANES = [-1, 0, 1, 2, 3].map(k => k * PITCH);

// Stylized 3D Citizen & Pedestrian Geometry (1.60x Architectural Scale: ~1.08u tall = ~65%-70% of 1st-floor door height,
// articulated Upper Thighs ±1.0, Lower Calves & Shoes ±2.0, Left/Right Arms ±0.7, Torso 0.0, and Head & Hair 3.0)
// Stylized 3D Citizen & Pedestrian Geometry — Unified Raka & Kamu Cozy Chibi Anatomy (Shared Meshes via NPC_SHARED_GEOS)
// Part color tags stored in vertex color.r:
//   0.10 = Sweater/Top | 0.20 = Pants/Trousers | 0.30 = Hair | 0.40 = Warm Skin
//   0.50 = Collar/Cuff/ShoeSole Cream (#FFF8E7) | 0.60 = Shoe Body | 0.70 = Glossy Black Eyes
//   0.80 = Pink Oval Blush (#F08A84) | 0.90 = Eye Sparkle White | 0.95 = Cozy Beret/Cap
// Hairstyle variant tag stored in vertex color.g:
//   0.0 = Shared base hair (cap + front bangs + back hair)
//   1.0 = Short bob side locks | 2.0 = Rear ponytail/bun | 3.0 = Center-parted curtain bangs | 4.0 = Cozy beret
const personGeo = (() => {
  const parts = [];
  const push = (g, partTag, styleVar, limb, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const c = solid(g.clone());
    if (rx) c.rotateX(rx);
    if (ry) c.rotateY(ry);
    if (rz) c.rotateZ(rz);
    c.translate(x, y, z);
    const n = c.attributes.position.count;
    const col = new Float32Array(n * 3);
    const lmb = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      col[i * 3] = partTag;
      col[i * 3 + 1] = styleVar;
      col[i * 3 + 2] = 0.0;
      lmb[i] = limb;
    }
    c.setAttribute('color', new THREE.BufferAttribute(col, 3));
    c.setAttribute('aLimb', new THREE.BufferAttribute(lmb, 1));
    parts.push(c);
  };

  // 1. Articulated Upper Thighs (aLimb = -1.0 Left, +1.0 Right; hip pivot at y = 0.42, knee at y = 0.22)
  push(NPC_SHARED_GEOS.standingThighGeo, 0.20, 0.0, -1.0, -0.068, 0.42, 0);
  push(NPC_SHARED_GEOS.standingThighGeo, 0.20, 0.0,  1.0,  0.068, 0.42, 0);

  // 2. Articulated Lower Calves, Skin Ankles & Cozy Sneakers (aLimb = -2.0 Left, +2.0 Right; knee pivot at y = 0.22)
  push(NPC_SHARED_GEOS.standingCalfGeo, 0.20, 0.0, -2.0, -0.068, 0.22, 0);
  push(NPC_SHARED_GEOS.standingCalfGeo, 0.20, 0.0,  2.0,  0.068, 0.22, 0);
  push(NPC_SHARED_GEOS.ankleGeo, 0.40, 0.0, -2.0, -0.068, 0.068, 0);
  push(NPC_SHARED_GEOS.ankleGeo, 0.40, 0.0,  2.0,  0.068, 0.068, 0);
  push(NPC_SHARED_GEOS.shoeGeo, 0.60, 0.0, -2.0, -0.068, 0.032, 0.022);
  push(NPC_SHARED_GEOS.shoeGeo, 0.60, 0.0,  2.0,  0.068, 0.032, 0.022);
  push(NPC_SHARED_GEOS.shoeSoleGeo, 0.50, 0.0, -2.0, -0.068, 0.009, 0.022);
  push(NPC_SHARED_GEOS.shoeSoleGeo, 0.50, 0.0,  2.0,  0.068, 0.009, 0.022);

  // 3. Pelvis / Trousers Waist, Rounded Cozy Sweater Torso, Cream Collar Ring & Warm Skin Neck (aLimb = 0.0)
  push(NPC_SHARED_GEOS.pelvisGeo, 0.20, 0.0, 0.0, 0, 0.43, 0);
  push(NPC_SHARED_GEOS.standingTorsoGeo, 0.10, 0.0, 0.0, 0, 0.625, 0);
  push(NPC_SHARED_GEOS.standingCollarGeo, 0.50, 0.0, 0.0, 0, 0.798, 0, Math.PI * 0.5, 0, 0);
  push(NPC_SHARED_GEOS.neckGeo, 0.40, 0.0, 0.0, 0, 0.822, 0);

  // 4. Articulated Left (+0.7) & Right (-0.7) Rounded Sweater Arms + Cream Cuffs + Warm Skin Hands (shoulder pivot at y = 0.75)
  const armG = NPC_SHARED_GEOS.armGeo.clone();
  armG.translate(0, -0.14, 0);
  push(armG, 0.10, 0.0,  0.7, -0.162, 0.75, 0);
  push(armG, 0.10, 0.0, -0.7,  0.162, 0.75, 0);
  push(NPC_SHARED_GEOS.cuffGeo, 0.50, 0.0,  0.7, -0.162, 0.47, 0, Math.PI * 0.5, 0, 0);
  push(NPC_SHARED_GEOS.cuffGeo, 0.50, 0.0, -0.7,  0.162, 0.47, 0, Math.PI * 0.5, 0, 0);
  push(NPC_SHARED_GEOS.handGeo, 0.40, 0.0,  0.7, -0.162, 0.44, 0);
  push(NPC_SHARED_GEOS.handGeo, 0.40, 0.0, -0.7,  0.162, 0.44, 0);

  // 5. Cozy Chibi Round Head + 2 Glossy Black Dot Eyes (+ White Sparkle) + 2 Pink Oval Cheek Blushes (aLimb = 3.0)
  push(NPC_SHARED_GEOS.standingHeadGeo, 0.40, 0.0, 3.0, 0, 0.935, 0);
  push(NPC_SHARED_GEOS.eyeGeo, 0.70, 0.0, 3.0, -0.044, 0.946, 0.116);
  push(NPC_SHARED_GEOS.eyeGeo, 0.70, 0.0, 3.0,  0.044, 0.946, 0.116);
  push(NPC_SHARED_GEOS.eyeShineGeo, 0.90, 0.0, 3.0, -0.038, 0.953, 0.126);
  push(NPC_SHARED_GEOS.eyeShineGeo, 0.90, 0.0, 3.0,  0.050, 0.953, 0.126);
  push(NPC_SHARED_GEOS.blushGeo, 0.80, 0.0, 3.0, -0.068, 0.916, 0.108);
  push(NPC_SHARED_GEOS.blushGeo, 0.80, 0.0, 3.0,  0.068, 0.916, 0.108);

  // 6. Voluminous Rounded Hair Crown + Front Forehead Bangs + Back Hair + 4 Cozy Hairstyle Variants (aLimb = 3.0)
  push(NPC_SHARED_GEOS.standingHairCapGeo, 0.30, 0.0, 3.0, 0, 0.948, -0.006);
  push(NPC_SHARED_GEOS.standingHairBangsGeo, 0.30, 0.0, 3.0, 0, 0.996, 0.095, 0.18, 0, 0);
  push(NPC_SHARED_GEOS.standingHairBackGeo, 0.30, 0.0, 3.0, 0, 0.912, -0.072);
  // Variant 1.0: Short Bob Side Locks
  push(NPC_SHARED_GEOS.sideLockGeo, 0.30, 1.0, 3.0, -0.108, 0.905, 0.025);
  push(NPC_SHARED_GEOS.sideLockGeo, 0.30, 1.0, 3.0,  0.108, 0.905, 0.025);
  // Variant 2.0: Rear Ponytail / Bun
  push(NPC_SHARED_GEOS.hairBunGeo, 0.30, 2.0, 3.0, 0, 0.935, -0.145);
  // Variant 3.0: Center-Parted Curtain Bangs
  push(NPC_SHARED_GEOS.curtainBangGeo, 0.30, 3.0, 3.0, -0.055, 0.985, 0.104, 0, 0,  0.32);
  push(NPC_SHARED_GEOS.curtainBangGeo, 0.30, 3.0, 3.0,  0.055, 0.985, 0.104, 0, 0, -0.32);
  // Variant 4.0: Cozy Beret / Casual Cap
  push(NPC_SHARED_GEOS.standingBeretGeo, 0.95, 4.0, 3.0, 0.012, 1.048, -0.008, -0.12, 0, -0.10);

  return mergeGeometries(parts, false);
})();

const uWalkTime = { value: 0 };
const peopleMat = patch(
  new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.78 }),
  worldTone,
  Object.assign(
    s => {
      s.uniforms.uTime = uWalkTime;
      s.vertexShader = s.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          attribute float aLimb;
          attribute float aPhase;
          attribute vec4 aNpcState;
          attribute vec4 aWardrobe;
          uniform float uTime;
          vec3 getShirtPalette(float idx) {
            int i = int(floor(idx + 0.5));
            if (i == 0) return vec3(1.000, 0.498, 0.314); // #FF7F50 Coral/Oranye lembut
            if (i == 1) return vec3(1.000, 0.973, 0.906); // #FFF8E7 Krem Gading
            if (i == 2) return vec3(0.957, 0.769, 0.188); // #F4C430 Kuning Mustard
            if (i == 3) return vec3(0.616, 0.757, 0.514); // #9DC183 Sage Green
            if (i == 4) return vec3(0.910, 0.647, 0.596); // #E8A598 Dusty Pink
            if (i == 5) return vec3(0.537, 0.812, 0.941); // #89CFF0 Biru Langit Lembut
            if (i == 6) return vec3(0.765, 0.694, 0.882); // #C3B1E1 Lavender
            return vec3(0.847, 0.416, 0.263);             // #D86A43 Terracotta Hangat
          }
          vec3 getPantsPalette(float idx) {
            int i = int(floor(idx + 0.5));
            if (i == 0) return vec3(0.231, 0.231, 0.231); // #3B3B3B Abu-abu arang
            if (i == 1) return vec3(0.333, 0.420, 0.184); // #556B2F Hijau Olive
            if (i == 2) return vec3(0.290, 0.392, 0.486); // #4A647C Biru Denim
            if (i == 3) return vec3(0.545, 0.451, 0.333); // #8B7355 Cokelat Khaki
            return vec3(0.761, 0.698, 0.600);             // #C2B299 Krem Gelap
          }
          vec3 getHairPalette(float idx) {
            int i = int(floor(idx + 0.5));
            if (i == 0) return vec3(0.290, 0.180, 0.106); // #4A2E1B Cokelat Espresso
            if (i == 1) return vec3(0.133, 0.133, 0.133); // #222222 Hitam Pekat
            if (i == 2) return vec3(0.545, 0.353, 0.169); // #8B5A2B Cokelat Karamel
            return vec3(0.831, 0.639, 0.349);             // #D4A359 Pirang Hangat
          }
          vec3 getSkinPalette(float idx) {
            int i = int(floor(idx + 0.5));
            if (i == 0) return vec3(1.000, 0.878, 0.741); // #FFE0BD Warm Fair
            if (i == 1) return vec3(0.961, 0.796, 0.655); // #F5CBA7 Warm Peach
            return vec3(0.878, 0.675, 0.412);             // #E0AC69 Warm Tan
          }`
        )
        .replace(
          '#include <color_vertex>',
          `#include <color_vertex>
          float partTag = color.r;
          float packedW = floor(aWardrobe.w + 0.5);
          float skinIdx = mod(packedW, 3.0);
          float shoeIdx = mod(floor(packedW / 3.0), 2.0);
          if (partTag < 0.15) {
            vColor.xyz = getShirtPalette(aWardrobe.x);
          } else if (partTag < 0.25) {
            vColor.xyz = getPantsPalette(aWardrobe.y);
          } else if (partTag < 0.35) {
            vColor.xyz = getHairPalette(aWardrobe.z);
          } else if (partTag < 0.45) {
            vColor.xyz = getSkinPalette(skinIdx);
          } else if (partTag < 0.55) {
            vColor.xyz = vec3(1.000, 0.973, 0.906); // #FFF8E7 Cream Collar / Cuff / Sole
          } else if (partTag < 0.65) {
            vColor.xyz = (shoeIdx < 0.5) ? vec3(0.961, 0.937, 0.902) : vec3(0.545, 0.353, 0.169); // White/Cream or Brown Sneakers
          } else if (partTag < 0.75) {
            vColor.xyz = vec3(0.082, 0.082, 0.102); // Glossy Black Eyes (#15151A)
          } else if (partTag < 0.85) {
            vColor.xyz = vec3(0.941, 0.541, 0.518); // Pink Oval Blush (#F08A84)
          } else if (partTag < 0.92) {
            vColor.xyz = vec3(1.000, 1.000, 1.000); // Eye Sparkle White
          } else {
            vColor.xyz = getShirtPalette(mod(aWardrobe.x + 2.0, 8.0)); // Cozy Beret
          }
          // Convert sRGB palette values to linear space so Three.js standard lighting renders warm pastel tones accurately
          vColor.xyz = pow(clamp(vColor.xyz, 0.0, 1.0), vec3(2.2));`
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          float styleVar = color.g;
          float styleIdx = floor(floor(aWardrobe.w + 0.5) / 6.0);
          if (styleVar > 0.5 && abs(styleVar - (styleIdx + 1.0)) > 0.25) {
            transformed = vec3(0.0, 0.935, 0.0);
          }
          float walkPhase = aNpcState.x;
          float walkW = aNpcState.y;
          float sitW = aNpcState.z;
          float actCode = aNpcState.w;
          float ph = fract(aWardrobe.w * 0.173 + aWardrobe.x * 0.31 + aWardrobe.y * 0.19) * 6.2831853;
          float walkSw = sin(walkPhase) * 0.42 * walkW;
          float limbSign = sign(aLimb);
          float absLimb = abs(aLimb);

          // 1. NEVER-FREEZE PROCEDURAL IDLE: Breathing & Subtle Lateral Weight Shift on Upper Body
          float breathY = sin(uTime * 2.15 + ph) * 0.015;
          float swayX = cos(uTime * 1.28 + ph) * 0.011 * (1.0 - sitW * 0.55);

          // 2. UPPER THIGHS (absLimb == 1.0): Walking Swing OR 90-Degree Seated Bend (-1.48 rad)
          if (absLimb > 0.9 && absLimb < 1.5) {
            float thighAngle = walkSw * limbSign * (1.0 - sitW) - 1.48 * sitW;
            float c = cos(thighAngle), sn = sin(thighAngle);
            vec2 yz = vec2(transformed.y - 0.42, transformed.z);
            transformed.y = 0.42 + yz.x * c - yz.y * sn - 0.10 * sitW;
            transformed.z = yz.x * sn + yz.y * c;
          }
          // 3. LOWER CALVES & SHOES (absLimb == 2.0): Walking Stride OR Seated Knee Hang + Gentle Calf Swing
          else if (absLimb > 1.5 && absLimb < 2.5) {
            // Walking rotation around hip (0.42)
            float wAngle = walkSw * limbSign;
            float cw = cos(wAngle), snw = sin(wAngle);
            vec2 yzW = vec2(transformed.y - 0.42, transformed.z);
            vec3 walkPos = vec3(transformed.x, 0.42 + yzW.x * cw - yzW.y * snw, yzW.x * snw + yzW.y * cw);

            // Seated rotation around bent knee (shifted forward to z = +0.20, y = 0.30) with gentle alternating leg swing
            float calfSwing = sin(uTime * 2.25 + ph + limbSign * 1.45) * 0.22;
            float cs = cos(calfSwing), sns = sin(calfSwing);
            vec2 yzS = vec2(transformed.y - 0.22, transformed.z);
            vec3 sitPos = vec3(
              transformed.x,
              0.30 + yzS.x * cs - yzS.y * sns,
              0.20 + yzS.x * sns + yzS.y * cs
            );
            transformed = mix(walkPos, sitPos, sitW);
          }
          // 4. ARMS & HANDS (absLimb == 0.7): Speed-Synced Walking Swing (smoothly lerps to 0 upright pose when IDLE / WINDOW_SHOPPING) & Seated Dining Gestures
          else if (absLimb > 0.5 && absLimb < 0.85) {
            float armAngleX = walkSw * aLimb * (1.0 - sitW);
            float armInwardX = 0.0;
            // Action 2.0: SEATED_DINING (Right arm lifts from table to mouth in a Math.sin eating/drinking gesture!)
            if (actCode > 1.5 && actCode < 2.5) {
              if (aLimb < 0.0) {
                float eatPulse = smoothstep(0.15, 0.82, sin(uTime * 1.55 + ph));
                armAngleX = mix(-0.48, -1.36, eatPulse);
                armInwardX = -0.065 * eatPulse * (0.75 - transformed.y);
              } else {
                float talkL = max(0.0, sin(uTime * 2.8 + ph + 1.8)) * 0.28;
                armAngleX = -0.42 - talkL;
              }
            }
            float ca = cos(armAngleX), sna = sin(armAngleX);
            vec2 yzA = vec2(transformed.y - 0.75, transformed.z);
            transformed.y = 0.75 + yzA.x * ca - yzA.y * sna + breathY - 0.10 * sitW;
            transformed.z = yzA.x * sna + yzA.y * ca;
            transformed.x += swayX + armInwardX;
          }
          // 5. HEAD & HAIR (aLimb == 3.0): Continuous Natural Look-Around, Window-Shopping Scan, Dining Sip Nod & Social Eye Contact
          else if (absLimb > 2.5) {
            float headYaw = (sin(uTime * 1.15 + ph) * 0.22 + cos(uTime * 0.68 + ph * 1.3) * 0.12) * (1.0 - walkW * 0.45);
            float headPitch = sin(uTime * 1.65 + ph) * 0.05;
            if (actCode > 0.5 && actCode < 1.5) {
              // WINDOW_SHOPPING: scan left-right across display glass & nod in admiration
              headYaw = sin(uTime * 1.85 + ph) * 0.42;
              headPitch = abs(sin(uTime * 3.2 + ph)) * 0.14 - 0.04;
            } else if (actCode > 1.5 && actCode < 2.5) {
              // SEATED_DINING: tilt head down & nod when eating/sipping, and turn toward table companions
              float eatPulse = smoothstep(0.15, 0.82, sin(uTime * 1.55 + ph));
              headYaw = sin(uTime * 1.35 + ph) * 0.30 * (1.0 - eatPulse * 0.7);
              headPitch = 0.16 * eatPulse + sin(uTime * 3.8 + ph) * 0.06;
            } else if (actCode > 2.5) {
              // SOCIAL_GATHERING: look toward conversation partners & nod rhythmically
              headYaw = sin(uTime * 1.45 + ph) * 0.34;
              headPitch = sin(uTime * 4.2 + ph) * 0.10;
            }
            // Pitch rotation around neck (y = 0.82, z = 0.0)
            float cp = cos(headPitch), snp = sin(headPitch);
            vec2 yzH = vec2(transformed.y - 0.82, transformed.z);
            float hy = 0.82 + yzH.x * cp - yzH.y * snp;
            float hz = yzH.x * snp + yzH.y * cp;
            // Yaw rotation around neck (x = 0.0, z = 0.0)
            float cy = cos(headYaw), sny = sin(headYaw);
            float hx = transformed.x * cy + hz * sny;
            hz = -transformed.x * sny + hz * cy;
            transformed.x = hx + swayX;
            transformed.y = hy + breathY - 0.10 * sitW;
            transformed.z = hz;
          }
          // 6. TORSO, PELVIS & NECK (aLimb == 0.0): Breathing, Weight Shift & Seated Lowering
          else {
            transformed.x += swayX;
            transformed.y += breathY - 0.10 * sitW;
          }
          transformed.y += abs(sin(walkPhase)) * 0.026 * walkW;`
        );
    },
    { key: 'person_fsm_v4' }
  )
);

// Living Road Network, Traffic Signals, Cars/Buses/Cyclists (IDM + Turning) & Zebra-Crossing Pedestrians
const trafficSystem = createTrafficSystem({
  world,
  roadsGroup: roadsAndSidewalksGroup,
  decorGroup: treesAndDecorGroup,
  vehiclesGroup,
  PITCH,
  LINES,
  LANES,
  SPAN,
  stores,
  mat,
  glowMat,
  patch,
  worldTone,
  roundedBox,
  solid,
  unitBox,
  unitCyl,
  Batch,
  random,
  personGeo,
  peopleMat,
  radialTex,
  maxAniso,
  getPocketParkElevationY,
  resolvePocketParkObstacleCollision
});

const ambientNature = createAmbientNatureSystem(treesAndDecorGroup, stores, tamanKotaSites);
if (typeof window !== 'undefined') {
  window.ambientNature = ambientNature;
}

const coatPalette = [
  '#d86a43', '#498467', '#d99b38', '#4a7c9b', '#8e6343', '#b85a4c',
  '#5d7a68', '#c87d55', '#688f4e', '#5a6b7c', '#e6dfd5', '#9c6b4e'
];

// ============================================================================
// 1. DEDICATED PEDESTRIAN RING TRACKS (SIDEWALK WAYPOINT LOOPS — 8–10 FIXED NODES)
//    Every building has an 8–10 fixed-node closed loop around its sidewalk on a
//    100% obstacle-free corridor (`clear lane radius`). NPCs ONLY walk along this
//    ordered node sequence (clockwise or counter-clockwise) and only branch
//    perpendicularly from a node (`anchorNodeIdx`) to a `doorEntryPoint`,
//    `benchSeatPoint`, or `shop_window`, then return perpendicularly to that node!
// ============================================================================
export const SIDEWALK_WAYPOINT_LOOPS = {
  // Pos #1 — Glow Studio (10 fixed nodes around clear sidewalk: front z=2.95, right x=3.85, rear z=-3.65, left x=-4.32)
  gable: [
    [-2.35, 2.95], // Node 0: Front-Left window anchor
    [-1.08, 2.95], // Node 1: Front terrazzo bench anchor
    [0.15, 2.95],  // Node 2: Front-Right window anchor
    [1.34, 2.95],  // Node 3: Front entrance door anchor
    [3.85, 2.95],  // Node 4: Front-Right corner
    [3.85, -0.35], // Node 5: Right mid
    [3.85, -3.65], // Node 6: Rear-Right corner
    [0.00, -3.65], // Node 7: Rear mid
    [-4.32, -3.65],// Node 8: Rear-Left corner
    [-4.32, 2.95]  // Node 9: Front-Left corner
  ],
  // Pos #2 — Cozy Bites & Sips (10 fixed nodes: front z=2.98, right x=3.80, rear z=-3.45, left x=-4.05)
  pavilion: [
    [-2.00, 2.98], // Node 0: Front entrance door anchor
    [0.58, 2.98],  // Node 1: Front bakery window anchor
    [1.85, 2.98],  // Node 2: Front bicycle cart anchor
    [3.80, 2.98],  // Node 3: Front-Right corner
    [3.80, -0.30], // Node 4: Right mid
    [3.80, -3.45], // Node 5: Rear-Right corner
    [0.00, -3.45], // Node 6: Rear mid
    [-4.05, -3.45],// Node 7: Rear-Left corner
    [-4.05, -0.48],// Node 8: Left timber bar stool anchor
    [-4.05, 2.98]  // Node 9: Front-Left corner
  ],
  // Pos #3 — Atelier & Boutique (10 fixed nodes: front z=3.35, right x=4.05, rear z=-3.85, left x=-4.48)
  shop: [
    [-2.36, 3.35], // Node 0: Front-Left showcase window anchor
    [-0.05, 3.35], // Node 1: Front-Center showcase window anchor
    [1.48, 3.35],  // Node 2: Front entrance door anchor
    [3.15, 3.35],  // Node 3: Front outer lookbook anchor
    [4.05, 3.35],  // Node 4: Front-Right corner
    [4.05, 0.05],  // Node 5: Right curved bench anchor
    [4.05, -3.85], // Node 6: Rear-Right corner
    [0.00, -3.85], // Node 7: Rear mid
    [-4.48, -3.85],// Node 8: Rear-Left corner
    [-4.48, 3.35]  // Node 9: Front-Left corner
  ],
  // Pos #4 — Circuit & Byte (10 fixed nodes: front z=3.25, right x=3.85, rear z=-3.75, left x=-4.25)
  studio: [
    [-2.96, 3.25], // Node 0: Front-Left digital kiosk anchor
    [-2.07, 3.25], // Node 1: Front-Left gadget window anchor
    [-0.30, 3.25], // Node 2: Front sliding door anchor
    [1.47, 3.25],  // Node 3: Front-Right LED bench anchor
    [3.85, 3.25],  // Node 4: Front-Right corner
    [3.85, -0.35], // Node 5: Right mid
    [3.85, -3.75], // Node 6: Rear-Right corner
    [0.00, -3.75], // Node 7: Rear mid
    [-4.25, -3.75],// Node 8: Rear-Left corner
    [-4.25, 3.25]  // Node 9: Front-Left corner
  ],
  // Pos #5 — Apex Sport (10 fixed nodes: front z=3.85, right x=3.65, rear z=-3.35, left x=-4.05)
  brick: [
    [-2.10, 3.85], // Node 0: Front-Left gear window anchor
    [-0.38, 3.85], // Node 1: Front double door anchor
    [0.77, 3.85],  // Node 2: Front wooden bench anchor
    [2.20, 3.85],  // Node 3: Front-East
    [3.65, 3.85],  // Node 4: Front-Right corner
    [3.65, 0.00],  // Node 5: Right mid
    [3.65, -3.35], // Node 6: Rear-Right corner
    [0.00, -3.35], // Node 7: Rear mid
    [-4.05, -3.35],// Node 8: Rear-Left corner
    [-4.05, 3.85]  // Node 9: Front-Left corner
  ],
  // Pos #6 — Strawberry Corner (10 fixed nodes on 100% clear lane between building furniture z<=1.71 and outer bike racks/planters z>=3.85, x<=-3.98)
  strawberry: [
    [-2.15, 2.68], // Node 0: Front-Left window anchor
    [-0.15, 2.68], // Node 1: Front-Right window anchor
    [1.32, 2.68],  // Node 2: Front cafe table stool anchor
    [3.32, 2.68],  // Node 3: Front-Right corner
    [3.32, 0.00],  // Node 4: Right mid
    [3.32, -2.82], // Node 5: Rear-Right corner
    [0.00, -2.82], // Node 6: Rear wooden planter-bench anchor
    [-3.32, -2.82],// Node 7: Rear-Left corner
    [-3.32, -0.35],// Node 8: Left Teal Cafe Door anchor
    [-3.32, 2.68]  // Node 9: Front-Left corner
  ],
  // Pos #7 — Mayor's Office & Civic Plaza (10 fixed nodes: front z=2.95, right x=3.85, rear z=-3.65, left x=-3.72)
  mayor: [
    [-2.35, 2.95], // Node 0: Front-Left plaza bench anchor
    [-1.15, 2.95], // Node 1: Front civic seal window anchor
    [0.00, 2.95],  // Node 2: Front arched door anchor
    [2.35, 2.95],  // Node 3: Front-Right plaza bench anchor
    [3.85, 2.95],  // Node 4: Front-Right corner / kiosk anchor
    [3.85, -0.35], // Node 5: Right mid
    [3.85, -3.65], // Node 6: Rear-Right corner
    [0.00, -3.65], // Node 7: Rear mid
    [-3.72, -3.65],// Node 8: Rear-Left corner
    [-3.72, 2.95]  // Node 9: Front-Left corner
  ],
  // Contemporary Urban Pocket Park (8 fixed nodes on clear promenade & plaza loop)
  urban_pocket_park: [
    [4.18, 3.35],  // Node 0: Teal bistro table anchor
    [4.18, 1.95],  // Node 1: Yellow bistro table anchor
    [4.18, 0.55],  // Node 2: Coral bistro table anchor
    [4.18, -0.25], // Node 3: Promenade south-east
    [2.65, -0.25], // Node 4: Coffee kiosk counter anchor
    [1.12, -0.25], // Node 5: Plaza center-west
    [2.48, 1.56],  // Node 6: Plaza diagonal north
    [2.98, 3.35]   // Node 7: Plaza north-east
  ],
  // Taman Kota (8 fixed nodes around central fountain ring, 100% clear of Fish Pond Matchmaking Bench at (-2.42, 3.06))
  taman_kota: [
    [0.00, 2.20],  // Node 0: North entry
    [1.65, 1.50],  // Node 1: North-East fountain bench anchor
    [2.35, -0.15], // Node 2: East ice cream cart anchor
    [1.65, -1.80], // Node 3: South-East ring
    [0.00, -2.35], // Node 4: South gazebo entry
    [-1.65, -1.80],// Node 5: South-West ring
    [-2.35, -0.15],// Node 6: West fountain bench anchor
    [-1.65, 1.50]  // Node 7: North-West ring
  ]
};

export const activitySlots = [];
const _slotTmpV = new THREE.Vector3();
const _slotLookV = new THREE.Vector3();

function findNearestLoopNodeIdx(style, lx, lz) {
  const loop = SIDEWALK_WAYPOINT_LOOPS[style] || SIDEWALK_WAYPOINT_LOOPS.gable;
  let bestIdx = 0;
  let bestDistSq = Infinity;
  for (let i = 0; i < loop.length; i++) {
    const dx = loop[i][0] - lx;
    const dz = loop[i][1] - lz;
    const dSq = dx * dx + dz * dz;
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function registerActivitySlot({
  store,
  lx,
  lz,
  lookLx,
  lookLz,
  type,
  groupId,
  emotes,
  seatHeightOffset = 0,
  anchorNodeIdx
}) {
  const g = store.g;
  g.updateMatrixWorld();
  let yLot =
    store.style === 'urban_pocket_park'
      ? 0.180
      : store.style === 'taman_kota'
        ? Math.abs(lx) < 1.15 && Math.abs(lz + 2.68) < 1.15
          ? 0.330
          : 0.198
        : 0.180;
  const worldPos = _slotTmpV.set(lx, yLot + seatHeightOffset, lz).applyMatrix4(g.matrixWorld).clone();
  if (store.style === 'urban_pocket_park') {
    worldPos.y = getPocketParkElevationY(worldPos.x, worldPos.z) + seatHeightOffset;
  }
  const worldLook = _slotLookV.set(lookLx, yLot + seatHeightOffset, lookLz).applyMatrix4(g.matrixWorld).clone();
  const lry = Math.atan2(lookLx - lx, lookLz - lz);
  const exitRy = Math.atan2(lx - lookLx, lz - lookLz);
  const faceRy = g.rotation.y + lry;
  const resolvedAnchorIdx =
    anchorNodeIdx !== undefined ? anchorNodeIdx : findNearestLoopNodeIdx(store.style, lx, lz);

  const slot = {
    id: `${store.style}_${activitySlots.length}`,
    store,
    lx,
    lz,
    lookLx,
    lookLz,
    lry,
    exitRy,
    anchorNodeIdx: resolvedAnchorIdx,
    position: worldPos,
    lookAtTarget: worldLook,
    faceRy,
    type, // 'seat' | 'shop_window' | 'door_entry'
    groupId: groupId || `${store.style}_${type}_${activitySlots.length}`,
    emotes: emotes || ['💬', '✨', '🎵'],
    seatHeightOffset,
    occupiedBy: null
  };
  activitySlots.push(slot);
  return slot;
}

// 1) Register Perpendicular Activity Slots (`doorEntryPoint`, `benchSeatPoint`, `shop_window`) for all 7 Store Blocks (Pos 1 – Pos 7)
stores.forEach(s => {
  if (s.style === 'strawberry') {
    // Pos #6 — Strawberry Corner (all slots branch perpendicularly from SIDEWALK_WAYPOINT_LOOPS.strawberry):
    registerActivitySlot({ store: s, lx: -2.96, lz: -0.35, lookLx: -2.60, lookLz: -0.35, type: 'door_entry', groupId: 'sc_door', emotes: ['🍓', '🍰', '☕'], anchorNodeIdx: 8 });
    registerActivitySlot({ store: s, lx: 1.32, lz: 1.76, lookLx: 0.72, lookLz: 1.71, type: 'seat', groupId: 'sc_cafe_tbl', emotes: ['🍓', '🍰', '☕', '✨'], seatHeightOffset: 0.02, anchorNodeIdx: 2 });
    registerActivitySlot({ store: s, lx: 0.00, lz: -3.52, lookLx: 0.00, lookLz: -2.50, type: 'seat', groupId: 'sc_rear_bench', emotes: ['🍓', '☕', '🎵'], seatHeightOffset: 0.02, anchorNodeIdx: 6 });
    registerActivitySlot({ store: s, lx: -2.15, lz: 2.22, lookLx: -2.15, lookLz: 1.45, type: 'shop_window', groupId: 'sc_win_L', emotes: ['🍓', '🍰', '✨'], anchorNodeIdx: 0 });
    registerActivitySlot({ store: s, lx: -0.15, lz: 2.22, lookLx: -0.15, lookLz: 1.45, type: 'shop_window', groupId: 'sc_win_R', emotes: ['🍓', '🍰', '✨'], anchorNodeIdx: 1 });
  } else if (s.style === 'pavilion') {
    // Pos #2 — Cozy Bites & Sips:
    registerActivitySlot({ store: s, lx: -2.00, lz: 2.04, lookLx: -2.00, lookLz: 1.42, type: 'door_entry', groupId: 'cozy_door', emotes: ['☕', '🥐', '🍰'], anchorNodeIdx: 0 });
    registerActivitySlot({ store: s, lx: -3.14, lz: -0.48, lookLx: -2.18, lookLz: -0.48, type: 'seat', groupId: 'cozy_bar_L', emotes: ['☕', '🥐', '✨', '💬'], seatHeightOffset: 0.12, anchorNodeIdx: 8 });
    registerActivitySlot({ store: s, lx: 0.58, lz: 2.32, lookLx: 0.58, lookLz: 1.45, type: 'shop_window', groupId: 'cozy_win_2', emotes: ['☕', '🥐', '✨'], anchorNodeIdx: 1 });
    registerActivitySlot({ store: s, lx: 1.85, lz: 2.45, lookLx: 2.02, lookLz: 1.78, type: 'shop_window', groupId: 'cozy_cart', emotes: ['☕', '🥐', '✨'], anchorNodeIdx: 2 });
  } else if (s.style === 'shop') {
    // Pos #3 — Atelier & Boutique:
    registerActivitySlot({ store: s, lx: 1.48, lz: 2.25, lookLx: 1.48, lookLz: 1.65, type: 'door_entry', groupId: 'atelier_door', emotes: ['✨', '🛍️', '💬'], anchorNodeIdx: 2 });
    registerActivitySlot({ store: s, lx: 2.90, lz: 0.05, lookLx: 3.90, lookLz: 0.05, type: 'seat', groupId: 'atelier_bench_fr', emotes: ['✨', '☕', '💬'], seatHeightOffset: 0.05, anchorNodeIdx: 5 });
    registerActivitySlot({ store: s, lx: -2.36, lz: 2.55, lookLx: -2.36, lookLz: 1.65, type: 'shop_window', groupId: 'atelier_win_1', emotes: ['✨', '💬', '🎵'], anchorNodeIdx: 0 });
    registerActivitySlot({ store: s, lx: -0.05, lz: 2.55, lookLx: -0.05, lookLz: 1.65, type: 'shop_window', groupId: 'atelier_win_3', emotes: ['✨', '🎵'], anchorNodeIdx: 1 });
    registerActivitySlot({ store: s, lx: 3.15, lz: 4.25, lookLx: 3.15, lookLz: 5.08, type: 'shop_window', groupId: 'atelier_lookbook', emotes: ['✨', '💬'], anchorNodeIdx: 3 });
  } else if (s.style === 'gable') {
    // Pos #1 — Glow Studio:
    registerActivitySlot({ store: s, lx: 1.34, lz: 2.05, lookLx: 1.34, lookLz: 1.41, type: 'door_entry', groupId: 'glow_door', emotes: ['✨', '🛍️', '💬'], anchorNodeIdx: 3 });
    registerActivitySlot({ store: s, lx: -1.08, lz: 1.72, lookLx: -1.08, lookLz: 3.20, type: 'seat', groupId: 'glow_bench_F', emotes: ['✨', '☕', '💬'], seatHeightOffset: 0.03, anchorNodeIdx: 1 });
    registerActivitySlot({ store: s, lx: -2.35, lz: 2.28, lookLx: -2.35, lookLz: 1.45, type: 'shop_window', groupId: 'glow_win_L', emotes: ['✨', '💬', '🎵'], anchorNodeIdx: 0 });
    registerActivitySlot({ store: s, lx: 0.15, lz: 2.28, lookLx: 0.15, lookLz: 1.45, type: 'shop_window', groupId: 'glow_win_R', emotes: ['✨', '💬'], anchorNodeIdx: 2 });
  } else if (s.style === 'studio') {
    // Pos #4 — Circuit & Byte:
    registerActivitySlot({ store: s, lx: -0.30, lz: 2.25, lookLx: -0.30, lookLz: 1.65, type: 'door_entry', groupId: 'cb_door', emotes: ['✨', '🎵', '💬'], anchorNodeIdx: 2 });
    registerActivitySlot({ store: s, lx: 1.47, lz: 2.16, lookLx: 1.47, lookLz: 3.50, type: 'seat', groupId: 'cb_bench_R', emotes: ['☕', '💬', '✨'], seatHeightOffset: 0.04, anchorNodeIdx: 3 });
    registerActivitySlot({ store: s, lx: -2.96, lz: 2.68, lookLx: -2.96, lookLz: 2.11, type: 'shop_window', groupId: 'cb_kiosk', emotes: ['✨', '💬', '🎵'], anchorNodeIdx: 0 });
    registerActivitySlot({ store: s, lx: -2.07, lz: 2.55, lookLx: -2.07, lookLz: 1.75, type: 'shop_window', groupId: 'cb_win_L', emotes: ['🎵', '✨', '💬'], anchorNodeIdx: 1 });
  } else if (s.style === 'brick') {
    // Pos #5 — Apex Sport:
    registerActivitySlot({ store: s, lx: -0.38, lz: 3.02, lookLx: -0.38, lookLz: 2.42, type: 'door_entry', groupId: 'apex_door', emotes: ['✨', '🏆', '💬'], anchorNodeIdx: 1 });
    registerActivitySlot({ store: s, lx: -2.10, lz: 3.25, lookLx: -2.10, lookLz: 2.45, type: 'shop_window', groupId: 'apex_win_L', emotes: ['✨', '🎵', '💬'], anchorNodeIdx: 0 });
    registerActivitySlot({ store: s, lx: 0.77, lz: 2.76, lookLx: 0.77, lookLz: 4.10, type: 'seat', groupId: 'apex_bench_1', emotes: ['☕', '💬', '✨'], seatHeightOffset: 0.03, anchorNodeIdx: 2 });
  } else if (s.style === 'mayor') {
    // Pos #7 — Mayor's Office & Civic Park:
    registerActivitySlot({ store: s, lx: 0.0, lz: 2.15, lookLx: 0.0, lookLz: 1.54, type: 'door_entry', groupId: 'mayor_door', emotes: ['✨', '🏛️', '💬'], anchorNodeIdx: 2 });
    registerActivitySlot({ store: s, lx: -2.35, lz: 1.78, lookLx: -2.35, lookLz: 3.20, type: 'seat', groupId: 'mayor_bench_plaza_L', emotes: ['☕', '💬', '🎵'], seatHeightOffset: 0.02, anchorNodeIdx: 0 });
    registerActivitySlot({ store: s, lx: 2.35, lz: 1.78, lookLx: 2.35, lookLz: 3.20, type: 'seat', groupId: 'mayor_bench_plaza_R', emotes: ['☕', '💬', '✨'], seatHeightOffset: 0.02, anchorNodeIdx: 3 });
    registerActivitySlot({ store: s, lx: -1.15, lz: 2.28, lookLx: -1.15, lookLz: 1.58, type: 'shop_window', groupId: 'mayor_seal', emotes: ['✨', '💬'], anchorNodeIdx: 1 });
    registerActivitySlot({ store: s, lx: 3.65, lz: 2.35, lookLx: 3.65, lookLz: 1.74, type: 'shop_window', groupId: 'mayor_kiosk', emotes: ['✨', '💬'], anchorNodeIdx: 4 });
  }
});

// 2) Register Activity Slots for Contemporary Urban Pocket Park & Taman Kota
//    (CRITICAL RULE: Never register the Scenic Fish Pond Bench at (-2.42, 3.06) — reserved 100% for User Matchmaking!)
tamanKotaSites.forEach((tk, tki) => {
  if (tk.style === 'urban_pocket_park') {
    const bistroTables = [
      [3.45, 3.35, 'upp_bistro_teal', 0],
      [3.45, 1.95, 'upp_bistro_yellow', 1],
      [3.45, 0.55, 'upp_bistro_coral', 2]
    ];
    for (const [tx, tz, gid, nodeIdx] of bistroTables) {
      registerActivitySlot({
        store: tk,
        lx: tx + 0.48,
        lz: tz,
        lookLx: tx,
        lookLz: tz,
        type: 'seat',
        groupId: gid,
        emotes: ['☕', '🍓', '🍰', '💬', '✨'],
        seatHeightOffset: 0.01,
        anchorNodeIdx: nodeIdx
      });
    }
    // Artisanal Coffee Kiosk Counter Window
    registerActivitySlot({ store: tk, lx: 2.65, lz: -0.58, lookLx: 2.65, lookLz: -1.75, type: 'shop_window', groupId: 'upp_kiosk_N', emotes: ['☕', '🥐', '✨'], anchorNodeIdx: 4 });
    return;
  }

  // Taman Kota: Curved Vintage Fountain Benches & Vintage Ice Cream Cart
  // (NOTE: Fish Pond Bench at (-2.42, 3.06) is 100% EXCLUDED!)
  const fz0 = -0.15;
  for (const [bAng, idx, nodeIdx] of [[-2.00, 0, 6], [0.90, 1, 1]]) {
    const bx = Math.sin(bAng) * 1.72;
    const bz = fz0 + Math.cos(bAng) * 1.72;
    registerActivitySlot({
      store: tk,
      lx: bx,
      lz: bz,
      lookLx: 0,
      lookLz: fz0,
      type: 'seat',
      groupId: `tk_${tki}_fountain_${idx}`,
      emotes: ['☕', '🍓', '🎵', '✨'],
      seatHeightOffset: 0.03,
      anchorNodeIdx: nodeIdx
    });
  }
  // Vintage Ice Cream Cart
  registerActivitySlot({ store: tk, lx: 1.98, lz: -0.92, lookLx: 2.42, lookLz: -1.25, type: 'shop_window', groupId: `tk_${tki}_icecream`, emotes: ['🍓', '🍰', '✨'], anchorNodeIdx: 2 });
});

// ============================================================================
// OBSTACLE REGISTRY FOR SMOOTH TANGENTIAL STEERING (`obstacleColliders`)
// Registers world (x, z) and radii of streetlamp poles, street signposts,
// benches, plant pots/planters, A-frame menu boards, bike racks, café tables,
// fountains, kiosks, and building walls across Pos 1 – Pos 7 and Parks.
// ============================================================================
export const obstacleColliders = [];
const _colTmpV = new THREE.Vector3();

function registerLocalCircleCollider(site, lx, lz, r, kind = 'pole') {
  const g = site.g;
  g.updateMatrixWorld();
  _colTmpV.set(lx, 0.18, lz).applyMatrix4(g.matrixWorld);
  obstacleColliders.push({
    x: _colTmpV.x,
    z: _colTmpV.z,
    r: Math.max(0.45, r),
    kind,
    isBox: false,
    store: site
  });
}

function registerLocalBoxCollider(site, cx, cz, halfW, halfD, pad = 0.32, kind = 'wall') {
  const g = site.g;
  g.updateMatrixWorld();
  _colTmpV.set(cx, 0.18, cz).applyMatrix4(g.matrixWorld);
  const ry = g.rotation.y || 0;
  obstacleColliders.push({
    x: _colTmpV.x,
    z: _colTmpV.z,
    cos: Math.cos(ry),
    sin: Math.sin(ry),
    hx: halfW,
    hz: halfD,
    r: pad,
    kind,
    isBox: true,
    store: site
  });
}

// 1) Register Store Block Obstacles (Pos 1 – Pos 7)
stores.forEach(s => {
  if (s.style === 'gable') {
    registerLocalBoxCollider(s, 0, -0.35, 3.20, 1.76, 0.32, 'wall');
    registerLocalCircleCollider(s, -4.92, 4.92, 0.48, 'pole');
    registerLocalCircleCollider(s, 4.92, 4.92, 0.48, 'pole');
    registerLocalCircleCollider(s, -1.08, 1.69, 0.55, 'bench');
    registerLocalCircleCollider(s, -2.12, 1.69, 0.48, 'pot');
    registerLocalCircleCollider(s, 2.28, 1.71, 0.48, 'sign');
  } else if (s.style === 'pavilion') {
    registerLocalBoxCollider(s, 0, -0.30, 2.62, 1.72, 0.32, 'wall');
    registerLocalCircleCollider(s, -4.92, 4.92, 0.48, 'pole');
    registerLocalCircleCollider(s, 4.92, 4.92, 0.48, 'pole');
    registerLocalCircleCollider(s, -2.80, -0.48, 0.58, 'table');
    registerLocalCircleCollider(s, -4.55, -3.88, 0.58, 'bench');
    registerLocalCircleCollider(s, 2.02, 1.78, 0.56, 'table');
  } else if (s.style === 'shop') {
    registerLocalBoxCollider(s, -0.35, -0.50, 3.00, 2.15, 0.32, 'wall');
    registerLocalCircleCollider(s, -4.92, 4.92, 0.48, 'pole');
    registerLocalCircleCollider(s, 4.92, 4.92, 0.48, 'pole');
    registerLocalCircleCollider(s, -3.72, -0.98, 0.58, 'table');
    registerLocalCircleCollider(s, -3.72, 0.24, 0.58, 'table');
    registerLocalCircleCollider(s, 2.93, 0.05, 0.58, 'bench');
    registerLocalCircleCollider(s, 2.95, 1.38, 0.52, 'pot');
    registerLocalCircleCollider(s, 2.95, -2.25, 0.52, 'pot');
    registerLocalCircleCollider(s, -2.15, 5.08, 0.55, 'bikerack');
    registerLocalCircleCollider(s, 3.15, 5.08, 0.55, 'sign');
  } else if (s.style === 'studio') {
    registerLocalBoxCollider(s, -0.30, -0.35, 3.20, 2.00, 0.32, 'wall');
    registerLocalCircleCollider(s, -4.92, 4.92, 0.48, 'pole');
    registerLocalCircleCollider(s, 4.92, 4.92, 0.48, 'pole');
    registerLocalCircleCollider(s, 1.47, 2.13, 0.58, 'bench');
    registerLocalCircleCollider(s, -2.96, 2.11, 0.52, 'sign');
  } else if (s.style === 'brick') {
    registerLocalBoxCollider(s, -0.38, 0.0, 2.90, 2.42, 0.32, 'wall');
    registerLocalCircleCollider(s, -6.42, 5.12, 0.48, 'pole');
    registerLocalCircleCollider(s, 4.92, 4.92, 0.48, 'pole');
    registerLocalCircleCollider(s, 4.92, -4.92, 0.48, 'pole');
    registerLocalCircleCollider(s, 0.77, 2.73, 0.58, 'bench');
    registerLocalCircleCollider(s, 5.04, -1.80, 0.55, 'bikerack');
    registerLocalCircleCollider(s, 3.01, -3.88, 0.52, 'pot');
    registerLocalCircleCollider(s, -5.91, -3.88, 0.52, 'pot');
  } else if (s.style === 'strawberry') {
    registerLocalBoxCollider(s, -0.10, -0.35, 2.50, 1.76, 0.32, 'wall');
    registerLocalCircleCollider(s, -4.92, 4.92, 0.48, 'pole');
    registerLocalCircleCollider(s, 4.92, 4.92, 0.48, 'pole');
    registerLocalCircleCollider(s, -1.25, 1.69, 0.55, 'bench');
    registerLocalCircleCollider(s, 0.72, 1.71, 0.55, 'table');
    registerLocalCircleCollider(s, 0.00, -3.65, 0.55, 'bench');
    registerLocalCircleCollider(s, -2.85, 3.85, 0.55, 'pot');
    registerLocalCircleCollider(s, 2.75, 3.85, 0.55, 'pot');
    registerLocalCircleCollider(s, -1.45, 4.18, 0.55, 'bikerack');
    registerLocalCircleCollider(s, 3.95, 4.18, 0.55, 'bikerack');
    registerLocalCircleCollider(s, -3.98, 2.35, 0.55, 'pot');
    registerLocalCircleCollider(s, -4.02, -0.20, 0.55, 'bikerack');
    registerLocalCircleCollider(s, -3.98, -2.35, 0.55, 'pot');
    registerLocalCircleCollider(s, -3.85, -3.85, 0.55, 'pot');
    registerLocalCircleCollider(s, 2.65, -3.85, 0.55, 'pot');
    registerLocalCircleCollider(s, 3.65, -3.85, 0.55, 'pot');
  } else if (s.style === 'mayor') {
    registerLocalBoxCollider(s, 0, -0.38, 3.20, 1.92, 0.32, 'wall');
    registerLocalCircleCollider(s, -4.92, 4.92, 0.48, 'pole');
    registerLocalCircleCollider(s, 4.92, 4.92, 0.48, 'pole');
    registerLocalCircleCollider(s, -2.35, 1.74, 0.58, 'bench');
    registerLocalCircleCollider(s, 2.35, 1.74, 0.58, 'bench');
    registerLocalCircleCollider(s, 3.65, 1.74, 0.52, 'sign');
    registerLocalCircleCollider(s, -4.25, 3.58, 0.52, 'sign');
    registerLocalCircleCollider(s, -4.25, 2.75, 0.52, 'fountain');
    registerLocalCircleCollider(s, -PITCH, 0, 1.35, 'fountain');
  }
});

// 2) Register Taman Kota & Urban Pocket Park Obstacles
tamanKotaSites.forEach(tk => {
  if (tk.style === 'urban_pocket_park') {
    registerLocalCircleCollider(tk, 3.45, 3.35, 0.68, 'table');
    registerLocalCircleCollider(tk, 3.45, 1.95, 0.68, 'table');
    registerLocalCircleCollider(tk, 3.45, 0.55, 0.68, 'table');
    registerLocalCircleCollider(tk, 2.35, -3.33, 0.68, 'bench');
    registerLocalCircleCollider(tk, -3.45, -3.48, 0.60, 'pot');
    registerLocalBoxCollider(tk, -2.50, -2.32, 1.15, 0.80, 0.32, 'wall');
    registerLocalBoxCollider(tk, 2.65, -1.75, 1.15, 0.85, 0.32, 'wall');
    registerLocalBoxCollider(tk, -1.10, -0.58, 1.05, 0.68, 0.32, 'wall');
    registerLocalCircleCollider(tk, 4.92, 4.92, 0.48, 'pole');
    registerLocalCircleCollider(tk, 4.92, -4.92, 0.48, 'pole');
    registerLocalCircleCollider(tk, -4.92, -4.92, 0.48, 'pole');
  } else {
    registerLocalCircleCollider(tk, 0, -0.15, 1.10, 'fountain');
    registerLocalCircleCollider(tk, 2.42, -1.25, 0.68, 'table');
    registerLocalCircleCollider(tk, -2.42, 3.06, 0.75, 'bench');
    registerLocalCircleCollider(tk, -2.45, 2.05, 1.20, 'fountain');
    for (const bAng of [-2.00, 0.90]) {
      registerLocalCircleCollider(tk, Math.sin(bAng) * 1.72, -0.15 + Math.cos(bAng) * 1.72, 0.68, 'bench');
    }
  }
});

// 3) Register Intersection Traffic Signal Poles across all LANES
for (const ix of LANES) {
  for (const iz of LANES) {
    if (Math.abs(ix - 2.5 * PITCH) < 1.0 && Math.abs(iz - -PITCH) < 1.0) continue;
    const cOff = 2.65;
    for (const [sx, sz] of [[-1, -1], [1, 1], [-1, 1], [1, -1]]) {
      obstacleColliders.push({
        x: ix + sx * cOff,
        z: iz + sz * cOff,
        r: 0.52,
        kind: 'pole',
        isBox: false,
        store: null
      });
    }
  }
}

if (typeof window !== 'undefined') {
  window.obstacleColliders = obstacleColliders;
}

/**
 * 2. SMOOTH TANGENTIAL STEERING (NO PINBALL REPULSION / JITTER FIX)
 * Never applies instant radial pushback (`position += normal * pushStrength`).
 * Instead, if an obstacle or another NPC is ahead within `0.8m`, smoothly deflects
 * `targetAngle` tangentially by 45°–90° away from the obstacle center so the NPC
 * steers around it cleanly using `lerpAngle(..., 0.08)` and forward-facing velocity!
 */
function computeTangentialSteering(agent, agentIdx, wx, wz, baseTargetAngle) {
  let steeredAngle = baseTargetAngle;
  let speedFactor = 1.0;
  const fwdX = Math.sin(baseTargetAngle);
  const fwdZ = Math.cos(baseTargetAngle);
  const skipFurniture =
    agent.slot !== null ||
    agent.fsmState === 'RETURNING_TO_LOOP' ||
    agent.fsmState === 'SEATED_DINING' ||
    agent.fsmState === 'WINDOW_SHOPPING' ||
    agent.fsmState === 'APPROACHING_DOOR';

  // A) Check static obstacles within 0.8m ahead
  for (let i = 0; i < obstacleColliders.length; i++) {
    const col = obstacleColliders[i];
    if (col.store && col.store !== agent.store) continue;
    if (skipFurniture && (col.kind === 'bench' || col.kind === 'table' || col.kind === 'sign')) continue;

    let obsX = col.x;
    let obsZ = col.z;
    let obsR = col.r;

    if (col.isBox) {
      const dxB = wx - col.x;
      const dzB = wz - col.z;
      const lx = dxB * col.cos - dzB * col.sin;
      const lz = dxB * col.sin + dzB * col.cos;
      const cx = Math.max(-col.hx, Math.min(col.hx, lx));
      const cz = Math.max(-col.hz, Math.min(col.hz, lz));
      obsX = col.x + cx * col.cos + cz * col.sin;
      obsZ = col.z - cx * col.sin + cz * col.cos;
      obsR = col.r;
    }

    const toObsX = obsX - wx;
    const toObsZ = obsZ - wz;
    const dist = Math.hypot(toObsX, toObsZ);
    if (dist < 0.001) continue;
    const surfaceDist = dist - obsR * 0.65;

    if (surfaceDist < 0.80) {
      const nx = toObsX / dist;
      const nz = toObsZ / dist;
      const fwdDot = fwdX * nx + fwdZ * nz;
      if (fwdDot > 0.20) {
        const cross = fwdX * nz - fwdZ * nx;
        const sideSign = Math.abs(cross) > 0.05 ? (cross >= 0 ? 1 : -1) : (agent.dir || 1);
        const closeness = Math.max(0, Math.min(1, (0.80 - surfaceDist) / 0.80));
        // Deflect targetAngle by 45° (0.785 rad) to 90° (1.571 rad) tangentially away from obstacle
        const deflectRad = (Math.PI * 0.25 + Math.PI * 0.25 * closeness) * sideSign;
        steeredAngle = lerpCrowdAngle(steeredAngle, baseTargetAngle + deflectRad, 0.65);
      }
    }
  }

  // B) Check other visible NPCs within 0.8m–1.3m ahead
  for (let j = 0; j < agents.length; j++) {
    if (j === agentIdx) continue;
    const other = agents[j];
    if (other.visible === false || other.fsmState === 'INSIDE_STORE') continue;
    const owp = _worldPos[j];
    if (!owp) continue;

    const toOtherX = owp.x - wx;
    const toOtherZ = owp.z - wz;
    const dist = Math.hypot(toOtherX, toOtherZ);
    if (dist < 0.001 || dist > 1.35) continue;

    const nx = toOtherX / dist;
    const nz = toOtherZ / dist;
    const fwdDot = fwdX * nx + fwdZ * nz;

    if (fwdDot > 0.25) {
      if (
        other.store === agent.store &&
        other.fsmState === 'WALKING' &&
        agent.fsmState === 'WALKING' &&
        other.dir === agent.dir
      ) {
        // Same-direction walker ahead on the same sidewalk loop: smoothly pace speed to maintain clean spacing
        speedFactor = Math.min(speedFactor, Math.max(0.35, (dist - 0.55) / 0.80));
      } else if (dist < 0.80) {
        // Stationary or oncoming NPC within 0.8m ahead: smoothly steer 45°–75° tangentially around them
        const cross = fwdX * nz - fwdZ * nx;
        const sideSign = Math.abs(cross) > 0.05 ? (cross >= 0 ? 1 : -1) : (agent.dir || 1);
        const closeness = Math.max(0, Math.min(1, (0.80 - dist) / 0.80));
        const deflectRad = (Math.PI * 0.25 + Math.PI * 0.18 * closeness) * sideSign;
        steeredAngle = lerpCrowdAngle(steeredAngle, baseTargetAngle + deflectRad, 0.55);
      }
    }
  }

  return [steeredAngle, speedFactor];
}

// ============================================================================
// TINY FLOATING EMOTES SYSTEM (☕, 🍓, 💬, 🎵, ✨, 🥐, 🍰)
// Soft mini expression bubbles (opacity <= 0.85, 2.0s duration with fade-out)
// ============================================================================
const emoteTextures = new Map();

function getEmoteTexture(icon) {
  if (emoteTextures.has(icon)) return emoteTextures.get(icon);
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 128, 128);

  // Soft warm translucent circular pill badge with subtle border
  ctx.fillStyle = 'rgba(255, 252, 245, 0.92)';
  ctx.beginPath();
  ctx.arc(64, 64, 46, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(232, 182, 142, 0.85)';
  ctx.stroke();

  // Tiny speech tail at bottom
  ctx.beginPath();
  ctx.moveTo(54, 106);
  ctx.lineTo(64, 120);
  ctx.lineTo(74, 106);
  ctx.closePath();
  ctx.fill();

  ctx.font = '56px "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(icon, 64, 65);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  emoteTextures.set(icon, tex);
  return tex;
}

const MAX_ACTIVE_EMOTES = 28;
const emotePool = [];
for (let i = 0; i < MAX_ACTIVE_EMOTES; i++) {
  const matSprite = new THREE.SpriteMaterial({
    map: getEmoteTexture('💬'),
    transparent: true,
    opacity: 0,
    depthWrite: false
  });
  const sprite = new THREE.Sprite(matSprite);
  sprite.visible = false;
  sprite.scale.setScalar(0.28);
  sprite.userData = { active: false, age: 0, duration: 2.0, agentIdx: -1 };
  npcsGroup.add(sprite);
  emotePool.push(sprite);
}

function spawnNpcEmote(agentIdx, icon) {
  for (let i = 0; i < emotePool.length; i++) {
    const sp = emotePool[i];
    if (sp.userData.active && sp.userData.agentIdx === agentIdx) return;
  }
  for (let i = 0; i < emotePool.length; i++) {
    const sp = emotePool[i];
    if (!sp.userData.active) {
      sp.material.map = getEmoteTexture(icon);
      sp.material.opacity = 0;
      sp.visible = true;
      sp.userData.active = true;
      sp.userData.age = 0;
      sp.userData.duration = 2.0;
      sp.userData.agentIdx = agentIdx;
      return;
    }
  }
}

// ============================================================================
// POPULATE 100% DYNAMIC FSM NPCs ACROSS ALL STORES & PARKS (Zero Static Statues!)
// ============================================================================
const agents = [];

function createFsmAgent(store, idxInStore, totalInStore, share, colorIdx) {
  const loop = SIDEWALK_WAYPOINT_LOOPS[store.style] || SIDEWALK_WAYPOINT_LOOPS.gable;
  const N = loop.length;
  const dir = 1; // Clockwise pedestrian ring flow around each building sidewalk block
  const startNodeIdx = Math.floor((idxInStore / Math.max(1, totalInStore)) * N) % N;
  const nextNodeIdx = (startNodeIdx + dir + N) % N;
  const [sx, sz] = loop[startNodeIdx];
  const [nx, nz] = loop[nextNodeIdx];
  const initLry = Math.atan2(nx - sx, nz - sz);

  // Actual world walking speed in meters/second (0.68–0.82 m/s cozy pedestrian stroll)
  const moveSpeed =
    store.style === 'urban_pocket_park' || store.style === 'taman_kota'
      ? 0.62 + (idxInStore % 2) * 0.05
      : store.style === 'mayor'
        ? 0.65 + (idxInStore % 2) * 0.05
        : 0.72 + (idxInStore % 2) * 0.06;

  return {
    store,
    mode: 'circuit',
    fsmState: 'WALKING', // 'WALKING' | 'APPROACHING_DOOR' | 'INSIDE_STORE' | 'APPROACHING_SLOT' | 'WINDOW_SHOPPING' | 'SEATED_DINING' | 'RETURNING_TO_LOOP'
    slot: null,
    nodeIdx: nextNodeIdx,
    returnNodeIdx: startNodeIdx,
    stateTimer: 0,
    cooldownTimer: 2.0 + random() * 4.0,
    emoteTimer: 4.0 + random() * 7.0,
    phase: random(),
    seed: random(),
    walkPhase: random() * Math.PI * 2,
    dir,
    moveSpeed,
    actualSpeed: moveSpeed,
    x: sx,
    z: sz,
    ry: initLry,
    worldRy: (store.g.rotation.y || 0) + initLry,
    walkWeight: 1.0,
    sitWeight: 0.0,
    actionCode: 0.0,
    scale: 0.94 + random() * 0.12,
    portalFade: 1.0,
    visible: true,
    color: coatPalette[colorIdx % coatPalette.length]
  };
}

// Strict Per-Block NPC Quota: 3–4 NPCs per Store Block (Pos 1 – Pos 7) + 3 across Parks = 28 NPCs total across Cerria Town!
stores.forEach((s, si) => {
  const share = Math.pow(s.lab.friends / 60, 0.65);
  const count =
    s.style === 'pavilion' || s.style === 'shop' || s.style === 'strawberry' || s.style === 'mayor'
      ? 4
      : 3;
  for (let w = 0; w < count; w++) {
    agents.push(createFsmAgent(s, w, count, share, w + si * 5));
  }
});

tamanKotaSites.forEach((tk, tki) => {
  const count = 1;
  for (let w = 0; w < count; w++) {
    agents.push(createFsmAgent(tk, w, count, 0.7, w * 2 + tki * 5 + 1));
  }
});

// Helper: Check per-block role limits so every block maintains a balanced distribution:
// - 1–2 SEATED_DINING (leaving other chairs/benches naturally empty)
// - Max 1 WINDOW_SHOPPING at a time
// - Max 1 INSIDE_STORE / door_entry at a time
// - At least 1 WALKING at all times
function canReserveBlockSlot(agent, slot) {
  const store = agent.store;
  let seated = 0;
  let winShop = 0;
  let insideStore = 0;
  let walkers = 0;
  for (let i = 0; i < agents.length; i++) {
    const other = agents[i];
    if (other.store !== store) continue;
    if (other.fsmState === 'SEATED_DINING' || (other.slot && other.slot.type === 'seat')) seated++;
    else if (other.fsmState === 'WINDOW_SHOPPING' || (other.slot && other.slot.type === 'shop_window')) winShop++;
    else if (
      other.fsmState === 'INSIDE_STORE' ||
      other.fsmState === 'APPROACHING_DOOR' ||
      (other.slot && other.slot.type === 'door_entry')
    ) {
      insideStore++;
    } else if (other.fsmState === 'WALKING' || other.fsmState === 'RETURNING_TO_LOOP') {
      walkers++;
    }
  }
  if (walkers <= 1) return false;

  // Enforce >= 0.75m minimum distance between any two occupied slots so NPCs never clip while seated/standing
  for (let k = 0; k < activitySlots.length; k++) {
    const occ = activitySlots[k];
    if (occ.occupiedBy && occ.occupiedBy !== agent) {
      if (slot.position.distanceTo(occ.position) < 0.78) return false;
    }
  }

  const maxSeated = store.style === 'pavilion' || store.style === 'strawberry' ? 2 : 1;
  if (slot.type === 'seat') {
    return seated < maxSeated;
  }
  if (slot.type === 'shop_window') {
    return winShop < 1;
  }
  if (slot.type === 'door_entry') {
    return insideStore < 1;
  }
  return false;
}

// Balanced Pre-Seeding at t = 0:
// In each store block (3–4 NPCs):
//   - Agent 0 -> SEATED_DINING (1 seated on cafe chair/bench)
//   - Agent 1 -> WINDOW_SHOPPING (1 briefly browsing storefront display)
//   - Remaining 1–2 Agents -> WALKING along the Sidewalk Waypoint Loop at distinct nodes!
stores.forEach(s => {
  const loop = SIDEWALK_WAYPOINT_LOOPS[s.style] || SIDEWALK_WAYPOINT_LOOPS.gable;
  const N = loop.length;
  const blockAgents = agents.filter(a => a.store === s);
  const seatSlots = activitySlots.filter(sl => sl.store === s && sl.type === 'seat' && sl.occupiedBy === null);
  const winSlots = activitySlots.filter(sl => sl.store === s && sl.type === 'shop_window' && sl.occupiedBy === null);

  if (blockAgents[0] && seatSlots.length > 0) {
    const chosenSeat = seatSlots[Math.floor(random() * seatSlots.length)];
    chosenSeat.occupiedBy = blockAgents[0];
    blockAgents[0].slot = chosenSeat;
    blockAgents[0].x = chosenSeat.lx;
    blockAgents[0].z = chosenSeat.lz;
    blockAgents[0].ry = chosenSeat.lry;
    blockAgents[0].worldRy = (s.g.rotation.y || 0) + chosenSeat.lry;
    blockAgents[0].returnNodeIdx = chosenSeat.anchorNodeIdx;
    blockAgents[0].fsmState = 'SEATED_DINING';
    blockAgents[0].stateTimer = 18 + random() * 16;
    blockAgents[0].actualSpeed = 0.0;
    blockAgents[0].walkWeight = 0.0;
    blockAgents[0].sitWeight = 1.0;
    blockAgents[0].actionCode = 2.0;
  }

  if (blockAgents[1] && winSlots.length > 0) {
    const chosenWin = winSlots[Math.floor(random() * winSlots.length)];
    chosenWin.occupiedBy = blockAgents[1];
    blockAgents[1].slot = chosenWin;
    blockAgents[1].x = chosenWin.lx;
    blockAgents[1].z = chosenWin.lz;
    blockAgents[1].ry = chosenWin.lry;
    blockAgents[1].worldRy = (s.g.rotation.y || 0) + chosenWin.lry;
    blockAgents[1].returnNodeIdx = chosenWin.anchorNodeIdx;
    blockAgents[1].fsmState = 'WINDOW_SHOPPING';
    blockAgents[1].stateTimer = 5.0 + random() * 4.0;
    blockAgents[1].actualSpeed = 0.0;
    blockAgents[1].walkWeight = 0.0;
    blockAgents[1].sitWeight = 0.0;
    blockAgents[1].actionCode = 1.0;
  }

  // Place the remaining WALKING agents on well-separated nodes (e.g., node 3 and node 7) around the Sidewalk Waypoint Loop!
  const walkers = blockAgents.filter(a => a.fsmState === 'WALKING');
  walkers.forEach((wAgent, wi) => {
    const startIdx = (3 + wi * 5) % N;
    const nextIdx = (startIdx + wAgent.dir + N) % N;
    const [sx, sz] = loop[startIdx];
    const [nx, nz] = loop[nextIdx];
    const lry = Math.atan2(nx - sx, nz - sz);
    wAgent.x = sx;
    wAgent.z = sz;
    wAgent.nodeIdx = nextIdx;
    wAgent.returnNodeIdx = startIdx;
    wAgent.ry = lry;
    wAgent.worldRy = (s.g.rotation.y || 0) + lry;
  });
});

const people = new THREE.InstancedMesh(personGeo, peopleMat, agents.length);
people.name = 'Dynamic_NPCs_People';
people.castShadow = people.receiveShadow = true;
const wardrobes = new Float32Array(agents.length * 4);
const npcStates = new Float32Array(agents.length * 4);
agents.forEach((a, i) => {
  // Varied Cozy Wardrobe Palette per NPC (Sweater, Pants, Hair, Skin + Shoe + Hairstyle)
  const storeNum = Math.max(0, stores.indexOf(a.store));
  const shirtIdx = (i * 3 + storeNum * 2) % NPC_PALETTES.shirts.length;
  const pantsIdx = (i * 2 + storeNum + 1) % NPC_PALETTES.pants.length;
  const hairIdx = (i + storeNum + Math.floor((a.seed || 0) * 11)) % NPC_PALETTES.hairs.length;
  const skinIdx = (i + storeNum) % NPC_PALETTES.skins.length;
  const shoeIdx = (i + Math.floor((a.seed || 0) * 7)) % NPC_PALETTES.shoes.length;
  const styleIdx = (i + storeNum * 2) % 4; // 0: Bob, 1: Bun/Ponytail, 2: Beret, 3: Curtain Bangs
  wardrobes[i * 4] = shirtIdx;
  wardrobes[i * 4 + 1] = pantsIdx;
  wardrobes[i * 4 + 2] = hairIdx;
  wardrobes[i * 4 + 3] = skinIdx + shoeIdx * 3 + styleIdx * 6;

  npcStates[i * 4] = a.walkPhase;
  npcStates[i * 4 + 1] = a.walkWeight;
  npcStates[i * 4 + 2] = a.sitWeight;
  npcStates[i * 4 + 3] = a.actionCode;
});
const wardrobeAttr = new THREE.InstancedBufferAttribute(wardrobes, 4);
const npcStateAttr = new THREE.InstancedBufferAttribute(npcStates, 4);
personGeo.setAttribute('aWardrobe', wardrobeAttr);
personGeo.setAttribute('aNpcState', npcStateAttr);
npcsGroup.add(people);

const blobGeo = new THREE.PlaneGeometry(0.54, 0.54);
blobGeo.rotateX(-Math.PI / 2);
const blobMat = new THREE.MeshBasicMaterial({
  map: radialTex,
  color: '#121814',
  transparent: true,
  opacity: 0.34,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -2,
  polygonOffsetUnits: -2
});
const blobs = new THREE.InstancedMesh(blobGeo, blobMat, agents.length);
blobs.name = 'Dynamic_NPCs_ShadowBlobs';
blobs.frustumCulled = false;
blobs.castShadow = false;
blobs.receiveShadow = false;
npcsGroup.add(blobs);

await setLoadingProgress(75, 'Buat Dekorasi, Pohon, Mobil, & NPC…', 'Menghidupkan kendaraan lalu lintas dan warga Cerria Town');

const _v = new THREE.Vector3();
const _invStoreMat = new THREE.Matrix4();
const _worldPos = agents.map(a => {
  const g = a.store.g;
  g.updateMatrixWorld();
  _v.set(a.x || 0, 0.180, a.z || 0).applyMatrix4(g.matrixWorld);
  return { x: _v.x, y: 0.180, z: _v.z, ry: a.worldRy };
});

function lerpCrowdAngle(current, target, alpha) {
  if (current === undefined) return target;
  let diff = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * alpha;
}

function shortestAngleDiff(current, target) {
  let diff = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

let _lastCrowdTime = 0;

function updateCrowd(time) {
  const dt = Math.min(0.05, Math.max(0.001, time - _lastCrowdTime || 0.016));
  _lastCrowdTime = time;
  uWalkTime.value = time;

  // Frame-rate normalized 0.08 angle interpolation factor (exact 0.08 per frame at 60fps)
  const steerLerpFactor = 1.0 - Math.pow(1.0 - 0.08, dt * 60.0);

  for (let i = 0; i < agents.length; i++) {
    const a = agents[i];
    const g = a.store.g;
    const storeRotY = g.rotation.y || 0;
    const loop = SIDEWALK_WAYPOINT_LOOPS[a.store.style] || SIDEWALK_WAYPOINT_LOOPS.gable;
    const N = loop.length;

    if (a.cooldownTimer > 0) {
      a.cooldownTimer = Math.max(0, a.cooldownTimer - dt);
    }

    let seatYOff = 0;
    let actualSpeed = 0.0;

    // Current world position before step
    _v.set(a.x, 0.180, a.z).applyMatrix4(g.matrixWorld);
    let wx = _v.x;
    let wz = _v.z;

    if (a.fsmState === 'INSIDE_STORE') {
      // 3. STORE ENTRY PORTAL STATE:
      // Smoothly shrink/fade out over 0.3s -> set `a.visible = false` for 5–10s shopping timer ->
      // respawn at `doorEntryPoint` facing outward toward its perpendicular loop anchor node!
      const sl = a.slot;
      a.stateTimer -= dt;
      actualSpeed = 0.0;
      a.sitWeight = 0.0;
      a.actionCode = 0.0;

      if (a.portalFade > 0.0) {
        a.portalFade = Math.max(0.0, a.portalFade - dt / 0.30);
        if (sl) {
          a.ry = sl.lry;
          a.worldRy = storeRotY + sl.lry;
        }
        if (a.portalFade <= 0.01) {
          a.portalFade = 0.0;
          a.visible = false;
        }
      } else {
        a.visible = false;
      }

      if (a.stateTimer <= 0) {
        // Finished shopping inside the store (5–10s)! Respawn at doorEntryPoint facing outward toward the sidewalk loop:
        const retIdx = sl ? sl.anchorNodeIdx : findNearestLoopNodeIdx(a.store.style, a.x, a.z);
        const [rx, rz] = loop[retIdx];
        if (sl) {
          a.x = sl.lx;
          a.z = sl.lz;
          sl.occupiedBy = null;
        }
        const outLry = Math.atan2(rx - a.x, rz - a.z);
        a.ry = outLry;
        a.worldRy = storeRotY + outLry;
        a.slot = null;
        a.returnNodeIdx = retIdx;
        a.visible = true;
        a.portalFade = 0.05; // Smoothly scale/fade in over 0.3s while walking back to the sidewalk loop
        a.fsmState = 'RETURNING_TO_LOOP';
        a.cooldownTimer = 7.0 + random() * 5.0;
        spawnNpcEmote(i, '🛍️');
        _v.set(a.x, 0.180, a.z).applyMatrix4(g.matrixWorld);
        wx = _v.x;
        wz = _v.z;
      }
    } else if (
      a.fsmState === 'WALKING' ||
      a.fsmState === 'RETURNING_TO_LOOP' ||
      a.fsmState === 'APPROACHING_DOOR' ||
      a.fsmState === 'APPROACHING_SLOT'
    ) {
      // Active Locomotion State along the Sidewalk Waypoint Loop or Perpendicular Slot Branch
      a.visible = true;
      if (a.portalFade < 1.0) {
        a.portalFade = Math.min(1.0, (a.portalFade ?? 1.0) + dt / 0.30);
      }

      let tx = a.x;
      let tz = a.z;

      if (a.fsmState === 'WALKING') {
        const targetNode = loop[a.nodeIdx] || loop[0];
        tx = targetNode[0];
        tz = targetNode[1];
        const distToNode = Math.hypot(tx - a.x, tz - a.z);

        if (distToNode < 0.26) {
          // Arrived at fixed sidewalk waypoint node `a.nodeIdx`!
          const reachedIdx = a.nodeIdx;
          let branchedToSlot = false;

          // Only occasionally turn perpendicularly toward a `doorEntryPoint`, `benchSeatPoint`, or `shop_window` anchored to this node
          if (a.cooldownTimer <= 0) {
            for (let sIdx = 0; sIdx < activitySlots.length; sIdx++) {
              const sl = activitySlots[sIdx];
              if (sl.store !== a.store || sl.occupiedBy !== null) continue;
              if (sl.anchorNodeIdx !== reachedIdx) continue;
              if (!canReserveBlockSlot(a, sl)) continue;

              a.cooldownTimer = 5.0 + random() * 4.0;
              const chance = sl.type === 'door_entry' ? 0.45 : sl.type === 'seat' ? 0.45 : 0.38;
              if (random() < chance) {
                sl.occupiedBy = a;
                a.slot = sl;
                a.returnNodeIdx = reachedIdx;
                a.emoteTimer = 2.5 + random() * 4.5;
                if (sl.type === 'door_entry') {
                  a.fsmState = 'APPROACHING_DOOR';
                  a.stateTimer = 5.0 + random() * 5.0; // 5–10s inside store
                } else {
                  a.fsmState = 'APPROACHING_SLOT';
                  a.stateTimer = sl.type === 'seat' ? 18.0 + random() * 16.0 : 5.0 + random() * 3.5;
                }
                tx = sl.lx;
                tz = sl.lz;
                branchedToSlot = true;
                break;
              }
            }
          }

          if (!branchedToSlot) {
            a.nodeIdx = (reachedIdx + a.dir + N) % N;
            tx = loop[a.nodeIdx][0];
            tz = loop[a.nodeIdx][1];
          }
        }
      } else if (a.fsmState === 'RETURNING_TO_LOOP') {
        const retIdx = a.returnNodeIdx !== undefined ? a.returnNodeIdx : findNearestLoopNodeIdx(a.store.style, a.x, a.z);
        tx = loop[retIdx][0];
        tz = loop[retIdx][1];
        if (Math.hypot(tx - a.x, tz - a.z) < 0.24) {
          a.fsmState = 'WALKING';
          a.nodeIdx = (retIdx + a.dir + N) % N;
          tx = loop[a.nodeIdx][0];
          tz = loop[a.nodeIdx][1];
        }
      } else if (a.slot) {
        // APPROACHING_DOOR or APPROACHING_SLOT (perpendicular branch from loop node to slot)
        const sl = a.slot;
        tx = sl.lx;
        tz = sl.lz;
        const distToSlot = Math.hypot(tx - a.x, tz - a.z);

        // 3. DOOR TRIGGER ZONE (< 0.45m from doorEntryPoint):
        // Immediately enter `INSIDE_STORE` instead of walking into the door!
        if (a.fsmState === 'APPROACHING_DOOR' && distToSlot < 0.45) {
          a.fsmState = 'INSIDE_STORE';
          a.portalFade = 1.0;
          a.visible = true;
          a.ry = sl.lry;
          a.worldRy = storeRotY + sl.lry;
          spawnNpcEmote(i, sl.emotes && sl.emotes[0] ? sl.emotes[0] : '✨');
        } else if (a.fsmState === 'APPROACHING_SLOT' && distToSlot < 0.14) {
          // Arrived at benchSeatPoint or shop_window!
          a.x = sl.lx;
          a.z = sl.lz;
          a.ry = sl.lry;
          a.fsmState = sl.type === 'seat' ? 'SEATED_DINING' : 'WINDOW_SHOPPING';
          _v.set(a.x, 0.180, a.z).applyMatrix4(g.matrixWorld);
          wx = _v.x;
          wz = _v.z;
        }
      }

      // If still in an active walking state, apply Smooth Tangential Steering & Forward-Facing Velocity!
      if (
        a.fsmState === 'WALKING' ||
        a.fsmState === 'RETURNING_TO_LOOP' ||
        a.fsmState === 'APPROACHING_DOOR' ||
        a.fsmState === 'APPROACHING_SLOT'
      ) {
        const dxL = tx - a.x;
        const dzL = tz - a.z;
        const distToTarget = Math.hypot(dxL, dzL);

        if (distToTarget > 0.001) {
          const desiredLocalAngle = Math.atan2(dxL, dzL);
          const baseWorldAngle = storeRotY + desiredLocalAngle;
          const [steeredWorldAngle, trafficSpeedFactor] = computeTangentialSteering(a, i, wx, wz, baseWorldAngle);

          // Smooth angle interpolation with factor 0.08 (Rule 2)
          a.worldRy = lerpCrowdAngle(a.worldRy, steeredWorldAngle, steerLerpFactor);
          a.ry = a.worldRy - storeRotY;

          // Modulate speed smoothly during sharp corners so the NPC stays tight on the clear sidewalk lane
          const turnDiff = Math.abs(shortestAngleDiff(a.worldRy, steeredWorldAngle));
          const cornerSlowdown = Math.max(0.32, Math.cos(Math.min(Math.PI * 0.45, turnDiff * 0.75)));
          actualSpeed = a.moveSpeed * trafficSpeedFactor * cornerSlowdown;
          const stepDist = Math.min(distToTarget, actualSpeed * dt);
          actualSpeed = stepDist / dt;

          // Rule 2: Always step forward strictly along the direction the NPC's face is pointing!
          // velocity.x = Math.sin(npc.rotation.y) * speed, velocity.z = Math.cos(npc.rotation.y) * speed
          const vx = Math.sin(a.worldRy) * actualSpeed;
          const vz = Math.cos(a.worldRy) * actualSpeed;
          wx += vx * dt;
          wz += vz * dt;

          // Project back to store local coordinates (zero pinball repulsion!)
          _invStoreMat.copy(g.matrixWorld).invert();
          _v.set(wx, 0.180, wz).applyMatrix4(_invStoreMat);
          a.x = _v.x;
          a.z = _v.z;
        }
      }

      a.sitWeight = Math.max(0.0, a.sitWeight - dt * 6.0);
      a.actionCode = 0.0;
    } else if (a.slot) {
      // Stationary Activity State: WINDOW_SHOPPING (IDLE standing) or SEATED_DINING (benchSeatPoint / cafe chair)
      const sl = a.slot;
      a.visible = true;
      a.x = sl.lx;
      a.z = sl.lz;
      actualSpeed = 0.0;
      a.stateTimer -= dt;

      const microYaw = Math.sin(time * 1.45 + a.seed * 6.283) * 0.04;
      const targetWorldRy = storeRotY + sl.lry + microYaw;
      a.worldRy = lerpCrowdAngle(a.worldRy, targetWorldRy, steerLerpFactor);
      a.ry = a.worldRy - storeRotY;

      if (a.fsmState === 'SEATED_DINING') {
        a.sitWeight = Math.min(1.0, a.sitWeight + dt * 5.5);
        a.actionCode = 2.0;
        seatYOff = sl.seatHeightOffset || 0;
      } else {
        // WINDOW_SHOPPING / IDLE: upright standing pose
        a.sitWeight = Math.max(0.0, a.sitWeight - dt * 6.0);
        a.actionCode = 1.0;
      }

      // Periodic Tiny Floating Emote Bubble (every 8–12 seconds)
      a.emoteTimer -= dt;
      if (a.emoteTimer <= 0) {
        a.emoteTimer = 8.0 + random() * 4.0;
        const icons = sl.emotes && sl.emotes.length ? sl.emotes : ['💬', '✨'];
        const icon = icons[Math.floor(random() * icons.length)];
        spawnNpcEmote(i, icon);
      }

      // When activity finishes, release slot and return perpendicularly to `sl.anchorNodeIdx` on the main loop!
      if (a.stateTimer <= 0) {
        const retIdx = sl.anchorNodeIdx !== undefined ? sl.anchorNodeIdx : findNearestLoopNodeIdx(a.store.style, a.x, a.z);
        const [rx, rz] = loop[retIdx];
        sl.occupiedBy = null;
        a.slot = null;
        a.returnNodeIdx = retIdx;
        a.fsmState = 'RETURNING_TO_LOOP';
        a.cooldownTimer = 6.5 + random() * 5.5;
        const outLry = Math.atan2(rx - a.x, rz - a.z);
        a.ry = outLry;
      }

      _v.set(a.x, 0.180, a.z).applyMatrix4(g.matrixWorld);
      wx = _v.x;
      wz = _v.z;
    } else {
      a.fsmState = 'WALKING';
      a.visible = true;
    }

    // 4. SYNCHRONIZE LIMB SWING FREQUENCY WITH ACTUAL MOVEMENT SPEED:
    // Multiply limb swing phase increment by actual displacement speed (`actualSpeed`).
    // When stopped (`IDLE / WINDOW_SHOPPING / SEATED_DINING`), smoothly lerp `walkWeight` to 0
    // so leg and arm rotations smoothly return to 0 (upright standing pose) and NEVER walk in place!
    a.actualSpeed = actualSpeed;
    if (actualSpeed > 0.02) {
      a.walkPhase = (a.walkPhase || 0) + actualSpeed * 7.5 * dt;
      const targetWalkW = Math.min(1.0, actualSpeed / Math.max(0.45, a.moveSpeed));
      a.walkWeight += (targetWalkW - a.walkWeight) * Math.min(1.0, dt * 8.5);
    } else {
      a.walkWeight += (0.0 - a.walkWeight) * Math.min(1.0, dt * 8.5);
      if (a.walkWeight < 0.005) a.walkWeight = 0.0;
    }

    // Update GPU per-instance state attributes for Articulated Shader
    npcStates[i * 4] = a.walkPhase;
    npcStates[i * 4 + 1] = a.walkWeight;
    npcStates[i * 4 + 2] = a.sitWeight;
    npcStates[i * 4 + 3] = a.actionCode;

    // Unified flat sidewalk paver surface y-offset
    let yLot =
      a.store.style === 'urban_pocket_park'
        ? 0.180
        : a.store.style === 'taman_kota'
          ? Math.abs(a.x) < 1.15 && Math.abs(a.z + 2.68) < 1.15
            ? 0.330
            : a.fsmState === 'SEATED_DINING'
              ? 0.210
              : 0.198
          : 0.180;
    yLot += seatYOff * a.sitWeight;

    _worldPos[i].x = wx;
    _worldPos[i].z = wz;
    _worldPos[i].ry = a.worldRy;
    if (a.store.style === 'urban_pocket_park') {
      const targetY = getPocketParkElevationY(wx, wz) + 0.003 + seatYOff * a.sitWeight;
      _worldPos[i].y = _worldPos[i].y + (targetY - _worldPos[i].y) * 0.25;
    } else {
      _worldPos[i].y = yLot;
    }

    const effScale = a.visible === false ? 0 : a.scale * (a.portalFade ?? 1.0);
    dummy.position.set(wx, a.visible === false ? -50 : _worldPos[i].y, wz);
    dummy.rotation.set(0, a.worldRy, 0);
    dummy.scale.setScalar(effScale);
    dummy.updateMatrix();
    people.setMatrixAt(i, dummy.matrix);

    dummy.position.set(wx, a.visible === false ? -50 : _worldPos[i].y + 0.012, wz);
    dummy.rotation.set(0, a.worldRy, 0);
    const blobScale = effScale === 0 ? 0 : a.sitWeight > 0.5 ? effScale * 0.65 : effScale;
    dummy.scale.set(blobScale, effScale === 0 ? 0 : 1, blobScale * (a.walkWeight > 0.5 ? 1.30 : 1.05));
    dummy.updateMatrix();
    blobs.setMatrixAt(i, dummy.matrix);
  }

  // Update Tiny Floating Emotes above interacting NPCs (2.0s pop-in & smooth fade-out, max opacity 0.85)
  const hideEmotes = isAnyStoreViewActive() && !strawberryCorner.isParkMatchActive;
  for (let e = 0; e < emotePool.length; e++) {
    const sp = emotePool[e];
    if (!sp.userData.active) continue;
    sp.userData.age += dt;
    const age = sp.userData.age;
    const dur = sp.userData.duration;
    const aIdx = sp.userData.agentIdx;
    if (age >= dur || aIdx < 0 || aIdx >= agents.length || hideEmotes || agents[aIdx].visible === false) {
      sp.userData.active = false;
      sp.visible = false;
      continue;
    }
    const wp = _worldPos[aIdx];
    const ag = agents[aIdx];
    const headBaseY = wp.y + (1.16 - 0.10 * ag.sitWeight) * ag.scale;
    const floatLift = Math.min(0.18, age * 0.09);
    sp.position.set(wp.x, headBaseY + floatLift, wp.z);

    // Fade in over 0..0.28s, hold at 0.85, fade out over 1.35..2.0s
    let alpha = 0.85;
    if (age < 0.28) {
      alpha = (age / 0.28) * 0.85;
    } else if (age > dur - 0.65) {
      alpha = Math.max(0, ((dur - age) / 0.65) * 0.85);
    }
    sp.material.opacity = alpha;
    const popScale = age < 0.22 ? 0.14 + (age / 0.22) * 0.14 : 0.28;
    sp.scale.setScalar(popScale);
  }

  npcStateAttr.needsUpdate = true;
  people.instanceMatrix.needsUpdate = true;
  blobs.instanceMatrix.needsUpdate = true;
}

// Post-processing: ScenePass (with hardware DepthTexture) -> half-res UnrealBloomPass -> MacroDOF (SSAO + Tilt-Shift & Depth 64-sample golden-angle bokeh) -> OutputPass
const quadVS = 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
const fsMat = (fragmentShader, uniforms) =>
  new THREE.ShaderMaterial({ uniforms, vertexShader: quadVS, fragmentShader, depthTest: false, depthWrite: false });

const sceneDepthTex = new THREE.DepthTexture();
sceneDepthTex.type = THREE.UnsignedIntType;
let diagFbo = 0, diagCalls = 0, diagTris = 0;

class ScenePass extends Pass {
  constructor() {
    super();
    this.needsSwap = false;
    this.rt = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      depthBuffer: true,
      depthTexture: sceneDepthTex
    });
    this.quad = new FullScreenQuad(
      fsMat('uniform sampler2D t;varying vec2 vUv;void main(){gl_FragColor=texture2D(t,vUv);}', { t: { value: this.rt.texture } })
    );
  }
  setSize(w, h) {
    const iw = Math.max(1, Math.floor(w));
    const ih = Math.max(1, Math.floor(h));
    sceneDepthTex.image = { width: iw, height: ih };
    sceneDepthTex.dispose();
    this.rt.setSize(iw, ih);
  }
  render(r, write, read) {
    r.setRenderTarget(this.rt);
    const gl = r.getContext();
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    diagFbo = status;
    if (status !== gl.FRAMEBUFFER_COMPLETE && this.rt.depthTexture) {
      this.rt.depthTexture = null;
      this.rt.dispose();
      r.setRenderTarget(this.rt);
      diagFbo = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    }
    r.clear();
    r.render(scene, camera);
    diagCalls = r.info.render.calls;
    diagTris = r.info.render.triangles;
    r.setRenderTarget(read);
    this.quad.render(r);
  }
}

const DOF_COMMON = `uniform sampler2D tDepth;uniform float near;uniform float far;uniform float focus;uniform float range;uniform vec2 cocScale;uniform float maxCoc;
float viewDist(vec2 uv){float d=texture2D(tDepth,uv).x;if(d<=0.0001||d>=0.9999)return focus+(uv.y-0.52)*26.0;return near*far/((far-near)*d-far)*-1.;}
float coc(vec2 uv){
  float z=viewDist(uv)-focus;
  float depthCoc=max(abs(z)-range,0.)*(z<0.?cocScale.x:cocScale.y);
  float tiltBand=smoothstep(0.22,0.48,abs(uv.y-0.50))*6.2;
  float onFocus=1.0-smoothstep(range*0.65,range*1.35,abs(z));
  float c=max(depthCoc,tiltBand*(1.0-onFocus*0.85));
  return (z<0.?-1.:1.)*min(c,maxCoc);
}`;

class MacroDOF extends Pass {
  constructor() {
    super();
    const o = { type: THREE.HalfFloatType };
    this.half = new THREE.WebGLRenderTarget(1, 1, o);
    this.blurRT = new THREE.WebGLRenderTarget(1, 1, o);
    this.u = {
      tColor: { value: null },
      tDepth: { value: sceneDepthTex },
      tHalf: { value: this.half.texture },
      tBlur: { value: this.blurRT.texture },
      near: { value: camera.near },
      far: { value: camera.far },
      focus: { value: 25 },
      range: { value: 5.8 },
      cocScale: { value: new THREE.Vector2(2.2, 0.92) },
      maxCoc: { value: 13 },
      texel: { value: new THREE.Vector2() },
      fullTexel: { value: new THREE.Vector2() },
      uEnabled: { value: 1 }
    };
    this.pre = new FullScreenQuad(
      fsMat(
        `uniform sampler2D tColor;uniform vec2 fullTexel;varying vec2 vUv;${DOF_COMMON}
        void main(){
          vec2 o=fullTexel*.5;
          vec3 c=(texture2D(tColor,vUv+vec2(-o.x,-o.y)).rgb+texture2D(tColor,vUv+vec2(o.x,-o.y)).rgb+texture2D(tColor,vUv+vec2(-o.x,o.y)).rgb+texture2D(tColor,vUv+o).rgb)*.25;
          float d0=viewDist(vUv);
          float ao=0.0;
          vec2 stepUv=fullTexel*2.5;
          ao+=clamp((d0-viewDist(vUv+vec2(stepUv.x,0.)))*0.35,0.0,0.22);
          ao+=clamp((d0-viewDist(vUv-vec2(stepUv.x,0.)))*0.35,0.0,0.22);
          ao+=clamp((d0-viewDist(vUv+vec2(0.,stepUv.y)))*0.35,0.0,0.22);
          ao+=clamp((d0-viewDist(vUv-vec2(0.,stepUv.y)))*0.35,0.0,0.22);
          c*=1.0-clamp(ao,0.0,0.42);
          gl_FragColor=vec4(min(c,vec3(24.)),coc(vUv));
        }`,
        this.u
      )
    );
    this.blur = new FullScreenQuad(
      fsMat(
        `uniform sampler2D tHalf;uniform vec2 texel;uniform float maxCoc;varying vec2 vUv;
        void main(){vec4 c0=texture2D(tHalf,vUv);float cc=abs(c0.a);vec3 col=c0.rgb;float tot=1.;float near=0.;float r=1.6;float ang=0.;
        for(int i=0;i<64;i++){if(r>=maxCoc)break;vec2 tc=vUv+vec2(cos(ang),sin(ang))*texel*r;vec4 s=texture2D(tHalf,tc);float sc=abs(s.a);if(s.a>c0.a)sc=min(sc,cc*2.);
        float m=smoothstep(r-.8,r+.8,sc);col+=mix(col/tot,s.rgb,m);tot+=1.;if(s.a<0.)near=max(near,m*sc);ang+=2.39996;r+=2.2/r;}
        gl_FragColor=vec4(col/tot,max(cc,near));}`,
        this.u
      )
    );
    this.comp = new FullScreenQuad(
      fsMat(
        `uniform sampler2D tColor;uniform sampler2D tBlur;uniform float uEnabled;varying vec2 vUv;
        void main(){vec3 s=texture2D(tColor,vUv).rgb;if(uEnabled<0.5){gl_FragColor=vec4(s,1.);return;}vec4 b=texture2D(tBlur,vUv);gl_FragColor=vec4(mix(s,b.rgb,smoothstep(.45,1.8,b.a)),1.);}`,
        this.u
      )
    );
  }
  setSize(w, h) {
    const hw = Math.ceil(w / 2), hh = Math.ceil(h / 2);
    this.half.setSize(hw, hh);
    this.blurRT.setSize(hw, hh);
    this.u.texel.value.set(1 / hw, 1 / hh);
    this.u.fullTexel.value.set(1 / w, 1 / h);
  }
  render(r, write, read) {
    this.u.tColor.value = read.texture;
    r.setRenderTarget(this.half);
    this.pre.render(r);
    r.setRenderTarget(this.blurRT);
    this.blur.render(r);
    r.setRenderTarget(this.renderToScreen ? null : write);
    this.comp.render(r);
  }
}

const pixelRatio = Math.min(window.devicePixelRatio, isMobile ? 1.25 : 2.0);
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false }));
composer.setPixelRatio(pixelRatio);

const scenePass = new ScenePass();
composer.addPass(scenePass);

const bloomPass = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.35, 0.55, 1.05);
const bloomSize = bloomPass.setSize.bind(bloomPass);
bloomPass.setSize = (w, h) => bloomSize(Math.ceil(w / 2), Math.ceil(h / 2));
composer.addPass(bloomPass);

const dofPass = new MacroDOF();
composer.addPass(dofPass);
composer.addPass(new OutputPass());

// Adaptive Camera Parameters (updated dynamically in resize / onWindowResize)
// - Desktop (aspect >= 1.0 && height >= 500): fov = 30, adaptiveDistMult = 1.0, adaptiveTargetYOffset = 0.0 (100% original desktop framing)
// - Portrait (aspect < 1.0): pulls back camera distance (1.25x–1.35x) & widens FOV so full 3D building fits without side clipping
// - Short Landscape (height < 500): adjusts FOV & target Y so roof is never clipped by header/bottom bar
let adaptiveDistMult = 1.0;
let adaptiveTargetYOffset = 0.0;

function onWindowResize() {
  const w = Math.max(1, window.innerWidth);
  const h = Math.max(1, window.innerHeight);
  const aspect = w / h;
  const dpr = Math.min(window.devicePixelRatio, isMobile ? 1.25 : 2.0);

  if (aspect < 1.0) {
    // Vertical / Portrait Screen (Smartphone & Portrait Tablet)
    // Multiply camera distance by 1.25x–1.35x and widen FOV so the entire main building stays centered & unclipped
    adaptiveDistMult = THREE.MathUtils.clamp(1.25 + (0.85 - aspect) * 0.25, 1.25, 1.35);
    adaptiveTargetYOffset = -0.35;
    camera.fov = THREE.MathUtils.clamp(38 + (1.0 - aspect) * 22, 38, 52);
  } else if (h < 500) {
    // Short Horizontal / Mobile Landscape Screen
    adaptiveDistMult = 1.12;
    adaptiveTargetYOffset = 0.22;
    camera.fov = 34;
  } else {
    // Standard Desktop / Large Tablet Landscape (unchanged original framing)
    adaptiveDistMult = 1.0;
    adaptiveTargetYOffset = 0.0;
    camera.fov = 30;
  }

  camera.aspect = aspect;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h);
  composer._pixelRatio = dpr;
  composer.setSize(w, h);
}
const resize = onWindowResize;
addEventListener('resize', onWindowResize);
onWindowResize();

// Camera Orbit & Damped Lerp Transition Rig (Exact Token Town angle, proportionally widened for 16.4u PITCH & 5.40u roads)
let selected = 0;
let over = false;
let yawOffset = 0, targetYaw = 0;
let pitch = 0.56, targetPitch = 0.56;
let zoom = 25.2, targetZoom = 25.2;

function focusAt(index) {
  if (over) {
    return {
      fx: TOWN[0], fy: 1.8 + adaptiveTargetYOffset, fz: TOWN[1],
      yaw: 0.78 + yawOffset,
      pitch: Math.max(0.36, Math.min(0.82, pitch + 0.12)),
      dist: zoom * 2.22 * adaptiveDistMult
    };
  }
  const s = stores[index];
  const a = slotAngle(s.slot);
  const t = a - Math.PI / 4;
  const p = s.g.position;
  if (s.style === 'strawberry' || s.style === 'pavilion' || s.style === 'gable' || s.style === 'brick' || s.style === 'studio') {
    // 3/4 Front-Left Isometric perspective angle matching Concept Sheets for Store #1, #2, #4, #5 & #6
    return {
      fx: p.x,
      fy: (s.style === 'pavilion' ? 2.25 : 3.25) + adaptiveTargetYOffset,
      fz: p.z,
      yaw: t - 0.44 + yawOffset,
      pitch,
      dist: zoom * adaptiveDistMult
    };
  }
  if (s.style === 'mayor') {
    // 3/4 Isometric perspective angle for Pos #7 (Mayor's Office) framing the building + Cozy Civic Plaza + Fountain Pool
    return {
      fx: p.x - 0.25,
      fy: 2.95 + adaptiveTargetYOffset,
      fz: p.z + 0.55,
      yaw: 0.44 + yawOffset,
      pitch: Math.max(0.32, Math.min(0.76, pitch - 0.04)),
      dist: zoom * 1.06 * adaptiveDistMult
    };
  }
  const lx = -0.4, lz = 1.6;
  return {
    fx: p.x + lx * Math.cos(t) + lz * Math.sin(t),
    fy: 2.6 + adaptiveTargetYOffset,
    fz: p.z - lx * Math.sin(t) + lz * Math.cos(t),
    yaw: a - 0.2 + yawOffset,
    pitch,
    dist: zoom * adaptiveDistMult
  };
}

const initF = focusAt(0);
const cur = { ...initF };
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(initF.fx, initF.fy, initF.fz);
controls.enabled = false;
controls.enablePan = false;
controls.enableRotate = true;
controls.enableZoom = true;
controls.minDistance = 4;
controls.maxDistance = 18;
controls.minPolarAngle = 0.20;
controls.maxPolarAngle = Math.PI / 2.15;
controls.enableDamping = true;
controls.dampingFactor = 0.08;
const damp = (a, b, l, dt) => b + (a - b) * Math.exp(-l * dt);

// Procedural Web Audio Chime
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

// UI Elements & Token Town Card Logic
const $ = id => document.getElementById(id);
const tabsEl = $('tabs');
const speechEl = $('speech');
const tagLeft = $('tag-left');
const tagRight = $('tag-right');
const hintEl = $('ui-hint');
let hintTimer = 0;

function showHint(msg) {
  hintEl.textContent = msg;
  hintEl.classList.add('on');
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => hintEl.classList.remove('on'), 1600);
}

// Phase 3: Register Unity 3D .GLB & Scene Metadata Exporter Context
registerUnityExporterContext({
  scene,
  world,
  stores,
  links,
  roadsAndSidewalksGroup,
  treesAndDecorGroup,
  vehiclesGroup,
  npcsGroup,
  trunks,
  crowns,
  peopleMesh: people,
  focusAt,
  slotAngle,
  showHint,
  A,
  PITCH,
  BLOCK,
  RING,
  TOWN,
  LINES,
  LANES,
  STYLE_HEIGHT,
  sidewalkLoops: SIDEWALK_WAYPOINT_LOOPS,
  SIDEWALK_WAYPOINT_LOOPS
});

// Build store tabs in permanent store order (toko1 → toko7) + town overview
NAV_ORDER.forEach(slot => {
  const d = BUILDINGS_DATA[slot];
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = d.sign;
  btn.dataset.storeId = d.id;
  btn.dataset.slot = String(slot);
  btn.addEventListener('click', () => select(slot));
  tabsEl.appendChild(btn);
});
const overBtn = document.createElement('button');
overBtn.type = 'button';
overBtn.textContent = 'Kota';
overBtn.addEventListener('click', () => setOverview(!over));
tabsEl.appendChild(overBtn);

let rollRAF = 0;
function rollTokens(targetStr) {
  cancelAnimationFrame(rollRAF);
  const el = $('tokens');
  if (targetStr.includes('/')) {
    el.textContent = targetStr;
    return;
  }
  const target = parseFloat(targetStr) || 0;
  const start = parseFloat(el.textContent) || 0;
  const t0 = performance.now();
  const step = now => {
    const k = Math.min(1, (now - t0) / 360);
    const e = 1 - Math.pow(1 - k, 3);
    el.textContent = Math.round(start + (target - start) * e).toString();
    if (k < 1) rollRAF = requestAnimationFrame(step);
  };
  rollRAF = requestAnimationFrame(step);
}

const detailsCard = $('details-card');
const reopenCardBtn = $('reopen-card');
const reopenLabel = $('reopen-label');
let cardClosed = false;

function setCardClosed(closed) {
  cardClosed = closed;
  detailsCard?.classList.toggle('closed', closed);
  reopenCardBtn?.classList.toggle('on', closed);
  document.getElementById('app')?.classList.toggle('card-open', !closed);
  const shortSpan = reopenCardBtn?.querySelector('.reopen-cta-short');
  if (shortSpan) shortSpan.textContent = closed ? 'Info ↑' : 'Info ↓';
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
  $('lab-mark').innerHTML = logoSVG(d.id);
  $('lab').textContent = d.sign;
  $('lab-line').textContent = (d.subtitle || '').split('·')[0].trim();
  $('model').textContent = d.title;
  $('badge').textContent = d.badge;
  if (reopenLabel) {
    reopenLabel.textContent = d.title;
  }
  detailsCard?.classList.toggle('closed', cardClosed);
  reopenCardBtn?.classList.toggle('on', cardClosed);
  document.getElementById('app')?.classList.toggle('card-open', !cardClosed);
  rollTokens(d.metric);
  $('tokens-unit').textContent = d.unit;
  if ($('growth')) $('growth').textContent = '';
  $('district-no').textContent = `${storeNumber(d.id)} / ${STORE_IDS.length}`;

  $('features').innerHTML = d.specs
    .map(
      s =>
        `<span title="${s.value} · ${s.label}"><i>${ICONS[s.icon] || ICONS.people}</i><span><b>${s.value}</b><small>${s.label}</small></span></span>`
    )
    .join('');

  speechEl.textContent = d.checks[0];
  const openBtn = $('open-module');
  if (openBtn) openBtn.textContent = d.ctaLabel || 'Masuk Toko →';
  const metaEl = $('card-meta');
  if (metaEl) metaEl.textContent = d.cardMeta || 'Klik tombol Masuk Toko untuk melihat katalog';
  [...tabsEl.children].forEach(b => {
    const isStoreTab = b.dataset.slot !== undefined;
    b.setAttribute('aria-selected', String(isStoreTab ? !over && Number(b.dataset.slot) === idx : over));
  });
}

function buildFlutterStorePayload(lotIdx) {
  const d = BUILDINGS_DATA[lotIdx] || BUILDINGS_DATA[0];
  const navIdx = Math.max(0, NAV_ORDER.indexOf(lotIdx));
  const prevLot = NAV_ORDER[(navIdx - 1 + NAV_ORDER.length) % NAV_ORDER.length];
  const nextLot = NAV_ORDER[(navIdx + 1) % NAV_ORDER.length];
  const prevD = BUILDINGS_DATA[prevLot] || d;
  const nextD = BUILDINGS_DATA[nextLot] || d;
  return {
    storeIndex: navIdx,
    lotIndex: lotIdx,
    displayOrder: storeNumber(d.id),
    totalStores: STORE_IDS.length,
    storeId: d.id,
    name: d.title,
    sign: d.sign,
    subtitle: d.subtitle,
    badge: d.badge,
    color: d.color,
    grad: d.grad,
    metric: d.metric,
    metricNum: d.metricNum,
    unit: d.unit,
    delta: d.delta,
    visitors: d.friends,
    checks: d.checks,
    specs: d.specs,
    ctaLabel: d.ctaLabel || 'Masuk Toko →',
    leftNeighbor: {
      storeIndex: Math.max(0, NAV_ORDER.indexOf(prevLot)),
      lotIndex: prevLot,
      storeId: prevD.id,
      name: prevD.title,
      pillTitle: prevD.pillTitle || `${prevD.sign} · ${prevD.badge}`,
      summary: `${prevD.metric} ${(prevD.unit || '').split(' ')[0]} · ${prevD.friends} pengunjung`,
      metric: prevD.metric,
      unit: prevD.unit,
      visitors: prevD.friends,
      color: prevD.color
    },
    rightNeighbor: {
      storeIndex: Math.max(0, NAV_ORDER.indexOf(nextLot)),
      lotIndex: nextLot,
      storeId: nextD.id,
      name: nextD.title,
      pillTitle: nextD.pillTitle || `${nextD.sign} · ${nextD.badge}`,
      summary: `${nextD.metric} ${(nextD.unit || '').split(' ')[0]} · ${nextD.friends} pengunjung`,
      metric: nextD.metric,
      unit: nextD.unit,
      visitors: nextD.friends,
      color: nextD.color
    }
  };
}

function select(idx, fromHash = false) {
  const next = ((idx % LOTS) + LOTS) % LOTS;
  over = false;
  selected = next;
  yawOffset = 0;
  targetYaw = 0;
  stores.forEach((s, si) => s.atlas.setScale(si === selected ? 1 : 0.5));
  renderCard(selected);
  chime(460 + selected * 55, 0.08);
  if (!fromHash) history.replaceState(null, '', '#' + BUILDINGS_DATA[selected].id);
  postToFlutter({
    type: 'STORE_CHANGED',
    ...buildFlutterStorePayload(selected)
  });
}

// Step through stores in permanent order toko1 → toko7 (independent of physical lot order)
function stepStore(delta) {
  const pos = NAV_ORDER.indexOf(selected);
  select(NAV_ORDER[(pos + delta + NAV_ORDER.length) % NAV_ORDER.length]);
}

// Resolve a canonical or legacy hash (#toko5, #strawberry, #budi …) to a physical lot index; null if unknown
function slotFromHash(hash) {
  const id = normalizeStoreId(hash);
  return id ? slotOf(id) : null;
}

function setOverview(flag) {
  over = flag;
  yawOffset = 0;
  targetYaw = 0;
  renderCard(selected);
  chime(flag ? 380 : 540, 0.1);
  showHint(flag ? 'Tampilan seluruh Cerria Town' : `Fokus: ${BUILDINGS_DATA[selected].title}`);
}

$('prev').addEventListener('click', () => stepStore(-1));
$('next').addEventListener('click', () => stepStore(1));
$('brand-home').addEventListener('click', e => {
  e.preventDefault();
  select(slotOf('toko1'));
});

// Clickable Floating Neighbor Pills (#tag-left & #tag-right)
let leftNeighborIdx = 4;
let rightNeighborIdx = 1;
tagLeft.addEventListener('click', () => select(leftNeighborIdx));
tagRight.addEventListener('click', () => select(rightNeighborIdx));

// Enter / Exit Building Diorama State Transition (ONLY triggered when 'Buka Modul →' is clicked)
const exitBuildingBtn = $('exit-building');

// Pos #6 Strawberry Corner 5-State Camera Choreography & Interactive Overlay Controller
const strawberryCorner = createStrawberryCornerSystem({
  camera,
  controls,
  stores,
  slotAngle,
  chime,
  getPocketParkMatchmaking,
  onParkModeChange(inPark) {
    setStoreStageIsolation(slotOf('toko5'), !inPark);
  }
});

// Store #1 Glow Studio 5-State Camera Choreography & 3D Beauty/Skincare Store Controller
const glowStudio = createGlowStudioSystem({
  camera,
  controls,
  stores,
  chime
});

// Store #3 Atelier & Boutique 5-State Camera Choreography & 3D Fashion Store Controller
const atelierBoutique = createAtelierBoutiqueSystem({
  camera,
  controls,
  stores,
  chime
});

// Pos #7 Mayor's Office (Balai Warga) 3-Tab Camera Choreography & 3D Citizen ID Card Controller
const mayorOffice = createMayorOfficeSystem({
  camera,
  controls,
  stores,
  chime
});

// toko2 (Cozy Bites & Sips), toko4 (Circuit & Byte), toko6 (Apex Sport) Unified 2-State / 4-Tab 3D Store Controller
const townStores3D = createTownStores3DSystem({
  camera,
  controls,
  stores,
  chime
});

function isAnyStoreViewActive() {
  return (
    strawberryCorner.isActive ||
    glowStudio.isActive ||
    atelierBoutique.isActive ||
    mayorOffice.isActive ||
    townStores3D.isActive
  );
}

function restoreVillageCameraToSelected() {
  const tgt = focusAt(selected);
  cur.fx = tgt.fx;
  cur.fy = tgt.fy;
  cur.fz = tgt.fz;
  cur.yaw = tgt.yaw;
  cur.pitch = tgt.pitch;
  cur.dist = tgt.dist;
  const cosP = Math.cos(cur.pitch), sinP = Math.sin(cur.pitch);
  camera.position.set(
    cur.fx + Math.sin(cur.yaw) * cosP * cur.dist,
    cur.fy + sinP * cur.dist,
    cur.fz + Math.cos(cur.yaw) * cosP * cur.dist
  );
  controls.target.set(cur.fx, cur.fy, cur.fz);
  camera.lookAt(controls.target);
  camera.updateMatrixWorld();
}

function setStoreStageIsolation(storeIdx, isolated) {
  const s = stores[storeIdx];
  const bGroup = s?.g;
  if (s?.stageBaseGroup) s.stageBaseGroup.visible = isolated;
  if (s?.villageOuterLot) s.villageOuterLot.visible = !isolated;
  if (s?.atlas) s.atlas.visible = !isolated;
  exteriorTownGroup.children.forEach(ch => {
    if (ch === bGroup || ch.isLight) {
      ch.visible = true;
    } else {
      ch.visible = !isolated;
    }
  });
  if (isolated) {
    dofPass.u.uEnabled.value = 0;
    scene.fog.near = 200;
    scene.fog.far = 500;
    scene.background.set('#F5EFE4');
    scene.fog.color.set('#F5EFE4');
    speechEl?.classList.remove('on');
    tagLeft?.classList.remove('on');
    tagRight?.classList.remove('on');
  } else {
    dofPass.u.uEnabled.value = $('dof')?.checked ? 1 : 0;
    scene.fog.near = 90;
    scene.fog.far = 220;
    camera.clearViewOffset();
    camera.updateProjectionMatrix();
    if (bGroup) bGroup.scale.set(1, 1, 1);
  }
}

// Permanent store ID → interior controller (display names may change; IDs never do)
const STORE_CONTROLLERS = {
  toko1: { ctl: glowStudio },
  toko2: { ctl: townStores3D, key: 'toko2' },
  toko3: { ctl: atelierBoutique },
  toko4: { ctl: townStores3D, key: 'toko4' },
  toko5: { ctl: strawberryCorner },
  toko6: { ctl: townStores3D, key: 'toko6' },
  toko7: { ctl: mayorOffice }
};
let activeStoreSlot = null;
let bridgeSwitching = false; // CerriaBridge.openStore() swapping stores → don't report CLOSE_STORE

function enterBuilding(opts = {}) {
  if (isAnyStoreViewActive()) exitBuilding();
  const storeId = BUILDINGS_DATA[selected]?.id;
  const entry = STORE_CONTROLLERS[storeId];
  if (!entry) return;
  const storeSlot = selected;
  const onExit = () => {
    setStoreStageIsolation(storeSlot, false);
    activeStoreSlot = null;
    restoreVillageCameraToSelected();
    chime(440, 0.09);
    if (!bridgeSwitching) {
      notifyStoreClosed(storeId);
      postToFlutter({
        type: 'STORE_INTERIOR_CHANGED',
        isOpen: false,
        storeId
      });
    }
  };
  activeStoreSlot = storeSlot;
  setStoreStageIsolation(storeSlot, true);
  if (entry.key) entry.ctl.enter(entry.key, onExit, opts);
  else entry.ctl.enter(onExit, opts);
  notifyStoreOpened(storeId);
  postToFlutter({
    type: 'STORE_INTERIOR_CHANGED',
    isOpen: true,
    storeId
  });
}

function exitBuilding() {
  if (strawberryCorner.isActive) strawberryCorner.exit();
  else if (glowStudio.isActive) glowStudio.exit();
  else if (atelierBoutique.isActive) atelierBoutique.exit();
  else if (townStores3D.isActive) townStores3D.exit();
  else if (mayorOffice.isActive) mayorOffice.exit();
}

if (isFlutterCanvas && typeof document !== 'undefined') {
  document.addEventListener(
    'click',
    e => {
      const anchor = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (!anchor) return;
      const href = anchor.getAttribute('href') || '';
      if (/^https?:\/\//i.test(href)) {
        e.preventDefault();
        e.stopPropagation();
        postToFlutter({
          type: 'OPEN_EXTERNAL_URL',
          url: href
        });
      }
    },
    true
  );
}

$('open-module').addEventListener('click', enterBuilding);
exitBuildingBtn?.addEventListener('click', exitBuilding);

const infoModal = $('info');
$('about')?.addEventListener('click', () => infoModal.showModal());
$('cozy-open-guide-btn')?.addEventListener('click', e => {
  e.stopPropagation();
  setSettingsOpen(false);
  infoModal.showModal();
});
$('close-info').addEventListener('click', () => infoModal.close());
infoModal.addEventListener('click', e => {
  if (e.target === infoModal) infoModal.close();
});

// ============================================================================
// CERRIA COZY HUB — PLAYBACK, WEATHER, CLOCK & SETTINGS POP-OVER CONTROLS
// ============================================================================
let paused = false;
const SPEEDS = [
  [1, '1× Nyata']
];
let speedIdx = 0;
let timeScale = 1;
let shutter = parseFloat($('shutter').value);
let cycleOn = $('cycle').checked;
let daytime = parseFloat($('daytime').value);
let cityLightMult = parseFloat($('city-lights')?.value || '1.2');

const PAUSE_SVG = '<svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor" aria-hidden="true"><rect x="3" y="2.5" width="3.2" height="11" rx="0.8"/><rect x="9.8" y="2.5" width="3.2" height="11" rx="0.8"/></svg>';
const PLAY_SVG = '<svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor" aria-hidden="true"><path d="M4 2.5l9 5.5-9 5.5V2.5z"/></svg>';

const cozySettingsBtn = $('cozy-settings-btn');
const cozySettingsPopover = $('cozy-settings-popover');
const cozySettingsClose = $('cozy-settings-close');
const cozyHubRoot = $('cozy-hub-root');

function setSettingsOpen(open) {
  if (!cozySettingsPopover || !cozySettingsBtn) return;
  cozySettingsPopover.classList.toggle('open', open);
  cozySettingsPopover.setAttribute('aria-hidden', String(!open));
  cozySettingsBtn.setAttribute('aria-expanded', String(open));
}

cozySettingsBtn?.addEventListener('click', e => {
  e.stopPropagation();
  const isOpen = cozySettingsPopover?.classList.contains('open');
  setSettingsOpen(!isOpen);
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

// Prevent 3D camera orbit/drag listeners from stealing pointer/touch events on Settings Popover sliders & toggles
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

$('pause').addEventListener('click', () => {
  paused = !paused;
  const pauseBtn = $('pause');
  pauseBtn.innerHTML = `${paused ? PLAY_SVG : PAUSE_SVG}<span>${paused ? 'Jalan' : 'Jeda'}</span>`;
  pauseBtn.classList.toggle('paused', paused);
  showHint(paused ? 'Simulasi dijeda' : 'Simulasi berjalan');
});

const speedOptBtns = document.querySelectorAll('.cozy-spd-opt');

function setSpeed(idx) {
  speedIdx = ((idx % SPEEDS.length) + SPEEDS.length) % SPEEDS.length;
  timeScale = SPEEDS[speedIdx][0];
  if ($('speed')) $('speed').textContent = SPEEDS[speedIdx][1];
  speedOptBtns.forEach(btn => {
    const bIdx = parseInt(btn.getAttribute('data-speed-idx') || '0', 10);
    btn.classList.toggle('on', bIdx === speedIdx);
  });
  showHint(`Kecepatan ${SPEEDS[speedIdx][1]}`);
}
$('speed')?.addEventListener('click', () => setSpeed(speedIdx + 1));
speedOptBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const bIdx = parseInt(btn.getAttribute('data-speed-idx') || '0', 10);
    setSpeed(bIdx);
  });
});

let macroEnabledByUser = false;
if (isMobile && $('dof')) {
  $('dof').checked = false;
  dofPass.u.uEnabled.value = 0;
}

$('dof').addEventListener('change', e => {
  macroEnabledByUser = Boolean(e.target.checked);
  dofPass.u.uEnabled.value = e.target.checked ? 1 : 0;
  showHint(e.target.checked ? 'Lensa Makro aktif' : 'Lensa Makro nonaktif');
});

$('shutter').addEventListener('input', e => {
  shutter = parseFloat(e.target.value);
  if ($('shutter-val')) $('shutter-val').textContent = `${shutter.toFixed(2)}s`;
});

$('cycle').addEventListener('change', e => {
  cycleOn = e.target.checked;
  if (!cycleOn) {
    forceSunnyWeather();
  }
  showHint(cycleOn ? 'Siklus siang/malam & cuaca otomatis' : 'Siklus dimatikan · Cuaca dikunci ke Cerah');
});

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

// ============================================================================
// DYNAMIC WEATHER SYSTEM — AUTOMATIC CYCLE, TEMPERATURE & 3D ATMOSPHERE
// ============================================================================
const WEATHER_STATES = [
  {
    id: 'sunny',
    label: 'Cerah',
    nightLabel: 'Cerah',
    tempOffset: +2,
    sunMult: 1.0,
    hemiMult: 1.0,
    hemiTint: '#ffffff',
    hemiBlend: 0.0,
    fogTint: '#87CEEB',
    fogBlend: 0.0,
    fogNear: 120,
    fogFar: 260,
    rainIntensity: 0.0,
    wetness: 0.0,
    windBase: 0.0 // Saat Cerah tidak ada efek hembusan angin
  },
  {
    id: 'breezy',
    label: 'Cerah Berangin',
    nightLabel: 'Sejuk Berbintang',
    tempOffset: 0,
    sunMult: 0.98,
    hemiMult: 1.0,
    hemiTint: '#eaf4ff',
    hemiBlend: 0.08,
    fogTint: '#9AD4F5',
    fogBlend: 0.08,
    fogNear: 95,
    fogFar: 230,
    rainIntensity: 0.0,
    wetness: 0.0,
    windBase: 1.0 // Angin berhembus dinamis (datang & mereda bergantian)
  },
  {
    id: 'cloudy',
    label: 'Berawan',
    nightLabel: 'Berawan Sejuk',
    tempOffset: -1,
    sunMult: 0.65,
    hemiMult: 0.90,
    hemiTint: '#9fb0c2',
    hemiBlend: 0.42,
    fogTint: '#a6b6c7',
    fogBlend: 0.38,
    fogNear: 58,
    fogFar: 165,
    rainIntensity: 0.0,
    wetness: 0.12,
    windBase: 0.55 // Hembusan angin lembut sesekali
  },
  {
    id: 'overcast',
    label: 'Mendung',
    nightLabel: 'Mendung Syahdu',
    tempOffset: -2,
    sunMult: 0.38,
    hemiMult: 0.82,
    hemiTint: '#7f90a3',
    hemiBlend: 0.68,
    fogTint: '#8898ab',
    fogBlend: 0.62,
    fogNear: 42,
    fogFar: 132,
    rainIntensity: 0.0,
    wetness: 0.28,
    windBase: 0.72 // Hembusan angin sejuk sebelum hujan
  },
  {
    id: 'light_rain',
    label: 'Hujan Ringan',
    nightLabel: 'Hujan Ringan',
    tempOffset: -3,
    sunMult: 0.30,
    hemiMult: 0.78,
    hemiTint: '#708296',
    hemiBlend: 0.78,
    fogTint: '#798b9e',
    fogBlend: 0.72,
    fogNear: 36,
    fogFar: 118,
    rainIntensity: 1.0,
    wetness: 1.0,
    windBase: 0.65 // Hembusan angin gerimis
  }
];

// Natural progression & weighted random transitions every 2.0–3.0 in-game hours
let currentWeatherIdx = 0; // Starts at 'Cerah' (Sunny, calm 0 wind)
let lastWeatherChangeHour = daytime;
let nextWeatherDurationHours = 2.4; // Changes every 2–3 in-game hours

// Dynamic Wind Gust State Machine (intermittent gusts & calm lulls so wind is NEVER constant!)
let windGustState = 'CALM'; // 'CALM' | 'GUSTING'
let windGustTimer = 5.0;
let windGustTarget = 0.0;
let windGustEnvelope = 0.0;

// Smoothly lerped weather state values for 3D lighting, fog, wet roads, rain & dynamic wind
const weatherLerp = {
  sunMult: WEATHER_STATES[currentWeatherIdx].sunMult,
  hemiMult: WEATHER_STATES[currentWeatherIdx].hemiMult,
  hemiBlend: WEATHER_STATES[currentWeatherIdx].hemiBlend,
  hemiTint: new THREE.Color(WEATHER_STATES[currentWeatherIdx].hemiTint),
  fogBlend: WEATHER_STATES[currentWeatherIdx].fogBlend,
  fogTint: new THREE.Color(WEATHER_STATES[currentWeatherIdx].fogTint),
  fogNear: WEATHER_STATES[currentWeatherIdx].fogNear,
  fogFar: WEATHER_STATES[currentWeatherIdx].fogFar,
  rainIntensity: WEATHER_STATES[currentWeatherIdx].rainIntensity,
  wetness: WEATHER_STATES[currentWeatherIdx].wetness,
  windBase: WEATHER_STATES[currentWeatherIdx].windBase,
  windStrength: 0.0
};

function forceSunnyWeather() {
  currentWeatherIdx = 0; // 'sunny' -> Cerah
  lastWeatherChangeHour = daytime;
  const s = WEATHER_STATES[0];
  weatherLerp.sunMult = 1.0;
  weatherLerp.hemiMult = 1.0;
  weatherLerp.hemiBlend = 0.0;
  weatherLerp.hemiTint.set(s.hemiTint);
  weatherLerp.fogBlend = 0.0;
  weatherLerp.fogTint.set(s.fogTint);
  weatherLerp.fogNear = s.fogNear;
  weatherLerp.fogFar = s.fogFar;
  weatherLerp.rainIntensity = 0.0;
  weatherLerp.wetness = 0.0;
  weatherLerp.windBase = 0.0;
  weatherLerp.windStrength = 0.0;
  windGustState = 'CALM';
  windGustTarget = 0.0;
  windGustEnvelope = 0.0;
  uWindStrength.value = 0.0;
  if (typeof rainPoints !== 'undefined' && rainPoints) {
    rainPoints.visible = false;
  }
  if (typeof rainMat !== 'undefined' && rainMat) {
    rainMat.opacity = 0.0;
  }
  scene.fog.near = s.fogNear;
  scene.fog.far = s.fogFar;
  updateHubWeatherAndClock(daytime);
}
const _wTargetHemiTint = new THREE.Color();
const _wTargetFogTint = new THREE.Color();
const _wTempColor = new THREE.Color();
const _baseRoadColor = new THREE.Color('#ffffff');
const _wetRoadColor = new THREE.Color('#9aa4b2');
const _basePavingColor = new THREE.Color('#d8cfc4');
const _wetPavingColor = new THREE.Color('#aba39a');
const _baseBgSidewalkColor = new THREE.Color('#C4BEB4');
const _wetBgSidewalkColor = new THREE.Color('#9c978e');
const _baseCurbColor = new THREE.Color('#bfb4a6');
const _wetCurbColor = new THREE.Color('#968d82');

// 3D Light Rain Particle System (THREE.Points) attached to exteriorTownGroup
const RAIN_COUNT = 1600;
const RAIN_BOX_XZ = 46;
const RAIN_TOP_Y = 24;
const RAIN_BOTTOM_Y = 0.05;
const rainGeo = new THREE.BufferGeometry();
const rainPositions = new Float32Array(RAIN_COUNT * 3);
const rainSpeeds = new Float32Array(RAIN_COUNT);

for (let i = 0; i < RAIN_COUNT; i++) {
  rainPositions[i * 3] = (Math.random() - 0.5) * RAIN_BOX_XZ;
  rainPositions[i * 3 + 1] = RAIN_BOTTOM_Y + Math.random() * (RAIN_TOP_Y - RAIN_BOTTOM_Y);
  rainPositions[i * 3 + 2] = (Math.random() - 0.5) * RAIN_BOX_XZ;
  rainSpeeds[i] = 11.5 + Math.random() * 4.5;
}
rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));

const rainStreakTex = (() => {
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(8, 0, 8, 64);
  g.addColorStop(0.0, 'rgba(215, 232, 250, 0.0)');
  g.addColorStop(0.35, 'rgba(215, 232, 250, 0.75)');
  g.addColorStop(0.85, 'rgba(235, 245, 255, 0.95)');
  g.addColorStop(1.0, 'rgba(235, 245, 255, 0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(6, 2, 4, 60);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();

const rainMat = new THREE.PointsMaterial({
  color: '#dcebf7',
  map: rainStreakTex,
  size: 0.42,
  sizeAttenuation: true,
  transparent: true,
  opacity: 0.0,
  depthWrite: false,
  blending: THREE.AdditiveBlending
});

const rainPoints = new THREE.Points(rainGeo, rainMat);
rainPoints.frustumCulled = false;
rainPoints.visible = false;
exteriorTownGroup.add(rainPoints);

function pickNextWeatherIndex(currIdx) {
  // Smooth, realistic weather transitions (can also jump across all 5 states)
  const weights = [0.22, 0.24, 0.22, 0.16, 0.16];
  weights[currIdx] = 0.0; // Always transition to a new weather state
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return (currIdx + 1) % WEATHER_STATES.length;
}

function checkAutomaticWeatherCycle(h) {
  // Rule 1: If automatic cycle is OFF (`!cycleOn`), lock weather strictly to 'Cerah' (Sunny)!
  if (!cycleOn) {
    if (currentWeatherIdx !== 0) {
      forceSunnyWeather();
    }
    return;
  }

  // Compute elapsed in-game hours (handles midnight wrap-around)
  let diffH = h - lastWeatherChangeHour;
  if (diffH < -12) diffH += 24;
  if (diffH < 0) diffH = Math.abs(diffH);

  if (diffH >= nextWeatherDurationHours) {
    currentWeatherIdx = pickNextWeatherIndex(currentWeatherIdx);
    lastWeatherChangeHour = h;
    nextWeatherDurationHours = 2.0 + Math.random() * 1.0; // Every 2–3 in-game hours
    updateHubWeatherAndClock(h);
  }
}

function updateDynamicWeather3D(dt, focusX, focusZ) {
  // If automatic cycle is OFF, keep weather locked at 'Cerah' (Sunny) with 0 rain, minimal fog & 1.0 light multipliers
  if (!cycleOn && currentWeatherIdx !== 0) {
    forceSunnyWeather();
  }
  const target = WEATHER_STATES[currentWeatherIdx];
  const k = 1 - Math.exp(-1.8 * dt); // Smooth lerp factor (no sudden flickers)

  if (target.id === 'sunny' && !cycleOn) {
    weatherLerp.sunMult = 1.0;
    weatherLerp.hemiMult = 1.0;
    weatherLerp.hemiBlend = 0.0;
    weatherLerp.fogBlend = 0.0;
    weatherLerp.fogNear = target.fogNear;
    weatherLerp.fogFar = target.fogFar;
    weatherLerp.rainIntensity = 0.0;
    weatherLerp.wetness = 0.0;
    weatherLerp.windBase = 0.0;
  } else {
    weatherLerp.sunMult += (target.sunMult - weatherLerp.sunMult) * k;
    weatherLerp.hemiMult += ((target.hemiMult ?? 1.0) - weatherLerp.hemiMult) * k;
    weatherLerp.hemiBlend += (target.hemiBlend - weatherLerp.hemiBlend) * k;
    weatherLerp.fogBlend += (target.fogBlend - weatherLerp.fogBlend) * k;
    weatherLerp.fogNear += (target.fogNear - weatherLerp.fogNear) * k;
    weatherLerp.fogFar += (target.fogFar - weatherLerp.fogFar) * k;
    weatherLerp.rainIntensity += (target.rainIntensity - weatherLerp.rainIntensity) * k;
    weatherLerp.wetness += (target.wetness - weatherLerp.wetness) * k;
    weatherLerp.windBase += ((target.windBase ?? 0.0) - weatherLerp.windBase) * k;
  }

  // Dynamic Wind Gust Cycle:
  // - When Sunny ('Cerah'): windBase = 0 -> wind is completely off (0.0).
  // - When Breezy/Cloudy/Overcast/Rainy: wind alternates naturally between calm lulls (0.0)
  //   and gentle gusts (3.5s – 6.5s gust followed by 6.0s – 11.0s calm period) so it is NEVER constant!
  if (target.id === 'sunny' || weatherLerp.windBase < 0.02) {
    windGustState = 'CALM';
    windGustTarget = 0.0;
    windGustEnvelope += (0.0 - windGustEnvelope) * (1 - Math.exp(-2.8 * dt));
  } else if (!paused) {
    windGustTimer -= dt;
    if (windGustTimer <= 0) {
      if (windGustState === 'CALM') {
        windGustState = 'GUSTING';
        windGustTimer = 3.5 + Math.random() * 3.0; // Gust lasts 3.5–6.5 seconds
        windGustTarget = 0.65 + Math.random() * 0.35;
      } else {
        windGustState = 'CALM';
        windGustTimer = 6.0 + Math.random() * 5.0; // Calm lull lasts 6.0–11.0 seconds
        windGustTarget = 0.0;
      }
    }
    const gustLerpRate = windGustState === 'GUSTING' ? 1.4 : 1.1;
    windGustEnvelope += (windGustTarget - windGustEnvelope) * (1 - Math.exp(-gustLerpRate * dt));
  }

  weatherLerp.windStrength = weatherLerp.windBase * windGustEnvelope;
  uWindStrength.value = weatherLerp.windStrength;

  _wTargetHemiTint.set(target.hemiTint);
  weatherLerp.hemiTint.lerp(_wTargetHemiTint, k);

  _wTargetFogTint.set(target.fogTint);
  weatherLerp.fogTint.lerp(_wTargetFogTint, k);

  // Wet road & sidewalk darkening + specular sheen during rain/overcast
  const w = weatherLerp.wetness;
  if (trafficSystem?.mAsphaltSurface) {
    trafficSystem.mAsphaltSurface.roughness = 0.88 - 0.56 * w;
    trafficSystem.mAsphaltSurface.metalness = 0.04 + 0.24 * w;
    trafficSystem.mAsphaltSurface.color.copy(_baseRoadColor).lerp(_wetRoadColor, w * 0.65);
  }
  M.paving.roughness = 0.65 - 0.34 * w;
  M.paving.color.copy(_basePavingColor).lerp(_wetPavingColor, w * 0.55);
  M.walkway.roughness = 0.65 - 0.34 * w;
  M.walkway.color.copy(_basePavingColor).lerp(_wetPavingColor, w * 0.55);
  M.bgSidewalk.roughness = 0.65 - 0.34 * w;
  M.bgSidewalk.color.copy(_baseBgSidewalkColor).lerp(_wetBgSidewalkColor, w * 0.55);
  M.curb.roughness = 0.65 - 0.30 * w;
  M.curb.color.copy(_baseCurbColor).lerp(_wetCurbColor, w * 0.50);

  // Update 3D Rain Particle System (THREE.Points)
  const showRain =
    weatherLerp.rainIntensity > 0.01 &&
    (!isAnyStoreViewActive() || strawberryCorner.isParkMatchActive);
  rainPoints.visible = showRain;
  if (showRain) {
    rainMat.opacity = weatherLerp.rainIntensity * 0.62;
    const posAttr = rainGeo.attributes.position;
    const arr = posAttr.array;
    const halfSpan = RAIN_BOX_XZ * 0.5;
    const stepDt = paused ? 0 : dt;
    const windDriftX = -1.6 * stepDt;
    const windDriftZ = 0.8 * stepDt;

    for (let i = 0; i < RAIN_COUNT; i++) {
      const idx = i * 3;
      let rx = arr[idx] + windDriftX;
      let ry = arr[idx + 1] - rainSpeeds[i] * stepDt;
      let rz = arr[idx + 2] + windDriftZ;

      if (ry < RAIN_BOTTOM_Y) {
        ry = RAIN_TOP_Y - Math.random() * 2.5;
        rx = focusX + (Math.random() - 0.5) * RAIN_BOX_XZ;
        rz = focusZ + (Math.random() - 0.5) * RAIN_BOX_XZ;
      } else {
        // Keep rain volume centered around camera focus target
        if (rx - focusX > halfSpan) rx -= RAIN_BOX_XZ;
        else if (rx - focusX < -halfSpan) rx += RAIN_BOX_XZ;
        if (rz - focusZ > halfSpan) rz -= RAIN_BOX_XZ;
        else if (rz - focusZ < -halfSpan) rz += RAIN_BOX_XZ;
      }

      arr[idx] = rx;
      arr[idx + 1] = ry;
      arr[idx + 2] = rz;
    }
    posAttr.needsUpdate = true;
  }
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

let lastTrackTitle = '';
let lastClimateText = '';
let lastMoodText = '';
let lastClockStr = '';
let lastFlutterClockStr = '';
let lastFlutterClimate = '';
let lastFlutterMood = '';
let lastFlutterWeatherIdx = -1;

function updateHubWeatherAndClock(h) {
  const clockStr = formatClock(h);
  if (clockStr !== lastClockStr) {
    lastClockStr = clockStr;
    if ($('clock')) $('clock').textContent = clockStr;
    if ($('hub-clock')) $('hub-clock').textContent = clockStr;
  }
  const info = getTownMoodAndClimate(h);
  if (info.climate !== lastClimateText) {
    lastClimateText = info.climate;
    if ($('hub-climate')) $('hub-climate').textContent = info.climate;
  }
  if (info.track !== lastTrackTitle) {
    lastTrackTitle = info.track;
    if ($('cozy-music-label')) $('cozy-music-label').textContent = info.track;
    if ($('cozy-music-label-dup')) $('cozy-music-label-dup').textContent = info.track;
  }
  if (cozyMoodTag) {
    const nextMood = info.mood;
    if (nextMood !== lastMoodText) {
      lastMoodText = nextMood;
      cozyMoodTag.textContent = nextMood;
    }
  }
  // Only post to Flutter when visible minute/mood/weather actually changes (prevents 60Hz bridge rebuild storm!)
  if (
    clockStr !== lastFlutterClockStr ||
    info.climate !== lastFlutterClimate ||
    info.mood !== lastFlutterMood ||
    currentWeatherIdx !== lastFlutterWeatherIdx
  ) {
    lastFlutterClockStr = clockStr;
    lastFlutterClimate = info.climate;
    lastFlutterMood = info.mood;
    lastFlutterWeatherIdx = currentWeatherIdx;
    postToFlutter({
      type: 'CLOCK_WEATHER_CHANGED',
      daytime: h,
      clock: clockStr,
      date: formatShortDate(),
      mood: info.mood,
      climate: info.climate,
      track: info.track,
      weatherId: WEATHER_STATES[currentWeatherIdx]?.id || 'sunny',
      weatherIndex: currentWeatherIdx
    });
  }
}

if ($('hub-date')) $('hub-date').textContent = formatShortDate();

function syncWeatherModeButtons(idx) {
  const mode = idx === 4 ? 'rain' : (idx === 3 || idx === 2 ? 'fog' : 'clear');
  document.querySelectorAll('.cozy-weather-opt').forEach(btn => {
    btn.classList.toggle('on', btn.dataset.weatherMode === mode);
  });
}

function setWeatherByIndex(idx, notifyBridge = true) {
  currentWeatherIdx = ((idx % WEATHER_STATES.length) + WEATHER_STATES.length) % WEATHER_STATES.length;
  lastWeatherChangeHour = daytime;
  nextWeatherDurationHours = 2.0 + Math.random() * 1.0;
  if (WEATHER_STATES[currentWeatherIdx].id === 'sunny') {
    windGustState = 'CALM';
    windGustTarget = 0.0;
  } else if (WEATHER_STATES[currentWeatherIdx].id === 'breezy') {
    windGustState = 'GUSTING';
    windGustTimer = 4.5;
    windGustTarget = 1.0;
  }
  syncWeatherModeButtons(currentWeatherIdx);
  updateHubWeatherAndClock(daytime);
  const info = getTownMoodAndClimate(daytime);
  showHint(`🌦️ Cuaca: ${info.climate}`);
  if (notifyBridge && window.CerriaBridge && typeof window.CerriaBridge.send === 'function') {
    const mode = currentWeatherIdx === 4 ? 'rain' : (currentWeatherIdx === 3 || currentWeatherIdx === 2 ? 'fog' : 'clear');
    window.CerriaBridge.send({
      type: 'SET_WEATHER',
      weather: mode,
      weatherIndex: currentWeatherIdx,
      payload: {
        weather: mode,
        weatherId: WEATHER_STATES[currentWeatherIdx].id,
        weatherIndex: currentWeatherIdx,
        climate: info.climate
      }
    });
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

$('daytime').addEventListener('input', e => {
  daytime = parseFloat(e.target.value);
  cycleOn = false;
  $('cycle').checked = false;
  cozyAudio.setTimeOfDay(daytime);
  updateHubWeatherAndClock(daytime);
});

$('city-lights')?.addEventListener('input', e => {
  cityLightMult = parseFloat(e.target.value);
  const pct = `${Math.round(cityLightMult * 100)}%`;
  if ($('city-lights-val')) $('city-lights-val').textContent = pct;
  showHint(`💡 Terang Kota ${pct}`);
});

// ============================================================================
// PROCEDURAL COZY LO-FI / AMBIENT SYNTHESIZER & TOWN SOUNDSCAPE CONTROLLER
// ============================================================================
const cozyAudio = new CozyAudioEngine();
const cozyAudioPill = $('cozy-audio-pill');
const cozyMusicBtn = $('cozy-music-toggle');
const cozyMoodTag = $('cozy-mood-tag');
const cozyVolSlider = $('cozy-music-vol');
const cozyMuteBtn = $('cozy-mute-btn');
const cozyVolVal = $('cozy-vol-val');
const cozyPlayBadge = $('cozy-play-badge');
let savedVolBeforeMute = 0.42;

function syncCozyAudioUI(status) {
  if (!cozyAudioPill || !cozyMusicBtn || !cozyMoodTag) return;
  cozyAudioPill.classList.toggle('on', status.enabled);
  cozyAudioPill.classList.toggle('playing', status.playing);
  cozyMusicBtn.setAttribute('aria-pressed', String(status.enabled));
  if (cozyPlayBadge) {
    cozyPlayBadge.textContent = status.enabled ? '❚❚' : '▶';
  }
  const info = getTownMoodAndClimate(daytime);
  lastMoodText = info.mood;
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

if (cozyMoodTag) {
  cozyMoodTag.style.cursor = 'pointer';
  cozyMoodTag.title = 'Klik untuk mengganti waktu (Malam / Pagi / Siang / Senja)';
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
  });
}

cozyMusicBtn?.addEventListener('click', async e => {
  e.stopPropagation();
  const enabled = await cozyAudio.toggle();
  showHint(enabled ? `🎵 Cozy Music aktif (${cozyAudio.isDaytime() ? 'Sunny Morning Bossa' : 'Midnight Lo-Fi'})` : '🔇 Cozy Music dijeda');
});

cozyMuteBtn?.addEventListener('click', async e => {
  e.stopPropagation();
  if (cozyAudio.isEnabled && cozyAudio.volume > 0.01) {
    savedVolBeforeMute = cozyAudio.volume;
    await cozyAudio.toggle();
    showHint('🔇 Musik di-mute');
  } else {
    if (cozyAudio.volume <= 0.01) {
      cozyAudio.setVolume(savedVolBeforeMute || 0.42);
      if (cozyVolSlider) cozyVolSlider.value = String(savedVolBeforeMute || 0.42);
    }
    if (!cozyAudio.isEnabled) {
      await cozyAudio.toggle();
    }
    showHint('🔊 Musik aktif kembali');
  }
});

cozyVolSlider?.addEventListener('input', e => {
  const v = parseFloat(e.target.value);
  if (v > 0.01) savedVolBeforeMute = v;
  cozyAudio.setVolume(v);
  if (cozyVolVal) cozyVolVal.textContent = `${Math.round(v * 100)}%`;
  if (v > 0 && !cozyAudio.isEnabled) {
    cozyAudio.toggle();
  } else {
    syncCozyAudioUI(cozyAudio.getStatus());
  }
});

// Auto-unlock Web Audio API on first user interaction anywhere on the screen
function handleFirstUserInteraction(e) {
  if (e.target && e.target.closest && e.target.closest('#cozy-music-toggle')) return;
  cozyAudio.unlockAndStart();
  if (cozyAudio.isUnlocked) {
    window.removeEventListener('pointerdown', handleFirstUserInteraction, true);
    window.removeEventListener('keydown', handleFirstUserInteraction, true);
    window.removeEventListener('wheel', handleFirstUserInteraction, true);
  }
}
window.addEventListener('pointerdown', handleFirstUserInteraction, true);
window.addEventListener('keydown', handleFirstUserInteraction, true);
window.addEventListener('wheel', handleFirstUserInteraction, true);

// Clean Daylight Atmosphere (Bright warm morning #ffd8a8, crisp sunny sky blue #87CEEB / #a8d8ff during daytime, warm golden dusk, and cozy night)
const skyStops = [
  [0, '#16201c', '#202d27', '#ffbe76', 0.14, 0.28, 1.0],
  [5.2, '#2b3b38', '#465a54', '#ffad66', 0.36, 0.48, 0.72],
  [6.3, '#ffd8a8', '#ffe4be', '#fff0d4', 0.72, 1.08, 0.08],
  [8.2, '#a8d8ff', '#b8e0ff', '#fff6e4', 0.76, 1.18, 0.02],
  [12.0, '#87CEEB', '#a8d8ff', '#fff8eb', 0.80, 1.24, 0.0],
  [15.8, '#9ed4f8', '#b8e0ff', '#fff0d2', 0.74, 1.15, 0.05],
  [17.4, '#ffd29d', '#ffe0b5', '#ffb870', 0.62, 0.85, 0.32],
  [18.6, '#3b4d48', '#5c6158', '#ff9e58', 0.46, 0.45, 0.78],
  [20.0, '#1d2823', '#293730', '#ffbe76', 0.16, 0.32, 0.96],
  [24.0, '#16201c', '#202d27', '#ffbe76', 0.14, 0.28, 1.0]
];
const _cA = new THREE.Color(), _cB = new THREE.Color();

function updateDaylight(h, focusX, focusZ) {
  const wh = ((h % 24) + 24) % 24;
  let s0 = skyStops[0], s1 = skyStops[1];
  for (let i = 0; i < skyStops.length - 1; i++) {
    if (wh >= skyStops[i][0] && wh <= skyStops[i + 1][0]) {
      s0 = skyStops[i];
      s1 = skyStops[i + 1];
      break;
    }
  }
  const u = (wh - s0[0]) / Math.max(0.001, s1[0] - s0[0]);
  const night = s0[6] + (s1[6] - s0[6]) * u;

  // Base sky & fog color: pure bright sky when 'Cerah' (fogBlend = 0.0), blended smoothly when cloudy/overcast/rainy
  _cA.set(s0[1]).lerp(_cB.set(s1[1]), u);
  if (weatherLerp.fogBlend > 0.001) {
    _wTempColor.copy(weatherLerp.fogTint).lerp(_cB.set('#1a242c'), night * 0.78);
    _cA.lerp(_wTempColor, weatherLerp.fogBlend);
  }
  scene.background.copy(_cA);
  scene.fog.color.copy(_cA);

  // Ambient / HemisphereLight: 100% normal warm brightness (hemiMult = 1.0, hemiBlend = 0.0) when 'Cerah'
  _cA.set(s0[2]).lerp(_cB.set(s1[2]), u);
  if (weatherLerp.hemiBlend > 0.001) {
    _wTempColor.copy(weatherLerp.hemiTint).lerp(_cB.set('#28343d'), night * 0.72);
    _cA.lerp(_wTempColor, weatherLerp.hemiBlend);
  }
  hemi.color.copy(_cA);

  hemi.groundColor.set('#E8D8C0').lerp(_cB.set('#969ea6'), weatherLerp.hemiBlend * 0.65).lerp(_cB.set('#2c3830'), night);
  const baseHemiInt = s0[4] + (s1[4] - s0[4]) * u;
  hemi.intensity = baseHemiInt * (weatherLerp.hemiMult ?? 1.0);

  // DirectionalLight (sun): 100% normal warm brightness (sunMult = 1.0) when 'Cerah'
  _cA.set(s0[3]).lerp(_cB.set(s1[3]), u);
  if (weatherLerp.hemiBlend > 0.001) {
    _cA.lerp(_cB.set('#b8c6d6'), weatherLerp.hemiBlend * 0.55);
  }
  sun.color.copy(_cA);
  const baseSunInt = s0[5] + (s1[5] - s0[5]) * u;
  const effSunMult = 1.0 - (1.0 - weatherLerp.sunMult) * (1.0 - night * 0.65);
  sun.intensity = baseSunInt * effSunMult;

  const sunAng = ((wh - 6) / 24) * Math.PI * 2;
  const elev = Math.max(0.18, Math.sin(sunAng) * 0.75 + 0.32);
  sun.position.set(focusX + Math.cos(sunAng) * 32, 18 + elev * 24, focusZ + Math.sin(sunAng) * 28);
  sun.target.position.set(focusX, 0, focusZ);

  uWindowGlow.value = (0.85 + 0.75 * night) * (0.65 + 0.35 * cityLightMult);
  for (let i = 0; i < cityMaterials.length; i++) {
    cityMaterials[i].emissiveIntensity = uWindowGlow.value;
  }
  const streetLampFactor = getStreetlightDayNightFactor(wh);
  M.lamp.emissiveIntensity = (0.38 + 0.62 * Math.max(0.75, streetLampFactor)) * cityLightMult;
  return night;
}

// Pointer Drag, Wheel Zoom, Raycasting & Keyboard Shortcuts
let dragging = false, downX = 0, downY = 0, moved = false;
const pointer = new THREE.Vector2();
const raycaster = new THREE.Raycaster();

renderer.domElement.addEventListener('pointerdown', e => {
  dragging = true;
  moved = false;
  downX = e.clientX;
  downY = e.clientY;
});

addEventListener('pointermove', e => {
  if (!dragging || isAnyStoreViewActive()) return;
  const dx = e.clientX - downX, dy = e.clientY - downY;
  if (Math.hypot(dx, dy) > 4) moved = true;
  targetYaw -= dx * 0.0055;
  targetPitch = Math.max(0.24, Math.min(0.82, targetPitch + dy * 0.004));
  downX = e.clientX;
  downY = e.clientY;
});

addEventListener('pointerup', e => {
  if (!dragging) return;
  dragging = false;
  if (moved) return;
  if (isAnyStoreViewActive()) return;
  pointer.x = (e.clientX / innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(links, false);
  if (hits.length) {
    const idx = hits[0].object.userData.store;
    if (idx !== undefined) {
      if (isFlutterCanvas) {
        const wasAlreadySelected = idx === selected && !over;
        if (!wasAlreadySelected) {
          select(idx);
        }
        postToFlutter({
          type: 'BUILDING_CLICKED',
          openCatalog: wasAlreadySelected,
          ...buildFlutterStorePayload(idx)
        });
      } else if (cardClosed) {
        setCardClosed(false);
        if (idx !== selected || over) select(idx);
      } else if (idx !== selected || over) {
        select(idx);
      }
    }
  }
});

speechEl?.addEventListener('click', e => {
  if (!isFlutterCanvas) return;
  e.stopPropagation();
  postToFlutter({
    type: 'BUILDING_CLICKED',
    openCatalog: true,
    ...buildFlutterStorePayload(selected)
  });
});

renderer.domElement.addEventListener(
  'wheel',
  e => {
    if (isAnyStoreViewActive()) return;
    e.preventDefault();
    targetZoom = Math.max(14, Math.min(36, targetZoom + e.deltaY * 0.015));
  },
  { passive: false }
);

addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || infoModal.open) return;
  if (isAnyStoreViewActive()) {
    if (e.key === 'Escape') exitBuilding();
    return;
  }
  if (e.key === 'ArrowLeft') stepStore(-1);
  else if (e.key === 'ArrowRight') stepStore(1);
  else if (e.key === ' ') {
    e.preventDefault();
    $('pause').click();
  } else if (e.key >= '1' && e.key <= '4') setSpeed(parseInt(e.key, 10) - 1);
  else if (e.key === 'd' || e.key === 'D') {
    $('cycle').checked = !cycleOn;
    $('cycle').dispatchEvent(new Event('change'));
  } else if (e.key === '[' || e.key === ']') {
    shutter = Math.max(0, Math.min(0.45, shutter + (e.key === ']' ? 0.04 : -0.04)));
    $('shutter').value = shutter.toFixed(2);
    if ($('shutter-val')) $('shutter-val').textContent = `${shutter.toFixed(2)}s`;
    showHint(`Shutter ${shutter.toFixed(2)}s`);
  } else if (e.key === ',' || e.key === '.') {
    daytime = ((daytime + (e.key === '.' ? 0.5 : -0.5)) % 24 + 24) % 24;
    $('daytime').value = daytime;
    cycleOn = false;
    $('cycle').checked = false;
    forceSunnyWeather();
    cozyAudio.setTimeOfDay(daytime);
    updateHubWeatherAndClock(daytime);
  } else if (e.key === 'm' || e.key === 'M') {
    cozyMusicBtn?.click();
  } else if (e.key === 'o' || e.key === 'O') setOverview(!over);
  else if (e.key === 'Escape') {
    if (cozySettingsPopover?.classList.contains('open')) {
      setSettingsOpen(false);
    } else {
      setCardClosed(!cardClosed);
    }
  }
});

// Project 3D anchors to screen for speech bubble & floating Left/Right Neighbor Pills
const _proj = new THREE.Vector3();
function toScreen(x, y, z) {
  _proj.set(x, y, z).project(camera);
  return [(_proj.x * 0.5 + 0.5) * innerWidth, (-_proj.y * 0.5 + 0.5) * innerHeight, _proj.z];
}

function updateAnchors(time) {
  if (over || isAnyStoreViewActive()) {
    speechEl.classList.remove('on');
    tagLeft.classList.remove('on');
    tagRight.classList.remove('on');
    return;
  }
  const s = stores[selected];
  const sp = s.g.position;
  const h = STYLE_HEIGHT[s.style];
  const [sx, sy, sz] = toScreen(sp.x, h + 0.95, sp.z);
  if (sz < 1) {
    speechEl.style.transform = `translate(${Math.round(sx)}px, ${Math.round(sy)}px) translate(-16px, -100%)`;
    const phraseIdx = Math.floor(time * 0.25) % s.lab.checks.length;
    const nextPhrase = s.lab.checks[phraseIdx];
    if (speechEl.textContent !== nextPhrase) {
      speechEl.textContent = nextPhrase;
    }
    speechEl.classList.add('on');
  } else {
    speechEl.classList.remove('on');
  }

  // In Flutter 3D Canvas mode, neighbor pills are rendered by Native Flutter widgets (skip DOM reflow)
  if (isFlutterCanvas) return;

  // Hide neighbor capsules temporarily when Building Info Card or Store Modal is open on portrait or smartphone screens
  const isSmallOrMediumScreen = innerWidth <= 767 || innerWidth < innerHeight;
  if ((!cardClosed && isSmallOrMediumScreen) || infoModal?.open) {
    tagLeft.classList.remove('on');
    tagRight.classList.remove('on');
    return;
  }

  // Compute Left & Right Neighbor stops and project their 3D anchors
  const navPos = NAV_ORDER.indexOf(selected);
  const prevIdx = NAV_ORDER[(navPos - 1 + NAV_ORDER.length) % NAV_ORDER.length];
  const nextIdx = NAV_ORDER[(navPos + 1) % NAV_ORDER.length];
  const candidates = [prevIdx, nextIdx].map(idx => {
    const st = stores[idx];
    const [px, py, pz] = toScreen(st.label.x, st.label.y, st.label.z);
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
    const w = el.offsetWidth || 160;
    const isPortraitOrNarrow = innerWidth < innerHeight || innerWidth <= 767;
    const isShortLandscape = innerWidth >= innerHeight && innerWidth <= 767 && innerHeight <= 600;

    let x, y;
    if (isPortraitOrNarrow) {
      const edgePad = 10;
      const half = w / 2 + edgePad;
      x = isRight
        ? Math.max(innerWidth * 0.54 + w * 0.5, Math.min(innerWidth - half, c.px))
        : Math.max(half, Math.min(innerWidth * 0.46 - w * 0.5, c.px));
      y = Math.max(122, Math.min(innerHeight * 0.26, c.py));
    } else if (isShortLandscape) {
      const half = w / 2 + 14;
      x = isRight
        ? Math.max(innerWidth * 0.68 + half * 0.3, Math.min(innerWidth - half, c.px))
        : Math.max(half, Math.min(innerWidth * 0.32 - half * 0.3, c.px));
      y = Math.max(92, Math.min(innerHeight - 130, c.py));
    } else {
      const half = w / 2 + 24;
      // Keep left & right neighbor pills strictly on the outer left/right margins of the screen
      // (outside the central 36%..64% building silhouette zone) so they NEVER overlap the main 3D building!
      x = isRight
        ? Math.max(innerWidth * 0.68 + half * 0.35, Math.min(innerWidth - half, c.px))
        : Math.max(half, Math.min(innerWidth * 0.32 - half * 0.35, c.px));
      y = Math.max(230, Math.min(innerHeight - 250, c.py));
    }
    el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -100%)`;
    el.classList.add('on');
  };

  placePill(tagLeft, leftC, false);
  placePill(tagRight, rightC, true);
}

// Initialize from URL hash (defaults directly to Strawberry Corner / toko5 and launches the 1:1 Strawberry Corner diorama experience!)
const initSlot = slotFromHash(location.hash);
select(initSlot ?? slotOf('toko5'), true);
if (location.hash && initSlot != null && location.hash.slice(1) !== BUILDINGS_DATA[initSlot].id) {
  history.replaceState(null, '', location.pathname + location.search + '#' + BUILDINGS_DATA[initSlot].id);
}

// Live hash navigation (address bar edits, back/forward, external links, future WebView bridge)
addEventListener('hashchange', () => {
  const slot = slotFromHash(location.hash);
  if (slot == null) return;
  const canonical = '#' + BUILDINGS_DATA[slot].id;
  if (location.hash !== canonical) history.replaceState(null, '', canonical);
  if (slot !== selected && !isAnyStoreViewActive()) select(slot, true);
});

// Main Render Loop
let lastNow = performance.now();
let simTime = 0;
const slotGlow = new Float32Array(LOTS);
const focusVec = new THREE.Vector3();

// Auto-Performance Scaler & Smart Idle Frame Limiter (Battery & Thermal Protection)
let perfFrameCount = 0;
let perfAccumTime = 0;
let perfScaledDown = false;
let currentFps = 60;
let lastUserInteractionMs = performance.now();
let lastRenderedFrameMs = 0;

if (typeof window !== 'undefined') {
  const bumpInteraction = () => {
    lastUserInteractionMs = performance.now();
  };
  ['pointerdown', 'pointermove', 'touchstart', 'touchmove', 'wheel', 'keydown'].forEach(ev => {
    window.addEventListener(ev, bumpInteraction, { passive: true });
  });
}

function applyGraphicsQualityTier(tier) {
  const t = String(tier || 'balanced').toLowerCase();
  graphicsQualityTier = t === 'ultra' || t === 'high' || t === 'battery' ? t : 'balanced';
  const maxDpr =
    graphicsQualityTier === 'ultra'
      ? 2.0
      : graphicsQualityTier === 'high'
        ? 1.65
        : graphicsQualityTier === 'balanced'
          ? 1.35
          : 1.05;
  const enableShadows = graphicsQualityTier === 'ultra' || graphicsQualityTier === 'high';
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
  renderer.shadowMap.enabled = enableShadows;
  sun.castShadow = enableShadows;
  renderer.setSize(innerWidth, innerHeight, false);
  lastUserInteractionMs = performance.now();
  return {
    tier: graphicsQualityTier,
    pixelRatio: renderer.getPixelRatio(),
    shadows: enableShadows
  };
}

function updateAutoPerfScaler(dt) {
  if (dt <= 0 || dt > 0.25) return;
  perfFrameCount++;
  perfAccumTime += dt;
  if (perfAccumTime >= 1.5) {
    currentFps = Math.round(perfFrameCount / perfAccumTime);
    perfFrameCount = 0;
    perfAccumTime = 0;

    if (!perfScaledDown && currentFps < 38) {
      perfScaledDown = true;
      const targetDpr = isHighCapabilityMobile ? 1.25 : 1.05;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, targetDpr));
      if (!isHighCapabilityMobile) {
        renderer.shadowMap.enabled = false;
        sun.castShadow = false;
      }
      renderer.setSize(innerWidth, innerHeight, false);
      postToFlutter({
        type: 'PERF_SCALER',
        fps: currentFps,
        pixelRatio: renderer.getPixelRatio(),
        shadowMapSize,
        scaledDown: true
      });
    }
  }
}

function animate(now) {
  requestAnimationFrame(animate);

  // Only throttle frame interval if user explicitly enables 'battery' graphics tier
  const targetMinIntervalMs = graphicsQualityTier === 'battery' ? 33 : 0;
  if (targetMinIntervalMs > 0 && now - lastRenderedFrameMs < targetMinIntervalMs) {
    return;
  }
  lastRenderedFrameMs = now;

  const dt = Math.min(0.05, (now - lastNow) / 1000);
  lastNow = now;
  updateAutoPerfScaler(dt);

  if (!paused) {
    simTime += dt * timeScale;
    if (cycleOn) {
      daytime = (daytime + dt * timeScale * 0.08) % 24;
      if (cozySettingsPopover?.classList.contains('open')) {
        $('daytime').value = daytime.toFixed(2);
      }
      cozyAudio.setTimeOfDay(daytime);
      updateHubWeatherAndClock(daytime);
    }
    checkAutomaticWeatherCycle(daytime, dt * timeScale);
  }

  if (strawberryCorner.isActive) {
    strawberryCorner.update(now, dt);
    updateStrawberryAmbient(now * 0.001, dt);
    if (strawberryCorner.isParkMatchActive) {
      dofPass.u.uEnabled.value = $('dof')?.checked === false ? 0 : 1;
      dofPass.u.focus.value = camera.position.distanceTo(controls.target);
      dofPass.u.range.value = 3.8;
    } else {
      dofPass.u.uEnabled.value = 0;
    }
  } else if (glowStudio.isActive) {
    glowStudio.update(now, dt);
    dofPass.u.uEnabled.value = 0;
  } else if (atelierBoutique.isActive) {
    atelierBoutique.update(now, dt);
    dofPass.u.uEnabled.value = 0;
  } else if (townStores3D.isActive) {
    townStores3D.update(now, dt);
    dofPass.u.uEnabled.value = 0;
  } else if (mayorOffice.isActive) {
    mayorOffice.update(now, dt);
    updateMayorAmbient(now * 0.001, dt, daytime);
    dofPass.u.uEnabled.value = 0;
  } else {
    updateStrawberryAmbient(now * 0.001, dt);
    updateMayorAmbient(now * 0.001, dt, daytime);
    dofPass.u.uEnabled.value = $('dof')?.checked ? 1 : 0;
    dofPass.u.range.value = 5.8;
    yawOffset = damp(yawOffset, targetYaw, 10, dt);
    pitch = damp(pitch, targetPitch, 10, dt);
    zoom = damp(zoom, targetZoom, 10, dt);

    const tgt = focusAt(selected);
    cur.fx = damp(cur.fx, tgt.fx, 6.5, dt);
    cur.fy = damp(cur.fy, tgt.fy, 6.5, dt);
    cur.fz = damp(cur.fz, tgt.fz, 6.5, dt);
    cur.yaw = damp(cur.yaw, tgt.yaw, 6.5, dt);
    cur.pitch = damp(cur.pitch, tgt.pitch, 6.5, dt);
    cur.dist = damp(cur.dist, tgt.dist, 6.5, dt);

    const cosP = Math.cos(cur.pitch), sinP = Math.sin(cur.pitch);
    camera.position.set(
      cur.fx + Math.sin(cur.yaw) * cosP * cur.dist,
      cur.fy + sinP * cur.dist,
      cur.fz + Math.cos(cur.yaw) * cosP * cur.dist
    );
    controls.target.set(cur.fx, cur.fy, cur.fz);
    camera.lookAt(controls.target);
    camera.updateMatrixWorld();
    dofPass.u.focus.value = cur.dist;
  }

  const lightFocusX = strawberryCorner.isParkMatchActive ? controls.target.x : cur.fx;
  const lightFocusZ = strawberryCorner.isParkMatchActive ? controls.target.z : cur.fz;
  updateDynamicWeather3D(dt, lightFocusX, lightFocusZ);
  const night = updateDaylight(daytime, lightFocusX, lightFocusZ);
  if (isAnyStoreViewActive() && !strawberryCorner.isParkMatchActive) {
    scene.background.set('#F5EFE4');
    scene.fog.color.set('#F5EFE4');
    scene.fog.near = 200;
    scene.fog.far = 500;
    hemi.visible = true;
    sun.visible = true;
    hemi.color.set('#fff9ef');
    hemi.groundColor.set('#ebdcc7');
    hemi.intensity = 1.05;
    sun.color.set('#fff3df');
    sun.intensity = 1.18;
    const activeStore = stores[activeStoreSlot ?? selected];
    const sp = activeStore.g.position;
    sun.position.set(sp.x + 18, 26, sp.z + 22);
    sun.target.position.set(sp.x, 3, sp.z);
  } else {
    // Dynamic weather fog range (smoothly lerped between clear 90..220 and atmospheric cloudy/rainy fog)
    scene.fog.near = weatherLerp.fogNear;
    scene.fog.far = weatherLerp.fogFar;
  }

  const streetLampFactor =
    isAnyStoreViewActive() && !strawberryCorner.isParkMatchActive
      ? 0.95
      : Math.max(0.88, getStreetlightDayNightFactor(daytime));
  stores.forEach((s, i) => {
    const active = over || i === selected;
    s.tone.sat.value = damp(s.tone.sat.value, active ? 1.04 : 0.78, 6, dt);
    s.tone.lift.value = damp(s.tone.lift.value, !over && i === selected ? 0.14 : 0, 6, dt);
    s.glow = damp(s.glow, active ? 1 : 0.55, 6, dt);
    slotGlow[i] = s.glow;
    if (s.M.bulb.emissive) {
      s.M.bulb.emissiveIntensity = (0.40 + 0.95 * streetLampFactor) * cityLightMult;
    }
  });

  focusVec.set(lightFocusX, strawberryCorner.isParkMatchActive ? controls.target.y : cur.fy, lightFocusZ);
  updateFakeLights(
    focusVec,
    slotGlow,
    camera,
    isAnyStoreViewActive() && !strawberryCorner.isParkMatchActive ? 0.95 : Math.max(0.88, night),
    streetLampFactor,
    cityLightMult
  );
  uWindTime.value = simTime;
  const showTownAmbient = !isAnyStoreViewActive() || strawberryCorner.isParkMatchActive;
  if (showTownAmbient) {
    trafficSystem.setOverlaysVisible(!strawberryCorner.isParkMatchActive);
    trafficSystem.update(paused ? 0 : dt * timeScale, simTime, paused ? 0 : shutter, night);
    updateCrowd(simTime);
    updateTennisCourt(simTime);
    updateTamanKota(simTime);
    ambientNature.update(simTime, paused ? 0 : dt * timeScale, daytime, cur, _worldPos, agents, true, weatherLerp.windStrength);
  } else {
    trafficSystem.setOverlaysVisible(false);
    ambientNature.update(simTime, 0, daytime, cur, _worldPos, agents, false, 0);
  }
  updateAnchors(simTime);

  if ((isMobileOrWebView || perfScaledDown) && !macroEnabledByUser) {
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
  } else {
    try {
      composer.render();
    } catch (err) {
      rFallback(err);
    }
  }
  updateMobileHeroBuildingViewport();
}
function rFallback() {
  renderer.setRenderTarget(null);
  renderer.render(scene, camera);
}

const _heroProjPt = new THREE.Vector3();
let _lastHeroSnapMs = 0;
function updateMobileHeroBuildingViewport() {
  if (innerWidth > 767 || !isAnyStoreViewActive()) return;
  const nowMs = performance.now();
  if (nowMs - _lastHeroSnapMs < 400) return;
  const overlays = document.querySelectorAll('.sc-overlay');
  let activeOverlay = null;
  for (let i = 0; i < overlays.length; i++) {
    if (overlays[i].style.display !== 'none') {
      activeOverlay = overlays[i];
      break;
    }
  }
  if (!activeOverlay) return;
  const overlayState = activeOverlay.dataset.state || 'OVERVIEW';
  if (overlayState !== 'OVERVIEW' && overlayState !== 'CATALOG') return;
  const heroCanvas = activeOverlay.querySelector('.sc-hero-building-canvas');
  if (!heroCanvas) return;
  _lastHeroSnapMs = nowMs;
  const st = stores[activeStoreSlot ?? selected];
  const bGroup = st?.g;
  if (!bGroup) return;

  const srcCanvas = renderer.domElement;
  const sw = srcCanvas.width;
  const sh = srcCanvas.height;
  if (sw < 16 || sh < 16) return;

  const sp = bGroup.position;
  const bh = STYLE_HEIGHT[st.style] || 6.0;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const halfW = 4.6;
  for (let dx = -halfW; dx <= halfW; dx += halfW) {
    for (let dz = -halfW; dz <= halfW; dz += halfW) {
      for (const dy of [-0.3, bh * 0.5, bh + 0.9]) {
        _heroProjPt.set(sp.x + dx, sp.y + dy, sp.z + dz).project(camera);
        const px = (_heroProjPt.x * 0.5 + 0.5) * sw;
        const py = (-_heroProjPt.y * 0.5 + 0.5) * sh;
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
      }
    }
  }
  if (!Number.isFinite(minX) || maxX <= minX || maxY <= minY) return;

  const cx = (minX + maxX) * 0.5;
  const cy = (minY + maxY) * 0.5;
  const span = Math.max(maxX - minX, maxY - minY) * 1.08;
  const size = Math.max(64, Math.min(Math.min(sw, sh), span));
  const sx = Math.max(0, Math.min(sw - size, cx - size * 0.5));
  const sy = Math.max(0, Math.min(sh - size, cy - size * 0.5));

  const ctx = heroCanvas.getContext('2d');
  if (!ctx) return;
  const dw = heroCanvas.width || 240;
  const dh = heroCanvas.height || 240;
  ctx.fillStyle = '#F5EFE6';
  ctx.fillRect(0, 0, dw, dh);
  ctx.drawImage(srcCanvas, sx, sy, size, size, 0, 0, dw, dh);
}

// Stage 4 (90%): GPU Shader Pre-Compilation (renderer.compile) & 1x Warm-Up Render for All 7 Buildings
await setLoadingProgress(
  90,
  'Kompilasi Shader & Pre-warm Memori GPU…',
  'Memuat seluruh shader gedung & material ke memori GPU (Anti-Stutter)'
);

{
  // Prepare initial daylight, dynamic weather, crowd matrices, and traffic instances before GPU compile
  const initNight = updateDaylight(daytime, cur.fx, cur.fz);
  const streetLampWarm = getStreetlightDayNightFactor(daytime);
  updateDynamicWeather3D(0.016, cur.fx, cur.fz);
  trafficSystem.update(0.016, 0, shutter, initNight);
  updateCrowd(0);
  updateTennisCourt(0);
  updateTamanKota(0);
  ambientNature.update(0, 0.016, daytime, cur, _worldPos, agents, true, weatherLerp.windStrength);

  // Compile all scene shaders onto the GPU (skip heavy 7-building warm-up loop in Flutter WebView / headless export for instant first frame)
  if (!isAutoExportGlb && !isFlutterCanvas) {
    if (typeof renderer.compileAsync === 'function') {
      try {
        await renderer.compileAsync(scene, camera);
      } catch {
        renderer.compile(scene, camera);
      }
    } else {
      renderer.compile(scene, camera);
    }

    // Perform 1x warm-up render across all 7 buildings so every building's textures, VBOs, and shadow maps are uploaded to GPU VRAM
    renderer.setRenderTarget(null);
    for (let wIdx = 0; wIdx < stores.length; wIdx++) {
      const wf = focusAt(wIdx);
      const cosP = Math.cos(wf.pitch), sinP = Math.sin(wf.pitch);
      camera.position.set(
        wf.fx + Math.sin(wf.yaw) * cosP * wf.dist,
        wf.fy + sinP * wf.dist,
        wf.fz + Math.cos(wf.yaw) * cosP * wf.dist
      );
      controls.target.set(wf.fx, wf.fy, wf.fz);
      camera.lookAt(controls.target);
      camera.updateMatrixWorld();
      slotGlow.fill(0.55);
      slotGlow[wIdx] = 1.0;
      focusVec.set(wf.fx, wf.fy, wf.fz);
      updateFakeLights(focusVec, slotGlow, camera, initNight, streetLampWarm, cityLightMult);
      renderer.render(scene, camera);
    }
  }

  // Restore camera to selected building and enter the 1:1 Strawberry Corner diorama immediately
  restoreVillageCameraToSelected();
  if (
    !isAutoExportGlb &&
    new URLSearchParams(location.search).get('exterior') !== '1' &&
    new URLSearchParams(location.search).get('city') !== '1'
  ) {
    enterBuilding({ instant: true });
    strawberryCorner.update(performance.now(), 0.016);
  }
  slotGlow.fill(0.55);
  slotGlow[selected] = 1.0;
  focusVec.set(cur.fx, cur.fy, cur.fz);
  updateFakeLights(focusVec, slotGlow, camera, initNight, streetLampWarm, cityLightMult);
  if (!isAutoExportGlb) {
    if (isMobileOrWebView && !macroEnabledByUser) {
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
    } else {
      try {
        composer.render();
      } catch (err) {
        rFallback(err);
      }
    }
  }
}

// Stage 5 (100%): Buka Layar Saat 100% dengan transisi fade-out halus
await setLoadingProgress(100, 'Cerria Town Siap Dijelajahi!', '100% GPU Siap · 60 FPS Stabil');
postToFlutter({ type: 'SCENE_READY', pct: 100 });
lastNow = performance.now();
requestAnimationFrame(animate);

if (loadingOverlay) {
  loadingOverlay.classList.add('fade-out');
  setTimeout(() => {
    loadingOverlay.remove();
  }, 580);
}

// Smart Cache refresh: re-render the info card text when /data/stores-data.json changed
// (store catalogs read the live data objects directly, so they pick up changes on next render).
onStoresUpdated(() => {
  if (!isAnyStoreViewActive()) renderCard(selected);
});

// Hybrid Unity Bridge host (window.CerriaBridge) — registered only once the town is fully ready,
// so openStore() calls issued during loading are queued and replayed here.
registerStoreHost({
  open(id) {
    const slot = slotOf(id);
    if (slot == null) return false;
    if (isAnyStoreViewActive()) {
      if (activeStoreSlot === slot) return true;
      bridgeSwitching = true;
      exitBuilding();
      bridgeSwitching = false;
    }
    if (slot !== selected) select(slot);
    enterBuilding();
    return true;
  },
  close() {
    if (!isAnyStoreViewActive()) return false;
    exitBuilding();
    return true;
  },
  activeStoreId: () => (activeStoreSlot != null ? BUILDINGS_DATA[activeStoreSlot].id : null),
  currentStoreId: () => BUILDINGS_DATA[selected]?.id ?? null
});

// Two-Way Hybrid Native Flutter UI <-> Three.js 3D Canvas Bridge (`window.FlutterBridge`)
registerFlutterBridgeHost({
  goToStore(indexOrId) {
    if (typeof indexOrId === 'string') {
      const slot = slotOf(indexOrId);
      if (slot != null) {
        select(slot);
        return buildFlutterStorePayload(selected);
      }
      const parsed = parseInt(indexOrId, 10);
      if (!Number.isNaN(parsed)) indexOrId = parsed;
    }
    if (typeof indexOrId === 'number' && Number.isFinite(indexOrId)) {
      const navIdx = ((Math.round(indexOrId) % NAV_ORDER.length) + NAV_ORDER.length) % NAV_ORDER.length;
      const lotIdx = NAV_ORDER[navIdx];
      select(lotIdx);
      return buildFlutterStorePayload(selected);
    }
    return null;
  },

  prevStore() {
    stepStore(-1);
    return buildFlutterStorePayload(selected);
  },

  nextStore() {
    stepStore(1);
    return buildFlutterStorePayload(selected);
  },

  setTimeOfDay(modeOrHour) {
    if (typeof modeOrHour === 'string') {
      const m = modeOrHour.trim().toLowerCase();
      if (m === 'cycle') {
        const wh = ((daytime % 24) + 24) % 24;
        daytime = wh >= 19.0 || wh < 5.2 ? 6.4 : wh < 7.5 ? 13.0 : wh < 16.5 ? 17.6 : 20.5;
      } else if (m === 'dawn' || m === 'pagi') {
        daytime = 6.4;
      } else if (m === 'day' || m === 'siang' || m === 'sunny') {
        daytime = 13.0;
      } else if (m === 'dusk' || m === 'sore' || m === 'senja' || m === 'sunset') {
        daytime = 17.6;
      } else if (m === 'night' || m === 'malam') {
        daytime = 20.5;
      } else {
        const h = parseFloat(m);
        if (Number.isFinite(h)) daytime = ((h % 24) + 24) % 24;
      }
    } else if (typeof modeOrHour === 'number' && Number.isFinite(modeOrHour)) {
      daytime = ((modeOrHour % 24) + 24) % 24;
    }
    if ($('daytime')) $('daytime').value = daytime.toFixed(2);
    cozyAudio.setTimeOfDay(daytime);
    updateHubWeatherAndClock(daytime);
    return daytime;
  },

  setWeather(type) {
    const t = String(type ?? '').trim().toLowerCase();
    let idx = 0;
    if (t === 'rain' || t === 'light_rain' || t === 'hujan') idx = 4;
    else if (t === 'fog' || t === 'overcast' || t === 'kabut' || t === 'mendung') idx = 3;
    else if (t === 'cloudy' || t === 'berawan') idx = 2;
    else if (t === 'breezy' || t === 'berangin') idx = 1;
    else if (t === 'cycle') {
      idx = (currentWeatherIdx === 0 || currentWeatherIdx === 1 || currentWeatherIdx === 2)
        ? 4
        : (currentWeatherIdx === 4 ? 3 : 0);
    } else {
      idx = 0;
    }
    setWeatherByIndex(idx, false);
    return WEATHER_STATES[currentWeatherIdx]?.id;
  },

  setCityLightIntensity(val) {
    const v = Math.max(0.5, Math.min(2.5, Number(val) || 1.2));
    cityLightMult = v;
    if ($('city-lights')) $('city-lights').value = String(v);
    if ($('city-lights-val')) $('city-lights-val').textContent = `${Math.round(v * 100)}%`;
    return cityLightMult;
  },

  setSimSpeed(mult) {
    const num = Number(mult);
    if (num === 0) {
      paused = true;
      return { paused: true, timeScale };
    }
    paused = false;
    const matchIdx = SPEEDS.findIndex(s => Math.abs(s[0] - num) < 0.1);
    if (matchIdx >= 0) {
      setSpeed(matchIdx);
    } else if (Number.isFinite(num) && num > 0) {
      timeScale = Math.max(0.25, Math.min(16, num));
    }
    return { paused, timeScale };
  },

  async toggleMusic(forceState) {
    if (typeof forceState === 'boolean') {
      if (cozyAudio.isEnabled !== forceState) {
        await cozyAudio.toggle();
      }
    } else {
      await cozyAudio.toggle();
    }
    const status = cozyAudio.getStatus();
    postToFlutter({
      type: 'AUDIO_CHANGED',
      enabled: status.enabled,
      playing: status.playing,
      volume: status.volume
    });
    return status;
  },

  setMusicVolume(val) {
    const v = Math.max(0, Math.min(1, Number(val) || 0));
    cozyAudio.setVolume(v);
    if (cozyVolSlider) cozyVolSlider.value = String(v);
    return v;
  },

  setMacroDOF(val) {
    const enabled = typeof val === 'boolean' ? val : Number(val) > 0;
    macroEnabledByUser = enabled;
    if ($('dof')) $('dof').checked = enabled;
    dofPass.u.uEnabled.value = enabled ? 1 : 0;
    if (typeof val === 'number' && val > 0 && val <= 0.45) {
      shutter = val;
      if ($('shutter')) $('shutter').value = shutter.toFixed(2);
    }
    return { dofEnabled: enabled, shutter };
  },

  setAutoCycle(enabled) {
    cycleOn = Boolean(enabled);
    if ($('cycle')) $('cycle').checked = cycleOn;
    return cycleOn;
  },

  setGraphicsQuality(tier) {
    return applyGraphicsQualityTier(tier);
  },

  enterStore(indexOrId) {
    if (indexOrId !== undefined) {
      this.goToStore(indexOrId);
    }
    if (!isAnyStoreViewActive()) enterBuilding();
    return true;
  },

  exitStore() {
    if (isAnyStoreViewActive()) exitBuilding();
    return true;
  },

  getState() {
    const info = getTownMoodAndClimate(daytime);
    return {
      ...buildFlutterStorePayload(selected),
      daytime,
      clock: formatClock(daytime),
      date: formatShortDate(),
      mood: info.mood,
      climate: info.climate,
      track: info.track,
      weatherId: WEATHER_STATES[currentWeatherIdx]?.id || 'sunny',
      weatherIndex: currentWeatherIdx,
      cityLightMult,
      timeScale,
      paused,
      cycleOn,
      dofEnabled: macroEnabledByUser,
      shutter,
      fps: currentFps,
      musicEnabled: cozyAudio.isEnabled,
      musicVolume: cozyAudio.volume
    };
  },

  emitInitialState() {
    postToFlutter({
      type: 'INITIAL_STATE',
      ...this.getState()
    });
  }
});

// Automated 1:1 Headless GLB Export trigger when opened with `?auto_export_glb=true`
if (new URLSearchParams(location.search).get('auto_export_glb') === 'true') {
  setTimeout(() => {
    exportCerriaTownToGLB({
      download: false,
      includeMetadata: true,
      postToServer: true,
      glbFilename: 'cerria-town-exact.glb',
      metadataFilename: 'cerria-scene-metadata.json'
    });
  }, 300);
}


