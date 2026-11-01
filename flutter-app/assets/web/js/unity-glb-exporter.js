// ============================================================================
// CERRIA TOWN — PHASE 3: 1:1 UNITY 3D EXPORTER (.GLB) & SCENE METADATA EXPORTER
// ----------------------------------------------------------------------------
// Non-destructive 1:1 3D exporter that clones and sanitizes `window.__CERRIA_SCENE__`
// into a structured `exportGroup` for glTF Viewer & Unity Engine (URP / Built-in):
//   • Building_toko1 … Building_toko7
//   • Environment_RoadsAndSidewalks
//   • Environment_TreesAndDecor
//   • Dynamic_Vehicles
//   • Dynamic_NPCs
//
// Key Guarantees (1:1 Visual Fidelity with Three.js Web):
//   1. Always reads the live Three.js scene from `window.__CERRIA_SCENE__`.
//   2. Forces all 7 store signage atlases (`s.atlas.setScale(1)`) to full
//      2048×1536 resolution and converts EVERY `THREE.CanvasTexture` (`map` and
//      `emissiveMap`) into a PNG `dataURL` (`canvas.toDataURL('image/png')`)
//      `HTMLImageElement` texture so store signboards ("COZY BITES & SIPS",
//      "GLOW STUDIO", "ATELIER & BOUTIQUE", "CIRCUIT & BYTE", "STRAWBERRY CORNER",
//      "APEX SPORT", "BALAI WARGA"), menus, clock faces, window interiors,
//      cottage facades, and road markings are 100% embedded inside the `.glb`.
//   3. Bakes texture `repeat` & `offset` into cloned geometry UVs and offsets
//      `polygonOffset` decal/sign planes by 3.5mm along vertex normals so signs
//      and road markings never Z-fight in Unity.
//   4. Preserves smooth vertex normals on curved cylinders/spheres/arches while
//      enforcing strict unit-length normals (`1.0`).
//   5. Preserves emissive colors & `emissiveIntensity` on glowing windows,
//      interior displays, and streetlamp bulbs.
//   6. Supports both browser download (`Shift + E` / Settings button) AND
//      automated Headless Chrome CLI export (`?auto_export_glb=true`).
// ============================================================================
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { STORE_IDS, STORE_SLOT, storeNumber } from '../store_ids.js?v=126';
import { BUILDINGS_DATA } from '../data.js?v=126';

let registeredContext = null;
let exportInProgress = false;

// Palette lookup matching the NPC shader in app.js so exported NPC meshes carry real RGB vertex colors
const SHIRT_PALETTE_HEX = [
  '#FF7F50', '#FFF8E7', '#F4C430', '#9DC183',
  '#E8A598', '#89CFF0', '#C3B1E1', '#D86A43'
];
const PANTS_PALETTE_HEX = ['#3B3B3B', '#556B2F', '#4A647C', '#8B7355', '#C2B299'];
const HAIR_PALETTE_HEX = ['#4A2E1B', '#222222', '#8B5A2B', '#D4A359'];
const SKIN_PALETTE_HEX = ['#FFE0BD', '#F5CBA7', '#E0AC69'];

const MAX_MESH_SPAN_UNITS = 300;

const round4 = n => Math.round((Number(n) || 0) * 10000) / 10000;
const vec3Obj = v => ({ x: round4(v.x), y: round4(v.y), z: round4(v.z) });

function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 3000);
}

/**
 * Distinguish between `(ctx, options)` and `(options)` call signatures so calling
 * `exportCerriaTownToGLB({ binary: true })` never overwrites `registeredContext`!
 */
function resolveContextAndOptions(firstArg, secondArg) {
  const looksLikeContext =
    firstArg &&
    typeof firstArg === 'object' &&
    (firstArg.scene?.isScene ||
      firstArg.world?.isObject3D ||
      Array.isArray(firstArg.stores) ||
      firstArg.roadsAndSidewalksGroup?.isObject3D);

  const fallbackCtx =
    registeredContext ||
    (typeof window !== 'undefined' && window.__CERRIA_EXPORTER_CTX__) ||
    {};

  if (looksLikeContext) {
    return { ctx: firstArg, options: secondArg || {} };
  }
  return {
    ctx: fallbackCtx,
    options: (firstArg && typeof firstArg === 'object' ? firstArg : secondArg) || {}
  };
}

/**
 * Register the live 3D town references from `app.js` and expose global helpers.
 */
export function registerUnityExporterContext(ctx) {
  registeredContext = ctx;
  if (typeof window !== 'undefined') {
    window.__CERRIA_EXPORTER_CTX__ = ctx;
    if (ctx?.scene) {
      window.__CERRIA_SCENE__ = ctx.scene;
    }
  }
  if (ctx) {
    organizeSceneHierarchyForUnity(ctx);
  }
  if (typeof window !== 'undefined') {
    window.exportCerriaTownToGLB = opts => exportCerriaTownToGLB(opts);
    window.exportCerriaSceneMetadata = opts => exportCerriaSceneMetadata(opts);
  }
}

/**
 * Name and structure the live 3D scene groups so they match the Unity Hierarchy
 * specification (`Building_toko1`..`Building_toko7`, `Environment_RoadsAndSidewalks`,
 * `Environment_TreesAndDecor`, `Dynamic_Vehicles`, `Dynamic_NPCs`).
 */
export function organizeSceneHierarchyForUnity(ctx = registeredContext) {
  if (!ctx) return null;
  const {
    scene,
    world,
    stores = [],
    roadsAndSidewalksGroup,
    treesAndDecorGroup,
    vehiclesGroup,
    npcsGroup
  } = ctx;

  if (scene) scene.name = 'CerriaTown_Scene';
  if (world) world.name = 'CerriaTown_Root';

  const buildingGroups = {};
  STORE_IDS.forEach(storeId => {
    const slot = STORE_SLOT[storeId];
    const s = stores[slot];
    if (s?.g) {
      const groupName = `Building_${storeId}`;
      s.g.name = groupName;
      s.g.userData.storeId = storeId;
      s.g.userData.storeNumber = storeNumber(storeId);
      s.g.userData.lotIndex = slot;
      let meshIdx = 0;
      s.g.traverse(child => {
        if (child !== s.g && child.isMesh && !child.name) {
          child.name = `${groupName}_Part_${++meshIdx}`;
        }
      });
      buildingGroups[storeId] = s.g;
    }
    if (s?.ambientGroup) {
      s.ambientGroup.name = `Building_${storeId}_Ambient`;
    }
  });

  if (roadsAndSidewalksGroup) roadsAndSidewalksGroup.name = 'Environment_RoadsAndSidewalks';
  if (treesAndDecorGroup) treesAndDecorGroup.name = 'Environment_TreesAndDecor';
  if (vehiclesGroup) vehiclesGroup.name = 'Dynamic_Vehicles';
  if (npcsGroup) npcsGroup.name = 'Dynamic_NPCs';

  return {
    buildingGroups,
    roadsAndSidewalksGroup,
    treesAndDecorGroup,
    vehiclesGroup,
    npcsGroup
  };
}

/**
 * Ensure `geo` has valid attributes, bake texture repeat/offset into UVs if present,
 * preserve existing smooth vertex normals (or compute flat normals when needed),
 * enforce unit-length normals (`1.0`), and optionally nudge decal/sign planes along
 * their outward normal so they never Z-fight in Unity.
 */
function ensureCleanNormalsAndAttributes(geo, {
  keepVertexColors = false,
  forceFlatNormals = false,
  uvRepeat = null,
  uvOffset = null,
  normalOffsetMeters = 0
} = {}) {
  const allowedAttrs = new Set(['position', 'normal', 'uv']);
  if (keepVertexColors) allowedAttrs.add('color');

  for (const attrName of Object.keys(geo.attributes)) {
    if (!allowedAttrs.has(attrName)) {
      geo.deleteAttribute(attrName);
    }
  }

  // Sanitize UV attribute and bake texture repeat/offset directly into UVs
  const uvAttr = geo.getAttribute('uv');
  if (uvAttr) {
    const arr = uvAttr.array;
    const rx = uvRepeat ? (Number(uvRepeat.x) || 1) : 1;
    const ry = uvRepeat ? (Number(uvRepeat.y) || 1) : 1;
    const ox = uvOffset ? (Number(uvOffset.x) || 0) : 0;
    const oy = uvOffset ? (Number(uvOffset.y) || 0) : 0;
    const bakeTransform =
      Math.abs(rx - 1) > 1e-5 ||
      Math.abs(ry - 1) > 1e-5 ||
      Math.abs(ox) > 1e-5 ||
      Math.abs(oy) > 1e-5;

    for (let i = 0; i < arr.length; i += 2) {
      let u = Number.isFinite(arr[i]) ? arr[i] : 0;
      let v = Number.isFinite(arr[i + 1]) ? arr[i + 1] : 0;
      if (bakeTransform) {
        u = u * rx + ox;
        v = v * ry + oy;
      }
      arr[i] = u;
      arr[i + 1] = v;
    }
    uvAttr.needsUpdate = true;
  }

  // Only recompute vertex normals if missing or if flatShading is explicitly requested;
  // otherwise preserve the smooth normals already transformed by `geo.applyMatrix4()`!
  let normAttr = geo.getAttribute('normal');
  if (!normAttr || forceFlatNormals) {
    if (forceFlatNormals && geo.index) {
      geo = geo.toNonIndexed();
    }
    geo.computeVertexNormals();
    normAttr = geo.getAttribute('normal');
  }

  if (!normAttr) {
    const count = geo.getAttribute('position')?.count || 0;
    const norms = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) norms[i * 3 + 1] = 1;
    normAttr = new THREE.BufferAttribute(norms, 3);
    geo.setAttribute('normal', normAttr);
  } else {
    const arr = normAttr.array;
    for (let i = 0; i < arr.length; i += 3) {
      const nx = arr[i];
      const ny = arr[i + 1];
      const nz = arr[i + 2];
      const len = Math.hypot(nx, ny, nz);
      if (len > 1e-6 && Number.isFinite(len)) {
        arr[i] = nx / len;
        arr[i + 1] = ny / len;
        arr[i + 2] = nz / len;
      } else {
        arr[i] = 0;
        arr[i + 1] = 1;
        arr[i + 2] = 0;
      }
    }
    normAttr.needsUpdate = true;
  }

  // If this mesh used `polygonOffset` in Three.js (store signboards, window art, road markings),
  // nudge vertices slightly along their outward unit normal to prevent Z-fighting in Unity!
  if (normalOffsetMeters > 0) {
    const posAttr = geo.getAttribute('position');
    if (posAttr && normAttr && posAttr.count === normAttr.count) {
      const pArr = posAttr.array;
      const nArr = normAttr.array;
      for (let i = 0; i < pArr.length; i += 3) {
        pArr[i] += nArr[i] * normalOffsetMeters;
        pArr[i + 1] += nArr[i + 1] * normalOffsetMeters;
        pArr[i + 2] += nArr[i + 2] * normalOffsetMeters;
      }
      posAttr.needsUpdate = true;
    }
  }

  // Deduplicate shared vertices into an indexed BufferGeometry (when not flat-shaded)
  // so merged Batch/NPC/Vehicle meshes stay compact without losing any detail.
  if (!geo.index && !forceFlatNormals) {
    try {
      geo = mergeVertices(geo, 1e-4);
    } catch {
      /* keep non-indexed if mergeVertices fails */
    }
  }

  return geo;
}

/**
 * Apply a 4x4 transform matrix directly to `geo`. If `matrix` has a negative
 * determinant (mirrored scale), flip triangle winding so normals face outward.
 */
function applyMatrixToGeometry(srcGeo, matrix) {
  const geo = srcGeo.clone();
  if (matrix) {
    geo.applyMatrix4(matrix);
  }

  if (matrix && matrix.determinant() < 0) {
    if (geo.index) {
      const idxAttr = geo.index.clone();
      const arr = idxAttr.array;
      for (let i = 0; i < arr.length; i += 3) {
        const tmp = arr[i + 1];
        arr[i + 1] = arr[i + 2];
        arr[i + 2] = tmp;
      }
      idxAttr.needsUpdate = true;
      geo.setIndex(idxAttr);
    } else {
      const pos = geo.getAttribute('position');
      const nrm = geo.getAttribute('normal');
      const uv = geo.getAttribute('uv');
      const col = geo.getAttribute('color');
      const swapVerts = (attr, i0, i1) => {
        if (!attr) return;
        const itemSize = attr.itemSize;
        for (let k = 0; k < itemSize; k++) {
          const tmp = attr.array[i0 * itemSize + k];
          attr.array[i0 * itemSize + k] = attr.array[i1 * itemSize + k];
          attr.array[i1 * itemSize + k] = tmp;
        }
      };
      if (pos) {
        for (let i = 0; i < pos.count; i += 3) {
          swapVerts(pos, i + 1, i + 2);
          swapVerts(nrm, i + 1, i + 2);
          swapVerts(uv, i + 1, i + 2);
          swapVerts(col, i + 1, i + 2);
        }
      }
    }
  }
  return geo;
}

/**
 * Bake NPC part-tag vertex colors (`color.r` = part tag, `color.g` = hairstyle variant,
 * `aWardrobe` = palette indices) into standard RGB vertex colors for a specific NPC instance,
 * stripping out unused hairstyle variants so only the active hairstyle is exported.
 */
function bakeNpcGeometryForInstance(baseGeo, wardrobeVec4, transformMatrix = null, geoCache = null) {
  const w0 = Math.abs(Math.round(wardrobeVec4[0])) % SHIRT_PALETTE_HEX.length;
  const w1 = Math.abs(Math.round(wardrobeVec4[1])) % PANTS_PALETTE_HEX.length;
  const w2 = Math.abs(Math.round(wardrobeVec4[2])) % HAIR_PALETTE_HEX.length;
  const w3 = Math.max(0, Math.round(wardrobeVec4[3]));
  const matKey = transformMatrix ? transformMatrix.elements.map(v => Math.round(v * 1000)).join(',') : 'id';
  const cacheKey = `npc|${baseGeo.uuid}|${w0},${w1},${w2},${w3}|${matKey}`;
  if (geoCache && geoCache.has(cacheKey)) {
    return geoCache.get(cacheKey);
  }

  let geo = baseGeo.clone();
  if (geo.index) geo = geo.toNonIndexed();

  const posAttr = geo.getAttribute('position');
  const normAttr = geo.getAttribute('normal');
  const colAttr = geo.getAttribute('color');
  if (!posAttr || !colAttr) {
    if (transformMatrix) geo = applyMatrixToGeometry(geo, transformMatrix);
    const cleaned = ensureCleanNormalsAndAttributes(geo, { keepVertexColors: false });
    if (geoCache) geoCache.set(cacheKey, cleaned);
    return cleaned;
  }

  const shirtHex = SHIRT_PALETTE_HEX[w0];
  const pantsHex = PANTS_PALETTE_HEX[w1];
  const hairHex = HAIR_PALETTE_HEX[w2];
  const skinIdx = w3 % 3;
  const shoeIdx = Math.floor(w3 / 3) % 2;
  const styleIdx = Math.floor(w3 / 6);
  const activeStyleVar = styleIdx + 1;
  const beretHex = SHIRT_PALETTE_HEX[(w0 + 2) % SHIRT_PALETTE_HEX.length];

  const cShirt = new THREE.Color(shirtHex);
  const cPants = new THREE.Color(pantsHex);
  const cHair = new THREE.Color(hairHex);
  const cSkin = new THREE.Color(SKIN_PALETTE_HEX[skinIdx] || '#FFE0BD');
  const cCream = new THREE.Color('#FFF8E7');
  const cShoe = new THREE.Color(shoeIdx === 0 ? '#F5EFE6' : '#8B5A2B');
  const cEye = new THREE.Color('#15151A');
  const cBlush = new THREE.Color('#F08A84');
  const cWhite = new THREE.Color('#FFFFFF');
  const cBeret = new THREE.Color(beretHex);

  const count = posAttr.count;
  const keptPos = [];
  const keptNorm = [];
  const keptCol = [];

  for (let i = 0; i < count; i += 3) {
    const s0 = colAttr.getY(i);
    const s1 = colAttr.getY(i + 1);
    const s2 = colAttr.getY(i + 2);
    if (
      (s0 > 0.5 && Math.abs(s0 - activeStyleVar) > 0.25) ||
      (s1 > 0.5 && Math.abs(s1 - activeStyleVar) > 0.25) ||
      (s2 > 0.5 && Math.abs(s2 - activeStyleVar) > 0.25)
    ) {
      continue;
    }

    for (let k = 0; k < 3; k++) {
      const vi = i + k;
      keptPos.push(posAttr.getX(vi), posAttr.getY(vi), posAttr.getZ(vi));
      if (normAttr) {
        keptNorm.push(normAttr.getX(vi), normAttr.getY(vi), normAttr.getZ(vi));
      }
      const tag = colAttr.getX(vi);
      let c = cShirt;
      if (tag < 0.15) c = cShirt;
      else if (tag < 0.25) c = cPants;
      else if (tag < 0.35) c = cHair;
      else if (tag < 0.45) c = cSkin;
      else if (tag < 0.55) c = cCream;
      else if (tag < 0.65) c = cShoe;
      else if (tag < 0.75) c = cEye;
      else if (tag < 0.85) c = cBlush;
      else if (tag < 0.92) c = cWhite;
      else c = cBeret;
      keptCol.push(c.r, c.g, c.b);
    }
  }

  const filteredGeo = new THREE.BufferGeometry();
  filteredGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(keptPos), 3));
  if (keptNorm.length === keptPos.length) {
    filteredGeo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(keptNorm), 3));
  }
  filteredGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(keptCol), 3));

  let outGeo = filteredGeo;
  if (transformMatrix) {
    outGeo = applyMatrixToGeometry(outGeo, transformMatrix);
  }
  outGeo = ensureCleanNormalsAndAttributes(outGeo, { keepVertexColors: true });
  if (geoCache) geoCache.set(cacheKey, outGeo);
  return outGeo;
}

/**
 * Bake vehicle `aPart` shader tags + instance body color into standard RGB vertex
 * colors and apply `transformMatrix` (if provided).
 */
function bakeVehicleGeometryForInstance(baseGeo, bodyColor, transformMatrix = null, geoCache = null) {
  const paint = bodyColor ? bodyColor.clone() : new THREE.Color('#D86A43');
  const matKey = transformMatrix ? transformMatrix.elements.map(v => Math.round(v * 1000)).join(',') : 'id';
  const cacheKey = `veh|${baseGeo.uuid}|${paint.getHexString()}|${matKey}`;
  if (geoCache && geoCache.has(cacheKey)) {
    return geoCache.get(cacheKey);
  }

  let geo = baseGeo.clone();
  if (geo.index) geo = geo.toNonIndexed();

  const posAttr = geo.getAttribute('position');
  const partAttr = geo.getAttribute('aPart');
  const colAttr = geo.getAttribute('color');
  if (!posAttr) {
    if (transformMatrix) geo = applyMatrixToGeometry(geo, transformMatrix);
    const cleaned = ensureCleanNormalsAndAttributes(geo, { keepVertexColors: false });
    if (geoCache) geoCache.set(cacheKey, cleaned);
    return cleaned;
  }

  const cWindow = new THREE.Color(0.141, 0.188, 0.235);
  const cTire = new THREE.Color(0.12, 0.135, 0.16);
  const cTrim = new THREE.Color(0.065, 0.075, 0.095);
  const cHeadlight = new THREE.Color(1.0, 0.97, 0.88);
  const cTaillight = new THREE.Color(0.95, 0.14, 0.10);
  const cRoof = new THREE.Color(0.95, 0.93, 0.89);
  const cAmber = new THREE.Color(1.0, 0.64, 0.18);

  const count = posAttr.count;
  const outCol = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const part = partAttr ? partAttr.getX(i) : 0;
    let c = paint;
    if (part < 0.5) c = paint;
    else if (part < 1.5) c = cWindow;
    else if (part < 2.5) c = cTire;
    else if (part < 3.5) c = cTrim;
    else if (part < 4.5) c = cHeadlight;
    else if (part < 5.5) c = cTaillight;
    else if (part < 6.5) {
      if (colAttr) {
        outCol[i * 3] = Math.min(1, colAttr.getX(i) * paint.r);
        outCol[i * 3 + 1] = Math.min(1, colAttr.getY(i) * paint.g);
        outCol[i * 3 + 2] = Math.min(1, colAttr.getZ(i) * paint.b);
        continue;
      }
      c = paint;
    } else if (part < 7.5) c = cRoof;
    else if (part < 8.5) c = cAmber;
    else if (colAttr) {
      outCol[i * 3] = Math.min(1, colAttr.getX(i));
      outCol[i * 3 + 1] = Math.min(1, colAttr.getY(i));
      outCol[i * 3 + 2] = Math.min(1, colAttr.getZ(i));
      continue;
    }
    outCol[i * 3] = c.r;
    outCol[i * 3 + 1] = c.g;
    outCol[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(outCol, 3));
  if (transformMatrix) {
    geo = applyMatrixToGeometry(geo, transformMatrix);
  }
  const cleaned = ensureCleanNormalsAndAttributes(geo, { keepVertexColors: true });
  if (geoCache) geoCache.set(cacheKey, cleaned);
  return cleaned;
}

/**
 * Convert any Three.js material (`MeshStandardMaterial`, `MeshBasicMaterial`,
 * `MeshLambertMaterial`, `ShaderMaterial`, or patched custom shader material)
 * into a clean, glTF-2.0 & Unity compliant `THREE.MeshStandardMaterial`.
 */
function toStandardGLTFMaterial(srcMat, materialCache, {
  fallbackName = 'CerriaMat',
  useVertexColors = false,
  tintColor = null
} = {}) {
  const mat = Array.isArray(srcMat) ? srcMat[0] : srcMat;
  const cacheKey = `${mat?.uuid || 'default'}|vc:${useVertexColors ? 1 : 0}|tint:${tintColor ? tintColor.getHexString() : 'none'}`;
  if (materialCache.has(cacheKey)) {
    return materialCache.get(cacheKey);
  }

  const baseCol = new THREE.Color('#ffffff');
  if (useVertexColors) {
    baseCol.set('#ffffff');
  } else if (mat?.color?.isColor) {
    baseCol.copy(mat.color);
  }
  if (tintColor?.isColor && !useVertexColors) {
    baseCol.multiply(tintColor);
  }

  // Clamp HDR colors (e.g. glowMat where color was multiplied > 1.0) into [0, 1]
  // and transfer excess brightness into emissive so glTF 2.0 & Unity Bloom light up!
  const maxChannel = Math.max(baseCol.r, baseCol.g, baseCol.b);
  const emissiveCol = mat?.emissive?.isColor ? mat.emissive.clone() : new THREE.Color('#000000');
  let emissiveIntensity = mat?.emissiveIntensity ?? 1.0;

  if (maxChannel > 1.0) {
    baseCol.multiplyScalar(1.0 / maxChannel);
    emissiveCol.copy(baseCol);
    emissiveIntensity = Math.min(2.5, maxChannel);
  } else if (mat?.isMeshBasicMaterial && !mat.map) {
    emissiveCol.copy(baseCol).multiplyScalar(0.65);
    emissiveIntensity = 1.25;
  }

  // Promote store window interior backdrops (`M.interior` where color is #000 and texture is in emissiveMap)
  // to both `map` and `emissiveMap` so every glTF viewer & Unity shows the illuminated shop window art!
  let colorMap = mat?.map || null;
  let emissiveMap = mat?.emissiveMap || null;
  if (!colorMap && emissiveMap) {
    colorMap = emissiveMap;
    if (baseCol.r < 0.05 && baseCol.g < 0.05 && baseCol.b < 0.05) {
      baseCol.set('#ffffff');
    }
  }

  const isSignOrInterior = Boolean(colorMap && emissiveMap && colorMap === emissiveMap);
  const matName =
    mat?.name ||
    (isSignOrInterior
      ? `${fallbackName}_SignAtlas`
      : emissiveCol.r + emissiveCol.g + emissiveCol.b > 0.25
        ? `${fallbackName}_EmissiveGlow`
        : fallbackName);

  const cleanMat = new THREE.MeshStandardMaterial({
    name: matName,
    color: baseCol,
    map: colorMap,
    emissive: emissiveCol,
    emissiveMap: emissiveMap,
    emissiveIntensity: Math.max(0, Math.min(2.5, emissiveIntensity)),
    roughness: typeof mat?.roughness === 'number' ? Math.max(0.05, Math.min(1.0, mat.roughness)) : 0.78,
    metalness: typeof mat?.metalness === 'number' ? Math.max(0.0, Math.min(1.0, mat.metalness)) : 0.06,
    transparent: Boolean(mat?.transparent && !(mat?.alphaTest > 0)),
    opacity: typeof mat?.opacity === 'number' ? mat.opacity : 1.0,
    alphaTest: typeof mat?.alphaTest === 'number' ? mat.alphaTest : 0.0,
    vertexColors: Boolean(useVertexColors),
    flatShading: Boolean(mat?.flatShading),
    side: THREE.DoubleSide
  });

  materialCache.set(cacheKey, cleanMat);
  return cleanMat;
}

/**
 * Convert every `THREE.CanvasTexture` (or canvas-backed `THREE.Texture`) referenced
 * by `mat.map` or `mat.emissiveMap` in `rootGroup` into a PNG `dataURL`
 * (`canvas.toDataURL('image/png')`) `HTMLImageElement` texture so `GLTFExporter`
 * embeds all store signboards, window art, road markings, and procedural textures!
 */
async function convertAllCanvasTexturesInGroupToPng(rootGroup) {
  const canvasToPngMap = new Map();
  const texToPngMap = new Map();
  const pending = [];

  const registerTex = srcTex => {
    if (!srcTex || !srcTex.isTexture || texToPngMap.has(srcTex)) return;
    const canvas =
      (srcTex.image && typeof srcTex.image.toDataURL === 'function' ? srcTex.image : null) ||
      (srcTex.source?.data && typeof srcTex.source.data.toDataURL === 'function' ? srcTex.source.data : null);
    if (!canvas || !canvas.width || !canvas.height) return;

    const flipY = srcTex.flipY !== false;
    const canvasKey = canvas;
    if (canvasToPngMap.has(canvasKey)) {
      texToPngMap.set(srcTex, canvasToPngMap.get(canvasKey));
      return;
    }

    const promise = (async () => {
      const dataUrl = canvas.toDataURL('image/png');
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = err => reject(err);
        img.src = dataUrl;
      });
      img.width = canvas.width;
      img.height = canvas.height;

      const pngTex = new THREE.Texture(img);
      pngTex.name = srcTex.name || `CerriaPngTex_${canvasToPngMap.size + 1}`;
      pngTex.colorSpace = srcTex.colorSpace || THREE.SRGBColorSpace;
      pngTex.flipY = flipY;
      pngTex.wrapS = THREE.RepeatWrapping;
      pngTex.wrapT = THREE.RepeatWrapping;
      pngTex.magFilter = THREE.LinearFilter;
      pngTex.minFilter = THREE.LinearMipmapLinearFilter;
      pngTex.repeat.set(1, 1);
      pngTex.offset.set(0, 0);
      pngTex.userData = { mimeType: 'image/png', dataUrlLength: dataUrl.length };
      pngTex.needsUpdate = true;

      canvasToPngMap.set(canvasKey, pngTex);
      texToPngMap.set(srcTex, pngTex);
    })();

    canvasToPngMap.set(canvasKey, null);
    texToPngMap.set(srcTex, null);
    pending.push(promise);
  };

  rootGroup.traverse(node => {
    if (!node.isMesh || !node.material) return;
    const mats = Array.isArray(node.material) ? node.material : [node.material];
    for (const m of mats) {
      if (m.map) registerTex(m.map);
      if (m.emissiveMap) registerTex(m.emissiveMap);
    }
  });

  await Promise.all(pending);

  let replacedCount = 0;
  rootGroup.traverse(node => {
    if (!node.isMesh || !node.material) return;
    const mats = Array.isArray(node.material) ? node.material : [node.material];
    for (const m of mats) {
      if (m.map) {
        const png = texToPngMap.get(m.map) || canvasToPngMap.get(m.map.image);
        if (png) {
          m.map = png;
          replacedCount++;
        }
      }
      if (m.emissiveMap) {
        const png = texToPngMap.get(m.emissiveMap) || canvasToPngMap.get(m.emissiveMap.image);
        if (png) {
          m.emissiveMap = png;
        }
      }
      m.needsUpdate = true;
    }
  });

  return {
    uniquePngTextures: canvasToPngMap.size,
    replacedMaterialMaps: replacedCount,
    disposeAll() {
      canvasToPngMap.forEach(t => t?.dispose?.());
    }
  };
}

/**
 * Return true if `node` and all of its ancestors up to the scene root have `visible !== false`.
 */
function isVisibleInHierarchy(node) {
  let cur = node;
  while (cur) {
    if (cur.visible === false) return false;
    cur = cur.parent;
  }
  return true;
}

/**
 * Determine which top-level Unity Hierarchy group (`Building_toko1`..`Building_toko7`,
 * `Environment_RoadsAndSidewalks`, `Environment_TreesAndDecor`, `Dynamic_Vehicles`,
 * `Dynamic_NPCs`) owns `node`.
 */
function resolveTargetGroupName(node) {
  let cur = node;
  while (cur) {
    const name = cur.name || '';
    if (/^Building_toko[1-7]_Ambient$/i.test(name)) {
      return name.replace(/_Ambient$/i, '');
    }
    if (/^Building_toko[1-7]$/i.test(name)) {
      return name;
    }
    if (cur.userData?.storeId && /^toko[1-7]$/.test(cur.userData.storeId)) {
      return `Building_${cur.userData.storeId}`;
    }
    if (
      name === 'Environment_RoadsAndSidewalks' ||
      name === 'Environment_TreesAndDecor' ||
      name === 'Dynamic_Vehicles' ||
      name === 'Dynamic_NPCs'
    ) {
      return name;
    }
    cur = cur.parent;
  }
  return 'Environment_TreesAndDecor';
}

/**
 * Assemble all dynamic vehicles (`Vehicles_Sedans_Body/Glass`, `Vehicles_SUVs_Body/Glass`,
 * `Vehicles_Vans_Body/Glass`, `Vehicles_Wheels`, `Vehicles_Cyclists`) into clean per-vehicle
 * hierarchy nodes inside `Dynamic_Vehicles` with local `(0,0,0)` pivots and world transforms.
 */
function exportAssembledDynamicVehicles(vehiclesSourceGroup, targetVehiclesGroup, materialCache, geoCache = new Map()) {
  if (!vehiclesSourceGroup) return 0;

  const byName = new Map();
  vehiclesSourceGroup.traverse(n => {
    if (n.isInstancedMesh && n.name) {
      byName.set(n.name, n);
    }
  });

  const sedansBody = byName.get('Vehicles_Sedans_Body');
  const sedansGlass = byName.get('Vehicles_Sedans_Glass');
  const suvsBody = byName.get('Vehicles_SUVs_Body');
  const suvsGlass = byName.get('Vehicles_SUVs_Glass');
  const vansBody = byName.get('Vehicles_Vans_Body');
  const vansGlass = byName.get('Vehicles_Vans_Glass');
  const wheelsMesh = byName.get('Vehicles_Wheels');
  const cyclistsMesh = byName.get('Vehicles_Cyclists');

  const instMatrix = new THREE.Matrix4();
  const worldMatrix = new THREE.Matrix4();
  const invVehicleWorld = new THREE.Matrix4();
  const wheelWorld = new THREE.Matrix4();
  const wheelLocal = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scl = new THREE.Vector3();
  const wPos = new THREE.Vector3();
  const wQuat = new THREE.Quaternion();
  const wScl = new THREE.Vector3();
  const scaleOnlyMat = new THREE.Matrix4();
  const instCol = new THREE.Color('#ffffff');

  let exportedMeshCount = 0;
  let motorVehicleGlobalIdx = 0;

  const motorBatches = [
    { prefix: 'Vehicle_Sedan', bodyMesh: sedansBody, glassMesh: sedansGlass },
    { prefix: 'Vehicle_SUV', bodyMesh: suvsBody, glassMesh: suvsGlass },
    { prefix: 'Vehicle_Van', bodyMesh: vansBody, glassMesh: vansGlass }
  ];

  for (const { prefix, bodyMesh, glassMesh } of motorBatches) {
    if (!bodyMesh) continue;
    const count = bodyMesh.count || 0;
    for (let i = 0; i < count; i++) {
      const mIdx = motorVehicleGlobalIdx++;
      bodyMesh.getMatrixAt(i, instMatrix);
      worldMatrix.multiplyMatrices(bodyMesh.matrixWorld, instMatrix);
      worldMatrix.decompose(pos, quat, scl);
      if (scl.lengthSq() < 0.0001 || pos.y < -10 || !Number.isFinite(pos.x)) continue;

      if (bodyMesh.instanceColor) bodyMesh.getColorAt(i, instCol);
      else instCol.set('#D86A43');

      const vehGroup = new THREE.Group();
      vehGroup.name = `${prefix}_${String(i + 1).padStart(2, '0')}`;
      vehGroup.position.copy(pos);
      vehGroup.quaternion.copy(quat);
      vehGroup.scale.set(1, 1, 1);
      vehGroup.updateMatrixWorld(true);

      scaleOnlyMat.makeScale(scl.x, scl.y, scl.z);
      const bodyGeo = bakeVehicleGeometryForInstance(bodyMesh.geometry, instCol, scaleOnlyMat, geoCache);
      const bodyMat = toStandardGLTFMaterial(bodyMesh.material, materialCache, {
        fallbackName: `${prefix}_BodyMat`,
        useVertexColors: true
      });
      const bMesh = new THREE.Mesh(bodyGeo, bodyMat);
      bMesh.name = 'Body';
      bMesh.castShadow = true;
      bMesh.receiveShadow = true;
      vehGroup.add(bMesh);
      exportedMeshCount++;

      if (glassMesh && i < (glassMesh.count || 0)) {
        const glassKey = `glass|${glassMesh.geometry.uuid}|${Math.round(scl.x * 1000)},${Math.round(scl.y * 1000)},${Math.round(scl.z * 1000)}`;
        let glassGeo = geoCache.get(glassKey);
        if (!glassGeo) {
          glassGeo = ensureCleanNormalsAndAttributes(
            applyMatrixToGeometry(glassMesh.geometry, scaleOnlyMat),
            { keepVertexColors: false }
          );
          geoCache.set(glassKey, glassGeo);
        }
        const glassMat = toStandardGLTFMaterial(glassMesh.material, materialCache, {
          fallbackName: `${prefix}_GlassMat`,
          useVertexColors: false
        });
        const gMesh = new THREE.Mesh(glassGeo, glassMat);
        gMesh.name = 'CabinGlass';
        gMesh.castShadow = true;
        gMesh.receiveShadow = true;
        vehGroup.add(gMesh);
        exportedMeshCount++;
      }

      if (wheelsMesh && (mIdx * 4 + 3) < (wheelsMesh.count || 0)) {
        invVehicleWorld.copy(vehGroup.matrixWorld).invert();
        const wheelNames = ['Wheel_FL', 'Wheel_FR', 'Wheel_RL', 'Wheel_RR'];
        for (let w = 0; w < 4; w++) {
          const wInstIdx = mIdx * 4 + w;
          wheelsMesh.getMatrixAt(wInstIdx, instMatrix);
          wheelWorld.multiplyMatrices(wheelsMesh.matrixWorld, instMatrix);
          wheelLocal.multiplyMatrices(invVehicleWorld, wheelWorld);
          wheelLocal.decompose(wPos, wQuat, wScl);

          const wScaleMat = new THREE.Matrix4().makeScale(wScl.x, wScl.y, wScl.z);
          const wGeo = bakeVehicleGeometryForInstance(
            wheelsMesh.geometry,
            new THREE.Color('#ffffff'),
            wScaleMat,
            geoCache
          );
          const wMat = toStandardGLTFMaterial(wheelsMesh.material, materialCache, {
            fallbackName: 'Vehicle_WheelMat',
            useVertexColors: true
          });
          const wMesh = new THREE.Mesh(wGeo, wMat);
          wMesh.name = wheelNames[w];
          wMesh.position.copy(wPos);
          wMesh.quaternion.copy(wQuat);
          wMesh.castShadow = true;
          wMesh.receiveShadow = true;
          vehGroup.add(wMesh);
          exportedMeshCount++;
        }
      }

      targetVehiclesGroup.add(vehGroup);
    }
  }

  // Export cyclists (`Vehicles_Cyclists`)
  if (cyclistsMesh) {
    const count = cyclistsMesh.count || 0;
    for (let i = 0; i < count; i++) {
      cyclistsMesh.getMatrixAt(i, instMatrix);
      worldMatrix.multiplyMatrices(cyclistsMesh.matrixWorld, instMatrix);
      worldMatrix.decompose(pos, quat, scl);
      if (scl.lengthSq() < 0.0001 || pos.y < -10 || !Number.isFinite(pos.x)) continue;

      if (cyclistsMesh.instanceColor) cyclistsMesh.getColorAt(i, instCol);
      else instCol.set('#FF7F50');

      scaleOnlyMat.makeScale(scl.x, scl.y, scl.z);
      const cycGeo = bakeVehicleGeometryForInstance(cyclistsMesh.geometry, instCol, scaleOnlyMat, geoCache);
      const cycMat = toStandardGLTFMaterial(cyclistsMesh.material, materialCache, {
        fallbackName: 'Vehicle_CyclistMat',
        useVertexColors: true
      });
      const cycMesh = new THREE.Mesh(cycGeo, cycMat);
      cycMesh.name = `Vehicle_Cyclist_${String(i + 1).padStart(2, '0')}`;
      cycMesh.position.copy(pos);
      cycMesh.quaternion.copy(quat);
      cycMesh.castShadow = true;
      cycMesh.receiveShadow = true;
      targetVehiclesGroup.add(cycMesh);
      exportedMeshCount++;
    }
  }

  return exportedMeshCount;
}

/**
 * Expand a `THREE.InstancedMesh` into individual `THREE.Mesh` objects inside
 * `targetGroup`. When `keepLocalPivot = true` (used for `Dynamic_NPCs`), each mesh
 * keeps its geometry centered around `(0,0,0)` and stores its world pose on `mesh.position`/`quaternion`.
 */
function bakeInstancedMeshIntoGroup(instMesh, targetGroup, materialCache, {
  maxInstances = 320,
  keepLocalPivot = false,
  geoCache = new Map()
} = {}) {
  if (!instMesh || !instMesh.isInstancedMesh || !instMesh.geometry) return 0;
  const count = Math.min(instMesh.count || 0, maxInstances);
  const instMatrix = new THREE.Matrix4();
  const worldMatrix = new THREE.Matrix4();
  const invTargetGroupWorld = new THREE.Matrix4();
  targetGroup.updateMatrixWorld(true);
  invTargetGroupWorld.copy(targetGroup.matrixWorld).invert();
  const relMatrix = new THREE.Matrix4();

  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scl = new THREE.Vector3();
  const scaleMat = new THREE.Matrix4();
  const instCol = new THREE.Color('#ffffff');

  const baseName = instMesh.name || 'InstancedMesh';
  const hasWardrobe = Boolean(instMesh.geometry.getAttribute('aWardrobe'));
  const hasVehiclePart = Boolean(instMesh.geometry.getAttribute('aPart'));
  const wardrobeAttr = instMesh.geometry.getAttribute('aWardrobe');

  let bakedCount = 0;
  for (let i = 0; i < count; i++) {
    instMesh.getMatrixAt(i, instMatrix);
    worldMatrix.multiplyMatrices(instMesh.matrixWorld, instMatrix);
    relMatrix.multiplyMatrices(invTargetGroupWorld, worldMatrix);
    relMatrix.decompose(pos, quat, scl);

    // Skip hidden/collapsed instances (e.g. NPC inside store with scale 0 or parked below y = -10)
    if (scl.lengthSq() < 0.0001 || pos.y < -10 || !Number.isFinite(pos.x)) continue;

    if (instMesh.instanceColor) {
      instMesh.getColorAt(i, instCol);
    } else {
      instCol.set('#ffffff');
    }

    const canUseNodeTransform = keepLocalPivot || (scl.x > 0 && scl.y > 0 && scl.z > 0);
    const geomMatrix = canUseNodeTransform
      ? scaleMat.makeScale(scl.x, scl.y, scl.z)
      : relMatrix;

    let geo;
    let useVertexColors = false;
    let tintColor = null;

    if (hasWardrobe && wardrobeAttr) {
      const w = [
        wardrobeAttr.getX(i),
        wardrobeAttr.getY(i),
        wardrobeAttr.getZ(i),
        wardrobeAttr.getW(i)
      ];
      geo = bakeNpcGeometryForInstance(instMesh.geometry, w, geomMatrix, geoCache);
      useVertexColors = true;
    } else if (hasVehiclePart) {
      geo = bakeVehicleGeometryForInstance(instMesh.geometry, instCol, geomMatrix, geoCache);
      useVertexColors = true;
    } else {
      const keepVC = Boolean(instMesh.geometry.getAttribute('color') && instMesh.material?.vertexColors);
      const flatFlag = Boolean(instMesh.material?.flatShading);
      const scaleKey = canUseNodeTransform
        ? `${Math.round(scl.x * 1000)},${Math.round(scl.y * 1000)},${Math.round(scl.z * 1000)}`
        : `full_${i}`;
      const instGeoKey = `inst|${instMesh.geometry.uuid}|vc:${keepVC ? 1 : 0}|fl:${flatFlag ? 1 : 0}|${scaleKey}`;
      geo = canUseNodeTransform ? geoCache.get(instGeoKey) : null;
      if (!geo) {
        geo = applyMatrixToGeometry(instMesh.geometry, geomMatrix);
        geo = ensureCleanNormalsAndAttributes(geo, {
          keepVertexColors: keepVC,
          forceFlatNormals: flatFlag
        });
        if (canUseNodeTransform) geoCache.set(instGeoKey, geo);
      }
      useVertexColors = keepVC;
      if (instMesh.instanceColor) {
        tintColor = instCol;
      }
    }

    const cleanMat = toStandardGLTFMaterial(instMesh.material, materialCache, {
      fallbackName: `${baseName}_Mat`,
      useVertexColors,
      tintColor
    });

    const mesh = new THREE.Mesh(geo, cleanMat);
    mesh.name = `${baseName}_${String(i + 1).padStart(2, '0')}`;
    if (canUseNodeTransform) {
      mesh.position.copy(pos);
      mesh.quaternion.copy(quat);
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    targetGroup.add(mesh);
    bakedCount++;
  }

  return bakedCount;
}

/**
 * Build the complete `cerria-scene-metadata.json` payload containing exact
 * positions, rotations, bounding boxes, camera targets/offsets, and lights
 * for `toko1` s/d `toko7`.
 */
export function buildCerriaSceneMetadata(ctx = registeredContext) {
  const activeCtx = ctx || registeredContext || {};
  const {
    stores = [],
    focusAt,
    slotAngle,
    A = 8.2,
    PITCH = 16.4,
    BLOCK = 11,
    RING = 8.2 * Math.SQRT2,
    TOWN = [16.4, 16.4],
    LINES = [],
    LANES = [],
    skyStops = []
  } = activeCtx;
  const sidewalkLoops = activeCtx.sidewalkLoops || activeCtx.SIDEWALK_WAYPOINT_LOOPS || {};

  const box = new THREE.Box3();
  const boxCenter = new THREE.Vector3();
  const boxSize = new THREE.Vector3();
  const worldLightPos = new THREE.Vector3();

  const storesMeta = STORE_IDS.map((storeId, idx) => {
    const slot = STORE_SLOT[storeId];
    const s = stores[slot];
    const card = BUILDINGS_DATA[slot] || {};
    const g = s?.g;

    if (g) {
      g.updateMatrixWorld(true);
      box.setFromObject(g);
      box.getCenter(boxCenter);
      box.getSize(boxSize);
    } else {
      box.makeEmpty();
      boxCenter.set(0, 0, 0);
      boxSize.set(0, 0, 0);
    }

    const pos = g ? g.position : new THREE.Vector3();
    const rot = g ? g.rotation : new THREE.Euler();
    const focus = typeof focusAt === 'function' ? focusAt(slot, false) : {
      fx: pos.x,
      fy: 3.25,
      fz: pos.z,
      yaw: 0,
      pitch: 0.56,
      dist: 25.2
    };

    const cosP = Math.cos(focus.pitch);
    const sinP = Math.sin(focus.pitch);
    const camPos = {
      x: round4(focus.fx + Math.sin(focus.yaw) * cosP * focus.dist),
      y: round4(focus.fy + sinP * focus.dist),
      z: round4(focus.fz + Math.cos(focus.yaw) * cosP * focus.dist)
    };
    const camTarget = {
      x: round4(focus.fx),
      y: round4(focus.fy),
      z: round4(focus.fz)
    };
    const camOffsetFromBuilding = {
      x: round4(camPos.x - pos.x),
      y: round4(camPos.y - pos.y),
      z: round4(camPos.z - pos.z)
    };
    const camOffsetFromTarget = {
      x: round4(camPos.x - camTarget.x),
      y: round4(camPos.y - camTarget.y),
      z: round4(camPos.z - camTarget.z)
    };

    const lights = (s?.lights || []).map(([localVec, hexColor, radius = 3.5, intensity = 1.0], lIdx) => {
      if (g && localVec?.isVector3) {
        worldLightPos.copy(localVec).applyMatrix4(g.matrixWorld);
      } else {
        worldLightPos.set(pos.x, pos.y + 2.5, pos.z);
      }
      return {
        name: `Light_${storeId}_${lIdx + 1}`,
        color: typeof hexColor === 'number' ? '#' + hexColor.toString(16).padStart(6, '0') : String(hexColor || '#FFE4B5'),
        radius: round4(radius),
        intensity: round4(intensity),
        localPosition: localVec ? vec3Obj(localVec) : { x: 0, y: 2.5, z: 0 },
        worldPosition: vec3Obj(worldLightPos)
      };
    });

    const loopNodesLocal = sidewalkLoops[s?.style] || sidewalkLoops.gable || [];
    const loopNodesWorld = loopNodesLocal.map(([lx, lz]) => {
      const v = new THREE.Vector3(lx, 0.18, lz);
      if (g) v.applyMatrix4(g.matrixWorld);
      return vec3Obj(v);
    });

    return {
      id: storeId,
      hierarchyName: `Building_${storeId}`,
      storeNumber: idx + 1,
      lotIndex: slot,
      style: s?.style || card.style || 'gable',
      title: card.title || storeId,
      sign: card.sign || storeId,
      subtitle: card.subtitle || '',
      badge: card.badge || '',
      accentColor: card.color || '#C87D72',
      wallColor: card.wall || '#FAF3EB',
      slotAngleRad: round4(typeof slotAngle === 'function' ? slotAngle(s?.slot ?? slot) : 0),
      position: vec3Obj(pos),
      rotation: {
        x: round4(rot.x),
        y: round4(rot.y),
        z: round4(rot.z),
        yDegrees: round4(THREE.MathUtils.radToDeg(rot.y))
      },
      boundingBox: {
        min: vec3Obj(box.min),
        max: vec3Obj(box.max),
        center: vec3Obj(boxCenter),
        size: vec3Obj(boxSize)
      },
      cameraTarget: camTarget,
      cameraPosition: camPos,
      cameraOffset: camOffsetFromBuilding,
      cameraOffsetFromTarget: camOffsetFromTarget,
      cameraSpherical: {
        yawRad: round4(focus.yaw),
        yawDegrees: round4(THREE.MathUtils.radToDeg(focus.yaw)),
        pitchRad: round4(focus.pitch),
        pitchDegrees: round4(THREE.MathUtils.radToDeg(focus.pitch)),
        distance: round4(focus.dist)
      },
      labelAnchor: s?.label ? vec3Obj(s.label) : { x: round4(pos.x), y: round4(box.max.y + 0.95), z: round4(pos.z) },
      lights,
      sidewalkWaypointsLocal: loopNodesLocal.map(([lx, lz]) => ({ x: round4(lx), y: 0.18, z: round4(lz) })),
      sidewalkWaypointsWorld: loopNodesWorld
    };
  });

  return {
    schemaVersion: 1,
    project: 'Cerria Town — Unity 3D Migration Metadata',
    exportedAt: new Date().toISOString(),
    hierarchyGroups: [
      ...STORE_IDS.map(id => `Building_${id}`),
      'Environment_RoadsAndSidewalks',
      'Environment_TreesAndDecor',
      'Dynamic_Vehicles',
      'Dynamic_NPCs'
    ],
    townConstants: {
      A: round4(A),
      PITCH: round4(PITCH),
      BLOCK: round4(BLOCK),
      RING: round4(RING),
      TOWN_CENTER: { x: round4(TOWN[0]), y: 0, z: round4(TOWN[1]) },
      ROAD_WIDTH: round4(PITCH - BLOCK),
      GRID_LINES: LINES.map(round4),
      TRAFFIC_LANES: LANES.map(round4)
    },
    cameraDefaults: {
      desktopFov: 28,
      shortLandscapeFov: 34,
      portraitFovMin: 38,
      portraitFovMax: 52,
      portraitDistanceMultiplierRange: [1.25, 1.35],
      defaultPitchRad: 0.62,
      minPitchRad: 0.24,
      maxPitchRad: 0.82,
      defaultDistance: 25.2,
      minDistance: 14.0,
      maxDistance: 36.0,
      focusDampingLambda: 7.0,
      orbitDampingLambda: 8.0,
      overviewPose: {
        target: { x: round4(TOWN[0]), y: 1.8, z: round4(TOWN[1]) },
        yawRad: 0.78,
        pitchRad: 0.68,
        distance: round4(25.2 * 2.22)
      }
    },
    daylightKeyframes: skyStops.map(([hour, skyHex, hemiHex, sunHex, hemiIntensity, sunIntensity, nightFactor]) => ({
      hour,
      skyColor: skyHex,
      hemiSkyColor: hemiHex,
      sunColor: sunHex,
      hemiIntensity,
      sunIntensity,
      nightFactor
    })),
    stores: storesMeta
  };
}

/**
 * Download `cerria-scene-metadata.json` containing the exact coordinates,
 * camera targets/offsets, and light positions of `toko1` s/d `toko7`.
 */
export function exportCerriaSceneMetadata(firstArg, secondArg) {
  const { ctx, options } = resolveContextAndOptions(firstArg, secondArg);
  const { download = true, filename = 'cerria-scene-metadata.json' } = options;
  const metadata = buildCerriaSceneMetadata(ctx);
  if (download && typeof document !== 'undefined') {
    const jsonBlob = new Blob([JSON.stringify(metadata, null, 2) + '\n'], {
      type: 'application/json;charset=utf-8'
    });
    triggerBlobDownload(jsonBlob, filename);
  }
  return metadata;
}

/**
 * Export the entire Cerria Town 3D scene from `window.__CERRIA_SCENE__` to
 * `cerria-town-exact.glb` (`binary: true`, `onlyVisible: true`) with all
 * `CanvasTexture` signboards embedded as PNG images.
 */
export async function exportCerriaTownToGLB(firstArg, secondArg) {
  const { ctx, options } = resolveContextAndOptions(firstArg, secondArg);
  const {
    download = true,
    includeMetadata = true,
    postToServer = false,
    glbFilename = 'cerria-town-exact.glb',
    metadataFilename = 'cerria-scene-metadata.json',
    onStatus = null
  } = options;

  const liveScene =
    (typeof window !== 'undefined' && window.__CERRIA_SCENE__?.isScene ? window.__CERRIA_SCENE__ : null) ||
    ctx?.scene;

  if (!liveScene) {
    throw new Error('[unity-exporter] window.__CERRIA_SCENE__ belum siap.');
  }
  if (exportInProgress) {
    return { ok: false, reason: 'already_in_progress' };
  }
  exportInProgress = true;

  const notify = msg => {
    try {
      onStatus?.(msg);
      ctx?.showHint?.(msg);
    } catch {
      /* ignore UI callback errors */
    }
  };

  try {
    notify('📦 Menyiapkan & mengekspor 1:1 Cerria Town ke Unity (.GLB)…');

    if (typeof document !== 'undefined' && document.fonts?.ready) {
      try {
        await Promise.race([
          document.fonts.ready,
          new Promise(resolve => setTimeout(resolve, 1500))
        ]);
      } catch {
        /* ignore font timeout */
      }
    }

    // 1. Ensure live scene groups have canonical Unity Hierarchy names
    organizeSceneHierarchyForUnity(ctx);

    // 2. Force all 7 building texture atlases to redraw at full 1x (2048×1536) resolution
    const stores = ctx?.stores || [];
    const prevAtlasScales = stores.map(s => s?.atlas?.scale ?? 1);
    stores.forEach(s => {
      if (s?.atlas?.setScale) {
        s.atlas.setScale(0.5);
        s.atlas.setScale(1);
      }
    });

    // Update all world matrices across `window.__CERRIA_SCENE__`
    liveScene.updateMatrixWorld(true);

    // 3. Create dedicated `exportGroup` and organized Unity Hierarchy sub-groups
    const exportGroup = new THREE.Group();
    exportGroup.name = 'CerriaTown_Root';

    const groupMap = new Map();
    const invGroupMatrixMap = new Map();

    // Position `Building_toko1`..`Building_toko7` at their exact building root transforms
    STORE_IDS.forEach(storeId => {
      const gName = `Building_${storeId}`;
      const slot = STORE_SLOT[storeId];
      const s = stores[slot];
      const grp = new THREE.Group();
      grp.name = gName;
      if (s?.g) {
        grp.position.copy(s.g.position);
        grp.quaternion.copy(s.g.quaternion);
        grp.scale.set(1, 1, 1);
      }
      exportGroup.add(grp);
      grp.updateMatrixWorld(true);
      groupMap.set(gName, grp);
      invGroupMatrixMap.set(gName, grp.matrixWorld.clone().invert());
    });

    for (const gName of [
      'Environment_RoadsAndSidewalks',
      'Environment_TreesAndDecor',
      'Dynamic_Vehicles',
      'Dynamic_NPCs'
    ]) {
      const grp = new THREE.Group();
      grp.name = gName;
      exportGroup.add(grp);
      grp.updateMatrixWorld(true);
      groupMap.set(gName, grp);
      invGroupMatrixMap.set(gName, new THREE.Matrix4());
    }

    const linksSet = new Set(ctx?.links || []);
    const stageBaseSet = new Set(stores.map(s => s?.stageBaseGroup).filter(Boolean));
    const materialCache = new Map();
    const geoCache = new Map();
    const meshBox = new THREE.Box3();
    const meshSize = new THREE.Vector3();
    const relMatrix = new THREE.Matrix4();

    let exportedMeshCount = 0;
    let skippedGiantSlabMat = null;

    // 4. Assemble `Dynamic_Vehicles` (Sedans, SUVs, Vans + 4 Wheels + Cyclists) with local pivots
    if (ctx?.vehiclesGroup) {
      exportedMeshCount += exportAssembledDynamicVehicles(
        ctx.vehiclesGroup,
        groupMap.get('Dynamic_Vehicles'),
        materialCache,
        geoCache
      );
    }

    // 5. Traverse `window.__CERRIA_SCENE__` and copy all valid visible Meshes & InstancedMeshes
    liveScene.traverse(node => {
      if (!node || (!node.isMesh && !node.isInstancedMesh)) return;
      if (!node.geometry || !node.material) return;

      // Skip any invisible mesh or mesh inside a hidden group (such as `occluder` hitboxes & `stageBaseGroup`)
      if (!isVisibleInHierarchy(node)) return;

      // Explicitly skip raycast hitboxes, stage bases, sky domes, and additive light-beam/shadow-blob planes
      if (linksSet.has(node) || node.userData?.store !== undefined) return;
      let anc = node;
      while (anc) {
        if (stageBaseSet.has(anc)) return;
        anc = anc.parent;
      }

      const nodeName = node.name || '';
      if (
        /sky|dome|hitbox|occluder|HeadlightBeams|LightTrails|ShadowBlobs/i.test(nodeName)
      ) {
        return;
      }

      const groupName = resolveTargetGroupName(node);
      // Dynamic_Vehicles was already assembled with per-vehicle Body + Glass + 4 Wheels above
      if (groupName === 'Dynamic_Vehicles') return;

      const targetSubGroup = groupMap.get(groupName) || groupMap.get('Environment_TreesAndDecor');
      const invGrpMat = invGroupMatrixMap.get(groupName) || new THREE.Matrix4();

      // 5A. Bake `THREE.InstancedMesh` (trees, NPCs, crosswalk pedestrians, bus shelter glass, traffic light lenses)
      if (node.isInstancedMesh) {
        const isDynamicNpc = groupName === 'Dynamic_NPCs';
        const holder = isDynamicNpc ? targetSubGroup : new THREE.Group();
        if (!isDynamicNpc) {
          holder.name = nodeName || `Instanced_${exportedMeshCount + 1}`;
        }
        const count = bakeInstancedMeshIntoGroup(node, holder, materialCache, {
          keepLocalPivot: isDynamicNpc,
          geoCache
        });
        if (count > 0) {
          if (!isDynamicNpc) targetSubGroup.add(holder);
          exportedMeshCount += count;
        }
        return;
      }

      // 5B. Standard `THREE.Mesh`: check bounding box to filter out giant floor slabs (> 300 units)
      meshBox.setFromObject(node);
      if (!meshBox.isEmpty()) {
        meshBox.getSize(meshSize);
        const horizSpan = Math.hypot(meshSize.x, meshSize.z);
        if (
          meshSize.x > MAX_MESH_SPAN_UNITS ||
          meshSize.y > MAX_MESH_SPAN_UNITS ||
          meshSize.z > MAX_MESH_SPAN_UNITS ||
          horizSpan > MAX_MESH_SPAN_UNITS
        ) {
          if (!skippedGiantSlabMat && node.material) {
            skippedGiantSlabMat = node.material;
          }
          return;
        }
      }

      const srcMat = Array.isArray(node.material) ? node.material[0] : node.material;
      const srcTex = srcMat?.map || srcMat?.emissiveMap || null;

      relMatrix.multiplyMatrices(invGrpMat, node.matrixWorld);
      let geo = applyMatrixToGeometry(node.geometry, relMatrix);
      const keepVC = Boolean(geo.getAttribute('color') && srcMat?.vertexColors);
      const normalOffsetMeters = srcMat?.polygonOffset ? 0.0035 : 0;

      geo = ensureCleanNormalsAndAttributes(geo, {
        keepVertexColors: keepVC,
        forceFlatNormals: Boolean(srcMat?.flatShading),
        uvRepeat: srcTex?.repeat || null,
        uvOffset: srcTex?.offset || null,
        normalOffsetMeters
      });

      const cleanMat = toStandardGLTFMaterial(srcMat, materialCache, {
        fallbackName: `${groupName}_Mat`,
        useVertexColors: keepVC
      });

      const clonedMesh = new THREE.Mesh(geo, cleanMat);
      clonedMesh.name = nodeName || `${groupName}_Mesh_${++exportedMeshCount}`;
      clonedMesh.castShadow = Boolean(node.castShadow);
      clonedMesh.receiveShadow = Boolean(node.receiveShadow);
      targetSubGroup.add(clonedMesh);
      exportedMeshCount++;
    });

    // 6. Add a compact, cozy town ground base (148u x 0.40u x 148u, diagonal ~209u < 300u)
    //    replacing the skipped 236x236 slab so the entire road grid sits on solid green grass!
    const PITCH = ctx?.PITCH || 16.4;
    const groundGeo = new THREE.BoxGeometry(148, 0.40, 148).toNonIndexed();
    groundGeo.translate(PITCH, -0.20, PITCH);
    ensureCleanNormalsAndAttributes(groundGeo, {
      keepVertexColors: false,
      uvRepeat: { x: 16, y: 16 }
    });
    const groundMat = toStandardGLTFMaterial(
      skippedGiantSlabMat || new THREE.MeshStandardMaterial({ color: '#7da068', roughness: 0.94 }),
      materialCache,
      { fallbackName: 'Town_Ground_Base_Mat', useVertexColors: false }
    );
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.name = 'Environment_TownGroundBase';
    groundMesh.receiveShadow = true;
    groupMap.get('Environment_RoadsAndSidewalks')?.add(groundMesh);
    exportedMeshCount++;

    // 7. Convert ALL `THREE.CanvasTexture` instances (`map` and `emissiveMap`) across `exportGroup`
    //    into loaded PNG `dataURL` `HTMLImageElement` textures so `GLTFExporter` embeds every
    //    store signboard ("COZY BITES & SIPS", "GLOW STUDIO", etc.) into the `.glb` binary!
    const pngStats = await convertAllCanvasTexturesInGroupToPng(exportGroup);

    // 8. Prune any empty child groups so Khronos glTF Validator never emits `NODE_EMPTY` notes
    const groupMeshCounts = {};
    for (let i = exportGroup.children.length - 1; i >= 0; i--) {
      const grp = exportGroup.children[i];
      let countInGrp = 0;
      grp.traverse(c => {
        if (c.isMesh) countInGrp++;
      });
      if (!grp.isMesh && countInGrp === 0) {
        exportGroup.remove(grp);
      } else {
        groupMeshCounts[grp.name] = countInGrp;
      }
    }

    exportGroup.updateMatrixWorld(true);

    // 9. Export `exportGroup` to binary `.GLB` with `onlyVisible: true`
    const exporter = new GLTFExporter();
    const glbBuffer = await exporter.parseAsync(exportGroup, {
      binary: true,
      onlyVisible: true,
      maxTextureSize: 2048
    });

    // Free temporary cloned geometries, materials & temporary PNG textures
    exportGroup.traverse(c => {
      if (c.isMesh && c.geometry) {
        c.geometry.dispose();
      }
    });
    materialCache.forEach(m => m.dispose());
    pngStats.disposeAll();

    // Restore original atlas scales for non-selected buildings
    stores.forEach((s, idx) => s?.atlas?.setScale?.(prevAtlasScales[idx] ?? 0.5));

    if (!(glbBuffer instanceof ArrayBuffer) || glbBuffer.byteLength < 1024) {
      throw new Error(`GLTFExporter menghasilkan buffer terlalu kecil (${glbBuffer?.byteLength || 0} bytes).`);
    }

    let metadata = null;
    if (includeMetadata) {
      metadata = exportCerriaSceneMetadata(ctx, {
        download,
        filename: metadataFilename
      });
    } else {
      metadata = buildCerriaSceneMetadata(ctx);
    }

    if (download && typeof document !== 'undefined') {
      const glbBlob = new Blob([glbBuffer], { type: 'model/gltf-binary' });
      triggerBlobDownload(glbBlob, glbFilename);
    }

    const shouldPost =
      postToServer ||
      (typeof window !== 'undefined' &&
        new URLSearchParams(window.location?.search || '').get('auto_export_glb') === 'true');

    if (shouldPost && typeof fetch === 'function') {
      await fetch('/__save_exact_glb', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-Glb-Filename': glbFilename,
          'X-Exported-Meshes': String(exportedMeshCount),
          'X-Embedded-Pngs': String(pngStats.uniquePngTextures)
        },
        body: glbBuffer
      });
      await fetch('/__save_exact_metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json;charset=utf-8' },
        body: JSON.stringify(metadata, null, 2) + '\n'
      });
    }

    const sizeMB = (glbBuffer.byteLength / (1024 * 1024)).toFixed(2);
    notify(
      `✅ Export 1:1 Unity selesai: ${glbFilename} (${sizeMB} MB · ${exportedMeshCount} meshes · ${pngStats.uniquePngTextures} PNG textures)`
    );

    const result = {
      ok: true,
      glbFilename,
      glbByteLength: glbBuffer.byteLength,
      glbSizeMB: Number(sizeMB),
      exportedMeshCount,
      embeddedPngTextureCount: pngStats.uniquePngTextures,
      groupMeshCounts,
      metadataFilename,
      metadata,
      hierarchyGroups: Object.keys(groupMeshCounts)
    };

    if (typeof window !== 'undefined') {
      window.__CERRIA_LAST_GLB_EXPORT__ = result;
      if (typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent('cerria:unity-exported', { detail: result }));
      }
    }
    return result;
  } catch (err) {
    console.error('[unity-exporter] Export failed:', err);
    notify(`⚠️ Gagal export GLB: ${err?.message || err}`);
    if (typeof window !== 'undefined' && typeof fetch === 'function') {
      try {
        await fetch('/__export_error', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: err?.message || String(err), stack: err?.stack || '' })
        });
      } catch {
        /* ignore */
      }
    }
    return { ok: false, error: err?.message || String(err) };
  } finally {
    exportInProgress = false;
  }
}
