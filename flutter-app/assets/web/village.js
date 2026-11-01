import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BUILDINGS_DATA, MARKS } from './data.js?v=124';
import { normalizeStoreId, storeNumber } from './store_ids.js?v=124';

export const A = 8.2;
export const isMobile =
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
  window.innerWidth < 1024 ||
  Boolean(navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
export const PITCH = 2 * A;
export const BLOCK = 11;
export const RING = A * Math.SQRT2;
export const CLUSTERS = [[0, 0], [2 * PITCH, 0], [2 * PITCH, 2 * PITCH], [0, 2 * PITCH]];
export const LOTS = BUILDINGS_DATA.length;
export const TOWN = [PITCH, PITCH];
export const slotAngle = i => Math.PI / 4 + i * Math.PI / 2;

export const logoSVG = (id, fill) => {
  const m = MARKS[normalizeStoreId(id)] || MARKS.toko1;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${m.view}"><path fill-rule="evenodd" fill="${fill || m.fill}" d="${m.d}"/></svg>`;
};

export const svgSrc = svg =>
  'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.replace('<svg ', '<svg width="256" height="256" '));

export const logoImages = {};
export async function loadAllMarks() {
  const timeout = (p, ms) => Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))]);
  const loadMark = async (key, src) => {
    const img = new Image(256, 256);
    logoImages[key] = img;
    await timeout(new Promise(r => { img.onload = img.onerror = r; img.src = src; }), 2500);
  };
  await Promise.all([
    ...Object.keys(MARKS).flatMap(id => [
      loadMark(id, svgSrc(logoSVG(id))),
      loadMark(id + '-w', svgSrc(logoSVG(id, '#fffaf3')))
    ]),
    timeout(Promise.all(['500 40px "DM Sans"', '600 40px "DM Sans"', '700 40px "DM Sans"'].map(f => document.fonts.load(f))).catch(() => null), 2000)
  ]);
}

// Shared shading: 10 soft shader point lights + per-stop saturation, patched into every standard material
const NL = 10;
export const fake = {
  pos: { value: Array.from({ length: NL }, () => new THREE.Vector4()) },
  col: { value: Array.from({ length: NL }, () => new THREE.Vector3()) }
};

const FAKE_PARS = `uniform highp vec4 uFakePos[${NL}];uniform highp vec3 uFakeCol[${NL}];uniform highp float uSat;uniform highp float uLift;`;
const FAKE_LIGHT = `#include <lights_fragment_end>
{highp vec3 fp=-vViewPosition;for(int i=0;i<${NL};i++){if(uFakePos[i].w>0.0001){highp vec3 d=uFakePos[i].xyz-fp;highp float dd=min(dot(d,d),4096.0);highp float a=max(0.,1.-dd*uFakePos[i].w);a*=a;highp float n=dot(normal,d)*inversesqrt(dd+1e-3);reflectedLight.directDiffuse+=uFakeCol[i]*(a*(max(n,0.)*.75+.25))*diffuseColor.rgb*0.31831;}}
reflectedLight.directDiffuse+=uLift*vec3(1.,.76,.52)*diffuseColor.rgb*0.31831;}`;
const FAKE_TONE = `outgoingLight=clamp(outgoingLight,vec3(0.0),vec3(16.0));outgoingLight=mix(vec3(dot(outgoingLight,vec3(.2126,.7152,.0722)))*vec3(.94,.97,.93),outgoingLight,uSat);
#include <opaque_fragment>`;

let toneId = 0;
export const tone = (sat = 1, lift = 0) => ({ id: toneId++, sat: { value: sat }, lift: { value: lift } });
export const worldTone = tone(1, 0);
export const cityTone = tone(0.85, 0);

export function patch(m, t = worldTone, extra) {
  const toneRef = t || worldTone;
  m.onBeforeCompile = s => {
    Object.assign(s.uniforms, { uFakePos: fake.pos, uFakeCol: fake.col, uSat: toneRef.sat, uLift: toneRef.lift });
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FAKE_PARS)
      .replace('#include <lights_fragment_end>', FAKE_LIGHT)
      .replace('#include <opaque_fragment>', FAKE_TONE);
    extra?.(s);
  };
  m.customProgramCacheKey = () => 'ceria_' + (isMobile ? 'mob_' : '') + (extra ? extra.key : '') + '_' + toneRef.id;
  return m;
}

export const uWindTime = { value: 0 };
export const uWindStrength = { value: 0 };
const foliageWindExtra = s => {
  s.uniforms.uWindTime = uWindTime;
  s.uniforms.uWindStrength = uWindStrength;
  s.vertexShader = s.vertexShader
    .replace('#include <common>', '#include <common>\nuniform float uWindTime;\nuniform float uWindStrength;')
    .replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vec4 wWindPos = modelMatrix * vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        wWindPos = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
      #endif
      float wSway = sin(uWindTime * 1.5 + wWindPos.x * 0.85 + wWindPos.z * 0.65) * 0.042 * uWindStrength;
      float wHeightMask = clamp((wWindPos.y - 0.35) * 0.65, 0.0, 1.2);
      transformed.x += wSway * wHeightMask;
      transformed.z += cos(uWindTime * 1.2 + wWindPos.z * 0.85 + wWindPos.x * 0.45) * 0.030 * uWindStrength * wHeightMask;`
    );
};
foliageWindExtra.key = 'foliage_wind';

const matCache = new Map();
export function mat(color, opts = {}, t = worldTone) {
  const k = color + Object.entries(opts).map(([n, v]) => n + ':' + (v?.uuid ?? v)).join() + '|' + t.id;
  if (!matCache.has(k)) {
    if (isMobile) {
      const { roughness, metalness, roughnessMap, metalnessMap, envMapIntensity, ...lambertOpts } = opts;
      matCache.set(
        k,
        patch(
          new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide, ...lambertOpts }),
          t,
          opts.flatShading ? foliageWindExtra : undefined
        )
      );
    } else {
      matCache.set(
        k,
        patch(
          new THREE.MeshStandardMaterial({ color, roughness: 0.82, side: THREE.DoubleSide, ...opts }),
          t,
          opts.flatShading ? foliageWindExtra : undefined
        )
      );
    }
  }
  return matCache.get(k);
}

export const glowMat = (color, strength) =>
  new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(strength), fog: false });

export const lightPool = [];
export const sidewalkPoleLights = [];
export const bulbMaterials = [];
export const bollardMaterials = [];
export const windowGlowMaterials = [];
export function registerWindowGlow(matInstance, base = matInstance?.emissiveIntensity || 0.85) {
  if (matInstance) windowGlowMaterials.push({ mat: matInstance, base });
  return matInstance;
}

export function addLight(p, color, radius, intensity, slot = -1) {
  lightPool.push({ p: p.clone(), c: new THREE.Color(color), r: radius, i: intensity, slot, score: 0 });
}

// Day/Night Curve for Streetlamps:
// - 07:00 – 16:30: 0.0 (OFF)
// - 17:30 – 05:30: 1.0 (100% FULL POWER)
// - Smooth dusk/dawn transition between 16:30–17:30 and 05:30–07:00
export function getStreetlightDayNightFactor(wh) {
  const h = ((wh % 24) + 24) % 24;
  if (h >= 7.0 && h <= 16.5) return 0.0;
  if (h >= 17.5 || h <= 5.5) return 1.0;
  if (h > 16.5 && h < 17.5) return (h - 16.5) / 1.0;
  return 1.0 - (h - 5.5) / 1.5;
}

export function addPolePointLight(
  parent,
  lx,
  ly,
  lz,
  maxIntensity = 1.0,
  color = '#FFD89B',
  distance = 9,
  decay = 2.0,
  dayMinFactor = 0.75
) {
  const safeDayMin = dayMinFactor > 0 && dayMinFactor <= 1.0 ? dayMinFactor : 0.75;
  const softInt = Math.min(1.45, Math.max(0.85, maxIntensity <= 1.5 ? maxIntensity : 1.05));
  const softDist = Math.min(11.5, Math.max(5.0, distance <= 12 ? distance : 9));
  parent.updateMatrixWorld();
  const wp = parent.localToWorld(new THREE.Vector3(lx, ly, lz));
  const pl = new THREE.PointLight(color || '#FFD89B', softInt, softDist, decay);
  pl.castShadow = false;
  pl.visible = false;
  pl.intensity = 0;
  pl.position.set(lx, ly, lz);
  parent.add(pl);
  sidewalkPoleLights.push({ pl, maxIntensity: softInt, worldPos: wp, dayMinFactor: safeDayMin });
  return pl;
}

const _lv = new THREE.Vector3();
const MAX_ACTIVE_REAL_POINT_LIGHTS = isMobile ? 6 : 8;
const MAX_POINT_LIGHT_DIST_SQ = isMobile ? 18 * 18 : 22 * 22;

export function updateFakeLights(focus, slotGlow, camera, night, streetLampFactor = night, cityLightMult = 1.2) {
  // Store windows, vitrines, and interior pendant bulbs stay warmly illuminated all day & night
  const storeLightFactor = Math.max(0.95, streetLampFactor);

  // 1) Synchronize & distance-cull real THREE.PointLight instances (Streetlamps, Park & Store Vitrines)
  //    Distant buildings outside camera focus have PointLight disabled (visible = false, intensity = 0),
  //    relying on emissive materials for bulbs and windows.
  for (let i = 0; i < sidewalkPoleLights.length; i++) {
    const item = sidewalkPoleLights[i];
    item.d2 = item.worldPos.distanceToSquared(focus);
  }
  sidewalkPoleLights.sort((a, b) => a.d2 - b.d2);
  let activeCount = 0;
  for (let i = 0; i < sidewalkPoleLights.length; i++) {
    const item = sidewalkPoleLights[i];
    const factor = Math.max(item.dayMinFactor || 0.75, storeLightFactor);
    if (
      activeCount < MAX_ACTIVE_REAL_POINT_LIGHTS &&
      item.d2 <= MAX_POINT_LIGHT_DIST_SQ &&
      factor > 0.01
    ) {
      item.pl.visible = true;
      item.pl.intensity = item.maxIntensity * factor * cityLightMult;
      activeCount++;
    } else {
      item.pl.visible = false;
      item.pl.intensity = 0;
    }
  }

  // 2) Synchronize Bulb, Bollard, and Store Window Glow emissiveIntensity (scaled by cityLightMult)
  const bulbEmissive = (0.40 + 0.95 * storeLightFactor) * cityLightMult;
  for (let i = 0; i < bulbMaterials.length; i++) {
    bulbMaterials[i].emissiveIntensity = bulbEmissive;
  }
  const bollardEmissive = (0.35 + 0.80 * storeLightFactor) * cityLightMult;
  for (let i = 0; i < bollardMaterials.length; i++) {
    bollardMaterials[i].emissiveIntensity = bollardEmissive;
  }
  const winMult = (0.92 + 0.32 * storeLightFactor) * (0.75 + 0.25 * cityLightMult);
  for (let i = 0; i < windowGlowMaterials.length; i++) {
    const w = windowGlowMaterials[i];
    w.mat.emissiveIntensity = w.base * winMult;
  }

  // 3) Synchronize shader point lights (NL = 10)
  for (const L of lightPool) {
    const activeBoost = L.slot >= 0 ? slotGlow[L.slot] ?? 1 : 1.0;
    const lightFactor = L.slot >= 0 ? storeLightFactor : Math.max(0.75, streetLampFactor);
    L.k = L.i * lightFactor * activeBoost * cityLightMult;
    const d2 = L.p.distanceToSquared(focus);
    L.score = L.k / (1 + d2 * 0.015);
  }
  const best = lightPool.slice().sort((a, b) => b.score - a.score);
  for (let i = 0; i < NL; i++) {
    const L = best[i];
    if (!L || L.score < 0.01) {
      fake.col.value[i].set(0, 0, 0);
      fake.pos.value[i].set(0, 0, 0, 0);
      continue;
    }
    _lv.copy(L.p).applyMatrix4(camera.matrixWorldInverse);
    fake.pos.value[i].set(_lv.x, _lv.y, _lv.z, 1 / (L.r * L.r));
    fake.col.value[i].set(L.c.r * L.k, L.c.g * L.k, L.c.b * L.k);
  }
}

// Geometry primitives & Batch builder
const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

export const solid = g => (g.index ? g.toNonIndexed() : g);
export const unitBox = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
export const unitCyl = new THREE.CylinderGeometry(1, 1, 1, 12).toNonIndexed();
export const unitCyl6 = new THREE.CylinderGeometry(1, 1, 1, 6).toNonIndexed();
export const crownGeo = new THREE.IcosahedronGeometry(1, 0);
export const unitCone = new THREE.ConeGeometry(1, 1, 12).toNonIndexed();
export const unitSphere = new THREE.SphereGeometry(1, 10, 8).toNonIndexed();
export const solidPlane = () => new THREE.PlaneGeometry(1, 1).toNonIndexed();

const roundCache = new Map();
export function roundedBox(w, h, d, r) {
  const k = [w, h, d, r].join();
  if (!roundCache.has(k)) roundCache.set(k, solid(new RoundedBoxGeometry(w, h, d, 2, r)));
  return roundCache.get(k);
}

export const mTactileYellow = mat('#E2B842', { roughness: 0.72 });

export class Batch {
  constructor() {
    this.map = new Map();
  }
  add(m, geo, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
    const matRef = m || mTactileYellow;
    _m4.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ')), _s.set(sx, sy, sz));
    const g = solid(geo.clone()).applyMatrix4(_m4);
    if (!this.map.has(matRef)) this.map.set(matRef, []);
    this.map.get(matRef).push(g);
    return this;
  }
  box(m, x, y, z, w, h, d, o = {}) {
    return o.r
      ? this.add(m, roundedBox(w, h, d, o.r), x, y, z, 1, 1, 1, o.rx, o.ry, o.rz)
      : this.add(m, unitBox, x, y, z, w, h, d, o.rx, o.ry, o.rz);
  }
  cyl(m, x, y, z, r, h, o = {}) {
    return this.add(m, o.seg6 ? unitCyl6 : unitCyl, x, y, z, r, h, r, o.rx, o.ry, o.rz);
  }
  sphere(m, x, y, z, r) {
    return this.add(m, unitSphere, x, y, z, r, r, r);
  }
  crown(m, x, y, z, sx, sy, sz, ry = 0) {
    return this.add(m, crownGeo, x, y, z, sx, sy, sz, 0, ry, 0);
  }
  panel(m, rect, x, y, z, w, h, ry = 0, rx = 0) {
    const g = solidPlane();
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, rect[0] + uv.getX(i) * (rect[2] - rect[0]), rect[1] + uv.getY(i) * (rect[3] - rect[1]));
    }
    return this.add(m, g, x, y, z, w, h, 1, rx, ry, 0);
  }
  build(parent, { cast = true } = {}) {
    for (const [mRaw, list] of this.map) {
      if (!list.length) continue;
      const m = mRaw || mat('#E2B842', { roughness: 0.72 });
      const merged = mergeGeometries(list, false);
      list.forEach(g => g.dispose());
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, m);
      mesh.castShadow = cast && !m.userData?.noCast;
      mesh.receiveShadow = !m.userData?.noReceive;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      parent.add(mesh);
    }
    this.map.clear();
  }
}

// Procedural Textures: Cobblestone (#d8cfc4), Sidewalk Tile Grid, Sage Grass (#7da068), Radial Light Pool
let seed = 72;
export function random() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}

export const pavingTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const x = c.getContext('2d');
  x.fillStyle = '#9E9282';
  x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const v = random() * 14 - 7;
      x.fillStyle = `rgb(${Math.round(220 + v)},${Math.round(211 + v)},${Math.round(200 + v)})`;
      x.beginPath();
      x.roundRect(i * 128 + 5, j * 128 + 5, 118, 118, 12);
      x.fill();
      x.strokeStyle = 'rgba(116, 105, 92, 0.65)';
      x.lineWidth = 3;
      x.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();

export const sidewalkTileTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const x = c.getContext('2d');
  // Sharp warm stone mortar joints matching pavingTex grid
  x.fillStyle = '#9E9282';
  x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const v = random() * 14 - 7;
      x.fillStyle = `rgb(${Math.round(226 + v)},${Math.round(217 + v)},${Math.round(205 + v)})`;
      x.beginPath();
      x.roundRect(i * 128 + 5, j * 128 + 5, 118, 118, 12);
      x.fill();
      x.strokeStyle = 'rgba(116, 105, 92, 0.68)';
      x.lineWidth = 3;
      x.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 1);
  t.anisotropy = 8;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();

// Unified Large-Format Polished Concrete & Granite Plaza Texture (#DFDDD6 tiles with fine #C5C2B8 grout joints)
// World-scaled UVs (repeat 0.3125x0.3125 on lotGeometry / roundedRectGeometry / tiledBoxGeo = 0.80u x 0.80u per large granite tile)
export const granitePlazaTex = (() => {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  // Fine grout joint base (#C5C2B8)
  ctx.fillStyle = '#C5C2B8';
  ctx.fillRect(0, 0, S, S);
  const N = 4;
  const step = S / N;
  for (let r = 0; r < N; r++) {
    for (let col = 0; col < N; col++) {
      const isEven = (r + col) % 2 === 0;
      ctx.fillStyle = isEven ? '#DFDDD6' : '#DAD8D0';
      ctx.fillRect(col * step + 3, r * step + 3, step - 6, step - 6);
      // Subtle polished stone bevel highlight inside each large square granite slab
      ctx.strokeStyle = isEven ? '#E6E4DD' : '#E0DED7';
      ctx.lineWidth = 2;
      ctx.strokeRect(col * step + 5, r * step + 5, step - 10, step - 10);
    }
  }
  // Crisp fine grout lines (#C5C2B8)
  ctx.strokeStyle = '#C5C2B8';
  ctx.lineWidth = 5;
  for (let i = 0; i <= N; i++) {
    const p = i * step;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, S);
    ctx.moveTo(0, p);
    ctx.lineTo(S, p);
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(0.3125, 0.3125);
  t.anisotropy = 8;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();

export const cobbleWalkwayTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#d8cfc4';
  x.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const v = (random() - 0.5) * 16;
      x.fillStyle = `rgb(${216 + v},${207 + v},${196 + v})`;
      const ox = (row % 2) * 16;
      x.beginPath();
      x.roundRect(((col * 32 + ox) % 256) + 2, row * 32 + 2, 28, 28, 6);
      x.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(28, 28);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();

export const herringboneBrickTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  // Warm terracotta mortar base (#A66E54)
  x.fillStyle = '#a46c52';
  x.fillRect(0, 0, 256, 256);
  const step = 32;
  for (let row = -2; row < 10; row++) {
    for (let col = -2; col < 10; col++) {
      const bx = col * step;
      const by = row * step;
      const isHoriz = (row + col) % 2 === 0;
      const v = (random() - 0.5) * 16;
      x.fillStyle = `rgb(${Math.round(201 + v)},${Math.round(140 + v * 0.7)},${Math.round(112 + v * 0.6)})`;
      x.strokeStyle = 'rgba(122, 76, 56, 0.65)';
      x.lineWidth = 1.5;
      if (isHoriz) {
        x.fillRect(bx + 2, by + 2, step * 2 - 4, step - 4);
        x.strokeRect(bx + 2, by + 2, step * 2 - 4, step - 4);
      } else {
        x.fillRect(bx + 2, by + 2, step - 4, step * 2 - 4);
        x.strokeRect(bx + 2, by + 2, step - 4, step * 2 - 4);
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 6);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();

export const grassTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#7da068';
  x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 420; i++) {
    const v = (random() - 0.5) * 18;
    x.fillStyle = `rgb(${125 + v},${160 + v},${104 + v})`;
    x.fillRect(random() * 256, random() * 256, 6, 6);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(24, 24);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();

export const radialTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, '#fff');
  g.addColorStop(0.35, '#ffffff88');
  g.addColorStop(1, '#fff0');
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
})();

export const slateShingleTex = (() => {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#5c7078';
  ctx.fillRect(0, 0, S, S);

  const rows = 14;
  const cols = 10;
  const rh = S / rows;
  const cw = S / cols;
  for (let r = 0; r < rows; r++) {
    const ox = (r % 2) * (cw * 0.5);
    const y0 = r * rh;
    for (let col = -1; col <= cols; col++) {
      const x0 = col * cw + ox;
      const v = (random() - 0.5) * 18;
      const R = Math.round(108 + v);
      const G = Math.round(128 + v);
      const B = Math.round(138 + v);
      ctx.fillStyle = `rgb(${R},${G},${B})`;
      ctx.beginPath();
      ctx.roundRect(x0 + 2, y0 + 2, cw - 4, rh - 3, [2, 2, 10, 10]);
      ctx.fill();

      // Subtle weathering highlight & lower shadow lip per slate shingle
      ctx.fillStyle = 'rgba(235, 244, 250, 0.14)';
      ctx.fillRect(x0 + 4, y0 + 3, cw - 8, 4);
      ctx.strokeStyle = 'rgba(42, 54, 60, 0.65)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.roundRect(x0 + 2, y0 + 2, cw - 4, rh - 3, [2, 2, 10, 10]);
      ctx.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 3);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();

export const slateShingleBumpTex = (() => {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#404040';
  ctx.fillRect(0, 0, S, S);
  const rows = 14;
  const cols = 10;
  const rh = S / rows;
  const cw = S / cols;
  for (let r = 0; r < rows; r++) {
    const ox = (r % 2) * (cw * 0.5);
    const y0 = r * rh;
    for (let col = -1; col <= cols; col++) {
      const x0 = col * cw + ox;
      const g = ctx.createLinearGradient(0, y0, 0, y0 + rh);
      g.addColorStop(0, '#a8a8a8');
      g.addColorStop(0.82, '#e8e8e8');
      g.addColorStop(1, '#282828');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(x0 + 2, y0 + 2, cw - 4, rh - 3, [2, 2, 10, 10]);
      ctx.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 3);
  return t;
})();

function roundedRectShape(w, d, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -d / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r);
  s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d);
  s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

export function roundedRectGeometry(w, d, r, depth) {
  const g = new THREE.ExtrudeGeometry(roundedRectShape(w, d, r), { depth, bevelEnabled: false, curveSegments: 6 });
  g.rotateX(-Math.PI / 2);
  return g;
}

export function hollowCurbRingGeo(w, d, rOuter = 1.2, rimW = 0.14, depth = 0.19) {
  const outer = roundedRectShape(w, d, rOuter);
  const iw = Math.max(0.2, w - rimW * 2);
  const id = Math.max(0.2, d - rimW * 2);
  const ir = Math.max(0.05, rOuter - rimW);
  const hole = new THREE.Path();
  const x = -iw / 2, y = -id / 2;
  hole.moveTo(x + ir, y);
  hole.lineTo(x + iw - ir, y);
  hole.quadraticCurveTo(x + iw, y, x + iw, y + ir);
  hole.lineTo(x + iw, y + id - ir);
  hole.quadraticCurveTo(x + iw, y + id, x + iw - ir, y + id);
  hole.lineTo(x + ir, y + id);
  hole.quadraticCurveTo(x, y + id, x, y + id - ir);
  hole.lineTo(x, y + ir);
  hole.quadraticCurveTo(x, y, x + ir, y);
  outer.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(outer, { depth, bevelEnabled: false, curveSegments: 6 });
  g.rotateX(-Math.PI / 2);
  return g;
}

export function lotGeometry(size, r, depth) {
  return roundedRectGeometry(size, size, r, depth);
}

// World-scaled UV BoxGeometry so rectangular sidewalk/plaza slabs tile at 1:1 world scale with lotGeometry
export function tiledBoxGeo(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
  const pos = g.attributes.position;
  const nrm = g.attributes.normal;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    if (Math.abs(nrm.getY(i)) > 0.5) {
      uv.setXY(i, pos.getX(i), pos.getZ(i));
    } else if (Math.abs(nrm.getX(i)) > 0.5) {
      uv.setXY(i, pos.getZ(i), pos.getY(i));
    } else {
      uv.setXY(i, pos.getX(i), pos.getY(i));
    }
  }
  return g;
}

function lot(b, paving, curb, grassBorder, size = BLOCK) {
  b.add(curb, lotGeometry(size, 1.2, 0.11), 0, 0, 0);
  b.add(grassBorder, lotGeometry(size - 0.28, 1.1, 0.02), 0, 0.11, 0);
  b.add(paving, lotGeometry(size - 0.85, 0.98, 0.02), 0, 0.13, 0);
}

// Canvas 2D typography & procedural signage helpers
function text(ctx, s, x, y, size, { weight = 600, color = '#1d1d1f', align = 'left', base = 'alphabetic', spacing = 0, max, fit } = {}) {
  const font = px => `${weight} ${px}px "DM Sans",Arial,sans-serif`;
  ctx.font = font(size);
  ctx.letterSpacing = spacing + 'px';
  if (fit && max) {
    const w = ctx.measureText(s).width;
    if (w > max) ctx.font = font(size * max / w);
  }
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = base;
  ctx.fillText(s, x, y, max);
  ctx.letterSpacing = '0px';
}

function paper(ctx, w, h, bg = '#f7f2ea', edge = '#dcd1c2') {
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#ffffff18');
  g.addColorStop(1, '#00000012');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = edge;
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, w - 6, h - 6);
}

let seedA = 11;
const rnd = () => (seedA = (seedA * 16807) % 2147483647) / 2147483647;

function drawInterior(ctx, w, h, accent) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#ffe5b0');
  g.addColorStop(0.55, '#ffc680');
  g.addColorStop(1, '#c9793e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  for (let k = 0; k < 7; k++) {
    const x = 40 + (k * w) / 7;
    ctx.fillStyle = '#7a4f31';
    ctx.fillRect(x, h * 0.18, 6, h * 0.62);
    for (let row = 0; row < 3; row++) {
      const y = h * (0.3 + row * 0.18);
      ctx.fillStyle = '#8a5b37';
      ctx.fillRect(x - 6, y, w / 7 - 24, 7);
      for (let j = 0; j < 5; j++) {
        ctx.fillStyle = ['#fff3cf', accent, '#b86b3f', '#7da068', '#6e5a45'][(j + k + row) % 5];
        ctx.fillRect(x + 2 + j * ((w / 7 - 34) / 5), y - 24 - ((j * 7 + k) % 3) * 5, (w / 7 - 44) / 5, 24 + ((j * 7 + k) % 3) * 5);
      }
    }
  }
  for (let k = 0; k < 6; k++) {
    const x = (w * (k + 0.5)) / 6;
    ctx.fillStyle = '#3b2d22';
    ctx.fillRect(x - 1, 0, 2, h * 0.08);
    ctx.shadowColor = '#fff6d0';
    ctx.shadowBlur = 30;
    ctx.fillStyle = '#fffbe8';
    ctx.beginPath();
    ctx.ellipse(x, h * 0.09, 16, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.fillStyle = '#6b4228';
  ctx.fillRect(0, h * 0.82, w, h * 0.18);
  ctx.fillStyle = '#a8703f';
  ctx.fillRect(0, h * 0.8, w, 10);
}

function makeAtlas(W, H, maxAniso, scale = 0.5) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const pad = 6;
  const items = [];
  let sc = scale;
  c.width = W * sc;
  c.height = H * sc;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, maxAniso);
  const draw = () => {
    ctx.setTransform(sc, 0, 0, sc, 0, 0);
    for (const it of items) {
      ctx.save();
      ctx.translate(it.x, it.y);
      ctx.beginPath();
      ctx.rect(0, 0, it.w, it.h);
      ctx.clip();
      seedA = it.seed;
      it.draw(ctx, it.w, it.h);
      ctx.restore();
    }
    tex.needsUpdate = true;
  };
  return {
    tex,
    get scale() { return sc; },
    add(w, h, fn) {
      const rect = [0, 0, 0, 0];
      items.push({ w, h, draw: fn, rect, seed: 11 + items.length * 97 });
      return rect;
    },
    flush() {
      let x = 0, y = 0, row = 0;
      for (const it of [...items].sort((a, b) => b.h - a.h)) {
        if (x + it.w > W) { x = 0; y += row + pad; row = 0; }
        Object.assign(it, { x, y });
        it.rect[0] = (x + 1) / W;
        it.rect[1] = 1 - (y + it.h - 1) / H;
        it.rect[2] = (x + it.w - 1) / W;
        it.rect[3] = 1 - (y + 1) / H;
        x += it.w + pad;
        row = Math.max(row, it.h);
      }
      draw();
    },
    setScale(s) {
      if (s === sc) return;
      sc = s;
      c.width = W * s;
      c.height = H * s;
      tex.dispose();
      draw();
    }
  };
}

export const STYLE_HEIGHT = { shop: 7.55, brick: 6.75, pavilion: 4.35, studio: 7.45, gable: 7.25, strawberry: 7.5, mayor: 8.1 };

export const stores = [];
export const links = [];
const linkProbe = new THREE.MeshBasicMaterial();

export function buildAllStores(world, maxAniso, onlyIndex = null) {
  BUILDINGS_DATA.forEach((lab, index) => {
    if (onlyIndex !== null && index !== onlyIndex) return;
    const style = lab.style;
    const H = STYLE_HEIGHT[style];
    const X0 = -4.2, X1 = 3.0, Z0 = -4.3, ZF = 0.8, cx = (X0 + X1) / 2, W = X1 - X0;
    const S = {
      id: lab.id,
      lab,
      index,
      slot: index,
      cluster: index >> 2,
      style,
      tone: tone(index === 0 ? 1 : 0, 0),
      glow: index === 0 ? 1 : 0.28,
      lights: []
    };
    const t = S.tone;
    const g = new THREE.Group();
    if (style === 'mayor') {
      // Pos #7 (Mayor's Office): Placed on the central Fountain Plaza lot (1.5 * PITCH, 1.5 * PITCH), facing the Fountain Plaza (+Z)
      g.position.set(1.5 * PITCH, 0, 1.5 * PITCH);
      g.rotation.y = 0;
    } else {
      const a = slotAngle(index);
      const [ccx, ccz] = CLUSTERS[index >> 2];
      g.position.set(ccx + Math.sin(a) * RING, 0, ccz + Math.cos(a) * RING);
      g.rotation.y = a - Math.PI / 4;
    }
    g.name = 'Building_' + lab.id;
    g.userData.storeId = lab.id;
    world.add(g);
    g.updateMatrixWorld();
    S.g = g;

    const M = {
      wall: mat(lab.wall, { roughness: 0.88 }, t),
      trim: mat('#d6c8b6', {}, t),
      dark: mat('#2d312e', { roughness: 0.6 }, t),
      wood: mat('#8e5d3b', {}, t),
      fence: mat('#9b6b43', { roughness: 0.85 }, t),
      accent: mat(lab.color, { roughness: 0.7 }, t),
      white: mat('#f7f2ea', {}, t),
      roof: mat('#947b66', { roughness: 0.92 }, t),
      terracotta: mat('#c46446', { roughness: 0.82 }, t),
      cap: mat('#b9835e', {}, t),
      metal: mat('#c9ccd0', { roughness: 0.45, metalness: 0.4 }, t),
      plant: mat('#689648', { flatShading: true }, t),
      grassBorder: mat('#7da068', { map: grassTex, roughness: 0.92 }, t),
      rope: mat('#c85a32', { roughness: 0.5 }, t),
      paving: mat('#d8cfc4', { map: pavingTex, roughness: 0.65 }, t),
      curb: mat('#bfb4a6', {}, t),
      brick: mat('#9e553e', { roughness: 0.92 }, t),
      board: mat('#283b32', { roughness: 0.7 }, t),
      cedar: mat('#b58458', {}, t),
      solar: mat('#2b523e', { roughness: 0.35, metalness: 0.3 }, t),
      roofTile: mat('#c26345', { roughness: 0.82 }, t),
      tactileYellow: mat('#E2B842', { roughness: 0.72 }, t)
    };

    const atlas = makeAtlas(2048, 1536, maxAniso, index === 0 ? 1 : 0.5);
    S.atlas = atlas;
    M.sign = patch(
      new THREE.MeshStandardMaterial({
        map: atlas.tex,
        roughness: 0.8,
        emissive: '#ffe4c4',
        emissiveMap: atlas.tex,
        emissiveIntensity: 0.14,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2
      }),
      t
    );
    M.sign.userData.noCast = true;
    M.sign.userData.noReceive = true;

    M.interior = patch(
      new THREE.MeshStandardMaterial({
        color: '#000',
        emissive: '#ffffff',
        emissiveMap: atlas.tex,
        emissiveIntensity: 1.65,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2
      }),
      t
    );
    M.interior.userData.noCast = true;
    M.interior.userData.noReceive = true;

    M.glowGlass = patch(
      new THREE.MeshStandardMaterial({
        color: 0xFFE294,
        emissive: 0xFFB040,
        emissiveIntensity: 1.18,
        roughness: 0.35
      }),
      t
    );
    M.glowGlass.userData.noCast = true;
    M.glowGlass.userData.noReceive = true;
    registerWindowGlow(M.glowGlass, 1.18);

    M.clearWinGlass = patch(
      new THREE.MeshStandardMaterial({
        color: 0xfff2d6,
        emissive: 0xffbe64,
        emissiveIntensity: 0.42,
        roughness: 0.1,
        metalness: 0.10,
        transparent: true,
        opacity: 0.42,
        depthWrite: false
      }),
      t
    );
    M.clearWinGlass.userData.noCast = true;
    M.clearWinGlass.userData.noReceive = true;
    registerWindowGlow(M.clearWinGlass, 0.42);

    M.warm = patch(
      new THREE.MeshStandardMaterial({
        color: '#FFF4D4',
        emissive: new THREE.Color('#FFD89B'),
        emissiveIntensity: 1.1,
        roughness: 0.35,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2
      }),
      t
    );
    M.warm.userData.noCast = true;
    M.warm.userData.noReceive = true;
    bulbMaterials.push(M.warm);

    M.lampBulb = patch(
      new THREE.MeshStandardMaterial({
        color: '#FFF4D4',
        emissive: new THREE.Color('#FFD89B'),
        emissiveIntensity: 1.1,
        roughness: 0.32,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2
      }),
      t
    );
    M.lampBulb.userData.noCast = true;
    M.lampBulb.userData.noReceive = true;
    bulbMaterials.push(M.lampBulb);

    M.bulb = patch(
      new THREE.MeshStandardMaterial({
        color: '#FFF4D4',
        emissive: new THREE.Color('#FFD89B'),
        emissiveIntensity: 1.1,
        roughness: 0.32
      }),
      t
    );
    M.bulb.userData.noCast = true;
    M.bulb.userData.noReceive = true;
    bulbMaterials.push(M.bulb);
    S.bulbBase = new THREE.Color('#FFD89B');
    S.M = M;

    const mark = (c, key, x, y, s) => {
      const img = logoImages[key];
      if (!img) return;
      c.drawImage(img, x, y, s, s);
    };

    const dark = style === 'brick';
    const onAccent = style === 'studio';
    const R = {};

    // Main Fascia Sign: Minimal geometric SVG mark + single-word/two-word title
    R.fascia = atlas.add(1100, 266, (c, w, h) => {
      if (onAccent) {
        const gr = c.createLinearGradient(0, 0, w, h);
        (lab.grad || [lab.color, lab.color]).forEach((col, i, arr) => gr.addColorStop(i / (arr.length - 1 || 1), col));
        c.fillStyle = gr;
        c.fillRect(0, 0, w, h);
      } else {
        paper(c, w, h, dark ? '#283b32' : '#f7f2ea', dark ? '#c49e58' : '#dfd4c6');
      }
      if (onAccent) {
        c.fillStyle = '#fff';
        c.beginPath();
        c.roundRect(34, 30, 206, 206, 46);
        c.fill();
        mark(c, lab.id, 50, 46, 174);
      } else {
        mark(c, lab.id, 40, 36, 194);
      }
      text(c, lab.sign, 280, 204, 176, {
        weight: 600,
        spacing: -3,
        color: onAccent ? '#fff' : dark ? '#f3dfb1' : '#1d1d1f',
        max: 780,
        fit: true
      });
    });

    // Side Model Plaque
    R.model = atlas.add(300, 287, (c, w, h) => {
      paper(c, w, h, '#f6f0e6');
      text(c, lab.badge.toUpperCase(), 24, 56, 22, { weight: 600, color: '#6b5e52', spacing: 1 });
      text(c, lab.title, 24, 112, 34, { weight: 700, max: 254, fit: true });
      [lab.subtitle.split(' · ')[0], `${lab.friends} pengunjung`].forEach((l, i) =>
        text(c, l, 24, 172 + i * 36, 23, { weight: 500, color: '#4a4540', max: 254 })
      );
    });

    // Wall Poster: Large bold metric on top with 3-4 short checklist lines below
    R.price = atlas.add(280, 332, (c, w, h) => {
      paper(c, w, h, '#f7f1e8');
      text(c, lab.metric, 22, 92, 78, { weight: 700, spacing: -2, max: 236, fit: true });
      text(c, lab.unit, 24, 128, 21, { weight: 500, color: '#544d46' });
      lab.checks.slice(0, 4).forEach((l, i) => {
        text(c, '✓', 24, 182 + i * 36, 24, { weight: 700, color: '#3b7a49' });
        text(c, l, 56, 182 + i * 36, 23, { weight: 500, max: 202, fit: true });
      });
    });

    // Awning Lip Text: All-caps micro-specs
    R.valance = atlas.add(1100, 48, (c, w, h) => {
      c.fillStyle = '#f6f1ea';
      c.fillRect(0, 0, w, h);
      c.fillStyle = '#dcd2c6';
      c.fillRect(0, h - 5, w, 5);
      lab.valance.forEach((l, i) => {
        text(c, l, (w * (i + 0.5)) / 3, h / 2 + 2, 27, {
          weight: 600,
          color: '#2e2b28',
          align: 'center',
          base: 'middle',
          spacing: 1.5,
          max: w / 3 - 40,
          fit: true
        });
        if (i) c.fillRect((w * i) / 3 - 1, 14, 3, h - 28);
      });
    });

    R.interior = atlas.add(900, 353, (c, w, h) => drawInterior(c, w, h, lab.color));

    R.banner = atlas.add(180, 432, (c, w, h) => {
      const gr = c.createLinearGradient(0, 0, 0, h);
      (lab.grad || [lab.color, lab.color]).forEach((col, i, arr) => gr.addColorStop(i / (arr.length - 1 || 1), col));
      c.fillStyle = gr;
      c.fillRect(0, 0, w, h);
      c.fillStyle = '#ffffff22';
      c.fillRect(0, 0, w, 8);
      [style === 'mayor' ? 'HUB' : 'STORE', `#${storeNumber(lab.id)}`, ...lab.title.split(' ')].forEach((l, i) =>
        text(c, l, 20, 62 + i * 52, 42, { weight: 600, color: '#fffaf3', max: 146, fit: true })
      );
      mark(c, lab.id + '-w', w / 2 - 32, h - 98, 64);
    });

    R.chalk = atlas.add(200, 258, (c, w, h) => {
      c.fillStyle = '#7c5538';
      c.fillRect(0, 0, w, h);
      c.fillStyle = '#253029';
      c.fillRect(12, 12, w - 24, h - 24);
      [['MASUK', '#f1efe6'], ['TOKO', '#ffd584'], [lab.sign.toUpperCase(), '#f1efe6']].forEach(([l, col], i) =>
        text(c, l, w / 2, 68 + i * 44, 32, { weight: 600, color: col, align: 'center', max: w - 36, fit: true })
      );
      text(c, '→', w / 2, 222, 40, { color: '#f1efe6', align: 'center' });
    });

    R.window = atlas.add(256, 239, (c, w, h) => {
      drawInterior(c, w, h, lab.color);
      c.fillStyle = '#f4ede2';
      c.fillRect(30, 40, 80, 110);
      c.fillStyle = lab.color;
      c.fillRect(40, 52, 60, 40);
      c.fillStyle = '#e9e0d2';
      c.fillRect(140, 60, 80, 100);
    });

    R.side = atlas.add(900, 180, (c, w, h) => {
      paper(c, w, h, dark ? '#283b32' : '#f7f2ea', dark ? '#c49e58' : '#dfd4c6');
      mark(c, lab.id, 34, 26, 128);
      text(c, lab.title, 196, 136, 112, { weight: 600, spacing: -2, color: dark ? '#f3dfb1' : '#1d1d1f', max: 660, fit: true });
    });

    R.door = atlas.add(160, 302, (c, w, h) => {
      drawInterior(c, w, h, lab.color);
      c.fillStyle = '#fff3dc';
      c.fillRect(20, 20, w - 40, h * 0.5);
    });

    if (style === 'shop') {
      R.atelierSign = atlas.add(480, 96, (c, w, h) => {
        c.fillStyle = '#232527';
        c.fillRect(0, 0, w, h);
        c.fillStyle = '#CFC8BC';
        c.fillRect(8, 8, w - 16, h - 16);
        c.strokeStyle = '#3A3D40';
        c.lineWidth = 3;
        c.strokeRect(14, 14, w - 28, h - 28);
        text(c, 'ATELIER', w / 2, h / 2 + 3, 44, {
          weight: 700,
          color: '#1E2022',
          align: 'center',
          base: 'middle',
          spacing: 5
        });
      });
      R.boutiqueSign = atlas.add(280, 96, (c, w, h) => {
        c.fillStyle = '#232527';
        c.fillRect(0, 0, w, h);
        c.fillStyle = '#CFC8BC';
        c.fillRect(8, 8, w - 16, h - 16);
        c.strokeStyle = '#3A3D40';
        c.lineWidth = 3;
        c.strokeRect(14, 14, w - 28, h - 28);
        text(c, 'BOUTIQUE', w / 2, h / 2 + 3, 34, {
          weight: 700,
          color: '#1E2022',
          align: 'center',
          base: 'middle',
          spacing: 2.5
        });
      });
      R.atelierBillboard = atlas.add(960, 280, (c, w, h) => {
        // Outer dark steel frame
        c.fillStyle = '#232527';
        c.fillRect(0, 0, w, h);
        // Main fashion photography studio backdrop
        const bg = c.createLinearGradient(0, 10, w, h - 64);
        bg.addColorStop(0, '#F3EEE4');
        bg.addColorStop(0.55, '#E5DECF');
        bg.addColorStop(1, '#D5CCB8');
        c.fillStyle = '#EAE3D5';
        c.fillRect(10, 10, w - 20, h - 72);
        // Soft warm spotlight pools from top 4 floodlights
        for (const sx of [160, 380, 600, 820]) {
          const rg = c.createRadialGradient(sx, 14, 8, sx, 90, 170);
          rg.addColorStop(0, 'rgba(255, 248, 228, 0.75)');
          rg.addColorStop(1, 'rgba(234, 227, 213, 0)');
          c.fillStyle = rg;
          c.fillRect(10, 10, w - 20, h - 72);
        }
        // Left editorial typography: FASHION PHOTOGRAPHY
        text(c, 'FASHION', 240, 86, 40, {
          weight: 700,
          color: '#262422',
          align: 'center',
          spacing: 4
        });
        text(c, 'PHOTOGRAPHY', 240, 134, 34, {
          weight: 700,
          color: '#262422',
          align: 'center',
          spacing: 3.5
        });
        c.fillStyle = '#7A6F62';
        c.fillRect(130, 152, 220, 2.5);
        text(c, 'AUTUMN / WINTER LOOKBOOK', 240, 180, 18, {
          weight: 600,
          color: '#5A5248',
          align: 'center',
          spacing: 2
        });

        // Right illustration #1: Dress Form Mannequin on Stand (x = 595)
        const mx = 595;
        // Stand base & pole
        c.strokeStyle = '#2B2927';
        c.lineWidth = 3.5;
        c.beginPath();
        c.moveTo(mx, 145);
        c.lineTo(mx, 202);
        c.moveTo(mx - 22, 202);
        c.lineTo(mx + 22, 202);
        c.stroke();
        // Neck knob
        c.fillStyle = '#4A3A2C';
        c.fillRect(mx - 4, 34, 8, 12);
        // Dress bodice & flared skirt
        c.fillStyle = '#8F826E';
        c.beginPath();
        c.moveTo(mx - 22, 46);
        c.lineTo(mx + 22, 46);
        c.lineTo(mx + 15, 92);
        c.lineTo(mx + 34, 158);
        c.lineTo(mx - 34, 158);
        c.lineTo(mx - 15, 92);
        c.closePath();
        c.fill();
        c.strokeStyle = '#262422';
        c.lineWidth = 3;
        c.stroke();
        // Waist belt & skirt pleats
        c.fillStyle = '#3B342E';
        c.fillRect(mx - 16, 89, 32, 6);
        c.beginPath();
        c.moveTo(mx - 8, 95);
        c.lineTo(mx - 14, 156);
        c.moveTo(mx + 8, 95);
        c.lineTo(mx + 14, 156);
        c.stroke();

        // Right illustration #2: Editorial Fashion Model in Trench Coat (x = 745)
        const fx = 745;
        // Hair & head silhouette
        c.fillStyle = '#3A2E26';
        c.beginPath();
        c.arc(fx, 48, 18, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#DFC8B0';
        c.beginPath();
        c.arc(fx, 49, 11, 0, Math.PI * 2);
        c.fill();
        // Structured coat & inner dress
        c.fillStyle = '#524B46';
        c.beginPath();
        c.moveTo(fx - 28, 70);
        c.lineTo(fx + 28, 70);
        c.lineTo(fx + 42, 198);
        c.lineTo(fx - 42, 198);
        c.closePath();
        c.fill();
        c.strokeStyle = '#262422';
        c.lineWidth = 3;
        c.stroke();
        // Inner cream dress V-panel & lapels
        c.fillStyle = '#DDD2C0';
        c.beginPath();
        c.moveTo(fx - 10, 70);
        c.lineTo(fx + 10, 70);
        c.lineTo(fx + 14, 198);
        c.lineTo(fx - 14, 198);
        c.closePath();
        c.fill();
        c.stroke();

        // Bottom strip: NEW SEASON COLLECTION • ATELIER & BOUTIQUE
        c.fillStyle = '#CFC7B8';
        c.fillRect(10, h - 58, w - 20, 48);
        c.strokeStyle = '#2B2D2F';
        c.lineWidth = 4;
        c.strokeRect(10, h - 58, w - 20, 48);
        text(c, 'NEW SEASON COLLECTION  •  ATELIER & BOUTIQUE', w / 2, h - 32, 26, {
          weight: 700,
          color: '#1E2022',
          align: 'center',
          base: 'middle',
          spacing: 2.5
        });
      });
      R.atelierLookbookStand = atlas.add(180, 280, (c, w, h) => {
        c.fillStyle = '#F7F4ED';
        c.fillRect(0, 0, w, h);
        c.strokeStyle = '#C9C2B5';
        c.lineWidth = 4;
        c.strokeRect(6, 6, w - 12, h - 12);
        c.strokeStyle = '#2B2D2F';
        c.lineWidth = 1.5;
        c.strokeRect(13, 13, w - 26, h - 26);
        text(c, 'ATELIER', w / 2, 36, 19, { weight: 700, color: '#232527', align: 'center', base: 'middle', spacing: 3 });
        text(c, 'BOUTIQUE', w / 2, 56, 13, { weight: 600, color: '#6E665C', align: 'center', base: 'middle', spacing: 2.5 });
        c.fillStyle = '#B8895A';
        c.fillRect(36, 70, w - 72, 2);
        text(c, 'LOOKBOOK', w / 2, 92, 14, { weight: 700, color: '#2B2D2F', align: 'center', base: 'middle', spacing: 2 });
        text(c, '• TAILORED TRENCH', 26, 122, 11.5, { weight: 600, color: '#3E3A35', base: 'middle' });
        text(c, '• CLASSIC BLAZER', 26, 144, 11.5, { weight: 600, color: '#3E3A35', base: 'middle' });
        text(c, '• PLEATED DRESS', 26, 166, 11.5, { weight: 600, color: '#3E3A35', base: 'middle' });
        text(c, '• LEATHER BAG', 26, 188, 11.5, { weight: 600, color: '#3E3A35', base: 'middle' });
        // Minimalist coat/hanger sketch icon at bottom
        c.strokeStyle = '#7A6B58';
        c.lineWidth = 2.2;
        c.beginPath();
        c.moveTo(w / 2, 212);
        c.lineTo(w / 2 - 24, 226);
        c.lineTo(w / 2 + 24, 226);
        c.closePath();
        c.stroke();
        c.fillStyle = '#DFD7C8';
        c.fillRect(w / 2 - 18, 228, 36, 26);
        c.strokeRect(w / 2 - 18, 228, 36, 26);
      });
    }
    if (style === 'gable') {
      R.glowFascia = atlas.add(520, 110, (c, w, h) => {
        c.fillStyle = '#F2D6CE';
        c.fillRect(0, 0, w, h);
        c.strokeStyle = '#C89D8C';
        c.lineWidth = 6;
        c.strokeRect(5, 5, w - 10, h - 10);
        text(c, 'GLOW STUDIO', w / 2, h / 2 + 2, 54, {
          weight: 700,
          color: '#3A2A27',
          align: 'center',
          base: 'middle',
          spacing: 5
        });
      });
      R.glowParapetFront = atlas.add(520, 96, (c, w, h) => {
        c.fillStyle = '#F2D6CE';
        c.fillRect(0, 0, w, h);
        c.strokeStyle = '#C89D8C';
        c.lineWidth = 5;
        c.strokeRect(4, 4, w - 8, h - 8);
        text(c, 'BEAUTY & GLOW', w / 2, h / 2 + 2, 44, {
          weight: 700,
          color: '#3A2A27',
          align: 'center',
          base: 'middle',
          spacing: 4
        });
      });
      R.glowParapetSide = atlas.add(460, 96, (c, w, h) => {
        c.fillStyle = '#F2D6CE';
        c.fillRect(0, 0, w, h);
        c.strokeStyle = '#C89D8C';
        c.lineWidth = 5;
        c.strokeRect(4, 4, w - 8, h - 8);
        text(c, 'BEAUTY & CARE', w / 2, h / 2 + 2, 42, {
          weight: 700,
          color: '#3A2A27',
          align: 'center',
          base: 'middle',
          spacing: 3.5
        });
      });
      R.glowAFrame = atlas.add(220, 280, (c, w, h) => {
        c.fillStyle = '#FAF3EB';
        c.fillRect(0, 0, w, h);
        c.strokeStyle = '#C89D8C';
        c.lineWidth = 8;
        c.strokeRect(8, 8, w - 16, h - 16);
        c.fillStyle = '#F2D6CE';
        c.fillRect(20, 22, w - 40, 56);
        text(c, 'GLOW', w / 2, 42, 24, { weight: 700, color: '#3A2A27', align: 'center', base: 'middle', spacing: 2 });
        text(c, 'STUDIO', w / 2, 64, 20, { weight: 700, color: '#8A5647', align: 'center', base: 'middle', spacing: 2 });
        mark(c, lab.id, w / 2 - 36, 90, 72);
        text(c, 'SKINCARE', w / 2, 192, 22, { weight: 700, color: '#3A2A27', align: 'center', base: 'middle', spacing: 1.5 });
        text(c, '& MAKEUP', w / 2, 220, 22, { weight: 700, color: '#C46D5E', align: 'center', base: 'middle', spacing: 1.5 });
        text(c, 'NEW ARRIVALS →', w / 2, 250, 16, { weight: 700, color: '#6E5A54', align: 'center', base: 'middle' });
      });
    }
    if (style === 'pavilion') {
      R.cozyMainSign = atlas.add(580, 110, (c, w, h) => {
        c.fillStyle = '#FAF3E4';
        c.fillRect(0, 0, w, h);
        c.strokeStyle = '#9E7348';
        c.lineWidth = 8;
        c.strokeRect(5, 5, w - 10, h - 10);
        c.strokeStyle = '#4A3321';
        c.lineWidth = 3;
        c.strokeRect(12, 12, w - 24, h - 24);
        text(c, 'COZY BITES & SIPS', w / 2, h / 2 + 2, 50, {
          weight: 700,
          color: '#3D281A',
          align: 'center',
          base: 'middle',
          spacing: 3
        });
      });
      R.cozyChalkMenu = atlas.add(340, 190, (c, w, h) => {
        c.fillStyle = '#8C623B';
        c.fillRect(0, 0, w, h);
        c.fillStyle = '#242725';
        c.fillRect(10, 10, w - 20, h - 20);
        c.strokeStyle = '#D8C7A8';
        c.lineWidth = 2;
        c.strokeRect(16, 16, w - 32, h - 32);
        text(c, 'ESPRESSO & BAKERY', w / 2, 38, 20, {
          weight: 700,
          color: '#F5EAD6',
          align: 'center',
          base: 'middle',
          spacing: 2
        });
        c.fillStyle = '#D8C7A8';
        c.fillRect(32, 54, w - 64, 2);
        const rows = [
          ['Butter Croissant', '38K'],
          ['Iced Caramel Latte', '42K'],
          ['Sourdough Loaf', '58K'],
          ['Hot Cappuccino', '36K']
        ];
        rows.forEach(([l, r], idx) => {
          const ry = 76 + idx * 25;
          text(c, l, 28, ry, 16, { weight: 600, color: '#EFE4CE', base: 'middle' });
          text(c, r, w - 28, ry, 16, { weight: 700, color: '#F3C77E', align: 'right', base: 'middle' });
        });
      });
      R.cozyAFrame = atlas.add(220, 300, (c, w, h) => {
        c.fillStyle = '#3B2B20';
        c.fillRect(0, 0, w, h);
        c.fillStyle = '#222523';
        c.fillRect(12, 12, w - 24, h - 24);
        c.strokeStyle = '#E8DEC8';
        c.lineWidth = 2.5;
        c.strokeRect(18, 18, w - 36, h - 36);
        text(c, 'MENU', w / 2, 48, 30, {
          weight: 700,
          color: '#FFF7E8',
          align: 'center',
          base: 'middle',
          spacing: 3
        });
        c.fillStyle = '#E8DEC8';
        c.fillRect(36, 70, w - 72, 2.5);
        text(c, '• CROISSANT', 32, 102, 16, { weight: 700, color: '#F5E9D4', base: 'middle' });
        text(c, '• ESPRESSO', 32, 130, 16, { weight: 700, color: '#F5E9D4', base: 'middle' });
        text(c, '• SOURDOUGH', 32, 158, 16, { weight: 700, color: '#F5E9D4', base: 'middle' });
        text(c, '• ICED LATTE', 32, 186, 16, { weight: 700, color: '#F5E9D4', base: 'middle' });
        // Steaming coffee cup chalk illustration at bottom
        c.fillStyle = '#F3C77E';
        c.fillRect(w / 2 - 22, 222, 44, 28);
        c.strokeStyle = '#F3C77E';
        c.lineWidth = 4;
        c.strokeRect(w / 2 + 22, 226, 10, 16);
        c.fillRect(w / 2 - 30, 252, 60, 5);
      });
      R.cozyOpenSign = atlas.add(160, 96, (c, w, h) => {
        c.fillStyle = '#FAF3E4';
        c.fillRect(0, 0, w, h);
        c.strokeStyle = '#5C3D24';
        c.lineWidth = 6;
        c.strokeRect(4, 4, w - 8, h - 8);
        text(c, 'OPEN', w / 2, 36, 28, { weight: 700, color: '#3D281A', align: 'center', base: 'middle', spacing: 2 });
        text(c, 'ENTRY', w / 2, 68, 18, { weight: 700, color: '#8C5832', align: 'center', base: 'middle', spacing: 2 });
      });
      R.cozyClockFace = atlas.add(200, 200, (c, w, h) => {
        const cx = w / 2, cy = h / 2, r = w * 0.46;
        c.fillStyle = '#26282A';
        c.beginPath();
        c.arc(cx, cy, r + 4, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#FDF7E7';
        c.beginPath();
        c.arc(cx, cy, r - 4, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = '#B88B4A';
        c.lineWidth = 5;
        c.beginPath();
        c.arc(cx, cy, r - 4, 0, Math.PI * 2);
        c.stroke();
        c.strokeStyle = '#3D281A';
        c.lineWidth = 2;
        c.beginPath();
        c.arc(cx, cy, r - 13, 0, Math.PI * 2);
        c.stroke();
        // Minute & hour tick marks
        for (let i = 0; i < 60; i++) {
          const ang = (i * Math.PI) / 30;
          const isHour = i % 5 === 0;
          const r0 = isHour ? r - 23 : r - 18;
          const r1 = r - 13;
          c.strokeStyle = '#2C221E';
          c.lineWidth = isHour ? 3 : 1.3;
          c.beginPath();
          c.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0);
          c.lineTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1);
          c.stroke();
        }
        // Classic Roman numerals around dial
        const numerals = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
        numerals.forEach((num, idx) => {
          const ang = (idx * Math.PI) / 6 - Math.PI / 2;
          const rn = r - 35;
          text(c, num, cx + Math.cos(ang) * rn, cy + Math.sin(ang) * rn + 1, idx % 3 === 0 ? 15 : 12, {
            weight: 700,
            color: '#2C221E',
            align: 'center',
            base: 'middle'
          });
        });
        text(c, 'COZY BITES', cx, cy - 18, 9.5, { weight: 700, color: '#7A5230', align: 'center', base: 'middle', spacing: 1 });
        text(c, 'EST. 1924', cx, cy + 22, 8.5, { weight: 700, color: '#8C623B', align: 'center', base: 'middle', spacing: 1 });
        // Vintage clock hands (10:10 classic pose)
        c.strokeStyle = '#221C18';
        c.lineCap = 'round';
        // Hour hand
        c.lineWidth = 5.5;
        c.beginPath();
        c.moveTo(cx, cy);
        c.lineTo(cx - 28, cy - 18);
        c.stroke();
        // Minute hand
        c.lineWidth = 4;
        c.beginPath();
        c.moveTo(cx, cy);
        c.lineTo(cx + 36, cy - 22);
        c.stroke();
        // Brass center boss
        c.fillStyle = '#B88B4A';
        c.beginPath();
        c.arc(cx, cy, 6.5, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#2C221E';
        c.beginPath();
        c.arc(cx, cy, 3, 0, Math.PI * 2);
        c.fill();
      });
      R.cozyCartSign = atlas.add(220, 96, (c, w, h) => {
        c.fillStyle = '#6E4B2C';
        c.fillRect(0, 0, w, h);
        c.fillStyle = '#242725';
        c.fillRect(7, 7, w - 14, h - 14);
        c.strokeStyle = '#E8DEC8';
        c.lineWidth = 2;
        c.strokeRect(12, 12, w - 24, h - 24);
        text(c, 'FRESH BREAD', w / 2, 34, 20, { weight: 700, color: '#FFF7E8', align: 'center', base: 'middle', spacing: 2 });
        text(c, '& ARTISAN COFFEE', w / 2, 64, 15, { weight: 700, color: '#F3C77E', align: 'center', base: 'middle', spacing: 1.5 });
      });
      R.cozyTileBean = atlas.add(160, 160, (c, w, h) => {
        c.fillStyle = '#B59E80';
        c.fillRect(0, 0, w, h);
        c.fillStyle = '#E6D9C3';
        c.fillRect(6, 6, w - 12, h - 12);
        c.strokeStyle = '#C4AE90';
        c.lineWidth = 4;
        c.strokeRect(14, 14, w - 28, h - 28);
        // Golden-brown inlaid coffee beans relief
        const drawBean = (bx, by, rot) => {
          c.save();
          c.translate(bx, by);
          c.rotate(rot);
          c.fillStyle = '#9C6838';
          c.beginPath();
          c.ellipse(0, 0, 26, 18, 0, 0, Math.PI * 2);
          c.fill();
          c.strokeStyle = '#6B4422';
          c.lineWidth = 3;
          c.stroke();
          c.strokeStyle = '#4A2E15';
          c.lineWidth = 3.5;
          c.beginPath();
          c.moveTo(-20, -2);
          c.bezierCurveTo(-6, -10, 6, 10, 20, 2);
          c.stroke();
          c.restore();
        };
        drawBean(62, 66, -0.45);
        drawBean(102, 98, 0.35);
      });
      R.cozyTileLeaf = atlas.add(160, 160, (c, w, h) => {
        c.fillStyle = '#B59E80';
        c.fillRect(0, 0, w, h);
        c.fillStyle = '#E6D9C3';
        c.fillRect(6, 6, w - 12, h - 12);
        c.strokeStyle = '#C4AE90';
        c.lineWidth = 4;
        c.strokeRect(14, 14, w - 28, h - 28);
        // Golden-brown wheat / botanical leaf relief
        c.strokeStyle = '#8C5A2E';
        c.lineWidth = 5;
        c.lineCap = 'round';
        c.beginPath();
        c.moveTo(38, 122);
        c.quadraticCurveTo(76, 82, 122, 38);
        c.stroke();
        const leaves = [
          [60, 98, -0.95], [76, 102, 0.25],
          [78, 78, -0.95], [96, 82, 0.25],
          [98, 58, -0.95], [114, 62, 0.25],
          [118, 42, -0.35]
        ];
        leaves.forEach(([lx, ly, rot]) => {
          c.save();
          c.translate(lx, ly);
          c.rotate(rot);
          c.fillStyle = '#B88346';
          c.beginPath();
          c.ellipse(0, 0, 16, 7.5, 0, 0, Math.PI * 2);
          c.fill();
          c.strokeStyle = '#7A4C24';
          c.lineWidth = 2;
          c.stroke();
          c.restore();
        });
      });
    }
    if (style === 'brick') {
      R.apexFasciaSign = atlas.add(440, 88, (c, w, h) => {
        c.fillStyle = '#25282C';
        c.fillRect(0, 0, w, h);
        c.strokeStyle = '#3E434A';
        c.lineWidth = 4;
        c.strokeRect(3, 3, w - 6, h - 6);
        text(c, 'APEX SPORT', w / 2, h / 2 + 2, 46, {
          weight: 700,
          color: '#FFFFFF',
          align: 'center',
          base: 'middle',
          spacing: 5
        });
      });
      R.apexRoofBanner = atlas.add(680, 150, (c, w, h) => {
        // Sporty Blue background (#215DA6)
        c.fillStyle = '#215DA6';
        c.fillRect(0, 0, w, h);
        // Diagonal White & Orange racing stripes on the right side (#FFFFFF & #EB6B2A)
        c.fillStyle = '#FFFFFF';
        c.beginPath();
        c.moveTo(w - 190, h);
        c.lineTo(w - 115, 0);
        c.lineTo(w - 82, 0);
        c.lineTo(w - 157, h);
        c.closePath();
        c.fill();

        c.fillStyle = '#EB6B2A';
        c.beginPath();
        c.moveTo(w - 148, h);
        c.lineTo(w - 73, 0);
        c.lineTo(w, 0);
        c.lineTo(w, h);
        c.closePath();
        c.fill();

        // Dark charcoal steel border frame
        c.strokeStyle = '#222528';
        c.lineWidth = 10;
        c.strokeRect(5, 5, w - 10, h - 10);

        text(c, 'APEX SPORT', w * 0.37, 56, 48, {
          weight: 700,
          color: '#FFFFFF',
          align: 'center',
          base: 'middle',
          spacing: 4
        });
        text(c, 'PRO GEAR & TENNIS CLUB', w * 0.37, 108, 22, {
          weight: 700,
          color: '#DCEBFA',
          align: 'center',
          base: 'middle',
          spacing: 3
        });
      });
      R.apexDoorPoster = atlas.add(240, 340, (c, w, h) => {
        c.fillStyle = '#215DA6';
        c.fillRect(0, 0, w, h);
        // Diagonal Orange & White slash across upper-left to middle
        c.fillStyle = '#EB6B2A';
        c.beginPath();
        c.moveTo(0, 20);
        c.lineTo(w, 0);
        c.lineTo(0, 210);
        c.closePath();
        c.fill();
        c.fillStyle = '#FFFFFF';
        c.beginPath();
        c.moveTo(0, 200);
        c.lineTo(w, 12);
        c.lineTo(w, 38);
        c.lineTo(0, 228);
        c.closePath();
        c.fill();
        // Dynamic white athletic silhouette / graphic lines
        c.strokeStyle = '#FFFFFF';
        c.lineWidth = 6;
        c.beginPath();
        c.arc(w * 0.62, 145, 16, 0, Math.PI * 2);
        c.moveTo(w * 0.45, 195);
        c.lineTo(w * 0.72, 165);
        c.lineTo(w * 0.54, 245);
        c.stroke();
        text(c, 'RUN • COURT • PRO', w / 2, h - 34, 18, {
          weight: 700,
          color: '#FFFFFF',
          align: 'center',
          base: 'middle',
          spacing: 1.5
        });
      });
      R.apexPennant = atlas.add(140, 320, (c, w, h) => {
        // Sporty Blue background (#1E5AA8)
        c.fillStyle = '#1E5AA8';
        c.fillRect(0, 0, w, h);
        // Dynamic diagonal Orange (#E86826) & White racing stripes at bottom & top-right corner
        c.fillStyle = '#FFFFFF';
        c.beginPath();
        c.moveTo(0, h - 88);
        c.lineTo(w, h - 142);
        c.lineTo(w, h - 118);
        c.lineTo(0, h - 64);
        c.closePath();
        c.fill();
        c.fillStyle = '#E86826';
        c.beginPath();
        c.moveTo(0, h - 60);
        c.lineTo(w, h - 114);
        c.lineTo(w, h);
        c.lineTo(0, h);
        c.closePath();
        c.fill();
        // Top-right orange corner triangle accent
        c.beginPath();
        c.moveTo(w - 54, 0);
        c.lineTo(w, 0);
        c.lineTo(w, 54);
        c.closePath();
        c.fill();
        // Crisp inner white border
        c.strokeStyle = 'rgba(255,255,255,0.85)';
        c.lineWidth = 4;
        c.strokeRect(7, 7, w - 14, h - 14);
        // Vertical "APEX SPORT" typography
        c.save();
        c.translate(w * 0.44, h * 0.44);
        c.rotate(-Math.PI / 2);
        text(c, 'APEX SPORT', 0, 0, 26, {
          weight: 700,
          color: '#FFFFFF',
          align: 'center',
          base: 'middle',
          spacing: 3
        });
        c.restore();
        c.save();
        c.translate(w * 0.74, h * 0.44);
        c.rotate(-Math.PI / 2);
        text(c, 'PRO GEAR & CLUB', 0, 0, 12, {
          weight: 700,
          color: '#DCEBFA',
          align: 'center',
          base: 'middle',
          spacing: 1.5
        });
        c.restore();
      });
      R.apexChalkboard = atlas.add(200, 280, (c, w, h) => {
        c.fillStyle = '#7C5434';
        c.fillRect(0, 0, w, h);
        c.fillStyle = '#22262A';
        c.fillRect(12, 12, w - 24, h - 24);
        c.strokeStyle = '#E8DFCE';
        c.lineWidth = 2.5;
        c.strokeRect(18, 18, w - 36, h - 36);
        text(c, 'APEX SPORT', w / 2, 46, 22, {
          weight: 700,
          color: '#FFFFFF',
          align: 'center',
          base: 'middle',
          spacing: 2
        });
        c.fillStyle = '#EB6B2A';
        c.fillRect(32, 64, w - 64, 4);
        text(c, '• PRO TENNIS GEAR', 28, 96, 14, { weight: 700, color: '#F5E9D4', base: 'middle' });
        text(c, '• MARATHON SHOES', 28, 124, 14, { weight: 700, color: '#F5E9D4', base: 'middle' });
        text(c, '• PRO GAIT SCAN', 28, 152, 14, { weight: 700, color: '#88C4FF', base: 'middle' });
        text(c, '• TENNIS CLUB', 28, 180, 14, { weight: 700, color: '#F5E9D4', base: 'middle' });
        c.fillStyle = '#215DA6';
        c.fillRect(28, 208, w - 56, 36);
        text(c, 'OPEN DAILY →', w / 2, 226, 15, {
          weight: 700,
          color: '#FFFFFF',
          align: 'center',
          base: 'middle',
          spacing: 1.5
        });
      });
    }
    if (style === 'studio') {
      R.circuitFasciaSign = atlas.add(460, 88, (c, w, h) => {
        c.fillStyle = '#20242A';
        c.fillRect(0, 0, w, h);
        c.strokeStyle = '#E5B567';
        c.lineWidth = 5;
        c.strokeRect(4, 4, w - 8, h - 8);
        c.strokeStyle = '#525862';
        c.lineWidth = 2;
        c.strokeRect(10, 10, w - 20, h - 20);
        text(c, 'CIRCUIT & BYTE', w / 2, h / 2 + 2, 42, {
          weight: 700,
          color: '#FFF0CE',
          align: 'center',
          base: 'middle',
          spacing: 4
        });
      });

      R.circuitNeonBillboard = atlas.add(760, 280, (c, w, h) => {
        // Deep Midnight Tech Blue background (#0E1628 -> #16243E)
        const bg = c.createLinearGradient(0, 0, w, h);
        bg.addColorStop(0, '#0D1526');
        bg.addColorStop(0.5, '#152238');
        bg.addColorStop(1, '#0E172A');
        c.fillStyle = bg;
        c.fillRect(0, 0, w, h);

        // Subtle cyber grid lines
        c.strokeStyle = 'rgba(0, 240, 255, 0.08)';
        c.lineWidth = 1.5;
        for (let gx = 40; gx < w; gx += 40) {
          c.beginPath();
          c.moveTo(gx, 0);
          c.lineTo(gx, h);
          c.stroke();
        }
        for (let gy = 35; gy < h; gy += 35) {
          c.beginPath();
          c.moveTo(0, gy);
          c.lineTo(w, gy);
          c.stroke();
        }

        // Soft cyan & magenta ambient glow halos
        const glowL = c.createRadialGradient(155, 145, 10, 155, 145, 130);
        glowL.addColorStop(0, 'rgba(0, 240, 255, 0.28)');
        glowL.addColorStop(1, 'rgba(0, 240, 255, 0)');
        c.fillStyle = glowL;
        c.fillRect(0, 0, 320, h);

        const glowC = c.createRadialGradient(w / 2, 185, 8, w / 2, 185, 110);
        glowC.addColorStop(0, 'rgba(0, 240, 255, 0.25)');
        glowC.addColorStop(1, 'rgba(0, 240, 255, 0)');
        c.fillStyle = glowC;
        c.fillRect(240, 80, 280, h - 80);

        const glowR = c.createRadialGradient(605, 150, 12, 605, 150, 135);
        glowR.addColorStop(0, 'rgba(255, 51, 153, 0.24)');
        glowR.addColorStop(0.6, 'rgba(0, 240, 255, 0.16)');
        glowR.addColorStop(1, 'rgba(0, 240, 255, 0)');
        c.fillStyle = glowR;
        c.fillRect(460, 0, 300, h);

        // Helper for neon stroke
        const neonStroke = (drawFn, colOuter, colCore, wOuter = 9, wCore = 3.5) => {
          c.save();
          c.lineCap = 'round';
          c.lineJoin = 'round';
          c.strokeStyle = colOuter;
          c.lineWidth = wOuter;
          drawFn();
          c.stroke();
          c.strokeStyle = colCore;
          c.lineWidth = wCore;
          drawFn();
          c.stroke();
          c.restore();
        };

        // 1) LEFT ICON: Tilted Neon Smartphone + Earphones + Pink Badge
        c.save();
        c.translate(160, 142);
        c.rotate(-0.46);
        neonStroke(
          () => {
            c.beginPath();
            c.roundRect(-46, -86, 92, 172, 16);
          },
          'rgba(0, 240, 255, 0.45)',
          '#78FAFF',
          10,
          4
        );
        // Speaker notch
        neonStroke(
          () => {
            c.beginPath();
            c.moveTo(-14, -70);
            c.lineTo(14, -70);
          },
          'rgba(0, 240, 255, 0.4)',
          '#B8FFFF',
          6,
          2.5
        );
        // Glowing Pink & Cyan Earphones inside smartphone screen
        neonStroke(
          () => {
            c.beginPath();
            c.arc(-14, -18, 12, 0, Math.PI * 2);
            c.moveTo(-14, -6);
            c.lineTo(-14, 34);
            c.moveTo(14, -6);
            c.arc(14, -18, 12, 0, Math.PI * 2);
            c.moveTo(14, -6);
            c.lineTo(14, 34);
          },
          'rgba(255, 51, 153, 0.5)',
          '#FF85C8',
          8,
          3
        );
        c.restore();

        // Bottom-left neon pink circle icon
        neonStroke(
          () => {
            c.beginPath();
            c.arc(62, 212, 24, 0, Math.PI * 2);
          },
          'rgba(255, 51, 153, 0.48)',
          '#FF77C2',
          8,
          3
        );

        // 2) CENTER: "CIRCUIT & BYTE:" + "NEW TECH UNLOCKED" + TWS Earbuds in Charging Case
        text(c, 'CIRCUIT & BYTE:', w / 2, 54, 34, {
          weight: 700,
          color: '#00F0FF',
          align: 'center',
          base: 'middle',
          spacing: 2.5
        });
        text(c, 'CIRCUIT & BYTE:', w / 2, 54, 34, {
          weight: 700,
          color: '#E0FFFF',
          align: 'center',
          base: 'middle',
          spacing: 2.5
        });
        text(c, 'NEW TECH UNLOCKED', w / 2, 90, 17, {
          weight: 700,
          color: '#7CEEFF',
          align: 'center',
          base: 'middle',
          spacing: 2
        });

        // TWS Earbuds & Charging Case in lower center
        const cxE = w / 2, cyE = 198;
        neonStroke(
          () => {
            c.beginPath();
            c.roundRect(cxE - 44, cyE - 14, 88, 52, 22);
            c.moveTo(cxE - 42, cyE + 6);
            c.lineTo(cxE + 42, cyE + 6);
          },
          'rgba(0, 240, 255, 0.45)',
          '#88FAFF',
          9,
          3.5
        );
        // Left & Right TWS Earbuds popping out above case
        neonStroke(
          () => {
            c.beginPath();
            c.arc(cxE - 20, cyE - 34, 13, 0, Math.PI * 2);
            c.moveTo(cxE - 14, cyE - 24);
            c.lineTo(cxE - 14, cyE - 8);
            c.moveTo(cxE + 20, cyE - 21);
            c.arc(cxE + 20, cyE - 34, 13, 0, Math.PI * 2);
            c.moveTo(cxE + 14, cyE - 24);
            c.lineTo(cxE + 14, cyE - 8);
          },
          'rgba(0, 240, 255, 0.45)',
          '#B8FFFF',
          8,
          3
        );

        // 3) RIGHT ICON: Neon Gaming Controller (Gamepad) + Top-Right Pink Badge
        const gx = 596, gy = 168;
        neonStroke(
          () => {
            c.beginPath();
            c.moveTo(gx - 46, gy - 32);
            c.lineTo(gx + 46, gy - 32);
            c.quadraticCurveTo(gx + 76, gy - 32, gx + 82, gy + 18);
            c.quadraticCurveTo(gx + 84, gy + 54, gx + 56, gy + 52);
            c.quadraticCurveTo(gx + 38, gy + 50, gx + 26, gy + 20);
            c.lineTo(gx - 26, gy + 20);
            c.quadraticCurveTo(gx - 38, gy + 50, gx - 56, gy + 52);
            c.quadraticCurveTo(gx - 84, gy + 54, gx - 82, gy + 18);
            c.quadraticCurveTo(gx - 76, gy - 32, gx - 46, gy - 32);
            c.closePath();
          },
          'rgba(0, 240, 255, 0.48)',
          '#88FAFF',
          10,
          3.8
        );
        // D-Pad (Left) & Thumbsticks
        neonStroke(
          () => {
            c.beginPath();
            c.moveTo(gx - 44, gy - 12);
            c.lineTo(gx - 44, gy + 8);
            c.moveTo(gx - 54, gy - 2);
            c.lineTo(gx - 34, gy - 2);
            c.moveTo(gx - 12, gy + 6);
            c.arc(gx - 20, gy + 6, 8, 0, Math.PI * 2);
            c.moveTo(gx + 28, gy + 6);
            c.arc(gx + 20, gy + 6, 8, 0, Math.PI * 2);
          },
          'rgba(0, 240, 255, 0.45)',
          '#C8FFFF',
          6,
          2.5
        );
        // Pink Action Buttons on Right of Gamepad + Top-Right Pink Mini Badge
        neonStroke(
          () => {
            c.beginPath();
            c.arc(gx + 46, gy - 12, 4, 0, Math.PI * 2);
            c.moveTo(gx + 50, gy + 4);
            c.arc(gx + 46, gy + 4, 4, 0, Math.PI * 2);
            c.moveTo(gx + 42, gy - 4);
            c.arc(gx + 38, gy - 4, 4, 0, Math.PI * 2);
            c.moveTo(gx + 58, gy - 4);
            c.arc(gx + 54, gy - 4, 4, 0, Math.PI * 2);
            // Top-right mini controller badge
            c.moveTo(gx + 32, 46);
            c.roundRect(gx + 18, 36, 48, 30, 12);
          },
          'rgba(255, 51, 153, 0.55)',
          '#FF80C4',
          7,
          2.8
        );

        // Dark charcoal outer steel frame border
        c.strokeStyle = '#1E2229';
        c.lineWidth = 12;
        c.strokeRect(6, 6, w - 12, h - 12);
        c.strokeStyle = '#3A4352';
        c.lineWidth = 3;
        c.strokeRect(14, 14, w - 28, h - 28);
      });

      R.circuitKioskScreen = atlas.add(200, 300, (c, w, h) => {
        c.fillStyle = '#101A2E';
        c.fillRect(0, 0, w, h);
        c.fillStyle = '#00B8D4';
        c.fillRect(12, 14, w - 24, 44);
        text(c, 'CIRCUIT & BYTE', w / 2, 36, 17, {
          weight: 700,
          color: '#FFFFFF',
          align: 'center',
          base: 'middle'
        });
        c.strokeStyle = '#00F0FF';
        c.lineWidth = 3;
        c.strokeRect(14, 72, w - 28, 92);
        text(c, '3F NEON HUB', w / 2, 96, 15, { weight: 700, color: '#00F0FF', align: 'center', base: 'middle' });
        text(c, '2F AUDIO & GAMING', w / 2, 120, 14, { weight: 700, color: '#FF77C2', align: 'center', base: 'middle' });
        text(c, '1F SMARTPHONE & PC', w / 2, 144, 14, { weight: 700, color: '#FFE08A', align: 'center', base: 'middle' });
        c.fillStyle = '#1B2B48';
        c.fillRect(14, 178, w - 28, 98);
        text(c, 'TOUCH TO EXPLORE', w / 2, 212, 14, { weight: 700, color: '#FFFFFF', align: 'center', base: 'middle' });
        text(c, 'SHOP CATALOG →', w / 2, 242, 16, { weight: 700, color: '#00F0FF', align: 'center', base: 'middle' });
      });
    }
    if (style === 'strawberry') {
      R.scTeal = atlas.add(512, 96, (c, w, h) => {
        c.fillStyle = '#6fa596';
        c.fillRect(0, 0, w, h);
        for (let i = 0; i < 240; i++) {
          c.fillStyle = i % 3 === 0 ? '#8fb9aa88' : i % 3 === 1 ? '#d8ceb866' : '#4e7d7066';
          c.fillRect(rnd() * w, rnd() * h, 6 + rnd() * 18, 4 + rnd() * 10);
        }
        c.strokeStyle = '#4a776a';
        c.lineWidth = 4;
        c.strokeRect(4, 8, w - 8, h - 16);
      });
      R.scWin = atlas.add(512, 360, (c, w, h) => {
        const g = c.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#5a3828');
        g.addColorStop(0.65, '#8c583a');
        g.addColorStop(1, '#4a2e20');
        c.fillStyle = g;
        c.fillRect(0, 0, w, h);
        // Hanging strawberry heart garland at top
        c.strokeStyle = '#3b2316';
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(0, 36);
        c.quadraticCurveTo(w * 0.25, 78, w * 0.5, 42);
        c.quadraticCurveTo(w * 0.75, 78, w, 36);
        c.stroke();
        for (const hx of [65, 130, 195, 315, 380, 445]) {
          const hy = hx < 256 ? 48 + Math.sin(((hx - 30) / 200) * Math.PI) * 20 : 48 + Math.sin(((hx - 280) / 200) * Math.PI) * 20;
          c.fillStyle = '#d93829';
          c.beginPath();
          c.arc(hx, hy, 13, 0, Math.PI * 2);
          c.fill();
          c.fillStyle = '#4e8a45';
          c.fillRect(hx - 5, hy - 16, 10, 5);
        }
        // Wooden pastry display stands & strawberry treats
        for (const sx of [128, 384]) {
          c.fillStyle = '#b98252';
          c.fillRect(sx - 85, h - 75, 170, 16);
          c.fillRect(sx - 12, h - 60, 24, 60);
          c.fillStyle = '#f7efe0';
          c.fillRect(sx - 75, h - 83, 150, 8);
          for (let k = -2; k <= 2; k++) {
            c.fillStyle = '#fff5e6';
            c.fillRect(sx + k * 28 - 10, h - 103, 20, 20);
            c.fillStyle = '#d93829';
            c.beginPath();
            c.arc(sx + k * 28, h - 106, 8, 0, Math.PI * 2);
            c.fill();
          }
        }
      });
      R.scSideSign = atlas.add(320, 96, (c, w, h) => {
        paper(c, w, h, '#7fb0a0', '#486e62');
        text(c, 'STRAWBERRY', w / 2, h / 2 + 4, 34, { weight: 700, color: '#f9f3e6', align: 'center', base: 'middle', spacing: 2 });
      });
    }
    if (style === 'mayor') {
      R.mayorPlaque = atlas.add(420, 160, (c, w, h) => {
        c.fillStyle = '#7A5430';
        c.fillRect(0, 0, w, h);
        c.fillStyle = '#FFF8E7';
        c.fillRect(10, 10, w - 20, h - 20);
        c.strokeStyle = '#D4A24C';
        c.lineWidth = 5;
        c.strokeRect(16, 16, w - 32, h - 32);
        text(c, "MAYOR'S", w / 2, 68, 44, { weight: 700, color: '#261A10', align: 'center', spacing: 2 });
        text(c, 'OFFICE', w / 2, 122, 42, { weight: 700, color: '#261A10', align: 'center', spacing: 3 });
      });
      R.mayorClock = atlas.add(256, 256, (c, w, h) => {
        const cx0 = w / 2, cy0 = h / 2, r0 = w * 0.46;
        c.fillStyle = '#6E828A';
        c.fillRect(0, 0, w, h);
        c.fillStyle = '#b98940';
        c.beginPath();
        c.arc(cx0, cy0, r0 + 6, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#fdf6e4';
        c.beginPath();
        c.arc(cx0, cy0, r0 - 4, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = '#3b2c1e';
        c.lineWidth = 4;
        c.stroke();
        for (let k = 0; k < 12; k++) {
          const ang = (k / 12) * Math.PI * 2 - Math.PI / 2;
          const isQuarter = k % 3 === 0;
          const rIn = r0 - (isQuarter ? 26 : 18);
          const rOut = r0 - 8;
          c.strokeStyle = '#2e2218';
          c.lineWidth = isQuarter ? 5.5 : 3;
          c.beginPath();
          c.moveTo(cx0 + Math.cos(ang) * rIn, cy0 + Math.sin(ang) * rIn);
          c.lineTo(cx0 + Math.cos(ang) * rOut, cy0 + Math.sin(ang) * rOut);
          c.stroke();
        }
        c.fillStyle = '#b98940';
        c.beginPath();
        c.arc(cx0, cy0, 9, 0, Math.PI * 2);
        c.fill();
      });
      R.mayorCivicSeal = atlas.add(256, 256, (c, w, h) => {
        const cx0 = w / 2, cy0 = h / 2;
        // Stone border backdrop (#CFC0AE)
        c.fillStyle = '#CFC0AE';
        c.fillRect(0, 0, w, h);
        c.strokeStyle = '#8E7D6E';
        c.lineWidth = 6;
        c.strokeRect(6, 6, w - 12, h - 12);
        // Outer aged-bronze ring
        const grad = c.createRadialGradient(cx0 - 18, cy0 - 18, 12, cx0, cy0, 112);
        grad.addColorStop(0, '#E5BC68');
        grad.addColorStop(0.55, '#B5863C');
        grad.addColorStop(0.85, '#7A5624');
        grad.addColorStop(1, '#593D18');
        c.fillStyle = grad;
        c.beginPath();
        c.arc(cx0, cy0, 110, 0, Math.PI * 2);
        c.fill();
        // Double raised bronze concentric rings
        c.strokeStyle = '#F3D285';
        c.lineWidth = 5;
        c.beginPath();
        c.arc(cx0, cy0, 102, 0, Math.PI * 2);
        c.stroke();
        c.beginPath();
        c.arc(cx0, cy0, 76, 0, Math.PI * 2);
        c.stroke();
        // Dark patina inner field
        c.fillStyle = '#684920';
        c.beginPath();
        c.arc(cx0, cy0, 73, 0, Math.PI * 2);
        c.fill();
        // Radial notches in outer ring (representing commemorative lettering)
        c.strokeStyle = '#F3D285';
        c.lineWidth = 3;
        for (let k = 0; k < 24; k++) {
          const a = (k / 24) * Math.PI * 2;
          c.beginPath();
          c.moveTo(cx0 + Math.cos(a) * 83, cy0 + Math.sin(a) * 83);
          c.lineTo(cx0 + Math.cos(a) * 94, cy0 + Math.sin(a) * 94);
          c.stroke();
        }
        // Central relief civic shield, crown & laurel wreath
        c.fillStyle = '#E8BE6B';
        c.beginPath();
        c.moveTo(cx0 - 30, cy0 - 24);
        c.lineTo(cx0 + 30, cy0 - 24);
        c.lineTo(cx0 + 26, cy0 + 14);
        c.lineTo(cx0, cy0 + 40);
        c.lineTo(cx0 - 26, cy0 + 14);
        c.closePath();
        c.fill();
        // Crown above shield
        c.fillStyle = '#F6D88E';
        c.fillRect(cx0 - 22, cy0 - 42, 44, 12);
        // Lion / tower emblem inside shield
        c.fillStyle = '#684920';
        c.fillRect(cx0 - 8, cy0 - 14, 16, 30);
        c.fillRect(cx0 - 18, cy0 - 4, 36, 10);
      });
      R.mayorCivicNotice = atlas.add(240, 280, (c, w, h) => {
        c.fillStyle = '#F7EED8';
        c.fillRect(0, 0, w, h);
        c.strokeStyle = '#8C5C38';
        c.lineWidth = 8;
        c.strokeRect(6, 6, w - 12, h - 12);
        // Header banner
        c.fillStyle = '#2F4F38';
        c.fillRect(16, 16, w - 32, 42);
        text(c, 'CIVIC NOTICE', w / 2, 44, 22, { weight: 700, color: '#FAF3E0', align: 'center', spacing: 1 });
        // Two parchment notice sheets inside
        c.fillStyle = '#FFFBF0';
        c.fillRect(20, 68, 92, 186);
        c.fillRect(126, 68, 94, 118);
        c.strokeStyle = '#C9B694';
        c.lineWidth = 2;
        c.strokeRect(20, 68, 92, 186);
        c.strokeRect(126, 68, 94, 118);
        // Faux text lines
        c.fillStyle = '#5C4938';
        for (let r = 0; r < 9; r++) {
          c.fillRect(28, 80 + r * 16, r % 3 === 0 ? 64 : 74, 5);
        }
        for (let r = 0; r < 5; r++) {
          c.fillRect(134, 80 + r * 16, r % 2 === 0 ? 76 : 62, 5);
        }
        // Gold & red official wax seal at bottom right
        c.fillStyle = '#C84B31';
        c.beginPath();
        c.arc(173, 222, 22, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#E5B548';
        c.beginPath();
        c.arc(173, 222, 14, 0, Math.PI * 2);
        c.fill();
      });
    }
    atlas.flush();

    const b = new Batch();
    if (style === 'brick') {
      // ======================================================================
      // toko6 (lot 4): APEX SPORT (2-Story Modern Storybook Athletic Store + Outdoor Tennis Court)
      // 100% Faithful to the 4-Panel Architectural Concept Sheet:
      // 1) Widened Building Footprint (xL = -5.55..xR = 2.65, wB = 8.20) extending left (-X)
      //    toward the Outdoor Tennis Court (leaving a clean ~1.10-unit sidewalk walkway)
      // 2) Flush/Coplanar 1st-Floor Charcoal Steel Storefront Frame (#23262A) aligned
      //    with the 2nd-Floor outer wall (frontWallZ = 1.45, leftWallX = -5.55), with
      //    clear glass recessed only 0.05-0.08u behind the outer black frame
      // 3) 1.8-Unit Deep Illuminated Interior Display Box behind the Front & Left Side
      //    Glass Panes: 100% of merchandise (4 White Shoe Podiums, 4-Tier Wall Shoe Rack,
      //    Basketball Cage Rack, Tennis Ball Stand, and 5 Hanging Tennis Rackets) placed
      //    strictly BEHIND the glass (z = frontWallZ - 0.58 down to frontWallZ - 1.48)
      // 4) L-Shaped Metal & Ribbed-Glass Canopy at canY = 2.94 (cleanly above the
      //    APEX SPORT fascia sign) with perpendicular diagonal Tie-Rods anchoring into
      //    the solid wall band (anchorY = 3.46) below the 2nd-floor windows
      // 5) 4 U-Shaped Metal Pipe Bike Stands on the front-right sidewalk (~1.8 units
      //    away from the right wall xR, near the sidewalk curb edge) aligned in a neat row
      // ======================================================================
      // UNIFIED FULL-BLOCK SIDEWALK FOR POS 4 / APEX SPORT SUPERBLOCK:
      // 100% matching the geometric Granite Pavers (#D5D2CA & #C2BEB5 with #8F8B82 grout),
      // Stone Curb (#B6B2A8), Yellow Tactile Paving Strip (#E8C547), and
      // Terracotta Running & Bike Lane (#C85A3B) right under the foot of the building
      // across the entire 27.40 x 11.00 block (flush at y = 0.195)!
      // ======================================================================
      const apexGranitePaverTex = (() => {
        const S = 512;
        const c = document.createElement('canvas');
        c.width = c.height = S;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#CDC9C0';
        ctx.fillRect(0, 0, S, S);
        const cells = 4, step = S / cells;
        for (let gy = 0; gy < cells; gy++) {
          for (let gx = 0; gx < cells; gx++) {
            const isAlt = (gx + gy) % 2 === 0;
            ctx.fillStyle = isAlt ? '#D5D2CA' : '#C2BEB5';
            ctx.fillRect(gx * step + 3, gy * step + 3, step - 6, step - 6);
            // Subtle inner geometric border & stone mineral speckle
            ctx.strokeStyle = isAlt ? '#C8C4BC' : '#B5B1A8';
            ctx.lineWidth = 2;
            ctx.strokeRect(gx * step + 10, gy * step + 10, step - 20, step - 20);
          }
        }
        // Crisp dark stone grout joints
        ctx.strokeStyle = '#8F8B82';
        ctx.lineWidth = 5;
        for (let i = 0; i <= cells; i++) {
          const p = i * step;
          ctx.beginPath();
          ctx.moveTo(p, 0);
          ctx.lineTo(p, S);
          ctx.moveTo(0, p);
          ctx.lineTo(S, p);
          ctx.stroke();
        }
        const tex = new THREE.CanvasTexture(c);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 8;
        return tex;
      })();

      const apexBlockGraniteTex = apexGranitePaverTex.clone();
      apexBlockGraniteTex.wrapS = apexBlockGraniteTex.wrapT = THREE.RepeatWrapping;
      apexBlockGraniteTex.repeat.set(1 / 1.30, 1 / 1.30);
      apexBlockGraniteTex.needsUpdate = true;

      const apexTactileTex = (() => {
        const S = 256;
        const c = document.createElement('canvas');
        c.width = c.height = S;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#E8C547';
        ctx.fillRect(0, 0, S, S);
        ctx.strokeStyle = '#B89420';
        ctx.lineWidth = 6;
        ctx.strokeRect(3, 3, S - 6, S - 6);
        ctx.beginPath();
        ctx.moveTo(S / 2, 0);
        ctx.lineTo(S / 2, S);
        ctx.moveTo(0, S / 2);
        ctx.lineTo(S, S / 2);
        ctx.stroke();
        // Raised tactile blister domes grid
        for (let row = 0; row < 8; row++) {
          for (let col = 0; col < 8; col++) {
            const dx = (col + 0.5) * (S / 8);
            const dy = (row + 0.5) * (S / 8);
            ctx.fillStyle = '#B5901C';
            ctx.beginPath();
            ctx.arc(dx + 1.5, dy + 1.5, 9, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#F7DA68';
            ctx.beginPath();
            ctx.arc(dx - 1, dy - 1, 8.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        const tex = new THREE.CanvasTexture(c);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 8;
        return tex;
      })();

      const paverBoxGeo = (w, h, d, tileScale = 1.35) => {
        const geo = solid(new THREE.BoxGeometry(w, h, d));
        const pos = geo.attributes.position;
        const nrm = geo.attributes.normal;
        const uv = geo.attributes.uv;
        for (let i = 0; i < pos.count; i++) {
          if (Math.abs(nrm.getY(i)) > 0.5) {
            uv.setXY(i, (pos.getX(i) + w * 0.5) / tileScale, (pos.getZ(i) + d * 0.5) / tileScale);
          }
        }
        return geo;
      };

      const mBlockGranitePaver = mat('#FFFFFF', { map: apexBlockGraniteTex, roughness: 0.65 }, t);
      const mTactileYellow = mat(
        '#FFFFFF',
        {
          map: apexTactileTex,
          roughness: 0.68,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1
        },
        t
      );
      const mStreetCurb = mat('#B6B2A8', { roughness: 0.84 }, t);

      const villageOuterLot = new THREE.Group();
      villageOuterLot.position.copy(g.position);
      villageOuterLot.rotation.copy(g.rotation);
      world.add(villageOuterLot);
      const bLot = new Batch();

      // 1) Full-Block Main Pedestrian Sidewalk Deck (100% Flat Solid Surface at y = 0.18,
      //    Concrete Curb Rim at y = 0.19, and Yellow Tactile Paving at y = 0.195!)
      const blkX0 = -21.90, blkX1 = 5.50, blkZ0 = -5.50, blkZ1 = 5.50;
      const blkW = blkX1 - blkX0, blkD = blkZ1 - blkZ0; // 27.40 x 11.00
      const blkCX = (blkX0 + blkX1) / 2, blkCZ = (blkZ0 + blkZ1) / 2; // -8.20 (-A), 0.00
      const curbRimW = 0.14;
      bLot.add(mStreetCurb, hollowCurbRingGeo(blkW, blkD, 1.2, curbRimW, 0.190), blkCX, 0, blkCZ);
      bLot.add(mStreetCurb, roundedRectGeometry(blkW - curbRimW * 2, blkD - curbRimW * 2, 1.06, 0.155), blkCX, 0, blkCZ);
      bLot.add(mBlockGranitePaver, roundedRectGeometry(blkW - curbRimW * 2, blkD - curbRimW * 2, 1.06, 0.025), blkCX, 0.155, blkCZ);

      // 2) Full-Block Yellow Tactile Paving Strip (#E8C547 with blister dots) at y = 0.195 abutting directly inside the 0.14m Concrete Curb!
      const tacW = 0.18;
      const blkTacFB_W = blkW - 2.40;
      const blkTacLR_D = blkD - 2.40;
      const tacOff = curbRimW + tacW * 0.5; // 0.23m from outer curb face -> outer edge touches inner curb at 0.14m!
      bLot.add(mTactileYellow, paverBoxGeo(blkTacFB_W, 0.015, tacW, 0.36), blkCX, 0.1875, blkZ1 - tacOff); // Front (+Z, top = 0.195)
      bLot.add(mTactileYellow, paverBoxGeo(blkTacFB_W, 0.015, tacW, 0.36), blkCX, 0.1875, blkZ0 + tacOff); // Back (-Z, top = 0.195)
      bLot.add(mTactileYellow, paverBoxGeo(tacW, 0.015, blkTacLR_D, 0.36), blkX1 - tacOff, 0.1875, blkCZ); // Right (+X, top = 0.195)
      bLot.add(mTactileYellow, paverBoxGeo(tacW, 0.015, blkTacLR_D, 0.36), blkX0 + tacOff, 0.1875, blkCZ); // Left (-X, top = 0.195)

      buildOutdoorTennisCourt(bLot, villageOuterLot, S, M, t, apexGranitePaverTex);
      bLot.build(villageOuterLot);
      S.villageOuterLot = villageOuterLot;

      // Isolated Store Stage Base Group (hidden in Town View so the unified full-block sidewalk is 100% seamless;
      // shown when Store #5 is isolated in catalog view & preserves Box3 framing bounds)
      const stageBaseGroup = new THREE.Group();
      stageBaseGroup.visible = false;
      g.add(stageBaseGroup);
      const bStage = new Batch();
      const swX0 = -7.00, swX1 = 5.50, swZ0 = -5.50, swZ1 = 5.50;
      const swW = swX1 - swX0, swD = swZ1 - swZ0, swCX = (swX0 + swX1) / 2, swCZ = (swZ0 + swZ1) / 2;
      bStage.add(mStreetCurb, hollowCurbRingGeo(swW, swD, 1.0, curbRimW, 0.190), swCX, 0, swCZ);
      bStage.add(mStreetCurb, roundedRectGeometry(swW - curbRimW * 2, swD - curbRimW * 2, 0.86, 0.155), swCX, 0, swCZ);
      bStage.add(mBlockGranitePaver, roundedRectGeometry(swW - curbRimW * 2, swD - curbRimW * 2, 0.86, 0.025), swCX, 0.155, swCZ);
      bStage.add(mTactileYellow, paverBoxGeo(swW - 2.00, 0.015, tacW, 0.36), swCX, 0.1875, swZ1 - tacOff);
      bStage.add(mTactileYellow, paverBoxGeo(tacW, 0.015, swD - 2.00, 0.36), swX1 - tacOff, 0.1875, swCZ);
      bStage.build(stageBaseGroup);
      S.stageBaseGroup = stageBaseGroup;

      // Specialized Materials for APEX SPORT
      const mCreamWall = mat('#F2E9D8', { roughness: 0.84 }, t);
      const mCreamTrim = mat('#DCD2C0', { roughness: 0.80 }, t);
      const mCreamCornice = mat('#E6DDD0', { roughness: 0.78 }, t);
      const mCharcoalSteel = mat('#23262A', { roughness: 0.42, metalness: 0.45 }, t);
      const mDarkFrame = mat('#34383E', { roughness: 0.48, metalness: 0.36 }, t);
      const mBikeSteel = mat('#8A929A', { roughness: 0.32, metalness: 0.70 }, t);
      const mPedestalWhite = mat('#FAF9F5', { roughness: 0.38 }, t);
      const mSportBlue = mat('#215DA6', { roughness: 0.45 }, t);
      const mSportOrange = mat('#EB6B2A', { roughness: 0.45 }, t);
      const mTennisNeon = mat('#DDF042', { roughness: 0.50 }, t);
      const mShelfWood = mat('#C89D6C', { roughness: 0.72 }, t);
      const mVitrineFloor = mat(
        '#D8B58A',
        {
          roughness: 0.68,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1
        },
        t
      );

      const mVitrineLit = mat(
        '#FFF3D8',
        {
          emissive: '#FFC46B',
          emissiveIntensity: 1.15,
          roughness: 0.40
        },
        t
      );
      mVitrineLit.userData.noCast = true;
      registerWindowGlow(mVitrineLit, 1.15);

      const mApexSignMat = mat(
        '#FFFFFF',
        {
          map: atlas.tex,
          emissive: '#FFF5E4',
          emissiveMap: atlas.tex,
          emissiveIntensity: 0.52,
          roughness: 0.40
        },
        t
      );
      mApexSignMat.userData.noCast = true;
      mApexSignMat.userData.noReceive = true;

      const mCanopyGlass = new THREE.MeshStandardMaterial({
        color: 0xd6e8f5,
        emissive: 0xfff0d4,
        emissiveIntensity: 0.24,
        roughness: 0.16,
        metalness: 0.18,
        transparent: true,
        opacity: 0.50,
        depthWrite: false
      });
      mCanopyGlass.userData.noCast = true;

      const mStoreGlass = new THREE.MeshStandardMaterial({
        color: 0xfff2d6,
        emissive: 0xffc068,
        emissiveIntensity: 0.38,
        roughness: 0.1,
        metalness: 0.10,
        transparent: true,
        opacity: 0.38,
        depthWrite: false
      });
      mStoreGlass.userData.noCast = true;
      registerWindowGlow(mStoreGlass, 0.38);

      // Widened & Deepened Building Footprint Coordinates
      // Front Z (zF = +2.45) and Back Z (zB = -4.25) are 100% FLUSH / ALIGNED with the Tennis Court (fz0 = -4.25..fz1 = +2.45)!
      const xL = -5.55, xR = 2.65, wB = xR - xL, cxB = (xL + xR) / 2; // wB = 8.20, cxB = -1.45
      const zB = -4.25, zF = 2.45, dB = zF - zB, czB = (zB + zF) / 2; // dB = 6.70, czB = -0.90
      const frontWallZ = zF; // +2.45 (Outer Front Wall Plane — 100% Aligned with Tennis Court Front!)
      const leftWallX = xL;  // -5.55 (Outer Left Wall Plane — Closed Solid Cream Plaster facing Tennis Court)
      const rightWallX = xR; // +2.65 (Outer Right Wall Plane — Extended Side Display Window facing Main Street)
      const y0 = 0.18, y1 = 3.04, y2 = 5.56;
      const h1 = y1 - y0; // 2.86
      const h2 = y2 - y1; // 2.52

      // ----------------------------------------------------------------------
      // 1. STRUCTURAL WALLS & FLUSH 1ST-FLOOR BLACK FACADE FRAME (#23262A)
      //    - Left Wall (-X) is 100% Closed Warm Cream Plaster (with 1 rear service door)
      //    - Front (+Z) & Extended Right Side (+X) feature Flush Black Frame + 1.80u Deep Display Box!
      // ----------------------------------------------------------------------
      // Ground foundation plinth skirt (stepped below y = 0.24 so it never overlaps with interior floor or sidewalk!)
      b.box(mCreamTrim, cxB, y0 + 0.03, czB, wB + 0.12, 0.06, dB + 0.12);
      // Full-Footprint Stabilized Interior Ground Floor Slab at y = 0.24..0.28 (zero Z-fighting with plinth or sidewalk!)
      b.box(mVitrineFloor, cxB, y0 + 0.08, czB, wB - 0.18, 0.04, dB - 0.18);

      // Floor 2 Warm Stone-Cream Volume with 0.24m Recessed Window Alcove Core (so 2nd-floor glass at -0.05m
      // and light backdrop at -0.20m NEVER overlap or Z-fight with the solid wall!)
      const rec2 = 0.24;
      b.box(mCreamWall, cxB - rec2 * 0.5, y1 + h2 / 2, czB - rec2 * 0.5, wB - rec2, h2, dB - rec2);
      // Floor 2 Lower Spandrel Wall Band (y = y1..3.83) & Upper Spandrel Wall Band (y = 4.93..y2) flush at frontWallZ & rightWallX
      const w2Y0 = 3.83, w2Y1 = 4.93, w2H = w2Y1 - w2Y0, w2CY = (w2Y0 + w2Y1) / 2; // 4.38
      b.box(mCreamWall, cxB, (y1 + w2Y0) / 2, frontWallZ - rec2 * 0.5, wB, w2Y0 - y1, rec2);
      b.box(mCreamWall, cxB, (w2Y1 + y2) / 2, frontWallZ - rec2 * 0.5, wB, y2 - w2Y1, rec2);
      b.box(mCreamWall, rightWallX - rec2 * 0.5, (y1 + w2Y0) / 2, czB, rec2, w2Y0 - y1, dB);
      b.box(mCreamWall, rightWallX - rec2 * 0.5, (w2Y1 + y2) / 2, czB, rec2, y2 - w2Y1, dB);
      // Floor 2 Full-Depth Vertical Wall Piers between the 5 Front Windows (wx = [-4.53, -2.99, -1.45, 0.09, 1.63], uW = 0.82)
      const f2WinXs = [-4.53, -2.99, -1.45, 0.09, 1.63];
      const f2WinU = 0.82;
      let prevX = leftWallX;
      for (const wx of f2WinXs) {
        const xEnd = wx - f2WinU * 0.5;
        b.box(mCreamWall, (prevX + xEnd) * 0.5, w2CY, frontWallZ - rec2 * 0.5, xEnd - prevX, w2H, rec2);
        prevX = wx + f2WinU * 0.5;
      }
      b.box(mCreamWall, (prevX + rightWallX) * 0.5, w2CY, frontWallZ - rec2 * 0.5, rightWallX - prevX, w2H, rec2);
      // Floor 2 Full-Depth Vertical Wall Piers between the 3 Right-Side Windows (wz = [-2.95, -0.90, 1.15], uW = 0.82)
      const r2WinZs = [-2.95, -0.90, 1.15];
      let prevZ = zB;
      for (const wz of r2WinZs) {
        const zEnd = wz - f2WinU * 0.5;
        b.box(mCreamWall, rightWallX - rec2 * 0.5, w2CY, (prevZ + zEnd) * 0.5, rec2, w2H, zEnd - prevZ);
        prevZ = wz + f2WinU * 0.5;
      }
      b.box(mCreamWall, rightWallX - rec2 * 0.5, w2CY, (prevZ + frontWallZ) * 0.5, rec2, w2H, frontWallZ - prevZ);

      // Floor 1 Recessed Rear-Left Structural Core (leaving a 1.80-unit deep Interior Display Box at Front +Z & Right +X!)
      const vitDepth = 1.80;
      const zCoreF = frontWallZ - vitDepth; // +0.65 (1.80u behind frontWallZ!)
      const xCoreR = rightWallX - vitDepth; // +0.85 (1.80u inside rightWallX!)
      const coreW = xCoreR - leftWallX, coreCX = (leftWallX + xCoreR) / 2;
      const coreD = zCoreF - zB, coreCZ = (zB + zCoreF) / 2;
      b.box(mCreamWall, coreCX, y0 + h1 / 2, coreCZ, coreW, h1, coreD);

      // Floor 1 Left-Front Solid Wall Pilaster (closing the entire Left -X wall as solid cream plaster!)
      const cPierW = 0.38;
      const lfX1 = leftWallX + cPierW; // -5.17
      b.box(mCreamWall, (leftWallX + lfX1) / 2, y0 + h1 / 2, (zCoreF + frontWallZ) / 2, cPierW, h1, vitDepth);

      // Floor 1 Right-Rear Solid Wall Segment (x in [xCoreR, rightWallX], z in [zB = -4.25, -1.68])
      // Leaves z in [-1.64, frontWallZ - 0.38 = +2.07] (3.71u wide!) open for the Extended Right-Side Display Window!
      const rrZ0 = zB, rrZ1 = -1.68, rrD = rrZ1 - rrZ0, rrCZ = (rrZ0 + rrZ1) / 2;
      b.box(mCreamWall, (xCoreR + rightWallX) / 2, y0 + h1 / 2, rrCZ, vitDepth, h1, rrD);

      // Floor 1 Front-Right Corner Stone-Cream Structural Column (x in [rightWallX-0.38, rightWallX], z in [frontWallZ-0.38, frontWallZ])
      // Coplanar/flush with Floor 2's frontWallZ and rightWallX!
      b.box(mCreamWall, rightWallX - cPierW / 2, y0 + h1 / 2, frontWallZ - cPierW / 2, cPierW, h1, cPierW);

      // Floor 1 Coplanar Black Steel Storefront Frame (#23262A) on Front (+Z at frontWallZ) & Right Side (+X at rightWallX)
      const sfFrontX0 = leftWallX + cPierW;  // -5.17
      const sfFrontX1 = rightWallX - cPierW; // +2.27
      const sfFrontW = sfFrontX1 - sfFrontX0; // 7.44
      const sfFrontCX = (sfFrontX0 + sfFrontX1) / 2; // -1.45 === cxB!

      const winY0 = 0.52, winY1 = 2.34, winH = winY1 - winY0, winCY = (winY0 + winY1) / 2; // 1.43

      // Front Upper Black Fascia Band (y = winY1..y1 = 2.34..3.04) — FLUSH with frontWallZ!
      b.box(mCharcoalSteel, sfFrontCX, (winY1 + y1) / 2, frontWallZ - 0.06, sfFrontW, y1 - winY1, 0.12);
      // Front Lower Black Sill Skirt (y = y0..winY0 = 0.18..0.52) — FLUSH with frontWallZ!
      b.box(mCharcoalSteel, sfFrontCX, (y0 + winY0) / 2, frontWallZ - 0.06, sfFrontW, winY0 - y0, 0.12);

      // Extended Right Side (+X) Wrap-Around Upper Black Fascia & Lower Sill Skirt (z in [-1.64, frontWallZ - cPierW = +2.07]) — FLUSH with rightWallX!
      const swVitZ0 = -1.64, swVitZ1 = frontWallZ - cPierW; // -1.64..+2.07 (width 3.71u!)
      const swVitD = swVitZ1 - swVitZ0, swVitCZ = (swVitZ0 + swVitZ1) / 2; // swVitCZ = +0.215
      b.box(mCharcoalSteel, rightWallX - 0.06, (winY1 + y1) / 2, swVitCZ, 0.12, y1 - winY1, swVitD + 0.08);
      b.box(mCharcoalSteel, rightWallX - 0.06, (y0 + winY0) / 2, swVitCZ, 0.12, winY0 - y0, swVitD + 0.08);

      // Glowing White Embossed "APEX SPORT" Signage raised at y = 3.12 (>= 0.25m above Canopy at canY = 2.54!)
      // with 0.04m wall clearance/thickness in front of frontWallZ!
      b.box(mCharcoalSteel, cxB, 3.12, frontWallZ + 0.020, 2.56, 0.42, 0.04);
      b.panel(mApexSignMat, R.apexFasciaSign, cxB, 3.12, frontWallZ + 0.044, 2.46, 0.38);

      // ----------------------------------------------------------------------
      // 2. 1.8-UNIT DEEP INTERIOR DISPLAY BOX & MERCHANDISE (100% BEHIND THE GLASS!)
      //    - Front Glass Pane recessed 0.05m at z = frontWallZ - 0.05; Right Side Glass Pane at x = rightWallX - 0.05
      //    - Window Frames & Mullions protrude +0.03m in front of glass (z = frontWallZ - 0.02 / x = rightWallX - 0.02)
      //    - All Merchandise strictly >= 0.35m behind the glass!
      // ----------------------------------------------------------------------
      // Interior Display Box Floor (y = 0.50), Warm Lit Ceiling (y = 2.36), and Lit Back Walls (depth = 1.80u, non-overlapping at corner!)
      b.box(mVitrineFloor, sfFrontCX, winY0 - 0.01, frontWallZ - vitDepth / 2 - 0.04, sfFrontW - 0.08, 0.035, vitDepth - 0.12);
      b.box(mVitrineLit, sfFrontCX, winY1 + 0.02, frontWallZ - vitDepth / 2 - 0.04, sfFrontW - 0.08, 0.04, vitDepth - 0.12);
      // Back wall of Front Interior Display Box (at z = frontWallZ - 1.74 = -0.29)
      b.box(mVitrineLit, sfFrontCX, winCY, frontWallZ - 1.74, sfFrontW - 0.08, winH, 0.04);
      // Right-side (+X) Interior Display Box Floor, Ceiling & Back Wall (trimmed in Z so it never overlaps the Front Vitrine Floor!)
      const swVitZ1Trim = frontWallZ - vitDepth;
      const swVitDTrim = swVitZ1Trim - swVitZ0;
      const swVitCZTrim = (swVitZ0 + swVitZ1Trim) / 2;
      b.box(mVitrineFloor, rightWallX - vitDepth / 2 - 0.04, winY0 - 0.01, swVitCZTrim, vitDepth - 0.12, 0.035, swVitDTrim);
      b.box(mVitrineLit, rightWallX - vitDepth / 2 - 0.04, winY1 + 0.02, swVitCZTrim, vitDepth - 0.12, 0.04, swVitDTrim);
      b.box(mVitrineLit, rightWallX - 1.74, winCY, swVitCZ, 0.04, winH, swVitD - 0.08);

      // Warm Interior Display Box Ceiling LED Light Bars + Distance-Culled PointLight inside the Vitrine
      b.box(M.warm, cxB - 2.15, winY1 - 0.01, frontWallZ - 0.82, 2.20, 0.02, 0.10);
      b.box(M.warm, cxB + 2.15, winY1 - 0.01, frontWallZ - 0.82, 2.20, 0.02, 0.10);
      b.box(M.warm, rightWallX - 0.72, winY1 - 0.01, swVitCZ, 0.10, 0.02, swVitD - 0.28);
      addPolePointLight(g, cxB, 2.15, frontWallZ - 0.85, 1.35, 0xffe0a8, 6.5, 1.5, 0.55);

      // --- CENTER DOUBLE METAL-FRAMED ENTRANCE DOORS (centered at cxB = -1.45, width = 1.36) ---
      const doorW = 1.36, doorH = 2.12, doorCY = y0 + doorH / 2;
      const doorX0 = cxB - doorW / 2, doorX1 = cxB + doorW / 2;
      // Full-height charcoal steel divider piers flanking the entrance doors
      b.box(mCharcoalSteel, doorX0 - 0.04, y0 + h1 / 2, frontWallZ - 0.02, 0.10, h1, 0.04);
      b.box(mCharcoalSteel, doorX1 + 0.04, y0 + h1 / 2, frontWallZ - 0.02, 0.10, h1, 0.04);
      // Interior foyer partition walls & Diagonal Blue-Orange Athletic Poster set back at z = frontWallZ - 0.95 (>= 0.30m behind door glass!)
      b.box(mCreamWall, doorX0 - 0.04, winCY, frontWallZ - 0.94, 0.06, winH, 1.60);
      b.box(mCreamWall, doorX1 + 0.04, winCY, frontWallZ - 0.94, 0.06, winH, 1.60);
      b.panel(mApexSignMat, R.apexDoorPoster, cxB, doorCY + 0.06, frontWallZ - 0.95, doorW - 0.08, doorH - 0.12);
      // Clear Entrance Door Glass at z = frontWallZ - 0.05 (recessed 0.05m behind outer wall plane)
      b.box(mStoreGlass, cxB, doorCY + 0.06, frontWallZ - 0.05, doorW - 0.06, doorH - 0.10, 0.012);
      // Outer Charcoal Door Frame & Mullion at z = frontWallZ - 0.02 (+0.03m in front of glass!)
      b.box(mCharcoalSteel, cxB, y0 + doorH + 0.04, frontWallZ - 0.02, doorW + 0.10, 0.08, 0.028);
      b.box(mCharcoalSteel, cxB, doorCY, frontWallZ - 0.02, 0.06, doorH, 0.028);
      b.box(mDarkFrame, cxB, y0 + 0.18, frontWallZ - 0.02, doorW - 0.04, 0.30, 0.024);
      b.box(mBikeSteel, cxB - 0.09, y0 + 1.12, frontWallZ + 0.01, 0.025, 0.28, 0.03);
      b.box(mBikeSteel, cxB + 0.09, y0 + 1.12, frontWallZ + 0.01, 0.025, 0.28, 0.03);

      // --- LEFT VITRINE (x in [-5.12, -2.22], width = 2.90): RUNNING SHOE PODIUMS & WALL SHOE RACK ---
      const lwX0 = sfFrontX0 + 0.05, lwX1 = doorX0 - 0.09, lwW = lwX1 - lwX0, lwCX = (lwX0 + lwX1) / 2; // -3.67
      // 1) 4-Tier Illuminated Shoe Wall Rack on the Interior Back Wall (at z = frontWallZ - 1.42, 1.37m behind glass!)
      const zShoeRack = frontWallZ - 1.42;
      b.box(mCreamTrim, lwCX - 0.32, winCY, zShoeRack - 0.12, 1.88, winH - 0.12, 0.04);
      for (const sy of [1.02, 1.32, 1.62, 1.92]) {
        b.box(mShelfWood, lwCX - 0.32, sy, zShoeRack, 1.76, 0.035, 0.18);
        for (let k = 0; k < 4; k++) {
          const sx = lwCX - 0.98 + k * 0.44;
          const mShoe = (k + Math.round(sy * 3)) % 3 === 0 ? mSportOrange : (k + Math.round(sy * 3)) % 3 === 1 ? mSportBlue : mDarkFrame;
          b.box(mPedestalWhite, sx, sy + 0.03, zShoeRack + 0.02, 0.22, 0.03, 0.09);
          b.box(mShoe, sx - 0.01, sy + 0.07, zShoeRack + 0.02, 0.19, 0.065, 0.085, { rz: -0.15, r: 0.01 });
        }
      }
      // 2) Vertical Blue-Orange Athletic Poster inside the Right Side of the Left Vitrine (z = frontWallZ - 1.45, 1.40m behind glass!)
      b.panel(mApexSignMat, R.apexDoorPoster, lwX1 - 0.36, winCY + 0.04, frontWallZ - 1.45, 0.52, 1.42);

      // 3) 4 White Box Display Pedestals with Hero 3D Running Shoes at z = frontWallZ - 0.82 (>= 0.63m behind glass!)
      const zPodium = frontWallZ - 0.82;
      const pedSpecs = [
        [lwX0 + 0.42, 0.44, mSportOrange],
        [lwX0 + 1.08, 0.36, mSportBlue],
        [lwX0 + 1.74, 0.42, mDarkFrame],
        [lwX0 + 2.40, 0.38, mSportOrange]
      ];
      for (const [px, ph, mShoeHero] of pedSpecs) {
        b.box(mPedestalWhite, px, winY0 + ph / 2, zPodium, 0.38, ph, 0.26);
        b.box(mCreamTrim, px, winY0 + ph + 0.015, zPodium, 0.40, 0.025, 0.28);
        const sy0 = winY0 + ph + 0.045;
        b.box(mPedestalWhite, px, sy0, zPodium, 0.28, 0.04, 0.12, { r: 0.01 });
        b.box(mShoeHero, px - 0.02, sy0 + 0.055, zPodium, 0.24, 0.085, 0.11, { rz: -0.18, r: 0.015 });
        b.box(mPedestalWhite, px + 0.05, sy0 + 0.062, zPodium, 0.09, 0.022, 0.115, { rz: 0.35 });
      }

      // 4) Left Vitrine Clear Glass Pane recessed 0.05m (z = frontWallZ - 0.05) & Outer Black Frame +0.03m in front of glass (z = frontWallZ - 0.02)
      b.box(mStoreGlass, lwCX, winCY, frontWallZ - 0.05, lwW, winH, 0.012);
      b.box(mCharcoalSteel, lwCX, winY1 + 0.02, frontWallZ - 0.02, lwW + 0.08, 0.07, 0.028);
      b.box(mCharcoalSteel, lwCX, winY0 - 0.02, frontWallZ - 0.02, lwW + 0.08, 0.08, 0.028);
      b.box(mCharcoalSteel, lwX0, winCY, frontWallZ - 0.02, 0.08, winH + 0.08, 0.028);
      b.box(mCharcoalSteel, lwCX, winCY, frontWallZ - 0.02, 0.055, winH, 0.028);

      // --- RIGHT VITRINE (x in [-0.68, +2.22], width = 2.90): BASKETBALL CAGE RACK & HANGING TENNIS RACKETS ---
      const rwX0 = doorX1 + 0.09, rwX1 = sfFrontX1 - 0.05, rwW = rwX1 - rwX0, rwCX = (rwX0 + rwX1) / 2; // +0.77
      // 1) 5 Hanging 3D Tennis Rackets on the Interior Back Wall (at z = frontWallZ - 1.44, 1.39m behind glass!)
      const zRacketWall = frontWallZ - 1.44;
      b.box(mCreamTrim, rwCX, winCY, zRacketWall - 0.10, rwW - 0.24, winH - 0.12, 0.04);
      for (const [rx, rCol] of [
        [rwX0 + 0.44, mCharcoalSteel],
        [rwX0 + 0.94, mSportBlue],
        [rwX0 + 1.44, mSportOrange],
        [rwX0 + 1.94, mSportBlue],
        [rwX0 + 2.44, mCharcoalSteel]
      ]) {
        b.cyl(rCol, rx, 1.80, zRacketWall, 0.155, 0.035, { rx: Math.PI / 2, sy: 1.25 });
        b.cyl(mPedestalWhite, rx, 1.80, zRacketWall - 0.005, 0.128, 0.022, { rx: Math.PI / 2, sy: 1.25 });
        b.box(rCol, rx, 1.48, zRacketWall, 0.032, 0.30, 0.028);
        b.box(mShelfWood, rx, 1.30, zRacketWall + 0.005, 0.042, 0.18, 0.032);
      }

      // 2) 2-Tier Black Steel Basketball Cage Rack (with 8 3D Orange Basketballs) at z = frontWallZ - 0.84 (>= 0.66m behind glass!)
      const bbRackX = rwX0 + 0.92, zBallRack = frontWallZ - 0.84;
      b.box(mCharcoalSteel, bbRackX - 0.56, winY0 + 0.34, zBallRack, 0.04, 0.66, 0.26);
      b.box(mCharcoalSteel, bbRackX + 0.56, winY0 + 0.34, zBallRack, 0.04, 0.66, 0.26);
      b.box(mCharcoalSteel, bbRackX, winY0 + 0.22, zBallRack, 1.16, 0.035, 0.26);
      b.box(mCharcoalSteel, bbRackX, winY0 + 0.54, zBallRack, 1.16, 0.035, 0.26);
      for (const by0 of [winY0 + 0.34, winY0 + 0.66]) {
        for (const bx0 of [bbRackX - 0.39, bbRackX - 0.13, bbRackX + 0.13, bbRackX + 0.39]) {
          b.sphere(mSportOrange, bx0, by0, zBallRack, 0.105);
          b.box(mCharcoalSteel, bx0, by0, zBallRack + 0.10, 0.16, 0.015, 0.015);
        }
      }

      // 3) Upright Racket & Tennis Ball Can Display Stand at z = frontWallZ - 0.84 (right half of Right Vitrine)
      const standX = rwX0 + 2.18;
      b.box(mShelfWood, standX, winY0 + 0.20, zBallRack, 0.82, 0.36, 0.28);
      for (const tx of [standX - 0.24, standX, standX + 0.24]) {
        b.cyl(mSportBlue, tx, winY0 + 0.48, zBallRack, 0.048, 0.22);
        b.sphere(mTennisNeon, tx, winY0 + 0.62, zBallRack, 0.040);
      }

      // 4) Right Vitrine Clear Glass Pane recessed 0.05m (z = frontWallZ - 0.05) & Outer Black Frame +0.03m in front of glass (z = frontWallZ - 0.02)
      b.box(mStoreGlass, rwCX, winCY, frontWallZ - 0.05, rwW, winH, 0.012);
      b.box(mCharcoalSteel, rwCX, winY1 + 0.02, frontWallZ - 0.02, rwW + 0.08, 0.07, 0.028);
      b.box(mCharcoalSteel, rwCX, winY0 - 0.02, frontWallZ - 0.02, rwW + 0.08, 0.08, 0.028);
      b.box(mCharcoalSteel, rwX1, winCY, frontWallZ - 0.02, 0.08, winH + 0.08, 0.028);
      b.box(mCharcoalSteel, rwCX, winCY, frontWallZ - 0.02, 0.055, winH, 0.028);

      // --- EXTENDED RIGHT SIDE (+X) WRAP-AROUND VITRINE (x = rightWallX = +2.65, z in [-1.64, +2.07], width = 3.71u!) ---
      // 1) 3 White Shoe Pedestals & 3-Tier Extended Side Wall Gear Shelf placed strictly >= 0.60m INSIDE the right side glass
      const xSidePodium = rightWallX - 0.80; // +1.85 (0.75m behind right side glass at 2.60!)
      for (const [pz, mSh] of [[-1.02, mSportOrange], [0.22, mSportBlue], [1.42, mSportOrange]]) {
        b.box(mPedestalWhite, xSidePodium, winY0 + 0.20, pz, 0.26, 0.40, 0.36);
        b.box(mCreamTrim, xSidePodium, winY0 + 0.415, pz, 0.28, 0.025, 0.38);
        b.box(mPedestalWhite, xSidePodium, winY0 + 0.44, pz, 0.12, 0.035, 0.24);
        b.box(mSh, xSidePodium, winY0 + 0.49, pz + 0.01, 0.11, 0.075, 0.21, { rx: -0.16 });
      }
      // Interior wall shoe/gear rack inside the Extended Right Side Display Box (at x = rightWallX - 1.42 = +1.23)
      const xSideRack = rightWallX - 1.42;
      for (const sy of [1.08, 1.44, 1.80]) {
        b.box(mShelfWood, xSideRack, sy, swVitCZ, 0.18, 0.035, 2.52);
        for (const sz of [swVitCZ - 0.96, swVitCZ - 0.32, swVitCZ + 0.32, swVitCZ + 0.96]) {
          b.box(mPedestalWhite, xSideRack + 0.02, sy + 0.03, sz, 0.09, 0.03, 0.20);
          b.box(sy > 1.5 ? mSportOrange : mSportBlue, xSideRack + 0.02, sy + 0.07, sz, 0.085, 0.065, 0.18);
        }
      }
      // 2) Extended Right Side Vitrine Clear Glass Pane recessed 0.05m (x = rightWallX - 0.05) & Outer Black Frame +0.03m in front of glass (x = rightWallX - 0.02)
      b.box(mStoreGlass, rightWallX - 0.05, winCY, swVitCZ, 0.012, winH, swVitD);
      b.box(mCharcoalSteel, rightWallX - 0.02, winY1 + 0.02, swVitCZ, 0.028, 0.07, swVitD + 0.08);
      b.box(mCharcoalSteel, rightWallX - 0.02, winY0 - 0.02, swVitCZ, 0.028, 0.08, swVitD + 0.08);
      for (const mz of [swVitZ0, swVitZ0 + swVitD / 3, swVitZ0 + (2 * swVitD) / 3, swVitZ1]) {
        b.box(mCharcoalSteel, rightWallX - 0.02, winCY, mz, 0.028, winH + 0.08, 0.065);
      }

      // ----------------------------------------------------------------------
      // 3. PROPORTIONALLY WIDENED & EXTENDED U-SHAPED STEEL & GLASS CANOPY
      //    Wrapping Front Facade (+Z), Extended Right Side (+X), and Left Side (-X)
      //    - Canopy at canY = 2.54 (so "APEX SPORT" signage at y = 3.12 sits >= 0.35m cleanly ABOVE the canopy!)
      //    - Tie-Rods anchor at anchorY = 2.82 on the flanking piers (never cutting across "APEX SPORT"!)
      // ----------------------------------------------------------------------
      const canY = 2.54;
      const canOutZ = frontWallZ + 1.22;   // 3.67 (widened 1.22u front projection!)
      const canOutXR = rightWallX + 1.12;  // +3.77 (widened 1.12u right-side canopy over the extended +X display window!)
      const canOutXL = leftWallX - 0.96;   // -6.51 (proportional 0.96u left-side canopy wrap!)
      const canFX0 = canOutXL, canFX1 = canOutXR, canFW = canFX1 - canFX0, canFCX = (canFX0 + canFX1) / 2;
      const canFD = canOutZ - frontWallZ, canFCZ = (frontWallZ + canOutZ) / 2;

      // Front Canopy Outer Black Steel Fascia & Frame Beams
      b.box(mCharcoalSteel, canFCX, canY, canOutZ, canFW, 0.12, 0.08);
      b.box(mCharcoalSteel, canFX0, canY, canFCZ, 0.08, 0.12, canFD);
      b.box(mCharcoalSteel, canFX1, canY, canFCZ, 0.08, 0.12, canFD);
      b.box(mCharcoalSteel, cxB, canY + 0.02, frontWallZ + 0.04, wB, 0.09, 0.08);
      b.box(mCanopyGlass, canFCX, canY - 0.01, canFCZ, canFW - 0.08, 0.020, canFD - 0.08);
      const nCanRibsF = 18;
      for (let k = 0; k <= nCanRibsF; k++) {
        const rx = canFX0 + (k * canFW) / nCanRibsF;
        b.box(mCharcoalSteel, rx, canY + 0.02, canFCZ, k % 3 === 0 ? 0.065 : 0.028, 0.055, canFD);
      }
      // Under-Canopy Warm LED Display Illumination Strip (Front)
      b.box(M.warm, sfFrontCX, canY - 0.055, frontWallZ + 0.28, sfFrontW - 0.16, 0.024, 0.08);
      S.lights.push([new THREE.Vector3(lwCX, 2.35, frontWallZ + 0.65), '#ffdfa8', 4.8, 2.6]);
      S.lights.push([new THREE.Vector3(rwCX, 2.35, frontWallZ + 0.65), '#ffdfa8', 4.8, 2.6]);

      // Extended Right Side (+X) Wrap-Around Canopy Wing (x in [rightWallX, canOutXR], z in [-1.88, frontWallZ = +2.45])
      const canSZ0 = -1.88, canSZ1 = frontWallZ, canSD = canSZ1 - canSZ0, canSCZ = (canSZ0 + canSZ1) / 2;
      const canSWR = canOutXR - rightWallX, canSCXR = (rightWallX + canOutXR) / 2;
      b.box(mCharcoalSteel, canOutXR, canY, canSCZ, 0.08, 0.12, canSD);
      b.box(mCharcoalSteel, canSCXR, canY, canSZ0, canSWR, 0.12, 0.08);
      b.box(mCharcoalSteel, rightWallX + 0.04, canY + 0.02, canSCZ, 0.08, 0.09, canSD);
      b.box(mCanopyGlass, canSCXR, canY - 0.01, canSCZ, canSWR - 0.08, 0.020, canSD - 0.08);
      for (let k = 0; k <= 8; k++) {
        const rz = canSZ0 + (k * canSD) / 8;
        b.box(mCharcoalSteel, canSCXR, canY + 0.02, rz, canSWR, 0.055, k % 2 === 0 ? 0.055 : 0.028);
      }
      b.box(M.warm, rightWallX + 0.28, canY - 0.055, swVitCZ, 0.08, 0.024, swVitD - 0.16);
      S.lights.push([new THREE.Vector3(rightWallX + 0.65, 2.35, swVitCZ), '#ffdfa8', 4.6, 2.4]);

      // Extended Left Side (-X) Wrap-Around Canopy Wing (x in [canOutXL, leftWallX], z in [-1.88, frontWallZ = +2.45])
      const canSWL = leftWallX - canOutXL, canSCXL = (canOutXL + leftWallX) / 2;
      b.box(mCharcoalSteel, canOutXL, canY, canSCZ, 0.08, 0.12, canSD);
      b.box(mCharcoalSteel, canSCXL, canY, canSZ0, canSWL, 0.12, 0.08);
      b.box(mCharcoalSteel, leftWallX - 0.04, canY + 0.02, canSCZ, 0.08, 0.09, canSD);
      b.box(mCanopyGlass, canSCXL, canY - 0.01, canSCZ, canSWL - 0.08, 0.020, canSD - 0.08);
      for (let k = 0; k <= 8; k++) {
        const rz = canSZ0 + (k * canSD) / 8;
        b.box(mCharcoalSteel, canSCXL, canY + 0.02, rz, canSWL, 0.055, k % 2 === 0 ? 0.055 : 0.028);
      }

      // Exact Vector Helper for Canopy Diagonal Tie-Rods (guarantees 100% perpendicular wall anchoring!)
      const anchorY = 2.82;
      const addCanopyTieRod = (xOuter, yOuter, zOuter, xWall, yWall, zWall) => {
        const dx = xWall - xOuter, dy = yWall - yOuter, dz = zWall - zOuter;
        const len = Math.hypot(dx, dy, dz);
        const mx = (xOuter + xWall) / 2, my = (yOuter + yWall) / 2, mz = (zOuter + zWall) / 2;
        const dir = new THREE.Vector3(dx / len, dy / len, dz / len);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        const eu = new THREE.Euler().setFromQuaternion(q, 'YXZ');
        b.cyl(mCharcoalSteel, mx, my, mz, 0.022, len, { rx: eu.x, ry: eu.y, rz: eu.z });
      };

      // 4 Front Canopy Diagonal Tie-Rods flanking "APEX SPORT" signage (never cutting across the sign!)
      for (const tx of [-5.05, -3.35, 0.45, 2.15]) {
        b.box(mCharcoalSteel, tx, anchorY, frontWallZ + 0.02, 0.12, 0.14, 0.04);
        b.box(mCharcoalSteel, tx, canY + 0.06, canOutZ - 0.12, 0.08, 0.06, 0.08);
        addCanopyTieRod(tx, canY + 0.06, canOutZ - 0.12, tx, anchorY, frontWallZ + 0.02);
      }

      // 4 Right Side (+X) Canopy Diagonal Tie-Rods along the Extended Side Canopy
      for (const tz of [1.85, 0.68, -0.48, -1.64]) {
        b.box(mCharcoalSteel, rightWallX + 0.02, anchorY, tz, 0.04, 0.14, 0.12);
        b.box(mCharcoalSteel, canOutXR - 0.12, canY + 0.06, tz, 0.08, 0.06, 0.08);
        addCanopyTieRod(canOutXR - 0.12, canY + 0.06, tz, rightWallX + 0.02, anchorY, tz);
      }

      // 4 Left Side (-X) Canopy Diagonal Tie-Rods along the Extended Left Canopy
      for (const tz of [1.85, 0.68, -0.48, -1.64]) {
        b.box(mCharcoalSteel, leftWallX - 0.02, anchorY, tz, 0.04, 0.14, 0.12);
        b.box(mCharcoalSteel, canOutXL + 0.12, canY + 0.06, tz, 0.08, 0.06, 0.08);
        addCanopyTieRod(canOutXL + 0.12, canY + 0.06, tz, leftWallX - 0.02, anchorY, tz);
      }

      // ----------------------------------------------------------------------
      // 4. LANTAI 2 — WARM CREAM PLASTER (#F2E9D8), 5 FRONT WINDOWS, 3 RIGHT SIDE WINDOWS & CORNICE
      //    Strict 3-Layer Depth Separation:
      //    - Window Glass recessed 0.05m inward from outer wall (wz - 0.05 * dirSign)
      //    - Window Frames & Mullions protruding +0.03m in front of glass (wz - 0.02 * dirSign)
      //    - 2nd-Floor Light Panel/Backdrop recessed 0.16m (>= 0.15m) behind glass (wz - 0.21 * dirSign)
      // ----------------------------------------------------------------------
      // Horizontal belt molding between Floor 1 and Floor 2 (at y = 3.50, cleanly above APEX SPORT signage at 3.12!)
      b.box(mCreamTrim, cxB, 3.50, czB, wB + 0.14, 0.08, dB + 0.14);

      const addApexUpperWindow = (wx, wy, wz, axis = 'Z', dirSign = 1) => {
        const uW = 0.82, uH = 1.10; // wy = 4.38 -> bottom at 3.83, top at 4.93
        const gCoord = -0.05 * dirSign;  // Glass recessed 0.05m inward from outer wall
        const fCoord = -0.02 * dirSign;  // Mullions/frames +0.03m in front of glass
        const bCoord = -0.21 * dirSign;  // Light backdrop 0.16m (>= 0.15m) behind glass
        const trimCoord = 0.03 * dirSign;
        if (axis === 'Z') {
          b.box(mCreamTrim, wx, wy + uH / 2 + 0.05, wz + trimCoord, uW + 0.20, 0.08, 0.08);
          b.box(mCreamTrim, wx, wy - uH / 2 - 0.04, wz + trimCoord, uW + 0.22, 0.07, 0.10);
          // 1) Interior Light Backdrop 0.16m behind glass
          b.box(M.glowGlass, wx, wy, wz + bCoord, uW - 0.02, uH - 0.02, 0.02);
          // 2) Window Glass Pane recessed 0.05m inward from outer wall
          b.box(mStoreGlass, wx, wy, wz + gCoord, uW, uH, 0.012);
          // 3) Window Frames & Mullions +0.03m in front of glass
          b.box(mDarkFrame, wx - uW / 2, wy, wz + fCoord, 0.06, uH + 0.06, 0.028);
          b.box(mDarkFrame, wx + uW / 2, wy, wz + fCoord, 0.06, uH + 0.06, 0.028);
          b.box(mDarkFrame, wx, wy + uH / 2, wz + fCoord, uW + 0.08, 0.06, 0.028);
          b.box(mDarkFrame, wx, wy - uH / 2, wz + fCoord, uW + 0.08, 0.06, 0.028);
          b.box(mDarkFrame, wx, wy + 0.04, wz + fCoord, uW, 0.045, 0.028);
        } else {
          b.box(mCreamTrim, wx + trimCoord, wy + uH / 2 + 0.05, wz, 0.08, 0.08, uW + 0.20);
          b.box(mCreamTrim, wx + trimCoord, wy - uH / 2 - 0.04, wz, 0.10, 0.07, uW + 0.22);
          b.box(M.glowGlass, wx + bCoord, wy, wz, 0.02, uH - 0.02, uW - 0.02);
          b.box(mStoreGlass, wx + gCoord, wy, wz, 0.012, uH, uW);
          b.box(mDarkFrame, wx + fCoord, wy, wz - uW / 2, 0.028, uH + 0.06, 0.06);
          b.box(mDarkFrame, wx + fCoord, wy, wz + uW / 2, 0.028, uH + 0.06, 0.06);
          b.box(mDarkFrame, wx + fCoord, wy + uH / 2, wz, 0.028, 0.06, uW + 0.08);
          b.box(mDarkFrame, wx + fCoord, wy - uH / 2, wz, 0.028, 0.06, uW + 0.08);
          b.box(mDarkFrame, wx + fCoord, wy + 0.04, wz, 0.028, 0.045, uW);
        }
      };

      // 5 Evenly Spaced Vertical Windows across the Widened Lantai 2 Front Facade (wB = 8.20)
      for (const wx of [-4.53, -2.99, -1.45, 0.09, 1.63]) {
        addApexUpperWindow(wx, 4.38, frontWallZ, 'Z', 1);
      }
      // 3 Evenly Spaced Vertical Windows across the Deepened Lantai 2 Right Side Facade (+X, dB = 6.70)
      for (const wz of [-2.95, -0.90, 1.15]) {
        addApexUpperWindow(rightWallX, 4.38, wz, 'X', 1);
      }

      // 1st-Floor Side Service Door ("Side Entrance Access" in Side Profile Elevation) at rear side wall (z = -3.05)
      for (const [sx, dir] of [[leftWallX, -1], [rightWallX, 1]]) {
        b.box(mCharcoalSteel, sx + 0.02 * dir, y0 + 1.02, -3.05, 0.03, 2.04, 0.92);
        b.box(mDarkFrame, sx + 0.045 * dir, y0 + 0.98, -3.05, 0.025, 1.92, 0.78);
        b.box(M.glowGlass, sx + 0.072 * dir, y0 + 1.42, -3.05, 0.015, 0.74, 0.56);
        b.box(mCharcoalSteel, sx + 0.072 * dir, y0 + 0.54, -3.05, 0.018, 0.62, 0.56);
      }

      // Layered Horizontal Roof Cornice & Parapet (y = 5.42..5.88)
      b.box(mCreamTrim, cxB, y2 - 0.06, czB, wB + 0.18, 0.08, dB + 0.18);
      b.box(mCreamCornice, cxB, y2 + 0.08, czB, wB + 0.26, 0.16, dB + 0.26);
      b.box(mCreamTrim, cxB, y2 + 0.22, czB, wB + 0.34, 0.10, dB + 0.34);
      b.box(mCharcoalSteel, cxB, y2 + 0.28, czB, wB + 0.36, 0.03, dB + 0.36);
      const yRoofDeck = y2 + 0.30;
      b.box(mCreamTrim, cxB, yRoofDeck + 0.02, czB, wB - 0.20, 0.04, dB - 0.20);

      // ----------------------------------------------------------------------
      // 5. WIDENED ROOFTOP BANNER AD (APEX SPORT · PRO GEAR & TENNIS CLUB)
      // ----------------------------------------------------------------------
      const rbW = 6.84, rbH = 1.08, rbY = yRoofDeck + 0.58, rbZ = frontWallZ - 0.16;
      b.box(mCharcoalSteel, cxB, rbY, rbZ, rbW + 0.14, rbH + 0.12, 0.09, { r: 0.015 });
      b.panel(mApexSignMat, R.apexRoofBanner, cxB, rbY, rbZ + 0.065, rbW - 0.04, rbH - 0.04);
      // 5 Triangular Rear Steel Truss Struts supporting the Widened Rooftop Banner Ad
      for (const sx of [cxB - rbW / 2 + 0.16, cxB - 1.62, cxB, cxB + 1.62, cxB + rbW / 2 - 0.16]) {
        b.box(mCharcoalSteel, sx, yRoofDeck + 0.52, rbZ - 0.06, 0.045, 0.98, 0.045);
        b.box(mCharcoalSteel, sx, yRoofDeck + 0.48, rbZ - 0.44, 0.04, 0.04, 1.02, { rx: -0.78 });
        b.box(mCharcoalSteel, sx, yRoofDeck + 0.05, rbZ - 0.44, 0.04, 0.04, 0.80);
      }

      // ----------------------------------------------------------------------
      // 6. CURBSIDE AMENITY ZONE & STREETSCAPE FURNITURE
      //    (100% Aligned along the Sidewalk Curb Edge — Zero Obstruction to Pedestrians!)
      // ----------------------------------------------------------------------
      const mHardwood = mat('#B87D4B', { roughness: 0.72 }, t);
      const mPlanterConcrete = mat('#B8BCB9', { roughness: 0.82 }, t);
      const mPlanterRim = mat('#C8CCC9', { roughness: 0.78 }, t);
      const mPlanterSoil = mat('#4A3B2F', { roughness: 0.92 }, t);
      const mGrassBlade1 = mat('#4E7E3E', { roughness: 0.78, flatShading: true }, t);
      const mGrassBlade2 = mat('#669A50', { roughness: 0.76, flatShading: true }, t);
      const mGrassBlade3 = mat('#7EB264', { roughness: 0.76, flatShading: true }, t);
      const mTreeBark = mat('#6E4E34', { roughness: 0.86 }, t);
      const mBollardOrange = patch(
        new THREE.MeshStandardMaterial({
          color: '#FFF4D8',
          emissive: new THREE.Color('#FFD89B'),
          emissiveIntensity: 0.9,
          roughness: 0.35
        }),
        t
      );
      bollardMaterials.push(mBollardOrange);
      const mWaterBottleBlue = mat('#2166B8', { roughness: 0.28, metalness: 0.15 }, t);

      // (A) Modern Hardwood Runner's Benches (#B87D4B slats + #25282C black steel frame)
      //     + Blue Sport Water Bottle on the Front Bench (extended across the entire Pos 5 block!)
      const addRunnerBench = (bx, bz, ry = 0, hasBottle = false, targetGroup = g) => {
        const bg = new THREE.Group();
        bg.position.set(bx, y0, bz);
        bg.rotation.y = ry;
        const bB = new Batch();
        const bLen = 1.32, bDep = 0.44, seatY = 0.38;
        // 3 Matte-black steel leg & armrest frames (#25282C)
        for (const lx of [-bLen * 0.44, 0, bLen * 0.44]) {
          bB.box(mCharcoalSteel, lx, seatY * 0.5, -bDep * 0.38, 0.045, seatY, 0.045);
          bB.box(mCharcoalSteel, lx, seatY * 0.5, bDep * 0.38, 0.045, seatY, 0.045);
          bB.box(mCharcoalSteel, lx, seatY - 0.02, 0, 0.045, 0.04, bDep * 0.84);
          bB.box(mCharcoalSteel, lx, seatY + 0.22, -bDep * 0.40, 0.045, 0.44, 0.04, { rx: -0.16 });
        }
        // End armrests
        for (const lx of [-bLen * 0.44, bLen * 0.44]) {
          bB.box(mCharcoalSteel, lx, seatY + 0.16, 0.02, 0.048, 0.032, bDep * 0.78);
          bB.box(mCharcoalSteel, lx, seatY + 0.08, bDep * 0.38, 0.042, 0.16, 0.042);
        }
        // 4 Warm Hardwood Seat Slats (#B87D4B)
        for (let s = 0; s < 4; s++) {
          const sz = -bDep * 0.30 + s * 0.10;
          bB.box(mHardwood, 0, seatY + 0.02, sz, bLen, 0.032, 0.078, { r: 0.008 });
        }
        // 3 Warm Hardwood Backrest Slats (#B87D4B)
        for (let s = 0; s < 3; s++) {
          const sy = seatY + 0.12 + s * 0.105;
          const sz = -bDep * 0.39 - s * 0.016;
          bB.box(mHardwood, 0, sy, sz, bLen, 0.078, 0.028, { rx: -0.16, r: 0.008 });
        }
        // Blue Sport Water Bottle on the right side of the front bench seat
        if (hasBottle) {
          const btx = 0.36, btz = 0.02, bty = seatY + 0.036;
          bB.cyl(mWaterBottleBlue, btx, bty + 0.095, btz, 0.042, 0.19);
          bB.cyl(mPedestalWhite, btx, bty + 0.11, btz, 0.044, 0.032);
          bB.cyl(mCharcoalSteel, btx, bty + 0.205, btz, 0.034, 0.032);
          bB.cyl(mSportOrange, btx, bty + 0.23, btz, 0.012, 0.025);
        }
        bB.build(bg);
        targetGroup.add(bg);
      };
      // Single Wooden Bench under Apex Sport pulled FLUSH against the front glass facade (frontWallZ = 2.45 -> z = 2.73),
      // leaving > 80% of the front sidewalk and 100% of the right/left sidewalks wide open!
      addRunnerBench(0.77, frontWallZ + 0.28, 0, true, g);

      // (B) Slim Square Concrete Planters (#B8BCB9, max 0.64m x 0.64m <= 0.7m x 0.7m), Cast-Iron Tree Grates, Ornamental Spiky Grass & Lush Street Trees
      const addUrbanPlanter = (px, pz, pw = 0.64, pd = 0.64, ph = 0.44, hasTree = false, targetGroup = g) => {
        const pg = new THREE.Group();
        pg.position.set(px, y0, pz);
        const bP = new Batch();
        // Recessed dark plinth base + Modern architectural concrete box (#B8BCB9) + Top rim + Cast-Iron Tree Grate frame
        bP.box(mDarkFrame, 0, 0.025, 0, pw + 0.08, 0.03, pd + 0.08);
        bP.box(mPlanterConcrete, 0, ph * 0.5 + 0.02, 0, pw, ph - 0.04, pd, { r: 0.02 });
        bP.box(mPlanterRim, 0, ph + 0.01, 0, pw + 0.04, 0.04, pd + 0.04);
        bP.box(mPlanterSoil, 0, ph - 0.01, 0, pw - 0.08, 0.03, pd - 0.08);
        if (hasTree) {
          // Cast-iron tree grate bars (#23262A) at top of planter around the tree trunk
          for (const goff of [-0.18, -0.09, 0.09, 0.18]) {
            bP.box(mCharcoalSteel, goff, ph + 0.018, 0, 0.022, 0.014, pd - 0.10);
            bP.box(mCharcoalSteel, 0, ph + 0.018, goff, pw - 0.10, 0.014, 0.022);
          }
        }

        // Ornamental Spiky Grass (fanning upward green blades)
        const nBlades = hasTree ? 14 : 18;
        for (let k = 0; k < nBlades; k++) {
          const ang = (k / nBlades) * Math.PI * 2 + (k % 3) * 0.2;
          const rad = (hasTree ? 0.16 : 0.08) + (k % 3) * 0.06;
          const gx = Math.cos(ang) * Math.min(rad, pw * 0.36);
          const gz = Math.sin(ang) * Math.min(rad, pd * 0.36);
          const bh = 0.26 + (k % 4) * 0.065;
          const tilt = 0.22 + (k % 3) * 0.12;
          const mBl = k % 3 === 0 ? mGrassBlade1 : k % 3 === 1 ? mGrassBlade2 : mGrassBlade3;
          bP.box(mBl, gx, ph + bh * 0.45, gz, 0.032, bh, 0.018, {
            rx: Math.sin(ang) * tilt,
            ry: ang,
            rz: -Math.cos(ang) * tilt
          });
        }

        // Lush Multi-Branched Street Tree
        if (hasTree) {
          const trunkH = 1.38;
          bP.cyl(mTreeBark, 0, ph + trunkH * 0.5, 0, 0.068, trunkH);
          // 3 angled upper wooden branches
          bP.cyl(mTreeBark, -0.14, ph + trunkH + 0.12, 0.06, 0.038, 0.44, { rz: 0.48, rx: 0.18 });
          bP.cyl(mTreeBark, 0.15, ph + trunkH + 0.10, -0.05, 0.036, 0.42, { rz: -0.50, rx: -0.16 });
          bP.cyl(mTreeBark, 0.02, ph + trunkH + 0.16, 0.14, 0.035, 0.40, { rx: 0.46 });
          // Layered organic green foliage canopy crowns
          const crowns = [
            [0, ph + trunkH + 0.52, 0, 0.58, 0.48, 0.56, mGrassBlade2, 0.2],
            [-0.28, ph + trunkH + 0.36, 0.14, 0.42, 0.36, 0.40, mGrassBlade1, 1.1],
            [0.30, ph + trunkH + 0.38, -0.10, 0.44, 0.38, 0.42, mGrassBlade3, 2.0],
            [0.08, ph + trunkH + 0.40, 0.28, 0.40, 0.34, 0.38, mGrassBlade2, 0.7],
            [-0.12, ph + trunkH + 0.42, -0.26, 0.42, 0.35, 0.40, mGrassBlade1, 1.6],
            [0, ph + trunkH + 0.82, 0, 0.42, 0.36, 0.42, mGrassBlade3, 2.5]
          ];
          for (const [cx0, cy0, cz0, sx0, sy0, sz0, mCr, ry0] of crowns) {
            bP.crown(mCr, cx0, cy0, cz0, sx0, sy0, sz0, ry0);
          }
        }
        bP.build(pg);
        targetGroup.add(pg);
      };

      // Only 2 Slim (0.64m x 0.64m <= 0.7m x 0.7m) Tree Planters tucked at the rear wall corners of Apex Sport (0 mid-sidewalk trees!)
      addUrbanPlanter(rightWallX + 0.36, -3.88, 0.64, 0.64, 0.44, true, g);
      addUrbanPlanter(leftWallX - 0.36, -3.88, 0.64, 0.64, 0.44, true, g);
      // Single slim rear corner tree planter at the far-west rear corner of the Pos 5 Superblock
      addUrbanPlanter(-20.36, -3.88, 0.64, 0.64, 0.44, true, villageOuterLot);

      // (C) Integrated U-Shaped Metal Bike Racks (#8A929A) + Proportional 1.62x Parked Bicycles
      const addUBikeStand = (bx, bz, ry = 0, targetGroup = g) => {
        const bg = new THREE.Group();
        bg.position.set(bx, y0, bz);
        bg.rotation.y = ry;
        const bU = new Batch();
        const standW = 0.56, standH = 0.68, rTube = 0.032;
        bU.cyl(mBikeSteel, -standW / 2, standH / 2, 0, rTube, standH);
        bU.cyl(mBikeSteel, standW / 2, standH / 2, 0, rTube, standH);
        bU.cyl(mCharcoalSteel, -standW / 2, 0.015, 0, 0.064, 0.03);
        bU.cyl(mCharcoalSteel, standW / 2, 0.015, 0, 0.064, 0.03);
        const archGeo = new THREE.TorusGeometry(standW / 2, rTube, 10, 20, Math.PI);
        bU.add(mBikeSteel, solid(archGeo), 0, standH, 0);
        bU.build(bg);
        targetGroup.add(bg);
      };
      const addParkedBicycle = (bx, bz, ry = 0, mFrame = mSportOrange, targetGroup = g) => {
        const pkg = new THREE.Group();
        pkg.position.set(bx, y0, bz);
        pkg.rotation.y = ry;
        const bBk = new Batch();
        const rWheel = 0.185; // Tire bottom sits 100% flush at y = 0.000 on sidewalk surface y0!
        for (const wz of [-0.31, 0.31]) {
          bBk.cyl(mDarkFrame, 0, rWheel, wz, rWheel, 0.042, { rz: Math.PI / 2 });
          bBk.cyl(mBikeSteel, 0, rWheel, wz, 0.125, 0.046, { rz: Math.PI / 2 });
        }
        // Tubular diamond frame, seatpost + saddle (y = 0.52), headtube + handlebars (y = 0.59)
        bBk.box(mFrame, 0, 0.34, 0, 0.036, 0.036, 0.56, { rx: -0.14 });
        bBk.box(mFrame, 0, 0.28, -0.14, 0.032, 0.032, 0.36, { rx: 0.42 });
        bBk.cyl(mFrame, 0, 0.36, -0.08, 0.022, 0.32, { rx: -0.22 });
        bBk.cyl(mFrame, 0, 0.38, 0.24, 0.022, 0.38, { rx: -0.20 });
        bBk.box(mCharcoalSteel, 0, 0.53, -0.13, 0.10, 0.042, 0.17, { r: 0.015 });
        bBk.cyl(mBikeSteel, 0, 0.59, 0.22, 0.018, 0.38, { rz: Math.PI / 2 });
        bBk.cyl(mCharcoalSteel, -0.17, 0.59, 0.22, 0.022, 0.08, { rz: Math.PI / 2 });
        bBk.cyl(mCharcoalSteel, 0.17, 0.59, 0.22, 0.022, 0.08, { rz: Math.PI / 2 });
        bBk.build(pkg);
        targetGroup.add(pkg);
      };
      // Only 1 Bike Rack + 1 Parked Bicycle at the outer right-rear side corner curb edge of Apex Sport (x = 5.04, z = -2.25..-1.35)
      for (const bz of [-2.25, -1.80, -1.35]) {
        addUBikeStand(5.04, bz, Math.PI / 2, g);
      }
      addParkedBicycle(4.94, -1.80, 0, mSportBlue, g);

      // (D) Sleek Curved LED Streetlamps with Vertical Blue-Orange "APEX SPORT" Street Pennant Banner
      const addApexStreetlamp = (lx, lz, ry = 0, targetGroup = g) => {
        const lg = new THREE.Group();
        lg.position.set(lx, y0, lz);
        lg.rotation.y = ry;
        const bL = new Batch();
        const poleH = 4.15;
        // Molded dark steel base plinth & tall vertical pole
        bL.cyl(mCharcoalSteel, 0, 0.08, 0, 0.115, 0.16);
        bL.cyl(mCharcoalSteel, 0, 0.24, 0, 0.086, 0.22);
        bL.cyl(mCharcoalSteel, 0, poleH * 0.5, 0, 0.048, poleH);
        // Seamless collar joint at top of vertical pole
        bL.cyl(mCharcoalSteel, 0, poleH - 0.02, 0, 0.058, 0.08);

        // Continuous 1-piece Curved Gooseneck Arm (TubeGeometry starting inside the pole top at y = poleH - 0.10!)
        const armCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, poleH - 0.10, 0),
          new THREE.Vector3(0, poleH + 0.02, 0),
          new THREE.Vector3(0.08, poleH + 0.20, 0),
          new THREE.Vector3(0.28, poleH + 0.32, 0),
          new THREE.Vector3(0.54, poleH + 0.35, 0),
          new THREE.Vector3(0.74, poleH + 0.33, 0)
        ]);
        const armGeo = solid(new THREE.TubeGeometry(armCurve, 18, 0.036, 10, false));
        bL.add(mCharcoalSteel, armGeo, 0, 0, 0);

        // Streamlined LED Luminaire Head directly attached to the end of the curved arm (0.74, poleH + 0.33, 0)
        bL.cyl(mCharcoalSteel, 0.64, poleH + 0.34, 0, 0.046, 0.12, { rz: Math.PI / 2 });
        bL.box(mCharcoalSteel, 0.78, poleH + 0.33, 0, 0.34, 0.055, 0.16, { rz: -0.08, r: 0.015 });
        bL.box(M.warm, 0.78, poleH + 0.30, 0, 0.26, 0.018, 0.12, { rz: -0.08 });

        // Vertical Street Pennant Banner ("APEX SPORT", #1E5AA8 Blue & #E86826 Orange)
        const penW = 0.44, penH = 1.04, penY = 2.62, penX = 0.055 + penW / 2; // 0.275
        const yRodTop = penY + penH / 2 + 0.02, yRodBot = penY - penH / 2 - 0.02;
        const rodLen = penW + 0.11;
        for (const ry0 of [yRodTop, yRodBot]) {
          bL.cyl(mCharcoalSteel, 0, ry0, 0, 0.064, 0.048); // Pole clamp collar
          bL.cyl(mCharcoalSteel, rodLen / 2, ry0, 0, 0.018, rodLen, { rz: Math.PI / 2 }); // Continuous horizontal rod from pole center
          bL.sphere(mCharcoalSteel, rodLen, ry0, 0, 0.026); // Finial tip
        }
        bL.box(mSportBlue, penX, penY, 0, penW, penH, 0.014);
        bL.panel(mApexSignMat, R.apexPennant, penX, penY, 0.010, penW, penH, 0);
        bL.panel(mApexSignMat, R.apexPennant, penX, penY, -0.010, penW, penH, Math.PI);
        bL.build(lg);
        targetGroup.add(lg);
        addPolePointLight(lg, 0.78, poleH + 0.18, 0, 1.0, '#FFD89B', 9, 2.0, index);
        if (targetGroup === g) {
          S.lights.push([new THREE.Vector3(lx + Math.cos(ry) * 0.78, poleH + 0.18, lz - Math.sin(ry) * 0.78), '#FFD89B', 4.2, 2.1]);
        }
      };
      // Exactly 4 Streetlamps at the Outer Curb Corners of Store #5 (Apex Sport, ~0.35m from outer curb edge, arms pointing outward to the street!)
      addApexStreetlamp(-6.42, 5.12, -Math.PI / 2, g);                // Front-Left Outer Curb Edge (arm points outward +Z toward front street)
      addApexStreetlamp(4.92, 4.92, -Math.PI / 4, g);                 // Front-Right Outer Curb Corner (arm points outward +X/+Z toward street)
      addApexStreetlamp(-6.42, -5.12, Math.PI / 2, villageOuterLot);  // Back-Left Outer Curb Edge (arm points outward -Z toward rear street)
      addApexStreetlamp(4.92, -4.92, Math.PI / 4, g);                 // Back-Right Outer Curb Corner (arm points outward +X/-Z toward street)

      // Clean Queue Path on the unobstructed central granite pedestrian walkway
      S.queuePath = [
        [cxB, 3.05], [cxB - 2.10, 3.05], [cxB - 2.10, 3.35], [cxB + 1.80, 3.35]
      ];
      b.build(g);

      const occluder = new THREE.Mesh(unitBox, linkProbe);
      occluder.visible = false;
      occluder.position.set(cxB, (H + 0.4) / 2, czB);
      occluder.scale.set(wB + 0.9, H + 0.4, dB + 0.9);
      occluder.userData.store = index;
      villageOuterLot.add(occluder);
      links.push(occluder);

      for (const L of S.lights) {
        g.localToWorld(L[0]);
        addLight(L[0], L[1], L[2], L[3], index);
      }
      S.focus = g.localToWorld(new THREE.Vector3(cxB, 2.85, 0.45));
      S.label = g.localToWorld(new THREE.Vector3(cxB, H + 0.85, czB));
      stores.push(S);
      return;
    }

    if (style === 'gable') {
      // ======================================================================
      // STORE #1: GLOW STUDIO — BEAUTY & CARE (Chic Parisian-Modern Beauty Boutique)
      // 100% Faithful to the 4-Panel Architectural Concept Sheet:
      // 1) Lantai 1: Curved Front-Left Corner Storefront (Warm Ivory #FAF3EB,
      //    Soft Blush Pink Baseboard & Curved Fascia #F2D6CE, Rose-Tan Moldings #C89D8C),
      //    GLOW STUDIO Fascia Signage on Front & Side, Curved Panoramic Display Windows
      //    with Warm Glowing 3D Beauty Interior (Lighted Vanity Mirror with 12 LED Bulbs,
      //    Round Island Counter with Makeup Brush Stand & Tabletop Mirror, Arched Shelving
      //    Niches with Pastel Skincare & Perfume Bottles, Hanging Gold Pendant Lamps),
      //    Rose-Wood Entrance Doors, Sleek Modern Awnings, Gold Wall Sconces, and
      //    White-Potted Round Topiary Bushes.
      // 2) Lantai 2: Set-back Chic Arched Windows (3 on Front, 1 on Side) with French
      //    Mullions, Wrap-Around Balcony with Modern Black Iron Balustrade, Potted Olive
      //    Trees & Balcony Shrubs, and Left-Side Vertical Downspout Pipe.
      // 3) Rooftop: Soft Blush Pink Parapet with "BEAUTY & GLOW" (Front) and "BEAUTY & CARE"
      //    (Side) Plaques + Rooftop Studio & Garden (Green Lawn Carpet, Plush Blush Pink
      //    Lounge Sofa, Round Table with 3 Lounge Chairs, and Perimeter Planter Boxes).
      // 4) Clean Sidewalk: 2 Folding A-Frame Menu Signboards + 2 Outer Corner Street Lamps.
      // ======================================================================
      const glowTerrazzoTex = (() => {
        const S = 512;
        const c = document.createElement('canvas');
        c.width = c.height = S;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#EAE3D9';
        ctx.fillRect(0, 0, S, S);
        // Subtle fine terrazzo mineral chips
        const chipColors = ['#DFD6C9', '#D6CABB', '#F4EFE7', '#CBBBA8'];
        for (let i = 0; i < 420; i++) {
          ctx.fillStyle = chipColors[i % 4];
          const rx = ((i * 73) % (S - 8)) + 4;
          const ry = ((i * 137) % (S - 8)) + 4;
          ctx.fillRect(rx, ry, 2 + (i % 3), 2 + ((i + 1) % 3));
        }
        // Large-format 2x2 square terrazzo slab grid with crisp thin joints
        ctx.strokeStyle = '#BFB5A7';
        ctx.lineWidth = 4;
        for (const p of [0, S / 2, S]) {
          ctx.beginPath();
          ctx.moveTo(p, 0);
          ctx.lineTo(p, S);
          ctx.moveTo(0, p);
          ctx.lineTo(S, p);
          ctx.stroke();
        }
        const tex = new THREE.CanvasTexture(c);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 8;
        return tex;
      })();

      const terrazzoDeckGeo = (w, h, d, scale = 1.65) => {
        const geo = solid(new THREE.BoxGeometry(w, h, d));
        const pos = geo.attributes.position;
        const nrm = geo.attributes.normal;
        const uv = geo.attributes.uv;
        for (let i = 0; i < pos.count; i++) {
          if (Math.abs(nrm.getY(i)) > 0.5) {
            uv.setXY(i, (pos.getX(i) + w * 0.5) / scale, (pos.getZ(i) + d * 0.5) / scale);
          }
        }
        return geo;
      };

      const mTerrazzoPaver = mat('#FFFFFF', { map: glowTerrazzoTex, roughness: 0.65 }, t);
      const mTerrazzoCurb = mat('#D8CFC2', { roughness: 0.74 }, t);
      const mGlowTactile = mat(
        '#E5CE9E',
        {
          roughness: 0.65,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1
        },
        t
      );
      const mLinearGroundLED = patch(
        new THREE.MeshStandardMaterial({
          color: '#FFF6DE',
          emissive: new THREE.Color('#FFD89B'),
          emissiveIntensity: 0.9,
          roughness: 0.35,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1
        }),
        t
      );
      mLinearGroundLED.userData.noCast = true;
      mLinearGroundLED.userData.noReceive = true;
      bollardMaterials.push(mLinearGroundLED);

      const ySW = 0.18;
      const villageOuterLot = new THREE.Group();
      villageOuterLot.position.copy(g.position);
      villageOuterLot.rotation.copy(g.rotation);
      world.add(villageOuterLot);
      const bLot = new Batch();

      // 1) Full-Block Warm-Cream Terrazzo Pedestrian Sidewalk Deck:
      //    - Outer Curb Rim at y = 0.190 (hollowCurbRingGeo, zero overlap with inner tiles)
      //    - Inner Terrazzo Sidewalk Base Tile at ySW = 0.180
      //    - Tactile Paving Strip at y = 0.195
      const terrazzoLotGeo = (sz, r, depth, scale = 1.60) => {
        const geo = lotGeometry(sz, r, depth);
        const pos = geo.attributes.position;
        const nrm = geo.attributes.normal;
        const uv = geo.attributes.uv;
        for (let i = 0; i < pos.count; i++) {
          if (Math.abs(nrm.getY(i)) > 0.5) {
            uv.setXY(i, (pos.getX(i) + sz * 0.5) / scale, (pos.getZ(i) + sz * 0.5) / scale);
          }
        }
        return geo;
      };
      const curbRimW = 0.14;
      const blkHalf = BLOCK * 0.5 - curbRimW; // 5.36m inner terrazzo edge
      bLot.add(mTerrazzoCurb, hollowCurbRingGeo(BLOCK, BLOCK, 1.2, curbRimW, 0.190), 0, 0, 0);
      bLot.add(mTerrazzoCurb, roundedRectGeometry(BLOCK - curbRimW * 2, BLOCK - curbRimW * 2, 1.06, 0.155), 0, 0, 0);
      bLot.add(mTerrazzoPaver, terrazzoLotGeo(BLOCK - curbRimW * 2, 1.06, 0.025, 1.60), 0, 0.155, 0);

      // 2) Tactile / Border Strip at y = 0.195 abutting directly inside the 0.14m Stone Curb with zero gap!
      const tacW = 0.16;
      const tacPos = BLOCK * 0.5 - curbRimW - tacW * 0.5;
      const tacSpan = BLOCK - 2.40;
      bLot.box(M.tactileYellow, 0, 0.1875, tacPos, tacSpan, 0.015, tacW);
      bLot.box(M.tactileYellow, 0, 0.1875, -tacPos, tacSpan, 0.015, tacW);
      bLot.box(M.tactileYellow, tacPos, 0.1875, 0, tacW, 0.015, tacSpan);
      bLot.box(M.tactileYellow, -tacPos, 0.1875, 0, tacW, 0.015, tacSpan);

      bLot.build(villageOuterLot);
      S.villageOuterLot = villageOuterLot;

      const mGlowSignPanel = mat(
        '#FAF3EB',
        {
          map: atlas.tex,
          roughness: 0.42,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2
        },
        t
      );
      mGlowSignPanel.userData.noCast = true;

      // Chic Parisian-Modern Palette Materials
      const mIvoryWall = mat('#FAF3EB', { roughness: 0.82 }, t);
      const mIvoryTrim = mat('#F3E8DC', { roughness: 0.78 }, t);
      const mBlushPink = mat('#F2D6CE', { roughness: 0.76 }, t);
      const mBlushDeep = mat('#E5B8AD', { roughness: 0.74 }, t);
      const mRoseTan = mat('#C89D8C', { roughness: 0.72 }, t);
      const mRoseWood = mat('#9E6B55', { roughness: 0.70 }, t);
      const mGold = mat('#D8AE5E', { roughness: 0.30, metalness: 0.72 }, t);
      const mIron = mat('#2B2728', { roughness: 0.46, metalness: 0.42 }, t);
      const mPipeGrey = mat('#B7ACA4', { roughness: 0.55, metalness: 0.28 }, t);
      const mAwningCream = mat('#FCF8F2', { roughness: 0.68 }, t);
      const mWhitePot = mat('#F8F4EE', { roughness: 0.72 }, t);
      const mLeaf = mat('#5A8A4E', { roughness: 0.76, flatShading: true }, t);
      const mLeafOlive = mat('#789E68', { roughness: 0.74, flatShading: true }, t);
      const mLawnGreen = mat('#6C9A58', { roughness: 0.88 }, t);
      const mSoil = mat('#5C4334', { roughness: 0.92 }, t);

      // Showcase Interior & Product Materials (with polygonOffset & >= 0.08m depth separation to prevent Z-fighting)
      const mIntBackdrop = mat(
        '#FFF1D6',
        {
          emissive: '#FFBC64',
          emissiveIntensity: 0.98,
          roughness: 0.52,
          polygonOffset: true,
          polygonOffsetFactor: 1,
          polygonOffsetUnits: 1
        },
        t
      );
      registerWindowGlow(mIntBackdrop, 0.98);
      const mIntBlushNiche = mat(
        '#FADCD0',
        {
          emissive: '#FFB68E',
          emissiveIntensity: 0.78,
          roughness: 0.56,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1
        },
        t
      );
      registerWindowGlow(mIntBlushNiche, 0.78);
      const mIntCounter = mat('#FDF5E8', { emissive: '#FFD296', emissiveIntensity: 0.62, roughness: 0.50 }, t);
      registerWindowGlow(mIntCounter, 0.62);
      const mMirrorGlass = mat(
        '#E8F4FA',
        {
          emissive: '#FFF4E4',
          emissiveIntensity: 0.65,
          roughness: 0.14,
          metalness: 0.35
        },
        t
      );
      const mStoneArchTrim = mat('#E6D2C4', { roughness: 0.76 }, t);
      const mArchedGlass = mat(
        '#FFE5AC',
        {
          emissive: '#FFB048',
          emissiveIntensity: 1.08,
          roughness: 0.22,
          metalness: 0.06
        },
        t
      );
      mArchedGlass.userData.noCast = true;
      registerWindowGlow(mArchedGlass, 1.08);

      const mBottleCoral = mat('#E47A6E', { roughness: 0.35 }, t);
      const mBottleLav = mat('#B89CE0', { roughness: 0.35 }, t);
      const mBottleMint = mat('#82C4B2', { roughness: 0.35 }, t);
      const mBottleGold = mat('#E8BE6A', { roughness: 0.32, metalness: 0.45 }, t);
      const mWindowClear = new THREE.MeshStandardMaterial({
        color: 0xfff0d0,
        emissive: 0xffbe64,
        emissiveIntensity: 0.40,
        roughness: 0.14,
        metalness: 0.06,
        transparent: true,
        opacity: 0.38,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      mWindowClear.userData.noCast = true;
      registerWindowGlow(mWindowClear, 0.40);

      // Helper: White-Potted Round Topiary Bush or Olive Tree
      const addWhitePotPlant = (px, py, pz, rPot = 0.22, isOliveTree = false) => {
        b.cyl(mWhitePot, px, py + rPot * 0.62, pz, rPot, rPot * 1.24);
        b.cyl(mRoseTan, px, py + rPot * 1.22, pz, rPot * 1.06, 0.04);
        b.cyl(mSoil, px, py + rPot * 1.25, pz, rPot * 0.90, 0.02);
        if (isOliveTree) {
          b.cyl(mRoseWood, px, py + rPot * 1.25 + 0.36, pz, 0.038, 0.72);
          b.crown(mLeafOlive, px, py + rPot * 1.25 + 0.78, pz, rPot * 1.38, rPot * 1.32, rPot * 1.38, 1);
          b.crown(mLeaf, px + 0.08, py + rPot * 1.25 + 0.90, pz - 0.06, rPot * 0.95, rPot * 0.92, rPot * 0.95, 2);
        } else {
          b.crown(mLeaf, px, py + rPot * 1.25 + rPot * 0.95, pz, rPot * 1.18, rPot * 1.22, rPot * 1.18, 1);
          b.crown(mLeafOlive, px - 0.05, py + rPot * 1.25 + rPot * 1.25, pz + 0.04, rPot * 0.82, rPot * 0.82, rPot * 0.82, 2);
        }
      };

      // Helper: Cylindrical Gold Wall Sconce (Lampu Dinding Silinder Emas)
      const addGoldWallSconce = (lx, ly, lz, faceAxis = 'Z', dirSign = 1) => {
        const off1 = 0.06 * dirSign;
        const off2 = 0.14 * dirSign;
        if (faceAxis === 'Z') {
          b.box(mGold, lx, ly, lz + off1, 0.08, 0.12, 0.10);
          b.cyl(mGold, lx, ly + 0.10, lz + off2, 0.065, 0.14);
          b.cyl(mGold, lx, ly - 0.10, lz + off2, 0.065, 0.14);
          b.cyl(M.bulb, lx, ly, lz + off2, 0.058, 0.10);
          S.lights.push([new THREE.Vector3(lx, ly, lz + 0.32 * dirSign), '#ffcf8c', 3.2, 2.0]);
        } else {
          b.box(mGold, lx + off1, ly, lz, 0.10, 0.12, 0.08);
          b.cyl(mGold, lx + off2, ly + 0.10, lz, 0.065, 0.14);
          b.cyl(mGold, lx + off2, ly - 0.10, lz, 0.065, 0.14);
          b.cyl(M.bulb, lx + off2, ly, lz, 0.058, 0.10);
          S.lights.push([new THREE.Vector3(lx + 0.32 * dirSign, ly, lz), '#ffcf8c', 3.2, 2.0]);
        }
      };

      // ----------------------------------------------------------------------
      // 1. LANTAI 1 — 4-CORNER ROUNDED STOREFRONT & 3D BEAUTY DISPLAY INTERIOR
      // ----------------------------------------------------------------------
      const xL = -3.35, xR = 2.65, wB = xR - xL, cxB = (xL + xR) / 2; // wB = 6.00, cxB = -0.35
      const zB = -3.15, zF = 1.45, dB = zF - zB, czB = (zB + zF) / 2; // dB = 4.60, czB = -0.85
      const y0 = 0.16, y1 = 3.18;
      // Unified 4-Corner Radius across (a) Baseboard, (b) Lantai 1 Walls & Curved Glass, (c) GLOW STUDIO Fascia, and (d) Balcony!
      const cornerRadius = 0.74;
      const cxFL = xL + cornerRadius, czFL = zF - cornerRadius; // Front-Left (-2.61, +0.71)
      const cxFR = xR - cornerRadius, czFR = zF - cornerRadius; // Front-Right (+1.91, +0.71)
      const cxBL = xL + cornerRadius, czBL = zB + cornerRadius; // Back-Left (-2.61, -2.41)
      const cxBR = xR - cornerRadius, czBR = zB + cornerRadius; // Back-Right (+1.91, -2.41)

      // Helper to add a 4-Corner Rounded Rectangle horizontal slab across the full Ground Floor / Balcony footprint
      const addCurvedCornerBand = (matBand, yBot, yTop, expand = 0) => {
        const bh = yTop - yBot, ym = (yBot + yTop) / 2;
        const r = cornerRadius + expand;
        // 1) Full-width inner-Z slab: x in [xL - expand, xR + expand], z in [czBL, czFL]
        b.box(matBand, cxB, ym, czB, wB + expand * 2, bh, czFL - czBL);
        // 2) Full-depth inner-X slab: x in [cxFL, cxFR], z in [zB - expand, zF + expand]
        b.box(matBand, cxB, ym, czB, cxFR - cxFL, bh, dB + expand * 2);
        // 3) 4 Identical Rounded Cylinders at Front-Left, Front-Right, Back-Left, and Back-Right corners
        b.cyl(matBand, cxFL, ym, czFL, r, bh);
        b.cyl(matBand, cxFR, ym, czFR, r, bh);
        b.cyl(matBand, cxBL, ym, czBL, r, bh);
        b.cyl(matBand, cxBR, ym, czBR, r, bh);
      };

      // (a) Raised Boutique Plinth & Soft Blush Pink Baseboard (#F2D6CE) + Rose-Tan Belt (#C89D8C) — All 4 Corners Rounded!
      addCurvedCornerBand(mIvoryTrim, 0.16, 0.24, 0.10);
      addCurvedCornerBand(mBlushPink, 0.24, 0.52, 0.02);
      addCurvedCornerBand(mRoseTan, 0.52, 0.58, 0.04);

      // Solid Rear, Right & Rounded-Corner Structural Walls of Ground Floor (leaving Front-Left Display Showcase open for 3D Interior!)
      const yWall1Mid = (0.58 + 2.46) / 2, hWall1 = 2.46 - 0.58;
      // 3 Solid Rounded Corner Cylinders (Front-Right, Back-Right, Back-Left) — Front-Left is the Curved Glass Showcase!
      b.cyl(mIvoryWall, cxFR, yWall1Mid, czFR, cornerRadius, hWall1);
      b.cyl(mIvoryWall, cxBR, yWall1Mid, czBR, cornerRadius, hWall1);
      b.cyl(mIvoryWall, cxBL, yWall1Mid, czBL, cornerRadius, hWall1);
      // Flat rear wall strictly between cxBL and cxBR
      b.box(mIvoryWall, cxB, yWall1Mid, (zB + -0.32) / 2, cxBR - cxBL, hWall1, -0.32 - zB);
      // Flat right wing wall strictly between czBR and czFR
      b.box(mIvoryWall, (0.72 + xR) / 2, yWall1Mid, czB, xR - 0.72, hWall1, czFR - czBR);
      // Flat front-right wall around Front Entrance Door (x in [0.68, cxFR])
      b.box(mIvoryWall, (0.68 + cxFR) / 2, yWall1Mid, (czFR + zF) / 2, cxFR - 0.68, hWall1, zF - czFR);
      // Flat left side wall behind the side display window (z in [czBL, -1.08])
      b.box(mIvoryWall, (xL + -2.15) / 2, yWall1Mid, (czBL + -1.08) / 2, -2.15 - xL, hWall1, -1.08 - czBL);

      // (c) Upper Fascia Belt Molding (#C89D8C), Soft Blush Pink Curved Fascia Band (#F2D6CE), and (d) 2nd-Floor Balcony Deck Slab
      addCurvedCornerBand(mRoseTan, 2.46, 2.53, 0.04);
      addCurvedCornerBand(mBlushPink, 2.53, 3.10, 0.02);
      addCurvedCornerBand(mRoseTan, 3.10, 3.16, 0.06);
      addCurvedCornerBand(mIvoryTrim, 3.16, 3.21, 0.04);

      // GLOW STUDIO Fascia Signage on Front (+Z) and Left Side (-X)
      // Strictly positioned within the flat span between the rounded corners (`x in [cxFL + 0.04, cxFR - 0.04]` and `z in [czBL + 0.04, czFL - 0.04]`)
      const fSignX0 = cxFL + 0.06, fSignX1 = 0.72, fSignW = fSignX1 - fSignX0, fSignCX = (fSignX0 + fSignX1) / 2;
      b.box(mRoseTan, fSignCX, 2.82, zF + 0.045, fSignW, 0.48, 0.04, { r: 0.015 });
      b.panel(mGlowSignPanel, R.glowFascia, fSignCX, 2.82, zF + 0.08, fSignW - 0.06, 0.42);

      const sSignZ0 = -1.18, sSignZ1 = czFL - 0.06, sSignD = sSignZ1 - sSignZ0, sSignCZ = (sSignZ0 + sSignZ1) / 2;
      b.box(mRoseTan, xL - 0.045, 2.82, sSignCZ, 0.04, 0.48, sSignD, { r: 0.015 });
      b.panel(mGlowSignPanel, R.glowFascia, xL - 0.08, 2.82, sSignCZ, sSignD - 0.06, 0.42, -Math.PI / 2);

      // ----------------------------------------------------------------------
      // 1B. 3D BEAUTY DISPLAY INTERIOR SHOWCASE (Inside Curved Corner Window)
      //     (>= 0.08m depth offset from exterior walls/baseboard & glass to prevent Z-fighting!)
      // ----------------------------------------------------------------------
      // Warm Glowing Showcase Floor & Ceiling (offset >= 0.08m inside exterior walls and separated vertically from 0.58 & 2.46 bands!)
      addCurvedCornerBand(mIntBackdrop, 0.595, 0.635, -0.10);
      addCurvedCornerBand(mIntBackdrop, 2.385, 2.425, -0.10);
      // Interior back partition wall at z = -0.38 (>= 0.06m separate from rear wall at -0.32 and >= 0.10m behind shelving niches at z = -0.22!)
      b.box(mIntBackdrop, -1.16, 1.51, -0.38, 3.52, 1.74, 0.06);
      // Interior right partition wall at x = 0.62 (>= 0.06m separate from right wing wall at 0.68!)
      b.box(mIntBackdrop, 0.62, 1.51, 0.44, 0.06, 1.74, 1.58);

      // Dedicated Warm Interior PointLight (distance-culled when building is outside camera focus)
      addPolePointLight(g, -1.10, 2.15, 0.55, 1.45, 0xffdfc2, 5.8, 1.5, 0.55);
      S.lights.push(
        [new THREE.Vector3(-1.65, 1.55, 1.45), '#ffd8a8', 4.6, 2.8],
        [new THREE.Vector3(-0.25, 1.55, 1.45), '#ffd8a8', 4.6, 2.8],
        [new THREE.Vector3(-3.35, 1.55, -0.25), '#ffd8a8', 4.2, 2.5]
      );

      // 3 Hanging Gold Ring & Dome Pendant Lamps inside the Showcase Ceiling
      for (const [px, pz] of [[-1.95, 0.48], [-0.85, 0.65], [-2.55, -0.35]]) {
        b.cyl(mGold, px, 2.28, pz, 0.014, 0.28);
        b.add(mGold, unitCone, px, 2.12, pz, 0.22, 0.10, 0.22);
        b.sphere(M.bulb, px, 2.06, pz, 0.055);
      }

      // FIXTURE 1: RAK DINDING MELENGKUNG (2 Recessed Blush-Pink Arched Shelving Niches on Back Wall z = -0.20, >= 0.08m in front of mIntBackdrop!)
      for (const nx of [-1.82, -0.46]) {
        const nw = 1.04, nh = 1.48, ny = 1.38, nz = -0.20;
        b.box(mRoseTan, nx, ny, nz, nw + 0.10, nh + 0.08, 0.08, { r: 0.02 });
        b.box(mIntBlushNiche, nx, ny - 0.12, nz + 0.055, nw, nh - 0.24, 0.05);
        const archNicheGeo = new THREE.CylinderGeometry(nw / 2, nw / 2, 0.05, 18, 1, false, 0, Math.PI);
        archNicheGeo.rotateZ(-Math.PI / 2);
        archNicheGeo.rotateX(Math.PI / 2);
        b.add(mIntBlushNiche, solid(archNicheGeo), nx, ny + nh / 2 - 0.36, nz + 0.055);
        // 3 Illuminated Shelves with 3D Pastel Skincare, Serum & Perfume Bottles
        for (let sIdx = 0; sIdx < 3; sIdx++) {
          const sy = 0.88 + sIdx * 0.38;
          b.box(mGold, nx, sy, nz + 0.11, nw - 0.08, 0.025, 0.15);
          for (let bIdx = -2; bIdx <= 2; bIdx++) {
            const bx0 = nx + bIdx * 0.18;
            const bMat =
              (sIdx + bIdx + 4) % 4 === 0
                ? mBottleCoral
                : (sIdx + bIdx + 4) % 4 === 1
                ? mBottleLav
                : (sIdx + bIdx + 4) % 4 === 2
                ? mBottleMint
                : mBottleGold;
            const bh0 = 0.13 + ((sIdx + Math.abs(bIdx)) % 2) * 0.04;
            b.cyl(bMat, bx0, sy + 0.015 + bh0 / 2, nz + 0.12, 0.036, bh0);
            b.cyl(mGold, bx0, sy + 0.015 + bh0 + 0.02, nz + 0.12, 0.018, 0.035);
          }
        }
      }

      // FIXTURE 2: MEJA RIAS BERLAMPU (Hollywood Lighted Vanity Table & 12 LED Bulbs Mirror at Left-Front Showcase)
      const vx = -2.18, vz = 0.22;
      // Vanity desk tabletop & drawers
      b.box(mIntCounter, vx, 1.02, vz, 1.06, 0.12, 0.48, { r: 0.015 });
      b.box(mRoseTan, vx, 1.09, vz, 1.10, 0.025, 0.52);
      for (const sx of [-0.44, 0.44]) {
        for (const sz of [-0.18, 0.18]) {
          b.cyl(mGold, vx + sx, 0.80, vz + sz, 0.024, 0.42);
        }
      }
      // Plush Blush-Pink Vanity Stool in front of table
      b.cyl(mBlushDeep, vx, 0.78, vz + 0.42, 0.18, 0.10);
      b.cyl(mGold, vx, 0.66, vz + 0.42, 0.03, 0.16);
      // Large Lighted Vanity Mirror with 12 Glowing White LED Bulbs around the frame!
      const vmW = 0.86, vmH = 0.74, vmY = 1.48;
      b.box(mRoseTan, vx, vmY, vz - 0.08, vmW + 0.10, vmH + 0.10, 0.05, { r: 0.02 });
      b.box(mMirrorGlass, vx, vmY, vz - 0.045, vmW - 0.04, vmH - 0.04, 0.02);
      // 12 Glowing White LED Vanity Bulbs (4 top, 4 bottom, 2 left, 2 right)
      for (const bx0 of [-0.36, -0.12, 0.12, 0.36]) {
        b.sphere(M.bulb, vx + bx0, vmY + vmH / 2 + 0.01, vz - 0.03, 0.032);
        b.sphere(M.bulb, vx + bx0, vmY - vmH / 2 - 0.01, vz - 0.03, 0.032);
      }
      for (const by0 of [-0.16, 0.16]) {
        b.sphere(M.bulb, vx - vmW / 2 - 0.01, vmY + by0, vz - 0.03, 0.032);
        b.sphere(M.bulb, vx + vmW / 2 + 0.01, vmY + by0, vz - 0.03, 0.032);
      }

      // FIXTURE 3: MEJA DISPLAY BUNDAR (Round Island Counter with Makeup Brush Stand & Circular Mirror)
      const icX = -0.68, icZ = 0.62;
      b.cyl(mBlushPink, icX, 0.80, icZ, 0.56, 0.42);
      b.cyl(mGold, icX, 0.62, icZ, 0.58, 0.03);
      b.cyl(mIntCounter, icX, 1.03, icZ, 0.62, 0.06);
      b.cyl(mGold, icX, 1.06, icZ, 0.63, 0.02);
      b.cyl(mIntCounter, icX, 1.12, icZ, 0.36, 0.10);
      // 3D Makeup Brush Stand (Stand Kuas Makeup) with fanned-out brushes
      const brX = icX - 0.18, brZ = icZ + 0.10;
      b.cyl(mBlushDeep, brX, 1.24, brZ, 0.075, 0.16);
      b.cyl(mGold, brX, 1.32, brZ, 0.08, 0.02);
      for (const [bAngX, bAngZ, bCol] of [
        [-0.22, 0.12, mBottleCoral],
        [0.0, 0.20, mBlushPink],
        [0.22, -0.10, mBottleLav],
        [-0.14, -0.18, mGold]
      ]) {
        b.cyl(mRoseWood, brX + bAngX * 0.12, 1.38, brZ + bAngZ * 0.12, 0.012, 0.16, { rx: bAngZ, rz: bAngX });
        b.sphere(bCol, brX + bAngX * 0.22, 1.47, brZ + bAngZ * 0.22, 0.032);
      }
      // Small Circular Tabletop Vanity Mirror on Gold Stand
      const smX = icX + 0.18, smZ = icZ - 0.06;
      b.cyl(mGold, smX, 1.18, smZ, 0.08, 0.02);
      b.cyl(mGold, smX, 1.26, smZ, 0.016, 0.16);
      const smMirrorGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.025, 20);
      smMirrorGeo.rotateX(Math.PI / 2);
      b.add(mGold, solid(smMirrorGeo), smX, 1.38, smZ);
      const smGlassGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.03, 20);
      smGlassGeo.rotateX(Math.PI / 2);
      b.add(mMirrorGlass, solid(smGlassGeo), smX, 1.38, smZ + 0.005);
      // Serum & Perfume Tester Bottles on Round Island Counter
      for (const [tx, tz, tMat] of [
        [icX, icZ + 0.24, mBottleCoral],
        [icX + 0.22, icZ + 0.18, mBottleMint],
        [icX - 0.04, icZ - 0.18, mBottleGold]
      ]) {
        b.cyl(tMat, tx, 1.23, tz, 0.038, 0.14);
        b.cyl(mGold, tx, 1.32, tz, 0.018, 0.04);
      }

      // ----------------------------------------------------------------------
      // 1C. CURVED PANORAMIC DISPLAY WINDOWS & MULLIONS (Front, Curved Corner & Left Side)
      //     - Glass recessed 0.05m inward (zF - 0.05, cornerRadius - 0.05, xL + 0.05)
      //     - Rosewood frames/mullions +0.03m in front of glass (zF - 0.02, cornerRadius - 0.02, xL + 0.02)
      // ----------------------------------------------------------------------
      const winY = 1.52, winH = 1.88;
      // Front Panoramic Glass Pane (strictly from x = cxFL to x = 0.68 at z = zF - 0.05)
      const fWinX0 = cxFL, fWinX1 = 0.68, fWinW = fWinX1 - fWinX0, fWinX = (fWinX0 + fWinX1) / 2;
      b.box(mWindowClear, fWinX, winY, zF - 0.05, fWinW, winH, 0.012);
      b.box(mRoseWood, fWinX, winY + winH / 2 - 0.02, zF - 0.02, fWinW + 0.04, 0.055, 0.028);
      b.box(mRoseWood, fWinX, winY - winH / 2 + 0.02, zF - 0.02, fWinW + 0.04, 0.055, 0.028);
      for (const mx of [-1.52, -0.42, 0.68]) {
        b.box(mRoseWood, mx, winY, zF - 0.02, 0.05, winH, 0.028);
      }
      b.box(mRoseWood, fWinX, winY + 0.52, zF - 0.02, fWinW, 0.038, 0.028);

      // (b) Curved Left-Corner Storefront Window (recessed 0.05m inward at cornerRadius - 0.05!)
      const cornerGlassGeo = new THREE.CylinderGeometry(
        cornerRadius - 0.05,
        cornerRadius - 0.05,
        winH,
        28,
        1,
        true,
        Math.PI * 1.5,
        Math.PI / 2
      );
      b.add(mWindowClear, cornerGlassGeo, cxFL, winY, czFL);

      // Curved Top, Transom & Bottom Frames along the Corner Glass Arc (+0.03m in front of glass at cornerRadius - 0.02)
      const nCornerArc = 10;
      const rFrameArc = cornerRadius - 0.02;
      for (let k = 0; k < nCornerArc; k++) {
        const a0 = (k / nCornerArc) * (Math.PI / 2);
        const a1 = ((k + 1) / nCornerArc) * (Math.PI / 2);
        const am = (a0 + a1) / 2;
        const chord = 2 * rFrameArc * Math.sin((a1 - a0) / 2) + 0.016;
        const px = cxFL - Math.cos(am) * rFrameArc;
        const pz = czFL + Math.sin(am) * rFrameArc;
        const ry = am - Math.PI / 2;
        b.box(mRoseWood, px, winY + winH / 2 - 0.02, pz, chord, 0.055, 0.028, { ry });
        b.box(mRoseWood, px, winY + 0.52, pz, chord, 0.038, 0.028, { ry });
        b.box(mRoseWood, px, winY - winH / 2 + 0.02, pz, chord, 0.055, 0.028, { ry });
      }
      // Slender Vertical Rose-Tan Pilaster Frames at Start, Middle, and End of Curved Glass
      b.box(mRoseTan, cxFL, winY, zF - 0.02, 0.065, winH + 0.02, 0.032);
      b.box(mRoseTan, xL + 0.02, winY, czFL, 0.032, winH + 0.02, 0.065);
      b.cyl(
        mRoseTan,
        cxFL - Math.cos(Math.PI / 4) * (cornerRadius - 0.02),
        winY,
        czFL + Math.sin(Math.PI / 4) * (cornerRadius - 0.02),
        0.024,
        winH
      );

      // Left Side Panoramic Glass Pane (recessed at x = xL + 0.05, mullions at x = xL + 0.02)
      const sWinZ0 = -1.08, sWinZ1 = czFL, sWinD = sWinZ1 - sWinZ0, sWinZ = (sWinZ0 + sWinZ1) / 2;
      b.box(mWindowClear, xL + 0.05, winY, sWinZ, 0.012, winH, sWinD);
      b.box(mRoseWood, xL + 0.02, winY + winH / 2 - 0.02, sWinZ, 0.028, 0.055, sWinD + 0.04);
      b.box(mRoseWood, xL + 0.02, winY - winH / 2 + 0.02, sWinZ, 0.028, 0.055, sWinD + 0.04);
      for (const mz of [-1.08, -0.18]) {
        b.box(mRoseWood, xL + 0.02, winY, mz, 0.028, winH, 0.05);
      }
      b.box(mRoseWood, xL + 0.02, winY + 0.52, sWinZ, 0.028, 0.038, sWinD);

      // ----------------------------------------------------------------------
      // 1D. FRONT & SIDE ENTRANCE DOORS, SLEEK MODERN AWNINGS, WALL SCONCES & POTTED PLANTS
      //     (Door bottom flush at y = 0.24 on terrace threshold step; frame & leaf flush with facade wall zF = 1.45 & xL = -3.35!)
      // ----------------------------------------------------------------------
      // Front Entrance Door (centered at dxF = 1.34, flush with facade wall zF = 1.45 and threshold step top y = 0.24!)
      const dxF = 1.34;
      b.box(mIvoryTrim, dxF, 0.21, zF + 0.18, 1.24, 0.06, 0.38, { r: 0.01 });
      b.box(mRoseWood, dxF, 1.35, zF + 0.008, 1.04, 2.22, 0.055);
      b.box(mRoseTan, dxF, 1.33, zF + 0.024, 0.90, 2.18, 0.036);
      b.box(M.glowGlass, dxF, 1.50, zF + 0.046, 0.68, 1.42, 0.016);
      b.box(mRoseWood, dxF, 1.50, zF + 0.060, 0.70, 0.04, 0.018);
      // Curved Gold Door Handle
      b.cyl(mGold, dxF - 0.28, 1.20, zF + 0.075, 0.022, 0.34);
      b.box(mGold, dxF - 0.28, 1.35, zF + 0.055, 0.03, 0.03, 0.05);
      b.box(mGold, dxF - 0.28, 1.05, zF + 0.055, 0.03, 0.03, 0.05);
      // Sleek Modern Awning above Front Entrance Door
      b.box(mAwningCream, dxF, 2.48, zF + 0.42, 1.28, 0.07, 0.78, { rx: 0.22, r: 0.015 });
      b.box(mGold, dxF, 2.40, zF + 0.79, 1.30, 0.05, 0.04);
      // Gold Cylindrical Wall Sconce beside Front Entrance Door
      addGoldWallSconce(1.94, 1.82, zF - 0.02, 'Z', 1);

      // Left Side Entrance Door (centered at dzSide = -1.78, flush with left facade wall xL = -3.35 and threshold step top y = 0.24!)
      const dzSide = -1.78;
      b.box(mIvoryTrim, xL - 0.18, 0.21, dzSide, 0.38, 0.06, 1.18, { r: 0.01 });
      b.box(mRoseWood, xL - 0.008, 1.35, dzSide, 0.055, 2.22, 1.00);
      b.box(mRoseTan, xL - 0.024, 1.33, dzSide, 0.036, 2.18, 0.86);
      b.box(M.glowGlass, xL - 0.046, 1.50, dzSide, 0.016, 1.42, 0.66);
      b.box(mRoseWood, xL - 0.060, 1.50, dzSide, 0.018, 0.04, 0.68);
      b.cyl(mGold, xL - 0.075, 1.20, dzSide + 0.28, 0.022, 0.34);
      b.box(mAwningCream, xL - 0.42, 2.48, dzSide, 0.78, 0.07, 1.24, { rz: 0.22, r: 0.015 });
      b.box(mGold, xL - 0.79, 2.40, dzSide, 0.04, 0.05, 1.26);
      addGoldWallSconce(xL, 1.82, -1.16, 'X', -1);
      addGoldWallSconce(xL, 1.82, -2.38, 'X', -1);

      // ----------------------------------------------------------------------
      // 1E. MODERN MINIMALIST PEDESTRIAN SIDEWALK (Polished Terrazzo Pavers,
      //     Integrated Linear Ground Lighting, Sculptural Terrazzo & Oak Benches,
      //     Fluted Cylindrical Planters, Side Planter Box & Topiaries, Brass Kiosk
      //     Menu Stand, Sleek Pillar Streetlamps & Slim Metallic Bollards)
      // ----------------------------------------------------------------------
      const mOakBench = mat('#C89D70', { roughness: 0.66 }, t);
      const mTerrazzoLeg = mat('#DFD5C8', { roughness: 0.72 }, t);
      const mFlutedCream = mat('#EDE7DF', { roughness: 0.68 }, t);
      const mFlutedCharcoal = mat('#5A5D5E', { roughness: 0.64 }, t);
      const mCharcoalPlanter = mat('#4E5152', { roughness: 0.74 }, t);
      const mSnakeGreenDark = mat('#45733E', { roughness: 0.68, flatShading: true }, t);
      const mSnakeGreenMid = mat('#649456', { roughness: 0.66, flatShading: true }, t);
      const mSnakeGreenLight = mat('#86B06E', { roughness: 0.64, flatShading: true }, t);
      const mPlumeGrass = mat('#C4B08A', { roughness: 0.74, flatShading: true }, t);
      const mBrassKiosk = mat('#C9A46A', { roughness: 0.34, metalness: 0.56 }, t);
      const mPillarBronze = mat('#2C2A29', { roughness: 0.42, metalness: 0.48 }, t);

      // 1) Isolated Store Stage Base Group (hidden in Town View so the unified full-block Terrazzo Sidewalk
      //    in villageOuterLot are 100% seamless; shown when Store #1 is isolated in catalog view)
      const swX0 = -5.25, swX1 = 3.18, swZ0 = -3.48, swZ1 = 3.55;
      const swW = swX1 - swX0, swD = swZ1 - swZ0, swCX = (swX0 + swX1) / 2, swCZ = (swZ0 + swZ1) / 2;
      const stageBaseGroup = new THREE.Group();
      stageBaseGroup.visible = false;
      g.add(stageBaseGroup);
      const bStage = new Batch();
      bStage.box(mTerrazzoCurb, swCX, 0.095, swCZ, swW + 0.14, 0.18, swD + 0.14, { r: 0.04 });
      bStage.add(mTerrazzoPaver, terrazzoDeckGeo(swW, 0.026, swD, 1.60), swCX, ySW - 0.013, swCZ);
      bStage.box(mGlowTactile, swCX, ySW + 0.002, swZ1 - 0.18, swW - 0.24, 0.012, 0.14);
      bStage.box(mGlowTactile, swX0 + 0.18, ySW + 0.002, swCZ, 0.14, 0.012, swD - 0.24);

      // 2) Integrated Linear Ground Lighting at y = 0.190 (polygonOffset -1)
      const yLED = 0.188; // h = 0.005 -> top at 0.1905
      const bBlockLED = new Batch();
      // Full-Block Front transverse linear LED strips (running from baseboard zF out to full-block front curb blkHalf = 4.58)
      const fLedLenFull = blkHalf - (zF + 0.08), fLedCZFull = (zF + 0.08 + blkHalf) / 2;
      for (const lx of [-2.45, -1.42, -0.38, 0.68, 1.94]) {
        bBlockLED.box(mLinearGroundLED, lx, yLED, fLedCZFull, 0.032, 0.005, fLedLenFull);
        bStage.box(mLinearGroundLED, lx, yLED, (zF + 0.08 + swZ1) / 2, 0.032, 0.005, swZ1 - (zF + 0.08));
      }
      // Left-side transverse linear LED strips (running perpendicular from left baseboard xL out to left curb swX0 = -4.56)
      const sLedLen = (xL - 0.08) - swX0, sLedCX = (swX0 + xL - 0.08) / 2;
      for (const lz of [0.58, -0.34, -1.16, -2.38]) {
        b.box(mLinearGroundLED, sLedCX, yLED, lz, sLedLen, 0.005, 0.032);
      }
      // Right-side & Back transverse linear LED strips on the unified full-block Terrazzo Plaza
      const rLedLen = blkHalf - (xR + 0.08), rLedCX = (xR + 0.08 + blkHalf) / 2;
      for (const lz of [0.58, -0.85, -2.28]) {
        bBlockLED.box(mLinearGroundLED, rLedCX, yLED, lz, rLedLen, 0.005, 0.032);
      }
      const bLedLen = (-3.15 - 0.08) - -blkHalf, bLedCZ = (-blkHalf + -3.23) / 2;
      for (const lx of [-2.05, -0.35, 1.35]) {
        bBlockLED.box(mLinearGroundLED, lx, yLED, bLedCZ, 0.032, 0.005, bLedLen);
      }
      bBlockLED.build(villageOuterLot);
      // Radial 45° Corner Linear LED Strip at the Curved Front-Left Corner
      const cAng = (3 * Math.PI) / 4; // Pointing toward (-X, +Z)
      const cStartR = cornerRadius + 0.06, cEndR = cornerRadius + 1.38;
      const cMidR = (cStartR + cEndR) / 2, cRayLen = cEndR - cStartR;
      b.box(
        mLinearGroundLED,
        cxFL + Math.cos(cAng) * cMidR,
        yLED,
        czFL + Math.sin(cAng) * cMidR,
        cRayLen,
        0.005,
        0.032,
        { ry: -cAng }
      );
      // Warm Baseboard Under-Glow along the Front Window, Curved Corner & Left-Side Window Baseboard
      b.box(mLinearGroundLED, (cxFL + 0.72) / 2, ySW + 0.012, zF + 0.11, 0.72 - cxFL, 0.018, 0.028);
      b.box(mLinearGroundLED, xL - 0.11, ySW + 0.012, (-1.12 + czFL) / 2, 0.028, 0.018, czFL - -1.12);
      for (let k = 0; k < 8; k++) {
        const a0 = (k / 8) * (Math.PI / 2);
        const a1 = ((k + 1) / 8) * (Math.PI / 2);
        const am = (a0 + a1) / 2;
        const rUG = cornerRadius + 0.105;
        const chord = 2 * rUG * Math.sin((a1 - a0) / 2) + 0.015;
        b.box(
          mLinearGroundLED,
          cxFL - Math.cos(am) * rUG,
          ySW + 0.012,
          czFL + Math.sin(am) * rUG,
          chord,
          0.018,
          0.028,
          { ry: am - Math.PI / 2 }
        );
      }

      // 3) Sculptural Terrazzo & Oak Benches (Under Glow Studio + Extended across the Full Block!)
      const addTerrazzoOakBench = (bx, bz, ry = 0, bLen = 1.32, targetGroup = g) => {
        const bg = new THREE.Group();
        bg.position.set(bx, ySW, bz);
        bg.rotation.y = ry;
        const bB = new Batch();
        const bDep = 0.40, legH = 0.34;
        // 2 Monolithic Cast-Terrazzo Concrete Pedestal Legs (#DFD5C8)
        for (const lx of [-bLen * 0.36, bLen * 0.36]) {
          bB.box(mTerrazzoLeg, lx, legH / 2, 0, 0.14, legH, bDep - 0.04, { r: 0.015 });
        }
        // Thick Warm Oak Plank Seat (#C89D70) + Subtle Warm Under-Bench Glow Strip
        bB.box(mOakBench, 0, legH + 0.038, 0, bLen, 0.076, bDep, { r: 0.015 });
        bB.box(mLinearGroundLED, 0, legH - 0.005, 0, bLen * 0.68, 0.012, 0.04);
        bB.build(bg);
        targetGroup.add(bg);
      };
      // Single Bench pulled FLUSH against the Front Panoramic Storefront Window wall (zF = 1.45 -> z = 1.69),
      // leaving > 85% of the front sidewalk and 100% of the left, right, and rear sidewalks wide open!
      addTerrazzoOakBench(-1.08, zF + 0.24, 0, 1.28, g);

      // 4) Tall Fluted Cylindrical Planters (#EDE7DF Cream-White & #5A5D5E Charcoal)
      //    with Upright Sword-Leaf Snake Plant / Agave & Ornamental Plume Grass
      const addFlutedBoutiquePlanter = (px, pz, isCharcoal = false, hasPlumeGrass = false, targetGroup = g) => {
        const pg = new THREE.Group();
        pg.position.set(px, ySW, pz);
        const bP = new Batch();
        const rPot = 0.20, hPot = 0.54;
        const mPotBody = isCharcoal ? mFlutedCharcoal : mFlutedCream;
        bP.cyl(mPotBody, 0, hPot / 2, 0, rPot, hPot);
        // 16 vertical fluted ribs around the cylinder
        for (let k = 0; k < 16; k++) {
          const ang = (k / 16) * Math.PI * 2;
          bP.cyl(
            mPotBody,
            Math.cos(ang) * (rPot - 0.004),
            hPot / 2,
            Math.sin(ang) * (rPot - 0.004),
            0.018,
            hPot - 0.02
          );
        }
        bP.cyl(mRoseTan, 0, hPot + 0.01, 0, rPot + 0.012, 0.025);
        bP.cyl(mSoil, 0, hPot + 0.015, 0, rPot - 0.02, 0.02);

        // Upright Sword-Leaf Snake Plant / Agave (Sansevieria)
        const nLeaves = 11;
        for (let k = 0; k < nLeaves; k++) {
          const ang = (k / nLeaves) * Math.PI * 2 + (k % 2) * 0.25;
          const dist = (k % 3) * 0.045;
          const lx = Math.cos(ang) * dist;
          const lz = Math.sin(ang) * dist;
          const lh = 0.42 + (k % 3) * 0.11;
          const tilt = 0.08 + (k % 3) * 0.07;
          const mLeafCol = k % 3 === 0 ? mSnakeGreenDark : k % 3 === 1 ? mSnakeGreenMid : mSnakeGreenLight;
          bP.box(mLeafCol, lx, hPot + lh * 0.46, lz, 0.048, lh, 0.016, {
            rx: Math.sin(ang) * tilt,
            ry: ang,
            rz: -Math.cos(ang) * tilt
          });
        }
        // Fine Feathery Plume Grass Accents (as in Detailed Storefront Close-up!)
        if (hasPlumeGrass) {
          for (let k = 0; k < 10; k++) {
            const ang = (k / 10) * Math.PI * 2 + 0.15;
            const gx = Math.cos(ang) * 0.09;
            const gz = Math.sin(ang) * 0.09;
            bP.cyl(mPlumeGrass, gx, hPot + 0.36, gz, 0.012, 0.46, {
              rx: Math.sin(ang) * 0.28,
              rz: -Math.cos(ang) * 0.28
            });
          }
        }
        bP.build(pg);
        targetGroup.add(pg);
      };
      // Only 2 Slim Fluted Planters tucked FLUSH against the building corners (0 mid-sidewalk planters!)
      addFlutedBoutiquePlanter(-2.12, zF + 0.24, true, false, g);
      addFlutedBoutiquePlanter(xL - 0.24, -1.05, false, true, g);

      // 5) Side Planter Box & Topiary Tree (Pulled FLUSH against building walls so >= 80% of sidewalk width is empty)
      //    - Right of Front Entrance: Single Cream Cylinder Pot with Blooming Topiary Tree flush against front pilaster
      addWhitePotPlant(1.98, ySW, zF + 0.26, 0.20, true);
      for (const [bx0, by0, bz0] of [[1.86, ySW + 1.06, zF + 0.34], [2.08, ySW + 1.12, zF + 0.28], [1.96, ySW + 1.18, zF + 0.18]]) {
        b.sphere(mBottleCoral, bx0, by0, bz0, 0.038);
      }
      //    - Left Side Wall (Rear): Single Spherical Ball Topiary flush against rear-left wall corner
      {
        const tz = -2.85;
        b.cyl(mFlutedCream, xL - 0.24, ySW + 0.14, tz, 0.18, 0.28);
        b.cyl(mRoseTan, xL - 0.24, ySW + 0.28, tz, 0.19, 0.03);
        b.cyl(mRoseWood, xL - 0.24, ySW + 0.42, tz, 0.028, 0.28);
        b.sphere(mLeaf, xL - 0.24, ySW + 0.66, tz, 0.22);
      }
      //    - Left Side Low Rectangular Charcoal Planter Box (#4E5152) pulled FLUSH against left building wall xL
      const spX = xL - 0.22, spZ = -1.92, spW = 0.32, spD = 1.16, spH = 0.34;
      b.box(mCharcoalPlanter, spX, ySW + spH / 2, spZ, spW, spH, spD, { r: 0.015 });
      b.box(mSoil, spX, ySW + spH - 0.01, spZ, spW - 0.06, 0.02, spD - 0.06);
      for (let k = -2; k <= 2; k++) {
        const fz = spZ + k * 0.22;
        b.crown(k % 2 === 0 ? mLeaf : mLeafOlive, spX, ySW + spH + 0.12, fz, 0.15, 0.14, 0.15, k + 2);
        b.box(mSnakeGreenLight, spX, ySW + spH + 0.18, fz, 0.026, 0.24, 0.026, { rx: 0.18 * k, rz: 0.14 });
      }

      // 6) Brass / Golden-Oak Pedestal Menu Stand pulled FLUSH against the Front-Right Pilaster
      const kx = 2.28, kz = zF + 0.26;
      const kg = new THREE.Group();
      kg.position.set(kx, ySW, kz);
      kg.rotation.y = -0.12;
      const bK = new Batch();
      bK.box(mRoseWood, 0, 0.03, 0, 0.30, 0.06, 0.24, { r: 0.01 });
      bK.box(mBrassKiosk, 0, 0.46, 0, 0.22, 0.84, 0.15, { r: 0.01 });
      bK.box(mGold, 0, 0.92, 0.02, 0.32, 0.38, 0.04, { rx: -0.42, r: 0.01 });
      bK.panel(mGlowSignPanel, R.glowAFrame, 0, 0.93, 0.045, 0.27, 0.32, 0, -0.42);
      bK.build(kg);
      g.add(kg);

      // 7) Sleek Architectural Pillar Streetlamps (Tiang Lampu Kolom Modern #2C2A29)
      const bBlockProps = new Batch();
      const addPillarStreetlamp = (lx, lz, hasSideArm = false, targetBatch = b, addLightSource = true) => {
        const pH = 2.68, pW = 0.15;
        targetBatch.box(mPillarBronze, lx, ySW + 0.04, lz, pW + 0.06, 0.08, pW + 0.06);
        targetBatch.box(mPillarBronze, lx, ySW + (pH - 0.82) / 2, lz, pW, pH - 0.82, pW);
        // Upper 4-corner frame posts around the vertical warm LED light slot
        const slotY = ySW + pH - 0.44, slotH = 0.76;
        for (const [dx, dz] of [[-0.055, -0.055], [0.055, -0.055], [-0.055, 0.055], [0.055, 0.055]]) {
          targetBatch.box(mPillarBronze, lx + dx, slotY, lz + dz, 0.036, slotH, 0.036);
        }
        // Glowing vertical warm LED light core inside the upper slot
        targetBatch.box(mLinearGroundLED, lx, slotY, lz, 0.085, slotH - 0.04, 0.085);
        // Top cap & optional sleek cantilevered arm
        targetBatch.box(mPillarBronze, lx, ySW + pH - 0.03, lz, pW + 0.02, 0.06, pW + 0.02);
        if (hasSideArm) {
          targetBatch.box(mPillarBronze, lx - 0.16, ySW + pH - 0.03, lz, 0.34, 0.045, pW);
          targetBatch.box(mLinearGroundLED, lx - 0.20, ySW + pH - 0.058, lz, 0.24, 0.015, 0.08);
        }
        if (addLightSource) {
          addPolePointLight(targetBatch === b ? g : villageOuterLot, lx, slotY - 0.12, lz, 1.0, '#FFD89B', 9, 2.0, index);
          if (targetBatch === b) {
            S.lights.push([new THREE.Vector3(lx, slotY - 0.12, lz), '#FFD89B', 4.2, 2.1]);
          }
        }
      };
      // Exactly 4 Pillar Streetlamps at the 4 Outer Curb Corners of Store #1 (Glow Studio, ~0.35m from outer curb edge)
      addPillarStreetlamp(-4.92, 4.92, false, bBlockProps, true);  // Front-Left Outer Curb Corner
      addPillarStreetlamp(4.92, 4.92, false, bBlockProps, true);   // Front-Right Outer Curb Corner
      addPillarStreetlamp(-4.92, -4.92, false, bBlockProps, true); // Back-Left Outer Curb Corner
      addPillarStreetlamp(4.92, -4.92, false, bBlockProps, true);  // Back-Right Outer Curb Corner
      bBlockProps.build(villageOuterLot);
      bStage.build(stageBaseGroup);
      S.stageBaseGroup = stageBaseGroup;

      // ----------------------------------------------------------------------
      // 2. LANTAI 2 — CHIC ARCHED WINDOWS, 4-CORNER ROUNDED BALCONY & MODERN BALUSTRADE
      // ----------------------------------------------------------------------
      const x2L = -2.76, x2R = 2.06, w2 = x2R - x2L, cx2 = (x2L + x2R) / 2; // w2 = 4.82, cx2 = -0.35 (symmetrically centered!)
      const z2B = -2.56, z2F = 0.86, d2 = z2F - z2B, cz2 = (z2B + z2F) / 2; // d2 = 3.42, cz2 = -0.85 (symmetrically centered!)
      const y2 = 5.52, h2 = y2 - y1; // 2.34

      // Lantai 2 Warm Ivory Main Volume (full solid rear & right walls flush to z2B and x2R, recessed behind 2nd-floor arched windows on front/left!)
      b.box(mIvoryWall, cx2 + 0.13, (y1 + y2) / 2, cz2 - 0.13, w2 - 0.26, h2, d2 - 0.26);
      // Solid rear (-Z) and right (+X) outer walls on Lantai 2 so zero gaps/holes appear from any angle
      b.box(mIvoryWall, cx2, (y1 + y2) / 2, z2B + 0.13, w2, h2, 0.26);
      b.box(mIvoryWall, x2R - 0.13, (y1 + y2) / 2, cz2, 0.26, h2, d2);
      // Front (+Z) & Left (-X) outer wall bands & piers flush at z2F and x2L around the arched windows
      b.box(mIvoryWall, cx2, (y1 + 3.54) / 2, z2F - 0.13, w2, 3.54 - y1, 0.26);
      b.box(mIvoryWall, cx2, (5.04 + y2) / 2, z2F - 0.13, w2, y2 - 5.04, 0.26);
      for (const [px, pw] of [[x2L + 0.165, 0.33], [cx2 - 0.77, 0.46], [cx2 + 0.77, 0.46], [x2R - 0.165, 0.33]]) {
        b.box(mIvoryWall, px, 4.29, z2F - 0.13, pw, 1.50, 0.26);
      }
      b.box(mIvoryWall, x2L + 0.13, (y1 + 3.54) / 2, cz2, 0.26, 3.54 - y1, d2);
      b.box(mIvoryWall, x2L + 0.13, (5.04 + y2) / 2, cz2, 0.26, y2 - 5.04, d2);
      b.box(mIvoryWall, x2L + 0.13, 4.29, (z2B + (cz2 - 0.54)) / 2, 0.26, 1.50, (cz2 - 0.54) - z2B);
      b.box(mIvoryWall, x2L + 0.13, 4.29, ((cz2 + 0.54) + z2F) / 2, 0.26, 1.50, z2F - (cz2 + 0.54));
      b.box(mRoseTan, cx2, y2 - 0.04, cz2, w2 + 0.12, 0.08, d2 + 0.12);

      // Helper: Straight Iron Railing Segment with Top Rail, Bottom Rail, Corner Posts & Dense Vertical Balusters
      const addIronRailingSegment = (x0, z0, x1, z1, yBase, hRail, step = 0.22, wallStart = false, wallEnd = false, endPosts = true) => {
        const dx = x1 - x0;
        const dz = z1 - z0;
        const len = Math.hypot(dx, dz);
        const mx = (x0 + x1) / 2;
        const mz = (z0 + z1) / 2;
        const alongX = Math.abs(dx) >= Math.abs(dz);
        const topW = alongX ? len + 0.044 : 0.044;
        const topD = alongX ? 0.044 : len + 0.044;
        const botW = alongX ? len + 0.034 : 0.034;
        const botD = alongX ? 0.034 : len + 0.034;

        // Top rail & bottom rail
        b.box(mIron, mx, yBase + hRail, mz, topW, 0.042, topD);
        b.box(mIron, mx, yBase + 0.055, mz, botW, 0.032, botD);

        // Sturdy corner/end posts (skipped when an adjoining segment already owns the shared corner)
        if (endPosts) {
          b.box(mIron, x0, yBase + hRail / 2, z0, 0.048, hRail + 0.04, 0.048);
          b.box(mIron, x1, yBase + hRail / 2, z1, 0.048, hRail + 0.04, 0.048);
        }
        if (wallStart) {
          b.box(mIron, x0, yBase + hRail / 2, z0, alongX ? 0.04 : 0.08, hRail + 0.06, alongX ? 0.08 : 0.04);
        }
        if (wallEnd) {
          b.box(mIron, x1, yBase + hRail / 2, z1, alongX ? 0.04 : 0.08, hRail + 0.06, alongX ? 0.08 : 0.04);
        }

        // Dense vertical balusters (step ~ 0.22u)
        const nBars = Math.max(2, Math.round(len / step));
        for (let k = 1; k < nBars; k++) {
          const u = k / nBars;
          const bx0 = x0 + dx * u;
          const bz0 = z0 + dz * u;
          const isPost = k % 5 === 0;
          const tk = isPost ? 0.036 : 0.025;
          b.box(mIron, bx0, yBase + hRail / 2, bz0, tk, hRail, tk);
        }
      };

      // Helper: Quarter-Circle Curved Corner Iron Railing for any of the 4 corners (dirX = ±1, dirZ = ±1)
      const addIronRailingCornerArc = (cxArc, czArc, rArc, dirX, dirZ, yBase, hRail, step = 0.21) => {
        const arcLen = rArc * (Math.PI / 2);
        const nChord = 10;
        for (let k = 0; k < nChord; k++) {
          const a0 = (k / nChord) * (Math.PI / 2);
          const a1 = ((k + 1) / nChord) * (Math.PI / 2);
          const am = (a0 + a1) / 2;
          const chordLen = 2 * rArc * Math.sin((a1 - a0) / 2) + 0.018;
          const px = cxArc + dirX * Math.cos(am) * rArc;
          const pz = czArc + dirZ * Math.sin(am) * rArc;
          const tx = -dirX * Math.sin(am);
          const tz = dirZ * Math.cos(am);
          const ry = Math.atan2(-tz, tx);
          b.box(mIron, px, yBase + hRail, pz, chordLen, 0.042, 0.042, { ry });
          b.box(mIron, px, yBase + 0.055, pz, chordLen, 0.032, 0.032, { ry });
        }
        const nBars = Math.max(3, Math.round(arcLen / step));
        for (let k = 1; k < nBars; k++) {
          const ang = (k / nBars) * (Math.PI / 2);
          const bx0 = cxArc + dirX * Math.cos(ang) * rArc;
          const bz0 = czArc + dirZ * Math.sin(ang) * rArc;
          const tx = -dirX * Math.sin(ang);
          const tz = dirZ * Math.cos(ang);
          b.box(mIron, bx0, yBase + hRail / 2, bz0, 0.025, hRail, 0.025, { ry: Math.atan2(-tz, tx) });
        }
      };

      // 4-Corner Rounded 2nd-Floor Balcony Terrace & Slender Black Iron Modern Balustrade (0 Balcony Plants!)
      const balY = y1 + 0.02, balH = 0.62;
      const rBal = cornerRadius - 0.04; // 0.70
      const fRailZ = czFL + rBal; // zF - 0.04
      const bRailZ = czBL - rBal; // zB + 0.04
      const lRailX = cxFL - rBal; // xL + 0.04
      const rRailX = cxFR + rBal; // xR - 0.04

      // Straight Railing Segments along all 4 sides of the 2nd-floor balcony perimeter
      addIronRailingSegment(cxFL, fRailZ, cxFR, fRailZ, balY, balH, 0.22); // Front (+Z)
      addIronRailingSegment(cxBL, bRailZ, cxBR, bRailZ, balY, balH, 0.22); // Back (-Z)
      addIronRailingSegment(lRailX, czBL, lRailX, czFL, balY, balH, 0.22); // Left (-X)
      addIronRailingSegment(rRailX, czBR, rRailX, czFR, balY, balH, 0.22); // Right (+X)

      // 4 Curved Corner Railing Arcs at Front-Left, Front-Right, Back-Left, and Back-Right
      addIronRailingCornerArc(cxFL, czFL, rBal, -1, 1, balY, balH, 0.21); // Front-Left
      addIronRailingCornerArc(cxFR, czFR, rBal, 1, 1, balY, balH, 0.21); // Front-Right
      addIronRailingCornerArc(cxBL, czBL, rBal, -1, -1, balY, balH, 0.21); // Back-Left
      addIronRailingCornerArc(cxBR, czBR, rBal, 1, -1, balY, balH, 0.21); // Back-Right

      // Helper: Large Chic Parisian Arched French Window:
      // - Light backdrop (mArchedGlass) at -0.21 * dirSign (0.16m >= 0.15m behind glass)
      // - Glass pane (mWindowClear) at -0.05 * dirSign (0.05m recessed behind wall)
      // - Mullions/Frames (mRoseWood) at -0.02 * dirSign (+0.03m in front of glass)
      const addChicArchedWindow = (wx, wy, wz, faceAxis = 'Z', dirSign = 1) => {
        const wW = 1.08, rectH = 0.96, rArch = wW / 2; // rArch = 0.54
        const ySpring = wy + rectH / 2;
        const yBot = wy - rectH / 2;
        const bOff = -0.21 * dirSign; // 2nd-floor light backdrop 0.16m behind glass
        const gOff = -0.05 * dirSign; // Glass recessed 0.05m inward
        const fOff = -0.02 * dirSign; // Mullions +0.03m in front of glass
        const sOff = 0.025 * dirSign; // Outer stone arch surround relief
        const nArchSeg = 14;

        if (faceAxis === 'Z') {
          // 1) Interior Light Backdrop (bOff = -0.21) + Recessed Glass Pane (gOff = -0.05)
          b.box(mArchedGlass, wx, wy, wz + bOff, wW - 0.04, rectH, 0.02);
          b.box(mWindowClear, wx, wy, wz + gOff, wW - 0.04, rectH, 0.012);
          const archGlassGeo = new THREE.CylinderGeometry(
            rArch - 0.02,
            rArch - 0.02,
            0.02,
            28,
            1,
            false,
            -Math.PI / 2,
            Math.PI
          );
          archGlassGeo.rotateX(-Math.PI / 2);
          b.add(mArchedGlass, solid(archGlassGeo), wx, ySpring, wz + bOff);
          b.add(mWindowClear, solid(archGlassGeo.clone()), wx, ySpring, wz + gOff);

          // 2) Cream Stone Profile Surround (#E6D2C4) — Sill, Side Jambs, Curved Arch Hood & Keystone
          b.box(mStoneArchTrim, wx, yBot - 0.055, wz + sOff, wW + 0.28, 0.09, 0.06);
          b.box(mRoseTan, wx, yBot - 0.11, wz + sOff * 0.6, wW + 0.18, 0.04, 0.04);
          b.box(mStoneArchTrim, wx - rArch - 0.055, wy, wz + sOff, 0.11, rectH + 0.04, 0.05);
          b.box(mStoneArchTrim, wx + rArch + 0.055, wy, wz + sOff, 0.11, rectH + 0.04, 0.05);
          // Inner Rosewood Jambs & Bottom Frame (+0.03m in front of glass)
          b.box(mRoseWood, wx - rArch + 0.015, wy, wz + fOff, 0.055, rectH, 0.028);
          b.box(mRoseWood, wx + rArch - 0.015, wy, wz + fOff, 0.055, rectH, 0.028);
          b.box(mRoseWood, wx, yBot + 0.015, wz + fOff, wW, 0.05, 0.028);

          // Semicircular Curved Arch Ring (Outer Cream Stone Profile #E6D2C4 + Inner Rosewood Frame)
          const rStoneRing = rArch + 0.055;
          const rWoodRing = rArch - 0.01;
          for (let k = 0; k < nArchSeg; k++) {
            const a0 = (k / nArchSeg) * Math.PI;
            const a1 = ((k + 1) / nArchSeg) * Math.PI;
            const am = (a0 + a1) / 2;
            const rz = am - Math.PI / 2;
            const stoneChord = 2 * rStoneRing * Math.sin((a1 - a0) / 2) + 0.025;
            const woodChord = 2 * rWoodRing * Math.sin((a1 - a0) / 2) + 0.018;
            b.box(
              mStoneArchTrim,
              wx + Math.cos(am) * rStoneRing,
              ySpring + Math.sin(am) * rStoneRing,
              wz + sOff,
              stoneChord,
              0.11,
              0.05,
              { rz }
            );
            b.box(
              mRoseWood,
              wx + Math.cos(am) * rWoodRing,
              ySpring + Math.sin(am) * rWoodRing,
              wz + fOff,
              woodChord,
              0.055,
              0.028,
              { rz }
            );
          }
          // Decorative Stone Keystone at Arch Crown
          b.box(mStoneArchTrim, wx, ySpring + rStoneRing + 0.02, wz + sOff + 0.015 * dirSign, 0.14, 0.15, 0.06);

          // 3) Double Vertical French Mullions (Kisi Vertikal Ganda) & Transom Bars at fOff (+0.03m in front of glass)
          b.box(mRoseWood, wx, ySpring, wz + fOff, wW, 0.048, 0.028);
          b.box(mRoseWood, wx, wy - 0.04, wz + fOff, wW - 0.04, 0.036, 0.028);
          const hCenterMullion = rectH + rArch - 0.02;
          b.box(mRoseWood, wx - 0.036, yBot + hCenterMullion / 2, wz + fOff, 0.036, hCenterMullion, 0.028);
          b.box(mRoseWood, wx + 0.036, yBot + hCenterMullion / 2, wz + fOff, 0.036, hCenterMullion, 0.028);
          const xSideOff = 0.27;
          const hSideMullion = rectH + Math.sqrt(Math.max(0, rArch * rArch - xSideOff * xSideOff)) - 0.02;
          b.box(mRoseWood, wx - xSideOff, yBot + hSideMullion / 2, wz + fOff, 0.03, hSideMullion, 0.026);
          b.box(mRoseWood, wx + xSideOff, yBot + hSideMullion / 2, wz + fOff, 0.03, hSideMullion, 0.026);
        } else {
          // Left-Side Facade Arched French Window (faceAxis === 'X')
          b.box(mArchedGlass, wx + bOff, wy, wz, 0.02, rectH, wW - 0.04);
          b.box(mWindowClear, wx + gOff, wy, wz, 0.012, rectH, wW - 0.04);
          const archGlassGeo = new THREE.CylinderGeometry(
            rArch - 0.02,
            rArch - 0.02,
            0.02,
            28,
            1,
            false,
            -Math.PI / 2,
            Math.PI
          );
          archGlassGeo.rotateX(-Math.PI / 2);
          archGlassGeo.rotateY(Math.PI / 2);
          b.add(mArchedGlass, solid(archGlassGeo), wx + bOff, ySpring, wz);
          b.add(mWindowClear, solid(archGlassGeo.clone()), wx + gOff, ySpring, wz);

          // Cream Stone Profile Surround (#E6D2C4)
          b.box(mStoneArchTrim, wx + sOff, yBot - 0.055, wz, 0.06, 0.09, wW + 0.28);
          b.box(mRoseTan, wx + sOff * 0.6, yBot - 0.11, wz, 0.04, 0.04, wW + 0.18);
          b.box(mStoneArchTrim, wx + sOff, wy, wz - rArch - 0.055, 0.05, rectH + 0.04, 0.11);
          b.box(mStoneArchTrim, wx + sOff, wy, wz + rArch + 0.055, 0.05, rectH + 0.04, 0.11);
          b.box(mRoseWood, wx + fOff, wy, wz - rArch + 0.015, 0.028, rectH, 0.055);
          b.box(mRoseWood, wx + fOff, wy, wz + rArch - 0.015, 0.028, rectH, 0.055);
          b.box(mRoseWood, wx + fOff, yBot + 0.015, wz, 0.028, 0.05, wW);

          const rStoneRing = rArch + 0.055;
          const rWoodRing = rArch - 0.01;
          for (let k = 0; k < nArchSeg; k++) {
            const a0 = (k / nArchSeg) * Math.PI;
            const a1 = ((k + 1) / nArchSeg) * Math.PI;
            const am = (a0 + a1) / 2;
            const rx = Math.PI / 2 - am;
            const stoneChord = 2 * rStoneRing * Math.sin((a1 - a0) / 2) + 0.025;
            const woodChord = 2 * rWoodRing * Math.sin((a1 - a0) / 2) + 0.018;
            b.box(
              mStoneArchTrim,
              wx + sOff,
              ySpring + Math.sin(am) * rStoneRing,
              wz + Math.cos(am) * rStoneRing,
              0.05,
              0.11,
              stoneChord,
              { rx }
            );
            b.box(
              mRoseWood,
              wx + fOff,
              ySpring + Math.sin(am) * rWoodRing,
              wz + Math.cos(am) * rWoodRing,
              0.028,
              0.055,
              woodChord,
              { rx }
            );
          }
          b.box(mStoneArchTrim, wx + sOff + 0.015 * dirSign, ySpring + rStoneRing + 0.02, wz, 0.06, 0.15, 0.14);

          // Double Vertical French Mullions & Transom Bars at fOff (+0.03m in front of glass)
          b.box(mRoseWood, wx + fOff, ySpring, wz, 0.028, 0.048, wW);
          b.box(mRoseWood, wx + fOff, wy - 0.04, wz, 0.028, 0.036, wW - 0.04);
          const hCenterMullion = rectH + rArch - 0.02;
          b.box(mRoseWood, wx + fOff, yBot + hCenterMullion / 2, wz - 0.036, 0.028, hCenterMullion, 0.036);
          b.box(mRoseWood, wx + fOff, yBot + hCenterMullion / 2, wz + 0.036, 0.028, hCenterMullion, 0.036);
          const zSideOff = 0.27;
          const hSideMullion = rectH + Math.sqrt(Math.max(0, rArch * rArch - zSideOff * zSideOff)) - 0.02;
          b.box(mRoseWood, wx + fOff, yBot + hSideMullion / 2, wz - zSideOff, 0.026, hSideMullion, 0.03);
          b.box(mRoseWood, wx + fOff, yBot + hSideMullion / 2, wz + zSideOff, 0.026, hSideMullion, 0.03);
        }
      };

      // 3 Large Arched Windows on Lantai 2 Front Facade (symmetrically centered around cx2 = -0.35) + 2 Gold Wall Sconces
      addChicArchedWindow(cx2 - 1.54, 4.02, z2F, 'Z', 1);
      addChicArchedWindow(cx2, 4.02, z2F, 'Z', 1);
      addChicArchedWindow(cx2 + 1.54, 4.02, z2F, 'Z', 1);
      addGoldWallSconce(cx2 - 0.77, 4.18, z2F, 'Z', 1);
      addGoldWallSconce(cx2 + 0.77, 4.18, z2F, 'Z', 1);

      // 1 Large Arched Window on Lantai 2 Left Side Facade + Gold Wall Sconces + Vertical Downspout Pipe
      addChicArchedWindow(x2L, 4.02, cz2, 'X', -1);
      addGoldWallSconce(x2L, 4.18, cz2 + 0.76, 'X', -1);
      addGoldWallSconce(x2L, 4.18, cz2 - 0.76, 'X', -1);
      // Vertical Metal Downspout Pipe on Left Side Wall (matching Side Profile View)
      b.cyl(mPipeGrey, x2L - 0.08, (y1 + y2 + 0.72) / 2, z2B + 0.28, 0.042, y2 - y1 + 0.72);
      for (const py0 of [3.55, 4.55, 5.45]) {
        b.box(mRoseTan, x2L - 0.06, py0, z2B + 0.28, 0.10, 0.04, 0.10);
      }

      // ----------------------------------------------------------------------
      // 3. ATAP — "BEAUTY & GLOW" PARAPET & ROOFTOP STUDIO GARDEN
      // ----------------------------------------------------------------------
      const yParapetTop = 6.26, hParapet = yParapetTop - y2; // 0.74
      b.box(mBlushPink, cx2, (y2 + yParapetTop) / 2, cz2, w2 + 0.06, hParapet, d2 + 0.06, { r: 0.025 });
      b.box(mRoseTan, cx2, yParapetTop + 0.03, cz2, w2 + 0.16, 0.07, d2 + 0.16);

      // Front Parapet Plaque: "BEAUTY & GLOW" & Left-Side Parapet Plaque: "BEAUTY & CARE"
      b.box(mRoseTan, cx2, 5.88, z2F + 0.07, 3.36, 0.46, 0.04, { r: 0.015 });
      b.panel(mGlowSignPanel, R.glowParapetFront, cx2, 5.88, z2F + 0.105, 3.28, 0.40);
      b.box(mRoseTan, x2L - 0.07, 5.88, cz2, 0.04, 0.46, 2.52, { r: 0.015 });
      b.panel(mGlowSignPanel, R.glowParapetSide, x2L - 0.105, 5.88, cz2, 2.44, 0.40, -Math.PI / 2);

      // ROOFTOP STUDIO, LOUNGE & MINI GLASSHOUSE CONSERVATORY (yDeck = 6.32)
      const yDeck = yParapetTop + 0.06;
      // Lush Green Rooftop Lawn Carpet (#6C9A58) + Stone Flagstone Conservatory Apron
      b.box(mLawnGreen, cx2, yDeck, cz2, w2 - 0.24, 0.04, d2 - 0.24, { r: 0.01 });

      // Rooftop Full 4-Sided Perimeter Iron Railing (Front, Back, Left, Right) with Dense Vertical Balusters (step = 0.22)
      const rTopH = 0.52;
      const rX0 = x2L + 0.04;
      const rX1 = x2R - 0.04;
      const rZ0 = z2B + 0.04;
      const rZ1 = z2F - 0.04;
      const yRoofRailBase = yParapetTop + 0.03;
      addIronRailingSegment(rX0, rZ1, rX1, rZ1, yRoofRailBase, rTopH, 0.22); // Front (+Z)
      addIronRailingSegment(rX0, rZ0, rX1, rZ0, yRoofRailBase, rTopH, 0.22); // Back (-Z)
      // Left/Right share all 4 corners with Front/Back → no duplicate corner posts
      addIronRailingSegment(rX0, rZ0, rX0, rZ1, yRoofRailBase, rTopH, 0.22, false, false, false); // Left (-X)
      addIronRailingSegment(rX1, rZ0, rX1, rZ1, yRoofRailBase, rTopH, 0.22, false, false, false); // Right (+X)

      // ----------------------------------------------------------------------
      // 3A. EXISTING OUTDOOR LOUNGE FURNITURE (Shifted to Front-Left & Rear-Left Open Terrace)
      // ----------------------------------------------------------------------
      // Warm Wooden Lounge Deck on the Left Side of the Rooftop
      b.box(mRoseTan, -1.78, yDeck + 0.02, -0.88, 1.68, 0.03, 2.86, { r: 0.01 });

      // 1) Round White Rooftop Table & 2 Lounge Chairs (Meja Bundar Putih & 2 Kursi Santai di Sudut Kiri Depan Atap!)
      const rtX = -1.75, rtZ = -0.02;
      b.cyl(mIntCounter, rtX, yDeck + 0.48, rtZ, 0.40, 0.05);
      b.cyl(mGold, rtX, yDeck + 0.26, rtZ, 0.042, 0.44);
      b.cyl(mGold, rtX, yDeck + 0.05, rtZ, 0.22, 0.03);
      for (const cAng of [1.85, 4.35]) {
        const chX = rtX + Math.cos(cAng) * 0.58;
        const chZ = rtZ + Math.sin(cAng) * 0.58;
        b.cyl(mBlushPink, chX, yDeck + 0.30, chZ, 0.18, 0.08);
        b.box(mBlushDeep, chX + Math.cos(cAng) * 0.12, yDeck + 0.45, chZ + Math.sin(cAng) * 0.12, 0.28, 0.25, 0.08, {
          ry: -cAng + Math.PI / 2,
          r: 0.03
        });
        b.cyl(mGold, chX, yDeck + 0.16, chZ, 0.03, 0.24);
      }

      // 2) Blush Pink Rooftop Lounge Sofa (Sofa Santai Pink) in the Rear-Left Lounge Corner
      const sfX = -1.78, sfZ = -1.68;
      b.box(mRoseWood, sfX, yDeck + 0.10, sfZ, 1.32, 0.12, 0.64, { r: 0.02 });
      b.box(mBlushDeep, sfX, yDeck + 0.23, sfZ + 0.03, 1.24, 0.16, 0.54, { r: 0.04 });
      b.box(mBlushPink, sfX, yDeck + 0.42, sfZ - 0.19, 1.24, 0.30, 0.16, { r: 0.04 });
      b.box(mBlushPink, sfX - 0.56, yDeck + 0.33, sfZ, 0.14, 0.24, 0.58, { r: 0.03 });
      b.box(mBlushPink, sfX + 0.56, yDeck + 0.33, sfZ, 0.14, 0.24, 0.58, { r: 0.03 });
      b.box(mIvoryWall, sfX - 0.32, yDeck + 0.35, sfZ - 0.04, 0.22, 0.18, 0.10, { rz: 0.18, r: 0.03 });
      b.box(mIvoryWall, sfX + 0.32, yDeck + 0.35, sfZ - 0.04, 0.22, 0.18, 0.10, { rz: -0.18, r: 0.03 });

      // ----------------------------------------------------------------------
      // 3B. MINI GREENHOUSE CONSERVATORY (Rooftop Glasshouse Conservatory — 100% Sesuai Concept Sheet!)
      // ----------------------------------------------------------------------
      const mGhBronze = mat('#9E7B56', { roughness: 0.58, metalness: 0.22 }, t);
      const mGhBronzeDark = mat('#6E5236', { roughness: 0.54, metalness: 0.28 }, t);
      const mGhWainscot = mat('#BA966E', { roughness: 0.68 }, t);
      const mGhStone = mat('#E6DFD5', { roughness: 0.84 }, t);
      const mGhFloorWood = mat('#D8B58E', { roughness: 0.72 }, t);
      const mTerraPot = mat('#C87850', { roughness: 0.76 }, t);
      const mTerraRim = mat('#B2643E', { roughness: 0.78 }, t);
      const mWisteriaDeep = mat('#9A74C4', { roughness: 0.62, flatShading: true }, t);
      const mWisteriaLight = mat('#C4AAE8', { roughness: 0.60, flatShading: true }, t);
      const mHydrangeaBlue = mat('#92B4E4', { roughness: 0.62, flatShading: true }, t);
      const mHydrangeaPink = mat('#EE96AC', { roughness: 0.60, flatShading: true }, t);
      const mRoseCream = mat('#FFF5E6', { roughness: 0.55 }, t);
      const mFuchsiaMag = mat('#DE6488', { roughness: 0.56 }, t);
      const mWaterCan = mat('#8CA4B8', { roughness: 0.34, metalness: 0.58 }, t);

      const mGhGlass = new THREE.MeshStandardMaterial({
        color: 0xfff6e8,
        emissive: 0xffdca8,
        emissiveIntensity: 0.14,
        roughness: 0.1,
        metalness: 0.08,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2
      });
      mGhGlass.userData.noCast = true;

      // Conservatory Footprint on Center-Right of Rooftop
      const ghCX = 0.28, ghCZ = -0.96;
      const ghW = 2.12, ghD = 2.04;
      const ghX0 = ghCX - ghW / 2, ghX1 = ghCX + ghW / 2; // [-0.78, +1.34]
      const ghZ0 = ghCZ - ghD / 2, ghZ1 = ghCZ + ghD / 2; // [-1.98, +0.06]
      const ghY0 = yDeck + 0.04;
      const ghWallH = 1.24;
      const ghYEave = ghY0 + ghWallH; // 7.60
      const ghRoofH = 0.78;
      const ghYRidge = ghYEave + ghRoofH; // 8.38

      // Stone Flagstone Perimeter Apron & Warm Timber Interior Floor
      b.box(mGhStone, ghCX + 0.08, yDeck + 0.025, ghCZ + 0.08, ghW + 0.64, 0.03, ghD + 0.56, { r: 0.01 });
      b.box(mGhFloorWood, ghCX, ghY0, ghCZ, ghW - 0.08, 0.03, ghD - 0.08);

      // 1) Lower Wooden Kick-Panel Wainscoting (Left, Back, Right, and Front Side Panels leaving Center Door Open)
      const wainH = 0.32, wainYM = ghY0 + wainH / 2;
      const doorW = 0.92;
      const fSideW = (ghW - doorW) / 2; // 0.60
      // Left & Right side wainscoting
      b.box(mGhBronze, ghX0, wainYM, ghCZ, 0.045, wainH, ghD);
      b.box(mGhWainscot, ghX0, wainYM, ghCZ, 0.06, wainH - 0.08, ghD - 0.16);
      b.box(mGhBronze, ghX1, wainYM, ghCZ, 0.045, wainH, ghD);
      b.box(mGhWainscot, ghX1, wainYM, ghCZ, 0.06, wainH - 0.08, ghD - 0.16);
      // Back wall wainscoting
      b.box(mGhBronze, ghCX, wainYM, ghZ0, ghW, wainH, 0.045);
      b.box(mGhWainscot, ghCX, wainYM, ghZ0, ghW - 0.16, wainH - 0.08, 0.06);
      // Front left & right side panel wainscoting
      for (const s of [-1, 1]) {
        const fx = ghCX + s * (doorW / 2 + fSideW / 2);
        b.box(mGhBronze, fx, wainYM, ghZ1, fSideW, wainH, 0.045);
        b.box(mGhWainscot, fx, wainYM, ghZ1, fSideW - 0.10, wainH - 0.08, 0.06);
      }

      // 2) Vertical Wall Glass Panels (opacity: 0.32, warm tint)
      const glsH = ghWallH - wainH, glsYM = ghY0 + wainH + glsH / 2;
      b.box(mGhGlass, ghX0, glsYM, ghCZ, 0.018, glsH, ghD - 0.06);
      b.box(mGhGlass, ghX1, glsYM, ghCZ, 0.018, glsH, ghD - 0.06);
      b.box(mGhGlass, ghCX, glsYM, ghZ0, ghW - 0.06, glsH, 0.018);
      for (const s of [-1, 1]) {
        const fx = ghCX + s * (doorW / 2 + fSideW / 2);
        b.box(mGhGlass, fx, glsYM, ghZ1, fSideW - 0.04, glsH, 0.018);
      }

      // 3) Warm Bronze/Timber Structural Posts, Eave Beams & Side Arched Window Headers (#9E7B56)
      // 4 main corner posts + 2 intermediate side posts per side (3 side bays) + 2 front doorway posts
      const zBays = [ghZ0, ghZ0 + ghD / 3, ghZ0 + (2 * ghD) / 3, ghZ1];
      for (const zp of zBays) {
        b.box(mGhBronze, ghX0, ghY0 + ghWallH / 2, zp, 0.055, ghWallH + 0.04, 0.055);
        b.box(mGhBronze, ghX1, ghY0 + ghWallH / 2, zp, 0.055, ghWallH + 0.04, 0.055);
      }
      for (const s of [-1, 1]) {
        b.box(mGhBronze, ghCX + s * (doorW / 2), ghY0 + ghWallH / 2, ghZ1, 0.058, ghWallH + 0.04, 0.058);
        b.box(mGhBronze, ghCX + s * (doorW / 2), ghY0 + ghWallH / 2, ghZ0, 0.05, ghWallH + 0.04, 0.05);
      }
      // Top eave beams around all 4 sides
      b.box(mGhBronze, ghCX, ghYEave, ghZ1, ghW + 0.08, 0.06, 0.065);
      b.box(mGhBronze, ghCX, ghYEave, ghZ0, ghW + 0.08, 0.06, 0.065);
      b.box(mGhBronze, ghX0, ghYEave, ghCZ, 0.065, 0.06, ghD + 0.08);
      b.box(mGhBronze, ghX1, ghYEave, ghCZ, 0.065, 0.06, ghD + 0.08);

      // Arched top window frames inside the 3 side bays (Left & Right walls) and 2 front side bays
      const bayD = ghD / 3;
      const rBayArch = (bayD - 0.06) / 2;
      for (let bi = 0; bi < 3; bi++) {
        const bzM = ghZ0 + bayD * (bi + 0.5);
        for (let k = 0; k < 6; k++) {
          const a0 = (k / 6) * Math.PI;
          const a1 = ((k + 1) / 6) * Math.PI;
          const am = (a0 + a1) / 2;
          const chord = 2 * rBayArch * Math.sin((a1 - a0) / 2) + 0.015;
          const rx = Math.PI / 2 - am;
          const py = ghYEave - 0.28 + Math.sin(am) * rBayArch;
          const pz = bzM + Math.cos(am) * rBayArch;
          b.box(mGhBronze, ghX0, py, pz, 0.045, 0.036, chord, { rx });
          b.box(mGhBronze, ghX1, py, pz, 0.045, 0.036, chord, { rx });
        }
      }
      const rFrontSideArch = (fSideW - 0.06) / 2;
      for (const s of [-1, 1]) {
        const fx = ghCX + s * (doorW / 2 + fSideW / 2);
        for (let k = 0; k < 6; k++) {
          const a0 = (k / 6) * Math.PI;
          const a1 = ((k + 1) / 6) * Math.PI;
          const am = (a0 + a1) / 2;
          const chord = 2 * rFrontSideArch * Math.sin((a1 - a0) / 2) + 0.014;
          const rz = am - Math.PI / 2;
          b.box(
            mGhBronze,
            fx + Math.cos(am) * rFrontSideArch,
            ghYEave - 0.26 + Math.sin(am) * rFrontSideArch,
            ghZ1,
            chord,
            0.036,
            0.045,
            { rz }
          );
        }
      }

      // 4) Curved/Arched Barrel-Vault Glass Roof & Sunburst Arch Motif Over Front Entrance
      // Roof curve helper: u in [0, 1] from eave (u=0) to central ridge (u=1)
      const roofHalfW = ghW / 2;
      const roofYAt = u => ghYEave + ghRoofH * (Math.sin(u * 1.18) / Math.sin(1.18));
      const nRoofSeg = 7;
      for (let k = 0; k < nRoofSeg; k++) {
        const u0 = k / nRoofSeg;
        const u1 = (k + 1) / nRoofSeg;
        const x0Off = u0 * roofHalfW;
        const x1Off = u1 * roofHalfW;
        const y0R = roofYAt(u0);
        const y1R = roofYAt(u1);
        const dx = x1Off - x0Off;
        const dy = y1R - y0R;
        const segLen = Math.hypot(dx, dy) + 0.015;
        const xmOff = (x0Off + x1Off) / 2;
        const ymR = (y0R + y1R) / 2;
        const ang = Math.atan2(dy, dx);

        // Left & Right Curved Glass Roof Strips
        b.box(mGhGlass, ghCX - roofHalfW + xmOff, ymR, ghCZ, segLen, 0.018, ghD - 0.04, { rz: ang });
        b.box(mGhGlass, ghCX + roofHalfW - xmOff, ymR, ghCZ, segLen, 0.018, ghD - 0.04, { rz: -ang });

        // 4 Curved Bronze Roof Ribs along zBays (Front Arch Gable, 2 Middle Ribs, Back Arch Gable)
        for (const zp of zBays) {
          const isGable = zp === ghZ0 || zp === ghZ1;
          const ribThick = isGable ? 0.055 : 0.04;
          b.box(mGhBronze, ghCX - roofHalfW + xmOff, ymR, zp, segLen + 0.01, ribThick, ribThick, { rz: ang });
          b.box(mGhBronze, ghCX + roofHalfW - xmOff, ymR, zp, segLen + 0.01, ribThick, ribThick, { rz: -ang });
        }
      }
      // Longitudinal Roof Purlins at u = 0.35 and u = 0.70 + Central Ridge Beam
      for (const uP of [0.36, 0.72]) {
        const xOff = uP * roofHalfW;
        const yP = roofYAt(uP);
        b.box(mGhBronze, ghCX - roofHalfW + xOff, yP, ghCZ, 0.032, 0.032, ghD);
        b.box(mGhBronze, ghCX + roofHalfW - xOff, yP, ghCZ, 0.032, 0.032, ghD);
      }
      b.box(mGhBronzeDark, ghCX, ghYRidge + 0.02, ghCZ, 0.06, 0.06, ghD + 0.10);

      // Front & Back Gable Glass Tympanum Fill + Iconic Sunburst Arch Motif (Jari-Jari Setengah Lingkaran) on Front Gable!
      const rSun = doorW / 2; // 0.46
      const sunGlassGeo = new THREE.CylinderGeometry(rSun, rSun, 0.018, 24, 1, false, -Math.PI / 2, Math.PI);
      sunGlassGeo.rotateX(-Math.PI / 2);
      b.add(mGhGlass, solid(sunGlassGeo), ghCX, ghYEave, ghZ1);
      b.add(mGhGlass, solid(sunGlassGeo.clone()), ghCX, ghYEave, ghZ0);
      // Semicircular Sunburst Arch Ring & 5 Radiating Sunburst Spokes above the Front Entrance!
      for (let k = 0; k < 10; k++) {
        const a0 = (k / 10) * Math.PI;
        const a1 = ((k + 1) / 10) * Math.PI;
        const am = (a0 + a1) / 2;
        const chord = 2 * rSun * Math.sin((a1 - a0) / 2) + 0.018;
        b.box(
          mGhBronze,
          ghCX + Math.cos(am) * rSun,
          ghYEave + Math.sin(am) * rSun,
          ghZ1 + 0.015,
          chord,
          0.048,
          0.052,
          { rz: am - Math.PI / 2 }
        );
      }
      // 5 Sunburst Radial Spokes (Jari-Jari Setengah Lingkaran) + Vertical King Post to Ridge
      for (const sAng of [0.42, 0.98, Math.PI / 2, Math.PI - 0.98, Math.PI - 0.42]) {
        const spokeL = rSun - 0.02;
        b.box(
          mGhBronze,
          ghCX + Math.cos(sAng) * (spokeL / 2),
          ghYEave + Math.sin(sAng) * (spokeL / 2),
          ghZ1 + 0.015,
          spokeL,
          0.032,
          0.04,
          { rz: sAng }
        );
      }
      b.box(mGhBronze, ghCX, (ghYEave + rSun + ghYRidge) / 2, ghZ1 + 0.01, 0.042, ghYRidge - (ghYEave + rSun), 0.045);
      b.box(mGhBronze, ghCX, (ghYEave + ghYRidge) / 2, ghZ0 - 0.01, 0.042, ghYRidge - ghYEave, 0.045);

      // 5) Decorative Roof Cresting & 2 Pointed Finials along the Ridge (Ornamen Mahkota Bergerigi & 2 Ujung Lancip)
      b.box(mGhBronzeDark, ghCX, ghYRidge + 0.10, ghCZ, 0.025, 0.025, ghD - 0.04);
      const nCrest = 13;
      for (let k = 0; k < nCrest; k++) {
        const cz0 = ghZ0 + 0.14 + (k / (nCrest - 1)) * (ghD - 0.28);
        b.box(mGhBronzeDark, ghCX, ghYRidge + 0.08, cz0, 0.022, 0.11, 0.022);
        b.add(mGhBronzeDark, unitCone, ghCX, ghYRidge + 0.15, cz0, 0.028, 0.06, 0.028);
      }
      // 2 Tall Pointed Roof Finials at Front (ghZ1) and Back (ghZ0) Peaks
      for (const fz of [ghZ0, ghZ1]) {
        b.box(mGhBronzeDark, ghCX, ghYRidge + 0.08, fz, 0.065, 0.10, 0.065);
        b.sphere(mGhBronzeDark, ghCX, ghYRidge + 0.16, fz, 0.042);
        b.add(mGhBronzeDark, unitCone, ghCX, ghYRidge + 0.28, fz, 0.042, 0.20, 0.042);
      }

      // 6) Interior Tiered Wooden Plant Bench, Potted Roses/Peonies, Hanging Baskets & Warm String Lights
      // Helper: Terracotta Potted Blooming Rose/Peony Bush
      const addFloralPot = (px, py, pz, rPot, bloomMat1, bloomMat2, tall = false) => {
        const hPot = rPot * 1.45;
        b.cyl(mTerraPot, px, py + hPot / 2, pz, rPot, hPot);
        b.cyl(mTerraRim, px, py + hPot - 0.015, pz, rPot * 1.10, 0.032);
        const hFoliage = tall ? rPot * 1.55 : rPot * 1.05;
        b.crown(mLeaf, px, py + hPot + hFoliage * 0.45, pz, rPot * 1.25, hFoliage, rPot * 1.25, 1);
        for (const [ox, oy, oz, mB] of [
          [-0.45, 0.65, 0.35, bloomMat1],
          [0.48, 0.60, 0.32, bloomMat2],
          [0.0, 0.92, 0.12, bloomMat1],
          [-0.32, 0.72, -0.40, bloomMat2],
          [0.38, 0.78, -0.35, bloomMat1]
        ]) {
          b.sphere(mB, px + ox * rPot, py + hPot + oy * hFoliage, pz + oz * rPot, rPot * 0.36);
        }
      };

      // Tiered Wooden Plant Bench inside Left & Back of Conservatory
      const benchX = ghX0 + 0.34;
      b.box(mGhBronze, benchX, ghY0 + 0.24, ghCZ - 0.06, 0.48, 0.035, ghD - 0.36);
      b.box(mGhBronze, benchX - 0.08, ghY0 + 0.50, ghCZ - 0.06, 0.34, 0.035, ghD - 0.36);
      for (const bzL of [ghZ0 + 0.24, ghCZ - 0.06, ghZ1 - 0.34]) {
        b.box(mGhBronze, benchX - 0.20, ghY0 + 0.25, bzL, 0.035, 0.50, 0.035);
        b.box(mGhBronze, benchX + 0.20, ghY0 + 0.12, bzL, 0.035, 0.24, 0.035);
      }
      // Upper bench row of blooming terracotta rose & peony pots (pink, coral, cream-white)
      const benchPalette = [
        [mHydrangeaPink, mRoseCream],
        [mBottleCoral, mHydrangeaPink],
        [mRoseCream, mHydrangeaPink],
        [mFuchsiaMag, mBottleCoral],
        [mHydrangeaPink, mRoseCream]
      ];
      for (let i = 0; i < 5; i++) {
        const pz = ghZ0 + 0.30 + i * 0.34;
        const [c1, c2] = benchPalette[i];
        addFloralPot(benchX - 0.08, ghY0 + 0.52, pz, 0.095, c1, c2, false);
      }
      // Lower bench row of smaller flower pots
      for (let i = 0; i < 4; i++) {
        const pz = ghZ0 + 0.38 + i * 0.38;
        const [c1, c2] = benchPalette[(i + 1) % 5];
        addFloralPot(benchX + 0.08, ghY0 + 0.02, pz, 0.085, c1, c2, false);
      }
      // Right-interior floor row of blooming peony & hydrangea bushes (visible through right glass wall)
      for (let i = 0; i < 4; i++) {
        const pz = ghZ0 + 0.36 + i * 0.38;
        addFloralPot(ghX1 - 0.28, ghY0 + 0.02, pz, 0.11, mHydrangeaPink, mRoseCream, true);
      }

      // Helper: Hanging Orchid & Fuchsia Basket with Trailing Vines
      const addHangingBasket = (hx, hyTop, hz, wireH = 0.28) => {
        const yBasket = hyTop - wireH;
        b.cyl(mIron, hx, hyTop - wireH / 2, hz, 0.008, wireH);
        b.cyl(mGhBronzeDark, hx, yBasket, hz, 0.13, 0.11);
        b.sphere(mGhBronze, hx, yBasket - 0.03, hz, 0.11);
        b.crown(mLeaf, hx, yBasket + 0.08, hz, 0.17, 0.12, 0.17, 2);
        for (const [bx, by, bz, mFl] of [
          [-0.08, 0.10, 0.08, mFuchsiaMag],
          [0.09, 0.09, 0.07, mHydrangeaPink],
          [0.0, 0.14, 0.09, mRoseCream],
          [-0.09, 0.08, -0.07, mWisteriaDeep],
          [0.08, 0.11, -0.08, mFuchsiaMag]
        ]) {
          b.sphere(mFl, hx + bx, yBasket + by, hz + bz, 0.042);
        }
        // Trailing green vine tendrils hanging below the basket
        for (const [vx, vz, vLen] of [[-0.09, 0.06, 4], [0.08, 0.05, 5], [0.02, -0.08, 3]]) {
          for (let s = 0; s < vLen; s++) {
            b.sphere(mLeaf, hx + vx, yBasket - 0.04 - s * 0.048, hz + vz, 0.024);
          }
        }
      };
      // 2 Front Arched Bay Hanging Baskets + 2 Side Arched Bay Hanging Baskets + 2 Interior Roof Baskets
      addHangingBasket(ghCX - (doorW / 2 + fSideW / 2), ghYEave - 0.18, ghZ1 + 0.04, 0.24);
      addHangingBasket(ghCX + (doorW / 2 + fSideW / 2), ghYEave - 0.18, ghZ1 + 0.04, 0.24);
      addHangingBasket(ghX1 + 0.04, ghYEave - 0.18, ghZ0 + bayD * 2.5, 0.24);
      addHangingBasket(ghX1 + 0.04, ghYEave - 0.18, ghZ0 + bayD * 1.5, 0.24);
      addHangingBasket(ghCX - 0.26, ghYEave + 0.44, ghCZ - 0.10, 0.26);
      addHangingBasket(ghCX + 0.26, ghYEave + 0.44, ghCZ - 0.32, 0.26);

      // Warm Café String Lights (Untai Lampu Bohlam Gantung) + Dedicated Warm Golden PointLight inside Greenhouse!
      for (let i = 0; i < 6; i++) {
        const u = i / 5;
        const lx = ghCX - 0.56 + u * 1.12;
        const sag = Math.sin(u * Math.PI) * 0.12;
        const ly = ghYEave - 0.08 - sag;
        b.cyl(mIron, lx, ly + 0.03, ghZ1 - 0.16, 0.01, 0.04);
        b.sphere(M.bulb, lx, ly, ghZ1 - 0.16, 0.034);
      }
      for (let i = 0; i < 5; i++) {
        const u = i / 4;
        const lz = ghZ0 + 0.28 + u * (ghD - 0.56);
        const sag = Math.sin(u * Math.PI) * 0.10;
        b.sphere(M.bulb, ghCX, ghYEave + 0.24 - sag, lz, 0.034);
      }
      addPolePointLight(g, ghCX, ghYEave + 0.12, ghCZ, 1.35, 0xffcf78, 5.0, 1.4, 0.45);
      S.lights.push([new THREE.Vector3(ghCX, ghYEave + 0.10, ghCZ + 0.25), '#ffd282', 4.6, 2.8]);

      // 7) Cascading Purple Wisteria Vines on the Right Roof & Right Wall (Tanaman Merambat Wisteria Ungu)
      // Helper: Pendulous Wisteria Flower Raceme (Untaian Bunga Wisteria Menjuntai)
      const addWisteriaRaceme = (wx, wyTop, wz, nDrops = 5) => {
        for (let s = 0; s < nDrops; s++) {
          const rDrop = 0.056 * (1 - s * 0.12);
          const mCol = s % 2 === 0 ? mWisteriaDeep : mWisteriaLight;
          b.sphere(mCol, wx + (s % 2 === 0 ? 0.01 : -0.01), wyTop - s * 0.062, wz, rDrop);
        }
      };
      // Climbing vine foliage & cascading wisteria racemes across the right roof slope and right corner post
      for (const [uR, zR, nD] of [
        [0.75, ghZ0 + 0.42, 4],
        [0.52, ghZ0 + 0.62, 5],
        [0.30, ghZ0 + 0.50, 5],
        [0.64, ghCZ - 0.05, 5],
        [0.38, ghCZ + 0.12, 6],
        [0.16, ghCZ - 0.18, 5],
        [0.45, ghZ1 - 0.42, 5],
        [0.18, ghZ1 - 0.28, 6],
        [0.04, ghZ0 + 0.35, 6],
        [0.02, ghCZ + 0.08, 6],
        [0.02, ghZ1 - 0.35, 5]
      ]) {
        const vx = ghCX + roofHalfW - uR * roofHalfW + 0.03;
        const vy = roofYAt(uR) + 0.05;
        b.crown(mLeaf, vx, vy, zR, 0.20, 0.10, 0.20, 1);
        b.crown(mLeafOlive, vx + 0.05, vy - 0.02, zR + 0.06, 0.15, 0.09, 0.15, 2);
        addWisteriaRaceme(vx + 0.03, vy - 0.04, zR, nD);
      }
      // Vertical climbing vine stem & wisteria clusters along the right-rear wall post (ghX1, ghZ0 + 0.28)
      b.cyl(mGhBronzeDark, ghX1 + 0.05, ghY0 + ghWallH * 0.55, ghZ0 + 0.24, 0.028, ghWallH * 0.95);
      for (const vy0 of [ghY0 + 0.55, ghY0 + 0.88, ghY0 + 1.15]) {
        b.crown(mLeaf, ghX1 + 0.07, vy0, ghZ0 + 0.26, 0.18, 0.14, 0.18, 1);
        addWisteriaRaceme(ghX1 + 0.09, vy0 - 0.02, ghZ0 + 0.32, 4);
      }

      // 8) Exterior Wooden Planter Boxes (Hydrangea Pink, Pastel Blue & Lavender), Terracotta Pots & Metal Watering Can
      // Front-Right Wooden Planter Box: Pink Hydrangeas
      const pbX = ghX1 + 0.21;
      const pb1Z = ghCZ + 0.48, pb2Z = ghCZ - 0.48;
      for (const [pz, isBlueLav] of [[pb1Z, false], [pb2Z, true]]) {
        b.box(mGhWainscot, pbX, ghY0 + 0.14, pz, 0.34, 0.28, 0.86, { r: 0.015 });
        b.box(mGhBronze, pbX, ghY0 + 0.28, pz, 0.38, 0.03, 0.90);
        b.box(mSoil, pbX, ghY0 + 0.27, pz, 0.30, 0.02, 0.82);
        for (let k = -1; k <= 1; k++) {
          const fz = pz + k * 0.24;
          b.crown(mLeaf, pbX, ghY0 + 0.36, fz, 0.20, 0.16, 0.20, k + 2);
          if (!isBlueLav) {
            b.sphere(mHydrangeaPink, pbX - 0.03, ghY0 + 0.46, fz, 0.11);
            b.sphere(mBlushPink, pbX + 0.05, ghY0 + 0.43, fz + 0.05, 0.085);
          } else if (k <= 0) {
            b.sphere(mHydrangeaBlue, pbX - 0.02, ghY0 + 0.47, fz, 0.115);
            b.sphere(mWisteriaLight, pbX + 0.05, ghY0 + 0.44, fz - 0.04, 0.085);
          } else {
            // Upright Purple Lavender Spikes at the rear of the second planter box
            for (const [lx, lz] of [[-0.05, -0.05], [0.0, 0.04], [0.06, -0.02], [-0.02, 0.09]]) {
              b.cyl(mLeaf, pbX + lx, ghY0 + 0.42, fz + lz, 0.012, 0.22);
              b.cyl(mWisteriaDeep, pbX + lx, ghY0 + 0.54, fz + lz, 0.026, 0.16);
            }
          }
        }
      }

      // 3 Round Terracotta Pots by the Front Glasshouse Entrance (Left Pair + Right Corner Pot)
      addFloralPot(ghX0 - 0.06, ghY0, ghZ1 + 0.16, 0.145, mHydrangeaPink, mBottleCoral, true);
      addFloralPot(ghX0 + 0.22, ghY0, ghZ1 + 0.22, 0.115, mRoseCream, mHydrangeaPink, false);
      addFloralPot(ghCX + doorW / 2 + 0.14, ghY0, ghZ1 + 0.18, 0.12, mWisteriaDeep, mWisteriaLight, true);

      // Silver-Blue Metal Watering Can (Penyiram Tanaman Logam Perak-Biru) right beside the Front Entrance!
      const wcX = ghCX + 0.18, wcZ = ghZ1 + 0.20;
      b.cyl(mWaterCan, wcX, ghY0 + 0.11, wcZ, 0.085, 0.20);
      b.cyl(mWaterCan, wcX, ghY0 + 0.21, wcZ, 0.088, 0.02);
      // Arched top carry handle & rear grip handle
      b.box(mWaterCan, wcX, ghY0 + 0.27, wcZ, 0.018, 0.08, 0.14, { r: 0.01 });
      b.box(mWaterCan, wcX + 0.09, ghY0 + 0.12, wcZ, 0.05, 0.11, 0.018, { r: 0.01 });
      // Long angled pouring spout & sprinkler rose head pointing left-front
      b.cyl(mWaterCan, wcX - 0.11, ghY0 + 0.15, wcZ + 0.03, 0.016, 0.22, { rz: 0.72 });
      b.cyl(mWaterCan, wcX - 0.19, ghY0 + 0.22, wcZ + 0.04, 0.034, 0.025, { rz: 0.72 });

      // Clean Queue Path on the front sidewalk
      S.queuePath = [
        [1.72, 2.25], [-1.85, 2.25], [-1.85, 3.10], [1.95, 3.10]
      ];
      b.build(g);

      const occluder = new THREE.Mesh(unitBox, linkProbe);
      occluder.visible = false;
      occluder.position.set(cxB, (H + 0.4) / 2, czB);
      occluder.scale.set(wB + 0.8, H + 0.4, dB + 0.8);
      occluder.userData.store = index;
      villageOuterLot.add(occluder);
      links.push(occluder);

      for (const L of S.lights) {
        g.localToWorld(L[0]);
        addLight(L[0], L[1], L[2], L[3], index);
      }
      S.focus = g.localToWorld(new THREE.Vector3(cxB, 2.85, 0.45));
      S.label = g.localToWorld(new THREE.Vector3(cxB, H + 0.85, czB));
      stores.push(S);
      return;
    }

    if (style === 'pavilion') {
      // ======================================================================
      // STORE #2: COZY BITES & SIPS (1-Story F&B Boutique & Corner Bistro)
      // 100% Faithful to the 4-Panel Architectural Concept Sheet:
      // 1) 1-Story Warm Parisian Bakery & Corner Bistro Facade:
      //    - Warm Cream Plaster Walls (#F6ECD9) + Timber Pilaster Columns (#C69F76)
      //    - Lower Wooden Wainscoting (height ~1.20m) with recessed panel frames
      //    - Flat Decorative Roofline with tiered wooden cornice & parapet
      //    - Main Storefront Signage ("COZY BITES & SIPS") framed in wood above awning
      // 2) Chic Canvas Awning & Welcoming Entrance Door:
      //    - Striped Canvas Awning (#B69574 taupe & #F5EFE6 cream) with scalloped trim
      //      across front storefront and over the left side 4-pane window
      //    - Welcoming wooden entrance door with clear glass, brass vertical handle,
      //      hanging "OPEN / ENTRY" sign, plus Cozy Corner Entry detail
      // 3) Large Glass Display Window, 3D Bakery Shelf, Espresso Bar & Takeaway Window:
      //    - Lit by 2 Warm Yellow Hanging Pendant Lamps
      //    - Multi-tier wooden bakery shelves stocked with 3D golden croissants,
      //      artisan sourdough loaves, and a woven baguette basket
      //    - Barista counter with 3D Commercial Espresso Machine, Coffee Grinder,
      //      and wall-mounted Chalkboard Menu ("ESPRESSO & BAKERY")
      //    - Right-side Takeaway Window with stacked paper coffee cups & hanging menu
      // 4) Outdoor & Side Bistro Seating + Side Profile Details:
      //    - Round Wooden Bistro Table + 2 Bistro Chairs in front of display window
      //      AND on the left side under the 4-pane grid window
      //    - Black folding A-Frame Menu Boards ("MENU"), classic lantern Wall Sconces,
      //      rear-left vertical downspout pipe, terracotta potted bushes, and 1 classic
      //      street lamp on the front-right sidewalk corner (0 large trees or old ropes!)
      // ======================================================================
      const villageOuterLot = new THREE.Group();
      villageOuterLot.position.copy(g.position);
      villageOuterLot.rotation.copy(g.rotation);
      world.add(villageOuterLot);
      S.villageOuterLot = villageOuterLot;

      // 1) Warm Terracotta/Sand Brick Paver Texture (#DFC8A8 & #C8AE8C) for Full Block & Sidewalk
      const cozyBrickPaverTex = (() => {
        const W = 512, H = 512;
        const c = document.createElement('canvas');
        c.width = W;
        c.height = H;
        const ctx = c.getContext('2d');
        // Warm sandy-brown mortar joint base
        ctx.fillStyle = '#9E8366';
        ctx.fillRect(0, 0, W, H);
        const rows = 16, cols = 8;
        const bw = W / cols, bh = H / rows;
        const palette = ['#DFC8A8', '#C8AE8C', '#E4D0B2', '#D2B896', '#CBB08E', '#E0C9A7'];
        for (let r = 0; r < rows; r++) {
          const ox = (r % 2) * (bw * 0.5);
          for (let col = -1; col <= cols; col++) {
            const baseHex = palette[(r * 5 + col * 3 + 16) % palette.length];
            const bx = col * bw + ox + 2;
            const by = r * bh + 2;
            const wBrick = bw - 4;
            const hBrick = bh - 4;
            ctx.fillStyle = baseHex;
            ctx.beginPath();
            ctx.roundRect(bx, by, wBrick, hBrick, 4);
            ctx.fill();
            // Subtle warm top-left bevel highlight & bottom-right shadow
            ctx.fillStyle = 'rgba(255, 248, 235, 0.24)';
            ctx.fillRect(bx + 2, by + 1.5, wBrick - 4, 3);
            ctx.fillStyle = 'rgba(110, 82, 54, 0.18)';
            ctx.fillRect(bx + 2, by + hBrick - 3.5, wBrick - 4, 2.5);
          }
        }
        const tx = new THREE.CanvasTexture(c);
        tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
        tx.repeat.set(0.46, 0.46);
        tx.anisotropy = 8;
        tx.colorSpace = THREE.SRGBColorSpace;
        return tx;
      })();

      // 2) Sweeping River-Cobblestone Mosaic Ribbon Texture (#8E9699, #A8B0B2 with Thin Stone Border)
      const cozyCobbleWaveTex = (() => {
        const W = 512, H = 256;
        const c = document.createElement('canvas');
        c.width = W;
        c.height = H;
        const ctx = c.getContext('2d');
        // Deep pebble-bed mortar background
        ctx.fillStyle = '#555C60';
        ctx.fillRect(0, 0, W, H);
        // Top & bottom thin stone border strips (v in [0..28] and [H-28..H])
        const borderH = 26;
        ctx.fillStyle = '#D8C8B0';
        ctx.fillRect(0, 0, W, borderH);
        ctx.fillRect(0, H - borderH, W, borderH);
        ctx.fillStyle = '#6A5B4C';
        ctx.fillRect(0, borderH - 3, W, 3);
        ctx.fillRect(0, H - borderH, W, 3);
        for (let x = 0; x < W; x += 32) {
          ctx.fillStyle = ((x / 32) % 2 === 0) ? '#DECeb6' : '#CBB99E';
          ctx.fillRect(x + 2, 2, 28, borderH - 6);
          ctx.fillRect(x + 2, H - borderH + 4, 28, borderH - 6);
        }
        // Bluish-grey rounded river cobblestones packed in staggered organic rows
        const cobbleCols = ['#8E9699', '#A8B0B2', '#7E878B', '#9BA4A7', '#B2BABC', '#869094', '#B7AA98'];
        const rowY = [44, 76, 110, 144, 178, 210];
        rowY.forEach((cy, rIdx) => {
          const stepX = 32;
          const ox = (rIdx % 2) * 16;
          for (let cx = -16; cx <= W + 16; cx += stepX) {
            const jx = cx + ox + Math.sin(rIdx * 3.1 + cx * 0.07) * 3.5;
            const jy = cy + Math.cos(rIdx * 2.3 + cx * 0.05) * 2.5;
            const rx = 12.5 + ((rIdx * 7 + Math.round(cx)) % 3) * 1.4;
            const ry = 10.5 + ((rIdx * 5 + Math.round(cx)) % 3) * 1.1;
            const col = cobbleCols[(rIdx * 11 + Math.abs(Math.round(cx / 16))) % cobbleCols.length];
            ctx.save();
            ctx.translate(jx, jy);
            ctx.rotate(Math.sin(cx * 0.1 + rIdx) * 0.25);
            ctx.fillStyle = col;
            ctx.beginPath();
            ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#3E4447';
            ctx.lineWidth = 2;
            ctx.stroke();
            // River pebble top highlight
            ctx.fillStyle = 'rgba(255, 255, 255, 0.26)';
            ctx.beginPath();
            ctx.ellipse(-rx * 0.22, -ry * 0.24, rx * 0.48, ry * 0.36, -0.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        });
        const tx = new THREE.CanvasTexture(c);
        tx.wrapS = THREE.RepeatWrapping;
        tx.wrapT = THREE.ClampToEdgeWrapping;
        tx.anisotropy = 8;
        tx.colorSpace = THREE.SRGBColorSpace;
        return tx;
      })();

      // Palette Materials for Cozy Bites & Sips
      const mStepStone = mat('#C9BFB0', { roughness: 0.65 }, t);
      const mCozyBrickPaver = mat('#FFFFFF', { map: cozyBrickPaverTex, roughness: 0.65 }, t);
      const mCobbleWaveRibbon = mat(
        '#FFFFFF',
        {
          map: cozyCobbleWaveTex,
          roughness: 0.65,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1
        },
        t
      );
      const mCobbleBlue1 = mat('#8E9699', { roughness: 0.72 }, t);
      const mCobbleBlue2 = mat('#A8B0B2', { roughness: 0.70 }, t);
      const mCobbleSlate = mat('#798286', { roughness: 0.76 }, t);
      const mCobbleBorder = mat('#D8C8B0', { roughness: 0.80 }, t);
      const mInlayTileBase = mat('#E6D9C3', { roughness: 0.78 }, t);
      const mInlayTileRim = mat('#B59E80', { roughness: 0.82 }, t);
      const mInlayReliefGold = mat('#B88346', { roughness: 0.52, metalness: 0.18 }, t);
      const mInlayReliefBean = mat('#8C5A32', { roughness: 0.56, metalness: 0.12 }, t);
      const mCitrusOrange = mat('#F28C28', { roughness: 0.42 }, t);
      const mFlowerPink = mat('#E87A96', { roughness: 0.68 }, t);
      const mFlowerPurple = mat('#9B6ED8', { roughness: 0.68 }, t);
      const mWickerBasket = mat('#A87B4C', { roughness: 0.82 }, t);

      const mPlaster = mat('#F6ECD9', { roughness: 0.84 }, t);
      const mTimber = mat(
        '#C69F76',
        { roughness: 0.76, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 },
        t
      );
      const mTimberDark = mat(
        '#9E7348',
        { roughness: 0.78, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 },
        t
      );
      const mTimberDeep = mat(
        '#6E4B2C',
        { roughness: 0.80, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 },
        t
      );
      const mInkOutline = mat(
        '#2C221E',
        { roughness: 0.72, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 },
        t
      );
      const mAwningTaupe = mat('#B69574', { roughness: 0.74 }, t);
      const mAwningCream = mat('#F5EFE6', { roughness: 0.72 }, t);
      const mRoofDeck = mat('#E6DDD0', { roughness: 0.88 }, t);
      const mBrass = mat('#E2B24A', { roughness: 0.28, metalness: 0.70 }, t);
      const mIron = mat('#2A2827', { roughness: 0.46, metalness: 0.42 }, t);
      const mPipeGrey = mat('#7C8082', { roughness: 0.50, metalness: 0.36 }, t);
      const mTerracottaPot = mat('#C6764E', { roughness: 0.80 }, t);
      const mTerracottaRim = mat('#B0623B', { roughness: 0.82 }, t);
      const mLeafDark = mat('#558248', { roughness: 0.75, flatShading: true }, t);
      const mLeafLight = mat('#74A15E', { roughness: 0.75, flatShading: true }, t);
      const mLeafBright = mat('#8AB46E', { roughness: 0.75, flatShading: true }, t);
      const mSoil = mat('#5A4030', { roughness: 0.92 }, t);

      // Bakery & Barista 3D Interior Showcase Materials
      const mVitrineBack = mat(
        '#FFF2D0',
        {
          emissive: '#FFBE5C',
          emissiveIntensity: 1.18,
          roughness: 0.42
        },
        t
      );
      mVitrineBack.userData.noCast = true;
      mVitrineBack.userData.noReceive = true;
      registerWindowGlow(mVitrineBack, 1.18);

      const mCozySignMat = mat(
        '#FFFDF8',
        {
          map: atlas.tex,
          emissive: '#FFE6C2',
          emissiveMap: atlas.tex,
          emissiveIntensity: 0.42,
          roughness: 0.46,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2
        },
        t
      );
      mCozySignMat.userData.noCast = true;
      mCozySignMat.userData.noReceive = true;

      const mCroissantGold = mat('#DF9B48', { roughness: 0.55 }, t);
      const mBreadCrust = mat('#C47D38', { roughness: 0.65 }, t);
      const mBreadCrumb = mat('#F3D8A8', { roughness: 0.62 }, t);
      const mEspressoSteel = mat('#D8D4CE', { roughness: 0.30, metalness: 0.62 }, t);
      const mCupWhite = mat('#FFFDF9', { roughness: 0.32 }, t);
      const mAmberShade = mat('#E5A645', { emissive: '#FFAE42', emissiveIntensity: 0.78, roughness: 0.38 }, t);

      const mClearGlass = new THREE.MeshStandardMaterial({
        color: 0xfff2d4,
        emissive: 0xffc066,
        emissiveIntensity: 0.42,
        roughness: 0.1,
        metalness: 0.08,
        transparent: true,
        opacity: 0.42,
        depthWrite: false
      });
      mClearGlass.userData.noCast = true;
      registerWindowGlow(mClearGlass, 0.42);

      // Full-Block Unified Sidewalk Base in villageOuterLot:
      // - Outer Curb Rim at y = 0.190 (hollowCurbRingGeo)
      // - Inner Brick Paver Sidewalk Base Tile at y0 = 0.180
      // - Yellow Tactile Paving Strip at y = 0.195
      const bLot = new Batch();
      bLot.add(mStepStone, hollowCurbRingGeo(BLOCK, BLOCK, 1.2, 0.14, 0.190), 0, 0, 0);
      bLot.add(mStepStone, roundedRectGeometry(BLOCK - 0.28, BLOCK - 0.28, 1.06, 0.155), 0, 0, 0);
      bLot.add(mCozyBrickPaver, lotGeometry(BLOCK - 0.28, 1.06, 0.025), 0, 0.155, 0);
      const tactOff2 = BLOCK * 0.5 - 0.23;
      const tactSpan2 = BLOCK - 2.40;
      for (const s of [-1, 1]) {
        bLot.box(M.tactileYellow, 0, 0.1875, s * tactOff2, tactSpan2, 0.015, 0.16);
        bLot.box(M.tactileYellow, s * tactOff2, 0.1875, 0, 0.16, 0.015, tactSpan2);
      }

      // Isolated Catalog Stage Base inside g (hidden in Town View so the full 11x11 block is 100% seamless!)
      const swX0 = -4.25, swX1 = 4.15, swZ0 = -2.85, swZ1 = 3.15;
      const swW = swX1 - swX0, swD = swZ1 - swZ0, swCX = (swX0 + swX1) / 2, swCZ = (swZ0 + swZ1) / 2;
      const stageBaseGroup = new THREE.Group();
      stageBaseGroup.visible = false;
      const bStageBase = new Batch();
      bStageBase.add(mStepStone, hollowCurbRingGeo(swW + 0.20, swD + 0.20, 0.95, 0.10, 0.190), swCX, 0, swCZ);
      bStageBase.add(mStepStone, roundedRectGeometry(swW, swD, 0.85, 0.155), swCX, 0, swCZ);
      bStageBase.add(mCozyBrickPaver, roundedRectGeometry(swW, swD, 0.85, 0.025), swCX, 0.155, swCZ);
      bStageBase.build(stageBaseGroup);
      g.add(stageBaseGroup);
      S.stageBaseGroup = stageBaseGroup;

      // Building Footprint Coordinates (1-Story F&B Boutique & Bistro)
      const xL = -2.75, xR = 2.55, wB = xR - xL, cxB = (xL + xR) / 2; // wB = 5.30, cxB = -0.10
      const zB = -2.20, zF = 1.40, dB = zF - zB, czB = (zB + zF) / 2; // dB = 3.60, czB = -0.40
      const y0 = 0.18;
      const yWainscot = 1.38; // 1.20m lower timber wainscoting
      const yWallTop = 3.84;
      const hWall = yWallTop - y0; // 3.66

      // ----------------------------------------------------------------------
      // 1. MAIN 1-STORY WALL BODY, TIMBER PILASTERS & LOWER WAINSCOTING
      //    - Outer Wall Surface at zF = 1.40 (front), xL = -2.75 (left), zB = -2.20 (rear), xR = 2.55 (right)
      //    - Interior core box shrunk by >= 0.30m in width & depth (>= 0.15m per side) so inner walls never touch outer walls!
      //    - All exterior wainscoting, trim, pilasters & frames offset >= 0.04m outward with polygonOffset: -1/-1!
      // ----------------------------------------------------------------------
      const mWainscotFrame = mat(
        '#9E7348',
        { roughness: 0.78, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 },
        t
      );
      const mWainscotInlay = mat(
        '#F6ECD9',
        { roughness: 0.84, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 },
        t
      );
      b.box(mStepStone, cxB, y0 + 0.05, czB - 0.10, wB - 0.80, 0.10, dB - 0.90);
      // Recessed main interior plaster core shrunk >= 0.28m inward from every outer wall (width - 0.88, depth - 0.96, height - 0.12)
      b.box(mPlaster, cxB + 0.16, y0 + (hWall - 0.12) / 2, czB - 0.10, wB - 0.88, hWall - 0.12, dB - 0.96);
      // Non-overlapping Rear (-Z) and Right (+X) full-height plaster outer walls (zero corner intersection!)
      const wallT2 = 0.24;
      b.box(mPlaster, cxB, y0 + hWall / 2, zB + wallT2 / 2, wB, hWall, wallT2);
      b.box(mPlaster, xR - wallT2 / 2, y0 + hWall / 2, (zB + wallT2 + zF - wallT2) / 2, wallT2, hWall, dB - wallT2 * 2);
      // Non-overlapping Upper header walls & side piers flush at zF = 1.40 and xL = -2.75
      b.box(mPlaster, cxB, (2.52 + yWallTop) / 2, zF - wallT2 / 2, wB, yWallTop - 2.52, wallT2);
      b.box(mPlaster, xL + wallT2 / 2, (2.36 + yWallTop) / 2, (zB + wallT2 + zF - wallT2) / 2, wallT2, yWallTop - 2.36, dB - wallT2 * 2);
      b.box(mPlaster, xL + wallT2 / 2, (y0 + 2.36) / 2, -1.48, wallT2, 2.36 - y0, 0.96);
      b.box(mPlaster, xL + wallT2 / 2, (y0 + 2.36) / 2, 0.24, wallT2, 2.36 - y0, 0.44);
      b.box(mPlaster, cxB + 0.68, (y0 + 1.40) / 2, zF - wallT2 / 2, wB - 1.36, 1.40 - y0, wallT2);

      // Lower Timber Wainscoting Band (y = y0..yWainscot) protruding +0.04m outward from all 4 outer plaster walls (non-overlapping!)
      const hWain = yWainscot - y0;
      const wainThick = 0.04;
      // Front (+Z) wainscoting outside zF (surface at zF + 0.04, split around doorX = -2.00)
      b.box(mTimber, cxB + 0.68, y0 + hWain / 2, zF + wainThick / 2, wB - 1.36, hWain, wainThick);
      // Rear (-Z) wainscoting outside zB (surface at zB - 0.04)
      b.box(mTimber, cxB, y0 + hWain / 2, zB - wainThick / 2, wB + wainThick * 2, hWain, wainThick);
      // Left (-X) wainscoting outside xL (surface at xL - 0.04, stopping before corner entry z = 0.45)
      b.box(mTimber, xL - wainThick / 2, y0 + hWain / 2, (zB + 0.44) / 2, wainThick, hWain, 0.44 - zB);
      // Right (+X) wainscoting outside xR (surface at xR + 0.04)
      b.box(mTimber, xR + wainThick / 2, y0 + hWain / 2, czB, wainThick, hWain, dB);

      // Horizontal chair-rail ledge at top of wainscoting (y = yWainscot, protruding +0.06m outside wall)
      b.box(mTimberDark, cxB + 0.68, yWainscot + 0.025, zF + 0.03, wB - 1.36, 0.07, 0.06);
      b.box(mTimberDark, cxB, yWainscot + 0.025, zB - 0.03, wB + 0.12, 0.07, 0.06);
      b.box(mTimberDark, xL - 0.03, yWainscot + 0.025, (zB + 0.44) / 2, 0.06, 0.07, 0.44 - zB + 0.06);
      b.box(mTimberDark, xR + 0.03, yWainscot + 0.025, czB, 0.06, 0.07, dB + 0.12);
      // Lower base kick-skirt at y0 + 0.07 (protruding +0.055m outside wall)
      b.box(mTimberDeep, cxB + 0.68, y0 + 0.07, zF + 0.028, wB - 1.36, 0.11, 0.055);
      b.box(mTimberDeep, cxB, y0 + 0.07, zB - 0.028, wB + 0.11, 0.11, 0.055);
      b.box(mTimberDeep, xL - 0.028, y0 + 0.07, (zB + 0.44) / 2, 0.055, 0.11, 0.44 - zB + 0.05);
      b.box(mTimberDeep, xR + 0.028, y0 + 0.07, czB, 0.055, 0.11, dB + 0.11);

      // Wainscoting recessed panel frames on Front (+Z) pushed >= 0.055m & +0.075m outside zF with polygonOffset!
      for (const [px, pw] of [[-0.68, 1.05], [0.46, 1.05], [1.78, 0.98]]) {
        b.box(mWainscotFrame, px, y0 + hWain * 0.52, zF + 0.055, pw, 0.72, 0.024);
        b.box(mWainscotInlay, px, y0 + hWain * 0.52, zF + 0.075, pw - 0.14, 0.56, 0.016);
      }
      // Wainscoting recessed panel frames on Left Side (-X) pushed >= 0.055m & +0.075m outside xL with polygonOffset!
      for (const [pz, pd] of [[-1.42, 0.92], [-0.40, 0.92]]) {
        b.box(mWainscotFrame, xL - 0.055, y0 + hWain * 0.52, pz, 0.024, 0.72, pd);
        b.box(mWainscotInlay, xL - 0.075, y0 + hWain * 0.52, pz, 0.016, 0.56, pd - 0.14);
      }
      // Wainscoting recessed panel frames on Rear (-Z) & Right (+X) pushed >= 0.055m & +0.075m outside wall!
      for (const [px, pw] of [[-1.65, 1.32], [-0.10, 1.32], [1.45, 1.32]]) {
        b.box(mWainscotFrame, px, y0 + hWain * 0.52, zB - 0.055, pw, 0.72, 0.024);
        b.box(mWainscotInlay, px, y0 + hWain * 0.52, zB - 0.075, pw - 0.14, 0.56, 0.016);
      }
      for (const [pz, pd] of [[-1.35, 1.12], [0.45, 1.12]]) {
        b.box(mWainscotFrame, xR + 0.055, y0 + hWain * 0.52, pz, 0.024, 0.72, pd);
        b.box(mWainscotInlay, xR + 0.075, y0 + hWain * 0.52, pz, 0.016, 0.56, pd - 0.14);
      }

      // Vertical Timber Pilaster Columns (Timber Trim #C69F76) protruding +0.06m outside all 4 walls!
      const frontPilasterXs = [xL + 0.11, -1.34, 1.16, xR - 0.11];
      for (const px of frontPilasterXs) {
        b.box(mTimber, px, y0 + hWall / 2, zF + 0.03, 0.22, hWall, 0.06);
        b.box(mWainscotFrame, px, y0 + hWall / 2, zF + 0.072, 0.12, hWall - 0.08, 0.020);
      }
      const rearPilasterXs = [xL + 0.11, -0.95, 0.75, xR - 0.11];
      for (const px of rearPilasterXs) {
        b.box(mTimber, px, y0 + hWall / 2, zB - 0.03, 0.22, hWall, 0.06);
        b.box(mWainscotFrame, px, y0 + hWall / 2, zB - 0.072, 0.12, hWall - 0.08, 0.020);
      }
      const sidePilasterZs = [zB + 0.11, -1.34, 0.36, zF - 0.11];
      for (const pz of sidePilasterZs) {
        b.box(mTimber, xL - 0.03, y0 + hWall / 2, pz, 0.06, hWall, 0.22);
        b.box(mWainscotFrame, xL - 0.072, y0 + hWall / 2, pz, 0.020, hWall - 0.08, 0.12);
      }
      // Right Side (+X) corner & mid pilasters protruding +0.06m outside xR
      for (const pz of [zB + 0.11, -0.40, zF - 0.11]) {
        b.box(mTimber, xR + 0.03, y0 + hWall / 2, pz, 0.06, hWall, 0.22);
        b.box(mWainscotFrame, xR + 0.072, y0 + hWall / 2, pz, 0.020, hWall - 0.08, 0.12);
      }

      // ----------------------------------------------------------------------
      // 2. FLAT DECORATIVE ROOFLINE & MAIN STOREFRONT SIGNAGE ("COZY BITES & SIPS")
      // ----------------------------------------------------------------------
      // Tiered Wooden Cornice Profile & Parapet Cap + Subtle Ink Outline Trim
      b.box(mTimberDark, cxB, yWallTop + 0.04, czB, wB + 0.24, 0.09, dB + 0.24);
      b.box(mTimber, cxB, yWallTop + 0.16, czB, wB + 0.18, 0.16, dB + 0.18);
      b.box(mTimberDark, cxB, yWallTop + 0.28, czB, wB + 0.30, 0.09, dB + 0.30);
      b.box(mInkOutline, cxB, yWallTop + 0.34, czB, wB + 0.34, 0.035, dB + 0.34);
      // Flat Recessed Roof Deck surrounded by low parapet walls
      const yRoofTop = yWallTop + 0.35;
      b.box(mRoofDeck, cxB, yRoofTop + 0.04, czB, wB - 0.28, 0.04, dB - 0.28);
      b.box(mTimber, cxB, yRoofTop + 0.09, zF - 0.06, wB + 0.12, 0.14, 0.14);
      b.box(mTimber, cxB, yRoofTop + 0.09, zB + 0.06, wB + 0.12, 0.14, 0.14);
      b.box(mTimber, xL + 0.06, yRoofTop + 0.09, czB, 0.14, 0.14, dB + 0.12);
      b.box(mTimber, xR - 0.06, yRoofTop + 0.09, czB, 0.14, 0.14, dB + 0.12);

      // Horizontal Upper Timber Frieze Beam below the Main Signboard (y = 2.86)
      b.box(mTimberDark, cxB, 2.86, czB, wB + 0.18, 0.08, dB + 0.18);

      // Main Storefront Signage ("COZY BITES & SIPS") at y = 3.35 (>= 0.25m above awning at 2.78, +0.06m wall clearance)
      const signW = 4.76, signH = 0.72, signY = 3.35;
      b.box(mTimberDark, cxB, signY, zF + 0.04, signW + 0.08, signH + 0.08, 0.04, { r: 0.01 });
      b.panel(mCozySignMat, R.cozyMainSign, cxB, signY, zF + 0.065, signW - 0.06, signH - 0.06);

      // ----------------------------------------------------------------------
      // 3. CHIC STRIPED CANVAS AWNING (#B69574 & #F5EFE6 + Scalloped Trim)
      // ----------------------------------------------------------------------
      const awW = 5.04, awN = 15, awS = awW / awN;
      const frontAwningGroup = new THREE.Group();
      frontAwningGroup.position.set(cxB, 2.78, zF + 0.06);
      const bAwning = new Batch();
      for (let k = 0; k < awN; k++) {
        const sx = -awW / 2 + awS * (k + 0.5);
        const mStripe = k % 2 === 0 ? mAwningTaupe : mAwningCream;
        bAwning.box(mStripe, sx, -0.15, 0.44, awS + 0.004, 0.055, 0.88, { rx: 0.34 });
        bAwning.box(mStripe, sx, -0.36, 0.84, awS * 0.96, 0.16, 0.045);
        bAwning.cyl(mStripe, sx, -0.44, 0.84, awS * 0.48, 0.045, { rx: Math.PI / 2 });
      }
      bAwning.build(frontAwningGroup);
      g.add(frontAwningGroup);
      for (const s of [-1, 1]) {
        b.box(mIron, cxB + s * (awW / 2 - 0.06), 2.34, zF + 0.44, 0.035, 0.035, 0.78, { rx: -0.32 });
      }

      // ----------------------------------------------------------------------
      // 4. WELCOMING ENTRANCE DOOR (Front-Left Bay + Cozy Corner Entry Detail)
      // ----------------------------------------------------------------------
      const doorX = -2.00, doorW = 1.12;
      const fGlassZ2 = zF - 0.05; // Recessed 0.05m inward
      const fzW = zF + 0.04;      // Protruding +0.04m outside wall surface zF
      // Interior glowing backdrop behind door glass at zF - 0.24
      b.box(mVitrineBack, doorX, 1.48, zF - 0.24, doorW - 0.08, 2.28, 0.02);
      // Outer timber door frame & stiles at fzW (zF + 0.04)
      b.box(mTimberDark, doorX, 2.50, fzW, doorW + 0.08, 0.06, 0.028);
      b.box(mTimberDark, doorX - doorW / 2 + 0.03, 1.34, fzW, 0.07, 2.32, 0.028);
      b.box(mTimberDark, doorX + doorW / 2 - 0.03, 1.34, fzW, 0.07, 2.32, 0.028);
      b.box(mTimberDark, doorX, 2.12, fzW, doorW, 0.055, 0.028);
      // Door glass recessed at zF - 0.05
      b.box(mClearGlass, doorX, 1.54, fGlassZ2, doorW - 0.14, 0.88, 0.012);
      b.box(mClearGlass, doorX, 2.32, fGlassZ2, doorW - 0.14, 0.28, 0.012);
      // Lower wooden door leaf kick panel
      b.box(mTimber, doorX, 0.64, fzW - 0.004, doorW - 0.12, 0.92, 0.024);
      b.box(mTimberDark, doorX, 0.64, fzW + 0.016, doorW - 0.24, 0.62, 0.022);
      // Vertical Brass Door Handle
      b.cyl(mBrass, doorX + 0.34, 1.12, fzW + 0.035, 0.020, 0.28);
      // Hanging "OPEN / ENTRY" Plaque on the Door Glass
      b.box(mTimberDeep, doorX, 1.58, fzW + 0.015, 0.42, 0.25, 0.016);
      b.panel(mCozySignMat, R.cozyOpenSign, doorX, 1.58, fzW + 0.028, 0.38, 0.22);
      // Welcoming stone threshold step
      b.box(mStepStone, doorX, 0.20, zF + 0.14, doorW + 0.16, 0.04, 0.28);

      // Cozy Corner Entry Return on the Front-Left Side (x = xL, z = 0.84)
      const ceZ = 0.84, ceD = 0.78;
      b.box(mVitrineBack, xL + 0.24, 1.52, ceZ, 0.02, 1.90, ceD - 0.08);
      b.box(mClearGlass, xL + 0.05, 1.72, ceZ, 0.012, 1.48, ceD - 0.08);
      b.box(mTimberDark, xL - 0.04, 2.48, ceZ, 0.028, 0.06, ceD + 0.06);
      b.box(mTimberDark, xL - 0.04, 2.08, ceZ, 0.028, 0.05, ceD);
      b.box(mTimberDark, xL - 0.04, 1.38, ceZ - ceD / 2, 0.028, 2.24, 0.06);
      b.box(mTimberDark, xL - 0.04, 1.38, ceZ + ceD / 2, 0.028, 2.24, 0.06);
      // Sloped timber canopy overhang at front-left side corner
      b.box(mTimberDark, xL - 0.38, 2.58, ceZ, 0.76, 0.05, ceD + 0.24, { rz: 0.32 });
      b.box(mIron, xL - 0.28, 2.34, ceZ - ceD / 2, 0.56, 0.03, 0.03, { rz: -0.35 });
      b.box(mIron, xL - 0.28, 2.34, ceZ + ceD / 2, 0.56, 0.03, 0.03, { rz: -0.35 });

      // ----------------------------------------------------------------------
      // 5. LARGE GLASS DISPLAY WINDOW, 3D BAKERY RACK, ESPRESSO BAR & TAKEAWAY WINDOW
      // ----------------------------------------------------------------------
      const dispX0 = -1.24, dispX1 = 2.36, dispW = dispX1 - dispX0, dispCX = (dispX0 + dispX1) / 2; // 0.56
      const dispY0 = 1.40, dispY1 = 2.52, dispH = dispY1 - dispY0, dispCY = (dispY0 + dispY1) / 2; // 1.96

      // Warm Glowing Interior Backdrop across the entire display & takeaway bay (at zF - 0.58, 0.53m behind glass!)
      b.box(mVitrineBack, dispCX, dispCY, zF - 0.58, dispW - 0.06, dispH - 0.04, 0.02);
      // Interior wooden counter deck inside recessed vitrine (z = zF - 0.36)
      b.box(mTimber, dispCX, dispY0 + 0.03, zF - 0.36, dispW - 0.04, 0.05, 0.44);

      // 2 Warm Yellow Hanging Pendant Lamps inside the Bakery Display Window (z = zF - 0.34)
      for (const lx of [-0.62, 0.38]) {
        b.cyl(mIron, lx, dispY1 - 0.12, zF - 0.34, 0.012, 0.20);
        b.add(mAmberShade, unitCone, lx, dispY1 - 0.24, zF - 0.34, 0.13, 0.10, 0.13);
        b.sphere(M.bulb, lx, dispY1 - 0.28, zF - 0.34, 0.042);
      }
      addPolePointLight(g, dispCX, 2.22, zF - 0.30, 1.45, 0xffd896, 6.2, 1.5, 0.90);
      S.lights.push([new THREE.Vector3(-0.55, dispCY, zF + 0.45), '#ffcf86', 4.8, 2.8]);
      S.lights.push([new THREE.Vector3(1.15, dispCY, zF + 0.45), '#ffcf86', 4.8, 2.8]);

      // --- 3D BAKERY & PASTRY DISPLAY RACK (at vz = zF - 0.38, 0.33m >= 0.30m behind glass!) ---
      const vz = zF - 0.38;
      // 2-tier wooden pastry shelf case (lower shelf y = 1.46, middle shelf y = 1.66, top counter y = 1.84)
      b.box(mTimberDark, -0.05, 1.66, vz, 2.16, 0.035, 0.12);
      b.box(mTimberDark, -0.05, 1.84, vz, 2.16, 0.04, 0.13);
      for (const sx of [-1.12, -0.38, 0.36, 1.02]) {
        b.box(mTimberDark, sx, 1.64, vz, 0.03, 0.42, 0.11);
      }

      // Bottom Shelf (y = 1.52): Artisan Sourdough Loaves & Brioche Rolls
      for (const lx of [-0.92, -0.62, -0.16, 0.14, 0.56, 0.84]) {
        b.box(mBreadCrust, lx, 1.51, vz + 0.01, 0.22, 0.11, 0.10, { r: 0.04 });
        b.box(mBreadCrumb, lx, 1.565, vz + 0.02, 0.14, 0.02, 0.04, { rz: 0.15 });
      }
      // Middle Shelf (y = 1.72): Golden Butter Croissants & Danish Pastries
      for (const cx0 of [-0.94, -0.70, -0.46, -0.18, 0.08, 0.32, 0.58, 0.82]) {
        b.box(mCroissantGold, cx0, 1.72, vz + 0.01, 0.17, 0.085, 0.09, { ry: 0.18, r: 0.03 });
        b.box(mBreadCrust, cx0, 1.75, vz + 0.02, 0.10, 0.04, 0.06, { r: 0.02 });
      }

      // --- COUNTER BARISTA: 3D WOVEN BAGUETTE BASKET, ESPRESSO MACHINE, COFFEE GRINDER & CHALKBOARD MENU ---
      b.cyl(mTimber, -0.92, 1.95, vz, 0.13, 0.20);
      b.cyl(mTimberDark, -0.92, 2.04, vz, 0.14, 0.03);
      for (const [bx0, rz0] of [[-0.97, 0.16], [-0.92, -0.05], [-0.86, -0.18]]) {
        b.cyl(mCroissantGold, bx0, 2.12, vz, 0.038, 0.26, { rz: rz0 });
      }

      const emX = -0.42;
      b.box(mEspressoSteel, emX, 1.98, vz, 0.44, 0.24, 0.12, { r: 0.02 });
      b.box(mInkOutline, emX, 1.96, vz + 0.055, 0.36, 0.12, 0.02);
      for (const gx of [emX - 0.10, emX + 0.10]) {
        b.cyl(mIron, gx, 1.95, vz + 0.07, 0.035, 0.05);
        b.box(mInkOutline, gx + 0.04, 1.94, vz + 0.09, 0.09, 0.022, 0.022, { ry: -0.35 });
      }
      b.box(mEspressoSteel, emX, 2.11, vz, 0.42, 0.025, 0.11);
      for (const cx0 of [emX - 0.12, emX, emX + 0.12]) {
        b.cyl(mCupWhite, cx0, 2.15, vz, 0.032, 0.055);
      }

      b.box(mIron, 0.04, 1.95, vz, 0.14, 0.18, 0.10, { r: 0.01 });
      b.cyl(mAmberShade, 0.04, 2.10, vz, 0.055, 0.12);
      b.cyl(mInkOutline, 0.04, 2.17, vz, 0.06, 0.02);

      // Interior Wall Chalkboard Menu ("ESPRESSO & BAKERY") pushed >= 0.30m behind glass (zF - 0.52)
      b.box(mTimberDark, 0.62, 2.18, zF - 0.52, 0.86, 0.48, 0.025);
      b.panel(mCozySignMat, R.cozyChalkMenu, 0.62, 2.18, zF - 0.50, 0.80, 0.42);

      // --- RIGHT BAY: TAKEAWAY WINDOW & STACKED COFFEE PAPER CUPS (x = 1.22..+2.36) ---
      const tkCX = 1.79, tkW = 1.12;
      // Projecting wooden takeaway service counter ledge at y = 1.39
      b.box(mTimberDark, tkCX, 1.39, zF + 0.08, tkW + 0.12, 0.06, 0.24, { r: 0.01 });
      // Stacked Takeaway Paper Coffee Cups on the Takeaway Ledge
      for (const [cx0, nStack] of [[1.42, 2], [1.58, 3], [1.74, 1]]) {
        for (let s = 0; s < nStack; s++) {
          const cy0 = 1.47 + s * 0.065;
          b.cyl(mCupWhite, cx0, cy0, zF + 0.08, 0.042, 0.10);
          b.cyl(mTimber, cx0, cy0, zF + 0.08, 0.044, 0.045);
          b.cyl(mCupWhite, cx0, cy0 + 0.055, zF + 0.08, 0.046, 0.02);
        }
      }
      // Small Glass Pastry Display Box inside Takeaway Window (at vz = zF - 0.38)
      b.box(mTimberDark, 2.06, 1.56, vz, 0.42, 0.28, 0.12);
      b.box(mCroissantGold, 1.98, 1.52, vz + 0.02, 0.12, 0.06, 0.08, { r: 0.02 });
      b.box(mCroissantGold, 2.14, 1.52, vz + 0.02, 0.12, 0.06, 0.08, { r: 0.02 });
      b.box(mBreadCrust, 2.06, 1.64, vz + 0.02, 0.18, 0.06, 0.08, { r: 0.02 });
      // Hanging Black Menu Board inside Takeaway Window (pushed >= 0.30m behind glass at zF - 0.48)
      b.box(mInkOutline, tkCX, 2.22, zF - 0.48, 0.88, 0.44, 0.03);
      b.panel(mCozySignMat, R.cozyChalkMenu, tkCX, 2.22, zF - 0.46, 0.82, 0.38);

      // Clear Glass Panes recessed 0.05m inward (fGlassZ2 = zF - 0.05) + Timber Window Frame / Mullions +0.03m in front of glass (fzW = zF - 0.02)
      b.box(mClearGlass, dispCX, dispCY, fGlassZ2, dispW - 0.04, dispH - 0.04, 0.012);
      b.box(mTimberDark, dispCX, dispY1 - 0.01, fzW, dispW + 0.08, 0.06, 0.028);
      b.box(mTimberDark, dispCX, dispY0 + 0.01, fzW, dispW + 0.08, 0.06, 0.028);
      for (const mx of [-1.24, -0.04, 1.16, 2.36]) {
        b.box(mTimberDark, mx, dispCY, fzW, 0.06, dispH, 0.028);
      }
      b.box(mTimberDark, -0.04, 1.84, fzW, 2.34, 0.04, 0.028);

      // ----------------------------------------------------------------------
      // 6. LEFT SIDE PROFILE (x = xL = -2.75): 4-Pane Window, Mini Awning, Sconces & Downspout Pipe
      //    - Backdrop at xL + 0.24 (>= 0.19m behind glass)
      //    - Glass at xL + 0.05 (recessed 0.05m inward)
      //    - Mullions & Kusen at xL - 0.04 (protruding +0.04m outside wall xL)
      // ----------------------------------------------------------------------
      const swZ = -0.48, swWinD = 1.04, swWinH = 0.92, swWinY = 1.90;
      b.box(mTimberDark, xL - 0.05, swWinY - swWinH / 2 - 0.03, swZ, 0.06, 0.06, swWinD + 0.16);
      b.box(mTimberDark, xL - 0.05, swWinY + swWinH / 2 + 0.03, swZ, 0.06, 0.05, swWinD + 0.14);
      b.box(M.glowGlass, xL + 0.24, swWinY, swZ, 0.02, swWinH, swWinD);
      b.box(mClearGlass, xL + 0.05, swWinY, swZ, 0.012, swWinH, swWinD);
      b.box(mTimberDark, xL - 0.04, swWinY, swZ - swWinD / 2, 0.028, swWinH + 0.04, 0.055);
      b.box(mTimberDark, xL - 0.04, swWinY, swZ + swWinD / 2, 0.028, swWinH + 0.04, 0.055);
      b.box(mTimberDark, xL - 0.04, swWinY, swZ, 0.028, swWinH, 0.042);
      b.box(mTimberDark, xL - 0.04, swWinY, swZ, 0.028, 0.042, swWinD);

      // Striped Canvas Mini Awning (#B69574 & #F5EFE6 + Scalloped Trim) over the Left Side 4-Pane Window
      const sideAwD = 1.32, sideAwN = 7, sideAwS = sideAwD / sideAwN;
      const sideAwningGroup = new THREE.Group();
      sideAwningGroup.position.set(xL - 0.05, 2.54, swZ);
      const bSideAw = new Batch();
      for (let k = 0; k < sideAwN; k++) {
        const sz = -sideAwD / 2 + sideAwS * (k + 0.5);
        const mStripe = k % 2 === 0 ? mAwningTaupe : mAwningCream;
        bSideAw.box(mStripe, -0.32, -0.11, sz, 0.64, 0.05, sideAwS + 0.004, { rz: 0.34 });
        bSideAw.box(mStripe, -0.61, -0.26, sz, 0.04, 0.13, sideAwS * 0.96);
        bSideAw.cyl(mStripe, -0.61, -0.33, sz, sideAwS * 0.48, 0.04, { rz: Math.PI / 2 });
      }
      bSideAw.build(sideAwningGroup);
      g.add(sideAwningGroup);

      // Vertical Rainwater Downspout Pipe at Rear-Left Side Corner (x = xL - 0.08, z = -1.94)
      const pipeZ = -1.94;
      b.box(mPipeGrey, xL - 0.10, 3.68, pipeZ, 0.16, 0.18, 0.18);
      b.box(mInkOutline, xL - 0.10, 3.78, pipeZ, 0.18, 0.04, 0.20);
      b.cyl(mPipeGrey, xL - 0.09, 2.02, pipeZ, 0.042, 3.24);
      for (const py0 of [1.05, 2.05, 3.05]) {
        b.box(mIron, xL - 0.06, py0, pipeZ, 0.11, 0.04, 0.11);
      }
      b.box(mPipeGrey, xL - 0.13, 0.34, pipeZ, 0.14, 0.10, 0.09, { rz: 0.38 });

      // Helper: Classic Lantern Wall Sconce (Lampu Lentera Dinding)
      const addCozyWallSconce = (lx, ly, lz, axis = 'Z', dirSign = 1) => {
        const off1 = 0.07 * dirSign;
        const off2 = 0.16 * dirSign;
        if (axis === 'Z') {
          b.box(mIron, lx, ly + 0.08, lz + off1, 0.06, 0.16, 0.12);
          b.box(mIron, lx, ly - 0.04, lz + off2, 0.15, 0.20, 0.15);
          b.box(M.glowGlass, lx, ly - 0.04, lz + off2, 0.11, 0.15, 0.11);
          b.add(mIron, unitCone, lx, ly + 0.09, lz + off2, 0.19, 0.09, 0.19);
          S.lights.push([new THREE.Vector3(lx, ly, lz + 0.34 * dirSign), '#ffbe76', 3.4, 2.0]);
        } else {
          b.box(mIron, lx + off1, ly + 0.08, lz, 0.12, 0.16, 0.06);
          b.box(mIron, lx + off2, ly - 0.04, lz, 0.15, 0.20, 0.15);
          b.box(M.glowGlass, lx + off2, ly - 0.04, lz, 0.11, 0.15, 0.11);
          b.add(mIron, unitCone, lx + off2, ly + 0.09, lz, 0.19, 0.09, 0.19);
          S.lights.push([new THREE.Vector3(lx + 0.34 * dirSign, ly, lz), '#ffbe76', 3.4, 2.0]);
        }
      };
      // Front, Left-Side & Right-Side Pilaster Sconces
      addCozyWallSconce(-1.34, 2.02, zF, 'Z', 1);
      addCozyWallSconce(2.46, 2.02, zF, 'Z', 1);
      addCozyWallSconce(xL, 2.02, -1.34, 'X', -1);
      addCozyWallSconce(xL, 2.02, 0.36, 'X', -1);
      addCozyWallSconce(xL, 1.98, 1.24, 'X', -1);
      addCozyWallSconce(xR, 2.02, -1.34, 'X', 1);
      addCozyWallSconce(xR, 2.02, 0.36, 'X', 1);

      // ======================================================================
      // 7. ARTISTIC MOSAIC & COBBLESTONE SIDEWALK + FULL-BLOCK F&B AMENITIES
      // ======================================================================

      // 7A) Helper: Sweeping S-Curve River-Cobblestone Mosaic Ribbon + 3D Low-Relief Pebbles & Stone Border
      const addCobbleMosaicWave = (parentGrp, bTarget, pts, width = 0.84, ySurf = y0) => {
        const curvePts = pts.map(([px, pz]) => new THREE.Vector3(px, 0, pz));
        const curve = new THREE.CatmullRomCurve3(curvePts, false, 'centripetal', 0.5);
        const segs = Math.max(40, pts.length * 14);
        const positions = [];
        const normals = [];
        const uvs = [];
        const indices = [];
        let arcLen = 0;
        let prevP = curve.getPoint(0);

        for (let i = 0; i <= segs; i++) {
          const u = i / segs;
          const p = curve.getPoint(u);
          if (i > 0) arcLen += p.distanceTo(prevP);
          prevP = p;
          const tan = curve.getTangent(u);
          const nx = -tan.z;
          const nz = tan.x;
          // Smoothly taper only the very tips (first/last 5%)
          const endTaper = Math.min(1, Math.min(u, 1 - u) * 14);
          const hw = width * 0.5 * (0.55 + 0.45 * endTaper);

          const lx = p.x - nx * hw;
          const lz = p.z - nz * hw;
          const rx = p.x + nx * hw;
          const rz = p.z + nz * hw;
          const yRibbon = ySurf + 0.010; // Pebble pad at y = 0.190

          positions.push(lx, yRibbon, lz, rx, yRibbon, rz);
          normals.push(0, 1, 0, 0, 1, 0);
          const uTex = arcLen * 0.62;
          uvs.push(uTex, 0, uTex, 1);

          if (i < segs) {
            const base = i * 2;
            indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
          }

          // Add 3D low-relief river cobblestones & stone border blocks along the wave (top at y = 0.198)
          if (i > 1 && i < segs - 1) {
            const angY = Math.atan2(tan.x, tan.z);
            if (i % 2 === 0) {
              bTarget.box(mCobbleBorder, lx + nx * 0.035, ySurf + 0.014, lz + nz * 0.035, 0.065, 0.008, 0.16, { ry: angY });
              bTarget.box(mCobbleBorder, rx - nx * 0.035, ySurf + 0.014, rz - nz * 0.035, 0.065, 0.008, 0.16, { ry: angY });
            }
            for (const lane of [-0.52, 0, 0.52]) {
              const offN = lane * hw * 0.68 + Math.sin(i * 1.9 + lane * 3) * 0.035;
              const cxP = p.x + nx * offN;
              const czP = p.z + nz * offN;
              const rPeb = 0.068 + ((i * 7 + Math.round((lane + 1) * 3)) % 3) * 0.016;
              const mPeb = (i + Math.round(lane * 2)) % 3 === 0 ? mCobbleBlue1 : (i % 2 === 0 ? mCobbleBlue2 : mCobbleSlate);
              bTarget.cyl(mPeb, cxP, ySurf + 0.014, czP, rPeb, 0.008);
            }
          }
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geo.setIndex(indices);
        const ribbonMesh = new THREE.Mesh(solid(geo), mCobbleWaveRibbon);
        ribbonMesh.receiveShadow = true;
        ribbonMesh.matrixAutoUpdate = false;
        ribbonMesh.updateMatrix();
        parentGrp.add(ribbonMesh);
      };

      // 1) Wide Sweeping S-Curve Mosaic Cobblestone Ribbon on Cozy Bites Sidewalk (g)
      //    Flows clearly and uninterrupted from the Left Sidewalk -> past the Front OPEN Entrance Door & Bakery Window -> to the Front-Right Corner!
      addCobbleMosaicWave(
        g,
        b,
        [
          [-4.28, -0.65],
          [-3.82, 1.12],
          [-2.35, 2.38],
          [-0.45, 3.22],
          [1.28, 2.68],
          [2.95, 3.42],
          [4.48, 2.52]
        ],
        1.18,
        y0
      );

      // 7B) Helper: Large Square Cream Stone Inlaid Tiles with Raised Leaf & Coffee Bean Motifs
      const addInlaidMotifTile = (parentGrp, bTarget, tx, tz, motif = 'bean', ry = 0) => {
        const sTile = 0.50;
        bTarget.box(mInlayTileRim, tx, y0 + 0.005, tz, sTile, 0.010, sTile, { ry, r: 0.02 });
        bTarget.box(mInlayTileBase, tx, y0 + 0.008, tz, sTile - 0.05, 0.012, sTile - 0.05, { ry, r: 0.015 });
        // High-res top relief panel
        const rect = motif === 'bean' ? R.cozyTileBean : R.cozyTileLeaf;
        bTarget.panel(mCozySignMat, rect, tx, y0 + 0.0155, tz, sTile - 0.04, sTile - 0.04, ry, -Math.PI / 2);
        // Sculpted 3D low-relief golden-brown motif on top
        if (motif === 'bean') {
          for (const [dx, dz, rot] of [[-0.06, -0.04, ry - 0.45], [0.06, 0.05, ry + 0.35]]) {
            const bx = tx + dx * Math.cos(ry) - dz * Math.sin(ry);
            const bz = tz + dx * Math.sin(ry) + dz * Math.cos(ry);
            bTarget.box(mInlayReliefBean, bx, y0 + 0.018, bz, 0.13, 0.010, 0.09, { ry: rot, r: 0.03 });
            bTarget.box(mInkOutline, bx, y0 + 0.022, bz, 0.10, 0.006, 0.016, { ry: rot });
          }
        } else {
          // Wheat / botanical leaf sprig 3D relief
          bTarget.box(mInlayReliefBean, tx, y0 + 0.018, tz, 0.026, 0.009, 0.26, { ry: ry + 0.78 });
          for (const [dAlong, dSide, lRot] of [[-0.06, -0.045, 0.35], [-0.04, 0.045, -0.35], [0.03, -0.045, 0.35], [0.05, 0.045, -0.35]]) {
            const ang = ry + 0.78;
            const lx = tx + dSide * Math.cos(ang) + dAlong * Math.sin(ang);
            const lz = tz - dSide * Math.sin(ang) + dAlong * Math.cos(ang);
            bTarget.box(mInlayReliefGold, lx, y0 + 0.019, lz, 0.045, 0.010, 0.095, { ry: ang + lRot, r: 0.015 });
          }
        }
      };

      // Inlaid Leaf & Coffee-Bean Relief Tiles clearly framing the sweeping cobblestone mosaic ribbon from Left -> Front Door -> Right Corner
      addInlaidMotifTile(g, b, -3.35, 1.55, 'leaf', 0.24);
      addInlaidMotifTile(g, b, -1.85, 2.02, 'bean', 0.16);
      addInlaidMotifTile(g, b, -1.15, 3.68, 'leaf', -0.14);
      addInlaidMotifTile(g, b, 0.42, 2.52, 'bean', 0.12);
      addInlaidMotifTile(g, b, 1.65, 3.58, 'leaf', -0.20);
      addInlaidMotifTile(g, b, 3.55, 2.75, 'bean', 0.28);
      addInlaidMotifTile(g, b, 3.85, 3.95, 'leaf', -0.22);

      // 7C) Helper: Integrated Wrap-Around Tree Bench (Pohon Peneduh dengan Bangku Kayu Melingkar 360°)
      const addWrapAroundTreeBench = (bTarget, tx, tz, scale = 1.0) => {
        const rInner = 0.34 * scale;
        const rOuter = 0.72 * scale;
        const ySeat = y0 + 0.42;
        // Circular stone tree-pit collar & dark soil bed
        bTarget.cyl(mStepStone, tx, y0 + 0.025, tz, rOuter + 0.06, 0.05);
        bTarget.cyl(mSoil, tx, y0 + 0.055, tz, rInner - 0.02, 0.03);

        // Lush Shade Tree Trunk & Upper Branches
        bTarget.cyl(mTimberDeep, tx, y0 + 1.38 * scale, tz, 0.18 * scale, 2.76 * scale);
        bTarget.cyl(mTimberDeep, tx - 0.22 * scale, y0 + 2.35 * scale, tz + 0.12 * scale, 0.08 * scale, 0.78 * scale, { rz: 0.48, rx: 0.22 });
        bTarget.cyl(mTimberDeep, tx + 0.24 * scale, y0 + 2.42 * scale, tz - 0.14 * scale, 0.08 * scale, 0.82 * scale, { rz: -0.46, rx: -0.24 });

        // Vertical Wooden Slat Cylinder Tree Guard around Trunk (y = ySeat..ySeat + 0.54)
        const nGuard = 14;
        for (let i = 0; i < nGuard; i++) {
          const ang = (i * Math.PI * 2) / nGuard;
          const gx = tx + Math.cos(ang) * rInner;
          const gz = tz + Math.sin(ang) * rInner;
          bTarget.box(i % 2 === 0 ? mTimber : mTimberDark, gx, ySeat + 0.24, gz, 0.048 * scale, 0.56, 0.028 * scale, { ry: -ang + Math.PI / 2 });
        }
        // Dark wrought-iron binding hoops around the vertical wooden slat guard
        bTarget.cyl(mIron, tx, ySeat + 0.12, tz, rInner + 0.018, 0.032);
        bTarget.cyl(mIron, tx, ySeat + 0.44, tz, rInner + 0.018, 0.032);

        // 360-Degree Wrap-Around Circular Timber Slat Bench
        // Concentric dark-timber under-frame & outer trim collar
        bTarget.cyl(mTimberDeep, tx, ySeat - 0.025, tz, rOuter - 0.02, 0.045);
        bTarget.cyl(mTimberDark, tx, ySeat, tz, rOuter, 0.038);
        // 16 Radial Warm Timber Seat Slats forming the 360° circular bench top
        const nSlats = 16;
        const rMid = (rInner + rOuter) * 0.5;
        const slatLen = rOuter - rInner - 0.03;
        for (let i = 0; i < nSlats; i++) {
          const ang = (i * Math.PI * 2) / nSlats;
          const sx = tx + Math.cos(ang) * rMid;
          const sz = tz + Math.sin(ang) * rMid;
          bTarget.box(
            i % 2 === 0 ? mTimber : mTimberDark,
            sx,
            ySeat + 0.022,
            sz,
            0.14 * scale,
            0.032,
            slatLen,
            { ry: Math.atan2( Math.cos(ang), Math.sin(ang) ), r: 0.008 }
          );
        }
        // 8 Warm Wooden Support Legs & Iron Foot Caps around the 360° bench perimeter
        for (let i = 0; i < 8; i++) {
          const ang = (i * Math.PI * 2) / 8 + Math.PI / 8;
          const lx = tx + Math.cos(ang) * (rOuter - 0.09 * scale);
          const lz = tz + Math.sin(ang) * (rOuter - 0.09 * scale);
          bTarget.box(mTimberDeep, lx, y0 + 0.21, lz, 0.065 * scale, 0.40, 0.065 * scale, { ry: -ang });
          bTarget.box(mIron, lx, y0 + 0.03, lz, 0.075 * scale, 0.05, 0.075 * scale, { ry: -ang });
          // Radial support bracket under seat
          const bx = tx + Math.cos(ang) * rMid;
          const bz = tz + Math.sin(ang) * rMid;
          bTarget.box(mTimberDeep, bx, ySeat - 0.05, bz, 0.055 * scale, 0.06, slatLen * 0.9, {
            ry: Math.atan2(Math.cos(ang), Math.sin(ang))
          });
        }

        // Lush Multi-Cluster Shade Tree Canopy
        const yCanopy = y0 + 2.88 * scale;
        bTarget.crown(mLeafDark, tx, yCanopy, tz, 1.28 * scale, 0.96 * scale, 1.28 * scale, 0.4);
        bTarget.crown(mLeafLight, tx - 0.48 * scale, yCanopy - 0.12 * scale, tz + 0.36 * scale, 0.88 * scale, 0.72 * scale, 0.88 * scale, 1.2);
        bTarget.crown(mLeafLight, tx + 0.52 * scale, yCanopy - 0.08 * scale, tz - 0.32 * scale, 0.86 * scale, 0.70 * scale, 0.86 * scale, 2.1);
        bTarget.crown(mLeafBright, tx + 0.18 * scale, yCanopy + 0.42 * scale, tz + 0.22 * scale, 0.78 * scale, 0.64 * scale, 0.78 * scale, 3.0);
        bTarget.crown(mLeafDark, tx - 0.32 * scale, yCanopy + 0.18 * scale, tz - 0.44 * scale, 0.82 * scale, 0.68 * scale, 0.82 * scale, 4.2);
      };

      // Single Compact Corner Tree at the outer rear-left corner (-4.55, -3.88, scale = 0.72) so the front & side sidewalks are 100% clear!
      addWrapAroundTreeBench(b, -4.55, -3.88, 0.72);

      // 7D) Helper: Artistic Vintage Cast-Iron Street Clock/Lantern Post with 2 Hanging Herb/Flower Baskets & Top Lantern
      //     (`includeClock = true` ONLY on the iconic Front-Right post; the other 3 posts use the exact same pole, crossbar, baskets & lantern without the round clock face!)
      const addVintageStreetClockPost = (parentGrp, bTarget, lx, lz, ry = 0, includeClock = false) => {
        const cg = new THREE.Group();
        cg.position.set(lx, y0, lz);
        cg.rotation.y = ry;
        const bC = new Batch();

        // Stepped Molded Cast-Iron Base & Fluted Column Shaft
        bC.cyl(mIron, 0, 0.08, 0, 0.18, 0.16);
        bC.cyl(mBrass, 0, 0.17, 0, 0.15, 0.03);
        bC.cyl(mIron, 0, 0.34, 0, 0.12, 0.32);
        bC.cyl(mBrass, 0, 0.51, 0, 0.13, 0.035);
        bC.cyl(mIron, 0, 1.48, 0, 0.052, 1.92);
        bC.cyl(mBrass, 0, 1.96, 0, 0.072, 0.04);

        // Horizontal Crossbar Arm at y = 1.98 with Decorative Scroll Brackets
        const armW = 0.98;
        bC.box(mIron, 0, 1.98, 0, armW, 0.042, 0.042);
        bC.cyl(mBrass, -armW / 2, 1.98, 0, 0.035, 0.06, { rz: Math.PI / 2 });
        bC.cyl(mBrass, armW / 2, 1.98, 0, 0.035, 0.06, { rz: Math.PI / 2 });
        // Ornate diagonal scroll braces under crossbar
        bC.box(mIron, -0.20, 1.84, 0, 0.34, 0.026, 0.026, { rz: 0.62 });
        bC.box(mIron, 0.20, 1.84, 0, 0.34, 0.026, 0.026, { rz: -0.62 });

        // 2 Hanging Wicker Herb/Flower Baskets suspended from Left & Right Crossbar Ends
        for (const sx of [-1, 1]) {
          const bx = sx * (armW * 0.44);
          // 3 hanging chain rods
          for (const [cxOff, czOff] of [[-0.06, -0.05], [0.06, -0.05], [0, 0.07]]) {
            bC.cyl(mIron, bx + cxOff * 0.6, 1.84, czOff * 0.6, 0.008, 0.26);
          }
          // Woven wicker hemisphere basket (#A87B4C)
          bC.cyl(mWickerBasket, bx, 1.66, 0, 0.16, 0.14);
          bC.cyl(mTimberDark, bx, 1.72, 0, 0.175, 0.035);
          bC.sphere(mWickerBasket, bx, 1.61, 0, 0.14);
          // Lush green herb foliage & trailing ivy
          bC.crown(mLeafDark, bx, 1.77, 0, 0.20, 0.14, 0.20, sx * 1.1);
          bC.crown(mLeafLight, bx - 0.05 * sx, 1.81, 0.04, 0.15, 0.12, 0.15, sx * 2.3);
          // Pink & lavender-purple blossoms
          for (const [fx, fy, fz, mFl] of [
            [-0.09, 1.82, 0.08, mFlowerPink],
            [0.08, 1.84, 0.06, mFlowerPurple],
            [0.02, 1.86, -0.09, mFlowerPink],
            [-0.07, 1.79, -0.08, mFlowerPurple],
            [0.11, 1.78, -0.04, mFlowerPink]
          ]) {
            bC.sphere(mFl, bx + fx, fy, fz, 0.038);
          }
        }

        if (includeClock) {
          // Double-Sided Round Vintage Street Clock at y = 2.48 (ONLY on the 1 iconic clock post!)
          const yClock = 2.48, rClock = 0.28;
          // Side ornamental scroll brackets cradling the round clock housing
          bC.box(mIron, -rClock - 0.04, yClock - 0.12, 0, 0.08, 0.22, 0.035, { rz: -0.35 });
          bC.box(mIron, rClock + 0.04, yClock - 0.12, 0, 0.08, 0.22, 0.035, { rz: 0.35 });
          // Cylindrical cast-iron & brass drum bezel (axis along Z)
          bC.cyl(mIron, 0, yClock, 0, rClock + 0.025, 0.11, { rx: Math.PI / 2 });
          bC.cyl(mBrass, 0, yClock, 0, rClock + 0.008, 0.125, { rx: Math.PI / 2 });
          // Double-sided clock face panels (Front +Z and Back -Z)
          const dFace = rClock * 1.88;
          bC.panel(mCozySignMat, R.cozyClockFace, 0, yClock, 0.066, dFace, dFace, 0, 0);
          bC.panel(mCozySignMat, R.cozyClockFace, 0, yClock, -0.066, dFace, dFace, Math.PI, 0);
        } else {
          // Continuous fluted upper column shaft & brass collar when without clock face
          bC.cyl(mIron, 0, 2.42, 0, 0.048, 0.86);
          bC.cyl(mBrass, 0, 2.48, 0, 0.066, 0.035);
        }

        // Classic Warm Amber Street Lantern at the Top Finial (y = 2.82..3.32)
        bC.cyl(mIron, 0, 2.82, 0, 0.048, 0.14);
        bC.box(mIron, 0, 2.90, 0, 0.24, 0.04, 0.24);
        bC.box(M.lampBulb, 0, 3.05, 0, 0.18, 0.26, 0.18);
        for (const [dx, dz] of [[-0.09, -0.09], [0.09, -0.09], [-0.09, 0.09], [0.09, 0.09]]) {
          bC.box(mIron, dx, 3.05, dz, 0.024, 0.28, 0.024);
        }
        bC.add(mIron, unitCone, 0, 3.25, 0, 0.28, 0.16, 0.28);
        bC.sphere(mBrass, 0, 3.35, 0, 0.035);

        bC.build(cg);
        parentGrp.add(cg);
        addPolePointLight(parentGrp, lx, y0 + 2.88, lz, 1.0, '#FFD89B', 9, 2.0);
        S.lights.push([new THREE.Vector3(lx, y0 + 3.05, lz), '#FFD89B', 4.4, 2.3]);
      };

      // Exactly 4 Vintage Street Posts at the 4 Outer Curb Corners of Store #2 (Cozy Bites & Sips):
      // ONLY 1 post (Front-Right outer curb corner) has the round clock face (`includeClock = true`); the other 3 use the identical pole without the clock!
      addVintageStreetClockPost(g, b, -4.92, 4.92, Math.PI / 4, false);                  // Front-Left Outer Curb Corner (no clock)
      addVintageStreetClockPost(g, b, 4.92, 4.92, -Math.PI / 4, true);                   // Front-Right Outer Curb Corner (ONLY 1 ICONIC CLOCK POST!)
      addVintageStreetClockPost(villageOuterLot, bLot, -4.92, -4.92, -Math.PI / 4, false); // Back-Left Outer Curb Corner (no clock)
      addVintageStreetClockPost(villageOuterLot, bLot, 4.92, -4.92, Math.PI / 4, false);   // Back-Right Outer Curb Corner (no clock)

      // 7E) Helper: Curved Timber Bar Counter & Round Wooden High Stools (Meja Bar Kayu Melengkung & Kursi Tinggi)
      const addCurvedTimberBar = (bTarget, cx, cz, radius = 0.92, ang0 = -0.65, ang1 = 0.65, nStools = 3) => {
        const segs = 7;
        const yBar = y0 + 0.74;
        const hBar = 0.74;
        for (let i = 0; i < segs; i++) {
          const u0 = i / segs;
          const u1 = (i + 1) / segs;
          const aMid = ang0 + (ang1 - ang0) * ((u0 + u1) * 0.5);
          const arcLen = (Math.abs(ang1 - ang0) * radius) / segs + 0.04;
          const bx = cx + Math.cos(aMid) * radius;
          const bz = cz + Math.sin(aMid) * radius;
          const ry = -aMid + Math.PI / 2;

          // Curved Butcher-Block Timber Countertop (#C69F76) with Dark Wood Edge Trim (#9E7348)
          bTarget.box(mTimber, bx, yBar, bz, arcLen + 0.03, 0.055, 0.36, { ry, r: 0.015 });
          bTarget.box(mTimberDark, bx, yBar - 0.035, bz, arcLen + 0.02, 0.025, 0.34, { ry });
          // Slatted Warm Timber Bar Apron & Dark Iron Footrest Rail
          bTarget.box(i % 2 === 0 ? mTimberDark : mTimberDeep, bx, y0 + hBar * 0.50, bz, arcLen, hBar - 0.12, 0.22, { ry });
          const fx = cx + Math.cos(aMid) * (radius + 0.16);
          const fz = cz + Math.sin(aMid) * (radius + 0.16);
          bTarget.box(mIron, fx, y0 + 0.16, fz, arcLen, 0.022, 0.022, { ry });
        }
        // End Support Posts & Espresso Cups / Croissant Plates on the Curved Bar Counter
        for (const aEnd of [ang0 + 0.08, (ang0 + ang1) * 0.5, ang1 - 0.08]) {
          const px = cx + Math.cos(aEnd) * radius;
          const pz = cz + Math.sin(aEnd) * radius;
          bTarget.cyl(mIron, px, y0 + hBar * 0.48, pz, 0.032, hBar - 0.04);
        }
        const aCup = (ang0 + ang1) * 0.5 - 0.18;
        const cupX = cx + Math.cos(aCup) * radius;
        const cupZ = cz + Math.sin(aCup) * radius;
        bTarget.cyl(mCupWhite, cupX, yBar + 0.035, cupZ, 0.055, 0.014);
        bTarget.cyl(mCupWhite, cupX, yBar + 0.065, cupZ, 0.038, 0.05);
        const aPlate = (ang0 + ang1) * 0.5 + 0.22;
        const plX = cx + Math.cos(aPlate) * radius;
        const plZ = cz + Math.sin(aPlate) * radius;
        bTarget.cyl(mCupWhite, plX, yBar + 0.035, plZ, 0.075, 0.014);
        bTarget.box(mCroissantGold, plX, yBar + 0.058, plZ, 0.085, 0.036, 0.05, { ry: 0.4, r: 0.015 });

        // 3 Round Wooden High Stools arranged along the outer arc of the Curved Timber Bar
        for (let k = 0; k < nStools; k++) {
          const u = (k + 0.5) / nStools;
          const aStool = ang0 + (ang1 - ang0) * u;
          const rStool = radius + 0.34;
          const sx = cx + Math.cos(aStool) * rStool;
          const sz = cz + Math.sin(aStool) * rStool;
          const yStool = y0 + 0.52;
          // Round thick wooden stool seat (#C69F76 & #9E7348)
          bTarget.cyl(mTimber, sx, yStool, sz, 0.145, 0.042);
          bTarget.cyl(mTimberDark, sx, yStool - 0.022, sz, 0.13, 0.02);
          // Circular iron footrest ring at y0 + 0.20
          bTarget.cyl(mIron, sx, y0 + 0.20, sz, 0.11, 0.022);
          // 4 tapered warm wooden high-stool legs
          for (const [lx, lz] of [[-0.08, -0.08], [0.08, -0.08], [-0.08, 0.08], [0.08, 0.08]]) {
            bTarget.cyl(mTimberDeep, sx + lx, y0 + 0.25, sz + lz, 0.018, 0.50, {
              rx: lz * 1.1,
              rz: -lx * 1.1
            });
          }
        }
      };

      // Single Curved Timber Bar + 3 Round High Stools pulled FLUSH against the Left-Side 4-Pane Window wall (cx = -2.18, radius = 0.62)
      addCurvedTimberBar(b, -2.18, -0.48, 0.62, Math.PI - 0.58, Math.PI + 0.58, 3);

      // 7F) Helper: Vintage 3-Wheel Cargo Delivery Bicycle Cart (Gerobak Sepeda Kargo Kayu)
      const addVintageBicycleCart = (parentGrp, cx, cz, ry = 0) => {
        const bg = new THREE.Group();
        bg.position.set(cx, y0, cz);
        bg.rotation.y = ry;
        const bCart = new Batch();

        // Helper for spoked vintage bicycle wheel (axis along Z)
        const addSpokedWheel = (wx, wy, wz, rW) => {
          bCart.cyl(mIron, wx, wy, wz, rW, 0.036, { rx: Math.PI / 2 });
          bCart.cyl(mTimberDark, wx, wy, wz, rW - 0.024, 0.040, { rx: Math.PI / 2 });
          bCart.cyl(mStepStone, wx, wy, wz, rW - 0.048, 0.016, { rx: Math.PI / 2 });
          bCart.cyl(mBrass, wx, wy, wz, 0.036, 0.052, { rx: Math.PI / 2 });
          for (let s = 0; s < 6; s++) {
            const a = (s * Math.PI) / 6;
            bCart.box(mPipeGrey, wx, wy, wz, rW * 1.82, 0.012, 0.014, { rz: a });
          }
          // Curved wheel fender over top
          bCart.box(mIron, wx, wy + rW + 0.018, wz, rW * 1.45, 0.022, 0.055, { r: 0.01 });
        };

        // 2 Front Cargo Wheels (x = +0.26, z = ±0.32) & 1 Rear Bicycle Wheel (x = -0.52, z = 0)
        const rFront = 0.22, rRear = 0.24;
        addSpokedWheel(0.26, rFront, 0.33, rFront);
        addSpokedWheel(0.26, rFront, -0.33, rFront);
        addSpokedWheel(-0.52, rRear, 0, rRear);
        // Front steel axle bar
        bCart.cyl(mIron, 0.26, rFront, 0, 0.022, 0.68, { rx: Math.PI / 2 });

        // Artisanal Slatted Wooden Cargo Box (#C69F76 & #9E7348 with #6E4B2C corner posts)
        const boxX = 0.24, boxY = 0.46, boxW = 0.74, boxH = 0.38, boxD = 0.56;
        bCart.box(mTimber, boxX, boxY, 0, boxW, boxH, boxD, { r: 0.015 });
        bCart.box(mTimberDeep, boxX, boxY + boxH / 2 + 0.015, 0, boxW + 0.05, 0.035, boxD + 0.05);
        bCart.box(mTimberDeep, boxX, boxY - boxH / 2 + 0.02, 0, boxW + 0.03, 0.035, boxD + 0.03);
        // Horizontal plank grooves & corner iron straps on cargo box
        for (const py of [boxY - 0.08, boxY + 0.08]) {
          bCart.box(mTimberDark, boxX, py, 0, boxW + 0.015, 0.02, boxD + 0.015);
        }
        for (const dx of [-boxW / 2, boxW / 2]) {
          for (const dz of [-boxD / 2, boxD / 2]) {
            bCart.box(mIron, boxX + dx, boxY, dz, 0.035, boxH + 0.02, 0.035);
          }
        }

        // Wicker Bread/Croissant Baskets, Brass Coffee Urn & Tabletop Chalkboard Menu on Cargo Countertop
        const yTop = boxY + boxH / 2 + 0.03;
        // Wicker basket 1 with golden baguettes & croissants
        bCart.box(mWickerBasket, boxX + 0.14, yTop + 0.05, 0.12, 0.28, 0.09, 0.22, { r: 0.015 });
        bCart.cyl(mBreadCrust, boxX + 0.12, yTop + 0.13, 0.10, 0.032, 0.24, { rz: 0.45, rx: 0.15 });
        bCart.cyl(mCroissantGold, boxX + 0.18, yTop + 0.12, 0.15, 0.030, 0.22, { rz: 0.32, rx: -0.18 });
        // Wicker basket 2 with pastries
        bCart.box(mWickerBasket, boxX + 0.14, yTop + 0.045, -0.13, 0.24, 0.08, 0.20, { r: 0.015 });
        bCart.sphere(mCroissantGold, boxX + 0.12, yTop + 0.10, -0.11, 0.045);
        bCart.sphere(mBreadCrust, boxX + 0.18, yTop + 0.10, -0.15, 0.042);
        // Vintage brass/copper espresso canister & white takeaway cups
        bCart.cyl(mBrass, boxX - 0.16, yTop + 0.09, -0.14, 0.065, 0.18);
        bCart.cyl(mIron, boxX - 0.16, yTop + 0.19, -0.14, 0.070, 0.025);
        bCart.cyl(mCupWhite, boxX - 0.16, yTop + 0.05, 0.04, 0.032, 0.10);
        // Small Chalkboard Menu Sign ("FRESH BREAD & ARTISAN COFFEE") on Cart Top
        bCart.box(mTimberDeep, boxX - 0.08, yTop + 0.16, 0.21, 0.38, 0.20, 0.028, { r: 0.01 });
        bCart.panel(mCozySignMat, R.cozyCartSign, boxX - 0.08, yTop + 0.16, 0.228, 0.35, 0.16, 0, 0);
        bCart.panel(mCozySignMat, R.cozyCartSign, boxX - 0.08, yTop + 0.16, 0.192, 0.35, 0.16, Math.PI, 0);

        // Cute Striped Mini Canopy over the Cargo Box supported by 4 thin brass rods
        const yCanopy = yTop + 0.56;
        for (const dx of [-0.30, 0.30]) {
          for (const dz of [-0.23, 0.23]) {
            bCart.cyl(mBrass, boxX + dx, yTop + 0.28, dz, 0.012, 0.56);
          }
        }
        for (let k = 0; k < 5; k++) {
          const sx = boxX - 0.30 + k * 0.15;
          bCart.box(k % 2 === 0 ? mAwningTaupe : mAwningCream, sx, yCanopy, 0, 0.155, 0.035, 0.54, { r: 0.01 });
        }

        // Rear Bicycle Frame, Sprung Leather Saddle, Pedals & Swept Handlebars
        bCart.box(mIron, -0.16, 0.32, 0, 0.52, 0.032, 0.032, { rz: -0.24 });
        bCart.box(mIron, -0.34, 0.24, 0, 0.42, 0.028, 0.028, { rz: 0.05 });
        bCart.cyl(mIron, -0.26, 0.46, 0, 0.020, 0.46, { rz: 0.18 });
        // Vintage leather saddle (#6E4B2C)
        bCart.box(mTimberDeep, -0.30, 0.70, 0, 0.18, 0.045, 0.13, { r: 0.018 });
        // Steering column & swept-back brass/wood handlebars behind cargo box
        bCart.cyl(mIron, -0.08, 0.62, 0, 0.020, 0.42, { rz: 0.12 });
        bCart.cyl(mBrass, -0.10, 0.82, 0, 0.016, 0.46, { rx: Math.PI / 2 });
        bCart.cyl(mTimberDeep, -0.12, 0.82, -0.22, 0.022, 0.09, { rx: Math.PI / 2 });
        bCart.cyl(mTimberDeep, -0.12, 0.82, 0.22, 0.022, 0.09, { rx: Math.PI / 2 });

        bCart.build(bg);
        parentGrp.add(bg);
      };

      // Place Vintage Delivery Bicycle Cart pulled FLUSH against the Right Takeaway Window wall (zF = 1.42 -> z = 1.78)
      // so > 80% of the front sidewalk and left/right sidewalks are 100% open!
      addVintageBicycleCart(g, 2.02, zF + 0.36, 0);

      // 7G) Tidy Terracotta Planters tucked FLUSH against the building walls (mid-sidewalk bistro table & A-frame removed!)
      // Helper: Terracotta Potted Dwarf Citrus/Orange Tree (with bright orange fruits!) & Round Herb Pots
      const addTerracottaPotPlant = (bTarget, px, pz, rPot = 0.22, tall = false, withCitrus = false) => {
        bTarget.cyl(mTerracottaPot, px, y0 + rPot * 0.64, pz, rPot, rPot * 1.28);
        bTarget.cyl(mTerracottaRim, px, y0 + rPot * 1.24, pz, rPot * 1.08, 0.045);
        bTarget.cyl(mSoil, px, y0 + rPot * 1.27, pz, rPot * 0.92, 0.02);
        if (tall) {
          const yTop = y0 + rPot * 1.27;
          bTarget.cyl(mTimberDeep, px, yTop + 0.28, pz, 0.036, 0.56);
          bTarget.crown(mLeafDark, px, yTop + 0.68, pz, rPot * 1.38, rPot * 1.44, rPot * 1.38, 1);
          bTarget.crown(mLeafLight, px + 0.07, yTop + 0.82, pz - 0.05, rPot * 0.98, rPot * 0.98, rPot * 0.98, 2);
          if (withCitrus) {
            for (const [ox, oy, oz] of [
              [-0.18, 0.64, 0.16],
              [0.16, 0.72, 0.18],
              [0.04, 0.86, 0.20],
              [-0.14, 0.78, -0.16],
              [0.19, 0.62, -0.12]
            ]) {
              bTarget.sphere(mCitrusOrange, px + ox, yTop + oy, pz + oz, 0.038);
            }
          }
        } else {
          bTarget.crown(mLeafDark, px, y0 + rPot * 1.27 + rPot * 0.92, pz, rPot * 1.18, rPot * 1.15, rPot * 1.18, 3);
          bTarget.crown(mLeafLight, px - 0.05, y0 + rPot * 1.27 + rPot * 1.18, pz + 0.04, rPot * 0.82, rPot * 0.82, rPot * 0.82, 4);
        }
      };

      // Helper: Rectangular Terracotta Herb Trough Planter (Pot Terakota Kotak Tanaman Herba)
      const addRectHerbPlanter = (bTarget, px, pz, wP = 0.68, dP = 0.28, ry = 0) => {
        const hP = 0.26;
        bTarget.box(mTerracottaPot, px, y0 + hP / 2, pz, wP, hP, dP, { ry, r: 0.02 });
        bTarget.box(mTerracottaRim, px, y0 + hP - 0.02, pz, wP + 0.04, 0.045, dP + 0.04, { ry, r: 0.015 });
        bTarget.box(mSoil, px, y0 + hP + 0.005, pz, wP - 0.06, 0.02, dP - 0.06, { ry });
        for (const s of [-0.20, 0, 0.20]) {
          const hx = px + s * Math.cos(ry);
          const hz = pz - s * Math.sin(ry);
          bTarget.crown(s === 0 ? mLeafLight : mLeafDark, hx, y0 + hP + 0.12, hz, 0.14, 0.15, 0.14, s * 5);
          bTarget.crown(mLeafBright, hx + 0.03, y0 + hP + 0.18, hz + 0.02, 0.09, 0.10, 0.09, s * 3 + 1);
        }
      };

      // Tidy Terracotta Herb Planters flush under Display Windows & Dwarf Citrus Tree at Rear-Left Wall Corner
      addRectHerbPlanter(b, -0.68, zF + 0.22, 0.62, 0.24, 0);
      addRectHerbPlanter(b, 0.56, zF + 0.22, 0.62, 0.24, 0);
      addTerracottaPotPlant(b, xL - 0.24, -1.92, 0.20, true, true);

      // Build Full-Block Outer Lot Batch
      bLot.build(villageOuterLot);

      // Clean Queue Path on the front sidewalk
      S.queuePath = [
        [-2.00, 2.15], [1.80, 2.15], [1.80, 2.95], [-2.10, 2.95]
      ];
      b.build(g);

      const occluder = new THREE.Mesh(unitBox, linkProbe);
      occluder.visible = false;
      occluder.position.set(cxB, (H + 0.4) / 2, czB);
      occluder.scale.set(wB + 1.0, H + 0.4, dB + 1.0);
      occluder.userData.store = index;
      villageOuterLot.add(occluder);
      links.push(occluder);

      for (const L of S.lights) {
        g.localToWorld(L[0]);
        addLight(L[0], L[1], L[2], L[3], index);
      }
      S.focus = g.localToWorld(new THREE.Vector3(cxB, 2.25, 0.35));
      S.label = g.localToWorld(new THREE.Vector3(cxB, H + 0.75, czB));
      stores.push(S);
      return;
    }

    if (style === 'shop') {
      // ======================================================================
      // STORE #3: ATELIER & BOUTIQUE (Modern Industrial Fashion Store)
      // 100% Faithful to the 4-Panel Architectural Concept Sheet:
      // 1) Lantai 1: Exposed Concrete (#C8C2B6), Black Steel Cornice (#2B2D2F),
      //    Horizontal ATELIER & BOUTIQUE Signage, Wide Black-Framed Display Window
      //    with Warm Glowing Interior (emissive 0xFFE4B5), 4 Hanging Pendant Lamps,
      //    and 3D Mannequins (Suit Jacket, Midi Dress, Clothing Rack & Trench Coat),
      //    Wood-Glass Entrance Door, 2 Industrial Wall Lanterns, and Low Planter Boxes.
      // 2) Lantai 2: Sleek Industrial Brick Facade (#A85D44), Dark Slate Corner Quoins (#4A4D50),
      //    Wide Industrial Loft Window with Black Steel Grid Mullions, Narrow Balcony
      //    with Modern Black Iron Balustrade & Corner Potted Plants.
      // 3) Rooftop: Striped Wooden Rooftop Deck, Industrial Balustrade, Corner Plants,
      //    and Long Horizontal Rooftop Billboard ("FASHION PHOTOGRAPHY / NEW SEASON
      //    COLLECTION • ATELIER & BOUTIQUE") on a Black Steel Truss Frame with Diagonal
      //    Rear Struts and 4 Curved Top Floodlight Spots.
      // 4) Side Profile Industrial Accents: 2nd-floor grid window, 1st-floor grey steel
      //    service door, vertical downspout & tall exhaust pipe, stacked wooden crates & barrel.
      // ======================================================================
      const villageOuterLot = new THREE.Group();
      villageOuterLot.position.copy(g.position);
      villageOuterLot.rotation.copy(g.rotation);
      world.add(villageOuterLot);
      S.villageOuterLot = villageOuterLot;

      // Helper to normalize world-space UVs on lotGeometry / roundedRectGeometry so the full block maps [0..1] seamlessly
      const mapAtelierBlockUVs = (geo, halfSpan = BLOCK * 0.5) => {
        const pos = geo.attributes.position;
        const uv = geo.attributes.uv;
        for (let i = 0; i < pos.count; i++) {
          uv.setXY(i, (pos.getX(i) + halfSpan) / (halfSpan * 2), (pos.getZ(i) + halfSpan) / (halfSpan * 2));
        }
        return geo;
      };

      // 1) Biophilic Urban Pedestrian Sidewalk Texture: Two-Tone Sweeping Curved Terrazzo (#E2DDD3) & Exposed Aggregate (#B4B2AC)
      const atelierBiophilicPavingTex = (() => {
        const W = 1024, H = 1024;
        const c = document.createElement('canvas');
        c.width = W;
        c.height = H;
        const ctx = c.getContext('2d');

        // Base: Polished Light Cream Concrete / Terrazzo (#E2DDD3)
        ctx.fillStyle = '#E2DDD3';
        ctx.fillRect(0, 0, W, H);
        // Subtle terrazzo mineral flecks across cream concrete base
        const terrazzoChips = ['#EDE8DF', '#CFC9BD', '#B8B1A4', '#F4F0E8', '#C4BEB2'];
        for (let i = 0; i < 2200; i++) {
          ctx.fillStyle = terrazzoChips[i % terrazzoChips.length];
          const px = (Math.sin(i * 12.9898) * 43758.5453 % 1 + 1) % 1 * W;
          const py = (Math.sin(i * 78.233) * 29471.1357 % 1 + 1) % 1 * H;
          ctx.fillRect(px, py, 2 + (i % 3), 2 + ((i + 1) % 3));
        }
        // Subtle architectural concrete slab grid joints (#C5BFB3)
        ctx.strokeStyle = 'rgba(156, 149, 138, 0.42)';
        ctx.lineWidth = 2;
        for (let g0 = 64; g0 < W; g0 += 64) {
          ctx.beginPath();
          ctx.moveTo(g0, 0);
          ctx.lineTo(g0, H);
          ctx.moveTo(0, g0);
          ctx.lineTo(W, g0);
          ctx.stroke();
        }

        // Create an offscreen pattern for Exposed Aggregate Pebble Paving (#B4B2AC)
        const aggCanvas = document.createElement('canvas');
        aggCanvas.width = aggCanvas.height = 256;
        const aggCtx = aggCanvas.getContext('2d');
        aggCtx.fillStyle = '#B4B2AC';
        aggCtx.fillRect(0, 0, 256, 256);
        const aggPebbles = ['#8E8C86', '#C8C6C0', '#76746E', '#9E9C96', '#D4D2CC', '#686660', '#A6A29A'];
        for (let i = 0; i < 2400; i++) {
          aggCtx.fillStyle = aggPebbles[i % aggPebbles.length];
          const ax = (Math.sin(i * 45.123) * 19384.31 % 1 + 1) % 1 * 256;
          const ay = (Math.sin(i * 91.753) * 54321.17 % 1 + 1) % 1 * 256;
          const rP = 1.2 + (i % 3) * 0.75;
          aggCtx.beginPath();
          aggCtx.arc(ax, ay, rP, 0, Math.PI * 2);
          aggCtx.fill();
        }
        const aggPattern = ctx.createPattern(aggCanvas, 'repeat');

        // Helper to draw a sweeping two-tone aggregate band with warm glowing brass/LED border strips
        const drawSweepingAggregateBand = (pts, bandWidthPx) => {
          ctx.save();
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          const buildPath = () => {
            ctx.beginPath();
            ctx.moveTo(pts[0][0], pts[0][1]);
            for (let i = 1; i < pts.length - 1; i++) {
              const xc = (pts[i][0] + pts[i + 1][0]) * 0.5;
              const yc = (pts[i][1] + pts[i + 1][1]) * 0.5;
              ctx.quadraticCurveTo(pts[i][0], pts[i][1], xc, yc);
            }
            const last = pts[pts.length - 1];
            ctx.lineTo(last[0], last[1]);
          };
          // Outer warm LED / brass glow halo
          buildPath();
          ctx.strokeStyle = 'rgba(255, 206, 112, 0.65)';
          ctx.lineWidth = bandWidthPx + 18;
          ctx.stroke();
          // Crisp brass/warm-LED border strip (#E5B85C / #FFE29A)
          buildPath();
          ctx.strokeStyle = '#F2C66D';
          ctx.lineWidth = bandWidthPx + 10;
          ctx.stroke();
          // Dark stone hairline joint inside brass strip
          buildPath();
          ctx.strokeStyle = '#6E685F';
          ctx.lineWidth = bandWidthPx + 3;
          ctx.stroke();
          // Exposed Aggregate Pebble Paving interior (#B4B2AC)
          buildPath();
          ctx.strokeStyle = aggPattern;
          ctx.lineWidth = bandWidthPx;
          ctx.stroke();
          ctx.restore();
        };

        // Sweeping Organic Aggregate Bands across all 4 sides & rounded corners of the full 11x11 block
        drawSweepingAggregateBand(
          [[72, 240], [105, 480], [92, 680], [210, 795], [460, 745], [700, 815], [855, 735], [825, 485], [895, 220]],
          92
        );
        drawSweepingAggregateBand(
          [[68, 560], [58, 820], [185, 925], [485, 885], [790, 932], [935, 815], [915, 510], [945, 210], [815, 88], [512, 128], [210, 85], [78, 215]],
          84
        );
        drawSweepingAggregateBand(
          [[145, 175], [385, 215], [640, 165], [835, 215]],
          76
        );

        const tx = new THREE.CanvasTexture(c);
        tx.anisotropy = 8;
        tx.colorSpace = THREE.SRGBColorSpace;
        return tx;
      })();

      // 2) Exposed Aggregate & Brass/LED Ribbon Texture for 3D Sweeping Pavement Overlays
      const atelierAggregateRibbonTex = (() => {
        const W = 512, H = 256;
        const c = document.createElement('canvas');
        c.width = W;
        c.height = H;
        const ctx = c.getContext('2d');
        // Exposed aggregate pebble base (#B4B2AC)
        ctx.fillStyle = '#B4B2AC';
        ctx.fillRect(0, 0, W, H);
        const cols = ['#8E8C86', '#C8C6C0', '#76746E', '#9E9C96', '#D4D2CC', '#6B6963', '#A8A49C'];
        for (let i = 0; i < 3600; i++) {
          ctx.fillStyle = cols[i % cols.length];
          const px = (Math.sin(i * 31.7) * 43758.5 % 1 + 1) % 1 * W;
          const py = (Math.sin(i * 67.3) * 19283.7 % 1 + 1) % 1 * H;
          ctx.beginPath();
          ctx.arc(px, py, 1.5 + (i % 3) * 0.9, 0, Math.PI * 2);
          ctx.fill();
        }
        // Transverse architectural expansion joints across the aggregate band
        ctx.strokeStyle = 'rgba(92, 88, 82, 0.45)';
        ctx.lineWidth = 2.5;
        for (let x = 64; x < W; x += 64) {
          ctx.beginPath();
          ctx.moveTo(x, 18);
          ctx.lineTo(x, H - 18);
          ctx.stroke();
        }
        // Top & bottom Recessed Warm LED / Brass Ribbon Strips (v in [0..20] and [H-20..H])
        const gradTop = ctx.createLinearGradient(0, 0, 0, 22);
        gradTop.addColorStop(0, '#D4A24C');
        gradTop.addColorStop(0.5, '#FFF0B8');
        gradTop.addColorStop(1, '#7A6848');
        ctx.fillStyle = gradTop;
        ctx.fillRect(0, 0, W, 20);
        const gradBot = ctx.createLinearGradient(0, H - 22, 0, H);
        gradBot.addColorStop(0, '#7A6848');
        gradBot.addColorStop(0.5, '#FFF0B8');
        gradBot.addColorStop(1, '#D4A24C');
        ctx.fillStyle = gradBot;
        ctx.fillRect(0, H - 20, W, 20);

        const tx = new THREE.CanvasTexture(c);
        tx.wrapS = THREE.RepeatWrapping;
        tx.wrapT = THREE.ClampToEdgeWrapping;
        tx.anisotropy = 8;
        tx.colorSpace = THREE.SRGBColorSpace;
        return tx;
      })();

      // Procedural Textures for Exposed Concrete (#C8C2B6), Industrial Brick (#A85D44) & Wooden Rooftop/Lounge Deck
      const atelierConcreteTex = (() => {
        const c = document.createElement('canvas');
        c.width = c.height = 256;
        const x = c.getContext('2d');
        x.fillStyle = '#C8C2B6';
        x.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 180; i++) {
          const v = (random() - 0.5) * 18;
          x.fillStyle = `rgba(${190 + v}, ${184 + v}, ${172 + v}, 0.28)`;
          x.fillRect(random() * 256, random() * 256, 6 + random() * 22, 4 + random() * 14);
        }
        x.strokeStyle = 'rgba(92, 88, 82, 0.28)';
        x.lineWidth = 2;
        for (let p = 64; p < 256; p += 64) {
          x.beginPath();
          x.moveTo(p, 0);
          x.lineTo(p, 256);
          x.stroke();
        }
        const tx = new THREE.CanvasTexture(c);
        tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
        tx.colorSpace = THREE.SRGBColorSpace;
        return tx;
      })();

      const atelierBrickTex = (() => {
        const c = document.createElement('canvas');
        c.width = c.height = 256;
        const x = c.getContext('2d');
        x.fillStyle = '#6E3B2B';
        x.fillRect(0, 0, 256, 256);
        const rows = 16, cols = 8, bw = 256 / cols, bh = 256 / rows;
        for (let r = 0; r < rows; r++) {
          const ox = (r % 2) * (bw * 0.5);
          for (let col = -1; col <= cols; col++) {
            const v = (random() - 0.5) * 24;
            x.fillStyle = `rgb(${Math.round(168 + v)}, ${Math.round(93 + v * 0.6)}, ${Math.round(68 + v * 0.5)})`;
            x.fillRect(col * bw + ox + 1.5, r * bh + 1.5, bw - 3, bh - 3);
          }
        }
        const tx = new THREE.CanvasTexture(c);
        tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
        tx.colorSpace = THREE.SRGBColorSpace;
        return tx;
      })();

      const atelierDeckTex = (() => {
        const c = document.createElement('canvas');
        c.width = c.height = 256;
        const x = c.getContext('2d');
        x.fillStyle = '#B8895A';
        x.fillRect(0, 0, 256, 256);
        for (let r = 0; r < 16; r++) {
          const v = (random() - 0.5) * 16;
          x.fillStyle = `rgb(${Math.round(186 + v)}, ${Math.round(138 + v)}, ${Math.round(92 + v)})`;
          x.fillRect(0, r * 16 + 1, 256, 14);
          x.fillStyle = 'rgba(72, 48, 28, 0.55)';
          x.fillRect(0, r * 16, 256, 1.5);
        }
        const tx = new THREE.CanvasTexture(c);
        tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
        tx.colorSpace = THREE.SRGBColorSpace;
        return tx;
      })();

      const mConcrete = mat('#C8C2B6', { map: atelierConcreteTex, roughness: 0.86 }, t);
      const mConcreteTrim = mat(
        '#B5AEA2',
        { roughness: 0.84, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 },
        t
      );
      const mTerrazzoPaving = mat('#FFFFFF', { map: atelierBiophilicPavingTex, roughness: 0.65 }, t);
      const mAggregateRibbon = mat(
        '#FFFFFF',
        {
          map: atelierAggregateRibbonTex,
          roughness: 0.65,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1
        },
        t
      );
      const mLedBrassStrip = mat(
        '#FFF0C2',
        {
          emissive: '#FFD89B',
          emissiveIntensity: 1.1,
          roughness: 0.28,
          metalness: 0.45,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1
        },
        t
      );
      bulbMaterials.push(mLedBrassStrip);
      const mBenchConcrete = mat('#DFDDD7', { roughness: 0.78 }, t);
      const mBenchConcreteDark = mat('#C8C5BE', { roughness: 0.82 }, t);
      const mBenchUnderGlow = mat(
        '#FFF5D6',
        {
          emissive: '#FFD98A',
          emissiveIntensity: 1.45,
          roughness: 0.25
        },
        t
      );
      const mFlutedConcrete = mat(
        '#CFCBC3',
        { roughness: 0.82, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 },
        t
      );
      const mFlutedRib = mat(
        '#B8B4AC',
        { roughness: 0.84, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 },
        t
      );
      const mMonolithStone = mat('#E0DAD0', { roughness: 0.76 }, t);
      const mCanopyFabric = mat('#F2ECE1', { roughness: 0.74 }, t);
      const mBikeRackMetal = mat('#8A9096', { roughness: 0.32, metalness: 0.68 }, t);
      const mLampIron = mat('#232527', { roughness: 0.45, metalness: 0.42 }, t);
      const mMapleRed = mat('#B83B48', { roughness: 0.74, flatShading: true }, t);
      const mMapleRose = mat('#D65A68', { roughness: 0.74, flatShading: true }, t);
      const mMaplePink = mat('#E47A86', { roughness: 0.74, flatShading: true }, t);
      const mBambooCulm = mat('#7FA858', { roughness: 0.62 }, t);
      const mBambooLeaf = mat('#5E8E4B', { roughness: 0.72, flatShading: true }, t);
      const mLavenderPurple = mat('#8B5EC4', { roughness: 0.68 }, t);
      const mLavenderLight = mat('#A87EE0', { roughness: 0.68 }, t);
      const mSoilDark = mat(
        '#4E3B2C',
        { roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 },
        t
      );

      const mSteelBlack = mat(
        '#2B2D2F',
        { roughness: 0.46, metalness: 0.38, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 },
        t
      );
      const mSlateQuoin = mat(
        '#4A4D50',
        { roughness: 0.78, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 },
        t
      );
      mSlateQuoin.userData.noCast = true;
      mSlateQuoin.userData.noReceive = true;
      const mIndBrick = mat('#A85D44', { map: atelierBrickTex, roughness: 0.86 }, t);
      const mRoofDeck = mat(
        '#B8895A',
        { map: atelierDeckTex, roughness: 0.82, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 },
        t
      );
      const mOakDoor = mat(
        '#9A6B45',
        { roughness: 0.76, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 },
        t
      );
      const mCrateWood = mat(
        '#B68552',
        { roughness: 0.84, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 },
        t
      );
      const mCrateDark = mat(
        '#7C5432',
        { roughness: 0.86, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 },
        t
      );
      const mPipeGrey = mat('#7C8082', { roughness: 0.52, metalness: 0.35 }, t);
      const mBrass = mat('#E2B24A', { roughness: 0.28, metalness: 0.68 }, t);
      const mDisplayBack = mat(
        '#FFF1D4',
        {
          emissive: '#FFBC62',
          emissiveIntensity: 1.05,
          roughness: 0.48
        },
        t
      );
      mDisplayBack.userData.noCast = true;
      mDisplayBack.userData.noReceive = true;
      registerWindowGlow(mDisplayBack, 1.05);
      const mBillboardSign = mat(
        '#FFFDF8',
        {
          map: atlas.tex,
          emissive: '#FFE8C2',
          emissiveMap: atlas.tex,
          emissiveIntensity: 0.58,
          roughness: 0.46,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2
        },
        t
      );
      mBillboardSign.userData.noCast = true;
      mBillboardSign.userData.noReceive = true;

      // Garment & Mannequin Materials inside the 3D Storefront Display Window
      const mMannequinForm = mat('#EAE0CE', { roughness: 0.70 }, t);
      const mSuitCharcoal = mat('#46494C', { roughness: 0.65 }, t);
      const mDressOlive = mat('#857A68', { roughness: 0.65 }, t);
      const mCoatCamel = mat('#C4A378', { roughness: 0.65 }, t);
      const mCoatRust = mat('#A85D44', { roughness: 0.65 }, t);
      const mLeafDark = mat('#4E7A46', { roughness: 0.74, flatShading: true }, t);
      const mLeafLight = mat('#76A465', { roughness: 0.74, flatShading: true }, t);

      // Building footprint coordinates
      const xL = -3.35, xR = 2.65, zB = -2.65, zF = 1.65;
      const wB = xR - xL; // 6.00
      const dB = zF - zB; // 4.30
      const cxB = (xL + xR) / 2; // -0.35
      const czB = (zB + zF) / 2; // -0.50
      const y0 = 0.18, y1 = 3.16, y2 = 5.62;
      const h1 = y1 - y0; // 2.98
      const h2 = y2 - y1; // 2.46

      // Full-Block Unified Sidewalk Base in villageOuterLot:
      // - Outer Concrete Curb Rim at y = 0.190 (hollow ring, zero overlap with inner tiles)
      // - Inner Terrazzo Sidewalk Base Tile at y = 0.180
      // - Yellow Tactile Paving Strip along straight curb edges at y = 0.195
      const bLot = new Batch();
      bLot.add(mConcreteTrim, hollowCurbRingGeo(BLOCK, BLOCK, 1.2, 0.14, 0.190), 0, 0, 0);
      bLot.add(mConcreteTrim, roundedRectGeometry(BLOCK - 0.28, BLOCK - 0.28, 1.06, 0.155), 0, 0, 0);
      bLot.add(mTerrazzoPaving, mapAtelierBlockUVs(lotGeometry(BLOCK - 0.28, 1.06, 0.025)), 0, 0.155, 0);
      const tactOff = BLOCK * 0.5 - 0.23;
      const tactSpan = BLOCK - 2.40;
      for (const s of [-1, 1]) {
        bLot.box(M.tactileYellow, 0, 0.1875, s * tactOff, tactSpan, 0.015, 0.16);
        bLot.box(M.tactileYellow, s * tactOff, 0.1875, 0, 0.16, 0.015, tactSpan);
      }

      // Isolated Catalog Stage Base inside g (hidden in Town View so the full 11x11 block is 100% seamless!)
      const stgX0 = -4.95, stgX1 = 4.25, stgZ0 = -3.35, stgZ1 = 3.65;
      const stgW = stgX1 - stgX0, stgD = stgZ1 - stgZ0, stgCX = (stgX0 + stgX1) / 2, stgCZ = (stgZ0 + stgZ1) / 2;
      const stageBaseGroup = new THREE.Group();
      stageBaseGroup.visible = false;
      const bStageBase = new Batch();
      bStageBase.add(mConcreteTrim, hollowCurbRingGeo(stgW + 0.22, stgD + 0.22, 0.95, 0.11, 0.190), stgCX, 0, stgCZ);
      bStageBase.add(mConcreteTrim, roundedRectGeometry(stgW, stgD, 0.85, 0.155), stgCX, 0, stgCZ);
      bStageBase.add(mTerrazzoPaving, mapAtelierBlockUVs(roundedRectGeometry(stgW, stgD, 0.85, 0.025)), stgCX, 0.155, stgCZ);
      bStageBase.build(stageBaseGroup);
      g.add(stageBaseGroup);
      S.stageBaseGroup = stageBaseGroup;

      // Tightly fitted concrete plinth under the outer perimeter walls (inset >= 0.40m behind outer walls so zero rear/side overlap)
      b.box(mConcreteTrim, cxB, y0 + 0.08, czB, wB - 0.80, 0.16, dB - 0.80);

      // ----------------------------------------------------------------------
      // 1. LANTAI 1 — ATELIER & BOUTIQUE STOREFRONT (Concrete #C8C2B6 + Recessed Vitrine)
      //    - Outer Wall Surface at zF = 1.65 (front) and xR = 2.65 (right)
      //    - Interior core box inset >= 0.38m from rear wall zB and left wall xL (zero coplanar back wall overlap!)
      //    - Rear wall layer pushed outward by +0.04m (zB - 0.04) with non-overlapping side walls
      //    - Window Glass recessed 0.05m inward (zF - 0.05 = 1.60, xR - 0.05 = 2.60)
      //    - Black Steel Frames/Mullions protruding +0.03m in front of glass (zF - 0.02 = 1.63, xR - 0.02 = 2.63)
      //    - Interior Mannequins & Rack pushed >= 0.33m behind glass (vz = zF - 0.38 = 1.27, vx = xR - 0.38 = 2.27)
      // ----------------------------------------------------------------------
      const winCX = -1.12, winW = 3.44, winY0 = 0.56, winY1 = 2.36, winH = winY1 - winY0, winCY = (winY0 + winY1) / 2;
      const doorX = 1.48, doorW = 1.38;
      // Recessed solid interior concrete core inset >= 0.38m from rear wall zB & left wall xL, and shrunk vertically by 0.08m
      const coreX0 = xL + 0.38;
      const coreX1 = xR - 0.72;
      const coreZ0 = zB + 0.38;
      const coreZ1 = zF - 0.72;
      b.box(mConcrete, (coreX0 + coreX1) / 2, y0 + h1 / 2, (coreZ0 + coreZ1) / 2, coreX1 - coreX0, h1 - 0.08, coreZ1 - coreZ0);
      // Full-height Rear (-Z) outer wall pushed +0.04m outward (rear face at zB - 0.04, inner face at zB + 0.24)
      b.box(mConcrete, cxB, y0 + h1 / 2, zB + 0.10, wB, h1, 0.28);
      // Left (-X) solid concrete outer wall stopping cleanly in front of the rear wall (z = zB + 0.24..zF - 0.24) so zero corner overlap!
      b.box(mConcrete, xL + 0.14, y0 + h1 / 2, czB, 0.28, h1, dB - 0.48);
      // Front (+Z) concrete pilasters, lower sill wall & upper header wall flush at zF = 1.65
      const fWallD = 0.24, fWallCZ = zF - fWallD / 2;
      b.box(mConcrete, (xL + (winCX - winW / 2)) / 2, (winY0 + winY1) / 2, fWallCZ, (winCX - winW / 2) - xL, winH, fWallD);
      b.box(mConcrete, ((winCX + winW / 2) + (doorX - doorW / 2)) / 2, (y0 + winY1) / 2, fWallCZ, (doorX - doorW / 2) - (winCX + winW / 2), winY1 - y0, fWallD);
      b.box(mConcrete, ((doorX + doorW / 2) + xR) / 2, (y0 + winY1) / 2, fWallCZ, xR - (doorX + doorW / 2), winY1 - y0, fWallD);
      b.box(mConcrete, (xL + (doorX - doorW / 2)) / 2, (y0 + winY0) / 2, fWallCZ, (doorX - doorW / 2) - xL, winY0 - y0, fWallD);
      b.box(mConcrete, cxB, (winY1 + y1) / 2, fWallCZ, wB, y1 - winY1, fWallD);
      // Right (+X) concrete pilasters, lower sill wall & upper header wall flush at xR = 2.65 (non-overlapping in Z and Y!)
      const rWallW = 0.24, rWallCX = xR - rWallW / 2;
      const rBackZ0 = zB + 0.24;
      b.box(mConcrete, rWallCX, (y0 + winY1) / 2, (rBackZ0 + (-1.52)) / 2, rWallW, winY1 - y0, -1.52 - rBackZ0);
      b.box(mConcrete, rWallCX, (y0 + winY1) / 2, (0.82 + (zF - fWallD)) / 2, rWallW, winY1 - y0, (zF - fWallD) - 0.82);
      b.box(mConcrete, rWallCX, (y0 + winY0) / 2, -0.35, rWallW, winY0 - y0, 2.34);
      b.box(mConcrete, rWallCX, (winY1 + y1) / 2, czB, rWallW, y1 - winY1, dB - 0.48);

      // Dark steel belt cornice separating Lantai 1 and Lantai 2
      b.box(mSteelBlack, cxB, y1 - 0.04, czB, wB + 0.22, 0.12, dB + 0.22);
      b.box(mConcreteTrim, cxB, y1 + 0.05, czB, wB + 0.18, 0.08, dB + 0.18);

      // Horizontal Framed Storefront Signage above the window ("ATELIER") & door ("BOUTIQUE") with +0.06m wall clearance
      const signY = 2.68;
      // Front Left Sign: ATELIER (x = -1.12, w = 3.44, h = 0.44)
      b.box(mSteelBlack, -1.12, signY, zF + 0.04, 3.52, 0.48, 0.04, { r: 0.01 });
      b.panel(mBillboardSign, R.atelierSign, -1.12, signY, zF + 0.065, 3.42, 0.42);
      // Front Right Sign: BOUTIQUE (x = 1.48, w = 1.48, h = 0.44)
      b.box(mSteelBlack, 1.48, signY, zF + 0.04, 1.54, 0.48, 0.04, { r: 0.01 });
      b.panel(mBillboardSign, R.boutiqueSign, 1.48, signY, zF + 0.065, 1.44, 0.42);

      // Warm glowing interior vitrine backdrop at zF - 0.58 (0.53m behind glass, softened to match Glow Studio warmth!)
      b.box(mDisplayBack, winCX, winCY, zF - 0.58, winW - 0.06, winH - 0.04, 0.02);
      // Warm wooden display stage floor & ceiling inside the recessed vitrine cavity
      b.box(mOakDoor, winCX, winY0 + 0.03, zF - 0.34, winW - 0.04, 0.06, 0.48);
      b.box(mOakDoor, winCX, winY1 - 0.03, zF - 0.34, winW - 0.04, 0.05, 0.48);
      for (const px of [winCX - 0.84, winCX + 0.02, winCX + 0.86]) {
        b.box(mCrateWood, px, winCY, zF - 0.55, 0.03, winH - 0.12, 0.02);
      }

      // Row of 4 Small Hanging Pendant Lamps inside the top of the Display Window (recessed at zF - 0.34)
      for (let p = 0; p < 4; p++) {
        const lx = winCX - 1.24 + p * 0.83;
        b.cyl(mSteelBlack, lx, winY1 - 0.14, zF - 0.34, 0.012, 0.22);
        b.add(mSteelBlack, unitCone, lx, winY1 - 0.25, zF - 0.34, 0.09, 0.08, 0.09);
        b.sphere(M.bulb, lx, winY1 - 0.29, zF - 0.34, 0.038);
      }
      // Softened 1st-floor vitrine lights matching Glow Studio's warm, cozy glow
      addPolePointLight(g, winCX, 2.22, zF - 0.32, 1.45, 0xffd89a, 6.2, 1.5, 0.90);
      S.lights.push([new THREE.Vector3(winCX - 0.6, winCY, zF + 0.45), '#ffd8a8', 4.2, 2.35]);
      S.lights.push([new THREE.Vector3(winCX + 0.6, winCY, zF + 0.45), '#ffd8a8', 4.2, 2.35]);

      // 3D Mannequins & Clothing Rack inside the Display Window (at vz = zF - 0.38, 0.33m >= 0.30m behind glass!)
      const vz = zF - 0.38;
      // Mannequin #1 (Left, x = -2.36): Tailored Charcoal Suit Jacket / Jas
      const m1x = -2.36;
      b.cyl(mCrateDark, m1x, winY0 + 0.08, vz, 0.14, 0.04);
      b.cyl(mBrass, m1x, winY0 + 0.42, vz, 0.02, 0.68);
      b.cyl(mSuitCharcoal, m1x, winY0 + 0.88, vz, 0.17, 0.48);
      b.box(mSuitCharcoal, m1x - 0.19, winY0 + 0.86, vz, 0.07, 0.44, 0.09, { rz: 0.12 });
      b.box(mSuitCharcoal, m1x + 0.19, winY0 + 0.86, vz, 0.07, 0.44, 0.09, { rz: -0.12 });
      b.cyl(mMannequinForm, m1x, winY0 + 1.16, vz, 0.055, 0.10);

      // Mannequin #2 (Center-Left, x = -1.56): Belted Olive-Taupe Midi Dress / Gaun
      const m2x = -1.56;
      b.cyl(mCrateDark, m2x, winY0 + 0.08, vz, 0.14, 0.04);
      b.cyl(mBrass, m2x, winY0 + 0.36, vz, 0.02, 0.56);
      b.add(mDressOlive, unitCone, m2x, winY0 + 0.66, vz, 0.24, 0.52, 0.16);
      b.cyl(mDressOlive, m2x, winY0 + 0.98, vz, 0.14, 0.28);
      b.box(mSteelBlack, m2x, winY0 + 0.84, vz + 0.02, 0.24, 0.04, 0.14);
      b.cyl(mMannequinForm, m2x, winY0 + 1.16, vz, 0.05, 0.10);

      // Clothing Rack (Center-Right, x = -0.74): Garment Rail with Hanging Trousers & Skirts
      const rkx = -0.74;
      b.cyl(mSteelBlack, rkx - 0.28, winY0 + 0.52, vz, 0.018, 0.96);
      b.cyl(mSteelBlack, rkx + 0.28, winY0 + 0.52, vz, 0.018, 0.96);
      b.box(mSteelBlack, rkx, winY0 + 0.98, vz, 0.60, 0.03, 0.03);
      for (const [hx, hMat] of [[rkx - 0.15, mSuitCharcoal], [rkx, mCoatCamel], [rkx + 0.15, mCoatRust]]) {
        b.box(hMat, hx, winY0 + 0.66, vz, 0.11, 0.52, 0.07);
      }

      // Mannequin #3 (Right, x = 0.06): Long Camel Trench Coat / Mantel
      const m3x = 0.06;
      b.cyl(mCrateDark, m3x, winY0 + 0.08, vz, 0.14, 0.04);
      b.cyl(mBrass, m3x, winY0 + 0.32, vz, 0.02, 0.48);
      b.add(mCoatCamel, unitCone, m3x, winY0 + 0.64, vz, 0.25, 0.62, 0.17);
      b.cyl(mCoatCamel, m3x, winY0 + 0.98, vz, 0.16, 0.34);
      b.box(mCoatCamel, m3x - 0.19, winY0 + 0.88, vz, 0.07, 0.48, 0.09, { rz: 0.10 });
      b.box(mCoatCamel, m3x + 0.19, winY0 + 0.88, vz, 0.07, 0.48, 0.09, { rz: -0.10 });
      b.box(mCrateDark, m3x, winY0 + 0.82, vz + 0.02, 0.28, 0.045, 0.15);
      b.cyl(mMannequinForm, m3x, winY0 + 1.18, vz, 0.055, 0.10);

      // Storefront Window Glass recessed 0.05m inward (zF - 0.05) + Black Steel Mullions +0.03m in front of glass (zF - 0.02)
      const fGlassZ = zF - 0.05;
      const fzW = zF - 0.02;
      b.box(M.clearWinGlass, winCX, winCY, fGlassZ, winW - 0.04, winH - 0.04, 0.012);
      b.box(mSteelBlack, winCX, winY1 - 0.01, fzW, winW + 0.06, 0.06, 0.028);
      b.box(mSteelBlack, winCX, winY0 + 0.01, fzW, winW + 0.06, 0.06, 0.028);
      b.box(mSteelBlack, winCX, winY1 - 0.36, fzW, winW, 0.042, 0.028); // Upper transom bar
      for (const mx of [winCX - winW / 2 + 0.02, winCX - 0.56, winCX + 0.56, winCX + winW / 2 - 0.02]) {
        b.box(mSteelBlack, mx, winCY, fzW, 0.055, winH, 0.028);
      }

      // Entrance Door (Pintu Masuk Kayu-Kaca Berbingkai Hitam + Gagang Kuningan/Hitam) on the right of the Display Window (x = 1.48)
      // Interior glowing backdrop behind door glass at zF - 0.22 (0.17m behind door glass at zF - 0.05)
      b.box(mDisplayBack, doorX, 1.32, zF - 0.22, doorW - 0.06, 2.12, 0.02);
      // Door glass recessed 0.05m inward (zF - 0.05)
      b.box(M.clearWinGlass, doorX - 0.30, 1.48, fGlassZ, 0.44, 0.84, 0.012);
      b.box(M.clearWinGlass, doorX + 0.30, 1.48, fGlassZ, 0.44, 0.84, 0.012);
      b.box(M.clearWinGlass, doorX, 2.18, fGlassZ, doorW - 0.18, 0.26, 0.012);
      // Crisp oak & black steel door frames/mullions at +0.03m in front of glass (fzW = zF - 0.02)
      b.box(mSteelBlack, doorX, 2.34, fzW, doorW + 0.06, 0.06, 0.028);
      b.box(mSteelBlack, doorX - doorW / 2 + 0.02, 1.28, fzW, 0.06, 2.18, 0.028);
      b.box(mSteelBlack, doorX + doorW / 2 - 0.02, 1.28, fzW, 0.06, 2.18, 0.028);
      b.box(mSteelBlack, doorX, 2.01, fzW, doorW, 0.055, 0.028);
      b.box(mSteelBlack, doorX, 2.18, fzW, 0.05, 0.28, 0.028);
      b.box(mOakDoor, doorX, 1.12, fzW - 0.004, 0.095, 1.84, 0.024);
      b.box(mSteelBlack, doorX, 1.12, fzW + 0.004, 0.046, 1.84, 0.024);
      for (const sx of [-1, 1]) {
        b.box(mOakDoor, doorX + sx * 0.58, 1.12, fzW - 0.004, 0.09, 1.84, 0.024);
        b.box(mSteelBlack, doorX + sx * 0.30, 1.48, fzW, 0.46, 0.04, 0.026);
        b.box(mOakDoor, doorX + sx * 0.30, 1.00, fzW, 0.48, 0.075, 0.026);
        b.box(mCrateDark, doorX + sx * 0.30, 0.58, fzW - 0.006, 0.44, 0.52, 0.022);
        b.box(mSteelBlack, doorX + sx * 0.30, 0.58, fzW, 0.46, 0.54, 0.024);
        const hx = doorX + sx * 0.11;
        b.box(mBrass, hx, 1.08, zF + 0.015, 0.042, 0.42, 0.022);
        b.cyl(mBrass, hx, 1.08, zF + 0.045, 0.018, 0.36);
      }
      // Stone entrance threshold step
      b.box(mConcreteTrim, doorX, 0.22, zF + 0.14, doorW + 0.16, 0.08, 0.28);

      // Right Side Storefront Display Window, Framed Boutique Glass Door & Secondary BOUTIQUE Sign (+0.06m wall clearance)
      b.box(mSteelBlack, xR + 0.04, signY, -0.35, 0.04, 0.48, 2.40, { r: 0.01 });
      b.panel(mBillboardSign, R.boutiqueSign, xR + 0.065, signY, -0.35, 2.30, 0.42, Math.PI / 2);
      // Warm interior backdrop at xR - 0.58 (0.53m behind right glass!)
      b.box(mDisplayBack, xR - 0.58, winCY, -0.35, 0.02, winH - 0.04, 2.28);
      b.box(mOakDoor, xR - 0.34, winY0 + 0.03, -0.35, 0.48, 0.06, 2.28);
      // Flanking side vitrine mannequins inside the right BOUTIQUE showcase at vx = xR - 0.38 (0.33m >= 0.30m behind glass!)
      const vxR = xR - 0.38;
      for (const [smz, sMat] of [[-1.15, mCoatCamel], [0.45, mDressOlive]]) {
        b.cyl(mCrateDark, vxR, winY0 + 0.08, smz, 0.11, 0.04);
        b.cyl(mBrass, vxR, winY0 + 0.38, smz, 0.018, 0.56);
        b.cyl(sMat, vxR, winY0 + 0.82, smz, 0.13, 0.44);
        b.cyl(mMannequinForm, vxR, winY0 + 1.10, smz, 0.045, 0.09);
      }
      // Right side window glass recessed 0.05m inward (xR - 0.05) + black steel mullions +0.03m in front of glass (xR - 0.02)
      const rGlassX = xR - 0.05;
      const rxW = xR - 0.02;
      b.box(M.clearWinGlass, rGlassX, winCY, -0.35, 0.012, winH - 0.04, 2.30);
      b.box(mSteelBlack, rxW, winY1 - 0.01, -0.35, 0.028, 0.06, 2.36);
      b.box(mSteelBlack, rxW, winY0 + 0.01, -0.35, 0.028, 0.06, 2.36);
      b.box(mSteelBlack, rxW, winY1 - 0.36, -0.35, 0.028, 0.05, 2.32);
      for (const mz of [-1.50, -0.78, -0.35, 0.08, 0.80]) {
        const isCenterStile = Math.abs(mz - (-0.35)) < 0.02;
        b.box(isCenterStile ? mOakDoor : mSteelBlack, rxW, winCY, mz, 0.028, winH, isCenterStile ? 0.08 : 0.055);
      }
      b.box(mSteelBlack, rxW + 0.004, winCY, -0.35, 0.024, winH - 0.36, 0.042);
      for (const sz of [-1, 1]) {
        const dz = -0.35 + sz * 0.21;
        b.box(mOakDoor, rxW, 0.98, dz, 0.026, 0.07, 0.38);
        b.box(mCrateDark, rxW - 0.004, 0.72, dz, 0.022, 0.36, 0.36);
        b.box(mSteelBlack, rxW, 1.48, dz, 0.026, 0.04, 0.38);
        const hz = -0.35 + sz * 0.095;
        b.box(mBrass, xR + 0.015, 1.12, hz, 0.022, 0.38, 0.040);
        b.cyl(mBrass, xR + 0.045, 1.12, hz, 0.017, 0.34);
      }

      // 2 Industrial Wall Lanterns on Lantai 1 Front Concrete Pilasters
      const addIndWallLantern = (wx, wy, wz) => {
        b.box(mSteelBlack, wx, wy + 0.08, wz + 0.06, 0.06, 0.18, 0.12);
        b.box(mSteelBlack, wx, wy - 0.04, wz + 0.14, 0.16, 0.22, 0.16);
        b.box(M.glowGlass, wx, wy - 0.04, wz + 0.14, 0.11, 0.16, 0.11);
        b.add(mSteelBlack, unitCone, wx, wy + 0.10, wz + 0.14, 0.20, 0.10, 0.20);
      };
      addIndWallLantern(-3.10, 1.78, zF);
      addIndWallLantern(2.42, 1.78, zF);

      // Low Concrete Planter Boxes with +0.04m vertical offset & non-overlapping layers so they never Z-fight
      const addBoutiquePlanter = (px, py, pz, pw, pd) => {
        const yP = py + 0.02;
        b.box(mFlutedConcrete, px, yP + 0.14, pz, pw, 0.28, pd, { r: 0.015 });
        b.box(mBenchConcrete, px, yP + 0.30, pz, pw + 0.04, 0.04, pd + 0.04);
        b.box(mSoilDark, px, yP + 0.335, pz, pw - 0.08, 0.02, pd - 0.08);
        const n = Math.max(3, Math.round(Math.max(pw, pd) / 0.34));
        const alongX = pw >= pd;
        for (let k = 0; k < n; k++) {
          const u = n === 1 ? 0 : (k / (n - 1) - 0.5) * (Math.max(pw, pd) - 0.28);
          const bx = px + (alongX ? u : 0);
          const bz = pz + (alongX ? 0 : u);
          const isPinkShrub = k % 3 === 1;
          const mMain = isPinkShrub ? mMapleRose : (k % 2 === 0 ? mLeafDark : mLeafLight);
          const mSub = isPinkShrub ? mMaplePink : mBambooLeaf;
          b.crown(mMain, bx, yP + 0.44, bz, 0.13, 0.14, 0.13, k * 1.1);
          b.crown(mSub, bx + 0.02, yP + 0.50, bz + 0.02, 0.09, 0.10, 0.09, k * 1.7 + 0.5);
        }
      };
      addBoutiquePlanter(-2.05, y0, zF + 0.20, 1.26, 0.24);
      addBoutiquePlanter(-0.22, y0, zF + 0.20, 1.26, 0.24);

      // Helper: Potted Ornamental Plant in Fluted/Round Concrete Pot (stepped +0.04m vertical offsets & polygonOffset so zero flickering!)
      const addRoundPotPlant = (px, py, pz, rBush, tall = false, pinkAccent = false) => {
        const yP = py + 0.02;
        b.cyl(mFlutedConcrete, px, yP + 0.16, pz, 0.20, 0.32);
        b.cyl(mBenchConcrete, px, yP + 0.34, pz, 0.22, 0.04);
        b.cyl(mSoilDark, px, yP + 0.375, pz, 0.17, 0.02);
        if (tall) {
          b.cyl(mCrateDark, px, yP + 0.64, pz, 0.036, 0.54);
          b.crown(pinkAccent ? mMapleRed : mLeafLight, px, yP + 0.98, pz, rBush, rBush * 1.1, rBush, 1);
          b.crown(pinkAccent ? mMaplePink : mLeafDark, px - 0.06, yP + 0.88, pz + 0.05, rBush * 0.78, rBush * 0.78, rBush * 0.78, 2);
        } else {
          b.crown(pinkAccent ? mMapleRose : mLeafDark, px, yP + 0.52, pz, rBush, rBush * 0.90, rBush, 3);
          b.crown(mLeafLight, px + 0.04, yP + 0.57, pz - 0.03, rBush * 0.70, rBush * 0.68, rBush * 0.70, 4);
        }
      };

      // ----------------------------------------------------------------------
      // 2. LANTAI 2 — SLEEK INDUSTRIAL BRICK FACADE (#A85D44) & MODERN BALUSTRADE
      //    - Outer Brick Wall Surface at zF = 1.65, xR = 2.65, xL = -3.35
      //    - 2nd-Floor Window Glass recessed 0.05m inward (zF - 0.05, xR - 0.05, xL + 0.05)
      //    - Black Steel Window Frames/Mullions +0.03m in front of glass (zF - 0.02, xR - 0.02, xL + 0.02)
      //    - 2nd-Floor Light Panel/Backdrop recessed 0.16m (>= 0.15m) behind glass (zF - 0.21, xR - 0.21, xL + 0.21)
      // ----------------------------------------------------------------------
      const lwW = 4.36, lwH = 1.44, lwY = 4.42;
      const lwY0 = lwY - lwH / 2, lwY1 = lwY + lwH / 2;
      const rlwD = 3.00;
      const swZ = czB, swW = 1.24, swH = 1.32;
      const swY0 = lwY - swH / 2, swY1 = lwY + swH / 2;

      // Recessed interior brick core inset >= 0.36m from all 4 outer brick walls (and shrunk vertically by 0.08m) so inner walls never touch outer walls!
      b.box(mIndBrick, cxB, y1 + h2 / 2, czB, wB - 0.72, h2 - 0.08, dB - 0.72);
      // Rear (-Z) solid brick wall pushed +0.04m outward (rear face at zB - 0.04, inner face at zB + 0.22)
      b.box(mIndBrick, cxB, y1 + h2 / 2, zB + 0.09, wB, h2, 0.26);
      // Front (+Z) brick spandrel bands & corner piers flush at zF = 1.65 (non-overlapping in Y!)
      b.box(mIndBrick, cxB, (y1 + lwY0) / 2, zF - 0.13, wB, lwY0 - y1, 0.26);
      b.box(mIndBrick, cxB, (lwY1 + y2) / 2, zF - 0.13, wB, y2 - lwY1, 0.26);
      const fPierW = (wB - lwW) / 2;
      b.box(mIndBrick, xL + fPierW / 2, lwY, zF - 0.13, fPierW, lwH, 0.26);
      b.box(mIndBrick, xR - fPierW / 2, lwY, zF - 0.13, fPierW, lwH, 0.26);
      // Right (+X) brick spandrel bands & corner piers flush at xR = 2.65 (stopping between zB + 0.22 and zF - 0.26 so zero corner overlap!)
      const sideBrickZ0 = zB + 0.22, sideBrickZ1 = zF - 0.26;
      const sideBrickD = sideBrickZ1 - sideBrickZ0, sideBrickCZ = (sideBrickZ0 + sideBrickZ1) / 2;
      b.box(mIndBrick, xR - 0.13, (y1 + lwY0) / 2, sideBrickCZ, 0.26, lwY0 - y1, sideBrickD);
      b.box(mIndBrick, xR - 0.13, (lwY1 + y2) / 2, sideBrickCZ, 0.26, y2 - lwY1, sideBrickD);
      const rWinZ0 = czB - rlwD / 2, rWinZ1 = czB + rlwD / 2;
      b.box(mIndBrick, xR - 0.13, lwY, (sideBrickZ0 + rWinZ0) / 2, 0.26, lwH, rWinZ0 - sideBrickZ0);
      b.box(mIndBrick, xR - 0.13, lwY, (rWinZ1 + sideBrickZ1) / 2, 0.26, lwH, sideBrickZ1 - rWinZ1);
      // Left (-X) brick spandrel bands & piers flush at xL = -3.35 (stopping between zB + 0.22 and zF - 0.26 so zero corner overlap!)
      b.box(mIndBrick, xL + 0.13, (y1 + swY0) / 2, sideBrickCZ, 0.26, swY0 - y1, sideBrickD);
      b.box(mIndBrick, xL + 0.13, (swY1 + y2) / 2, sideBrickCZ, 0.26, y2 - swY1, sideBrickD);
      const lWinZ0 = czB - swW / 2, lWinZ1 = czB + swW / 2;
      b.box(mIndBrick, xL + 0.13, lwY, (sideBrickZ0 + lWinZ0) / 2, 0.26, swH, lWinZ0 - sideBrickZ0);
      b.box(mIndBrick, xL + 0.13, lwY, (lWinZ1 + sideBrickZ1) / 2, 0.26, swH, sideBrickZ1 - lWinZ1);

      // Dark Slate Corner Quoins (#4A4D50) alternating long-and-short along all 4 corners of Lantai 2 (+0.04m outward relief on front & rear!)
      const qRows = 8;
      const qStep = (h2 - 0.24) / qRows;
      for (let q = 0; q < qRows; q++) {
        const qy = y1 + 0.12 + (q + 0.5) * qStep;
        const qh = qStep * 0.82;
        const isLong = q % 2 === 0;
        const qwX = isLong ? 0.36 : 0.22;
        const qwZ = isLong ? 0.22 : 0.36;
        for (const sx of [-1, 1]) {
          for (const sz of [-1, 1]) {
            const qx = cxB + sx * (wB / 2 + 0.04 - qwX / 2);
            const zOuterFace = sz < 0 ? zB - 0.04 : zF;
            const qz = zOuterFace + sz * (0.04 - qwZ / 2);
            b.box(mSlateQuoin, qx, qy, qz, qwX, qh, qwZ);
          }
        }
      }

      // Wide 4-Bay Industrial Loft Window on Lantai 2 Front Facade:
      // - Light panel at zF - 0.21 (0.16m >= 0.15m behind glass)
      // - Glass pane at zF - 0.05 (recessed 0.05m behind wall zF)
      // - Mullions/Frames at zF - 0.02 (+0.03m in front of glass)
      b.box(mConcreteTrim, cxB, lwY + lwH / 2 + 0.05, zF + 0.03, lwW + 0.16, 0.08, 0.06);
      b.box(mConcreteTrim, cxB, lwY - lwH / 2 - 0.04, zF + 0.03, lwW + 0.16, 0.07, 0.06);
      b.box(M.glowGlass, cxB, lwY, zF - 0.21, lwW - 0.04, lwH - 0.04, 0.02);
      b.box(M.clearWinGlass, cxB, lwY, zF - 0.05, lwW - 0.02, lwH - 0.02, 0.012);
      b.box(mSteelBlack, cxB, lwY + lwH / 2 - 0.01, zF - 0.02, lwW + 0.04, 0.06, 0.028);
      b.box(mSteelBlack, cxB, lwY - lwH / 2 + 0.01, zF - 0.02, lwW + 0.04, 0.06, 0.028);
      for (let k = 0; k <= 4; k++) {
        const mx = cxB - lwW / 2 + (k * lwW) / 4;
        b.box(mSteelBlack, mx, lwY, zF - 0.02, k === 0 || k === 4 ? 0.06 : 0.05, lwH, 0.028);
      }
      for (const hy of [lwY - 0.24, lwY + 0.24]) {
        b.box(mSteelBlack, cxB, hy, zF - 0.02, lwW, 0.038, 0.026);
      }
      addIndWallLantern(cxB - 2.52, lwY + 0.05, zF);
      addIndWallLantern(cxB + 2.52, lwY + 0.05, zF);

      // Right Side 3-Bay Industrial Loft Window + Framed Black-Iron Juliet Guardrail:
      // - Light panel at xR - 0.21 (0.16m behind glass)
      // - Glass pane at xR - 0.05 (0.05m recessed behind wall xR)
      // - Mullions/Frames at xR - 0.02 (+0.03m in front of glass)
      b.box(mConcreteTrim, xR + 0.03, lwY + lwH / 2 + 0.05, czB, 0.06, 0.08, rlwD + 0.16);
      b.box(mConcreteTrim, xR + 0.12, lwY - lwH / 2 - 0.05, czB, 0.24, 0.08, rlwD + 0.28);
      b.box(M.glowGlass, xR - 0.21, lwY, czB, 0.02, lwH - 0.04, rlwD - 0.04);
      b.box(M.clearWinGlass, xR - 0.05, lwY, czB, 0.012, lwH - 0.02, rlwD - 0.02);
      b.box(mSteelBlack, xR - 0.02, lwY + lwH / 2 - 0.01, czB, 0.028, 0.06, rlwD + 0.04);
      b.box(mSteelBlack, xR - 0.02, lwY - lwH / 2 + 0.01, czB, 0.028, 0.06, rlwD + 0.04);
      for (let k = 0; k <= 3; k++) {
        const mz = czB - rlwD / 2 + (k * rlwD) / 3;
        b.box(mSteelBlack, xR - 0.02, lwY, mz, 0.028, lwH, 0.05);
      }
      for (const hy of [lwY - 0.24, lwY + 0.24]) {
        b.box(mSteelBlack, xR - 0.02, hy, czB, 0.026, 0.038, rlwD);
      }
      // Continuous Black Iron Juliet Railing framing the bottom of the Right 2nd-Floor Window
      const rjX = xR + 0.20, rjY0 = lwY - lwH / 2 - 0.04, rjH = 0.48, rjSpan = rlwD + 0.24;
      b.box(mSteelBlack, rjX, rjY0 + rjH, czB, 0.045, 0.045, rjSpan);
      b.box(mSteelBlack, rjX, rjY0 + rjH * 0.5, czB, 0.035, 0.035, rjSpan);
      b.box(mSteelBlack, rjX, rjY0 + 0.03, czB, 0.04, 0.04, rjSpan);
      for (const sz of [-1, 1]) {
        b.box(mSteelBlack, (xR + rjX) / 2, rjY0 + rjH, czB + sz * (rjSpan / 2 - 0.02), rjX - xR, 0.045, 0.045);
      }
      for (let k = 0; k <= 12; k++) {
        const bz0 = czB - rjSpan / 2 + 0.04 + (k * (rjSpan - 0.08)) / 12;
        const bw = k % 4 === 0 ? 0.045 : 0.032;
        b.box(mSteelBlack, rjX, rjY0 + rjH / 2, bz0, bw, rjH, bw);
      }

      // Continuous 2nd-Floor Front Balcony with Unbroken Black Iron Balustrade & Inward-Set Potted Plants
      const balZ = zF + 0.34, balW = wB + 0.16, balD = 0.58;
      b.box(mConcreteTrim, cxB, y1 + 0.06, balZ, balW, 0.10, balD);
      const railZ = zF + 0.58, railH = 0.64, railY0 = y1 + 0.11;
      b.box(mSteelBlack, cxB, railY0 + railH, railZ, balW, 0.055, 0.055);
      b.box(mSteelBlack, cxB, railY0 + railH * 0.52, railZ, balW, 0.038, 0.042);
      b.box(mSteelBlack, cxB, railY0 + 0.03, railZ, balW, 0.045, 0.048);
      for (const sx of [-1, 1]) {
        const rxSide = cxB + sx * (balW / 2 - 0.025);
        const sideDepth = railZ - zF;
        b.box(mSteelBlack, rxSide, railY0 + railH, (zF + railZ) / 2, 0.055, 0.055, sideDepth);
        b.box(mSteelBlack, rxSide, railY0 + railH * 0.52, (zF + railZ) / 2, 0.038, 0.038, sideDepth);
        b.box(mSteelBlack, rxSide, railY0 + 0.03, (zF + railZ) / 2, 0.045, 0.045, sideDepth);
        b.box(mSteelBlack, rxSide, railY0 + railH / 2, zF + 0.26, 0.036, railH, 0.036);
        b.box(mSteelBlack, rxSide, railY0 + railH / 2, zF + 0.03, 0.045, railH, 0.045);
      }
      const nBalusters = 24;
      for (let k = 0; k <= nBalusters; k++) {
        const bx = cxB - balW / 2 + 0.04 + (k * (balW - 0.08)) / nBalusters;
        const isPost = k % 6 === 0;
        const bw = isPost ? 0.056 : 0.036;
        b.box(mSteelBlack, bx, railY0 + railH / 2, railZ, bw, railH, bw);
      }
      // Balcony potted plants centered at zF + 0.28 with compact 0.16m bush radius so they never touch wall or railing
      addRoundPotPlant(cxB - 2.08, y1 + 0.11, zF + 0.28, 0.16, false);
      addRoundPotPlant(cxB + 2.08, y1 + 0.11, zF + 0.28, 0.16, false);

      // ----------------------------------------------------------------------
      // 3. SIDE PROFILE & INTEGRATED TIMBER LOUNGE DECK + CAFÉ BISTRO AREA
      // ----------------------------------------------------------------------
      // Left 2nd-floor industrial grid window:
      // - Light panel at xL + 0.21 (0.16m behind glass)
      // - Glass pane at xL + 0.05 (recessed 0.05m inward from wall xL)
      // - Steel frames/mullions at xL + 0.02 (+0.03m in front of glass)
      b.box(mConcreteTrim, xL - 0.03, lwY + swH / 2 + 0.05, swZ, 0.06, 0.08, swW + 0.16);
      b.box(mConcreteTrim, xL - 0.12, lwY - swH / 2 - 0.05, swZ, 0.24, 0.08, swW + 0.24);
      b.box(M.glowGlass, xL + 0.21, lwY, swZ, 0.02, swH - 0.04, swW - 0.04);
      b.box(M.clearWinGlass, xL + 0.05, lwY, swZ, 0.012, swH - 0.02, swW - 0.02);
      b.box(mSteelBlack, xL + 0.02, lwY + swH / 2 - 0.01, swZ, 0.028, 0.06, swW + 0.04);
      b.box(mSteelBlack, xL + 0.02, lwY - swH / 2 + 0.01, swZ, 0.028, 0.06, swW + 0.04);
      for (const dz of [-swW / 2, 0, swW / 2]) {
        b.box(mSteelBlack, xL + 0.02, lwY, swZ + dz, 0.028, swH, 0.05);
      }
      for (const dy of [-0.22, 0.22]) {
        b.box(mSteelBlack, xL + 0.02, lwY + dy, swZ, 0.026, 0.035, swW);
      }
      // Flush Black Iron Juliet Railing directly below the Left 2nd-Floor Window
      const ljX = xL - 0.20, ljY0 = lwY - swH / 2 - 0.04, ljH = 0.46, ljSpan = swW + 0.20;
      b.box(mSteelBlack, ljX, ljY0 + ljH, swZ, 0.045, 0.045, ljSpan);
      b.box(mSteelBlack, ljX, ljY0 + ljH * 0.5, swZ, 0.035, 0.035, ljSpan);
      b.box(mSteelBlack, ljX, ljY0 + 0.03, swZ, 0.04, 0.04, ljSpan);
      for (const sz of [-1, 1]) {
        b.box(mSteelBlack, (xL + ljX) / 2, ljY0 + ljH, swZ + sz * (ljSpan / 2 - 0.02), xL - ljX, 0.045, 0.045);
      }
      for (let k = 0; k <= 6; k++) {
        const bz0 = swZ - ljSpan / 2 + 0.04 + (k * (ljSpan - 0.08)) / 6;
        b.box(mSteelBlack, ljX, ljY0 + ljH / 2, bz0, 0.034, ljH, 0.034);
      }

      // Vertical Metal Downspout Pipe on Left Wall (matching Side Profile!)
      const dpZ = -1.68;
      b.box(mPipeGrey, xL - 0.10, y2 - 0.12, dpZ, 0.16, 0.18, 0.18);
      b.cyl(mPipeGrey, xL - 0.10, (y0 + y2) / 2, dpZ, 0.048, y2 - y0 - 0.18);
      for (const by of [0.85, 2.05, 3.20, 4.45]) {
        b.box(mSteelBlack, xL - 0.08, by, dpZ, 0.12, 0.04, 0.12);
      }

      // Slanted Architectural Fabric Canopy Awning on Left Wall over Timber Lounge Deck (matching Side Profile!)
      const canZ = -0.32, canD = 2.45, canW = 1.24, canY = 2.52;
      b.box(mSteelBlack, xL - 0.05, canY + 0.12, canZ, 0.06, 0.06, canD + 0.08);
      b.box(mCanopyFabric, xL - canW * 0.52, canY - 0.12, canZ, canW, 0.045, canD, { rz: 0.24, r: 0.01 });
      b.box(mSteelBlack, xL - canW, canY - 0.25, canZ, 0.045, 0.055, canD + 0.04);
      for (const sz of [canZ - canD * 0.44, canZ, canZ + canD * 0.44]) {
        b.box(mSteelBlack, xL - canW * 0.50, canY - 0.22, sz, canW * 0.96, 0.03, 0.03, { rz: -0.18 });
      }

      // Integrated Warm Timber Lounge Deck on Left Side (pulled snug against xL = -3.35 to -4.22 so left sidewalk stays spacious!)
      const dkX0 = -4.22, dkX1 = xL - 0.02, dkZ0 = -1.75, dkZ1 = 0.95;
      const dkW = dkX1 - dkX0, dkD = dkZ1 - dkZ0, dkCX = (dkX0 + dkX1) / 2, dkCZ = (dkZ0 + dkZ1) / 2;
      const yLoungeDeck = y0 + 0.075;
      // Curved concrete/timber step 1 & step 2 with clean vertical separation
      b.add(mBenchConcrete, roundedRectGeometry(dkW + 0.32, dkD + 0.44, 0.48, 0.026), dkCX - 0.05, y0, dkCZ + 0.10);
      b.add(mCrateDark, roundedRectGeometry(dkW + 0.16, dkD + 0.22, 0.38, 0.026), dkCX - 0.02, y0 + 0.026, dkCZ + 0.05);
      // Main Warm Timber Lounge Deck surface
      b.box(mCrateDark, dkCX, y0 + 0.044, dkCZ, dkW + 0.06, 0.036, dkD + 0.06, { r: 0.02 });
      b.add(mRoofDeck, tiledBoxGeo(dkW, 0.028, dkD), dkCX, y0 + 0.062, dkCZ);

      // Right-Side Timber Lounge Deck Inlay pulled snug against Right Wall (xR = 2.65) under the Curved Bench
      const rDkX = xR + 0.30, rDkZ = 0.05, rDkW = 0.56, rDkD = 1.65;
      b.box(mCrateDark, rDkX, y0 + 0.012, rDkZ, rDkW + 0.06, 0.024, rDkD + 0.06, { r: 0.015 });
      b.add(mRoofDeck, tiledBoxGeo(rDkW, 0.024, rDkD), rDkX, y0 + 0.026, rDkZ);

      // Helper: Café Bistro Refreshment Table + 2 Bistro Chairs (Meja Bundar Kecil & 2 Kursi Bistro)
      const addAtelierBistroSet = (bTarget, tx, tyBase, tz, chairAlongZ = true) => {
        // Round warm timber & dark steel bistro table
        bTarget.cyl(mOakDoor, tx, tyBase + 0.54, tz, 0.34, 0.038);
        bTarget.cyl(mSteelBlack, tx, tyBase + 0.51, tz, 0.35, 0.018);
        bTarget.cyl(mSteelBlack, tx, tyBase + 0.27, tz, 0.034, 0.50);
        bTarget.cyl(mSteelBlack, tx, tyBase + 0.02, tz, 0.18, 0.03);
        // Refreshment coffee cups & minimalist small bud vase on tabletop
        bTarget.cyl(mBenchConcrete, tx - 0.07, tyBase + 0.585, tz + 0.05, 0.038, 0.05);
        bTarget.cyl(mBenchConcrete, tx + 0.07, tyBase + 0.585, tz - 0.04, 0.038, 0.05);
        bTarget.cyl(mBrass, tx + 0.02, tyBase + 0.595, tz + 0.06, 0.028, 0.07);
        bTarget.sphere(mMaplePink, tx + 0.02, tyBase + 0.655, tz + 0.06, 0.042);

        // 2 Modern Industrial Bistro Chairs
        for (const s of [-1, 1]) {
          const cx0 = chairAlongZ ? tx : tx + s * 0.48;
          const cz0 = chairAlongZ ? tz + s * 0.48 : tz;
          const ry = chairAlongZ ? (s === -1 ? 0 : Math.PI) : (s === -1 ? Math.PI / 2 : -Math.PI / 2);
          bTarget.cyl(mCrateWood, cx0, tyBase + 0.33, cz0, 0.16, 0.032);
          for (const [lx, lz] of [[-0.095, -0.095], [0.095, -0.095], [-0.095, 0.095], [0.095, 0.095]]) {
            bTarget.cyl(mSteelBlack, cx0 + lx, tyBase + 0.165, cz0 + lz, 0.015, 0.33);
          }
          const bx0 = chairAlongZ ? cx0 : cx0 + s * 0.13;
          const bz0 = chairAlongZ ? cz0 + s * 0.13 : cz0;
          bTarget.box(mOakDoor, bx0, tyBase + 0.52, bz0, 0.26, 0.22, 0.032, { ry, r: 0.015 });
          bTarget.box(mSteelBlack, bx0, tyBase + 0.41, bz0, 0.22, 0.16, 0.018, { ry });
        }
      };

      // 1) Left-Side Café Bistro Refreshment Tables pulled closer against Left Wall (xL = -3.35) under Slanted Fabric Canopy
      // 1.38u spacing keeps the two inner chairs from interpenetrating (each set spans ±0.64u)
      addAtelierBistroSet(b, -3.72, yLoungeDeck, -1.06, true);
      addAtelierBistroSet(b, -3.72, yLoungeDeck, 0.32, true);

      // ----------------------------------------------------------------------
      // 4. ATAP — WOODEN ROOFTOP DECK (+0.04m ABOVE CONCRETE ROOF SLAB),
      //    INDUSTRIAL BALUSTRADE & INWARD-SHIFTED (+0.30m) POTTED PLANTS
      // ----------------------------------------------------------------------
      // Non-overlapping roof slab layers with >= 0.04m vertical offset + polygonOffset so zero flickering!
      b.box(mConcreteTrim, cxB, y2 + 0.06, czB, wB + 0.26, 0.12, dB + 0.26);
      b.box(mSteelBlack, cxB, y2 + 0.145, czB, wB + 0.32, 0.045, dB + 0.32);
      const yDeck = y2 + 0.24;
      b.add(mRoofDeck, tiledBoxGeo(wB - 0.12, 0.05, dB - 0.12), cxB, y2 + 0.215, czB);

      // Perimeter Industrial Balustrade along Back, Left & Right Sides of the Rooftop Deck (sitting level & flush at yDeck!)
      const rTopH = 0.58;
      const rzBack = czB - (dB / 2 - 0.06);
      b.box(mSteelBlack, cxB, yDeck + rTopH, rzBack, wB, 0.048, 0.048);
      b.box(mSteelBlack, cxB, yDeck + rTopH * 0.5, rzBack, wB, 0.034, 0.036);
      b.box(mSteelBlack, cxB, yDeck + 0.03, rzBack, wB, 0.042, 0.044);
      for (let k = 0; k <= 14; k++) {
        const px = xL + 0.06 + (k * (wB - 0.12)) / 14;
        const isPost = k === 0 || k === 7 || k === 14;
        b.box(mSteelBlack, px, yDeck + rTopH / 2, rzBack, isPost ? 0.052 : 0.035, rTopH, isPost ? 0.052 : 0.035);
      }
      for (const sx of [-1, 1]) {
        const rx = cxB + sx * (wB / 2 - 0.06);
        b.box(mSteelBlack, rx, yDeck + rTopH, czB, 0.048, 0.048, dB);
        b.box(mSteelBlack, rx, yDeck + rTopH * 0.5, czB, 0.036, 0.034, dB);
        b.box(mSteelBlack, rx, yDeck + 0.03, czB, 0.044, 0.042, dB);
        // k = 0 (back corner) post is already placed by the back balustrade run
        for (let k = 1; k <= 10; k++) {
          const pz = zB + 0.06 + (k * (dB - 0.12)) / 10;
          const isPost = k === 0 || k === 5 || k === 10;
          b.box(mSteelBlack, rx, yDeck + rTopH / 2, pz, isPost ? 0.052 : 0.035, rTopH, isPost ? 0.052 : 0.035);
        }
      }

      // Lush Rooftop Potted Greenery shifted 0.30m further inward (xL + 0.82, xR - 0.82, zB + 0.82) so zero pots/leaves clip the railing!
      addRoundPotPlant(xL + 0.82, yDeck, zB + 0.82, 0.24, true, false);
      addRoundPotPlant(xL + 1.38, yDeck, zB + 0.80, 0.20, false, false);
      addRoundPotPlant(xL + 0.80, yDeck, zB + 1.38, 0.20, false, false);
      addRoundPotPlant(xR - 0.82, yDeck, zB + 0.82, 0.24, true, false);
      addRoundPotPlant(xR - 1.38, yDeck, zB + 0.80, 0.20, false, false);
      addRoundPotPlant(xL + 0.80, yDeck, zF - 0.92, 0.20, false, false);
      addRoundPotPlant(xR - 0.80, yDeck, zF - 0.92, 0.20, false, false);
      addRoundPotPlant(cxB, yDeck, zB + 0.80, 0.22, false, false);

      // LONG HORIZONTAL ROOFTOP BILLBOARD + REAR BLACK STEEL TRUSS FRAME + 4 FLOODLIGHTS
      // (Vertical truss legs & diagonal raker struts extended down so they anchor solidly into the rooftop deck & front roof structure!)
      const bbW = 5.36, bbH = 1.48, bbY = yDeck + 0.94, bbZ = zF - 0.06;
      b.box(mSteelBlack, cxB, bbY, bbZ, bbW + 0.12, bbH + 0.12, 0.08, { r: 0.015 });
      b.box(mConcreteTrim, cxB, bbY, bbZ - 0.06, bbW, bbH, 0.04);
      b.panel(mBillboardSign, R.atelierBillboard, cxB, bbY, bbZ + 0.055, bbW - 0.04, bbH - 0.04);

      // Rear-mounted vertical truss columns & cross-bracing anchored solidly from yDeck - 0.10 up to the top of the billboard!
      const tzF = bbZ - 0.08, tzB = bbZ - 0.38;
      for (const tx of [cxB - bbW / 2 + 0.18, cxB - 0.95, cxB + 0.95, cxB + bbW / 2 - 0.18]) {
        // Base anchor plate bolted onto the roof deck
        b.box(mSteelBlack, tx, yDeck + 0.02, (bbZ + tzB) / 2, 0.16, 0.045, (bbZ - tzB) + 0.14);
        // Front & rear vertical steel columns anchored from yDeck - 0.08 up to bbY + bbH / 2 + 0.06
        b.box(mSteelBlack, tx, yDeck + 0.82, tzF, 0.06, 1.84, 0.06);
        b.box(mSteelBlack, tx, yDeck + 0.82, tzB, 0.06, 1.84, 0.06);
        // Horizontal connectors attaching the billboard frame directly to the vertical truss columns
        b.box(mSteelBlack, tx, bbY + 0.56, (bbZ + tzB) / 2, 0.055, 0.055, bbZ - tzB + 0.06);
        b.box(mSteelBlack, tx, bbY - 0.56, (bbZ + tzB) / 2, 0.055, 0.055, bbZ - tzB + 0.06);
        for (let r = 0; r < 5; r++) {
          const ry0 = yDeck + 0.16 + r * 0.36;
          b.box(mSteelBlack, tx, ry0, (tzF + tzB) / 2, 0.045, 0.04, tzF - tzB + 0.04);
          if (r < 4) {
            b.box(mSteelBlack, tx, ry0 + 0.18, (tzF + tzB) / 2, 0.036, 0.036, 0.40, {
              rx: (r % 2 === 0 ? 1 : -1) * 0.72
            });
          }
        }
        // Diagonal rear raker strut anchored solidly from the top truss (tzB, yDeck + 1.48) straight down into the rooftop deck plate (bbZ - 1.42, yDeck)!
        b.box(mSteelBlack, tx, yDeck + 0.74, bbZ - 0.90, 0.05, 0.05, 1.82, { rx: -0.76 });
        b.box(mSteelBlack, tx, yDeck + 0.025, bbZ - 1.42, 0.18, 0.05, 0.22);
      }
      b.box(mSteelBlack, cxB, bbY + 0.56, tzB, bbW - 0.12, 0.05, 0.05);
      b.box(mSteelBlack, cxB, bbY - 0.56, tzB, bbW - 0.12, 0.05, 0.05);
      b.box(mSteelBlack, cxB, yDeck + 0.04, tzF, bbW - 0.12, 0.05, 0.05);

      // 4 Curved Top Floodlight Spots mounted solidly from the top of the billboard frame & rear truss
      for (const fx of [cxB - 1.92, cxB - 0.64, cxB + 0.64, cxB + 1.92]) {
        const fy = bbY + bbH / 2 + 0.04;
        b.box(mSteelBlack, fx, fy + 0.06, bbZ - 0.04, 0.045, 0.22, 0.045);
        b.box(mSteelBlack, fx, fy + 0.16, bbZ + 0.13, 0.04, 0.04, 0.40);
        b.add(mSteelBlack, unitCone, fx, fy + 0.10, bbZ + 0.30, 0.12, 0.09, 0.12, 0.35, 0, 0);
        b.sphere(M.bulb, fx, fy + 0.07, bbZ + 0.28, 0.042);
      }
      S.lights.push([new THREE.Vector3(cxB - 1.3, bbY + 0.3, bbZ + 0.75), '#ffcf86', 4.6, 2.8]);
      S.lights.push([new THREE.Vector3(cxB + 1.3, bbY + 0.3, bbZ + 0.75), '#ffcf86', 4.6, 2.8]);

      // ======================================================================
      // 5. BIOPHILIC URBAN PEDESTRIAN SIDEWALK AMENITIES (FULL BLOCK UNIFIED)
      //    - Base Sidewalk Tile at y = 0.180
      //    - Pebble Pad (Aggregate Ribbon) at y = 0.190 (polygonOffset -1)
      //    - Wavy Brass Strips at y = 0.198 (continuous non-overlapping ribbon mesh, polygonOffset -1)
      // ======================================================================

      // 5A) Helper: Sweeping Exposed Aggregate Ribbon (y = 0.190) + Continuous Non-Overlapping Brass Strips (y = 0.198)
      const addAggregateLedWave = (parentGrp, _bTarget, pts, width = 0.88, ySurf = y0) => {
        const curvePts = pts.map(([px, pz]) => new THREE.Vector3(px, 0, pz));
        const curve = new THREE.CatmullRomCurve3(curvePts, false, 'centripetal', 0.5);
        const segs = Math.max(40, pts.length * 14);
        const positions = [];
        const normals = [];
        const uvs = [];
        const indices = [];

        const brassPos = [];
        const brassNorm = [];
        const brassIdx = [];
        const brassHalfW = 0.018;

        let arcLen = 0;
        let prevP = curve.getPoint(0);

        for (let i = 0; i <= segs; i++) {
          const u = i / segs;
          const p = curve.getPoint(u);
          if (i > 0) arcLen += p.distanceTo(prevP);
          prevP = p;
          const tan = curve.getTangent(u);
          const nx = -tan.z;
          const nz = tan.x;
          const endTaper = Math.min(1, Math.min(u, 1 - u) * 12);
          const hw = width * 0.5 * (0.55 + 0.45 * endTaper);

          const lx = p.x - nx * hw;
          const lz = p.z - nz * hw;
          const rx = p.x + nx * hw;
          const rz = p.z + nz * hw;
          // Stepped heights: Base tile = 0.180, Pebble pad = 0.190, Brass strip = 0.198
          const yRibbon = ySurf + 0.010;
          const yBrass = ySurf + 0.018;

          positions.push(lx, yRibbon, lz, rx, yRibbon, rz);
          normals.push(0, 1, 0, 0, 1, 0);
          const uTex = arcLen * 0.58;
          uvs.push(uTex, 0, uTex, 1);

          // Left & right continuous brass strips (4 vertices per step i: L_outer, L_inner, R_inner, R_outer)
          brassPos.push(
            lx - nx * brassHalfW, yBrass, lz - nz * brassHalfW,
            lx + nx * brassHalfW, yBrass, lz + nz * brassHalfW,
            rx - nx * brassHalfW, yBrass, rz - nz * brassHalfW,
            rx + nx * brassHalfW, yBrass, rz + nz * brassHalfW
          );
          brassNorm.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);

          if (i < segs) {
            const base = i * 2;
            indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
            const bBase = i * 4;
            brassIdx.push(
              bBase, bBase + 1, bBase + 4, bBase + 1, bBase + 5, bBase + 4,
              bBase + 2, bBase + 3, bBase + 6, bBase + 3, bBase + 7, bBase + 6
            );
          }
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geo.setIndex(indices);
        const ribbonMesh = new THREE.Mesh(solid(geo), mAggregateRibbon);
        ribbonMesh.receiveShadow = true;
        ribbonMesh.matrixAutoUpdate = false;
        ribbonMesh.updateMatrix();
        parentGrp.add(ribbonMesh);

        const bGeo = new THREE.BufferGeometry();
        bGeo.setAttribute('position', new THREE.Float32BufferAttribute(brassPos, 3));
        bGeo.setAttribute('normal', new THREE.Float32BufferAttribute(brassNorm, 3));
        bGeo.setIndex(brassIdx);
        const brassMesh = new THREE.Mesh(solid(bGeo), mLedBrassStrip);
        brassMesh.castShadow = false;
        brassMesh.receiveShadow = false;
        brassMesh.matrixAutoUpdate = false;
        brassMesh.updateMatrix();
        parentGrp.add(brassMesh);
      };

      // 1) Primary Sweeping Two-Tone Aggregate & Warm LED/Brass Ribbon along the Unobstructed Central Sidewalk Corridor (g)
      //    (Zero tree pots, benches, bike racks, or podiums ever sit on top of this wavy pebble promenade!)
      addAggregateLedWave(
        g,
        b,
        [
          [-3.25, 3.45],
          [-1.65, 3.26],
          [-0.05, 3.66],
          [1.55, 3.30],
          [2.85, 3.58],
          [3.92, 2.85],
          [3.92, 1.35],
          [4.16, -0.25],
          [3.92, -1.85],
          [4.05, -3.25]
        ],
        0.84,
        y0
      );

      // 2) Rear Sidewalk Continuation of the Aggregate & Warm LED/Brass Ribbon (villageOuterLot)
      addAggregateLedWave(
        villageOuterLot,
        bLot,
        [
          [4.05, -3.25],
          [3.45, -4.15],
          [1.65, -3.85],
          [-0.45, -4.22],
          [-2.45, -3.85],
          [-3.95, -4.10]
        ],
        0.84,
        y0
      );

      // 5B) Helper: Vertical Fluted Concrete Cylindrical Planter (Japanese Red Maple OR Slender Bamboo + Purple Lavender)
      const addFlutedPlanter = (bTarget, px, pz, plantType = 'maple', rPot = 0.34, hPot = 0.54, yBase = y0) => {
        // Core concrete cylinder & top rim collar (stepped +0.04m above sidewalk base with polygonOffset so zero z-fighting!)
        const yPot0 = yBase + 0.04;
        bTarget.cyl(mBenchConcreteDark, px, yBase + 0.02, pz, rPot + 0.02, 0.04);
        bTarget.cyl(mFlutedConcrete, px, yPot0 + hPot * 0.5, pz, rPot - 0.014, hPot - 0.03);
        bTarget.cyl(mBenchConcrete, px, yPot0 + hPot - 0.025, pz, rPot + 0.024, 0.05);
        bTarget.cyl(mSoilDark, px, yPot0 + hPot + 0.015, pz, rPot - 0.032, 0.02);
        // 18 Vertical Fluted Concrete Ribs around the cylinder perimeter
        const nRibs = 18;
        for (let i = 0; i < nRibs; i++) {
          const ang = (i * Math.PI * 2) / nRibs;
          const rx = px + Math.cos(ang) * (rPot + 0.008);
          const rz = pz + Math.sin(ang) * (rPot + 0.008);
          bTarget.box(i % 2 === 0 ? mFlutedRib : mBenchConcrete, rx, yPot0 + hPot * 0.48, rz, 0.036, hPot - 0.10, 0.024, {
            ry: -ang + Math.PI / 2,
            r: 0.006
          });
        }

        const yTop = yPot0 + hPot + 0.02;
        if (plantType === 'maple') {
          // Japanese Red Maple Tree (Pohon Japanese Red Maple berdaun merah-merah muda + lumut/pakis hijau bawah)
          bTarget.cyl(mCrateDark, px, yTop + 0.42, pz, 0.048, 0.84);
          bTarget.cyl(mCrateDark, px - 0.14, yTop + 0.68, pz + 0.08, 0.028, 0.46, { rz: 0.46, rx: 0.22 });
          bTarget.cyl(mCrateDark, px + 0.15, yTop + 0.72, pz - 0.08, 0.028, 0.48, { rz: -0.44, rx: -0.20 });
          // Low green moss/fern tufts at trunk base
          bTarget.crown(mLeafDark, px - 0.12, yTop + 0.10, pz + 0.10, 0.16, 0.11, 0.16, 0.5);
          bTarget.crown(mLeafLight, px + 0.11, yTop + 0.09, pz - 0.09, 0.15, 0.10, 0.15, 1.7);
          // Layered clouds of crimson-red, rose-burgundy & coral-pink maple foliage
          bTarget.crown(mMapleRed, px, yTop + 0.96, pz, 0.46, 0.34, 0.46, 0.4);
          bTarget.crown(mMapleRose, px - 0.24, yTop + 0.84, pz + 0.14, 0.34, 0.26, 0.34, 1.3);
          bTarget.crown(mMapleRose, px + 0.25, yTop + 0.88, pz - 0.12, 0.34, 0.26, 0.34, 2.2);
          bTarget.crown(mMaplePink, px + 0.08, yTop + 1.14, pz + 0.10, 0.32, 0.24, 0.32, 3.1);
          bTarget.crown(mMapleRed, px - 0.12, yTop + 1.04, pz - 0.18, 0.30, 0.24, 0.30, 4.0);
        } else {
          // Slender Green Bamboo Clump + Purple Lavender Flowers (Rumpun Bambu Ramping + Bunga Lavender Ungu)
          const culms = [
            [0, 0, 1.48, 0, 0],
            [-0.10, 0.06, 1.36, 0.05, 0.04],
            [0.10, -0.05, 1.42, -0.05, -0.04],
            [-0.06, -0.10, 1.24, 0.04, -0.06],
            [0.08, 0.09, 1.30, -0.04, 0.05],
            [-0.14, -0.02, 1.12, 0.07, 0],
            [0.14, 0.02, 1.16, -0.07, 0]
          ];
          for (const [cxOff, czOff, hC, rxC, rzC] of culms) {
            bTarget.cyl(mBambooCulm, px + cxOff, yTop + hC * 0.5, pz + czOff, 0.020, hC, { rx: rxC, rz: rzC });
            // Airy bamboo leaf clusters along upper culm
            bTarget.crown(mBambooLeaf, px + cxOff * 1.4, yTop + hC * 0.78, pz + czOff * 1.4, 0.18, 0.14, 0.18, hC * 3);
            bTarget.crown(mLeafLight, px + cxOff * 1.6, yTop + hC * 0.96, pz + czOff * 1.6, 0.20, 0.15, 0.20, hC * 5);
          }
          // Lush base border of green foliage & Purple Lavender flower spikes around the rim
          bTarget.crown(mLeafDark, px, yTop + 0.12, pz, 0.26, 0.14, 0.26, 0.8);
          for (let l = 0; l < 10; l++) {
            const ang = (l * Math.PI * 2) / 10;
            const lx = px + Math.cos(ang) * (rPot * 0.64);
            const lz = pz + Math.sin(ang) * (rPot * 0.64);
            const mLav = l % 2 === 0 ? mLavenderPurple : mLavenderLight;
            bTarget.cyl(mLav, lx, yTop + 0.22, lz, 0.032, 0.18, {
              rx: Math.sin(ang) * 0.18,
              rz: -Math.cos(ang) * 0.18
            });
            bTarget.sphere(mLav, lx, yTop + 0.32, lz, 0.036);
          }
        }
      };

      // 5C) Helper: Kidney/Bean-Curved Concrete Bench with Warm Timber Slat Seat & Under-Glow LED
      const addCurvedConcreteBench = (bTarget, cx, cz, radius = 1.26, ang0 = 0.15, ang1 = 1.42, yBase = y0) => {
        const segs = 12;
        const hBench = 0.42;
        const wBench = 0.52;
        for (let i = 0; i <= segs; i++) {
          const u = i / segs;
          const a = ang0 + (ang1 - ang0) * u;
          const bx = cx + Math.cos(a) * radius;
          const bz = cz + Math.sin(a) * radius;
          const ry = -a + Math.PI / 2;
          const segLen = (Math.abs(ang1 - ang0) * radius) / segs + 0.08;

          // Recessed glowing under-bench base & floor LED halo
          bTarget.box(mBenchConcreteDark, bx, yBase + 0.05, bz, segLen, 0.10, wBench - 0.12, { ry });
          bTarget.box(mBenchUnderGlow, bx, yBase + 0.085, bz, segLen + 0.02, 0.032, wBench - 0.05, { ry });
          bTarget.box(mLedBrassStrip, bx, yBase + 0.018, bz, segLen + 0.04, 0.004, wBench + 0.10, { ry, r: 0.01 });

          // Smooth White-Grey Monolithic Curved Concrete Bench Body (#DFDDD7)
          bTarget.box(mBenchConcrete, bx, yBase + 0.25, bz, segLen + 0.03, hBench - 0.10, wBench, { ry, r: 0.04 });

          // Curved Warm Timber Slat Seat inset on top (#B68552 & #9A6B45)
          bTarget.box(
            i % 2 === 0 ? mCrateWood : mOakDoor,
            bx,
            yBase + hBench + 0.012,
            bz,
            segLen * 0.86,
            0.032,
            wBench - 0.10,
            { ry, r: 0.01 }
          );
        }
        // Rounded hemispherical concrete caps at both ends of the kidney bench
        for (const aEnd of [ang0, ang1]) {
          const ex = cx + Math.cos(aEnd) * radius;
          const ez = cz + Math.sin(aEnd) * radius;
          bTarget.cyl(mBenchConcreteDark, ex, yBase + 0.05, ez, (wBench - 0.12) * 0.5, 0.10);
          bTarget.cyl(mBenchUnderGlow, ex, yBase + 0.085, ez, (wBench - 0.05) * 0.5, 0.032);
          bTarget.cyl(mBenchConcrete, ex, yBase + 0.25, ez, wBench * 0.5, hBench - 0.10);
        }
        const aMid = (ang0 + ang1) * 0.5;
        S.lights.push([
          new THREE.Vector3(cx + Math.cos(aMid) * radius, yBase + 0.14, cz + Math.sin(aMid) * radius),
          '#ffda94',
          3.4,
          1.9
        ]);
      };

      // 1) Right Side Wall Amenities (Pulled FLUSH against right wall xR = 2.65 so > 75% central sidewalk corridor is 100% open):
      //    - Only 2 Slim Tree Planters (rPot = 0.28 -> 0.56m diameter <= 0.7m) tucked at the front-right & rear-right wall corners
      //    - Single Curved Bench hugging the right building wall (cx = 1.95, cz = 0.05, radius = 0.98 -> x = 2.84..2.93)
      addFlutedPlanter(b, 2.95, 1.38, 'maple', 0.28, 0.48, y0);
      addCurvedConcreteBench(b, 1.95, 0.05, 0.98, -0.42, 0.42, y0);
      addFlutedPlanter(b, 2.95, -2.25, 'bamboo_lavender', 0.28, 0.48, y0);

      // 5D) Helper: Boutique Menu / Lookbook Monolith Stand (Papan Monolit Menu/Lookbook)
      const addLookbookMonolith = (parentGrp, mx, mz, ry = 0, yBase = y0) => {
        const mg = new THREE.Group();
        mg.position.set(mx, yBase, mz);
        mg.rotation.y = ry;
        const bM = new Batch();
        // Stepped concrete/stone base plinth
        bM.box(mConcreteTrim, 0, 0.04, 0, 0.54, 0.08, 0.28, { r: 0.01 });
        bM.box(mLedBrassStrip, 0, 0.085, 0, 0.50, 0.015, 0.24);
        // Upright minimalist cream-stone monolith block (#E0DAD0)
        bM.box(mMonolithStone, 0, 0.55, 0, 0.46, 0.92, 0.18, { r: 0.015 });
        bM.box(mConcreteTrim, 0, 1.03, 0, 0.50, 0.045, 0.22, { r: 0.01 });
        // White poster panels ("ATELIER BOUTIQUE / LOOKBOOK") on front & back faces
        bM.panel(mBillboardSign, R.atelierLookbookStand, 0, 0.56, 0.096, 0.36, 0.72, 0, 0);
        bM.panel(mBillboardSign, R.atelierLookbookStand, 0, 0.56, -0.096, 0.36, 0.72, Math.PI, 0);
        bM.build(mg);
        parentGrp.add(mg);
      };

      // White Info Podium (Lookbook Monolith) positioned right at the front-right outer sidewalk lip (0.35m from curb, outside wavy brass strip!)
      addLookbookMonolith(g, 3.15, 5.08, 0, y0);

      // 5E) Helper: U-Loop Bike Racks (Rak Sepeda Pipa Besi Melengkung) aligned collinearly parallel to the outer curb
      const addULoopBikeRacks = (bTarget, rx, rz, ry = 0, count = 2, yBase = y0) => {
        const spacing = 0.64;
        const wLoop = 0.48, hLoop = 0.64, rTube = 0.022;
        for (let i = 0; i < count; i++) {
          const off = (i - (count - 1) * 0.5) * spacing;
          const cx0 = rx + Math.cos(ry) * off;
          const cz0 = rz - Math.sin(ry) * off;
          // Left & right vertical pipe legs + base flanges
          for (const s of [-1, 1]) {
            const lx = cx0 + Math.cos(ry) * (s * wLoop * 0.5);
            const lz = cz0 - Math.sin(ry) * (s * wLoop * 0.5);
            bTarget.cyl(mSteelBlack, lx, yBase + 0.015, lz, 0.048, 0.03);
            bTarget.cyl(mBikeRackMetal, lx, yBase + hLoop * 0.45, lz, rTube, hLoop * 0.9);
          }
          // Rounded top arch bar of the U-loop rack
          bTarget.box(mBikeRackMetal, cx0, yBase + hLoop - 0.02, cz0, wLoop + rTube * 1.6, rTube * 2.1, rTube * 2.1, {
            ry,
            r: 0.02
          });
          // Middle crossbar with brass accent collar
          bTarget.box(mBikeRackMetal, cx0, yBase + hLoop * 0.52, cz0, wLoop, rTube * 1.5, rTube * 1.5, { ry });
        }
      };

      // Single U-Loop Bike Rack aligned parallel right at the outer front sidewalk lip (0.35m from curb, outside the wavy brass strip!)
      addULoopBikeRacks(b, -2.15, 5.08, 0, 2, y0);

      // 5F) Helper: Modern Black Lantern Street Post (Tiang Lampu Jalan Hitam Bergaya Lentera Modern + Warm Downward PointLight)
      S.atelierLanternLights = [];
      const addModernLanternPost = (bTarget, lx, lz, yBase = y0) => {
        bTarget.cyl(mLampIron, lx, yBase + 0.12, lz, 0.13, 0.24);
        bTarget.cyl(mBrass, lx, yBase + 0.25, lz, 0.10, 0.025);
        bTarget.cyl(mLampIron, lx, yBase + 1.12, lz, 0.046, 1.74);
        bTarget.box(mLampIron, lx, yBase + 2.00, lz, 0.24, 0.04, 0.24);
        bTarget.box(M.lampBulb, lx, yBase + 2.16, lz, 0.18, 0.26, 0.18);
        for (const [dx, dz] of [[-0.09, -0.09], [0.09, -0.09], [-0.09, 0.09], [0.09, 0.09]]) {
          bTarget.box(mLampIron, lx + dx, yBase + 2.16, lz + dz, 0.024, 0.28, 0.024);
        }
        bTarget.add(mLampIron, unitCone, lx, yBase + 2.36, lz, 0.28, 0.16, 0.28);
        // Real THREE.PointLight (#FFD89B, intensity: 1.0, distance: 9, decay: 2.0) directly beneath each lantern head
        const lanternPl = addPolePointLight(g, lx, yBase + 1.96, lz, 1.0, '#FFD89B', 9, 2.0);
        S.atelierLanternLights.push(lanternPl);
        // Also register in custom shader lightPool so Curved Terrazzo & Aggregate Paving receives warm downward illumination
        S.lights.push([new THREE.Vector3(lx, yBase + 1.55, lz), '#FFD89B', 4.6, 2.2]);
      };

      // Exactly 4 Modern Black Lantern Street Posts at the 4 Outer Curb Corners of Store #3 (Atelier & Boutique, ~0.35m from outer curb edge)
      addModernLanternPost(b, -4.92, 4.92, y0);     // Front-Left Outer Curb Corner
      addModernLanternPost(b, 4.92, 4.92, y0);      // Front-Right Outer Curb Corner
      addModernLanternPost(bLot, -4.92, -4.92, y0); // Back-Left Outer Curb Corner
      addModernLanternPost(bLot, 4.92, -4.92, y0);  // Back-Right Outer Curb Corner

      // Build Full-Block Outer Lot Batch
      bLot.build(villageOuterLot);

      // Clean Queue Path on the front sidewalk
      S.queuePath = [
        [1.48, 2.25], [-2.20, 2.25], [-2.20, 3.10], [1.80, 3.10]
      ];
      b.build(g);

      const occluder = new THREE.Mesh(unitBox, linkProbe);
      occluder.visible = false;
      occluder.position.set(cxB, (H + 0.4) / 2, czB);
      occluder.scale.set(wB + 0.8, H + 0.4, dB + 0.8);
      occluder.userData.store = index;
      villageOuterLot.add(occluder);
      links.push(occluder);

      for (const L of S.lights) {
        g.localToWorld(L[0]);
        addLight(L[0], L[1], L[2], L[3], index);
      }
      S.focus = g.localToWorld(new THREE.Vector3(cxB, 2.85, 0.4));
      S.label = g.localToWorld(new THREE.Vector3(cxB, H + 0.85, czB));
      stores.push(S);
      return;
    }

    if (style === 'strawberry') {
      // Unified Superblock Granite Plaza & Curb are built continuously across Store #6 + Urban Pocket Park + Taman Ujung Kolam Ikan
      // in buildUrbanPocketPark at y = 0.163 (zero seam, zero height step, 100% flush!).
      const villageOuterLot = new THREE.Group();
      villageOuterLot.position.copy(g.position);
      villageOuterLot.rotation.copy(g.rotation);
      world.add(villageOuterLot);
      S.villageOuterLot = villageOuterLot;

      const mRed = mat('#c84b31', { roughness: 0.84 }, t);
      const mTeal = mat('#8fb9aa', { roughness: 0.78 }, t);
      const mTealDark = mat('#5c8c7d', { roughness: 0.8 }, t);
      const mCream = mat('#f4ecd8', { roughness: 0.86 }, t);
      const mCreamTrim = mat('#e5dac0', { roughness: 0.82 }, t);
      const mBrickAcc = mat('#cfb08c', { roughness: 0.9 }, t);
      const mBrickDark = mat('#b8946e', { roughness: 0.9 }, t);
      mBrickAcc.userData.noCast = true;
      mBrickAcc.userData.noReceive = true;
      mBrickDark.userData.noCast = true;
      mBrickDark.userData.noReceive = true;
      const mYellow = mat('#f6d04d', { roughness: 0.72 }, t);
      const mAwningWhite = mat('#fffdf5', { roughness: 0.75 }, t);
      const mBerry = mat('#d93829', { roughness: 0.52 }, t);
      const mSeed = mat('#f8e394', { roughness: 0.6 }, t);
      const mLeaf = mat('#3e7b3b', { roughness: 0.7, flatShading: true }, t);
      const mStem = mat('#2c5c29', { roughness: 0.78 }, t);
      const mIron = mat('#262423', { roughness: 0.5, metalness: 0.35 }, t);
      const mWoodFrame = mat('#4a3222', { roughness: 0.78 }, t);
      const mPot = mat('#b86843', { roughness: 0.82 }, t);
      const mCat = mat('#e07a38', { roughness: 0.8 }, t);
      const mBird = mat('#7c5841', { roughness: 0.82 }, t);
      const mLeafLight = mat('#8ab87a', { roughness: 0.72, flatShading: true }, t);

      // Living Wind & Ambient Animation Registries for Pos #6
      const windAffectedMeshes = [];
      const rooftopBirds = [];
      S.windAffectedMeshes = windAffectedMeshes;
      S.rooftopBirds = rooftopBirds;

      const regWind = (obj, kind = 'foliage', offset = windAffectedMeshes.length * 0.67) => {
        obj.userData = {
          ...obj.userData,
          basePosX: obj.position.x,
          basePosY: obj.position.y,
          basePosZ: obj.position.z,
          baseRotX: obj.rotation.x,
          baseRotY: obj.rotation.y,
          baseRotZ: obj.rotation.z,
          baseScaleX: obj.scale.x,
          baseScaleY: obj.scale.y,
          baseScaleZ: obj.scale.z,
          offset,
          kind
        };
        windAffectedMeshes.push(obj);
        return obj;
      };

      const addWindCrown = (m, x, y, z, sx, sy, sz, ry = 0, kind = 'foliage') => {
        const mesh = new THREE.Mesh(crownGeo, m);
        mesh.position.set(x, y, z);
        mesh.scale.set(sx, sy, sz);
        mesh.rotation.y = ry;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        g.add(mesh);
        return regWind(mesh, kind);
      };

      const addWindFlowerCluster = (x, y, z, rLeaf, rBerry, ry = 0) => {
        const fg = new THREE.Group();
        fg.position.set(x, y, z);
        const bFl = new Batch();
        bFl.crown(mLeaf, 0, 0, 0, rLeaf, rLeaf, rLeaf, ry);
        bFl.box(mBerry, 0.03, rLeaf * 0.42, 0.06, rBerry, rBerry, rBerry);
        bFl.build(fg);
        g.add(fg);
        return regWind(fg, 'foliage');
      };

      // --- LANTAI 1: RED CAFE STOREFRONT (#C84B31) ---
      const xL = -2.6, xR = 2.3, zB = -2.2, zF = 1.45;
      const w1 = xR - xL, d1 = zF - zB, cx1 = (xL + xR) / 2, cz1 = (zB + zF) / 2;
      const y0 = 0.180, h1 = 2.870, y1 = y0 + h1;

      // Isolated Stage Base (shown ONLY when inside Strawberry Corner isolated studio mode;
      // hidden in Ceria Town & Park mode so the Unified Granite Plaza at y = 0.180 is 100% seamless & flush!)
      const swX0 = -4.25, swX1 = 3.25, swZ0 = -2.65, swZ1 = 2.45;
      const swW = swX1 - swX0, swD = swZ1 - swZ0, swCX = (swX0 + swX1) / 2, swCZ = (swZ0 + swZ1) / 2;
      const mStrawberryGranite = mat('#F2E8D8', { roughness: 0.78 }, t);
      const mStrawberryCurb = mat('#D9CBB5', { roughness: 0.82 }, t);
      const mStrawberryStep = mat('#E5D8C3', { roughness: 0.80 }, t);
      const stageBaseGroup = new THREE.Group();
      stageBaseGroup.visible = false;
      const bStage = new Batch();
      bStage.box(mStrawberryCurb, swCX, 0.055, swCZ, swW + 0.24, 0.110, swD + 0.24, { r: 0.04 });
      bStage.box(mStrawberryStep, swCX, 0.125, swCZ, swW + 0.10, 0.050, swD + 0.10, { r: 0.03 });
      bStage.box(mStrawberryGranite, swCX, 0.165, swCZ, swW, 0.032, swD, { r: 0.02 });
      // Sidewalk paving joint lines on the warm cream diorama slab
      for (let px = -3.2; px <= 2.4; px += 1.4) {
        bStage.box(mStrawberryCurb, px, 0.182, 1.85, 0.025, 0.004, 0.95);
      }
      bStage.build(stageBaseGroup);
      g.add(stageBaseGroup);
      S.stageBaseGroup = stageBaseGroup;

      // Foundation plinth & main terracotta-red Ground Floor volume (recessed behind front/left windows so glass is -0.05m and backdrop is -0.21m)
      b.box(mCreamTrim, cx1, y0 + 0.09, cz1, w1 + 0.14, 0.18, d1 + 0.14);
      b.box(mRed, cx1 + 0.12, y0 + h1 / 2 + 0.05, cz1 - 0.12, w1 - 0.24, h1 - 0.1, d1 - 0.24, { r: 0.04 });
      // Outer Front (+Z at zF) & Left (-X at xL) Wall Facades around recessed window/door openings
      b.box(mRed, cx1, y0 + 0.46, zF - 0.12, w1, 0.72, 0.24);
      b.box(mRed, cx1, y0 + 2.54, zF - 0.12, w1, 0.66, 0.24);
      b.box(mRed, -2.34, y0 + 1.52, zF - 0.12, 0.52, 1.44, 0.24);
      b.box(mRed, -0.17, y0 + 1.52, zF - 0.12, 0.38, 1.44, 0.24);
      b.box(mRed, 2.02, y0 + 1.52, zF - 0.12, 0.56, 1.44, 0.24);
      b.box(mRed, xL + 0.12, y0 + h1 / 2 + 0.05, -1.52, 0.24, h1 - 0.1, 1.36);
      b.box(mRed, xL + 0.12, y0 + h1 / 2 + 0.05, 0.78, 0.24, h1 - 0.1, 1.34);
      b.box(mRed, xL + 0.12, y0 + 2.42, -0.35, 0.24, 0.90, 1.00);
      b.box(mRed, xL + 0.12, y0 + 0.50, -0.35, 0.24, 0.92, 1.00);

      // Front (+Z) 2 Large Storefront Windows:
      // Outer wall at zF -> Clear Glass at zF - 0.05 (-0.05m inward) -> Mullions at zF - 0.02 (+0.03m in front of glass) -> Interior Backdrop at zF - 0.21 (-0.16m behind glass)
      for (const wx of [-1.22, 0.88]) {
        // Teal lower wainscot panel (#8FB9AA) below the glass
        b.box(mTeal, wx, y0 + 0.48, zF + 0.02, 1.74, 0.56, 0.04);
        b.box(mTealDark, wx - 0.42, y0 + 0.48, zF + 0.05, 0.74, 0.38, 0.03);
        b.box(mTealDark, wx + 0.42, y0 + 0.48, zF + 0.05, 0.74, 0.38, 0.03);
        b.box(mCreamTrim, wx, y0 + 0.78, zF + 0.06, 1.84, 0.07, 0.08);
        // Warm interior light backdrop 0.16m (>= 0.15m) behind glass
        b.box(M.glowGlass, wx, y0 + 1.52, zF - 0.21, 1.70, 1.38, 0.02);
        // Clear window glass recessed 0.05m inward from outer wall (zF - 0.05)
        b.box(M.clearWinGlass, wx, y0 + 1.52, zF - 0.05, 1.72, 1.40, 0.016);
        // Outer dark timber frame & mullions at zF - 0.02 (+0.03m in front of glass)
        b.box(mWoodFrame, wx - 0.90, y0 + 1.22, zF - 0.02, 0.08, 2.12, 0.04);
        b.box(mWoodFrame, wx + 0.90, y0 + 1.22, zF - 0.02, 0.08, 2.12, 0.04);
        b.box(mWoodFrame, wx, y0 + 2.24, zF - 0.02, 1.88, 0.08, 0.04);
        b.box(mWoodFrame, wx, y0 + 1.52, zF - 0.02, 0.05, 1.42, 0.025);
        b.box(mWoodFrame, wx, y0 + 1.88, zF - 0.02, 1.74, 0.04, 0.025);
      }

      // Striped Yellow-and-White Slanted Awning over Front Storefront (Wind-Animated Group)
      const awW = 4.36, awX = -0.17, awN = 13, awS = awW / awN;
      const frontAwningGroup = new THREE.Group();
      frontAwningGroup.position.set(awX, y0 + 2.68, zF);
      const bFrontAwning = new Batch();
      for (let k = 0; k < awN; k++) {
        const sx = -awW / 2 + awS * (k + 0.5);
        const mStripe = k % 2 === 0 ? mYellow : mAwningWhite;
        bFrontAwning.box(mStripe, sx, -0.16, 0.48, awS + 0.005, 0.06, 0.96, { rx: 0.34 });
        // Scalloped rounded valance fringe at front lip
        bFrontAwning.box(mStripe, sx, -0.40, 0.92, awS * 0.96, 0.2, 0.05);
        bFrontAwning.cyl(mStripe, sx, -0.50, 0.92, awS * 0.48, 0.05, { rx: Math.PI / 2 });
      }
      bFrontAwning.build(frontAwningGroup);
      g.add(frontAwningGroup);
      regWind(frontAwningGroup, 'awning', 0.25);

      // Awning side iron support brackets
      for (const s of [-1, 1]) {
        b.box(mIron, awX + s * (awW / 2 - 0.05), y0 + 2.15, zF + 0.42, 0.04, 0.04, 0.84, { rx: -0.35 });
      }

      // Front Sidewalk: Wooden Bench + Ginger Cat, Small Cafe Table + Stool (pulled FLUSH against front wall zF = 1.45), Right Sign Pole & Vertical Greenery
      // 1. Wooden bench pulled FLUSH against the front left window wall (zF + 0.24 = 1.69)
      b.box(M.wood, -1.25, y0 + 0.28, zF + 0.24, 1.25, 0.06, 0.36);
      b.box(mIron, -1.72, y0 + 0.14, zF + 0.24, 0.06, 0.28, 0.32);
      b.box(mIron, -0.78, y0 + 0.14, zF + 0.24, 0.06, 0.28, 0.32);
      // Little ginger cat sitting on the wooden bench
      b.box(mCat, -1.25, y0 + 0.42, zF + 0.24, 0.2, 0.22, 0.18, { r: 0.04 });
      b.box(mCat, -1.25, y0 + 0.58, zF + 0.26, 0.18, 0.16, 0.16, { r: 0.04 });
      b.add(mCat, unitCone, -1.31, y0 + 0.69, zF + 0.26, 0.04, 0.08, 0.04);
      b.add(mCat, unitCone, -1.19, y0 + 0.69, zF + 0.26, 0.04, 0.08, 0.04);

      // 2. Outdoor Cafe Table & Seated Couple under the Yellow-and-White Striped Awning (matching 00:00 of the reference video!)
      const tblX = 0.72, tblZ = zF + 0.44;
      b.cyl(mAwningWhite, tblX, y0 + 0.56, tblZ, 0.34, 0.045);
      b.cyl(mIron, tblX, y0 + 0.28, tblZ, 0.038, 0.56);
      b.box(mIron, tblX, y0 + 0.02, tblZ, 0.32, 0.04, 0.32);
      // Coffee cups & strawberry shortcake plate on the outdoor table
      b.cyl(mAwningWhite, tblX - 0.11, y0 + 0.61, tblZ - 0.05, 0.055, 0.06);
      b.cyl(mAwningWhite, tblX + 0.11, y0 + 0.61, tblZ + 0.05, 0.055, 0.06);
      b.cyl(mCreamTrim, tblX, y0 + 0.595, tblZ + 0.04, 0.085, 0.02);
      b.box(mBerry, tblX, y0 + 0.63, tblZ + 0.04, 0.07, 0.06, 0.07);

      // Seated Couple at the Outdoor Cafe Table (Left Guest & Right Guest facing each other)
      const mSkin = mat('#F6CBA8', { roughness: 0.75 }, t);
      const mHairDark = mat('#2C1D16', { roughness: 0.82 }, t);
      const mHairAuburn = mat('#5A3424', { roughness: 0.80 }, t);
      const mSweaterSage = mat('#6A9889', { roughness: 0.82 }, t);
      const mSweaterCoral = mat('#D8524B', { roughness: 0.82 }, t);
      const mPantsDark = mat('#3A2E28', { roughness: 0.85 }, t);
      // Left Cafe Chair & Seated Character #1 (facing right +X)
      const chLX = tblX - 0.38, chLZ = tblZ;
      b.box(M.wood, chLX, y0 + 0.34, chLZ, 0.28, 0.04, 0.28);
      b.box(mIron, chLX - 0.12, y0 + 0.54, chLZ, 0.035, 0.38, 0.26);
      b.box(mIron, chLX, y0 + 0.17, chLZ, 0.22, 0.34, 0.22);
      b.box(mPantsDark, chLX + 0.06, y0 + 0.38, chLZ, 0.22, 0.10, 0.18, { r: 0.03 });
      b.box(mPantsDark, chLX + 0.14, y0 + 0.22, chLZ, 0.09, 0.26, 0.16, { r: 0.02 });
      b.box(mSweaterSage, chLX + 0.01, y0 + 0.58, chLZ, 0.18, 0.32, 0.22, { r: 0.04 });
      b.box(mSkin, chLX + 0.02, y0 + 0.84, chLZ, 0.19, 0.19, 0.19, { r: 0.05 });
      b.box(mHairDark, chLX + 0.01, y0 + 0.92, chLZ, 0.21, 0.09, 0.21, { r: 0.03 });
      // Right Cafe Chair & Seated Character #2 (facing left -X)
      const chRX = tblX + 0.38, chRZ = tblZ;
      b.box(M.wood, chRX, y0 + 0.34, chRZ, 0.28, 0.04, 0.28);
      b.box(mIron, chRX + 0.12, y0 + 0.54, chRZ, 0.035, 0.38, 0.26);
      b.box(mIron, chRX, y0 + 0.17, chRZ, 0.22, 0.34, 0.22);
      b.box(mPantsDark, chRX - 0.06, y0 + 0.38, chRZ, 0.22, 0.10, 0.18, { r: 0.03 });
      b.box(mPantsDark, chRX - 0.14, y0 + 0.22, chRZ, 0.09, 0.26, 0.16, { r: 0.02 });
      b.box(mSweaterCoral, chRX - 0.01, y0 + 0.57, chRZ, 0.18, 0.30, 0.22, { r: 0.04 });
      b.box(mSkin, chRX - 0.02, y0 + 0.82, chRZ, 0.185, 0.185, 0.185, { r: 0.05 });
      b.box(mHairAuburn, chRX - 0.01, y0 + 0.90, chRZ, 0.205, 0.10, 0.205, { r: 0.04 });
      b.box(mBerry, chRX - 0.04, y0 + 0.93, chRZ + 0.09, 0.05, 0.05, 0.05);
      S.coupleTableAnchor = new THREE.Vector3(tblX, y0 + 1.38, tblZ);

      // Wooden Barrel Planter on Front-Right Sidewalk Corner & A-Frame Chalkboard on Left Sidewalk
      b.cyl(M.wood, xR + 0.26, y0 + 0.24, zF + 0.28, 0.22, 0.44);
      addWindCrown(mLeaf, xR + 0.26, y0 + 0.56, zF + 0.28, 0.28, 0.28, 0.28, 1, 'foliage');
      b.box(mWoodFrame, xL - 0.48, y0 + 0.36, zF + 0.22, 0.08, 0.64, 0.42, { rz: 0.12 });
      b.box(mIron, xL - 0.46, y0 + 0.38, zF + 0.22, 0.10, 0.48, 0.34, { rz: 0.12 });

      // 3. Right-side vertical bush/greenery & tall strawberry sign post
      b.cyl(mIron, xR + 0.52, y0 + 1.15, zF + 0.15, 0.035, 2.3);
      b.box(mCream, xR + 0.52, y0 + 2.22, zF + 0.15, 0.36, 0.44, 0.08, { r: 0.03 });
      b.box(mTealDark, xR + 0.52, y0 + 2.36, zF + 0.15, 0.38, 0.1, 0.09);
      b.box(mBerry, xR + 0.52, y0 + 2.16, zF + 0.2, 0.12, 0.14, 0.03);
      for (const [gx, gy, gz, gr] of [
        [xR + 0.36, y0 + 0.35, zF + 0.1, 0.38],
        [xR + 0.38, y0 + 0.78, zF + 0.08, 0.32],
        [xR + 0.38, y0 + 1.18, zF + 0.06, 0.25],
        [xR + 0.38, y0 + 1.5, zF + 0.05, 0.18]
      ]) {
        addWindCrown(mLeaf, gx, gy, gz, gr, gr * 1.25, gr, 1, 'foliage');
      }

      // --- SIDE PROFILE (Left Facade at xL = -2.6): Teal Door, Striped Mini Awning, Chalkboard, Streetlamp ---
      const dzDoor = -0.35;
      // White molded door frame & Teal cafe door (#8FB9AA) — Clear Glass recessed at xL + 0.05, Mullions at xL + 0.02, Light Backdrop at xL + 0.21
      b.box(mCream, xL - 0.02, y0 + 1.05, dzDoor - 0.54, 0.04, 2.08, 0.10);
      b.box(mCream, xL - 0.02, y0 + 1.05, dzDoor + 0.54, 0.04, 2.08, 0.10);
      b.box(mCream, xL - 0.02, y0 + 2.04, dzDoor, 0.04, 0.10, 1.18);
      b.box(mTeal, xL + 0.01, y0 + 0.48, dzDoor, 0.04, 0.88, 0.96);
      b.box(mTeal, xL + 0.01, y0 + 1.45, dzDoor - 0.41, 0.04, 1.06, 0.14);
      b.box(mTeal, xL + 0.01, y0 + 1.45, dzDoor + 0.41, 0.04, 1.06, 0.14);
      b.box(mTeal, xL + 0.01, y0 + 1.92, dzDoor, 0.04, 0.12, 0.96);
      b.box(M.glowGlass, xL + 0.21, y0 + 1.42, dzDoor, 0.02, 0.88, 0.68);
      b.box(M.clearWinGlass, xL + 0.05, y0 + 1.42, dzDoor, 0.016, 0.88, 0.68);
      b.box(mWoodFrame, xL + 0.02, y0 + 1.42, dzDoor, 0.025, 0.88, 0.04);
      b.box(mWoodFrame, xL + 0.02, y0 + 1.42, dzDoor, 0.025, 0.04, 0.68);
      b.box(mCream, xL - 0.02, y0 + 0.45, dzDoor, 0.03, 0.56, 0.72);
      b.box(mCreamTrim, xL - 0.18, y0 + 0.05, dzDoor, 0.32, 0.1, 1.26);
      // Teal 'STRAWBERRY' plaque above door
      b.box(mCream, xL - 0.04, y0 + 2.34, dzDoor, 0.08, 0.36, 1.08);
      b.panel(M.sign, R.scSideSign, xL - 0.085, y0 + 2.34, dzDoor, 1.0, 0.3, -Math.PI / 2);
      // Small red-and-white striped awning over the side entrance (Wind-Animated)
      const sideAwningGroup = new THREE.Group();
      sideAwningGroup.position.set(xL, y0 + 2.78, dzDoor);
      const bSideAwning = new Batch();
      for (let k = 0; k < 7; k++) {
        const sz = -0.78 + k * 0.26;
        bSideAwning.box(k % 2 === 0 ? mRed : mAwningWhite, -0.32, -0.1, sz, 0.64, 0.05, 0.25, { rz: 0.32 });
      }
      bSideAwning.build(sideAwningGroup);
      g.add(sideAwningGroup);
      regWind(sideAwningGroup, 'awning', 1.6);

      // Small electric meter box beside door
      b.box(mCream, xL - 0.05, y0 + 1.08, dzDoor + 0.82, 0.1, 0.42, 0.24);
      // Potted plants flanking side entrance
      for (const pz of [dzDoor + 0.82, dzDoor + 1.22, dzDoor - 0.82]) {
        b.cyl(mIron, xL - 0.26, y0 + 0.18, pz, 0.16, 0.32);
        addWindCrown(mLeaf, xL - 0.26, y0 + 0.46, pz, 0.22, 0.26, 0.22, 2, 'foliage');
      }
      // Hanging strawberry basket on iron bracket at front-left corner (Pendulum Swing from top pivot)
      b.box(mIron, xL - 0.28, y0 + 2.25, zF - 0.2, 0.56, 0.04, 0.04);
      const cornerPotGroup = new THREE.Group();
      cornerPotGroup.position.set(xL - 0.48, y0 + 2.25, zF - 0.2);
      const bCornerPot = new Batch();
      bCornerPot.cyl(mIron, 0, -0.14, 0, 0.012, 0.28);
      bCornerPot.cyl(mPot, 0, -0.33, 0, 0.16, 0.16);
      bCornerPot.crown(mLeaf, 0, -0.21, 0, 0.2, 0.16, 0.2, 3);
      for (const [bx, bz] of [[-0.1, 0.08], [0.08, -0.08], [-0.04, -0.06]]) {
        bCornerPot.box(mBerry, bx, -0.43, bz, 0.07, 0.09, 0.07);
      }
      bCornerPot.build(cornerPotGroup);
      g.add(cornerPotGroup);
      regWind(cornerPotGroup, 'pendulum', 2.1);

      // Helper: Vintage Black Iron Streetlamp + Pendulum Hanging Strawberry Flower Pot for Store #6 (Strawberry Corner)
      const bOuterLot = new Batch();
      const addStrawberryCornerLamp = (lxLamp, lzLamp, ryLamp, targetBatch, targetGroup, windSeed) => {
        const cosL = Math.cos(ryLamp), sinL = Math.sin(ryLamp);
        targetBatch.cyl(mIron, lxLamp, y0 + 0.22, lzLamp, 0.14, 0.44);
        targetBatch.cyl(mIron, lxLamp, y0 + 1.45, lzLamp, 0.05, 2.6);
        targetBatch.box(mIron, lxLamp + cosL * 0.22, y0 + 1.65, lzLamp - sinL * 0.22, 0.44, 0.04, 0.04, { ry: ryLamp });
        const lampPotGroup = new THREE.Group();
        lampPotGroup.position.set(lxLamp + cosL * 0.38, y0 + 1.65, lzLamp - sinL * 0.38);
        const bLampPot = new Batch();
        bLampPot.cyl(mIron, 0, -0.10, 0, 0.012, 0.20);
        bLampPot.cyl(mPot, 0, -0.23, 0, 0.13, 0.12);
        bLampPot.crown(mLeaf, 0, -0.13, 0, 0.16, 0.12, 0.16, 1);
        bLampPot.box(mBerry, -0.08, -0.28, 0.04, 0.06, 0.07, 0.06);
        bLampPot.box(mBerry, 0.07, -0.27, -0.05, 0.06, 0.07, 0.06);
        bLampPot.build(lampPotGroup);
        targetGroup.add(lampPotGroup);
        regWind(lampPotGroup, 'pendulum', windSeed);
        targetBatch.box(M.lampBulb, lxLamp, y0 + 2.92, lzLamp, 0.28, 0.38, 0.28);
        targetBatch.add(mIron, unitCone, lxLamp, y0 + 3.22, lzLamp, 0.24, 0.22, 0.24);
        addPolePointLight(targetGroup, lxLamp, y0 + 2.75, lzLamp, 1.0, '#FFD89B', 9, 2.0);
        S.lights.push([new THREE.Vector3(lxLamp, y0 + 2.9, lzLamp), '#FFD89B', 4.2, 2.2]);
      };
      // 1 Single Classic Black Streetlamp on the Front-Left Diorama Sidewalk (matching 00:00 of the reference video!)
      addStrawberryCornerLamp(-3.48, 1.22, -Math.PI * 0.75, b, g, 0.6);
      // Outer Curb Streetlamps placed in villageOuterLot so they never float outside the diorama slab in isolated studio mode
      addStrawberryCornerLamp(-4.92, 4.92, -Math.PI * 0.75, bOuterLot, villageOuterLot, 0.9);
      addStrawberryCornerLamp(4.92, 4.92, -Math.PI * 0.25, bOuterLot, villageOuterLot, 1.7);
      addStrawberryCornerLamp(-4.92, -4.92, Math.PI * 0.75, bOuterLot, villageOuterLot, 2.5);
      addStrawberryCornerLamp(4.92, -4.92, Math.PI * 0.25, bOuterLot, villageOuterLot, 3.3);

      // --- SABUK PEMISAH: TEAL VINTAGE TRIM CORNICE (Between Floor 1 & Floor 2) ---
      const yTrim = y1;
      const hTrim = 0.56;
      b.box(mCreamTrim, cx1, yTrim + 0.06, cz1, w1 + 0.26, 0.12, d1 + 0.26);
      b.box(mTeal, cx1, yTrim + hTrim / 2, cz1, w1 + 0.16, hTrim - 0.16, d1 + 0.16);
      b.panel(M.sign, R.scTeal, cx1, yTrim + hTrim / 2, zF + 0.09, w1 + 0.12, hTrim - 0.2);
      b.panel(M.sign, R.scTeal, xL - 0.09, yTrim + hTrim / 2, cz1, d1 + 0.12, hTrim - 0.2, -Math.PI / 2);
      b.box(mCreamTrim, cx1, yTrim + hTrim - 0.05, cz1, w1 + 0.3, 0.12, d1 + 0.3);

      // --- LANTAI 2: CREAM TOWER (#F4ECD8) & SIDE BALCONY ---
      const y2 = yTrim + hTrim;
      const h2 = 3.28;
      const xTowerR = 0.92;
      const wTower = xTowerR - xL;
      const cxTower = (xL + xTowerR) / 2;

      // Main Cream Stucco Tower volume (recessed behind front & left windows so glass is -0.05m and light backdrop is -0.21m)
      const zWallF = zF - 0.04;
      b.box(mCream, cxTower + 0.12, y2 + h2 / 2, cz1 - 0.12, wTower - 0.24, h2, d1 - 0.32, { r: 0.04 });
      // Outer Front (+Z at zWallF) & Left (-X at xL) Cream Tower Facade around recessed arched window bays
      b.box(mCream, cxTower, y2 + 0.40, zWallF - 0.12, wTower, 0.80, 0.24);
      b.box(mCream, cxTower, y2 + 2.94, zWallF - 0.12, wTower, 0.68, 0.24);
      b.box(mCream, -1.82, y2 + 1.70, zWallF - 0.12, 1.56, 1.84, 0.24);
      b.box(mCream, 0.36, y2 + 1.70, zWallF - 0.12, 1.12, 1.84, 0.24);
      b.box(mCream, xL + 0.12, y2 + 0.46, cz1, 0.24, 0.92, d1 - 0.08);
      b.box(mCream, xL + 0.12, y2 + 2.66, cz1, 0.24, 1.24, d1 - 0.08);
      b.box(mCream, xL + 0.12, y2 + 1.48, -1.46, 0.24, 1.16, 1.48);
      b.box(mCream, xL + 0.12, y2 + 1.48, 0.72, 0.24, 1.16, 1.38);

      // Exposed brick accent clusters on Front (+Z at zWallF) & Left Side (-X at xL) facades (non-overlapping, +0.025 in front of wall)
      for (const [bx, by] of [
        [xL + 0.42, y2 + 2.58],
        [xL + 0.62, y2 + 1.56],
        [xL + 0.38, y2 + 0.56],
        [xTowerR - 0.38, y2 + 1.94],
        [xTowerR - 0.48, y2 + 0.50]
      ]) {
        b.box(mBrickAcc, bx, by, zWallF + 0.025, 0.34, 0.10, 0.02);
        b.box(mBrickDark, bx + 0.12, by - 0.13, zWallF + 0.025, 0.26, 0.09, 0.02);
      }
      for (const [bz, by] of [
        [zB + 0.55, y2 + 2.48],
        [zB + 0.78, y2 + 1.36],
        [zF - 0.52, y2 + 2.66],
        [zF - 0.58, y2 + 1.06]
      ]) {
        b.box(mBrickAcc, xL - 0.025, by, bz, 0.02, 0.10, 0.34);
        b.box(mBrickDark, xL - 0.025, by - 0.13, bz + 0.10, 0.02, 0.09, 0.26);
      }

      // Front Tall Arched Window on Cream Tower (+Z face, outer wall surface at zWallF = zF - 0.04)
      // Strict depth order: Wall (zWallF) -> Clear Glass (zWallF - 0.05) -> Frame/Mullions (zWallF - 0.02) -> Interior Light Backdrop (zWallF - 0.21, 0.16m behind glass)
      const axWin = -0.62, ayWin = y2 + 1.52;
      const archGlassShape = new THREE.Shape();
      archGlassShape.moveTo(-0.41, -0.72);
      archGlassShape.lineTo(0.41, -0.72);
      archGlassShape.lineTo(0.41, 0.68);
      archGlassShape.absarc(0, 0.68, 0.41, 0, Math.PI, false);
      archGlassShape.lineTo(-0.41, -0.72);
      const archGlassGeo = solid(new THREE.ExtrudeGeometry(archGlassShape, { depth: 0.016, bevelEnabled: false, curveSegments: 18 }));
      b.add(M.glowGlass, archGlassGeo, axWin, ayWin, zWallF - 0.21);
      b.add(M.clearWinGlass, archGlassGeo, axWin, ayWin, zWallF - 0.05);

      // Hollow Teal arch surround & jambs on outer wall surface
      const archTrimShape = new THREE.Shape();
      archTrimShape.absarc(0, 0, 0.56, 0, Math.PI, false);
      archTrimShape.lineTo(-0.42, 0);
      archTrimShape.absarc(0, 0, 0.42, Math.PI, 0, true);
      archTrimShape.closePath();
      const archTrimGeo = solid(new THREE.ExtrudeGeometry(archTrimShape, { depth: 0.04, bevelEnabled: false, curveSegments: 18 }));
      b.add(mTeal, archTrimGeo, axWin, ayWin + 0.68, zWallF + 0.01);
      b.box(mTeal, axWin - 0.49, ayWin - 0.02, zWallF + 0.03, 0.14, 1.40, 0.04);
      b.box(mTeal, axWin + 0.49, ayWin - 0.02, zWallF + 0.03, 0.14, 1.40, 0.04);

      // Dark Wood frame border & crossbars at zWallF - 0.02 (+0.03m in front of glass)
      b.box(mWoodFrame, axWin - 0.41, ayWin - 0.02, zWallF - 0.02, 0.05, 1.40, 0.025);
      b.box(mWoodFrame, axWin + 0.41, ayWin - 0.02, zWallF - 0.02, 0.05, 1.40, 0.025);
      b.box(mWoodFrame, axWin, ayWin + 0.68, zWallF - 0.02, 0.84, 0.05, 0.025);
      b.box(mWoodFrame, axWin, ayWin + 0.16, zWallF - 0.02, 0.82, 0.05, 0.025);
      b.box(mWoodFrame, axWin, ayWin + 0.18, zWallF - 0.02, 0.05, 1.80, 0.025);
      // Cream Window Box with Red Strawberry Flowers below Front Arched Window (Wind-Animated)
      b.box(mCream, axWin, y2 + 0.62, zF + 0.18, 1.18, 0.28, 0.32, { r: 0.03 });
      for (let k = -2; k <= 2; k++) {
        addWindFlowerCluster(axWin + k * 0.22, y2 + 0.82, zF + 0.2, 0.16, 0.08, k);
      }

      // Left Side Arched Window with Teal Louvered Shutters & Pitched Awning (-X face, wall at xL)
      // Strict depth order: Wall (xL) -> Clear Glass (xL + 0.05) -> Frame/Shutter (xL + 0.02) -> Interior Light Backdrop (xL + 0.21, 0.16m behind glass)
      const szWin = -0.35, syWin = y2 + 1.45;
      b.box(mCreamTrim, xL - 0.03, syWin, szWin - 0.43, 0.05, 1.12, 0.10);
      b.box(mCreamTrim, xL - 0.03, syWin, szWin + 0.43, 0.05, 1.12, 0.10);
      const sideArchShape = new THREE.Shape();
      sideArchShape.absarc(0, 0, 0.48, 0, Math.PI, false);
      sideArchShape.lineTo(-0.36, 0);
      sideArchShape.absarc(0, 0, 0.36, Math.PI, 0, true);
      sideArchShape.closePath();
      const sideArchGeo = solid(new THREE.ExtrudeGeometry(sideArchShape, { depth: 0.05, bevelEnabled: false, curveSegments: 16 }));
      sideArchGeo.rotateY(-Math.PI / 2);
      b.add(mCreamTrim, sideArchGeo, xL - 0.01, syWin + 0.52, szWin);
      // Interior warm light backdrop at xL + 0.21 (0.16m behind glass) & clear glass at xL + 0.05 (-0.05m recessed)
      b.box(M.glowGlass, xL + 0.21, syWin - 0.24, szWin, 0.02, 0.50, 0.72);
      b.box(M.clearWinGlass, xL + 0.05, syWin - 0.24, szWin, 0.016, 0.50, 0.72);
      // Teal upper shutter & dark wood mullions at xL + 0.02 (+0.03m in front of glass)
      b.box(mTeal, xL + 0.02, syWin + 0.26, szWin, 0.03, 0.48, 0.72);
      b.box(mWoodFrame, xL + 0.02, syWin, szWin - 0.36, 0.025, 1.04, 0.05);
      b.box(mWoodFrame, xL + 0.02, syWin, szWin + 0.36, 0.025, 1.04, 0.05);
      b.box(mWoodFrame, xL + 0.02, syWin - 0.24, szWin, 0.025, 0.50, 0.04);
      // Small striped awning on side window
      for (let k = 0; k < 5; k++) {
        b.box(k % 2 === 0 ? mRed : mAwningWhite, xL - 0.22, syWin + 0.04, szWin - 0.32 + k * 0.16, 0.36, 0.04, 0.15, { rz: 0.42 });
      }
      // Window box at base of left side tower wall (Wind-Animated)
      b.box(mCream, xL - 0.14, y2 + 0.16, szWin, 0.26, 0.22, 0.92);
      for (let k = -1; k <= 1; k++) {
        addWindFlowerCluster(xL - 0.16, y2 + 0.32, szWin + k * 0.26, 0.14, 0.07, k);
      }

      // Right Side Setback Balcony Terrace on Floor 2 (x from xTowerR to xR)
      const xBalcC = (xTowerR + xR) / 2, wBalc = xR - xTowerR;
      const zBalcWall = cz1 - 0.35 + (d1 - 0.78) / 2;
      // Recessed balcony wall & French door: Outer wall (zBalcWall) -> Clear Glass (zBalcWall - 0.05) -> Mullions (zBalcWall - 0.02) -> Light Backdrop (zBalcWall - 0.21)
      b.box(mCream, xBalcC, y2 + 1.12, cz1 - 0.47, wBalc - 0.04, 2.24, d1 - 1.02);
      b.box(mCream, xTowerR + 0.14, y2 + 1.12, zBalcWall - 0.12, 0.24, 2.24, 0.24);
      b.box(mCream, xR - 0.14, y2 + 1.12, zBalcWall - 0.12, 0.24, 2.24, 0.24);
      b.box(mCream, xBalcC, y2 + 2.02, zBalcWall - 0.12, wBalc - 0.04, 0.44, 0.24);
      b.box(mCreamTrim, xBalcC, y2 + 2.26, cz1 - 0.35, wBalc + 0.12, 0.16, d1 - 0.68);
      b.box(M.glowGlass, xBalcC, y2 + 0.96, zBalcWall - 0.21, 0.74, 1.66, 0.02);
      b.box(M.clearWinGlass, xBalcC, y2 + 0.96, zBalcWall - 0.05, 0.74, 1.66, 0.016);
      b.box(mWoodFrame, xBalcC - 0.39, y2 + 0.96, zBalcWall - 0.02, 0.06, 1.76, 0.03);
      b.box(mWoodFrame, xBalcC + 0.39, y2 + 0.96, zBalcWall - 0.02, 0.06, 1.76, 0.03);
      b.box(mWoodFrame, xBalcC, y2 + 1.81, zBalcWall - 0.02, 0.84, 0.06, 0.03);
      b.box(mWoodFrame, xBalcC, y2 + 0.96, zBalcWall - 0.02, 0.04, 1.66, 0.025);
      b.box(mWoodFrame, xBalcC, y2 + 1.05, zBalcWall - 0.02, 0.74, 0.04, 0.025);
      // Small Yellow-and-White Striped Awning over Balcony Door (Wind-Animated Group)
      const balcAwningGroup = new THREE.Group();
      balcAwningGroup.position.set(xBalcC, y2 + 2.0, zF - 0.66);
      const bBalcAwning = new Batch();
      for (let k = 0; k < 6; k++) {
        const bx = -0.5 + k * 0.2;
        bBalcAwning.box(k % 2 === 0 ? mYellow : mAwningWhite, bx, -0.12, 0.34, 0.2, 0.05, 0.68, { rx: 0.34 });
      }
      bBalcAwning.build(balcAwningGroup);
      g.add(balcAwningGroup);
      regWind(balcAwningGroup, 'awning', 1.15);

      // Black Wrought-Iron Balcony Railing (Front & Right Side with Complete Vertical Balusters + Corner Post) & Red Flower Boxes
      const xBalcR = xR - 0.02;
      const zBalcF = zF + 0.02;
      const wBalcRail = xBalcR - xTowerR;
      const dBalcSide = zBalcF - zBalcWall;
      const czBalcSide = (zBalcWall + zBalcF) * 0.5;
      // Front top & bottom rails
      b.box(mIron, (xTowerR + xBalcR) * 0.5, y2 + 0.52, zBalcF, wBalcRail + 0.04, 0.04, 0.04);
      b.box(mIron, (xTowerR + xBalcR) * 0.5, y2 + 0.04, zBalcF, wBalcRail + 0.04, 0.03, 0.03);
      // Right-side top & bottom rails (from balcony wall zBalcWall to front corner zBalcF)
      b.box(mIron, xBalcR, y2 + 0.52, czBalcSide, 0.04, 0.04, dBalcSide + 0.04);
      b.box(mIron, xBalcR, y2 + 0.04, czBalcSide, 0.03, 0.03, dBalcSide + 0.04);
      // Sturdy corner post & wall-anchor posts
      b.box(mIron, xBalcR, y2 + 0.27, zBalcF, 0.048, 0.54, 0.048);
      b.box(mIron, xTowerR + 0.02, y2 + 0.27, zBalcF, 0.045, 0.54, 0.045);
      b.box(mIron, xBalcR, y2 + 0.27, zBalcWall + 0.02, 0.045, 0.54, 0.045);
      // Front vertical balusters (every ~0.19m)
      const nBalcFront = 7;
      for (let k = 1; k < nBalcFront; k++) {
        b.box(mIron, xTowerR + (k * wBalcRail) / nBalcFront, y2 + 0.26, zBalcF, 0.03, 0.52, 0.03);
      }
      // Right-side vertical balusters (every ~0.19m from zBalcWall to zBalcF)
      const nBalcSide = 4;
      for (let k = 1; k < nBalcSide; k++) {
        b.box(mIron, xBalcR, y2 + 0.26, zBalcWall + (k * dBalcSide) / nBalcSide, 0.03, 0.52, 0.03);
      }
      for (let k = -1; k <= 1; k++) {
        addWindFlowerCluster(xBalcC + k * 0.36, y2 + 0.16, zBalcF, 0.16, 0.08, k);
      }
      // Terracotta potted plant standing firmly on the 2nd-floor balcony deck floor (y = y2, never floating!)
      b.cyl(mPot, xTowerR + 0.24, y2 + 0.14, zBalcWall + 0.24, 0.16, 0.28);
      addWindCrown(mLeaf, xTowerR + 0.24, y2 + 0.36, zBalcWall + 0.24, 0.21, 0.21, 0.21, 4, 'foliage');

      // --- ATAP: ROOFTOP GARDEN & GIANT 3D STRAWBERRY SCULPTURE ---
      const yRoof = y2 + h2;
      // Stepped Cream Cornice Cap around the top of the Tower
      b.box(mCreamTrim, cxTower, yRoof + 0.08, cz1, wTower + 0.22, 0.16, d1 + 0.14);
      b.box(mCream, cxTower, yRoof + 0.24, cz1, wTower + 0.34, 0.18, d1 + 0.26);
      b.box(mCreamTrim, cxTower, yRoof + 0.36, cz1, wTower + 0.26, 0.08, d1 + 0.18);
      const yDeck = yRoof + 0.4;

      // Rooftop Wrought-Iron Perimeter Railing (#262423)
      const rx0 = xL + 0.08, rx1 = xTowerR - 0.08, rz0 = zB + 0.12, rz1 = zF - 0.12;
      const rw = rx1 - rx0, rd = rz1 - rz0, rH = 0.46;
      b.box(mIron, cxTower, yDeck + rH, rz1, rw, 0.045, 0.045);
      b.box(mIron, cxTower, yDeck + rH, rz0, rw, 0.045, 0.045);
      b.box(mIron, rx0, yDeck + rH, cz1, 0.045, 0.045, rd);
      b.box(mIron, rx1, yDeck + rH, cz1, 0.045, 0.045, rd);
      for (let i = 0; i <= 6; i++) {
        const px = rx0 + (rw * i) / 6;
        b.box(mIron, px, yDeck + rH / 2, rz1, 0.035, rH, 0.035);
        b.box(mIron, px, yDeck + rH / 2, rz0, 0.035, rH, 0.035);
      }
      for (let i = 1; i < 6; i++) {
        const pz = rz0 + (rd * i) / 6;
        b.box(mIron, rx0, yDeck + rH / 2, pz, 0.035, rH, 0.035);
        b.box(mIron, rx1, yDeck + rH / 2, pz, 0.035, rH, 0.035);
      }

      // GIANT 3D STRAWBERRY SCULPTURE in the center of the Rooftop Garden
      const sbX = cxTower, sbY = yDeck - 0.05, sbZ = cz1;
      const sbScale = 1.08;
      const berryPts = [
        [0.0, 0.0],
        [0.36, 0.06],
        [0.64, 0.22],
        [0.86, 0.48],
        [1.02, 0.78],
        [1.06, 1.06],
        [0.96, 1.32],
        [0.72, 1.5],
        [0.36, 1.6],
        [0.0, 1.62]
      ].map(([r, y]) => new THREE.Vector2(r * sbScale, y * sbScale));
      const berryGeo = solid(new THREE.LatheGeometry(berryPts, 28));
      b.add(mBerry, berryGeo, sbX, sbY, sbZ);

      // Golden-cream strawberry seeds (achenes) arranged in a spiral over the berry surface
      const nSeeds = 52;
      for (let i = 0; i < nSeeds; i++) {
        const u = (i + 0.5) / nSeeds;
        const hNorm = 0.14 + u * 0.74;
        const ang = i * 2.39996;
        // Interpolate radius at hNorm
        const rNorm = Math.sin(Math.pow(hNorm, 0.72) * Math.PI) * 1.05 * sbScale;
        const sx = sbX + Math.cos(ang) * rNorm;
        const sy = sbY + hNorm * 1.6 * sbScale;
        const sz = sbZ + Math.sin(ang) * rNorm;
        b.box(mSeed, sx, sy, sz, 0.055, 0.08, 0.055, { ry: -ang, rx: 0.25 });
      }

      // Lush 8-leaf Green Calyx Crown & Stem on top of the Giant Strawberry
      const topY = sbY + 1.58 * sbScale;
      for (let k = 0; k < 8; k++) {
        const ang = (k / 8) * Math.PI * 2 + 0.2;
        const lx = sbX + Math.cos(ang) * 0.44 * sbScale;
        const lz = sbZ + Math.sin(ang) * 0.44 * sbScale;
        b.box(mLeaf, lx, topY - 0.02, lz, 0.34, 0.07, 0.68, { ry: ang, rx: 0.34, r: 0.02 });
      }
      b.cyl(mStem, sbX, topY + 0.18, sbZ, 0.06, 0.36, { rz: -0.22 });

      // 4 Corner Terracotta Potted Plants on Rooftop Garden (Wind-Animated)
      for (const [px, pz, k] of [
        [rx0 + 0.38, rz1 - 0.36, 0],
        [rx1 - 0.38, rz1 - 0.36, 1],
        [rx0 + 0.38, rz0 + 0.36, 2],
        [rx1 - 0.38, rz0 + 0.36, 3]
      ]) {
        b.cyl(mPot, px, yDeck + 0.14, pz, 0.18, 0.26);
        addWindCrown(mLeaf, px, yDeck + 0.34, pz, 0.22, 0.2, 0.22, k, 'foliage');
        if (k < 2) b.box(mBerry, px + 0.05, yDeck + 0.44, pz + 0.04, 0.08, 0.08, 0.08);
      }

      // 4 Rooftop Uplights / Curved Gooseneck Floodlights (like Pos #4's banner floodlights, brighter warm glow!)
      // aimed inward and upward at the Giant 3D Strawberry Mascot on the roof
      const mRoofSpotlightBulb = mat(
        '#FFF6DC',
        { emissive: '#FFD89B', emissiveIntensity: 1.55, roughness: 0.18 },
        t
      );
      bulbMaterials.push(mRoofSpotlightBulb);
      for (const [fx, fz, fYaw] of [
        [sbX - 1.18, rz1 - 0.10, -0.58],
        [sbX + 1.18, rz1 - 0.10, 0.58],
        [sbX - 1.18, rz0 + 0.10, -2.56],
        [sbX + 1.18, rz0 + 0.10, 2.56]
      ]) {
        const dirX = sbX - fx;
        const dirZ = sbZ - fz;
        const distXZ = Math.hypot(dirX, dirZ) || 1;
        const ux = dirX / distXZ;
        const uz = dirZ / distXZ;
        // Floodlight base pedestal & curved gooseneck bracket anchored to rooftop railing/deck
        b.box(mIron, fx, yDeck + 0.06, fz, 0.14, 0.12, 0.14);
        b.box(mIron, fx + ux * 0.16, yDeck + 0.26, fz + uz * 0.16, 0.045, 0.34, 0.045, {
          ry: fYaw,
          rx: -0.35
        });
        // Tilted floodlight hood & bright warm-golden lens aimed at the giant Strawberry
        b.box(mIron, fx + ux * 0.28, yDeck + 0.42, fz + uz * 0.28, 0.24, 0.10, 0.16, {
          ry: fYaw,
          rx: -0.52
        });
        b.box(mRoofSpotlightBulb, fx + ux * 0.31, yDeck + 0.44, fz + uz * 0.31, 0.20, 0.045, 0.12, {
          ry: fYaw,
          rx: -0.52
        });
      }
      // Dedicated warm rooftop spotlight illumination on the Giant Strawberry at night
      addPolePointLight(g, sbX, yDeck + 1.85, sbZ + 0.65, 1.25, '#FFD89B', 9.5, 1.8);
      S.lights.push([new THREE.Vector3(sbX, yDeck + 1.15, sbZ + 0.55), '#ffd89b', 5.2, 2.9]);
      S.lights.push([new THREE.Vector3(sbX, yDeck + 1.15, sbZ - 0.55), '#ffbe76', 4.6, 2.4]);

      // Lush Watercolor Green Trees Flanking Left & Right of the Diorama Building (matching 00:00 of the reference video!)
      for (const [tx, tz, ts] of [
        [-3.42, -0.75, 1.08],
        [2.68, -0.55, 0.98]
      ]) {
        b.cyl(M.wood, tx, y0 + 0.95 * ts, tz, 0.11 * ts, 1.85 * ts);
        [
          [0, 1.88, 0, 0.66],
          [-0.28, 1.54, 0.18, 0.52],
          [0.26, 1.60, -0.18, 0.50],
          [0.05, 2.34, 0.06, 0.48],
          [-0.18, 2.08, -0.22, 0.44]
        ].forEach(([dx, dy, dz, r], k) =>
          addWindCrown(k % 2 === 0 ? mLeaf : mLeafLight, tx + dx * ts, y0 + dy * ts, tz + dz * ts, r * ts, r * ts * 1.04, r * ts, k, 'foliage')
        );
      }

      // Rear Lot Trees placed in villageOuterLot so they never float outside the diorama slab in isolated studio mode
      const mConcretePlanter = mat('#C4C0B7', { roughness: 0.82 }, t);
      const mConcreteCoping = mat('#CECAC2', { roughness: 0.78 }, t);
      for (const [tx, tz, ts] of [
        [-3.85, -3.85, 0.86],
        [3.65, -3.85, 0.84]
      ]) {
        bOuterLot.box(mConcretePlanter, tx, y0 + 0.20, tz, 0.64, 0.40, 0.64);
        bOuterLot.box(mConcreteCoping, tx, y0 + 0.415, tz, 0.68, 0.03, 0.68);
        bOuterLot.cyl(M.wood, tx, 0.98, tz, 0.07 * ts, 1.25 * ts);
      }
      bOuterLot.build(villageOuterLot);

      // --- AMBIENT COMPANION GROUP: 35 Drifting Leaves & Petals + Rooftop Flying Critter ---
      // Kept in a companion group synced with Pos #6 so Box3 of strawberryBuildingGroup never changes!
      const ambientGroup = new THREE.Group();
      ambientGroup.position.copy(g.position);
      ambientGroup.rotation.copy(g.rotation);
      world.add(ambientGroup);
      S.ambientGroup = ambientGroup;

      // 1. 35 Drifting Watercolor Leaves & Strawberry Blossom Petals (fallingLeavesGroup)
      const fallingLeavesGroup = new THREE.Group();
      ambientGroup.add(fallingLeavesGroup);
      S.fallingLeavesGroup = fallingLeavesGroup;

      const leafShape = new THREE.Shape();
      leafShape.moveTo(-0.09, 0);
      leafShape.quadraticCurveTo(0, 0.058, 0.09, 0);
      leafShape.quadraticCurveTo(0, -0.058, -0.09, 0);
      const leafShapeGeo = new THREE.ShapeGeometry(leafShape, 5);
      const petalPlaneGeo = new THREE.PlaneGeometry(0.18, 0.11);

      const leafPalette = ['#8AB87A', '#689F63', '#F4A7B9', '#E05A47'].map(hex =>
        patch(new THREE.MeshStandardMaterial({ color: hex, roughness: 0.78, side: THREE.DoubleSide }), t)
      );

      for (let i = 0; i < 35; i++) {
        const isPetal = i % 4 >= 2;
        const leafMesh = new THREE.Mesh(isPetal ? petalPlaneGeo : leafShapeGeo, leafPalette[i % 4]);
        leafMesh.position.set(
          -4.6 + ((i * 1.93) % 8.4),
          0.6 + ((i * 0.44) % 14.8),
          -3.4 + ((i * 1.37) % 6.8)
        );
        leafMesh.rotation.set((i * 0.7) % Math.PI, (i * 1.1) % Math.PI, (i * 0.5) % Math.PI);
        leafMesh.userData = {
          speedY: 0.014 + (i % 7) * 0.0022,
          windDrift: 0.0045 + (i % 5) * 0.0014,
          phase: i * 0.58,
          rotSpeedX: 0.018 + (i % 4) * 0.006,
          rotSpeedY: 0.022 + (i % 5) * 0.005,
          rotSpeedZ: 0.015 + (i % 3) * 0.007,
          idx: i
        };
        fallingLeavesGroup.add(leafMesh);
      }

      // 2. Rooftop Flying Dragonfly / Small Bird circling the Giant Strawberry Tower top
      const flyerGroup = new THREE.Group();
      const flyerPivotY = yDeck + 1.25;
      flyerGroup.position.set(cxTower + 1.6, flyerPivotY, cz1 + 0.8);
      const mWing = patch(
        new THREE.MeshStandardMaterial({ color: '#FAF2E1', roughness: 0.5, transparent: true, opacity: 0.88, side: THREE.DoubleSide }),
        t
      );
      const bFlyer = new Batch();
      bFlyer.box(mBird, 0, 0, 0, 0.07, 0.06, 0.24, { r: 0.02 });
      bFlyer.box(mBird, 0, 0.02, 0.13, 0.08, 0.07, 0.08, { r: 0.02 });
      bFlyer.box(mYellow, 0, 0.02, 0.18, 0.03, 0.03, 0.04);
      bFlyer.build(flyerGroup);

      const wingGeo = new THREE.PlaneGeometry(0.24, 0.09);
      const wingL = new THREE.Mesh(wingGeo, mWing);
      wingL.position.set(-0.11, 0.02, 0.03);
      wingL.rotation.x = Math.PI / 2;
      const wingR = new THREE.Mesh(wingGeo, mWing);
      wingR.position.set(0.11, 0.02, 0.03);
      wingR.rotation.x = Math.PI / 2;
      flyerGroup.add(wingL, wingR);

      flyerGroup.userData = {
        cx: cxTower,
        cy: flyerPivotY,
        cz: cz1,
        wingL,
        wingR
      };
      ambientGroup.add(flyerGroup);
      S.rooftopFlyer = flyerGroup;

      S.lights.push(
        [new THREE.Vector3(-1.2, 1.5, zF + 0.9), '#ffbe76', 4.2, 2.8],
        [new THREE.Vector3(0.9, 1.5, zF + 0.9), '#ffbe76', 4.2, 2.8],
        [new THREE.Vector3(xL - 0.8, 1.5, dzDoor), '#ffbe76', 3.5, 2.0]
      );
      S.queuePath = [[0.5, 2.2], [-2.8, 2.2], [-2.8, 3.0], [1.2, 3.0], [1.2, 3.8], [-3.2, 3.8]];
      b.build(g);

      // Attach Crisp Hand-Inked Dark Espresso Outlines (#2B1E18) for 1:1 Storybook Watercolor Look
      const inkLineMat = new THREE.LineBasicMaterial({
        color: '#2B1E18',
        transparent: true,
        opacity: 0.56
      });
      const meshesToOutline = [];
      g.traverse(child => {
        if (child.isMesh && child.geometry) {
          meshesToOutline.push(child);
        }
      });
      for (const meshObj of meshesToOutline) {
        try {
          const edgesGeo = new THREE.EdgesGeometry(meshObj.geometry, 28);
          const edgeLines = new THREE.LineSegments(edgesGeo, inkLineMat);
          edgeLines.renderOrder = 2;
          meshObj.add(edgeLines);
        } catch {
          // Ignore geometries that cannot generate edges
        }
      }

      const occluder = new THREE.Mesh(unitBox, linkProbe);
      occluder.visible = false;
      occluder.position.set(cx1, (H + 0.5) / 2, cz1);
      occluder.scale.set(w1 + 0.6, H + 0.5, d1 + 0.6);
      occluder.userData.store = index;
      villageOuterLot.add(occluder);
      links.push(occluder);

      for (const L of S.lights) {
        g.localToWorld(L[0]);
        addLight(L[0], L[1], L[2], L[3], index);
      }
      S.focus = g.localToWorld(new THREE.Vector3(-0.35, 3.4, 0.2));
      S.label = g.localToWorld(new THREE.Vector3(-0.6, H + 1.8, -0.5));
      stores.push(S);
      return;
    }

    if (style === 'mayor') {
      // ======================================================================
      // POS #7: MAYOR'S OFFICE & FAN-PATTERN PORPHYRY PROMENADE + STONE BALUSTRADE
      // 100% Unified Full-Block Sidewalk & Classical Civic Streetscape:
      // 1) Fan-Pattern Porphyry & Granite Pavers (#B8A398, #9E897E, #C7B6AC) in
      //    overlapping European peacock-fan arches + Bronze Commemorative Seal Inlay
      //    at a single unified seamless elevation (y0 = 0.220) across the entire block!
      // 2) Curved Stone Retaining Balustrade (bottle-profile stone balusters) +
      //    Hydrangea (pastel blue-violet & soft pink) & Lavender Planters + Flush Uplighting
      // 3) Forest-Green Cast-Iron & Wood Benches (#2F4F38) & Freestanding Wooden Civic Info Kiosk
      // 4) Carved Stone Fountain with Bronze Lion-Head Spigot, Vintage Green Municipal
      //    Pillar Letterbox, and Classic Black Wrought-Iron Street Lamps with Hanging Flower Baskets
      // ======================================================================
      const mayorPorphyryFanTex = (() => {
        const S = 512;
        const c = document.createElement('canvas');
        c.width = c.height = S;
        const ctx = c.getContext('2d');
        // Deep porphyry mortar joint background
        ctx.fillStyle = '#5E514B';
        ctx.fillRect(0, 0, S, S);

        const stonePalette = ['#B8A398', '#9E897E', '#C7B6AC', '#A99489', '#8E796F', '#C1AEA3', '#968176'];
        const fanCols = 2;
        const fanRows = 4;
        const fanW = S / fanCols; // 256
        const rowH = S / fanRows; // 128
        const maxR = fanW * 0.58; // 148.5
        const rings = 7;
        const ringStep = maxR / rings;

        const drawFan = (cx, cy, seedBase) => {
          // Dark mortar backing behind the entire fan
          ctx.fillStyle = '#5A4D47';
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.arc(cx, cy, maxR + 2, -Math.PI * 0.92, -Math.PI * 0.08, false);
          ctx.closePath();
          ctx.fill();

          // Concentric stone cobble rings from outer to inner
          for (let rIdx = rings; rIdx >= 1; rIdx--) {
            const rOuter = rIdx * ringStep - 1.6;
            const rInner = Math.max(0, (rIdx - 1) * ringStep + 1.6);
            const arcSpan = Math.PI * 0.84;
            const aStart0 = -Math.PI * 0.5 - arcSpan * 0.5;
            const numStones = Math.max(4, Math.round((rOuter * arcSpan) / 18));
            const dA = arcSpan / numStones;
            const gapA = Math.min(dA * 0.14, 1.8 / Math.max(18, rOuter));

            for (let sIdx = 0; sIdx < numStones; sIdx++) {
              const a0 = aStart0 + sIdx * dA + gapA;
              const a1 = aStart0 + (sIdx + 1) * dA - gapA;
              const hSeed = Math.abs(Math.sin((seedBase + rIdx * 17 + sIdx * 31) * 12.9898) * 43758.5453);
              const col = stonePalette[Math.floor((hSeed % 1) * stonePalette.length)];
              ctx.fillStyle = col;
              ctx.beginPath();
              ctx.arc(cx, cy, rOuter, a0, a1, false);
              if (rInner > 2) {
                ctx.arc(cx, cy, rInner, a1, a0, true);
              } else {
                ctx.lineTo(cx, cy);
              }
              ctx.closePath();
              ctx.fill();

              // Subtle top-left bevel highlight on each porphyry cobble
              ctx.strokeStyle = 'rgba(255, 245, 238, 0.24)';
              ctx.lineWidth = 1.2;
              ctx.beginPath();
              ctx.arc(cx, cy, rOuter - 1.2, a0, a1, false);
              ctx.stroke();
            }
          }
        };

        // Draw overlapping European peacock-fan rows (staggered half-width each row, wrapped seamlessly across 512x512)
        for (let r = -1; r <= fanRows + 1; r++) {
          const isOdd = ((r % 2) + 2) % 2 === 1;
          const cy = r * rowH + rowH * 0.95;
          for (let col = -1; col <= fanCols + 1; col++) {
            const cx = col * fanW + (isOdd ? fanW * 0.5 : 0);
            drawFan(cx, cy, r * 100 + col * 19);
          }
        }

        // Subtle porphyry mineral speckle across the surface
        for (let i = 0; i < 900; i++) {
          const sx = (Math.sin(i * 78.233) * 0.5 + 0.5) * S;
          const sy = (Math.cos(i * 45.164) * 0.5 + 0.5) * S;
          ctx.fillStyle = i % 2 === 0 ? 'rgba(255,248,242,0.08)' : 'rgba(62,48,42,0.09)';
          ctx.fillRect(sx, sy, 2, 2);
        }

        const tex = new THREE.CanvasTexture(c);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(0.42, 0.42);
        tex.anisotropy = 8;
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
      })();

      const y0 = 0.180; // Unified seamless sidewalk & promenade top surface across the entire Mayor's Office block
      const villageOuterLot = new THREE.Group();
      villageOuterLot.position.copy(g.position);
      villageOuterLot.rotation.copy(g.rotation);
      world.add(villageOuterLot);

      const mMayorCurb = mat('#DFD0B4', { roughness: 0.65 }, t);
      const mMayorPorphyry = mat('#FFFFFF', { map: mayorPorphyryFanTex, roughness: 0.65 }, t);
      const bLot = new Batch();
      // Unified Continuous Full-Block Fan-Pattern Porphyry Sidewalk Superblock ((PITCH + BLOCK) x 11.00, cornerRadius = 1.2)
      // Hollow outer curb top at y = 0.190, flat solid porphyry base at y = 0.180, yellow tactile paving at y = 0.195!
      bLot.add(mMayorCurb, hollowCurbRingGeo(PITCH + BLOCK, BLOCK, 1.2, 0.14, 0.190), -A, 0, 0);
      bLot.add(mMayorPorphyry, roundedRectGeometry(PITCH + BLOCK - 0.28, BLOCK - 0.28, 1.06, 0.180), -A, 0, 0);
      bLot.add(M.tactileYellow, hollowCurbRingGeo(PITCH + BLOCK - 0.36, BLOCK - 0.36, 1.02, 0.12, 0.015), -A, 0.180, 0);

      const mPlaster = mat('#F2E5C8', { roughness: 0.86 }, t);
      const mPlasterTrim = mat('#DFD0B4', { roughness: 0.82 }, t);
      const mColumnStone = mat('#EFE3CA', { roughness: 0.78 }, t);
      const mQuoin = mat('#C98A63', { roughness: 0.84 }, t);
      const mBrickDark = mat('#B2714B', { roughness: 0.86 }, t);
      mQuoin.userData.noCast = true;
      mQuoin.userData.noReceive = true;
      mBrickDark.userData.noCast = true;
      mBrickDark.userData.noReceive = true;
      const mSage = mat('#8FA38A', { roughness: 0.78 }, t);
      const mSageDark = mat('#6E8469', { roughness: 0.82 }, t);
      // Slate Blue Roof (#6E828A) with Procedural Slate Shingle Texture & BumpMap
      const mSlateRoof = mat(
        '#9FB2BA',
        {
          map: slateShingleTex,
          bumpMap: slateShingleBumpTex,
          bumpScale: 0.038,
          roughness: 0.74
        },
        t
      );
      const mSlateTrim = mat('#53666E', { roughness: 0.74 }, t);
      const mOakDoor = mat('#9B6B43', { roughness: 0.78 }, t);
      const mOakDark = mat('#6A4428', { roughness: 0.82 }, t);
      const mWhiteFrame = mat('#FAF5EB', { roughness: 0.72 }, t);
      const mGoldBell = mat('#E5B548', { roughness: 0.30, metalness: 0.68 }, t);
      const mBronzeAged = mat('#9E7339', { roughness: 0.36, metalness: 0.65 }, t);
      const mBronzeDark = mat('#664820', { roughness: 0.44, metalness: 0.58 }, t);
      const mIronBlack = mat('#222628', { roughness: 0.44, metalness: 0.48 }, t);
      const mForestGreen = mat('#2E4F38', { roughness: 0.66, metalness: 0.12 }, t);
      const mForestGreenLight = mat('#3B6347', { roughness: 0.68, metalness: 0.10 }, t);
      const mSoilDark = mat('#4E3A2A', { roughness: 0.94 }, t);
      const mWater = mat('#64B8C9', { roughness: 0.15, metalness: 0.22, emissive: '#2B6E80', emissiveIntensity: 0.40 }, t);
      const mBush = mat('#4E8547', { roughness: 0.74, flatShading: true }, t);
      const mBushLight = mat('#79AB67', { roughness: 0.74, flatShading: true }, t);
      // Hydrangea & Lavender palette matching the Mayor's Office concept sheet
      const mHydrangeaBlue = mat('#859AE0', { roughness: 0.64 }, t);
      const mHydrangeaSky = mat('#9EB2EE', { roughness: 0.64 }, t);
      const mHydrangeaViolet = mat('#A28AE0', { roughness: 0.64 }, t);
      const mHydrangeaPink = mat('#E495AC', { roughness: 0.64 }, t);
      const mHydrangeaSoftPink = mat('#F0B2C4', { roughness: 0.64 }, t);
      const mLavenderPurple = mat('#7C56B8', { roughness: 0.66 }, t);
      const mLavenderLight = mat('#9A72D4', { roughness: 0.66 }, t);
      const mFlowerPink = mat('#E57A84', { roughness: 0.65 }, t);
      const mFlowerYellow = mat('#F4CC5C', { roughness: 0.65 }, t);
      const mFlowerWhite = mat('#FFF9EE', { roughness: 0.65 }, t);
      const mRoosterRed = mat('#C84B31', { roughness: 0.68 }, t);
      const mMayorSealPanel = mat(
        '#FFFFFF',
        {
          map: atlas.tex,
          roughness: 0.36,
          metalness: 0.55,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2
        },
        t
      );
      mMayorSealPanel.userData.noCast = true;
      const mMayorNoticePanel = mat(
        '#FFFDF7',
        {
          map: atlas.tex,
          emissive: '#FFE8BA',
          emissiveMap: atlas.tex,
          emissiveIntensity: 0.55,
          roughness: 0.45,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2
        },
        t
      );
      mMayorNoticePanel.userData.noCast = true;

      const windAffectedMeshes = [];
      S.windAffectedMeshes = windAffectedMeshes;
      const registerWindMesh = (mesh, offset, kind = 'foliage', targetGroup = g) => {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = {
          basePosX: mesh.position.x,
          basePosY: mesh.position.y,
          basePosZ: mesh.position.z,
          baseRotX: mesh.rotation.x,
          baseRotY: mesh.rotation.y,
          baseRotZ: mesh.rotation.z,
          baseScaleX: mesh.scale.x,
          baseScaleY: mesh.scale.y,
          baseScaleZ: mesh.scale.z,
          offset,
          kind
        };
        targetGroup.add(mesh);
        windAffectedMeshes.push(mesh);
      };

      // ----------------------------------------------------------------------
      // 1. ISOLATED STAGE BASE (stageBaseGroup: hidden in Town View so the
      //    entire block is 100% seamless & flat at y0 = 0.220, shown only when
      //    Mayor's Office is isolated in Member & CS View!)
      // ----------------------------------------------------------------------
      const stageBaseGroup = new THREE.Group();
      stageBaseGroup.visible = false;
      g.add(stageBaseGroup);
      S.stageBaseGroup = stageBaseGroup;
      const bStage = new Batch();
      bStage.add(mMayorCurb, hollowCurbRingGeo(8.56, 7.10, 0.75, 0.10, 0.190), 0, 0, -0.80);
      bStage.add(mMayorPorphyry, roundedRectGeometry(8.36, 6.90, 0.68, 0.180), 0, 0, -0.80);
      bStage.build(stageBaseGroup);

      // ----------------------------------------------------------------------
      // REUSABLE MAYOR'S OFFICE BLOCK AMENITY HELPERS (Used around the building
      // in `b`/`g` AND across the entire block in `bPark`/`townParkGroup` & `bLot`)
      // ----------------------------------------------------------------------
      // Helper 1A: Commemorative Bronze Civic Seal Inlay (Medali Segel Kota Perunggu)
      const addCommemorativeSealInlay = (targetBatch, sx, sz, rSeal = 0.48, ry = 0) => {
        // Cleanly stacked non-overlapping heights above y0 = 0.180
        const frameW = rSeal * 2.18;
        targetBatch.box(mColumnStone, sx, y0 + 0.003, sz, frameW, 0.006, frameW, { ry, r: 0.01 });
        targetBatch.box(mPlasterTrim, sx, y0 + 0.009, sz, frameW * 0.90, 0.006, frameW * 0.90, {
          ry: ry + Math.PI / 4,
          r: 0.01
        });
        // Outer & inner raised bronze medallion bezel rings (strictly stacked in Y)
        targetBatch.cyl(mBronzeDark, sx, y0 + 0.015, sz, rSeal * 0.96, 0.006);
        targetBatch.cyl(mGoldBell, sx, y0 + 0.021, sz, rSeal * 0.90, 0.006);
        targetBatch.cyl(mBronzeAged, sx, y0 + 0.027, sz, rSeal * 0.82, 0.006);
        // High-res Commemorative Seal panel on top + 3D raised central civic crest relief
        targetBatch.panel(mMayorSealPanel, R.mayorCivicSeal, sx, y0 + 0.032, sz, rSeal * 1.72, rSeal * 1.72, ry, -Math.PI / 2);
        targetBatch.cyl(mGoldBell, sx, y0 + 0.036, sz, rSeal * 0.24, 0.006);
        targetBatch.box(mGoldBell, sx, y0 + 0.042, sz, rSeal * 0.22, 0.006, rSeal * 0.28, { ry });
      };

      // Helper 2A: Single Carved Bottle-Profile Stone Baluster (Tiang Baluster Profil Botol)
      const addStoneBaluster = (targetBatch, bx, by, bz) => {
        // Square lower base block
        targetBatch.box(mPlasterTrim, bx, by + 0.025, bz, 0.095, 0.05, 0.095);
        // Lower molded ring
        targetBatch.cyl(mColumnStone, bx, by + 0.065, bz, 0.044, 0.03);
        // Tapered bottle belly (classic rounded bulb)
        targetBatch.sphere(mColumnStone, bx, by + 0.135, bz, 0.052);
        // Slender upper bottle neck
        targetBatch.cyl(mColumnStone, bx, by + 0.215, bz, 0.028, 0.11);
        // Upper echinus collar & square abacus cap
        targetBatch.cyl(mColumnStone, bx, by + 0.280, bz, 0.044, 0.025);
        targetBatch.box(mPlasterTrim, bx, by + 0.305, bz, 0.095, 0.03, 0.095);
      };

      // Helper 2B: Carved Stone Balustrade Pier with Molded Cap (Pilar Sudut Batu Langkan)
      const addBalustradePier = (targetBatch, px, py, pz, ry = 0, withFinial = true) => {
        targetBatch.box(mPlasterTrim, px, py + 0.06, pz, 0.28, 0.12, 0.28, { ry, r: 0.01 });
        targetBatch.box(mColumnStone, px, py + 0.27, pz, 0.23, 0.32, 0.23, { ry, r: 0.01 });
        // Recessed panel detail on pier faces
        targetBatch.box(mPlasterTrim, px, py + 0.27, pz, 0.245, 0.20, 0.15, { ry });
        targetBatch.box(mPlasterTrim, px, py + 0.27, pz, 0.15, 0.20, 0.245, { ry });
        // Overhanging molded pier cap
        targetBatch.box(mColumnStone, px, py + 0.455, pz, 0.29, 0.055, 0.29, { ry, r: 0.01 });
        targetBatch.box(mPlasterTrim, px, py + 0.495, pz, 0.24, 0.035, 0.24, { ry, r: 0.01 });
        if (withFinial) {
          targetBatch.cyl(mColumnStone, px, py + 0.535, pz, 0.065, 0.045);
          targetBatch.sphere(mColumnStone, px, py + 0.595, pz, 0.072);
        }
      };

      // Helper 2C: Hydrangea Pom-Pom Cluster + Lavender Spikes + Flush Uplighting
      const addHydrangeaCluster = (targetBatch, targetGroup, hx, hy, hz, colorMode = 0, scale = 1.0, seed = 0) => {
        // Foliage cushion base
        const bushMesh = new THREE.Mesh(crownGeo, seed % 2 === 0 ? mBush : mBushLight);
        bushMesh.position.set(hx, hy, hz);
        bushMesh.scale.set(0.23 * scale, 0.19 * scale, 0.23 * scale);
        registerWindMesh(bushMesh, seed, 'foliage', targetGroup);

        // Multi-sphere pastel Hydrangea pom-pom blooms
        const mMain =
          colorMode === 0
            ? mHydrangeaBlue
            : colorMode === 1
              ? mHydrangeaPink
              : colorMode === 2
                ? mHydrangeaViolet
                : mHydrangeaSky;
        const mSub =
          colorMode === 0
            ? mHydrangeaSky
            : colorMode === 1
              ? mHydrangeaSoftPink
              : colorMode === 2
                ? mHydrangeaBlue
                : mHydrangeaSoftPink;

        const puffs = [
          [0, 0.12, 0, 0.082],
          [-0.08, 0.09, 0.06, 0.068],
          [0.08, 0.10, 0.05, 0.070],
          [0.02, 0.09, -0.07, 0.066],
          [-0.06, 0.11, -0.05, 0.064]
        ];
        puffs.forEach(([dx, dy, dz, rad], idx) => {
          targetBatch.sphere(
            idx % 2 === 0 ? mMain : mSub,
            hx + dx * scale,
            hy + dy * scale,
            hz + dz * scale,
            rad * scale
          );
        });
      };

      const addLavenderStalks = (targetBatch, lx, ly, lz, count = 5, spread = 0.16) => {
        for (let i = 0; i < count; i++) {
          const ang = (i / count) * Math.PI * 2 + i * 0.5;
          const r = (i === 0 ? 0.02 : spread * (0.55 + (i % 2) * 0.35));
          const sx = lx + Math.cos(ang) * r;
          const sz = lz + Math.sin(ang) * r;
          const hStalk = 0.22 + (i % 3) * 0.04;
          // Green stem
          targetBatch.cyl(mBush, sx, ly + hStalk * 0.45, sz, 0.012, hStalk * 0.9);
          // Tiered purple lavender flower spike
          const mLav = i % 2 === 0 ? mLavenderPurple : mLavenderLight;
          targetBatch.cyl(mLav, sx, ly + hStalk + 0.04, sz, 0.026, 0.11);
          targetBatch.sphere(mLav, sx, ly + hStalk + 0.10, sz, 0.022);
        }
      };

      const addFlushUplight = (targetBatch, ux, uy, uz, lightRange = 2.6, lightInt = 1.9) => {
        targetBatch.cyl(mBronzeDark, ux, uy + 0.008, uz, 0.078, 0.016);
        targetBatch.cyl(mGoldBell, ux, uy + 0.014, uz, 0.064, 0.014);
        targetBatch.cyl(M.bulb, ux, uy + 0.020, uz, 0.046, 0.012);
        S.lights.push([new THREE.Vector3(ux, uy + 0.14, uz), '#ffd28a', lightRange, lightInt]);
      };

      // Helper 2D: Curved Stone Retaining Balustrade + Hydrangea/Lavender Planter flanking the Mayor's Office Front
      const addFrontCurvedBalustradePlanter = (targetBatch, targetGroup, sideSign) => {
        // Inner pier next to porch steps cheek wall (x = ±1.44, z = 1.46)
        const xInner = sideSign * 1.44;
        const zFrontRail = 1.46;
        addBalustradePier(targetBatch, xInner, y0, zFrontRail, 0, true);

        // Straight front balustrade run from x = ±1.44 to x = ±3.02 at z = 1.46
        const xCurveStart = sideSign * 3.02;
        const xMid = (xInner + xCurveStart) * 0.5;
        const frontLen = Math.abs(xCurveStart - xInner);
        // Molded stone base plinth & top coping rail
        targetBatch.box(mPlasterTrim, xMid, y0 + 0.06, zFrontRail, frontLen, 0.12, 0.22, { r: 0.01 });
        targetBatch.box(mColumnStone, xMid, y0 + 0.125, zFrontRail, frontLen + 0.04, 0.03, 0.25, { r: 0.01 });
        targetBatch.box(mColumnStone, xMid, y0 + 0.455, zFrontRail, frontLen + 0.04, 0.055, 0.26, { r: 0.01 });
        targetBatch.box(mPlasterTrim, xMid, y0 + 0.490, zFrontRail, frontLen, 0.025, 0.21, { r: 0.01 });
        // 6 carved bottle-profile stone balusters along the straight front section
        for (let k = 1; k <= 6; k++) {
          const bx = xInner + sideSign * (0.20 + (k - 1) * 0.235);
          addStoneBaluster(targetBatch, bx, y0 + 0.13, zFrontRail);
        }

        // Middle transition pier at the start of the corner curve (x = ±3.02, z = 1.46)
        addBalustradePier(targetBatch, xCurveStart, y0, zFrontRail, 0, false);

        // Sweeping 90-degree Curved Stone Retaining Balustrade wrapping around the front-side corner
        // Arc center at (sideSign * 3.02, z = 0.56), radius = 0.90 -> curves from (sideSign*3.02, 1.46) to (sideSign*3.92, 0.56)
        const arcCx = sideSign * 3.02;
        const arcCz = 0.56;
        const arcR = 0.90;
        const arcSegs = 6;
        for (let s = 0; s < arcSegs; s++) {
          const a0 = (s / arcSegs) * (Math.PI * 0.5);
          const a1 = ((s + 1) / arcSegs) * (Math.PI * 0.5);
          const aMid = (a0 + a1) * 0.5;
          const sx = arcCx + sideSign * Math.sin(aMid) * arcR;
          const sz = arcCz + Math.cos(aMid) * arcR;
          const segLen = 2 * arcR * Math.sin((a1 - a0) * 0.5) + 0.05;
          const rySeg = -sideSign * aMid;

          targetBatch.box(mPlasterTrim, sx, y0 + 0.06, sz, segLen, 0.12, 0.22, { ry: rySeg, r: 0.01 });
          targetBatch.box(mColumnStone, sx, y0 + 0.125, sz, segLen + 0.02, 0.03, 0.25, { ry: rySeg, r: 0.01 });
          targetBatch.box(mColumnStone, sx, y0 + 0.455, sz, segLen + 0.02, 0.055, 0.26, { ry: rySeg, r: 0.01 });
          targetBatch.box(mPlasterTrim, sx, y0 + 0.490, sz, segLen, 0.025, 0.21, { ry: rySeg, r: 0.01 });
          addStoneBaluster(targetBatch, sx, y0 + 0.13, sz);
        }

        // Outer side-return balustrade segment from z = 0.56 back to z = 0.06 at x = ±3.92
        const xOuterSide = sideSign * 3.92;
        const zSideEnd = 0.06;
        const zSideMid = (arcCz + zSideEnd) * 0.5;
        const sideLen = Math.abs(arcCz - zSideEnd);
        targetBatch.box(mPlasterTrim, xOuterSide, y0 + 0.06, zSideMid, 0.22, 0.12, sideLen, { r: 0.01 });
        targetBatch.box(mColumnStone, xOuterSide, y0 + 0.125, zSideMid, 0.25, 0.03, sideLen + 0.04, { r: 0.01 });
        targetBatch.box(mColumnStone, xOuterSide, y0 + 0.455, zSideMid, 0.26, 0.055, sideLen + 0.04, { r: 0.01 });
        addStoneBaluster(targetBatch, xOuterSide, y0 + 0.13, zSideMid);
        // Terminal pier at the side end of the curved balustrade (x = ±3.92, z = 0.06)
        addBalustradePier(targetBatch, xOuterSide, y0, zSideEnd, 0, true);

        // Raised Garden Soil Bed tucked inside the Stone Retaining Balustrade (z = -0.02..+1.34, x = ±1.52..±3.72)
        const bedX = sideSign * 2.58;
        const bedZ = 0.66;
        targetBatch.box(mPlasterTrim, bedX, y0 + 0.09, bedZ, 2.16, 0.18, 1.32, { r: 0.02 });
        targetBatch.box(mSoilDark, bedX, y0 + 0.19, bedZ, 2.02, 0.04, 1.18, { r: 0.01 });

        // Lush Hydrangea Clusters (pastel blue-violet & soft pink) + Purple Lavender Spikes inside the balustrade bed
        const hydSpots = [
          [sideSign * 1.78, 0.96, 0, 1.05],
          [sideSign * 2.22, 1.02, 1, 1.12],
          [sideSign * 2.68, 0.98, 2, 1.08],
          [sideSign * 3.12, 0.90, 0, 1.04],
          [sideSign * 3.44, 0.62, 1, 1.00],
          [sideSign * 1.96, 0.48, 3, 1.06],
          [sideSign * 2.52, 0.44, 0, 1.10],
          [sideSign * 3.04, 0.42, 2, 1.05],
          [sideSign * 3.48, 0.22, 3, 0.96]
        ];
        hydSpots.forEach(([hx, hz, cMode, sc], idx) => {
          addHydrangeaCluster(
            targetBatch,
            targetGroup,
            hx,
            y0 + 0.22,
            hz,
            cMode,
            sc,
            (sideSign > 0 ? 20 : 10) + idx * 0.85
          );
        });

        // Tall purple Lavender flower spikes rising behind the Hydrangeas along the front wall & corners
        for (const [lx, lz] of [
          [sideSign * 1.72, 0.24],
          [sideSign * 2.15, 0.72],
          [sideSign * 2.48, 0.22],
          [sideSign * 2.86, 0.70],
          [sideSign * 3.28, 0.36],
          [sideSign * 3.56, 0.46]
        ]) {
          addLavenderStalks(targetBatch, lx, y0 + 0.21, lz, 5, 0.13);
        }

        // Flush Uplighting (Lampu Sorot Bawah) embedded inside the balustrade garden bed & along the front base
        addFlushUplight(targetBatch, sideSign * 1.88, y0 + 0.20, 0.68, 2.8, 2.2);
        addFlushUplight(targetBatch, sideSign * 2.82, y0 + 0.20, 0.68, 2.8, 2.2);
        addFlushUplight(targetBatch, sideSign * 2.25, y0, 1.66, 2.4, 1.6);
      };

      // Helper 3A: Forest-Green Cast-Iron & Wood Bench (Bangku Taman Klasik Hijau Tua #2E4F38)
      const addForestGreenBench = (bx, by, bz, ry, targetBatch = b) => {
        const cos = Math.cos(ry), sin = Math.sin(ry);
        const toW = (lx, lz) => [bx + lx * cos + lz * sin, bz - lx * sin + lz * cos];
        const benchW = 1.18;

        // 4 Individual Forest-Green Painted Wooden Seat Slats
        for (let s = 0; s < 4; s++) {
          const lz = -0.06 + s * 0.075;
          const [sx, sz] = toW(0, lz);
          targetBatch.box(s % 2 === 0 ? mForestGreen : mForestGreenLight, sx, by + 0.245, sz, benchW, 0.032, 0.062, {
            ry,
            r: 0.008
          });
        }
        // 4 Individual Forest-Green Painted Wooden Backrest Slats + Arched Top Crest Rail
        for (let s = 0; s < 4; s++) {
          const sy = by + 0.31 + s * 0.068;
          const [bkx, bkz] = toW(0, -0.135 - s * 0.008);
          targetBatch.box(s % 2 === 0 ? mForestGreenLight : mForestGreen, bkx, sy, bkz, benchW, 0.052, 0.032, {
            ry,
            r: 0.008
          });
        }
        // Brass center badge on top backrest slat
        const [bdx, bdz] = toW(0, -0.145);
        targetBatch.box(mGoldBell, bdx, by + 0.515, bdz, 0.14, 0.035, 0.04, { ry });

        // Ornate Black Wrought-Iron Legs, Under-Seat Scroll Braces & Scrolled Armrests
        for (const lx of [-0.50, 0.50]) {
          // Front & rear cast-iron legs + foot pads
          const [flx, flz] = toW(lx, 0.14);
          const [rlx, rlz] = toW(lx, -0.14);
          targetBatch.box(mIronBlack, flx, by + 0.125, flz, 0.055, 0.25, 0.055, { ry });
          targetBatch.box(mIronBlack, rlx, by + 0.265, rlz, 0.055, 0.53, 0.055, { ry });
          // Under-seat iron support frame & decorative scroll ring
          const [mlx, mlz] = toW(lx, 0.0);
          targetBatch.box(mIronBlack, mlx, by + 0.22, mlz, 0.05, 0.04, 0.34, { ry });
          targetBatch.cyl(mIronBlack, mlx, by + 0.14, mlz, 0.065, 0.04, { rz: Math.PI / 2, ry });
          // Scrolled wrought-iron armrest with curved front volute
          const [alx, alz] = toW(lx, 0.02);
          targetBatch.box(mIronBlack, alx, by + 0.365, alz, 0.048, 0.035, 0.32, { ry, r: 0.01 });
          const [vlx, vlz] = toW(lx, 0.17);
          targetBatch.cyl(mIronBlack, vlx, by + 0.315, vlz, 0.045, 0.05, { rz: Math.PI / 2, ry });
          targetBatch.sphere(mGoldBell, vlx, by + 0.365, vlz, 0.022);
        }
      };

      // Helper 3B: Freestanding Wooden Civic Info Kiosk (Papan Pengumuman Kota Berukir)
      const addCivicInfoKiosk = (kx, ky, kz, ry = 0, targetBatch = b) => {
        const cos = Math.cos(ry), sin = Math.sin(ry);
        const toW = (lx, lz) => [kx + lx * cos + lz * sin, kz - lx * sin + lz * cos];

        // Molded stone foundation pad
        targetBatch.box(mPlasterTrim, kx, ky + 0.05, kz, 1.08, 0.10, 0.44, { ry, r: 0.02 });
        // 2 Carved Dark-Teak Turned Wooden Columns on octagonal plinths
        for (const sx of [-0.42, 0.42]) {
          const [px, pz] = toW(sx, 0);
          targetBatch.box(mOakDark, px, ky + 0.22, pz, 0.16, 0.24, 0.16, { ry, r: 0.01 });
          targetBatch.cyl(mOakDoor, px, ky + 0.38, pz, 0.075, 0.08);
          targetBatch.cyl(mOakDark, px, ky + 1.05, pz, 0.058, 1.26);
          targetBatch.cyl(mOakDoor, px, ky + 1.25, pz, 0.072, 0.06);
          targetBatch.cyl(mOakDoor, px, ky + 1.70, pz, 0.078, 0.08);
          // Decorative lower wooden scroll brackets
          const [brx, brz] = toW(sx * 0.78, 0);
          targetBatch.box(mOakDoor, brx, ky + 0.68, brz, 0.16, 0.10, 0.08, { ry });
        }

        // Glazed Display Cabinet Case (y = 0.72..1.68)
        targetBatch.box(mOakDark, kx, ky + 1.20, kz, 0.80, 0.96, 0.16, { ry, r: 0.01 });
        targetBatch.box(mOakDoor, kx, ky + 1.20, kz, 0.72, 0.88, 0.18, { ry, r: 0.01 });
        // Lower carved wood apron beneath display case
        targetBatch.box(mOakDark, kx, ky + 0.68, kz, 0.86, 0.08, 0.22, { ry, r: 0.01 });

        // Double-sided Illuminated Proclamation Notice Board (R.mayorCivicNotice)
        for (const dir of [-1, 1]) {
          const [nx, nz] = toW(0, dir * 0.098);
          targetBatch.panel(mMayorNoticePanel, R.mayorCivicNotice, nx, ky + 1.20, nz, 0.62, 0.76, ry + (dir === 1 ? 0 : Math.PI));
        }

        // Ornate Arched & Scrolled Pediment Roof Crown with Finial
        targetBatch.box(mOakDark, kx, ky + 1.74, kz, 1.06, 0.10, 0.34, { ry, r: 0.01 });
        targetBatch.box(mSlateRoof, kx, ky + 1.83, kz, 1.12, 0.09, 0.38, { ry, r: 0.01 });
        // Curved dome pediment crest & scrolled side volutes
        targetBatch.cyl(mOakDark, kx, ky + 1.92, kz, 0.28, 0.22, { rx: Math.PI / 2, ry });
        targetBatch.box(mOakDoor, kx, ky + 1.90, kz, 0.76, 0.14, 0.24, { ry, r: 0.02 });
        // Gold civic medallion on the pediment brow + turned wooden top finial
        for (const dir of [-1, 1]) {
          const [mx, mz] = toW(0, dir * 0.13);
          targetBatch.sphere(mGoldBell, mx, ky + 1.92, mz, 0.055);
        }
        targetBatch.cyl(mOakDark, kx, ky + 2.10, kz, 0.038, 0.16);
        targetBatch.sphere(mGoldBell, kx, ky + 2.20, kz, 0.052);
        S.lights.push([new THREE.Vector3(kx, ky + 1.35, kz), '#ffd28e', 2.4, 1.4]);
      };

      // Helper 4A: Carved Stone Drinking Fountain with Bronze Lion-Head Spigot (Pancuran Air Batu Kepala Singa)
      const addLionHeadFountain = (fx, fy, fz, ry = 0, targetBatch = b) => {
        const cos = Math.cos(ry), sin = Math.sin(ry);
        const toW = (lx, lz) => [fx + lx * cos + lz * sin, fz - lx * sin + lz * cos];

        // Stepped carved-stone base plinth
        targetBatch.box(mPlasterTrim, fx, fy + 0.06, fz, 0.64, 0.12, 0.58, { ry, r: 0.01 });
        // Rear vertical carved-stone stele / backplate with fluted side pilasters & arched pediment cap
        const [bx, bz] = toW(0, -0.14);
        targetBatch.box(mColumnStone, bx, fy + 0.64, bz, 0.52, 1.04, 0.22, { ry, r: 0.02 });
        targetBatch.box(mPlasterTrim, bx, fy + 0.64, bz, 0.40, 0.86, 0.25, { ry, r: 0.01 });
        // Molded stone cornice & pediment cap on top of the stele
        targetBatch.box(mColumnStone, bx, fy + 1.18, bz, 0.60, 0.08, 0.28, { ry, r: 0.01 });
        targetBatch.cyl(mColumnStone, bx, fy + 1.24, bz, 0.22, 0.24, { rx: Math.PI / 2, ry });
        targetBatch.sphere(mPlasterTrim, bx, fy + 1.38, bz, 0.06);

        // Sculpted Bronze Lion-Head Relief & Spigot on the front face of the stone stele
        const [lx, lz] = toW(0, -0.01);
        targetBatch.cyl(mBronzeDark, lx, fy + 0.88, lz, 0.13, 0.04, { rx: Math.PI / 2, ry });
        // Golden-bronze lion mane & sculpted head
        targetBatch.sphere(mBronzeAged, lx, fy + 0.88, lz, 0.105);
        const [snx, snz] = toW(0, 0.065);
        targetBatch.sphere(mGoldBell, snx, fy + 0.89, snz, 0.072);
        // Brass water spout projecting from the lion's mouth
        const [spx, spz] = toW(0, 0.115);
        targetBatch.cyl(mGoldBell, spx, fy + 0.85, spz, 0.018, 0.09, { rx: Math.PI / 2.4, ry });

        // Arching Crystal-Blue Water Stream pouring from the lion's mouth into the stone basin
        for (let wIdx = 0; wIdx < 5; wIdx++) {
          const tW = wIdx / 4;
          const wy = fy + 0.83 - tW * tW * 0.34;
          const [wx, wz] = toW(0, 0.14 + tW * 0.09);
          targetBatch.sphere(mWater, wx, wy, wz, 0.020 + tW * 0.008);
        }

        // Semi-Circular Carved Stone Basin & Fluted Pedestal Column in front
        const [bsx, bsz] = toW(0, 0.12);
        targetBatch.cyl(mPlasterTrim, bsx, fy + 0.26, bsz, 0.12, 0.32);
        targetBatch.cyl(mColumnStone, bsx, fy + 0.45, bsz, 0.24, 0.10);
        targetBatch.cyl(mPlasterTrim, bsx, fy + 0.50, bsz, 0.26, 0.05);
        // Glowing water pool & ripple ring inside the stone basin
        targetBatch.cyl(mWater, bsx, fy + 0.525, bsz, 0.21, 0.02);
      };

      // Helper 4B: Vintage Green Municipal Pillar Letterbox (Kotak Surat Kota Klasik #2E4F38)
      const addMunicipalLetterbox = (mx, my, mz, ry = 0, targetBatch = b) => {
        const cos = Math.cos(ry), sin = Math.sin(ry);
        const toW = (lx, lz) => [mx + lx * cos + lz * sin, mz - lx * sin + lz * cos];

        // Black cast-iron octagonal base plinth
        targetBatch.cyl(mIronBlack, mx, my + 0.10, mz, 0.21, 0.20);
        targetBatch.cyl(mForestGreen, mx, my + 0.22, mz, 0.195, 0.05);
        // Classic Dark Forest-Green cylindrical pillar body
        targetBatch.cyl(mForestGreen, mx, my + 0.62, mz, 0.18, 0.76);
        // Molded neck ring & tiered domed cap with gold trim
        targetBatch.cyl(mGoldBell, mx, my + 1.01, mz, 0.19, 0.03);
        targetBatch.cyl(mForestGreenLight, mx, my + 1.06, mz, 0.205, 0.07);
        targetBatch.sphere(mForestGreen, mx, my + 1.09, mz, 0.19);
        targetBatch.sphere(mGoldBell, mx, my + 1.29, mz, 0.036);

        // Front Recessed Brass Mail Slot Frame, White Collection Plate & Gold Civic Cipher Emblem
        const [slx, slz] = toW(0, 0.172);
        targetBatch.box(mGoldBell, slx, my + 0.86, slz, 0.18, 0.075, 0.03, { ry, r: 0.006 });
        const [holx, holz] = toW(0, 0.182);
        targetBatch.box(mIronBlack, holx, my + 0.86, holz, 0.13, 0.028, 0.02, { ry });
        // White/cream collection times notice card
        targetBatch.box(mWhiteFrame, slx, my + 0.72, slz, 0.11, 0.09, 0.025, { ry });
        // Raised gold royal/civic crest & door keyhole
        targetBatch.sphere(mGoldBell, slx, my + 0.55, slz, 0.038);
        targetBatch.box(mGoldBell, slx, my + 0.50, slz, 0.10, 0.025, 0.025, { ry });
      };

      // Helper 4C: Classic Black Wrought-Iron Street Lamp with Warm Glass Lantern & 2 Hanging Flower Baskets
      const addMayorHangingBasketLamp = (lx, ly, lz, ry = 0, targetBatch = b, targetGroup = g, seed = 0) => {
        const cos = Math.cos(ry), sin = Math.sin(ry);
        const toW = (dx, dz) => [lx + dx * cos + dz * sin, lz - dx * sin + dz * cos];

        // Molded octagonal cast-iron base & fluted post with decorative gold collars
        targetBatch.cyl(mIronBlack, lx, ly + 0.14, lz, 0.16, 0.28);
        targetBatch.cyl(mIronBlack, lx, ly + 0.34, lz, 0.115, 0.16);
        targetBatch.cyl(mGoldBell, lx, ly + 0.43, lz, 0.085, 0.035);
        targetBatch.cyl(mIronBlack, lx, ly + 1.32, lz, 0.052, 1.76);
        targetBatch.cyl(mGoldBell, lx, ly + 1.88, lz, 0.072, 0.04);

        // Ornate Wrought-Iron Crossbar Arms & Scrolled Volute Brackets at y = ly + 1.92
        const armY = ly + 1.92;
        targetBatch.box(mIronBlack, lx, armY, lz, 0.92, 0.042, 0.042, { ry });
        for (const side of [-1, 1]) {
          // Decorative S-scroll iron bracket under and above crossbar
          const [scx, scz] = toW(side * 0.22, 0);
          targetBatch.box(mIronBlack, scx, armY - 0.10, scz, 0.32, 0.03, 0.03, {
            ry,
            rz: side * 0.52
          });
          targetBatch.cyl(mIronBlack, scx, armY + 0.07, scz, 0.065, 0.03, { rx: Math.PI / 2, ry });
          targetBatch.sphere(mGoldBell, scx, armY + 0.07, scz, 0.025);

          // Hanging Flower Basket suspended from the outer end of each arm (side * 0.42)
          const [bx, bz] = toW(side * 0.42, 0);
          // Suspension chain rod
          targetBatch.cyl(mIronBlack, bx, armY - 0.11, bz, 0.012, 0.20);
          // Wrought-iron wire basket bowl & coco-liner
          targetBatch.sphere(mIronBlack, bx, armY - 0.24, bz, 0.135);
          targetBatch.cyl(mOakDoor, bx, armY - 0.21, bz, 0.13, 0.06);
          // Lush overflowing foliage & pastel hydrangea/petunia blooms in the hanging basket
          const hbMesh = new THREE.Mesh(crownGeo, side < 0 ? mBush : mBushLight);
          hbMesh.position.set(bx, armY - 0.17, bz);
          hbMesh.scale.set(0.18, 0.15, 0.18);
          registerWindMesh(hbMesh, seed + side * 1.4, 'foliage', targetGroup);
          // Trailing ivy & colorful blossoms around the basket rim
          targetBatch.sphere(mHydrangeaBlue, bx + 0.06, armY - 0.12, bz + 0.05, 0.052);
          targetBatch.sphere(mHydrangeaPink, bx - 0.06, armY - 0.13, bz + 0.04, 0.048);
          targetBatch.sphere(mFlowerWhite, bx + 0.02, armY - 0.11, bz - 0.06, 0.045);
          targetBatch.sphere(mLavenderLight, bx - 0.04, armY - 0.14, bz - 0.05, 0.046);
          targetBatch.cyl(mBushLight, bx + side * 0.08, armY - 0.29, bz + 0.04, 0.022, 0.14);
        }

        // Top 4-Sided Tapered Warm Glass Lantern & Domed Finial Cap
        targetBatch.box(mIronBlack, lx, ly + 2.18, lz, 0.26, 0.045, 0.26, { ry });
        targetBatch.box(M.lampBulb, lx, ly + 2.36, lz, 0.20, 0.30, 0.20, { ry });
        for (const [dx, dz] of [[-0.11, -0.11], [0.11, -0.11], [-0.11, 0.11], [0.11, 0.11]]) {
          const [px, pz] = toW(dx, dz);
          targetBatch.box(mIronBlack, px, ly + 2.36, pz, 0.026, 0.32, 0.026, { ry });
        }
        targetBatch.add(mIronBlack, unitCone, lx, ly + 2.58, lz, 0.34, 0.20, 0.34);
        targetBatch.sphere(mGoldBell, lx, ly + 2.71, lz, 0.046);
        addPolePointLight(targetGroup, lx, ly + 2.18, lz, 1.0, '#FFD89B', 9, 2.0);
        S.lights.push([new THREE.Vector3(lx, ly + 2.36, lz), '#FFD89B', 4.4, 2.2]);
      };

      // ----------------------------------------------------------------------
      // PLACE FRONT & SIDE STREETSCAPE AMENITIES AROUND MAYOR'S OFFICE (`b` / `g`)
      // Clean, Grand & Open Civic Plaza Layout:
      // 1) ONLY 1 Proportional Bronze/Gold Floor Medallion at the center of the front plaza (0, 2.85)
      // 2) ONLY 2 Curved Stone Retaining Balustrades with Hydrangea/Lavender Planters flanking the porch steps (rear of plaza)
      // 3) 1 Left Plaza Bench & 1 Right Plaza Bench facing the central medallion with wide NPC walking clearance
      // 4) Freestanding Wooden Civic Notice Board on the right (3.85, 2.45) & Green Pillar Letterbox on the left (-3.85, 2.45)
      // 5) 3 Classic Hanging-Basket Streetlamps strictly along the Outer Curb Edge (±5.12)
      // ----------------------------------------------------------------------
      // 1) Single Proportional Civic Floor Medallion at the center of the open front plaza in front of the main steps
      addCommemorativeSealInlay(b, 0, 2.85, 0.54, 0);

      // 2) Left & Right Curved Stone Retaining Balustrades + Hydrangea/Lavender Planters flanking the building porch steps
      addFrontCurvedBalustradePlanter(b, g, -1);
      addFrontCurvedBalustradePlanter(b, g, 1);

      // 3) 1 Left Plaza Bench & 1 Right Plaza Bench pulled FLUSH against the front stone retaining balustrades (z = 1.74),
      //    leaving > 80% of the front porphyry plaza completely open for pedestrians!
      addForestGreenBench(-2.35, y0, 1.74, 0, b);
      addForestGreenBench(2.35, y0, 1.74, 0, b);

      // 4) Freestanding Wooden Civic Notice Board (tucked flush next to right balustrade at (3.65, 1.74)) & Green Municipal Pillar Letterbox (Left)
      addCivicInfoKiosk(3.65, y0, 1.74, 0, b);
      addMunicipalLetterbox(-4.25, y0, 3.58, 0.28, b);

      // 5) Exactly 4 Classic Black Street Lamps with Hanging Flower Baskets at the 4 Outer Curb Corners of Store #7 (Mayor's Office, ~0.35m from outer curb edge)
      addMayorHangingBasketLamp(-4.92, y0, 4.92, Math.PI / 4, b, g, 36.2);                  // Front-Left Outer Curb Corner
      addMayorHangingBasketLamp(4.92, y0, 4.92, -Math.PI / 4, b, g, 38.5);                  // Front-Right Outer Curb Corner
      addMayorHangingBasketLamp(-4.92, y0, -4.92, -Math.PI / 4, bLot, villageOuterLot, 40.1); // Back-Left Outer Curb Corner
      addMayorHangingBasketLamp(4.92, y0, -4.92, Math.PI / 4, bLot, villageOuterLot, 42.3);   // Back-Right Outer Curb Corner

      // 6) Single Carved Stone Lion-Head Drinking Fountain placed neatly right next to the Green Capsule Pillar Letterbox (-4.25, y0, 2.75), facing the plaza path
      addLionHeadFountain(-4.25, y0, 2.75, 0.28, b);

      bLot.build(villageOuterLot);
      S.villageOuterLot = villageOuterLot;

      // ----------------------------------------------------------------------
      // 2. SEPARATE SCENE GROUP: townParkGroup (Outer Civic Forecourt Promenade,
      //    Central Park, Stone Promenade, Wooden Archway & Grand Fountain)
      //    Unified at y0 = 0.180 with Fan-Pattern Porphyry & matching Civic Amenities!
      // ----------------------------------------------------------------------
      const townParkGroup = new THREE.Group();
      townParkGroup.position.copy(g.position);
      townParkGroup.rotation.copy(g.rotation);
      world.add(townParkGroup);
      S.townParkGroup = townParkGroup;
      const bPark = new Batch();

      const mParkLawn = mat('#689452', { roughness: 0.90 }, t);
      const mPromenadeStone = mat(
        '#FFFFFF',
        {
          map: mayorPorphyryFanTex,
          roughness: 0.65,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1
        },
        t
      );
      const mPromenadeBorder = mat(
        '#DFD0B4',
        {
          roughness: 0.80,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1
        },
        t
      );
      // 1) Lush Green Park Lawn STRICTLY to the LEFT of the Wooden Trellis Arch (archX = -6.35):
      //    - Right boundary `lawnX1 = -6.68` stops cleanly to the left of the archway posts (x = -6.51..-6.19),
      //      so the archway posts, white stone planter, and green postbox stand 100% on the cobblestone plaza!
      //    - Split into North Lawn (z in [-4.40, -1.24]) and South Lawn (z in [+1.24, +4.40]) so zero grass
      //      ever crosses or blocks the central garden footpath (z in [-1.18, +1.18])!
      const fpkX = -PITCH, fpkZ = 0.00;
      const archX = -6.35;
      const lawnX0 = fpkX - 4.40, lawnX1 = -6.68;
      const lawnW = lawnX1 - lawnX0, lawnCx = (lawnX0 + lawnX1) * 0.5;
      const sideLawnD = 4.40 - 1.24, sideLawnCz = (4.40 + 1.24) * 0.5; // depth = 3.16, cz = ±2.82
      bPark.add(mParkLawn, roundedRectGeometry(lawnW, sideLawnD, 0.45, 0.012), lawnCx, y0, -sideLawnCz);
      bPark.add(mParkLawn, roundedRectGeometry(lawnW, sideLawnD, 0.45, 0.012), lawnCx, y0, sideLawnCz);

      // 2) Continuous Fan-Pattern Porphyry Cobblestone Path connecting the Mayor's Office Plaza (x = -3.65)
      //    straight through the Wooden Trellis Arch (archX = -6.35) into the Garden Footpath (x = fpkX + 3.15)
      const promX0 = fpkX + 3.15, promX1 = -3.65;
      const promLen = promX1 - promX0, promCx = (promX0 + promX1) * 0.5;
      const gardenPathCx = (promX0 + archX) * 0.5; // -9.80 (center of garden footpath to the left of archway)
      bPark.add(mPromenadeStone, tiledBoxGeo(promLen, 0.018, 2.28), promCx, y0 + 0.009, 0.00);
      // Cobblestone bench alcoves at (gardenPathCx, z = ±1.52) so the garden benches sit cleanly on stone paving
      bPark.add(mPromenadeStone, tiledBoxGeo(1.68, 0.018, 0.72), gardenPathCx, y0 + 0.009, -1.48);
      bPark.add(mPromenadeStone, tiledBoxGeo(1.68, 0.018, 0.72), gardenPathCx, y0 + 0.009, 1.48);
      // Carved cream stone curb edging strictly to the LEFT of the wooden archway (from fpkX + 3.15 to archX - 0.16)
      // leaving the plaza side (x > -6.51) 100% flush & open for NPCs entering/exiting the archway!
      const curbX0 = fpkX + 3.15, curbX1 = archX - 0.16;
      const curbLen = curbX1 - curbX0, curbCx = (curbX0 + curbX1) * 0.5;
      bPark.box(mPromenadeBorder, curbCx, y0 + 0.022, -1.16, curbLen, 0.032, 0.12, { r: 0.01 });
      bPark.box(mPromenadeBorder, curbCx, y0 + 0.022, 1.16, curbLen, 0.032, 0.12, { r: 0.01 });

      // 3) Wooden Garden Archway (Gapura Kayu Taman) at lx = -6.35, lz = 0.00 (standing 100% on cobblestone!)
      for (const sz of [-1.14, 1.14]) {
        bPark.box(mPlasterTrim, archX, y0 + 0.12, sz, 0.32, 0.24, 0.32, { r: 0.02 });
        bPark.box(mOakDark, archX - 0.09, y0 + 1.24, sz, 0.11, 2.04, 0.11, { r: 0.01 });
        bPark.box(mOakDark, archX + 0.09, y0 + 1.24, sz, 0.11, 2.04, 0.11, { r: 0.01 });
        for (let r = 0; r < 5; r++) {
          bPark.box(mOakDoor, archX, y0 + 0.47 + r * 0.36, sz, 0.24, 0.04, 0.05);
        }
        bPark.box(mOakDoor, archX, y0 + 2.00, sz - Math.sign(sz) * 0.24, 0.16, 0.10, 0.44, {
          rx: Math.sign(sz) * 0.52,
          r: 0.01
        });
      }
      bPark.box(mOakDark, archX - 0.10, y0 + 2.30, 0, 0.12, 0.14, 2.68, { r: 0.01 });
      bPark.box(mOakDark, archX + 0.10, y0 + 2.30, 0, 0.12, 0.14, 2.68, { r: 0.01 });
      bPark.box(mOakDoor, archX, y0 + 2.46, 0, 0.46, 0.10, 1.98, { r: 0.01 });
      bPark.box(mOakDark, archX, y0 + 2.56, 0, 0.32, 0.08, 1.36, { r: 0.01 });
      for (let k = -4; k <= 4; k++) {
        bPark.box(mOakDoor, archX, y0 + 2.39, k * 0.30, 0.56, 0.05, 0.07, { r: 0.008 });
      }
      bPark.cyl(mIronBlack, archX, y0 + 2.18, 0, 0.02, 0.22);
      bPark.box(mIronBlack, archX, y0 + 2.02, 0, 0.18, 0.20, 0.18);
      bPark.box(M.glowGlass, archX, y0 + 2.02, 0, 0.13, 0.15, 0.13);
      S.lights.push([new THREE.Vector3(archX, y0 + 2.00, 0), '#ffbe76', 4.0, 2.0]);
      const vineSpots = [
        [archX, y0 + 0.67, -1.16, 0.22],
        [archX, y0 + 1.27, -1.14, 0.24],
        [archX, y0 + 1.90, -1.08, 0.26],
        [archX, y0 + 0.67, 1.16, 0.22],
        [archX, y0 + 1.27, 1.14, 0.24],
        [archX, y0 + 1.90, 1.08, 0.26],
        [archX, y0 + 2.48, -0.84, 0.28],
        [archX, y0 + 2.58, -0.40, 0.30],
        [archX, y0 + 2.62, 0.00, 0.32],
        [archX, y0 + 2.58, 0.40, 0.30],
        [archX, y0 + 2.48, 0.84, 0.28]
      ];
      vineSpots.forEach(([vx, vy, vz, vs], vi) => {
        const vMesh = new THREE.Mesh(crownGeo, vi % 2 === 0 ? mBush : mBushLight);
        vMesh.position.set(vx, vy, vz);
        vMesh.scale.set(vs, vs * 0.85, vs);
        registerWindMesh(vMesh, 6.2 + vi * 0.65, 'foliage', townParkGroup);
        const fMat = vi % 3 === 0 ? mHydrangeaBlue : vi % 3 === 1 ? mHydrangeaPink : mLavenderLight;
        bPark.sphere(fMat, vx + 0.08, vy + 0.07, vz + 0.04, 0.052);
        bPark.sphere(fMat, vx - 0.07, vy + 0.05, vz - 0.04, 0.046);
      });

      // Central Park Fountain Court & Radial Fan-Pattern Porphyry Walkways at lx = -PITCH, lz = 0.00 (flush on y0 = 0.220)
      bPark.cyl(mPromenadeBorder, fpkX, y0 + 0.008, fpkZ, 3.44, 0.016);
      bPark.cyl(mPromenadeStone, fpkX, y0 + 0.014, fpkZ, 3.26, 0.016);
      bPark.cyl(mColumnStone, fpkX, y0 + 0.019, fpkZ, 2.38, 0.008);
      bPark.add(mPromenadeStone, tiledBoxGeo(1.75, 0.018, 1.95), fpkX, y0 + 0.009, -3.55);
      bPark.add(mPromenadeStone, tiledBoxGeo(1.75, 0.018, 1.95), fpkX, y0 + 0.009, 3.55);
      bPark.add(mPromenadeStone, tiledBoxGeo(2.15, 0.018, 1.85), fpkX - 3.45, y0 + 0.009, 0.00);

      // Grand 3-Tier Central Park Fountain at (fpkX = -PITCH, fpkZ = 0.00)
      bPark.cyl(mPlasterTrim, fpkX, y0 + 0.12, fpkZ, 1.42, 0.22);
      bPark.cyl(mColumnStone, fpkX, y0 + 0.24, fpkZ, 1.50, 0.055);
      bPark.cyl(mWater, fpkX, y0 + 0.24, fpkZ, 1.30, 0.048);
      bPark.cyl(mPlasterTrim, fpkX, y0 + 0.42, fpkZ, 0.36, 0.34);
      bPark.cyl(mColumnStone, fpkX, y0 + 0.60, fpkZ, 0.68, 0.07);
      bPark.cyl(mWater, fpkX, y0 + 0.64, fpkZ, 0.58, 0.03);
      bPark.cyl(mPlasterTrim, fpkX, y0 + 0.78, fpkZ, 0.18, 0.24);
      bPark.cyl(mColumnStone, fpkX, y0 + 0.91, fpkZ, 0.34, 0.05);
      bPark.sphere(mGoldBell, fpkX, y0 + 1.04, fpkZ, 0.085);

      // Animated sparkling fountain water droplets centered on the Grand Central Park Fountain
      const fountainDropsGroup = new THREE.Group();
      fountainDropsGroup.position.set(fpkX, 0.04, fpkZ);
      townParkGroup.add(fountainDropsGroup);
      const dropGeo = new THREE.SphereGeometry(0.038, 6, 5);
      const fountainDrops = [];
      for (let i = 0; i < 16; i++) {
        const dm = new THREE.Mesh(dropGeo, mWater);
        const angle = (i / 16) * Math.PI * 2;
        dm.userData = { angle, phase: i / 16 };
        fountainDropsGroup.add(dm);
        fountainDrops.push(dm);
      }
      S.fountainDrops = fountainDrops;

      // Forest-Green Cast-Iron & Wood Benches along the Garden Footpath (at gardenPathCx = -9.80) & around the Grand Fountain
      addForestGreenBench(gardenPathCx, y0, -1.55, 0, bPark);
      addForestGreenBench(gardenPathCx, y0, 1.55, Math.PI, bPark);
      addForestGreenBench(fpkX, y0, -2.72, 0, bPark);
      addForestGreenBench(fpkX, y0, 2.72, Math.PI, bPark);
      addForestGreenBench(fpkX - 2.72, y0, 0, Math.PI / 2, bPark);

      // Warm Garden Bollard Lights (height = 0.70m) lining both sides of the garden walkway toward the fountain & around the fountain court
      const mParkBollardGlow = mat(
        '#FFF4D4',
        { emissive: '#FFB85C', emissiveIntensity: 1.15, roughness: 0.22 },
        t
      );
      bollardMaterials.push(mParkBollardGlow);
      const addParkBollardLight = (bx, bz) => {
        // Stepped stone plinth & dark cast-iron cylindrical post (total height = 0.70m)
        bPark.cyl(mPlasterTrim, bx, y0 + 0.03, bz, 0.11, 0.06);
        bPark.cyl(mIronBlack, bx, y0 + 0.24, bz, 0.072, 0.36);
        bPark.cyl(mIronBlack, bx, y0 + 0.43, bz, 0.088, 0.028);
        // Warm glowing glass lantern diffuser cylinder + louver rings
        bPark.cyl(mParkBollardGlow, bx, y0 + 0.54, bz, 0.066, 0.19);
        bPark.cyl(mIronBlack, bx, y0 + 0.54, bz, 0.074, 0.018);
        // Domed cast-iron cap & brass finial at y = y0 + 0.70m
        bPark.cyl(mIronBlack, bx, y0 + 0.65, bz, 0.096, 0.032);
        bPark.add(mIronBlack, unitCone, bx, y0 + 0.68, bz, 0.10, 0.045, 0.10);
        bPark.sphere(mGoldBell, bx, y0 + 0.705, bz, 0.022);
        S.lights.push([new THREE.Vector3(bx, y0 + 0.56, bz), '#ffc978', 3.4, 1.55]);
      };
      // Left & right rows along the porphyry walkway from the wooden archway (-7.20) to the fountain court (-12.35)
      for (const bx of [-7.25, -8.65, -10.95, -12.35]) {
        addParkBollardLight(bx, -1.32);
        addParkBollardLight(bx, 1.32);
      }
      // 4 diagonal bollards framing the Central Park Fountain Court
      for (const [fxOff, fzOff] of [
        [-2.35, -2.35],
        [2.35, -2.35],
        [-2.35, 2.35],
        [2.35, 2.35]
      ]) {
        addParkBollardLight(fpkX + fxOff, fpkZ + fzOff);
      }
      // Dedicated warm point light illuminating the garden walkway & fountain court at night
      addPolePointLight(townParkGroup, gardenPathCx, y0 + 1.85, 0, 0.95, '#FFD89B', 9.5, 2.0);
      addPolePointLight(townParkGroup, fpkX, y0 + 2.10, fpkZ, 1.05, '#FFD89B', 10.5, 2.0);

      // Scenic Shade Trees inside the Unified Central Park Lawn (strictly left of lawnX1 = -6.68)
      const parkTrees = [
        [gardenPathCx - 0.35, -3.55, 0.96],
        [gardenPathCx - 0.35, 3.55, 0.92],
        [fpkX + 2.30, -3.70, 1.04],
        [fpkX + 2.30, 3.70, 1.00],
        [fpkX - 3.30, -3.35, 1.02],
        [fpkX - 3.30, 3.35, 0.98]
      ];
      parkTrees.forEach(([ptx, ptz, pts], pti) => {
        bPark.cyl(mOakDark, ptx, y0 + 0.52 * pts, ptz, 0.11 * pts, 1.04 * pts);
        const cMesh = new THREE.Mesh(crownGeo, pti % 2 === 0 ? mBush : mBushLight);
        cMesh.position.set(ptx, y0 + 1.38 * pts, ptz);
        cMesh.scale.set(0.68 * pts, 0.78 * pts, 0.68 * pts);
        registerWindMesh(cMesh, 18.0 + pti * 1.3, 'foliage', townParkGroup);
      });
      bPark.build(townParkGroup);

      // ----------------------------------------------------------------------
      // 3. MAIN HALL BODY: Warm Cream Plaster (#F2E5C8), Terracotta Quoins & Sage Belt
      // ----------------------------------------------------------------------
      const cxB = 0, czB = -1.95;
      const wB = 6.60, dB = 3.80;
      const xL = cxB - wB / 2; // -3.30
      const xR = cxB + wB / 2; // +3.30
      const zBack = czB - dB / 2; // -3.85
      const zFront = czB + dB / 2; // -0.05
      const yPlinth = 0.18;
      const yWall0 = 0.48;
      const yWall1 = 3.42;
      const wallH = yWall1 - yWall0; // 2.94

      // Stone plinth foundation
      b.box(mPlasterTrim, cxB, (yPlinth + yWall0) / 2, czB, wB + 0.16, yWall0 - yPlinth, dB + 0.16, { r: 0.02 });
      // Main Warm Cream Plaster Core (recessed 0.24m behind front/side windows so glass is -0.05m and light backdrop is -0.21m)
      b.box(mPlaster, cxB, (yWall0 + yWall1) / 2, czB - 0.12, wB - 0.48, wallH, dB - 0.24, { r: 0.03 });
      // Front Facade Wall Bands around Front Windows (-2.22, 1.86) and (2.22, 1.86)
      b.box(mPlaster, cxB, 0.90, zFront - 0.12, wB, 0.84, 0.24);
      b.box(mPlaster, cxB, 2.91, zFront - 0.12, wB, 1.02, 0.24);
      b.box(mPlaster, 0, 1.86, zFront - 0.12, 3.56, 1.08, 0.24);
      b.box(mPlaster, -2.98, 1.86, zFront - 0.12, 0.64, 1.08, 0.24);
      b.box(mPlaster, 2.98, 1.86, zFront - 0.12, 0.64, 1.08, 0.24);
      // Left Facade Wall Bands (at xL) around Side Window (z = -2.35) & Door
      b.box(mPlaster, xL + 0.12, 0.90, czB, 0.24, 0.84, dB);
      b.box(mPlaster, xL + 0.12, 2.91, czB, 0.24, 1.02, dB);
      b.box(mPlaster, xL + 0.12, 1.86, -0.98, 0.24, 1.08, 1.86);
      b.box(mPlaster, xL + 0.12, 1.86, -3.32, 0.24, 1.08, 1.06);
      // Right Facade Wall Bands (at xR) around Side Windows (z = -1.10, -2.65)
      b.box(mPlaster, xR - 0.12, 0.90, czB, 0.24, 0.84, dB);
      b.box(mPlaster, xR - 0.12, 2.91, czB, 0.24, 1.02, dB);
      b.box(mPlaster, xR - 0.12, 1.86, -0.35, 0.24, 1.08, 0.62);
      b.box(mPlaster, xR - 0.12, 1.86, -1.875, 0.24, 1.08, 0.67);
      b.box(mPlaster, xR - 0.12, 1.86, -3.47, 0.24, 1.08, 0.76);

      // Alternating Long-and-Short Terracotta Corner Quoins (#C98A63) at all 4 corners (proud of wall, non-overlapping)
      const quoinRows = 9;
      const qStep = (wallH - 0.38) / quoinRows;
      for (let q = 0; q < quoinRows; q++) {
        const qy = yWall0 + 0.16 + (q + 0.5) * qStep;
        const qh = qStep * 0.82;
        const isLongX = q % 2 === 0;
        const qwX = isLongX ? 0.38 : 0.24;
        const qwZ = isLongX ? 0.24 : 0.38;
        for (const sx of [-1, 1]) {
          for (const sz of [-1, 1]) {
            const qx = sx * (wB / 2 - qwX / 2 + 0.03);
            const qz = czB + sz * (dB / 2 - qwZ / 2 + 0.03);
            b.box(mQuoin, qx, qy, czB + sz * (dB / 2 + 0.02), qwX, qh, 0.03, { r: 0.008 });
            b.box(mQuoin, sx * (wB / 2 + 0.02), qy, qz, 0.03, qh, qwZ, { r: 0.008 });
          }
        }
      }

      // Exposed Storybook Brick Patches (>= 0.065u outside wall + polygonOffset)
      for (const [bx, by, bw, bh, matB] of [
        [-2.85, 0.92, 0.32, 0.12, mQuoin],
        [-2.62, 1.06, 0.28, 0.12, mBrickDark],
        [-2.92, 1.20, 0.26, 0.12, mQuoin],
        [2.82, 0.86, 0.30, 0.12, mQuoin],
        [2.95, 1.00, 0.24, 0.12, mBrickDark]
      ]) {
        b.box(matB, bx, by, zFront + 0.065, bw, bh, 0.02);
      }
      // Side profile exposed brick patches near front-left corner (matching Side Profile view)
      for (const [bz, by, bd, bh, matB] of [
        [-0.38, 0.78, 0.34, 0.12, mQuoin],
        [-0.52, 0.92, 0.28, 0.12, mBrickDark],
        [-0.34, 1.06, 0.30, 0.12, mQuoin],
        [-0.44, 2.52, 0.32, 0.12, mQuoin],
        [-0.32, 2.66, 0.26, 0.12, mBrickDark]
      ]) {
        b.box(matB, xL - 0.065, by, bz, 0.02, bh, bd);
      }

      // Sage Green Belt Course / Frieze (#8FA38A) & Cream Stone Moldings
      b.box(mPlasterTrim, cxB, 3.04, czB, wB + 0.14, 0.07, dB + 0.14);
      b.box(mSage, cxB, 3.21, czB, wB + 0.10, 0.26, dB + 0.10);
      b.box(mPlasterTrim, cxB, 3.38, czB, wB + 0.18, 0.08, dB + 0.18);

      // ----------------------------------------------------------------------
      // 4. SLATE BLUE GABLE ROOF & FRONT PEDIMENT (#6E828A)
      // ----------------------------------------------------------------------
      const makeTrianglePrism = (width, rise, depth, alongX = false) => {
        const sh = new THREE.Shape([
          new THREE.Vector2(-width / 2, 0),
          new THREE.Vector2(width / 2, 0),
          new THREE.Vector2(0, rise)
        ]);
        const geo = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false });
        geo.translate(0, 0, -depth / 2);
        if (alongX) geo.rotateY(Math.PI / 2);
        return solid(geo);
      };

      // Main roof ridge along X (side-to-side gable as seen in Side Profile view)
      const roofRise = 1.48;
      b.add(mSlateRoof, makeTrianglePrism(dB + 0.56, roofRise, wB + 0.48, true), cxB, yWall1, czB);
      // Cream plaster side gable tympanums
      b.add(mPlaster, makeTrianglePrism(dB - 0.08, roofRise - 0.14, wB + 0.02, true), cxB, yWall1 + 0.02, czB);
      // Wide Front Pediment Gable (as seen in Front Elevation & 3/4 Isometric views)
      b.add(mSlateRoof, makeTrianglePrism(wB + 0.36, 1.42, dB * 0.62, false), cxB, yWall1, czB + 0.58);
      b.add(mPlaster, makeTrianglePrism(wB - 0.28, 1.24, 0.16, false), cxB, yWall1 + 0.02, zFront - 0.02);
      // Exposed brick patch inside the left side of the front gable tympanum (matching Front Elevation!)
      b.box(mQuoin, -1.88, yWall1 + 0.34, zFront + 0.075, 0.42, 0.12, 0.02);
      b.box(mBrickDark, -1.68, yWall1 + 0.47, zFront + 0.075, 0.34, 0.12, 0.02);
      b.box(mQuoin, -2.02, yWall1 + 0.47, zFront + 0.075, 0.26, 0.12, 0.02);
      // Overhanging Slate Blue Eave Trim
      b.box(mSlateTrim, cxB, yWall1 + 0.04, czB, wB + 0.56, 0.09, dB + 0.62, { r: 0.01 });

      // ----------------------------------------------------------------------
      // 5. MAYORAL PORCH (Front Facade: Steps, Columns, Pediment, Doors & Windows)
      // ----------------------------------------------------------------------
      const zPorchF = 1.02;
      const wPorch = 2.84;
      // Porch raised stone deck (y = 0.22 -> 0.54, z = zFront..zPorchF)
      b.box(mPlasterTrim, 0, 0.38, (zFront + zPorchF) / 2, wPorch, 0.32, zPorchF - zFront, { r: 0.02 });
      // 3-Tier Stone Steps (tangga batu 3 tingkat) descending from z = 1.02 to z = 1.68
      b.box(mColumnStone, 0, 0.45, 1.14, 2.08, 0.14, 0.24, { r: 0.01 });
      b.box(mColumnStone, 0, 0.35, 1.36, 2.22, 0.14, 0.24, { r: 0.01 });
      b.box(mColumnStone, 0, 0.26, 1.58, 2.36, 0.10, 0.24, { r: 0.01 });
      // Stone cheek walls flanking the porch steps
      for (const sx of [-1, 1]) {
        b.box(mPlasterTrim, sx * 1.26, 0.42, 1.32, 0.24, 0.40, 0.68, { r: 0.01 });
        b.box(mColumnStone, sx * 1.26, 0.64, 1.32, 0.30, 0.05, 0.74, { r: 0.01 });
      }

      // 2 Classical Cylindrical Columns (x = ±1.12, z = 0.84)
      for (const sx of [-1, 1]) {
        const colX = sx * 1.12, colZ = 0.84;
        // Square plinth + torus base
        b.box(mPlasterTrim, colX, 0.60, colZ, 0.42, 0.12, 0.42);
        b.cyl(mColumnStone, colX, 0.70, colZ, 0.19, 0.08);
        // Smooth cylindrical shaft
        b.cyl(mColumnStone, colX, 1.78, colZ, 0.145, 2.08);
        // Classical capital (echinus + square abacus)
        b.cyl(mColumnStone, colX, 2.86, colZ, 0.19, 0.09);
        b.box(mPlasterTrim, colX, 2.95, colZ, 0.42, 0.10, 0.42);
      }

      // Porch Entablature & Triangular Portico Pediment with MAYOR'S OFFICE Plaque
      const czPorch = (zFront + zPorchF + 0.12) / 2;
      const dPorchRoof = zPorchF - zFront + 0.24;
      b.box(mPlasterTrim, 0, 3.04, czPorch, wPorch + 0.12, 0.08, dPorchRoof);
      b.box(mSage, 0, 3.16, czPorch, wPorch + 0.06, 0.16, dPorchRoof - 0.04);
      b.box(mPlasterTrim, 0, 3.27, czPorch, wPorch + 0.22, 0.07, dPorchRoof + 0.08);
      b.add(mSlateRoof, makeTrianglePrism(wPorch + 0.36, 0.92, dPorchRoof + 0.12, false), 0, 3.30, czPorch);
      b.add(mPlaster, makeTrianglePrism(wPorch - 0.16, 0.76, 0.12, false), 0, 3.31, zPorchF - 0.02);

      // Raised Illuminated MAYOR'S OFFICE Plaque (>= 0.08u outside portico tympanum + warm emissive + pediment spotlight)
      const mMayorPlaque = mat(
        '#FFF8E7',
        {
          map: atlas.tex,
          emissive: '#FFE8B5',
          emissiveMap: atlas.tex,
          emissiveIntensity: 0.78,
          roughness: 0.42,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2
        },
        t
      );
      mMayorPlaque.userData.noCast = true;
      b.box(mOakDark, 0, 3.58, zPorchF + 0.08, 1.36, 0.50, 0.05, { r: 0.02 });
      b.panel(mMayorPlaque, R.mayorPlaque, 0, 3.58, zPorchF + 0.12, 1.32, 0.48);
      S.lights.push([new THREE.Vector3(0, 3.58, zPorchF + 0.45), '#ffcf86', 4.5, 2.8]);

      // Arched Double Wooden Entrance Door + Semi-Circular Transom Fanlight Window
      // Stone surround pillars & arch header
      b.box(mPlasterTrim, -0.66, 1.32, zFront + 0.04, 0.16, 1.60, 0.12);
      b.box(mPlasterTrim, 0.66, 1.32, zFront + 0.04, 0.16, 1.60, 0.12);
      b.box(mPlasterTrim, 0, 2.08, zFront + 0.05, 1.48, 0.10, 0.14);
      // Semi-circular stone arch & glowing transom fanlight above the doors
      const archStoneGeo = new THREE.CylinderGeometry(0.68, 0.68, 0.12, 20, 1, false, 0, Math.PI);
      archStoneGeo.rotateZ(-Math.PI / 2);
      archStoneGeo.rotateX(Math.PI / 2);
      b.add(mPlasterTrim, solid(archStoneGeo), 0, 2.12, zFront + 0.04);

      const transomGlassGeo = new THREE.CylinderGeometry(0.54, 0.54, 0.03, 18, 1, false, 0, Math.PI);
      transomGlassGeo.rotateZ(-Math.PI / 2);
      transomGlassGeo.rotateX(Math.PI / 2);
      b.add(M.glowGlass, solid(transomGlassGeo), 0, 2.12, zFront + 0.08);
      // Fanlight radial muntins (placed cleanly at zFront + 0.11)
      for (const ang of [-0.9, -0.45, 0, 0.45, 0.9]) {
        const mx = Math.sin(ang) * 0.26;
        const my = 2.12 + Math.cos(ang) * 0.26;
        b.box(mOakDark, mx, my, zFront + 0.11, 0.03, 0.50, 0.02, { rz: -ang });
      }

      // Double Oak Doors (left & right leaves) with recessed panels, upper glass & brass handles
      for (const sx of [-1, 1]) {
        const dx = sx * 0.285;
        b.box(mOakDoor, dx, 1.30, zFront + 0.05, 0.55, 1.52, 0.06, { r: 0.01 });
        // Upper window pane in each door leaf (zFront + 0.095, >= 0.06 from wall)
        b.box(M.glowGlass, dx, 1.66, zFront + 0.095, 0.36, 0.48, 0.02);
        b.box(mOakDark, dx, 1.66, zFront + 0.115, 0.40, 0.03, 0.02);
        b.box(mOakDark, dx, 1.66, zFront + 0.115, 0.03, 0.50, 0.02);
        // Lower raised wood panel
        b.box(mOakDark, dx, 0.96, zFront + 0.085, 0.38, 0.54, 0.02);
        // Brass door handle
        b.box(mGoldBell, sx * 0.07, 1.24, zFront + 0.11, 0.03, 0.16, 0.03);
      }

      // 2 Warm Glowing Wall Lanterns flanking the entrance arch
      for (const sx of [-1, 1]) {
        const lx = sx * 0.84, ly = 1.94, lz = zFront + 0.18;
        b.box(mIronBlack, lx, ly + 0.06, zFront + 0.09, 0.05, 0.14, 0.18);
        b.box(mIronBlack, lx, ly + 0.12, lz, 0.18, 0.04, 0.18);
        b.box(M.glowGlass, lx, ly, lz, 0.13, 0.20, 0.13);
        b.box(mIronBlack, lx, ly - 0.11, lz, 0.15, 0.03, 0.15);
        S.lights.push([new THREE.Vector3(lx, ly, lz + 0.2), '#ffbe76', 3.4, 2.2]);
      }

      // Helper: Storybook Multi-Pane Window with Sage Green Louvered Shutters & Flower Window Box
      const addStorybookWindow = (wx, wy, wz, faceAxis = 'Z', dirSign = 1, seed = 0) => {
        const isZ = faceAxis === 'Z';
        const gOff = -0.05 * dirSign;  // Window glass recessed 0.05m inward from outer wall
        const fOff = -0.02 * dirSign;  // White frame/muntins protruding +0.03m in front of glass
        const bgOff = -0.21 * dirSign; // Warm interior light backdrop 0.16m (>= 0.15m) behind glass
        const sOff = 0.035 * dirSign;  // Sage shutters on outer wall surface
        const lOff = 0.065 * dirSign;  // Shutter louvers in front of shutter
        const bOff = 0.155 * dirSign;  // Wooden flower box
        const winW = 0.88, winH = 1.08;

        if (isZ) {
          // Stone lintel & keystone
          b.box(mPlasterTrim, wx, wy + winH / 2 + 0.09, wz + sOff, winW + 0.34, 0.13, 0.06);
          b.box(mColumnStone, wx, wy + winH / 2 + 0.10, wz + lOff, 0.18, 0.17, 0.07);
          // Warm interior light backdrop (0.16m behind glass) & Clear recessed window glass (-0.05m inward)
          b.box(M.glowGlass, wx, wy, wz + bgOff, winW, winH, 0.02);
          b.box(M.clearWinGlass, wx, wy, wz + gOff, winW, winH, 0.016);
          // White outer frame & 6-pane muntin grid (+0.03m in front of glass)
          b.box(mWhiteFrame, wx, wy + winH / 2, wz + fOff, winW + 0.08, 0.06, 0.025);
          b.box(mWhiteFrame, wx, wy - winH / 2, wz + fOff, winW + 0.08, 0.06, 0.025);
          b.box(mWhiteFrame, wx - winW / 2, wy, wz + fOff, 0.06, winH + 0.06, 0.025);
          b.box(mWhiteFrame, wx + winW / 2, wy, wz + fOff, 0.06, winH + 0.06, 0.025);
          b.box(mWhiteFrame, wx, wy, wz + fOff, 0.045, winH, 0.025);
          b.box(mWhiteFrame, wx, wy + 0.18, wz + fOff, winW, 0.04, 0.025);
          b.box(mWhiteFrame, wx, wy - 0.18, wz + fOff, winW, 0.04, 0.025);
          // Sage Green Louvered Shutters (#8FA38A) on Left & Right
          for (const side of [-1, 1]) {
            const shX = wx + side * (winW / 2 + 0.21);
            b.box(mSage, shX, wy, wz + sOff, 0.34, winH + 0.04, 0.04, { r: 0.01 });
            for (let l = -3; l <= 3; l++) {
              b.box(mSageDark, shX, wy + l * 0.13, wz + lOff, 0.26, 0.03, 0.02);
            }
          }
          // Wooden Window Box + Swaying Foliage & Flowers
          const boxY = wy - winH / 2 - 0.12;
          b.box(mOakDoor, wx, boxY, wz + bOff, winW + 0.24, 0.20, 0.24, { r: 0.01 });
          b.box(mOakDark, wx, boxY + 0.09, wz + bOff, winW + 0.28, 0.04, 0.28);
          for (let f = -1; f <= 1; f++) {
            const flMesh = new THREE.Mesh(crownGeo, f === 0 ? mBushLight : mBush);
            flMesh.position.set(wx + f * 0.28, boxY + 0.18, wz + bOff);
            flMesh.scale.set(0.18, 0.16, 0.16);
            registerWindMesh(flMesh, seed + f * 0.7, 'foliage');
            const fCol = (f + 3) % 3 === 0 ? mFlowerPink : (f + 3) % 3 === 1 ? mFlowerYellow : mFlowerWhite;
            b.sphere(fCol, wx + f * 0.28 + 0.04, boxY + 0.26, wz + bOff + 0.04 * dirSign, 0.045);
          }
        } else {
          // Side-facing window (along X wall)
          b.box(mPlasterTrim, wx + sOff, wy + winH / 2 + 0.09, wz, 0.06, 0.13, winW + 0.34);
          b.box(mColumnStone, wx + lOff, wy + winH / 2 + 0.10, wz, 0.07, 0.17, 0.18);
          b.box(M.glowGlass, wx + bgOff, wy, wz, 0.02, winH, winW);
          b.box(M.clearWinGlass, wx + gOff, wy, wz, 0.016, winH, winW);
          b.box(mWhiteFrame, wx + fOff, wy + winH / 2, wz, 0.025, 0.06, winW + 0.08);
          b.box(mWhiteFrame, wx + fOff, wy - winH / 2, wz, 0.025, 0.06, winW + 0.08);
          b.box(mWhiteFrame, wx + fOff, wy, wz - winW / 2, 0.025, winH + 0.06, 0.06);
          b.box(mWhiteFrame, wx + fOff, wy, wz + winW / 2, 0.025, winH + 0.06, 0.06);
          b.box(mWhiteFrame, wx + fOff, wy, wz, 0.025, winH, 0.045);
          b.box(mWhiteFrame, wx + fOff, wy + 0.18, wz, 0.025, 0.04, winW);
          b.box(mWhiteFrame, wx + fOff, wy - 0.18, wz, 0.025, 0.04, winW);
          for (const side of [-1, 1]) {
            const shZ = wz + side * (winW / 2 + 0.21);
            b.box(mSage, wx + sOff, wy, shZ, 0.04, winH + 0.04, 0.34, { r: 0.01 });
            for (let l = -3; l <= 3; l++) {
              b.box(mSageDark, wx + lOff, wy + l * 0.13, shZ, 0.02, 0.03, 0.26);
            }
          }
          const boxY = wy - winH / 2 - 0.12;
          b.box(mOakDoor, wx + bOff, boxY, wz, 0.24, 0.20, winW + 0.24, { r: 0.01 });
          b.box(mOakDark, wx + bOff, boxY + 0.09, wz, 0.28, 0.04, winW + 0.28);
          for (let f = -1; f <= 1; f++) {
            const flMesh = new THREE.Mesh(crownGeo, f === 0 ? mBushLight : mBush);
            flMesh.position.set(wx + bOff, boxY + 0.18, wz + f * 0.28);
            flMesh.scale.set(0.16, 0.16, 0.18);
            registerWindMesh(flMesh, seed + f * 0.7, 'foliage');
            const fCol = (f + 3) % 3 === 0 ? mFlowerPink : (f + 3) % 3 === 1 ? mFlowerYellow : mFlowerWhite;
            b.sphere(fCol, wx + bOff + 0.04 * dirSign, boxY + 0.26, wz + f * 0.28 + 0.04, 0.045);
          }
        }
      };

      // Front Left & Right Windows (flanked below by the Curved Stone Retaining Balustrade & Hydrangea/Lavender Planters)
      addStorybookWindow(-2.22, 1.86, zFront, 'Z', 1, 5.2);
      addStorybookWindow(2.22, 1.86, zFront, 'Z', 1, 6.4);

      // ----------------------------------------------------------------------
      // 6. SIDE PROFILE DETAILS (Sage Door, Side Windows, Forest-Green Benches,
      //    Vintage Green Municipal Letterbox, Lion-Head Fountain, Chimney & Ivy)
      // ----------------------------------------------------------------------
      // Left Wall (x = xL = -3.30): Sage Green Side Door (z = -0.95) + Potted Shrubs
      const zSideDoor = -0.95;
      b.box(mPlasterTrim, xL - 0.04, 1.34, zSideDoor, 0.08, 1.78, 1.06);
      b.box(mPlasterTrim, xL - 0.06, 2.24, zSideDoor, 0.12, 0.12, 1.18);
      b.box(mSage, xL - 0.07, 1.30, zSideDoor, 0.05, 1.64, 0.86, { r: 0.01 });
      b.box(M.glowGlass, xL - 0.105, 1.72, zSideDoor, 0.02, 0.42, 0.48);
      b.box(mSageDark, xL - 0.105, 0.94, zSideDoor, 0.02, 0.56, 0.54);
      b.sphere(mGoldBell, xL - 0.12, 1.24, zSideDoor - 0.28, 0.035);
      b.box(mPlasterTrim, xL - 0.24, 0.32, zSideDoor, 0.42, 0.18, 1.14, { r: 0.01 });
      // Potted Hydrangea & Shrubs flanking the Sage Side Door
      for (const dz of [-0.72, 0.68]) {
        b.cyl(mQuoin, xL - 0.32, 0.36, zSideDoor + dz, 0.18, 0.28);
        const pBush = new THREE.Mesh(crownGeo, mBush);
        pBush.position.set(xL - 0.32, 0.58, zSideDoor + dz);
        pBush.scale.set(0.22, 0.24, 0.22);
        registerWindMesh(pBush, 9.2 + dz, 'foliage');
        b.sphere(dz < 0 ? mHydrangeaBlue : mHydrangeaPink, xL - 0.34, 0.72, zSideDoor + dz, 0.065);
      }

      // Left Side Window (z = -2.35) + Right Side Windows (z = -1.10, -2.65)
      addStorybookWindow(xL, 1.86, -2.35, 'X', -1, 10.1);
      addStorybookWindow(xR, 1.86, -1.10, 'X', 1, 11.4);
      addStorybookWindow(xR, 1.86, -2.65, 'X', 1, 12.7);

      // Side Gable Arched Louvered Attic Vents (Left & Right Gables)
      for (const sx of [-1, 1]) {
        const vx = sx * (wB / 2 + 0.06);
        b.box(mPlasterTrim, vx, yWall1 + 0.62, czB, 0.06, 0.56, 0.46, { r: 0.02 });
        b.box(mSlateRoof, vx + sx * 0.025, yWall1 + 0.62, czB, 0.03, 0.44, 0.34, { r: 0.01 });
      }

      // Terracotta Brick Chimney (cerobong asap bata) on rear-right roof slope
      const chX = 2.05, chZ = -3.02;
      b.box(mQuoin, chX, 4.65, chZ, 0.62, 1.45, 0.62, { r: 0.01 });
      b.box(mPlasterTrim, chX, 5.38, chZ, 0.72, 0.10, 0.72);
      b.cyl(mBrickDark, chX - 0.12, 5.52, chZ, 0.09, 0.22);
      b.cyl(mBrickDark, chX + 0.12, 5.52, chZ, 0.09, 0.22);

      // Downspout Gutter Pipes & Wooden Rain Barrels (tong kayu) at both rear side corners
      for (const sx of [-1, 1]) {
        const pipeX = sx * (wB / 2 + 0.10);
        const barrelX = sx * (wB / 2 + 0.36);
        const rZ = zBack + 0.18;
        // Metal downspout gutter pipe from eaves to rain barrel
        b.cyl(mSlateTrim, pipeX, 2.15, rZ, 0.042, 2.35);
        b.box(mSlateTrim, (pipeX + barrelX) / 2, 0.98, rZ, 0.28, 0.07, 0.07, { rz: sx * -0.35 });
        // Staved Wooden Rain Barrel with dark iron hoops & water top
        b.cyl(mOakDoor, barrelX, 0.56, rZ, 0.28, 0.68);
        b.cyl(mIronBlack, barrelX, 0.34, rZ, 0.29, 0.04);
        b.cyl(mIronBlack, barrelX, 0.56, rZ, 0.30, 0.04);
        b.cyl(mIronBlack, barrelX, 0.78, rZ, 0.29, 0.04);
        b.cyl(mWater, barrelX, 0.89, rZ, 0.24, 0.02);
        // Lush corner bush beside the rain barrel
        const cBush = new THREE.Mesh(crownGeo, mBush);
        cBush.position.set(barrelX, 0.44, rZ - 0.34);
        cBush.scale.set(0.28, 0.26, 0.28);
        registerWindMesh(cBush, 14.2 + sx, 'foliage');
      }

      // ----------------------------------------------------------------------
      // 7. ORNATE CLOCK & BELL TOWER (Synchronized Clock, 3D Bell, Rooster Weathervane)
      // ----------------------------------------------------------------------
      const cxT = 0, czT = -1.55;
      // Pedestal Base on Roof Ridge (y = 4.35 -> 5.08)
      b.box(mPlaster, cxT, 4.70, czT, 1.72, 0.72, 1.72, { r: 0.02 });
      b.box(mPlasterTrim, cxT, 5.10, czT, 1.94, 0.12, 1.94, { r: 0.01 });

      // Clock & Bell Stage (y = 5.16 -> 6.32)
      const yBell0 = 5.16, yBell1 = 6.32, hBell = yBell1 - yBell0;
      const wTower = 1.54;
      // 4 Corner Slate Blue Pilasters supporting the belfry/clock stage
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          b.box(mSlateRoof, cxT + sx * 0.64, (yBell0 + yBell1) / 2, czT + sz * 0.64, 0.28, hBell, 0.28, { r: 0.01 });
        }
      }
      // Cream plaster spandrels & arched belfry lintels on all 4 sides
      b.box(mPlaster, cxT, yBell0 + 0.16, czT, wTower - 0.04, 0.32, wTower - 0.04);
      b.box(mPlaster, cxT, yBell1 - 0.18, czT, wTower - 0.04, 0.34, wTower - 0.04);
      // Central cream core for the Front/Back Clock faces (leaving Left/Right belfry open for the 3D Golden Bell!)
      b.box(mPlaster, cxT, (yBell0 + yBell1) / 2, czT, 0.56, hBell, wTower - 0.02);
      // Dark recessed side belfry arch backdrops on X faces so the golden bell stands out in high contrast
      b.box(mIronBlack, cxT, (yBell0 + yBell1) / 2, czT, 0.62, hBell - 0.28, 0.62);

      // Front (+Z) & Back (-Z) Round Analog Clock Dials (>= 0.075u outside tower wall + polygonOffset)
      const clockY = 5.75;
      const clockHands = [];
      for (const sz of [1, -1]) {
        const zDial = czT + sz * (wTower / 2 + 0.075);
        // Gold bezel ring around clock face
        const bezelGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.04, 24);
        bezelGeo.rotateX(Math.PI / 2);
        b.add(mGoldBell, solid(bezelGeo), cxT, clockY, zDial - sz * 0.015);
        // High-res Clock Face panel on atlas (polygonOffset enabled on M.sign)
        b.panel(M.sign, R.mayorClock, cxT, clockY, zDial, 0.84, 0.84, sz === 1 ? 0 : Math.PI);

        // Live 3D Pivoting Hour & Minute Hands (synchronized with Ceria Town daytime clock!)
        const handGroup = new THREE.Group();
        handGroup.position.set(cxT, clockY, zDial + sz * 0.035);
        if (sz === -1) handGroup.rotation.y = Math.PI;
        g.add(handGroup);

        const hourPivot = new THREE.Group();
        const hourMesh = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.22, 0.02), mIronBlack);
        hourMesh.position.y = 0.085;
        hourPivot.add(hourMesh);

        const minutePivot = new THREE.Group();
        const minuteMesh = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.31, 0.02), mIronBlack);
        minuteMesh.position.set(0, 0.125, 0.012);
        minutePivot.add(minuteMesh);

        const pinMesh = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), mGoldBell);
        pinMesh.position.z = 0.018;

        handGroup.add(hourPivot, minutePivot, pinMesh);
        clockHands.push({ hourPivot, minutePivot });
      }
      S.clockHands = clockHands;

      // Swinging 3D Golden Bell (Lonceng Emas 3D) visible in the side belfry openings & front/side 3/4 view!
      const bellGroup = new THREE.Group();
      bellGroup.position.set(cxT, yBell1 - 0.16, czT);
      g.add(bellGroup);
      const bBell = new Batch();
      // Left & Right visible side bells in the belfry arches
      for (const sx of [-1, 1]) {
        const bx0 = sx * 0.52;
        bBell.box(mOakDark, bx0, -0.04, 0, 0.14, 0.08, 0.36);
        bBell.cyl(mGoldBell, bx0, -0.22, 0, 0.16, 0.26);
        bBell.add(mGoldBell, unitCone, bx0, -0.34, 0, 0.42, 0.22, 0.42);
        bBell.cyl(mGoldBell, bx0, -0.44, 0, 0.23, 0.05);
        bBell.sphere(mGoldBell, bx0, -0.50, 0, 0.055);
      }
      bBell.build(bellGroup);
      S.bellPivot = bellGroup;

      // Slate Blue Cupola Dome Roof (y = 6.32 -> 7.28)
      b.box(mPlasterTrim, cxT, 6.38, czT, 1.88, 0.12, 1.88, { r: 0.01 });
      b.box(mSlateRoof, cxT, 6.56, czT, 1.56, 0.26, 1.56, { r: 0.04 });
      b.box(mSlateRoof, cxT, 6.80, czT, 1.24, 0.26, 1.24, { r: 0.04 });
      b.add(mSlateRoof, makeTrianglePrism(1.26, 0.42, 1.26, false), cxT, 6.90, czT);
      b.add(mSlateRoof, makeTrianglePrism(1.26, 0.42, 1.26, true), cxT, 6.90, czT);
      b.cyl(mPlasterTrim, cxT, 7.32, czT, 0.18, 0.18);

      // Rotating 3D Golden Rooster Weathervane (Penunjuk Arah Angin Ayam Jantan) at Peak (y = 7.40 -> 8.18)
      // Fixed wrought-iron mast & N-S-E-W compass crossbars
      b.cyl(mIronBlack, cxT, 7.68, czT, 0.028, 0.58);
      b.box(mIronBlack, cxT, 7.62, czT, 0.62, 0.028, 0.028);
      b.box(mIronBlack, cxT, 7.62, czT, 0.028, 0.028, 0.62);
      b.sphere(mGoldBell, cxT, 7.48, czT, 0.065);

      const weathervaneGroup = new THREE.Group();
      weathervaneGroup.position.set(cxT, 7.90, czT);
      g.add(weathervaneGroup);
      const bRooster = new Batch();
      // Directional arrow beneath rooster
      bRooster.box(mGoldBell, 0, -0.08, 0, 0.56, 0.03, 0.03);
      bRooster.box(mGoldBell, 0.28, -0.08, 0, 0.10, 0.08, 0.03, { rz: Math.PI / 4 });
      // Rooster body, proud chest, head, red comb, beak & arched tail feathers
      bRooster.box(mGoldBell, 0.02, 0.04, 0, 0.24, 0.14, 0.08, { r: 0.03 });
      bRooster.box(mGoldBell, 0.12, 0.14, 0, 0.12, 0.15, 0.07, { r: 0.02 });
      bRooster.box(mRoosterRed, 0.13, 0.24, 0, 0.10, 0.06, 0.03, { r: 0.01 });
      bRooster.box(mRoosterRed, 0.20, 0.14, 0, 0.06, 0.03, 0.03);
      bRooster.box(mGoldBell, -0.14, 0.15, 0, 0.14, 0.20, 0.05, { rz: 0.38, r: 0.02 });
      bRooster.box(mGoldBell, -0.22, 0.22, 0, 0.12, 0.16, 0.04, { rz: 0.65, r: 0.02 });
      bRooster.build(weathervaneGroup);
      S.weathervane = weathervaneGroup;

      S.rooftopBirds = [];

      S.queuePath = [
        [-0.8, 2.0], [-1.6, 2.4], [-1.6, 3.8], [1.6, 3.8], [1.6, 2.4]
      ];
      b.build(g);

      const occluder = new THREE.Mesh(unitBox, linkProbe);
      occluder.visible = false;
      occluder.position.set(0, (H + 0.4) / 2, -0.8);
      occluder.scale.set(7.4, H + 0.4, 7.6);
      occluder.userData.store = index;
      villageOuterLot.add(occluder);
      links.push(occluder);

      for (const L of S.lights) {
        g.localToWorld(L[0]);
        addLight(L[0], L[1], L[2], L[3], index);
      }
      S.focus = g.localToWorld(new THREE.Vector3(0, 2.8, 0.6));
      S.label = g.localToWorld(new THREE.Vector3(0, H + 0.85, -1.2));
      stores.push(S);
      return;
    }

    if (style === 'studio') {
      // ======================================================================
      // STORE #4: CIRCUIT & BYTE (3-Story Modern Industrial Tech & Electronics Flagship)
      // 100% Faithful to the 4-Panel Architectural Concept Sheet:
      // 1) Lantai 1 — Ground Floor Gadget Display & Kiosk Terminal:
      //    - Warm exposed concrete columns & piers (#D8D2C7) + dark metal frame (#2B2F35)
      //    - Centered double glass entrance doors + illuminated black box sign "CIRCUIT & BYTE"
      //    - Left Display Vitrine: Podium tables with 3D Smartphones & Tablets (glowing cyan/pink screens)
      //    - Right Display Vitrine: Wood/white table with open 3D Ultrabook Laptops (glowing screens)
      //    - Front Sidewalk Props: 1 Interactive Digital Kiosk at front-left corner + row of short
      //      metal Street Bollards & 2 sleek modern corner street lamps (no old red queue ropes!)
      // 2) Lantai 2 — Audio & Gaming Studio Floor (2-Row × 5-Column Steel Grid Window Wall):
      //    - Warm golden-amber glowing studio backdrop (#FFE29E, emissive #FFB340)
      //    - 3D Headphones on Stands, Studio Speaker Boxes, Gaming Monitors, and RGB PC Cases
      //      arranged neatly on shelves behind each of the 10 glass bays
      //    - Side facade: Horizontal Wood Slat Accent (#9E6B43) + small cantilevered iron-railed balcony
      // 3) Lantai 3 & Atap — Neon Billboard with Steel Scaffolding Frame + Rooftop Equipment:
      //    - Industrial Steel Truss / Scaffolding Frame surrounding the large Neon Billboard
      //      with 4 curved gooseneck floodlights on top
      //    - High-res Neon Billboard (#121A2B) with glowing Cyan (#00F0FF) & Pink (#FF3399)
      //      Smartphone/Earphone icon, "CIRCUIT & BYTE: NEW TECH UNLOCKED", TWS Earbuds, & Gamepad
      //    - Flat roof with iron railing: 2 Large HVAC Units (dual circular fan grilles),
      //      2 Tilted Blue Solar Panels, and 1 Parabolic Satellite Dish
      //    - Side utility wall: Electrical panel box + vertical conduit pipes, louver vent,
      //      and side steel fire-escape ladder leading up to the billboard scaffolding frame
      // ======================================================================
      const villageOuterLot = new THREE.Group();
      villageOuterLot.position.copy(g.position);
      villageOuterLot.rotation.copy(g.rotation);
      world.add(villageOuterLot);
      const bLot = new Batch();
      // Unified Full-Block Sidewalk for Store #4 (Circuit & Byte):
      // 100% matching the warm stone tiles (#d8cfc4 with #9E9282 grout lines) & curb (#bfb4a6)
      // right under the foot of Store #4 across the entire 11.0 x 11.0 block (flush at y = 0.165, no grass border!)
      const circuitPavingTex = pavingTex.clone();
      circuitPavingTex.wrapS = circuitPavingTex.wrapT = THREE.RepeatWrapping;
      circuitPavingTex.repeat.set(0.3125, 0.3125); // 0.80u square stone tiles matching Store #4 under-building terrace
      circuitPavingTex.needsUpdate = true;
      const mCircuitPaving = mat('#d8cfc4', { map: circuitPavingTex, roughness: 0.65 }, t);
      bLot.add(M.curb, hollowCurbRingGeo(BLOCK, BLOCK, 1.2, 0.14, 0.190), 0, 0, 0);
      bLot.add(M.curb, roundedRectGeometry(BLOCK - 0.28, BLOCK - 0.28, 1.06, 0.155), 0, 0, 0);
      bLot.add(mCircuitPaving, lotGeometry(BLOCK - 0.28, 1.06, 0.025), 0, 0.155, 0);
      const tactOff4 = BLOCK * 0.5 - 0.23;
      const tactSpan4 = BLOCK - 2.40;
      for (const s of [-1, 1]) {
        bLot.box(M.tactileYellow, 0, 0.1875, s * tactOff4, tactSpan4, 0.015, 0.16);
        bLot.box(M.tactileYellow, s * tactOff4, 0.1875, 0, 0.16, 0.015, tactSpan4);
      }
      bLot.build(villageOuterLot);
      S.villageOuterLot = villageOuterLot;

      // Materials for Circuit & Byte
      const mConcrete = mat('#D8D2C7', { roughness: 0.65 }, t);
      const mConcreteLight = mat(
        '#E5E0D5',
        { roughness: 0.65, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 },
        t
      );
      const mConcreteDark = mat(
        '#B8B1A4',
        { roughness: 0.65, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 },
        t
      );
      const mSteelDark = mat(
        '#262A30',
        { roughness: 0.45, metalness: 0.42, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 },
        t
      );
      const mSteelMid = mat(
        '#454C56',
        { roughness: 0.42, metalness: 0.48, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 },
        t
      );
      const mInk = mat(
        '#1B1E23',
        { roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 },
        t
      );
      const mWoodSlat = mat(
        '#9E6B43',
        { roughness: 0.72, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 },
        t
      );
      const mWoodTable = mat('#C49260', { roughness: 0.65 }, t);
      const mPodiumWhite = mat('#F4F1EA', { roughness: 0.48 }, t);
      const mSilverAlu = mat(
        '#CFD6DF',
        { roughness: 0.30, metalness: 0.68, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 },
        t
      );
      const mHvacGrey = mat('#B2B8C0', { roughness: 0.58, metalness: 0.25 }, t);
      const mSolarBlue = mat('#1D4E8F', { roughness: 0.25, metalness: 0.45 }, t);

      // Glowing Interior & Screen Materials
      const mFloor1Backdrop = mat('#FFF0CE', { emissive: '#FFBE58', emissiveIntensity: 1.05, roughness: 0.40 }, t);
      const mFloor2Backdrop = mat('#FFE29E', { emissive: '#FFB038', emissiveIntensity: 1.12, roughness: 0.40 }, t);
      const mFloor3Backdrop = mat('#F8E6BE', { emissive: '#FFA834', emissiveIntensity: 0.94, roughness: 0.42 }, t);
      registerWindowGlow(mFloor1Backdrop, 1.05);
      registerWindowGlow(mFloor2Backdrop, 1.12);
      registerWindowGlow(mFloor3Backdrop, 0.94);
      const mCyanGlow = mat(
        '#B8FFFF',
        { emissive: '#00F0FF', emissiveIntensity: 0.95, roughness: 0.25, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 },
        t
      );
      const mPinkGlow = mat(
        '#FFB8E2',
        { emissive: '#FF3399', emissiveIntensity: 0.90, roughness: 0.25, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 },
        t
      );
      const mWarmLamp = mat(
        '#FFF8E4',
        { emissive: '#FFD89B', emissiveIntensity: 1.1, roughness: 0.30, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 },
        t
      );
      bulbMaterials.push(mWarmLamp);

      const mStoreGlass = new THREE.MeshStandardMaterial({
        color: '#D8ECFA',
        emissive: '#FFB85C',
        emissiveIntensity: 0.16,
        roughness: 0.1,
        metalness: 0.15,
        transparent: true,
        opacity: 0.35,
        depthWrite: false
      });
      mStoreGlass.userData.noCast = true;
      patch(mStoreGlass, t);

      const mNeonSign = mat(
        '#FFFFFF',
        {
          map: atlas.tex,
          emissive: '#FFFFFF',
          emissiveMap: atlas.tex,
          emissiveIntensity: 0.42,
          roughness: 0.42,
          polygonOffset: true,
          polygonOffsetFactor: -3,
          polygonOffsetUnits: -3
        },
        t
      );
      mNeonSign.userData.noCast = true;
      mNeonSign.userData.noReceive = true;

      // Compact building terrace inside stageBaseGroup (hidden in Town View so the 11.0x11.0 block sidewalk
      // is 100% flat & flush at y = 0.180; shown when Store #4 is isolated in catalog view)
      const cxB = -0.30, czB = -0.55;
      const stageBaseGroup = new THREE.Group();
      stageBaseGroup.visible = false;
      g.add(stageBaseGroup);
      const bStage = new Batch();
      bStage.add(M.curb, hollowCurbRingGeo(7.80, 8.00, 0.65, 0.12, 0.190), cxB, 0, czB);
      bStage.add(M.curb, roundedRectGeometry(7.56, 7.76, 0.53, 0.155), cxB, 0, czB);
      bStage.add(M.paving, roundedRectGeometry(7.56, 7.76, 0.53, 0.025), cxB, 0.155, czB);
      bStage.build(stageBaseGroup);
      S.stageBaseGroup = stageBaseGroup;

      // Building footprint coordinates
      const x0 = -3.20, x1 = 2.60; // W = 5.80, center cx = -0.30
      const z0 = -3.30, z1 = 1.85; // D = 5.15, center cz = -0.725
      const bw = x1 - x0, bd = z1 - z0;
      const czWall = (z0 + z1) / 2;
      const yBase = 0.18;
      const yF1Top = 2.38;
      const yF2Top = 4.62;
      const yF3Top = 6.42;

      // ======================================================================
      // 1. LANTAI 1 — GROUND FLOOR GADGET DISPLAY & KIOSK TERMINAL (y = 0.18..2.38)
      //    - Outer Wall Surface at z1 = 1.85 (front) and x0 = -3.20 (left)
      //    - Interior core box shrunk by >= 0.20m in width, height & depth so inner walls never touch outer walls!
      //    - Columns/piers stop cleanly at y = 2.02 below the Upper Concrete Lintel Band (y = 2.02..2.38) so zero coplanar overlap!
      //    - "CIRCUIT & BYTE" banner & backing box pushed +0.06m–0.08m outward from the 1st-floor wall surface!
      // ======================================================================
      // Core Ground Floor Concrete Volume shrunk by >= 0.20m in width, height & depth + non-overlapping Rear (-Z at z0) and Right (+X at x1) outer walls
      const yF1Lintel0 = 2.02;
      b.box(mConcrete, cxB + 0.12, (yBase + yF1Top - 0.14) / 2, czWall - 0.14, bw - 0.88, yF1Top - yBase - 0.14, bd - 1.12);
      b.box(mConcrete, cxB, (yBase + yF1Top) / 2, z0 + 0.16, bw, yF1Top - yBase, 0.32);
      b.box(mConcrete, x1 - 0.16, (yBase + yF1Top) / 2, (z0 + 0.32 + z1) / 2, 0.32, yF1Top - yBase, bd - 0.32);
      // Ground plinth / dark stone base skirt (protruding +0.03m outside rear & right walls so zero coplanar faces)
      b.box(mSteelDark, cxB + 0.12, yBase + 0.07, czWall - 0.14, bw - 0.80, 0.14, bd - 1.04);
      b.box(mSteelDark, cxB, yBase + 0.07, z0 - 0.015, bw + 0.06, 0.14, 0.03);
      b.box(mSteelDark, x1 + 0.015, yBase + 0.07, czWall, 0.03, 0.14, bd + 0.06);

      // Front Facade Exposed Concrete Columns (#D8D2C7) flush at z1 = 1.85, stopping at yF1Lintel0 = 2.02 (zero overlap with lintel band!)
      const hF1Col = yF1Lintel0 - yBase;
      const yF1ColMid = (yBase + yF1Lintel0) / 2;
      for (const px of [x0 + 0.22, -1.24, 0.64, x1 - 0.22]) {
        const colW = px === x0 + 0.22 || px === x1 - 0.22 ? 0.44 : 0.28;
        b.box(mConcrete, px, yF1ColMid, z1 - 0.16, colW, hF1Col, 0.32);
      }
      // Left-side corner piers flush at x0 = -3.20, stopping at yF1Lintel0 = 2.02 and non-overlapping with front/rear walls!
      b.box(mConcrete, x0 + 0.16, yF1ColMid, -2.56, 0.32, hF1Col, 0.84);
      b.box(mConcrete, x0 + 0.16, yF1ColMid, 1.28, 0.32, hF1Col, 0.50);
      // Upper Ground-Floor Concrete Lintel Band (y = 2.02..2.38, protruding +0.02m outward with polygonOffset so zero flicker!)
      b.box(mConcreteLight, cxB, 2.20, z1 - 0.15, bw + 0.04, 0.36, 0.34);
      b.box(mConcreteLight, x0 + 0.15, 2.20, (z0 + 0.32 + z1 - 0.32) / 2, 0.34, 0.36, bd - 0.64);
      // Floor 1-to-2 Projecting Steel & Concrete Cornice Slab (y = 2.38..2.50, cleanly stacked above yF1Top = 2.38)
      b.box(mConcreteDark, cxB, 2.415, czWall, bw + 0.20, 0.09, bd + 0.20);
      b.box(mSteelDark, cxB, 2.475, czWall, bw + 0.24, 0.05, bd + 0.24);

      // Centered Automatic Double Sliding Glass Doors (x = -1.10..0.50, center = -0.30) right below "CIRCUIT & BYTE"
      const doorX = cxB;
      const fGlassZ1 = z1 - 0.05; // Recessed 0.05m inward from wall z1
      const fFrameZ1 = z1 - 0.02; // Protruding +0.03m in front of glass
      const mSlidingDoorGlass = new THREE.MeshStandardMaterial({
        color: '#8CE2FF',
        emissive: '#00C8FF',
        emissiveIntensity: 0.22,
        roughness: 0.10,
        metalness: 0.18,
        transparent: true,
        opacity: 0.40,
        depthWrite: false
      });
      mSlidingDoorGlass.userData.noCast = true;
      patch(mSlidingDoorGlass, t);

      // Recessed Warm Interior Foyer Backdrop (z1 - 0.68), Glowing Ceiling Downlight Panel & Dark Welcome Mat
      b.box(mFloor2Backdrop, doorX, 1.10, z1 - 0.68, 1.64, 1.84, 0.04);
      b.box(mWarmLamp, doorX, 1.92, z1 - 0.42, 1.48, 0.04, 0.36);
      b.box(mInk, doorX, yBase + 0.015, z1 - 0.26, 1.62, 0.025, 0.36);
      // Interior Display Counter silhouette pushed >= 0.38m behind the door glass (z1 - 0.52)
      b.box(mWoodTable, doorX, 0.62, z1 - 0.52, 1.12, 0.52, 0.18);
      b.box(mWarmLamp, doorX, 0.90, z1 - 0.50, 0.96, 0.04, 0.14);

      // Dark Anodized Aluminum Automatic Sliding Door Frame & Overhead Sensor Track Header (+0.03m in front of glass)
      b.box(mSteelDark, doorX, 1.98, fFrameZ1, 1.72, 0.10, 0.028);
      b.box(mInk, doorX, 2.00, fFrameZ1 + 0.022, 0.38, 0.06, 0.02);
      // Outer frame jambs, side-lite mullions & central sliding door meeting stiles (+0.03m in front of glass)
      for (const sx of [-0.82, -0.46, -0.025, 0.025, 0.46, 0.82]) {
        const stW = Math.abs(sx) < 0.10 ? 0.032 : Math.abs(sx) > 0.70 ? 0.065 : 0.045;
        b.box(mSteelDark, doorX + sx, 1.06, fFrameZ1, stW, 1.76, 0.028);
      }
      // Top & bottom aluminum door rails
      b.box(mSteelDark, doorX, 0.21, fFrameZ1, 1.64, 0.05, 0.028);
      b.box(mSteelDark, doorX, 1.89, fFrameZ1, 1.64, 0.05, 0.028);
      // Transparent Sliding Glass Door Leaves + Fixed Sidelights recessed at z1 - 0.05
      b.add(mSlidingDoorGlass, unitBox, doorX - 0.64, 1.06, fGlassZ1, 0.32, 1.66, 0.012);
      b.add(mSlidingDoorGlass, unitBox, doorX - 0.24, 1.06, fGlassZ1, 0.39, 1.66, 0.012);
      b.add(mSlidingDoorGlass, unitBox, doorX + 0.24, 1.06, fGlassZ1, 0.39, 1.66, 0.012);
      b.add(mSlidingDoorGlass, unitBox, doorX + 0.64, 1.06, fGlassZ1, 0.32, 1.66, 0.012);
      // Sleek vertical brushed-aluminum door pulls
      for (const hx of [-0.11, 0.11]) {
        b.cyl(mSilverAlu, doorX + hx, 1.06, z1 + 0.015, 0.014, 0.44);
      }

      // Illuminated Black Box Sign "CIRCUIT & BYTE" above Main Entrance (pushed +0.06m–0.08m outside 1st-floor wall surface!)
      b.box(mSteelDark, doorX, 2.20, z1 + 0.055, 2.26, 0.38, 0.04, { r: 0.01 });
      b.panel(mNeonSign, R.circuitFasciaSign, doorX, 2.20, z1 + 0.080, 2.16, 0.34);

      // Left Ground-Floor Vitrine (x = -2.76..-1.38) — Smartphone & Tablet Display Podiums
      const lxVit = -2.07, lwVit = 1.38;
      b.box(mFloor1Backdrop, lxVit, 1.16, z1 - 0.78, lwVit - 0.20, 1.62, 0.04);
      // Low window sill wall flush at z1 + recessed glass (z1 - 0.05) + steel frame (+0.03m in front of glass at z1 - 0.02)
      b.box(mConcreteDark, lxVit, 0.30, z1 - 0.16, lwVit, 0.26, 0.32);
      b.add(mStoreGlass, unitBox, lxVit, 1.20, fGlassZ1, lwVit - 0.04, 1.50, 0.012);
      b.box(mSteelDark, lxVit, 1.18, fFrameZ1, 0.045, 1.68, 0.028);
      b.box(mSteelDark, lxVit, 1.98, fFrameZ1, lwVit + 0.06, 0.06, 0.028);
      b.box(mSteelDark, lxVit, 0.42, fFrameZ1, lwVit + 0.06, 0.06, 0.028);

      // 2 Podium Display Tables inside Left Vitrine pushed >= 0.33m behind glass (center at z1 - 0.56, front edge at z1 - 0.39)
      for (const [px, pCol, sW, sH] of [
        [lxVit - 0.33, mCyanGlow, 0.22, 0.38],
        [lxVit + 0.33, mPinkGlow, 0.32, 0.26]
      ]) {
        b.box(mPodiumWhite, px, 0.62, z1 - 0.56, 0.50, 0.42, 0.30);
        b.box(mWoodTable, px, 0.85, z1 - 0.56, 0.54, 0.04, 0.34);
        b.box(mSilverAlu, px, 0.92, z1 - 0.58, 0.08, 0.12, 0.08, { rx: -0.25 });
        b.box(mSteelDark, px, 1.05, z1 - 0.54, sW + 0.04, sH + 0.04, 0.025, { rx: -0.22 });
        b.box(pCol, px, 1.05, z1 - 0.522, sW, sH, 0.015, { rx: -0.22 });
      }

      // Right Ground-Floor Vitrine (x = 0.78..2.16) — Ultrabook Laptop Display Table
      const rxVit = 1.47, rwVit = 1.38;
      b.box(mFloor1Backdrop, rxVit, 1.16, z1 - 0.78, rwVit - 0.20, 1.62, 0.04);
      b.box(mConcreteDark, rxVit, 0.30, z1 - 0.16, rwVit, 0.26, 0.32);
      b.add(mStoreGlass, unitBox, rxVit, 1.20, fGlassZ1, rwVit - 0.04, 1.50, 0.012);
      b.box(mSteelDark, rxVit, 1.18, fFrameZ1, 0.045, 1.68, 0.028);
      b.box(mSteelDark, rxVit, 1.98, fFrameZ1, rwVit + 0.06, 0.06, 0.028);
      b.box(mSteelDark, rxVit, 0.42, fFrameZ1, rwVit + 0.06, 0.06, 0.028);

      // Wide Laptop Display Table + 2 Open 3D Ultrabook Laptops pushed >= 0.33m behind glass (center at z1 - 0.56)
      b.box(mPodiumWhite, rxVit, 0.62, z1 - 0.56, 1.14, 0.42, 0.32);
      b.box(mWoodTable, rxVit, 0.85, z1 - 0.56, 1.20, 0.05, 0.36);
      for (const [lx, scrMat] of [
        [rxVit - 0.31, mWarmLamp],
        [rxVit + 0.31, mCyanGlow]
      ]) {
        b.box(mSilverAlu, lx, 0.89, z1 - 0.52, 0.40, 0.025, 0.26);
        b.box(mSteelDark, lx, 0.905, z1 - 0.52, 0.32, 0.01, 0.16);
        b.box(mSilverAlu, lx, 1.04, z1 - 0.63, 0.40, 0.28, 0.02, { rx: -0.20 });
        b.box(scrMat, lx, 1.04, z1 - 0.615, 0.36, 0.23, 0.012, { rx: -0.20 });
      }

      // Left-Side Ground Floor Corner Entrance & Display Window:
      // - Glass recessed 0.05m inward (x0 + 0.05)
      // - Steel frames/mullions +0.03m in front of glass (x0 + 0.02)
      // - Backdrop at x0 + 0.28 (shrunk by 0.20m in depth & height so it never touches piers)
      const szCenter = -0.55;
      const lGlassX0 = x0 + 0.05;
      const lFrameX0 = x0 + 0.02;
      b.box(mConcreteDark, x0 + 0.16, 0.30, szCenter, 0.32, 0.26, 3.16);
      b.box(mFloor1Backdrop, x0 + 0.28, 1.16, szCenter, 0.04, 1.56, 3.00);
      b.add(mStoreGlass, unitBox, lGlassX0, 1.20, szCenter, 0.012, 1.50, 3.16);
      b.box(mSteelDark, lFrameX0, 1.98, szCenter, 0.028, 0.06, 3.24);
      b.box(mSteelDark, lFrameX0, 0.42, szCenter, 0.028, 0.06, 3.24);
      for (const dz of [-1.58, -0.55, 0.55, 1.58]) {
        b.box(mSteelDark, lFrameX0, 1.18, szCenter + dz, 0.028, 1.62, 0.055);
      }
      // Side "CIRCUIT & BYTE" illuminated box sign above left corner entrance (pushed +0.06m–0.08m outside 1st-floor wall surface!)
      b.box(mSteelDark, x0 - 0.055, 2.20, szCenter, 0.04, 0.38, 2.10, { r: 0.01 });
      b.panel(mNeonSign, R.circuitFasciaSign, x0 - 0.080, 2.20, szCenter, 2.00, 0.34, -Math.PI / 2);

      // ======================================================================
      // TECH PROMENADE SIDEWALK AMENITIES (Clean Sidewalk Floor — Zero Glowing Floor Strips!)
      // ======================================================================
      const mWhiteLed = mat('#FFF6DC', { emissive: '#FFD89B', emissiveIntensity: 0.9, roughness: 0.25 }, t);
      bollardMaterials.push(mWhiteLed);
      const mBasaltTrim = mat(
        '#363C45',
        { roughness: 0.62, metalness: 0.22, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 },
        t
      );

      // 1) Interactive Digital Info Kiosk pulled FLUSH against the Front-Left Concrete Corner Pier (x = -2.96, z = z1 + 0.26 = 2.11)
      b.box(mBasaltTrim, -2.96, 0.188, z1 + 0.26, 0.64, 0.006, 0.50);
      const kioskGrp = new THREE.Group();
      kioskGrp.position.set(-2.96, yBase, z1 + 0.26);
      kioskGrp.rotation.y = 0;
      const bKiosk = new Batch();
      bKiosk.box(mSteelDark, 0, 0.04, 0, 0.52, 0.08, 0.42, { r: 0.02 });
      bKiosk.box(mSilverAlu, 0, 0.56, 0, 0.42, 0.96, 0.22, { r: 0.02 });
      bKiosk.box(mSteelDark, 0, 0.72, 0.08, 0.46, 0.64, 0.08, { rx: -0.22, r: 0.02 });
      bKiosk.panel(mNeonSign, R.circuitKioskScreen, 0, 0.73, 0.135, 0.38, 0.56, 0, -0.22);
      bKiosk.box(mSilverAlu, 0, 1.08, 0.06, 0.48, 0.06, 0.28, { rx: 0.18 });
      bKiosk.build(kioskGrp);
      g.add(kioskGrp);

      // 2) Single Sleek Modern Tech Bench pulled FLUSH against the Front Right Showcase Window Wall (bx = 1.47, bz = z1 + 0.28 = 2.13),
      //    leaving > 80% of the front and side sidewalks completely empty!
      for (const [bx, bz] of [[1.47, z1 + 0.28]]) {
        // Dark basalt base pad (no glowing strip on the sidewalk floor)
        b.box(mBasaltTrim, bx, yBase + 0.012, bz, 1.44, 0.020, 0.48, { r: 0.02 });
        // Sculpted architectural concrete & dark steel geometric side legs
        for (const sx of [-0.52, 0.52]) {
          b.box(mSteelDark, bx + sx, yBase + 0.21, bz, 0.16, 0.38, 0.42, { r: 0.02 });
          b.box(mConcreteLight, bx + sx * 1.04, yBase + 0.22, bz, 0.10, 0.40, 0.44, { r: 0.02 });
        }
        // Central recessed dark steel core beam
        b.box(mSteelDark, bx, yBase + 0.19, bz - 0.04, 1.08, 0.28, 0.24);
        // Cantilevered architectural concrete seat slab + warm composite wood slat deck
        b.box(mConcreteLight, bx, yBase + 0.39, bz, 1.42, 0.07, 0.44, { r: 0.02 });
        b.box(mWoodTable, bx, yBase + 0.445, bz + 0.01, 1.32, 0.032, 0.38, { r: 0.01 });
        // Sleek brushed-aluminum & dark-steel low lumbar backrest bar along the rear wall edge (-Z)
        for (const sx of [-0.46, 0.46]) {
          b.box(mSteelMid, bx + sx, yBase + 0.52, bz - 0.18, 0.045, 0.18, 0.045);
        }
        b.box(mSilverAlu, bx, yBase + 0.60, bz - 0.18, 1.32, 0.055, 0.055, { r: 0.02 });
      }

      // 4) Exactly 4 Sleek Modern Black L-Shaped Cantilever Streetlamps at the 4 Outer Curb Corners of Store #4 (~0.35m from outer curb edge, arms pointing outward!)
      for (const [lx, lz, armRotY] of [
        [-4.92, 4.92, -Math.PI * 0.25], // Front-Left Outer Curb Corner (arm points outward -X/+Z toward street)
        [4.92, 4.92, Math.PI * 0.25],   // Front-Right Outer Curb Corner (arm points outward +X/+Z toward street)
        [-4.92, -4.92, -Math.PI * 0.75], // Back-Left Outer Curb Corner (arm points outward -X/-Z toward street)
        [4.92, -4.92, Math.PI * 0.75]   // Back-Right Outer Curb Corner (arm points outward +X/-Z toward street)
      ]) {
        b.cyl(mSteelDark, lx, yBase + 0.06, lz, 0.11, 0.12);
        b.cyl(mSteelDark, lx, yBase + 1.24, lz, 0.042, 2.32);
        const armX = lx + Math.sin(armRotY) * 0.26;
        const armZ = lz + Math.cos(armRotY) * 0.26;
        b.box(mSteelDark, armX, yBase + 2.38, armZ, 0.065, 0.055, 0.56, { ry: armRotY });
        const lampHeadX = lx + Math.sin(armRotY) * 0.42;
        const lampHeadZ = lz + Math.cos(armRotY) * 0.42;
        b.box(mWarmLamp, lampHeadX, yBase + 2.345, lampHeadZ, 0.16, 0.032, 0.26, { ry: armRotY });
        b.box(mCyanGlow, lampHeadX, yBase + 2.415, lampHeadZ, 0.14, 0.014, 0.22, { ry: armRotY });
        addPolePointLight(g, lampHeadX, yBase + 2.22, lampHeadZ, 1.0, '#FFD89B', 9, 2.0);
        S.lights.push([new THREE.Vector3(lampHeadX, yBase + 2.22, lampHeadZ), '#FFD89B', 4.5, 2.1]);
      }

      // ======================================================================
      // 2. LANTAI 2 — AUDIO & GAMING STUDIO FLOOR (2-Row × 5-Column Steel Grid Windows, y = 2.48..4.62)
      //    - Outer Wall Surface at z1 = 1.85 (front) and x0 = -3.20 (left)
      //    - 2nd-Floor Window Glass recessed 0.05m inward (z1 - 0.05 = 1.80, x0 + 0.05 = -3.15)
      //    - Steel Grid Mullions protruding +0.03m in front of glass (z1 - 0.02 = 1.83, x0 + 0.02 = -3.18)
      //    - 2nd-Floor Light Backdrop recessed >= 0.16m behind glass (z1 - 0.56 on front, x0 + 0.22 on left)
      // ======================================================================
      // Core 2nd-Floor Concrete Body (shrunk >= 0.20m inward from outer walls) + non-overlapping Rear (-Z at z0) and Right (+X at x1) outer walls
      b.box(mConcrete, cxB + 0.12, (yF1Top + yF2Top) / 2, czWall - 0.14, bw - 0.88, yF2Top - yF1Top - 0.12, bd - 0.96);
      b.box(mConcrete, cxB, (yF1Top + yF2Top) / 2, z0 + 0.16, bw, yF2Top - yF1Top, 0.32);
      b.box(mConcrete, x1 - 0.16, (yF1Top + yF2Top) / 2, (z0 + 0.32 + z1) / 2, 0.32, yF2Top - yF1Top, bd - 0.32);
      // Corner Exposed Concrete Piers on Floor 2 flush at z1 = 1.85 and x0 = -3.20 (non-overlapping at corners!)
      for (const px of [x0 + 0.19, x1 - 0.35]) {
        const pW = px < 0 ? 0.38 : 0.38;
        b.box(mConcrete, px, (yF1Top + yF2Top) / 2, z1 - 0.16, pW, yF2Top - yF1Top, 0.32);
      }
      b.box(mConcrete, x0 + 0.16, (yF1Top + yF2Top) / 2, -2.32, 0.32, yF2Top - yF1Top, 1.32);
      b.box(mConcrete, x0 + 0.16, (yF1Top + yF2Top) / 2, 1.49, 0.32, yF2Top - yF1Top, 0.08);

      // Warm Golden-Amber Glowing Interior Backdrop behind the 2×5 Grid Window Wall (at z1 - 0.56, 0.51m >= 0.15m behind glass!)
      const winW2 = 5.04; // from x = -2.82 to x = 2.22 (5 columns × 1.008 wide)
      b.box(mFloor2Backdrop, cxB, 3.55, z1 - 0.56, winW2, 1.96, 0.04);
      // Single-Level Continuous Studio Display Desk along Floor 2 Window Bays (pushed >= 0.30m behind glass at z1 - 0.40)
      b.box(mSteelDark, cxB, 2.86, z1 - 0.40, winW2 - 0.12, 0.62, 0.24);
      b.box(mWoodTable, cxB, 3.20, z1 - 0.39, winW2 - 0.08, 0.06, 0.28);

      // 3D Audio & Gaming Props arranged cleanly on a SINGLE desk level across the 5 Window Bays!
      const colW2 = winW2 / 5;
      const yDesk = 3.23;
      for (let col = 0; col < 5; col++) {
        const bx = cxB - winW2 / 2 + colW2 * (col + 0.5);
        const bz = z1 - 0.38;

        if (col === 0) {
          // Bay 1 (Left): Studio Over-Ear ANC Headphones on Brushed Aluminum T-Stand + Mini DAC Amp
          b.cyl(mSteelDark, bx - 0.08, yDesk + 0.02, bz, 0.12, 0.04);
          b.cyl(mSilverAlu, bx - 0.08, yDesk + 0.24, bz, 0.020, 0.42);
          b.box(mSteelDark, bx - 0.08, yDesk + 0.46, bz, 0.30, 0.05, 0.07, { r: 0.02 });
          b.box(mSteelDark, bx - 0.22, yDesk + 0.31, bz, 0.07, 0.19, 0.12, { r: 0.02 });
          b.box(mSteelDark, bx + 0.06, yDesk + 0.31, bz, 0.07, 0.19, 0.12, { r: 0.02 });
          b.box(mSteelMid, bx + 0.22, yDesk + 0.06, bz, 0.20, 0.08, 0.16);
          b.cyl(mCyanGlow, bx + 0.22, yDesk + 0.06, bz + 0.085, 0.025, 0.015, { rx: Math.PI / 2 });
        } else if (col === 1) {
          // Bay 2: Pair of Compact Wooden Hi-Fi Bookshelf Speakers on Slim Acoustic Risers
          for (const sx of [-0.20, 0.20]) {
            b.box(mSteelDark, bx + sx, yDesk + 0.04, bz, 0.14, 0.08, 0.14);
            b.box(mWoodSlat, bx + sx, yDesk + 0.20, bz, 0.18, 0.25, 0.16);
            b.box(mInk, bx + sx, yDesk + 0.20, bz + 0.082, 0.15, 0.22, 0.01);
            b.cyl(mSilverAlu, bx + sx, yDesk + 0.15, bz + 0.09, 0.048, 0.015, { rx: Math.PI / 2 });
            b.cyl(mCyanGlow, bx + sx, yDesk + 0.25, bz + 0.09, 0.024, 0.015, { rx: Math.PI / 2 });
          }
        } else if (col === 2) {
          // Bay 3 (Center): Compact Dual Studio Monitor Speakers + Audio Mixer Console
          for (const sx of [-0.24, 0.24]) {
            b.box(mSteelDark, bx + sx, yDesk + 0.16, bz, 0.16, 0.26, 0.16);
            b.box(mWoodSlat, bx + sx, yDesk + 0.16, bz - 0.01, 0.17, 0.24, 0.13);
            b.cyl(mSilverAlu, bx + sx, yDesk + 0.11, bz + 0.085, 0.045, 0.015, { rx: Math.PI / 2 });
            b.cyl(mCyanGlow, bx + sx, yDesk + 0.22, bz + 0.085, 0.022, 0.015, { rx: Math.PI / 2 });
          }
          b.box(mSteelMid, bx, yDesk + 0.05, bz + 0.02, 0.24, 0.06, 0.18, { rx: 0.18 });
          b.box(mCyanGlow, bx, yDesk + 0.078, bz + 0.03, 0.18, 0.015, 0.06, { rx: 0.18 });
        } else if (col === 3) {
          // Bay 4: Next-Gen Wireless Gamepad Controllers & VR Headset on Illuminated Display Pedestals
          for (const [sx, glowMatCol] of [
            [-0.18, mCyanGlow],
            [0.18, mPinkGlow]
          ]) {
            b.cyl(mSteelDark, bx + sx, yDesk + 0.07, bz, 0.08, 0.14);
            b.cyl(glowMatCol, bx + sx, yDesk + 0.148, bz, 0.085, 0.015);
            b.box(mPodiumWhite, bx + sx, yDesk + 0.21, bz + 0.02, 0.20, 0.10, 0.12, { rx: -0.25, r: 0.02 });
            b.box(glowMatCol, bx + sx, yDesk + 0.22, bz + 0.085, 0.10, 0.025, 0.02, { rx: -0.25 });
          }
        } else {
          // Bay 5 (Rightmost): Single-Level Widescreen Curved Gaming Monitor + Compact RGB PC Tower
          b.box(mSteelDark, bx - 0.10, yDesk + 0.08, bz, 0.12, 0.14, 0.10);
          b.box(mSteelDark, bx - 0.10, yDesk + 0.02, bz + 0.02, 0.22, 0.03, 0.14);
          b.box(mSteelDark, bx - 0.10, yDesk + 0.28, bz, 0.52, 0.30, 0.035);
          b.box(mCyanGlow, bx - 0.10, yDesk + 0.28, bz + 0.025, 0.47, 0.25, 0.01);
          b.box(mSteelDark, bx + 0.27, yDesk + 0.20, bz, 0.15, 0.36, 0.20);
          b.box(mPinkGlow, bx + 0.27, yDesk + 0.20, bz + 0.108, 0.03, 0.28, 0.01);
          b.box(mCyanGlow, bx + 0.22, yDesk + 0.20, bz + 0.108, 0.015, 0.24, 0.01);
        }
      }

      // Black Steel Grid Window Frame (2 Rows × 5 Columns) at z1 - 0.02 (+0.03m in front of glass) + Glass at z1 - 0.05
      b.add(mStoreGlass, unitBox, cxB, 3.55, fGlassZ1, winW2, 1.94, 0.012);
      for (const gy of [2.56, 3.55, 4.54]) {
        b.box(mSteelDark, cxB, gy, fFrameZ1, winW2 + 0.08, 0.07, 0.028);
      }
      for (let col = 0; col <= 5; col++) {
        const gx = cxB - winW2 / 2 + col * colW2;
        b.box(mSteelDark, gx, 3.55, fFrameZ1, 0.065, 2.04, 0.028);
      }

      // Left-Side Floor 2 Wrap-Around Grid Windows (2 Rows × 3 Columns):
      // - Backdrop at x0 + 0.22 (0.17m >= 0.15m behind glass)
      // - Glass recessed 0.05m inward (x0 + 0.05)
      // - Steel mullions +0.03m in front of glass (x0 + 0.02)
      const sideWinZ0 = -1.65, sideWinZ1 = 1.45, sideWinD = sideWinZ1 - sideWinZ0, sideWinCz = (sideWinZ0 + sideWinZ1) / 2;
      b.box(mFloor2Backdrop, x0 + 0.22, 3.55, sideWinCz, 0.04, 1.92, sideWinD);
      b.add(mStoreGlass, unitBox, lGlassX0, 3.55, sideWinCz, 0.012, 1.92, sideWinD);
      for (const gy of [2.56, 3.55, 4.54]) {
        b.box(mSteelDark, lFrameX0, gy, sideWinCz, 0.028, 0.07, sideWinD + 0.08);
      }
      for (let k = 0; k <= 3; k++) {
        const gz = sideWinZ0 + (k / 3) * sideWinD;
        b.box(mSteelDark, lFrameX0, 3.55, gz, 0.028, 2.02, 0.065);
      }

      // Horizontal Wood Slat Accent Panel (#9E6B43) on Left-Rear & Right-Front Floor 2 Corners (clean relief)
      for (const [wx, wz, wd] of [
        [x0 - 0.03, -2.48, 1.45],
        [x1 + 0.03, 1.18, 1.25]
      ]) {
        b.box(mWoodSlat, wx, 3.55, wz, 0.04, 2.02, wd);
        for (let sy = 2.66; sy <= 4.46; sy += 0.14) {
          b.box(mInk, wx + Math.sign(wx) * 0.026, sy, wz, 0.012, 0.028, wd);
        }
      }

      // Right-Side Wall Utility Details:
      // 1) Horizontal Clerestory Window (y = 3.98, z = -0.55) with non-overlapping depth layers
      b.box(mFloor2Backdrop, x1 + 0.01, 3.98, -0.55, 0.015, 0.30, 1.36);
      b.add(mStoreGlass, unitBox, x1 + 0.03, 3.98, -0.55, 0.01, 0.32, 1.38);
      b.box(mSteelDark, x1 + 0.05, 4.16, -0.55, 0.03, 0.05, 1.48);
      b.box(mSteelDark, x1 + 0.05, 3.80, -0.55, 0.03, 0.05, 1.48);
      b.box(mSteelDark, x1 + 0.05, 3.98, -1.26, 0.03, 0.42, 0.05);
      b.box(mSteelDark, x1 + 0.05, 3.98, -0.55, 0.03, 0.42, 0.05);
      b.box(mSteelDark, x1 + 0.05, 3.98, 0.16, 0.03, 0.42, 0.05);
      // 2) Louvered Ventilation Grille (y = 3.42, z = -2.35)
      b.box(mSteelDark, x1 + 0.03, 3.42, -2.35, 0.04, 1.24, 0.68);
      for (let ly = 2.90; ly <= 3.94; ly += 0.10) {
        b.box(mSteelMid, x1 + 0.06, ly, -2.35, 0.025, 0.035, 0.58, { rz: 0.25 });
      }
      // 3) Electrical Panel Box & Continuous Full-Height Vertical Conduit Pipes
      b.box(mSteelMid, x1 + 0.08, 1.05, 0.18, 0.12, 0.54, 0.42, { r: 0.02 });
      b.box(mSteelDark, x1 + 0.148, 1.05, 0.18, 0.015, 0.46, 0.34);
      b.cyl(mSteelDark, x1 + 0.08, 3.35, 0.24, 0.024, 6.34);
      b.cyl(mSteelDark, x1 + 0.08, 3.35, 0.12, 0.020, 6.34);
      for (const cyClamp of [0.55, 1.65, 2.75, 3.85, 4.95, 6.05]) {
        b.box(mSteelMid, x1 + 0.08, cyClamp, 0.18, 0.06, 0.04, 0.24);
      }

      // 4) Full-Height Side Steel Maintenance Ladder connected cleanly from Ground Plinth to 3rd-Floor Roof Terrace at z = -1.58
      const ladZ = -1.58;
      for (const lzOff of [-0.16, 0.16]) {
        b.box(mSteelDark, x1 + 0.18, 2.58, ladZ + lzOff, 0.04, 4.76, 0.04);
      }
      for (let ry = 0.44; ry <= 4.88; ry += 0.26) {
        b.cyl(mSteelMid, x1 + 0.18, ry, ladZ, 0.015, 0.32, { rx: Math.PI / 2 });
      }
      for (const ay of [0.45, 1.45, 2.45, 3.55, 4.65]) {
        b.box(mSteelDark, x1 + 0.09, ay, ladZ - 0.16, 0.18, 0.04, 0.04);
        b.box(mSteelDark, x1 + 0.09, ay, ladZ + 0.16, 0.18, 0.04, 0.04);
      }

      // Floor 2-to-3 Projecting Concrete & Steel Cornice Ledge (y = 4.58..4.74)
      b.box(mConcreteDark, cxB, 4.64, czWall, bw + 0.22, 0.12, bd + 0.22);
      b.box(mSteelDark, cxB, 4.71, czWall, bw + 0.26, 0.05, bd + 0.26);

      // ======================================================================
      // 3. LANTAI 3 & ATAP — NEON BILLBOARD WITH STEEL SCAFFOLDING FRAME & ROOFTOP GEAR
      // ======================================================================
      // 3rd-Floor Recessed Architectural Penthouse / Studio Volume (y = 4.74..6.42) with non-overlapping core & outer walls
      const f3Z1 = 1.28; // Recessed in front so the Steel Scaffolding Billboard stands on the front terrace!
      const f3D = f3Z1 - z0, f3Cz = (z0 + f3Z1) / 2;
      b.box(mConcrete, cxB + 0.14, (4.74 + yF3Top - 0.12) / 2, f3Cz, bw - 0.84, yF3Top - 4.74 - 0.12, f3D - 0.72);
      b.box(mConcrete, cxB, (4.74 + yF3Top) / 2, z0 + 0.14, bw, yF3Top - 4.74, 0.28);
      b.box(mConcrete, x1 - 0.14, (4.74 + yF3Top) / 2, f3Cz, 0.28, yF3Top - 4.74, f3D - 0.56);
      b.box(mConcrete, cxB, (4.74 + yF3Top) / 2, f3Z1 - 0.14, bw, yF3Top - 4.74, 0.28);
      b.box(mConcrete, x0 + 0.14, 4.86, f3Cz, 0.28, 0.24, f3D - 0.56);
      b.box(mConcrete, x0 + 0.14, 6.30, f3Cz, 0.28, 0.24, f3D - 0.56);
      // 3rd-Floor Side Glazing: backdrop at x0 + 0.21 (0.16m behind glass), glass at x0 + 0.05, mullions at x0 + 0.02
      b.box(mFloor3Backdrop, x0 + 0.21, 5.56, f3Cz, 0.02, 1.24, f3D - 0.56);
      b.add(mStoreGlass, unitBox, x0 + 0.05, 5.56, f3Cz, 0.012, 1.24, f3D - 0.56);
      b.box(mSteelDark, x0 + 0.02, 6.20, f3Cz, 0.028, 0.06, f3D - 0.52);
      b.box(mSteelDark, x0 + 0.02, 4.92, f3Cz, 0.028, 0.06, f3D - 0.52);
      for (let k = 0; k <= 4; k++) {
        const gz = z0 + 0.28 + (k / 4) * (f3D - 0.56);
        b.box(mSteelDark, x0 + 0.02, 5.56, gz, 0.028, 1.32, 0.055);
      }
      // Roof Slab & Coping at y = 6.42..6.56
      b.box(mConcreteDark, cxB, 6.48, f3Cz, bw + 0.12, 0.12, f3D + 0.12);
      b.box(mSteelDark, cxB, 6.55, f3Cz, bw + 0.16, 0.04, f3D + 0.16);

      // --- INDUSTRIAL STEEL SCAFFOLDING FRAME & NEON BILLBOARD (Front Lantai 3: z = 1.62, y = 4.74..6.62) ---
      const bbZ = 1.66;
      const bbW = 5.10, bbH = 1.46, bbY = 5.76;
      // 1) Horizontal Steel Truss Base Catwalk (y = 4.74..5.02) with X-bracing
      b.box(mSteelDark, cxB, 4.77, bbZ, bbW + 0.56, 0.05, 0.36);
      b.box(mSteelDark, cxB, 5.01, bbZ, bbW + 0.56, 0.05, 0.36);
      const nTrussX = 10, stepTrussX = (bbW + 0.48) / nTrussX;
      for (let i = 0; i <= nTrussX; i++) {
        const tx = cxB - (bbW + 0.48) / 2 + i * stepTrussX;
        b.box(mSteelMid, tx, 4.89, bbZ + 0.15, 0.04, 0.24, 0.04);
        if (i < nTrussX) {
          const mx = tx + stepTrussX / 2;
          b.box(mSteelMid, mx, 4.89, bbZ + 0.15, stepTrussX * 1.05, 0.03, 0.03, { rz: 0.42 });
          b.box(mSteelMid, mx, 4.89, bbZ + 0.15, stepTrussX * 1.05, 0.03, 0.03, { rz: -0.42 });
        }
      }

      // 2) Left & Right Vertical 3D Steel Lattice Scaffolding Towers (x = cxB ± 2.70, y = 4.74..6.62)
      for (const sx of [-1, 1]) {
        const tx = cxB + sx * 2.70;
        for (const dx of [-0.12, 0.12]) {
          for (const dz of [-0.14, 0.14]) {
            b.box(mSteelDark, tx + dx, 5.68, bbZ + dz, 0.045, 1.88, 0.045);
          }
        }
        // Horizontal & diagonal lattice rungs on side scaffolding towers
        for (let ty = 5.05; ty <= 6.48; ty += 0.34) {
          b.box(mSteelMid, tx, ty, bbZ + 0.14, 0.26, 0.035, 0.035);
          b.box(mSteelMid, tx + sx * 0.12, ty, bbZ, 0.035, 0.035, 0.28);
          if (ty < 6.35) {
            b.box(mSteelMid, tx, ty + 0.17, bbZ + 0.14, 0.34, 0.03, 0.03, { rz: sx * 0.78 });
          }
        }
        // Rear diagonal steel support struts anchoring billboard top to 3rd-floor roof
        b.box(mSteelDark, tx, 5.95, bbZ - 0.34, 0.05, 1.15, 0.05, { rx: -0.48 });
      }

      // 3) Top Horizontal Steel Lattice Truss Beam (y = 6.50..6.66)
      b.box(mSteelDark, cxB, 6.52, bbZ, bbW + 0.56, 0.045, 0.32);
      b.box(mSteelDark, cxB, 6.64, bbZ, bbW + 0.56, 0.045, 0.32);
      for (let i = 0; i <= nTrussX; i++) {
        const tx = cxB - (bbW + 0.48) / 2 + i * stepTrussX;
        b.box(mSteelMid, tx, 6.58, bbZ + 0.14, 0.035, 0.12, 0.035);
      }

      // 4) Main Billboard Cabinet & Glowing High-Res "CIRCUIT & BYTE: NEW TECH UNLOCKED" Neon Canvas
      b.box(mSteelDark, cxB, bbY, bbZ, bbW, bbH, 0.20, { r: 0.02 });
      b.panel(mNeonSign, R.circuitNeonBillboard, cxB, bbY, bbZ + 0.115, bbW - 0.10, bbH - 0.08);

      // 5) 4 Curved Gooseneck Floodlights mounted along Top of Billboard
      for (const fx of [cxB - 1.95, cxB - 0.65, cxB + 0.65, cxB + 1.95]) {
        b.box(mSteelDark, fx, 6.68, bbZ + 0.18, 0.04, 0.04, 0.42, { rx: 0.12 });
        b.box(mSteelDark, fx, 6.63, bbZ + 0.38, 0.20, 0.06, 0.12);
        b.box(mWarmLamp, fx, 6.60, bbZ + 0.38, 0.16, 0.025, 0.09);
      }

      // --- ROOFTOP EQUIPMENT (Complete 4-Sided Perimeter Railing, 2 HVAC Units, 2 Solar Panels & 1 Satellite Dish, y = 6.56..7.45) ---
      const yRoof = 6.56;
      // Complete 4-Sided Perimeter Black Steel Safety Railing around Flat Roof Deck (Front, Back, Left, Right + Corner & Mid Posts)
      const rX0 = x0 + 0.12, rX1 = x1 - 0.12, rZ0 = z0 + 0.12, rZ1 = f3Z1 - 0.12;
      const rSpanX = rX1 - rX0, rSpanZ = rZ1 - rZ0;
      for (const ry of [yRoof + 0.04, yRoof + 0.22, yRoof + 0.42]) {
        const barThick = ry > yRoof + 0.35 ? 0.045 : 0.035;
        b.box(mSteelDark, cxB, ry, rZ0, rSpanX + 0.04, barThick, barThick);
        b.box(mSteelDark, cxB, ry, rZ1, rSpanX + 0.04, barThick, barThick);
        b.box(mSteelDark, rX0, ry, (rZ0 + rZ1) / 2, barThick, barThick, rSpanZ + 0.04);
        b.box(mSteelDark, rX1, ry, (rZ0 + rZ1) / 2, barThick, barThick, rSpanZ + 0.04);
      }
      const nPostsX = 6;
      for (let i = 0; i <= nPostsX; i++) {
        const rx = rX0 + (rSpanX * i) / nPostsX;
        const postW = i === 0 || i === nPostsX ? 0.052 : 0.04;
        b.box(mSteelDark, rx, yRoof + 0.22, rZ0, postW, 0.44, postW);
        b.box(mSteelDark, rx, yRoof + 0.22, rZ1, postW, 0.44, postW);
      }
      const nPostsZ = 5;
      for (let i = 1; i < nPostsZ; i++) {
        const rz = rZ0 + (rSpanZ * i) / nPostsZ;
        b.box(mSteelDark, rX0, yRoof + 0.22, rz, 0.04, 0.44, 0.04);
        b.box(mSteelDark, rX1, yRoof + 0.22, rz, 0.04, 0.44, 0.04);
      }

      // 1) 2 Large Rooftop HVAC Units (with Circular Fan Grilles & Blades) + Side Condenser Box
      const hvacX = -1.05, hvacZ = -1.95;
      b.box(mSteelDark, hvacX, yRoof + 0.05, hvacZ, 1.92, 0.10, 1.06);
      b.box(mHvacGrey, hvacX, yRoof + 0.36, hvacZ, 1.84, 0.54, 0.98, { r: 0.02 });
      b.box(mInk, hvacX, yRoof + 0.36, hvacZ + 0.50, 1.72, 0.40, 0.02);
      for (const fxOff of [-0.46, 0.46]) {
        const fx = hvacX + fxOff;
        b.cyl(mSteelDark, fx, yRoof + 0.64, hvacZ, 0.34, 0.05);
        b.cyl(mInk, fx, yRoof + 0.66, hvacZ, 0.29, 0.03);
        // Crossed fan blades inside each circular HVAC grille
        b.box(mSilverAlu, fx, yRoof + 0.67, hvacZ, 0.48, 0.015, 0.07, { ry: 0.35 });
        b.box(mSilverAlu, fx, yRoof + 0.67, hvacZ, 0.48, 0.015, 0.07, { ry: 1.92 });
        b.cyl(mSilverAlu, fx, yRoof + 0.68, hvacZ, 0.06, 0.03);
      }
      // Secondary Auxiliary Rooftop AC Condenser Unit on Right-Front of Roof
      b.box(mHvacGrey, 1.75, yRoof + 0.34, 0.25, 0.78, 0.56, 0.68, { r: 0.02 });
      b.cyl(mInk, 1.75, yRoof + 0.34, 0.60, 0.22, 0.02, { rx: Math.PI / 2 });

      // 2) 2 Tilted Blue Solar Panels on Angled Steel Racks (x = 0.45..2.05, z = -1.85)
      for (const sx of [0.68, 1.72]) {
        const sz = -1.85;
        // Support legs
        b.box(mSteelDark, sx - 0.28, yRoof + 0.16, sz - 0.26, 0.05, 0.32, 0.05);
        b.box(mSteelDark, sx + 0.28, yRoof + 0.16, sz - 0.26, 0.05, 0.32, 0.05);
        b.box(mSteelDark, sx - 0.28, yRoof + 0.34, sz + 0.24, 0.05, 0.68, 0.05);
        b.box(mSteelDark, sx + 0.28, yRoof + 0.34, sz + 0.24, 0.05, 0.68, 0.05);
        // Tilted silver frame + blue photovoltaic panel + grid dividers
        b.box(mSilverAlu, sx, yRoof + 0.46, sz, 0.88, 0.05, 1.12, { rx: -0.42 });
        b.box(mSolarBlue, sx, yRoof + 0.48, sz + 0.01, 0.80, 0.03, 1.04, { rx: -0.42 });
        b.box(mSilverAlu, sx, yRoof + 0.49, sz + 0.015, 0.02, 0.03, 1.04, { rx: -0.42 });
      }

      // 3) 1 Coaxially-Aligned 3D Parabolic Satellite Dish at Front-Left Roof Deck (x = -2.28, z = -0.42)
      const satX = -2.28, satZ = -0.42;
      b.cyl(mSteelDark, satX, yRoof + 0.03, satZ, 0.24, 0.06);
      b.cyl(mSteelDark, satX, yRoof + 0.24, satZ, 0.055, 0.42);
      for (let k = 0; k < 3; k++) {
        const ang = (k / 3) * Math.PI * 2;
        b.box(mSteelMid, satX + Math.cos(ang) * 0.13, yRoof + 0.16, satZ + Math.sin(ang) * 0.13, 0.04, 0.26, 0.04);
      }
      b.box(mSteelMid, satX, yRoof + 0.46, satZ, 0.14, 0.12, 0.14);
      const satDishGrp = new THREE.Group();
      satDishGrp.position.set(satX, yRoof + 0.54, satZ);
      satDishGrp.rotation.set(0.52, 0.38, 0);
      const bSat = new Batch();
      // Stepped concave parabolic dish reflector bowl + dark rear mount hub
      bSat.cyl(mSteelDark, 0, -0.04, 0, 0.18, 0.06);
      bSat.cyl(mSilverAlu, 0, 0.0, 0, 0.44, 0.045);
      bSat.cyl(mPodiumWhite, 0, 0.024, 0, 0.39, 0.025);
      bSat.cyl(mSilverAlu, 0, 0.040, 0, 0.26, 0.020);
      bSat.cyl(mSteelMid, 0, 0.052, 0, 0.08, 0.025);
      // Central LNB feed rod + 3 tripod support struts converging cleanly to the focal LNB receiver horn
      bSat.cyl(mSteelDark, 0, 0.22, 0, 0.018, 0.34);
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2;
        const sx = Math.cos(a) * 0.18, sz = Math.sin(a) * 0.18;
        bSat.cyl(mSteelMid, sx, 0.20, sz, 0.010, 0.40, {
          rx: -Math.sin(a) * 0.46,
          rz: Math.cos(a) * 0.46
        });
      }
      bSat.cyl(mSteelDark, 0, 0.39, 0, 0.042, 0.06);
      bSat.sphere(mCyanGlow, 0, 0.43, 0, 0.032);
      bSat.build(satDishGrp);
      g.add(satDishGrp);

      // Night Lights for Circuit & Byte (Warm Floor 2 Studio Glow + Cyan/Pink Neon Billboard & Ground Showcase)
      S.lights.push(
        [new THREE.Vector3(cxB, 5.8, z1 + 1.1), '#00F0FF', 3.4, 2.4],
        [new THREE.Vector3(cxB - 1.4, 3.5, z1 + 0.9), '#FFBE68', 3.2, 2.2],
        [new THREE.Vector3(cxB + 1.4, 3.5, z1 + 0.9), '#FFBE68', 3.2, 2.2],
        [new THREE.Vector3(cxB, 1.3, z1 + 1.0), '#FFE2A8', 3.0, 2.0],
        [new THREE.Vector3(x0 - 0.8, 2.5, -0.5), '#FFBE68', 2.6, 1.8]
      );

      S.queuePath = [
        [-2.2, 2.35],
        [-0.3, 2.35],
        [1.5, 2.35],
        [2.4, 2.35]
      ];

      b.build(g);

      const occluder = new THREE.Mesh(unitBox, linkProbe);
      occluder.visible = false;
      occluder.position.set(cxB, (H + 0.3) / 2, czWall);
      occluder.scale.set(bw + 0.6, H + 0.3, bd + 0.6);
      occluder.userData.store = index;
      villageOuterLot.add(occluder);
      links.push(occluder);

      for (const L of S.lights) {
        g.localToWorld(L[0]);
        addLight(L[0], L[1], L[2], L[3], index);
      }
      S.focus = g.localToWorld(new THREE.Vector3(cxB, 3.15, 0.45));
      S.label = g.localToWorld(new THREE.Vector3(cxB, H + 0.85, czWall));
      stores.push(S);
      return;
    }
  });
}

// Living Wind & Floating Leaves Ambient Animation for Pos #6 (Strawberry Corner)
export function updateStrawberryAmbient(t, dt = 0.016) {
  const st = stores[5];
  if (!st) return;

  if (st.ambientGroup) {
    st.ambientGroup.position.copy(st.g.position);
    st.ambientGroup.rotation.copy(st.g.rotation);
  }

  // 1. Wind Sway on Trees, Bushes, Window Boxes, Pendulum Hanging Pots & Striped Awnings
  if (st.windAffectedMeshes) {
    for (let i = 0; i < st.windAffectedMeshes.length; i++) {
      const mesh = st.windAffectedMeshes[i];
      const ud = mesh.userData;
      const offset = ud.offset || 0;
      const wind = Math.sin(t * 1.8 + offset) * 0.035 + Math.cos(t * 0.9 + offset * 2.0) * 0.015;

      if (ud.kind === 'pendulum') {
        mesh.rotation.z = ud.baseRotZ + wind * 2.1;
        mesh.rotation.x = ud.baseRotX + wind * 1.05;
      } else if (ud.kind === 'awning') {
        mesh.rotation.z = ud.baseRotZ + wind * 0.35;
        mesh.rotation.x = ud.baseRotX + wind * 0.5;
      } else {
        mesh.rotation.z = ud.baseRotZ + wind;
        mesh.rotation.x = ud.baseRotX + wind * 0.5;
        mesh.scale.y = ud.baseScaleY * (1 + Math.sin(t * 2.2 + offset) * 0.025);
      }
    }
  }

  // 2. 35 Drifting Watercolor Leaves & Strawberry Petals (fallingLeavesGroup)
  if (st.fallingLeavesGroup) {
    const step = Math.min(2.5, Math.max(0.5, dt * 60));
    const leaves = st.fallingLeavesGroup.children;
    for (let i = 0; i < leaves.length; i++) {
      const leaf = leaves[i];
      const ud = leaf.userData;
      leaf.position.y -= ud.speedY * step;
      leaf.position.x += (ud.windDrift + Math.sin(t * 2.0 + ud.phase) * 0.012) * step;
      leaf.position.z += (Math.cos(t * 1.5 + ud.phase) * 0.008) * step;
      leaf.rotation.x += ud.rotSpeedX * step;
      leaf.rotation.y += ud.rotSpeedY * step;
      leaf.rotation.z += ud.rotSpeedZ * step;

      if (leaf.position.y < 0 || leaf.position.x > 6.2) {
        leaf.position.y = 13 + ((i * 1.43 + t * 0.7) % 3.0);
        leaf.position.x = -5.0 + ((i * 2.17 + Math.sin(t + i) * 2.5 + 8.2) % 8.2);
        leaf.position.z = -3.4 + ((i * 1.61 + Math.cos(t + i) * 2.2 + 6.8) % 6.8);
      }
    }
  }

  // 3. Rooftop Sparrows Idle Hop/Peck & Look Left-Right + Flying Rooftop Critter
  if (st.rooftopBirds) {
    for (let i = 0; i < st.rooftopBirds.length; i++) {
      const bird = st.rooftopBirds[i];
      const ud = bird.userData;
      const cycle = (t + ud.phase) % 4.2;
      const isActive = cycle < 1.35;
      const hop = isActive ? Math.abs(Math.sin(t * 6)) * 0.08 : 0;
      bird.position.y = ud.baseY + hop;
      bird.rotation.x = isActive ? Math.max(0, -Math.sin(t * 6)) * 0.26 : 0;
      bird.rotation.y = ud.baseRotY + Math.sin(t * 1.6 + ud.phase) * 0.24;
      if (ud.headGroup) {
        ud.headGroup.rotation.y = Math.sin(t * 2.9 + ud.phase * 1.7) * 0.38;
      }
    }
  }

  if (st.rooftopFlyer) {
    const fl = st.rooftopFlyer;
    const ud = fl.userData;
    const ang = t * 0.92;
    const rx = 1.95, rz = 1.65;
    const nx = ud.cx + Math.cos(ang) * rx;
    const nz = ud.cz + Math.sin(ang) * rz + Math.sin(ang * 2) * 0.35;
    const ny = ud.cy + Math.sin(t * 2.3) * 0.24;
    const vx = -Math.sin(ang) * rx;
    const vz = Math.cos(ang) * rz + Math.cos(ang * 2) * 0.7;
    fl.position.set(nx, ny, nz);
    fl.rotation.y = Math.atan2(vx, vz);
    fl.rotation.z = Math.sin(t * 2.3) * 0.14;
    const flap = Math.sin(t * 30) * 0.68;
    ud.wingL.rotation.z = flap;
    ud.wingR.rotation.z = -flap;
  }
}

// Reset Pos #7 (Mayor's Office) animated meshes before Box3 calculation so camera framing is 100% invariant
export function resetMayorWindPose() {
  const st = stores[6];
  if (!st) return;
  if (st.windAffectedMeshes) {
    for (let i = 0; i < st.windAffectedMeshes.length; i++) {
      const m = st.windAffectedMeshes[i];
      const ud = m.userData;
      m.position.set(ud.basePosX, ud.basePosY, ud.basePosZ);
      m.rotation.set(ud.baseRotX, ud.baseRotY, ud.baseRotZ);
      m.scale.set(ud.baseScaleX, ud.baseScaleY, ud.baseScaleZ);
    }
  }
  if (st.rooftopBirds) {
    for (let i = 0; i < st.rooftopBirds.length; i++) {
      const b = st.rooftopBirds[i];
      const ud = b.userData;
      b.position.set(ud.baseX, ud.baseY, ud.baseZ);
      b.rotation.set(0, ud.baseRotY, 0);
    }
  }
  if (st.weathervane) {
    st.weathervane.rotation.set(0, 0, 0);
  }
  if (st.bellPivot) {
    st.bellPivot.rotation.set(0, 0, 0);
  }
}

// Living Clock Tower, Swinging Golden Bell, Rotating Rooster Weathervane, Fountain & Wind Animation for Pos #7 (Mayor's Office)
export function updateMayorAmbient(t, dt = 0.016, daytime = 10.5) {
  const st = stores[6];
  if (!st) return;

  // 1. Synchronize Ornate Clock Tower Hour & Minute Hands with Ceria Town daytime (00:00–24:00)
  if (st.clockHands) {
    const wh = ((daytime % 24) + 24) % 24;
    const hourAngle = -((wh % 12) / 12) * Math.PI * 2;
    const minuteAngle = -((wh % 1) * Math.PI * 2);
    for (let i = 0; i < st.clockHands.length; i++) {
      st.clockHands[i].hourPivot.rotation.z = hourAngle;
      st.clockHands[i].minutePivot.rotation.z = minuteAngle;
    }
  }

  // 2. Gentle 3D Golden Bell Pendulum Swing inside the Belfry Arch
  if (st.bellPivot) {
    const bellSwing = Math.sin(t * 2.1) * 0.16 + Math.cos(t * 1.05) * 0.05;
    st.bellPivot.rotation.x = bellSwing;
  }

  // 3. Slow Golden Rooster Weathervane Rotation at Tower Peak
  if (st.weathervane) {
    st.weathervane.rotation.y = t * 0.28 + Math.sin(t * 0.85) * 0.35;
  }

  // 4. Sparkling Fountain Water Droplet Arcs in the Grand Central Park Fountain
  if (st.fountainDrops) {
    for (let i = 0; i < st.fountainDrops.length; i++) {
      const dm = st.fountainDrops[i];
      const u = (t * 0.95 + dm.userData.phase) % 1;
      const r = 0.12 + u * 1.05;
      const y = 1.24 + u * 0.56 - u * u * 1.32;
      const ang = dm.userData.angle;
      dm.position.set(Math.cos(ang) * r, y, Math.sin(ang) * r);
      const sc = 0.76 + Math.sin(u * Math.PI) * 0.55;
      dm.scale.setScalar(sc);
    }
  }

  // 5. Wind Sway on Planter Boxes, Window Boxes & Shrubs
  if (st.windAffectedMeshes) {
    for (let i = 0; i < st.windAffectedMeshes.length; i++) {
      const mesh = st.windAffectedMeshes[i];
      const ud = mesh.userData;
      const offset = ud.offset || 0;
      const wind = Math.sin(t * 1.8 + offset) * 0.032 + Math.cos(t * 0.9 + offset * 2.0) * 0.014;
      mesh.rotation.z = ud.baseRotZ + wind;
      mesh.rotation.x = ud.baseRotX + wind * 0.5;
      mesh.scale.y = ud.baseScaleY * (1 + Math.sin(t * 2.2 + offset) * 0.022);
    }
  }

  // 6. Rooftop Sparrows Idle Hop, Peck & Look Left-Right
  if (st.rooftopBirds) {
    for (let i = 0; i < st.rooftopBirds.length; i++) {
      const bird = st.rooftopBirds[i];
      const ud = bird.userData;
      const cycle = (t + ud.phase) % 4.2;
      const isActive = cycle < 1.35;
      const hop = isActive ? Math.abs(Math.sin(t * 6)) * 0.07 : 0;
      bird.position.y = ud.baseY + hop;
      bird.rotation.x = isActive ? Math.max(0, -Math.sin(t * 6)) * 0.24 : 0;
      bird.rotation.y = ud.baseRotY + Math.sin(t * 1.6 + ud.phase) * 0.22;
      if (ud.headGroup) {
        ud.headGroup.rotation.y = Math.sin(t * 2.9 + ud.phase * 1.7) * 0.36;
      }
    }
  }
}

// ============================================================================
// OUTDOOR TENNIS COURT (POS #5 RUANG KARYA UNIFIED SUPERBLOCK)
// 100% Faithful to the 4-Panel Architectural Concept Sheet
// ============================================================================
const tennisLinesTex = (() => {
  const W = 1024, H = 1024;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  ctx.strokeStyle = '#FAF8F2';
  ctx.fillStyle = '#FAF8F2';
  ctx.lineWidth = 14;

  // Outer doubles court boundary (with small margin inside the green court pad)
  const padX = 56, padY = 48;
  const cw = W - padX * 2;
  const ch = H - padY * 2;
  ctx.strokeRect(padX, padY, cw, ch);

  // Inner singles sidelines (inset by 12.5% of court width on each side)
  const alleyW = Math.round(cw * 0.125);
  const sx0 = padX + alleyW;
  const sx1 = padX + cw - alleyW;
  ctx.beginPath();
  ctx.moveTo(sx0, padY);
  ctx.lineTo(sx0, padY + ch);
  ctx.moveTo(sx1, padY);
  ctx.lineTo(sx1, padY + ch);
  ctx.stroke();

  // North & South Service Lines (at 27% and 73% of court length)
  const svY0 = Math.round(padY + ch * 0.27);
  const svY1 = Math.round(padY + ch * 0.73);
  ctx.beginPath();
  ctx.moveTo(sx0, svY0);
  ctx.lineTo(sx1, svY0);
  ctx.moveTo(sx0, svY1);
  ctx.lineTo(sx1, svY1);
  // Center Service Line
  ctx.moveTo(W / 2, svY0);
  ctx.lineTo(W / 2, svY1);
  // Baseline Center Marks
  ctx.moveTo(W / 2, padY);
  ctx.lineTo(W / 2, padY + 28);
  ctx.moveTo(W / 2, padY + ch);
  ctx.lineTo(W / 2, padY + ch - 28);
  ctx.stroke();

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
})();

const chainLinkTex = (() => {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, S, S);
  ctx.strokeStyle = 'rgba(52, 62, 56, 0.72)';
  ctx.lineWidth = 3.2;
  const step = 16;
  for (let i = -S; i <= S * 2; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + S, S);
    ctx.moveTo(i, S);
    ctx.lineTo(i + S, 0);
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(8, 3);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();

const tennisNetTex = (() => {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, S, S);
  ctx.strokeStyle = 'rgba(32, 38, 34, 0.88)';
  ctx.lineWidth = 3.5;
  const step = 16;
  for (let i = 0; i <= S; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, S);
    ctx.moveTo(0, i);
    ctx.lineTo(S, i);
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(14, 2);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();

const vintageScoreboardTex = (() => {
  const W = 512, H = 384;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');

  // Classic forest-green scoreboard background (#385A43) with warm cream border
  ctx.fillStyle = '#385A43';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#E8DFCE';
  ctx.lineWidth = 10;
  ctx.strokeRect(12, 12, W - 24, H - 24);

  // Top Cream Header Bar: GAME | GAME
  ctx.fillStyle = '#EAE0CE';
  ctx.fillRect(24, 24, W - 48, 66);
  ctx.strokeStyle = '#385A43';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(W / 2, 24);
  ctx.lineTo(W / 2, 90);
  ctx.stroke();

  ctx.fillStyle = '#26382C';
  ctx.font = '700 32px "DM Sans", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('GAME', W * 0.26, 58);
  ctx.fillText('GAME', W * 0.74, 58);

  // Flip-score rows: [10 - 00], [20 - 80], [00 - 26]
  const rows = [
    ['1', '0', '0', '0'],
    ['2', '0', '8', '0'],
    ['0', '0', '2', '6']
  ];
  const cardXs = [82, 162, 350, 430];
  for (let r = 0; r < rows.length; r++) {
    const cy = 144 + r * 82;
    // Center hyphen
    ctx.fillStyle = '#EAE0CE';
    ctx.fillRect(W / 2 - 14, cy - 4, 28, 8);
    for (let k = 0; k < 4; k++) {
      const cx = cardXs[k];
      ctx.fillStyle = '#223328';
      ctx.beginPath();
      ctx.roundRect(cx - 32, cy - 30, 64, 60, 6);
      ctx.fill();
      ctx.strokeStyle = '#B8C4B2';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = '#FAF6EC';
      ctx.font = '700 38px "DM Sans", Arial, sans-serif';
      ctx.fillText(rows[r][k], cx, cy + 2);
    }
  }

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();

let tennisAnimState = null;

function buildOutdoorTennisCourt(b, g, S, M, t, courtPaverTex = sidewalkTileTex) {
  const yBase = 0.18; // Top of the Unified Continuous Granite Sidewalk Superblock (y = 0.18)
  const courtShiftX = -1.75;
  const cx = -10.15 + courtShiftX; // -11.90: Center X of the playing court (leaving ~1.38u walkway to widened Apex Sport!)
  const cz = -0.90;    // Center Z aligned 100% flush with Apex Sport building (zB = -4.25 .. zF = +2.45)

  // Specialized Concept Sheet Materials
  const mClayApron = mat('#B86B52', { roughness: 0.86 }, t);
  const mForestCourt = mat('#4A7055', { roughness: 0.84 }, t);
  const mFenceMetal = mat('#35403A', { roughness: 0.52, metalness: 0.38 }, t);
  const mNetPost = mat('#2B4E39', { roughness: 0.48, metalness: 0.32 }, t);
  const mNetBand = mat('#FAF8F2', { roughness: 0.72 }, t);
  const mCanopyFabric = mat('#EAE0CE', { roughness: 0.82 }, t);
  const mCanopyTrim = mat('#D5C7B2', { roughness: 0.84 }, t);
  const mWoodWarm = mat('#8E5D3B', { roughness: 0.82 }, t);
  const mWoodDark = mat('#6E472B', { roughness: 0.85 }, t);
  const mScoreGreen = mat('#385A43', { roughness: 0.76 }, t);
  const mScoreFace = patch(
    new THREE.MeshStandardMaterial({
      map: vintageScoreboardTex,
      roughness: 0.72,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2
    }),
    t
  );
  const mBagBlue = mat('#4A667A', { roughness: 0.72 }, t);
  const mWaterJug = mat('#8AD2E8', { roughness: 0.22, metalness: 0.1, emissive: '#3B7A8E', emissiveIntensity: 0.22 }, t);
  const mTennisBall = mat('#E2F542', { roughness: 0.55, emissive: '#9CB818', emissiveIntensity: 0.22 }, t);
  const mHedgeDark = mat('#4E7A40', { roughness: 0.82, flatShading: true }, t);
  const mHedgeLight = mat('#689650', { roughness: 0.80, flatShading: true }, t);
  const mTerraPot = mat('#B86843', { roughness: 0.82 }, t);

  // --------------------------------------------------------------------------
  // 1. TWO-TONE COURT SURFACE & CRISP WHITE COURT MARKINGS (Anti-Z-Fighting)
  //    (Player Rest Area sits directly on the flush y = 0.195 Granite Paver Block Sidewalk!)
  // --------------------------------------------------------------------------
  const apronW = 6.60, apronD = 6.60;
  const courtW = 4.60, courtD = 5.40;
  // Layer 1: Clay Red Apron (#B86B52) at y = 0.195 -> 0.215
  b.box(mClayApron, cx, yBase + 0.010, cz, apronW, 0.020, apronD, { r: 0.01 });
  // Layer 2: Forest Green Inner Court (#4A7055) at y = 0.215 -> 0.235 (+0.020 above Clay Red Apron!)
  const yCourtTop = yBase + 0.040; // 0.235
  b.box(mForestCourt, cx, yBase + 0.030, cz, courtW, 0.020, courtD);

  // Layer 4: Crisp White Tennis Court Lines at y = 0.205 (polygonOffset -3/-3)
  const linesGeo = new THREE.PlaneGeometry(courtW, courtD);
  linesGeo.rotateX(-Math.PI / 2);
  const linesMat = new THREE.MeshBasicMaterial({
    map: tennisLinesTex,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3
  });
  const linesMesh = new THREE.Mesh(linesGeo, linesMat);
  linesMesh.position.set(cx, yCourtTop + 0.005, cz);
  linesMesh.castShadow = false;
  linesMesh.receiveShadow = false;
  g.add(linesMesh);

  // --------------------------------------------------------------------------
  // 2. TENNIS NET (Dark Green Posts, Grid Mesh, White Top Headband & Center Strap)
  // --------------------------------------------------------------------------
  const netSpan = courtW + 0.36; // 4.96
  for (const sx of [-1, 1]) {
    const px = cx + sx * (netSpan * 0.5);
    b.cyl(mNetPost, px, yCourtTop + 0.38, cz, 0.055, 0.76);
    b.cyl(M.metal, px, yCourtTop + 0.77, cz, 0.062, 0.03);
  }
  // White top headband tape, bottom cord, side tapes, and center vertical strap
  b.box(mNetBand, cx, yCourtTop + 0.71, cz, netSpan, 0.055, 0.032);
  b.box(mFenceMetal, cx, yCourtTop + 0.06, cz, netSpan, 0.025, 0.025);
  b.box(mNetBand, cx, yCourtTop + 0.38, cz, 0.05, 0.66, 0.034);
  for (const sx of [-1, 1]) {
    b.box(mNetBand, cx + sx * (netSpan * 0.5 - 0.04), yCourtTop + 0.38, cz, 0.05, 0.66, 0.032);
  }
  // Translucent woven grid mesh net panel
  const netGeo = new THREE.PlaneGeometry(netSpan - 0.08, 0.62);
  const netMat = new THREE.MeshBasicMaterial({
    map: tennisNetTex,
    transparent: true,
    opacity: 0.88,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const netMesh = new THREE.Mesh(netGeo, netMat);
  netMesh.position.set(cx, yCourtTop + 0.38, cz);
  g.add(netMesh);

  // --------------------------------------------------------------------------
  // 3. TALL UMPIRE CHAIR (Kursi Tinggi Wasit) at West Net Post
  // --------------------------------------------------------------------------
  const ux = cx - netSpan * 0.5 - 0.36;
  const uz = cz;
  // 4 angled A-frame tall legs
  for (const sz of [-0.22, 0.22]) {
    b.box(mWoodWarm, ux - 0.14, yBase + 0.62, uz + sz, 0.045, 1.22, 0.045, { rz: -0.10 });
    b.box(mWoodWarm, ux + 0.14, yBase + 0.62, uz + sz, 0.045, 1.22, 0.045, { rz: 0.10 });
    b.box(mWoodWarm, ux, yBase + 0.55, uz + sz, 0.26, 0.035, 0.035);
    b.box(mWoodWarm, ux, yBase + 1.38, uz + sz, 0.28, 0.035, 0.035);
  }
  // 4 horizontal ladder steps on the front (+X) side
  for (let stp = 0; stp < 4; stp++) {
    b.box(mWoodWarm, ux + 0.16 - stp * 0.02, yBase + 0.26 + stp * 0.24, uz, 0.06, 0.03, 0.44);
  }
  // Elevated seat, backrest, and small umpire desk tablet
  b.box(mWoodWarm, ux, yBase + 1.22, uz, 0.32, 0.045, 0.48);
  b.box(mWoodWarm, ux - 0.14, yBase + 1.48, uz, 0.04, 0.34, 0.46);
  b.box(mCanopyFabric, ux + 0.16, yBase + 1.40, uz + 0.16, 0.18, 0.025, 0.22);

  // --------------------------------------------------------------------------
  // 4. PLAYER REST AREA: 2 PLAYER CANOPIES, BENCHES, VINTAGE SCOREBOARD,
  //    BALL HOPPER BASKET, WATER COOLER, TENNIS BAGS & RACKETS
  // --------------------------------------------------------------------------
  const addPlayerBench = (bx, bz, ry = -Math.PI / 2, len = 1.26) => {
    const cos = Math.cos(ry), sin = Math.sin(ry);
    b.box(mWoodWarm, bx, yBase + 0.28, bz, len, 0.045, 0.36, { ry });
    b.box(mWoodWarm, bx - sin * 0.15, yBase + 0.48, bz - cos * 0.15, len, 0.26, 0.04, { ry });
    for (const s of [-0.42, 0.42]) {
      const lx = bx + cos * (len * s);
      const lz = bz - sin * (len * s);
      b.box(mWoodDark, lx, yBase + 0.15, lz, 0.06, 0.26, 0.34, { ry });
    }
  };

  // 2 Wooden Player Canopies (Pergolas) with Scalloped Cream Fabric Roofs & Flanking Potted Plants
  for (const czCanopy of [cz - 1.78, cz + 1.78]) {
    const cxCanopy = -5.92 + courtShiftX;
    const cwC = 1.24, cdC = 1.48, chC = 1.82;
    for (const dx of [-cwC * 0.44, cwC * 0.44]) {
      for (const dz of [-cdC * 0.44, cdC * 0.44]) {
        b.box(mWoodDark, cxCanopy + dx, yBase + chC * 0.5, czCanopy + dz, 0.085, chC, 0.085);
      }
    }
    // Upper wooden frame & rafters
    b.box(mWoodDark, cxCanopy, yBase + chC - 0.04, czCanopy, cwC, 0.08, cdC);
    // Cream Fabric Canopy Roof (#EAE0CE) + pitched crown + scalloped valance fringe
    b.box(mCanopyFabric, cxCanopy, yBase + chC + 0.05, czCanopy, cwC + 0.14, 0.10, cdC + 0.14, { r: 0.03 });
    b.box(mCanopyFabric, cxCanopy, yBase + chC + 0.13, czCanopy, cwC * 0.72, 0.08, cdC * 0.78, { r: 0.02 });
    for (let k = -3; k <= 3; k++) {
      b.cyl(mCanopyTrim, cxCanopy - cwC * 0.5 - 0.05, yBase + chC - 0.02, czCanopy + k * 0.20, 0.08, 0.04, { rz: Math.PI / 2 });
      b.cyl(mCanopyTrim, cxCanopy + cwC * 0.5 + 0.05, yBase + chC - 0.02, czCanopy + k * 0.20, 0.08, 0.04, { rz: Math.PI / 2 });
    }
    // Player Bench underneath each Canopy
    addPlayerBench(cxCanopy + 0.12, czCanopy, -Math.PI / 2, 1.12);
    // Flanking terracotta potted plants beside canopy posts
    for (const dzPot of [-cdC * 0.58, cdC * 0.58]) {
      b.cyl(mTerraPot, cxCanopy + 0.32, yBase + 0.16, czCanopy + dzPot, 0.15, 0.28);
      b.crown(mHedgeLight, cxCanopy + 0.32, yBase + 0.42, czCanopy + dzPot, 0.20, 0.26, 0.20, 1);
    }
  }

  // 2 Additional Courtside Benches in the Rest Area
  addPlayerBench(-6.48 + courtShiftX, cz - 0.78, -Math.PI / 2, 0.84);
  addPlayerBench(-6.48 + courtShiftX, cz + 0.78, -Math.PI / 2, 0.84);

  // Player Gear on & beside the North Bench (Slate-Blue Tennis Bags & 3D Tennis Rackets)
  b.box(mBagBlue, -5.78 + courtShiftX, yBase + 0.40, cz - 1.54, 0.24, 0.18, 0.48, { ry: 0.18, r: 0.05 });
  b.box(mNetBand, -5.78 + courtShiftX, yBase + 0.42, cz - 1.54, 0.25, 0.03, 0.38, { ry: 0.18 });
  b.box(mBagBlue, -5.82 + courtShiftX, yBase + 0.24, cz - 2.12, 0.22, 0.38, 0.18, { rz: 0.28, r: 0.04 });
  // Resting 3D Tennis Racket on bench
  b.cyl(mWoodDark, -5.84 + courtShiftX, yBase + 0.33, cz - 1.86, 0.11, 0.02);
  b.box(mWoodWarm, -5.84 + courtShiftX, yBase + 0.33, cz - 2.02, 0.025, 0.02, 0.18);

  // Water Cooler (Dispenser Galon Air) on Wooden Stand at cz
  const wcx = -5.65 + courtShiftX, wcz = cz;
  b.box(mWoodWarm, wcx, yBase + 0.46, wcz, 0.38, 0.04, 0.38);
  b.box(mWoodWarm, wcx, yBase + 0.18, wcz, 0.34, 0.03, 0.34);
  for (const [dx, dz] of [[-0.15, -0.15], [0.15, -0.15], [-0.15, 0.15], [0.15, 0.15]]) {
    b.box(mWoodDark, wcx + dx, yBase + 0.24, wcz + dz, 0.04, 0.44, 0.04);
  }
  // Small water bottle on lower shelf
  b.cyl(mWaterJug, wcx, yBase + 0.26, wcz, 0.045, 0.14);
  // White cooler collar + tap + translucent blue 5-gallon water jug on top
  b.cyl(mNetBand, wcx, yBase + 0.54, wcz, 0.13, 0.12);
  b.box(mFenceMetal, wcx - 0.14, yBase + 0.53, wcz, 0.04, 0.04, 0.025);
  b.cyl(mWaterJug, wcx, yBase + 0.74, wcz, 0.145, 0.28);
  b.cyl(mNetBand, wcx, yBase + 0.89, wcz, 0.05, 0.04);

  // Ball Hopper Basket (Keranjang Bola Tenis) filled with yellow tennis balls + 2 loose balls on ground
  const bhx = -6.56 + courtShiftX, bhz = cz + 1.38;
  for (const [dx, dz] of [[-0.14, -0.14], [0.14, -0.14], [-0.14, 0.14], [0.14, 0.14]]) {
    b.cyl(mFenceMetal, bhx + dx, yBase + 0.26, bhz + dz, 0.014, 0.48);
  }
  b.box(mFenceMetal, bhx, yBase + 0.48, bhz, 0.32, 0.025, 0.32);
  b.box(mFenceMetal, bhx, yBase + 0.28, bhz, 0.26, 0.025, 0.26);
  for (let bx = -1; bx <= 1; bx++) {
    for (let bz = -1; bz <= 1; bz++) {
      for (let by = 0; by < 2; by++) {
        b.sphere(
          mTennisBall,
          bhx + bx * 0.068 + (by % 2) * 0.02,
          yBase + 0.33 + by * 0.065,
          bhz + bz * 0.068,
          0.036
        );
      }
    }
  }
  // 2 loose yellow tennis balls on the court apron beside the hopper
  b.sphere(mTennisBall, bhx - 0.24, yBase + 0.055, bhz + 0.12, 0.038);
  b.sphere(mTennisBall, bhx - 0.16, yBase + 0.055, bhz + 0.24, 0.038);

  // Vintage Scoreboard (Papan Skor Klasik Hijau) mounted on fence post at cz
  const sbx = -5.20 + courtShiftX, sby = yBase + 1.28, sbz = cz;
  b.box(mWoodDark, sbx, sby, sbz, 0.08, 0.78, 1.02, { r: 0.02 });
  b.box(mScoreGreen, sbx - 0.03, sby, sbz, 0.04, 0.70, 0.94);
  const sbPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.68), mScoreFace);
  sbPlane.position.set(sbx - 0.055, sby, sbz);
  sbPlane.rotation.y = -Math.PI / 2;
  g.add(sbPlane);
  // Second scoreboard face on the outer (+X) side so it's also readable from the toko6 (Apex Sport) side
  const sbPlaneOut = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.68), mScoreFace);
  sbPlaneOut.position.set(sbx + 0.055, sby, sbz);
  sbPlaneOut.rotation.y = Math.PI / 2;
  g.add(sbPlaneOut);

  // --------------------------------------------------------------------------
  // 5. PERIMETER CHAIN-LINK FENCE, LANDSCAPE HEDGES, & 4 FLOODLIGHT POLES
  //    (fz0 = -4.25 and fz1 = +2.45 aligned 100% flush with Apex Sport!)
  // --------------------------------------------------------------------------
  const fx0 = -13.50 + courtShiftX, fx1 = -5.18 + courtShiftX, fz0 = -4.25, fz1 = 2.45, fH = 1.78;
  const fenceMeshMat = new THREE.MeshBasicMaterial({
    map: chainLinkTex,
    transparent: true,
    opacity: 0.62,
    side: THREE.DoubleSide,
    depthWrite: false
  });

  const addChainFenceSeg = (x0, z0, x1, z1, skipStartPost = false) => {
    const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz);
    const steps = Math.max(2, Math.round(len / 1.65));
    const ang = Math.atan2(dx, dz);
    for (let i = skipStartPost ? 1 : 0; i <= steps; i++) {
      const u = i / steps;
      b.cyl(mFenceMetal, x0 + dx * u, yBase + fH * 0.5, z0 + dz * u, 0.032, fH);
    }
    // Top, middle, and bottom horizontal tubular steel rails
    for (const ry of [yBase + 0.08, yBase + fH * 0.52, yBase + fH - 0.04]) {
      b.box(mFenceMetal, (x0 + x1) * 0.5, ry, (z0 + z1) * 0.5, 0.03, 0.03, len, { ry: ang });
    }
    const wireGeo = new THREE.PlaneGeometry(len, fH - 0.12);
    const wireMesh = new THREE.Mesh(wireGeo, fenceMeshMat);
    wireMesh.position.set((x0 + x1) * 0.5, yBase + fH * 0.5, (z0 + z1) * 0.5);
    wireMesh.rotation.y = ang + Math.PI / 2;
    g.add(wireMesh);
  };

  // West (-X) perimeter fence (full length)
  addChainFenceSeg(fx0, fz0, fx0, fz1);
  // North (-Z) perimeter fence (full length)
  addChainFenceSeg(fx0, fz0, fx1, fz0, true); // corner (fx0, fz0) post owned by West run
  // South (+Z) perimeter fence (with open player entrance gateway on the right)
  addChainFenceSeg(fx0, fz1, -6.55 + courtShiftX, fz1, true); // corner (fx0, fz1) post owned by West run
  // East (+X) perimeter fence facing toko6 (Apex Sport) (with wide central entrance gateway at z in [cz - 0.85, cz + 0.85])
  addChainFenceSeg(fx1, fz0, fx1, cz - 0.85, true); // corner (fx1, fz0) post owned by North run
  addChainFenceSeg(fx1, cz + 0.85, fx1, fz1);

  // Lush Boxwood Landscape Hedges & Shrubs bordering the exterior of the Perimeter Fence
  const addHedgeRun = (x0, z0, x1, z1, segs = 5) => {
    const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz);
    const ang = Math.atan2(dx, dz);
    const segLen = (len / segs) * 0.88;
    for (let i = 0; i < segs; i++) {
      const u = (i + 0.5) / segs;
      const hx = x0 + dx * u, hz = z0 + dz * u;
      b.box(i % 2 === 0 ? mHedgeDark : mHedgeLight, hx, yBase + 0.24, hz, 0.42, 0.46, segLen, { ry: ang, r: 0.08 });
      b.crown(mHedgeLight, hx, yBase + 0.46, hz, 0.22, 0.14, segLen * 0.42, i);
    }
  };
  addHedgeRun(fx0 - 0.28, fz1 + 0.28, -6.85 + courtShiftX, fz1 + 0.28, 4);
  addHedgeRun(fx0 - 0.28, fz0 - 0.12, fx1 + 0.20, fz0 - 0.12, 5);
  addHedgeRun(fx0 - 0.30, fz0 + 0.4, fx0 - 0.30, fz1 - 0.4, 5);
  // Corner terracotta potted plants at the front entrances
  for (const [px, pz] of [[fx0 - 0.28, fz1 + 0.28], [-6.55 + courtShiftX, fz1 + 0.28], [fx1 + 0.26, cz - 1.02], [fx1 + 0.26, cz + 1.02]]) {
    b.cyl(mTerraPot, px, yBase + 0.17, pz, 0.17, 0.32);
    b.crown(mHedgeLight, px, yBase + 0.45, pz, 0.24, 0.28, 0.24, 2);
  }

  // 4 Tall Floodlight Poles at the 4 Court Compound Corners (Floodlight Pole)
  const floodCorners = [
    [fx0 + 0.22, fz0 + 0.22, Math.PI * 0.25],
    [fx1 - 0.22, fz0 + 0.22, -Math.PI * 0.25],
    [fx0 + 0.22, fz1 - 0.22, Math.PI * 0.75],
    [fx1 - 0.22, fz1 - 0.22, -Math.PI * 0.75]
  ];
  for (const [flx, flz, aimRy] of floodCorners) {
    const poleH = 3.85;
    b.cyl(mFenceMetal, flx, yBase + 0.14, flz, 0.095, 0.28);
    b.cyl(mFenceMetal, flx, yBase + poleH * 0.5, flz, 0.048, poleH);
    // Twin horizontal floodlight rack crossbar at top
    b.box(mFenceMetal, flx, yBase + poleH - 0.08, flz, 0.58, 0.04, 0.04, { ry: aimRy });
    b.box(mFenceMetal, flx, yBase + poleH - 0.24, flz, 0.58, 0.04, 0.04, { ry: aimRy });
    const cos = Math.cos(aimRy), sin = Math.sin(aimRy);
    // 4 angled floodlight fixtures (2x2 rack) with glowing warm lenses
    for (const ox of [-0.18, 0.18]) {
      for (const oy of [poleH - 0.04, poleH - 0.22]) {
        const hx = flx + ox * cos;
        const hz = flz - ox * sin;
        b.box(mFenceMetal, hx, yBase + oy, hz, 0.18, 0.12, 0.10, { ry: aimRy, rx: 0.35 });
        b.box(M.bulb, hx + sin * 0.04, yBase + oy - 0.02, hz + cos * 0.04, 0.14, 0.09, 0.03, { ry: aimRy, rx: 0.35 });
      }
    }
  }
  // Register warm floodlight illumination over the tennis court for night mode
  S.lights.push(
    [new THREE.Vector3(cx, yBase + 2.8, cz - 1.8), '#ffdfa0', 5.2, 2.2],
    [new THREE.Vector3(cx, yBase + 2.8, cz + 1.8), '#ffdfa0', 5.2, 2.2]
  );

  // --------------------------------------------------------------------------
  // 6. ANIMATED 2 NPC TENNIS PLAYERS (COZY CHIBI RAKA & KAMU PROPORTIONS) & PARABOLIC RALLY BALL
  // --------------------------------------------------------------------------
  const makeTennisPlayer = (shirtHex, visorHex, facingSouth, hairHex = '#4A2E1B', skinHex = '#FFE0BD') => {
    const pg = new THREE.Group();
    const bP = new Batch();
    const mShirt = mat(shirtHex, { roughness: 0.72 }, t);
    const mShorts = mat('#3B3B3B', { roughness: 0.78 }, t);
    const mShoe = mat('#F5EFE6', { roughness: 0.65 }, t);
    const mCollar = mat('#FFF8E7', { roughness: 0.68 }, t);
    const mSkin = mat(skinHex, { roughness: 0.72 }, t);
    const mHair = mat(hairHex, { roughness: 0.76 }, t);
    const mVisor = mat(visorHex, { roughness: 0.68 }, t);
    const mEye = mat('#1E1816', { roughness: 0.35 }, t);
    const mEyeShine = mat('#FFFFFF', { roughness: 0.2 }, t);
    const mBlush = mat('#F08A84', { roughness: 0.65 }, t);

    // Legs, skin ankles & white sneakers (shoe soles sit 100% flush at y = 0.000 on court surface!)
    for (const lx of [-0.072, 0.072]) {
      bP.box(mShorts, lx, 0.19, 0, 0.082, 0.22, 0.082, { r: 0.028 });
      bP.box(mSkin, lx, 0.068, 0, 0.064, 0.05, 0.064, { r: 0.018 });
      bP.box(mShoe, lx, 0.032, 0.02, 0.084, 0.062, 0.125, { r: 0.024 });
    }
    // Pelvis, Cozy Sweater/Polo Torso & Cream Collar Ring
    bP.box(mShorts, 0, 0.30, 0, 0.22, 0.12, 0.155, { r: 0.035 });
    bP.box(mShirt, 0, 0.46, 0, 0.245, 0.24, 0.165, { r: 0.048 });
    bP.box(mCollar, 0, 0.575, 0.005, 0.165, 0.045, 0.135, { r: 0.02 });
    // Left balance sweater sleeve + spherical skin hand
    bP.box(mShirt, -0.155, 0.45, 0.02, 0.068, 0.18, 0.068, { rz: 0.22, r: 0.025 });
    bP.sphere(mSkin, -0.175, 0.35, 0.03, 0.032);
    // Cozy Chibi Round Head, Neck, Voluminous Bangs/Back Hair, Eyes, Pink Oval Cheek Blushes & Sporty Visor
    bP.cyl(mSkin, 0, 0.60, 0, 0.042, 0.06);
    bP.sphere(mSkin, 0, 0.685, 0, 0.108);
    bP.sphere(mHair, 0, 0.705, -0.01, 0.114);
    bP.box(mHair, 0, 0.67, -0.065, 0.195, 0.13, 0.095, { r: 0.038 });
    bP.box(mHair, 0, 0.74, 0.068, 0.165, 0.052, 0.065, { rx: 0.12, r: 0.022 });
    for (const ex of [-0.038, 0.038]) {
      bP.sphere(mEye, ex, 0.69, 0.098, 0.014);
      bP.sphere(mEyeShine, ex + 0.004, 0.695, 0.109, 0.005);
      bP.box(mBlush, ex * 1.42, 0.668, 0.092, 0.034, 0.019, 0.012, { r: 0.006 });
    }
    bP.box(mVisor, 0, 0.735, 0.055, 0.175, 0.032, 0.135, { r: 0.012 });
    bP.build(pg);

    // Articulated right racket-swinging arm (sweater sleeve + skin hand) + 3D oval tennis racket
    const armPivot = new THREE.Group();
    armPivot.position.set(0.155, 0.53, 0);
    const bArm = new Batch();
    bArm.box(mShirt, 0.02, -0.07, 0.035, 0.068, 0.18, 0.068, { rx: -0.55, r: 0.025 });
    bArm.sphere(mSkin, 0.025, -0.13, 0.095, 0.032);
    // Racket handle, throat & oval hoop
    bArm.box(mWoodDark, 0.03, -0.14, 0.16, 0.028, 0.028, 0.18, { rx: 0.35 });
    bArm.cyl(mFenceMetal, 0.03, -0.06, 0.34, 0.13, 0.022, { rz: Math.PI / 2 });
    bArm.cyl(mNetBand, 0.03, -0.06, 0.34, 0.105, 0.012, { rz: Math.PI / 2 });
    bArm.build(armPivot);
    pg.add(armPivot);

    // 1.58x Architectural Scale (~1.20u total height, matching the 1.60x town NPCs!)
    pg.scale.setScalar(1.58);
    pg.rotation.y = facingSouth ? 0 : Math.PI;
    g.add(pg);
    return { group: pg, armPivot, facingSouth };
  };

  const playerNorth = makeTennisPlayer('#89CFF0', '#FFF8E7', true, '#4A2E1B', '#FFE0BD');
  const playerSouth = makeTennisPlayer('#FF7F50', '#FFF8E7', false, '#222222', '#F5CBA7');

  // 3D Optic-Yellow Tennis Ball + Soft Court Shadow Blob
  const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(0.072, 12, 10), mTennisBall);
  ballMesh.castShadow = true;
  g.add(ballMesh);

  const ballShadowGeo = new THREE.PlaneGeometry(0.28, 0.28);
  ballShadowGeo.rotateX(-Math.PI / 2);
  const ballShadowMat = new THREE.MeshBasicMaterial({
    map: radialTex,
    color: '#101812',
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4
  });
  const ballShadow = new THREE.Mesh(ballShadowGeo, ballShadowMat);
  g.add(ballShadow);

  tennisAnimState = {
    cx,
    cz,
    yCourtTop,
    playerNorth,
    playerSouth,
    ballMesh,
    ballShadow
  };
  updateTennisCourt(0);
}

// Live Parabolic Rally Animation for the 2 Tennis Players & Tennis Ball
export function updateTennisCourt(t) {
  if (!tennisAnimState) return;
  const { cx, cz, yCourtTop, playerNorth, playerSouth, ballMesh, ballShadow } = tennisAnimState;

  const zNorth = cz - 2.32;
  const zSouth = cz + 2.32;
  const rallyDuration = 1.35; // seconds per one-way shot across the net
  const totalPhase = t / rallyDuration;
  const shotIdx = Math.floor(totalPhase);
  const u = totalPhase - shotIdx; // 0..1 progress along current shot
  const goingSouth = shotIdx % 2 === 0;

  // Deterministic cross-court & down-the-line target X coordinates per shot
  const targetX = idx => cx + Math.sin(idx * 1.93 + 0.4) * 1.35;
  const xStart = targetX(shotIdx);
  const xEnd = targetX(shotIdx + 1);
  const zStart = goingSouth ? zNorth + 0.22 : zSouth - 0.22;
  const zEnd = goingSouth ? zSouth - 0.22 : zNorth + 0.22;

  // 2-stage realistic tennis trajectory:
  // u in [0, 0.72]: high parabolic arc over the net landing in opponent's service box
  // u in [0.72, 1.0]: crisp bounce up to the receiver's racket at the baseline
  const bx = xStart + (xEnd - xStart) * u;
  const bz = zStart + (zEnd - zStart) * u;
  let by;
  const hitHeight = yCourtTop + 0.78;
  const netClearHeight = yCourtTop + 1.32;
  if (u < 0.74) {
    const k = u / 0.74;
    by = (1 - k) * hitHeight + k * (yCourtTop + 0.068) + 4 * k * (1 - k) * (netClearHeight - hitHeight * 0.5);
  } else {
    const k = (u - 0.74) / 0.26;
    by = yCourtTop + 0.068 + Math.sin(k * Math.PI * 0.65) * 0.54;
  }

  ballMesh.position.set(bx, by, bz);
  ballShadow.position.set(bx, yCourtTop + 0.008, bz);
  const shadowScale = Math.max(0.45, 1.15 - (by - yCourtTop) * 0.45);
  ballShadow.scale.setScalar(shadowScale);

  // Smooth lateral footwork & racket swing for both players
  const northTargetX = goingSouth ? xStart * (1 - u * 0.5) + cx * (u * 0.5) : xStart * (1 - u) + xEnd * u;
  const southTargetX = goingSouth ? xStart * (1 - u) + xEnd * u : xStart * (1 - u * 0.5) + cx * (u * 0.5);

  const northHop = Math.abs(Math.sin(t * 7.5)) * 0.035;
  const southHop = Math.abs(Math.cos(t * 7.5)) * 0.035;
  playerNorth.group.position.set(northTargetX, yCourtTop + northHop, zNorth);
  playerSouth.group.position.set(southTargetX, yCourtTop + southHop, zSouth);

  // Swing racket forward right around impact (u near 0 when hitting, u near 1 when receiving)
  const northSwing = goingSouth
    ? Math.exp(-u * 6.5) * 1.15 - 0.25
    : u > 0.68
      ? Math.sin(((u - 0.68) / 0.32) * Math.PI) * -0.85
      : -0.25;
  const southSwing = !goingSouth
    ? Math.exp(-u * 6.5) * 1.15 - 0.25
    : u > 0.68
      ? Math.sin(((u - 0.68) / 0.32) * Math.PI) * -0.85
      : -0.25;

  playerNorth.armPivot.rotation.x = -northSwing;
  playerNorth.group.rotation.y = (xEnd - xStart) * 0.08;
  playerSouth.armPivot.rotation.x = -southSwing;
  playerSouth.group.rotation.y = Math.PI - (xEnd - xStart) * 0.08;
}

// ============================================================================
// ARCHITECTURAL LANDSCAPE TAMAN KOTA (NEXT TO POS #6 STRAWBERRY CORNER)
// Built 100% from the 4-Panel Landscape Concept Sheet:
// 1) Rounded Outer Sidewalk (y = 0.16, paved stone tiles) + Boundary Hedge (#4F7745)
//    + Black Wrought-Iron Perimeter Fence with 4 Open Entryways (N, S, E, W)
// 2) Herringbone Terracotta Brick Pathways (#C98C70, y = 0.175, polygonOffset)
//    + Central Stone Fountain (2 tiered bowls + water droplets)
//    + 6 Curved Vintage Benches with Wooden Planter Boxes & Hydrangea Borders
// 3) Top Zone: Octagonal Shaded Timber Gazebo (two-tiered shingle roof + pink rose vines)
//    Left Zone: Kidney/Freeform Duck Pond (river stones, lily pads, 4 swimming white ducks)
//    Right Zone: Vintage Pastel-White Ice Cream Cart (red/white umbrella) + Park Map Signboard
//    Details: Weeping Willow Tree, Spreading Oak Trees, 4 Vintage Lamp Posts with
//    Hanging Flower Baskets, and Stone Drinking Fountain / Birdbath
// ============================================================================
const tamanKotaInstances = [];

// ============================================================================
// GLOBAL COZY CHIBI NPC GENERATOR & SHARED GEOMETRIES (ALA RAKA & KAMU)
// Shared across all Town Pedestrians, Café Guests, Window Shoppers, Cyclists,
// and Park Bench Companions (Kamu & Raka) for 100% visual consistency & fast GPU batching.
// ============================================================================
export const NPC_PALETTES = {
  shirts: [
    '#FF7F50', // Coral / Oranye lembut
    '#FFF8E7', // Krem Gading
    '#F4C430', // Kuning Mustard
    '#9DC183', // Sage Green
    '#E8A598', // Dusty Pink
    '#89CFF0', // Biru Langit Lembut
    '#C3B1E1', // Lavender
    '#D86A43'  // Terracotta Hangat
  ],
  pants: [
    '#3B3B3B', // Abu-abu arang
    '#556B2F', // Hijau Olive
    '#4A647C', // Biru Denim
    '#8B7355', // Cokelat Khaki
    '#C2B299'  // Krem Gelap
  ],
  hairs: [
    '#4A2E1B', // Cokelat Espresso
    '#222222', // Hitam Pekat
    '#8B5A2B', // Cokelat Karamel
    '#D4A359'  // Pirang Hangat
  ],
  skins: [
    '#FFE0BD', // Warm Peach Light
    '#F5CBA7', // Warm Honey Beige
    '#E0AC69'  // Warm Golden Tan
  ],
  shoes: [
    '#F5EFE6', // Sepatu Kets Putih / Krem
    '#8B5A2B'  // Sepatu Kets Cokelat
  ],
  berets: [
    '#D94E41', // Merah Baret Klasik
    '#F4C430', // Mustard Hangat
    '#4A647C', // Biru Kasual
    '#8B7355'  // Cokelat Khaki
  ]
};

export const NPC_SHARED_GEOS = (() => {
  const blushSphere = new THREE.SphereGeometry(0.022, 8, 6);
  blushSphere.scale(1.25, 0.68, 0.40);
  return {
    // Seated / Standing Shared Body & Limb Geometries (Raka & Kamu Proportions)
    pelvisGeo: roundedBox(0.30, 0.13, 0.24, 0.045),
    seatedThighGeo: roundedBox(0.118, 0.118, 0.30, 0.04),
    standingThighGeo: roundedBox(0.108, 0.21, 0.108, 0.038),
    calfGeo: roundedBox(0.098, 0.23, 0.098, 0.032),
    standingCalfGeo: roundedBox(0.094, 0.175, 0.094, 0.032),
    ankleGeo: roundedBox(0.082, 0.06, 0.082, 0.02),
    shoeGeo: roundedBox(0.108, 0.072, 0.165, 0.028),
    shoeSoleGeo: roundedBox(0.112, 0.022, 0.170, 0.010),
    torsoGeo: roundedBox(0.33, 0.40, 0.20, 0.065),
    standingTorsoGeo: roundedBox(0.295, 0.36, 0.195, 0.062),
    collarGeo: roundedBox(0.22, 0.06, 0.18, 0.025),
    standingCollarGeo: roundedBox(0.20, 0.056, 0.168, 0.024),
    armGeo: roundedBox(0.088, 0.26, 0.088, 0.032),
    cuffGeo: roundedBox(0.082, 0.034, 0.082, 0.014),
    handGeo: new THREE.SphereGeometry(0.042, 8, 7),
    neckGeo: new THREE.CylinderGeometry(0.052, 0.058, 0.08, 10),
    headGeo: new THREE.SphereGeometry(0.155, 14, 12),
    standingHeadGeo: new THREE.SphereGeometry(0.138, 14, 12),
    hairCapGeo: new THREE.SphereGeometry(0.164, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62),
    standingHairCapGeo: new THREE.SphereGeometry(0.147, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62),
    hairBangsGeo: roundedBox(0.22, 0.072, 0.088, 0.032),
    standingHairBangsGeo: roundedBox(0.205, 0.068, 0.084, 0.030),
    hairBackGeo: roundedBox(0.28, 0.18, 0.14, 0.05),
    standingHairBackGeo: roundedBox(0.255, 0.168, 0.135, 0.048),
    sideLockGeo: roundedBox(0.054, 0.138, 0.095, 0.022),
    hairBunGeo: new THREE.SphereGeometry(0.068, 10, 8),
    curtainBangGeo: roundedBox(0.095, 0.082, 0.085, 0.028),
    beretGeo: new THREE.CylinderGeometry(0.14, 0.16, 0.055, 14),
    standingBeretGeo: new THREE.CylinderGeometry(0.128, 0.146, 0.052, 14),
    eyeGeo: new THREE.SphereGeometry(0.018, 8, 6),
    eyeShineGeo: new THREE.SphereGeometry(0.0065, 6, 5),
    blushGeo: blushSphere,
    cupGeo: new THREE.CylinderGeometry(0.042, 0.034, 0.11, 10),
    sleeveGeo: new THREE.CylinderGeometry(0.044, 0.038, 0.045, 10),
    strawGeo: new THREE.CylinderGeometry(0.007, 0.007, 0.07, 6)
  };
})();

export const createNPC = ({
  shirtHex = NPC_PALETTES.shirts[0],
  pantsHex = NPC_PALETTES.pants[0],
  hairHex = NPC_PALETTES.hairs[0],
  skinHex = NPC_PALETTES.skins[0],
  shoeHex = NPC_PALETTES.shoes[0],
  collarHex = '#FFF8E7',
  hairStyle = 0, // 0: Bob berponi, 1: Sanggul/Kuncir belakang, 2: Belah tengah, 3: Topi baret
  hasBerryDrink = false,
  hasBeret = false
} = {}) => {
  const npc = new THREE.Group();
  const makeUniqueMat = (c, roughness) => patch(new THREE.MeshStandardMaterial({ color: c, roughness, metalness: 0 }));
  const mSkin = makeUniqueMat(skinHex, 0.72);
  const mShirt = makeUniqueMat(shirtHex, 0.68);
  const mPants = makeUniqueMat(pantsHex, 0.78);
  const mHair = makeUniqueMat(hairHex, 0.76);
  const mShoe = makeUniqueMat(shoeHex, 0.65);
  const mCollar = makeUniqueMat(collarHex, 0.65);
  const mEye = mat('#1E1816', { roughness: 0.35 });
  const mEyeShine = mat('#FFFFFF', { roughness: 0.2 });
  const mBlush = mat('#F08A84', { roughness: 0.65 });

  // Pelvis / Hips resting on top of the wooden bench seat (y = 0)
  const pelvis = new THREE.Mesh(NPC_SHARED_GEOS.pelvisGeo, mPants);
  pelvis.position.set(0, 0.065, -0.02);
  pelvis.castShadow = pelvis.receiveShadow = true;
  npc.add(pelvis);

  // Left & Right Thighs bent 90° horizontally forward (+Z) along the bench seat
  for (const sx of [-0.088, 0.088]) {
    const thigh = new THREE.Mesh(NPC_SHARED_GEOS.seatedThighGeo, mPants);
    thigh.position.set(sx, 0.068, 0.11);
    thigh.castShadow = thigh.receiveShadow = true;
    npc.add(thigh);
  }

  // Articulated Lower Legs (Calves + Ankles + Sneakers) pivoted at the knees (z = 0.24, y = 0.068)
  const makeLowerLeg = sx => {
    const kneePivot = new THREE.Group();
    kneePivot.position.set(sx, 0.068, 0.24);
    const calf = new THREE.Mesh(NPC_SHARED_GEOS.calfGeo, mPants);
    calf.position.set(0, -0.115, 0);
    calf.castShadow = calf.receiveShadow = true;
    const ankle = new THREE.Mesh(NPC_SHARED_GEOS.ankleGeo, mSkin);
    ankle.position.set(0, -0.23, 0);
    const shoe = new THREE.Mesh(NPC_SHARED_GEOS.shoeGeo, mShoe);
    shoe.position.set(0, -0.265, 0.028);
    shoe.castShadow = shoe.receiveShadow = true;
    kneePivot.add(calf, ankle, shoe);
    npc.add(kneePivot);
    return kneePivot;
  };
  const leftLegPivot = makeLowerLeg(-0.088);
  const rightLegPivot = makeLowerLeg(0.088);

  // Cozy Sweater Torso & Cream Collar Ring
  const torso = new THREE.Mesh(NPC_SHARED_GEOS.torsoGeo, mShirt);
  torso.position.set(0, 0.31, -0.03);
  torso.rotation.x = -0.05;
  torso.castShadow = torso.receiveShadow = true;
  npc.add(torso);

  const collar = new THREE.Mesh(NPC_SHARED_GEOS.collarGeo, mCollar);
  collar.position.set(0, 0.50, -0.02);
  npc.add(collar);

  // Relaxed Left & Right Rounded Arms + Skin Hands
  const lArm = new THREE.Mesh(NPC_SHARED_GEOS.armGeo, mShirt);
  lArm.position.set(-0.20, 0.31, 0.02);
  lArm.rotation.set(-0.42, 0, 0.12);
  lArm.castShadow = true;
  const rArm = new THREE.Mesh(NPC_SHARED_GEOS.armGeo, mShirt);
  rArm.position.set(0.20, 0.31, 0.04);
  rArm.rotation.set(-0.55, 0, -0.12);
  rArm.castShadow = true;
  npc.add(lArm, rArm);

  const lHand = new THREE.Mesh(NPC_SHARED_GEOS.handGeo, mSkin);
  lHand.position.set(-0.18, 0.19, 0.12);
  const rHand = new THREE.Mesh(NPC_SHARED_GEOS.handGeo, mSkin);
  rHand.position.set(0.17, 0.20, 0.15);
  npc.add(lHand, rHand);

  if (hasBerryDrink) {
    const cup = new THREE.Mesh(NPC_SHARED_GEOS.cupGeo, mat('#FFF9F2'));
    cup.position.set(0.15, 0.24, 0.18);
    const sleeve = new THREE.Mesh(NPC_SHARED_GEOS.sleeveGeo, mat('#E46C5E'));
    sleeve.position.set(0.15, 0.235, 0.18);
    const straw = new THREE.Mesh(NPC_SHARED_GEOS.strawGeo, mat('#4D8B55'));
    straw.position.set(0.15, 0.31, 0.18);
    straw.rotation.z = -0.2;
    npc.add(cup, sleeve, straw);
  }

  // Articulated Head & Neck Pivot (at y = 0.54)
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.54, -0.02);
  npc.add(headPivot);

  const neck = new THREE.Mesh(NPC_SHARED_GEOS.neckGeo, mSkin);
  neck.position.set(0, 0.03, 0);
  headPivot.add(neck);

  const head = new THREE.Mesh(NPC_SHARED_GEOS.headGeo, mSkin);
  head.position.set(0, 0.16, 0);
  head.castShadow = head.receiveShadow = true;
  headPivot.add(head);

  // Voluminous Hair Cap, Rounded Front Bangs & Back Hair
  const hairCap = new THREE.Mesh(NPC_SHARED_GEOS.hairCapGeo, mHair);
  hairCap.position.set(0, 0.175, -0.01);
  hairCap.rotation.x = -0.14;
  headPivot.add(hairCap);

  const hairBangs = new THREE.Mesh(NPC_SHARED_GEOS.hairBangsGeo, mHair);
  hairBangs.position.set(0, 0.235, 0.105);
  hairBangs.rotation.x = 0.12;
  headPivot.add(hairBangs);

  const hairBack = new THREE.Mesh(NPC_SHARED_GEOS.hairBackGeo, mHair);
  hairBack.position.set(0, 0.13, -0.09);
  headPivot.add(hairBack);

  for (const sx of [-0.13, 0.13]) {
    const sLock = new THREE.Mesh(NPC_SHARED_GEOS.sideLockGeo, mHair);
    sLock.position.set(sx, 0.14, 0.015);
    headPivot.add(sLock);
  }

  if (hairStyle === 1) {
    const bun = new THREE.Mesh(NPC_SHARED_GEOS.hairBunGeo, mHair);
    bun.position.set(0, 0.17, -0.17);
    headPivot.add(bun);
  }

  if (hasBeret || hairStyle === 3) {
    const beret = new THREE.Mesh(NPC_SHARED_GEOS.beretGeo, mat('#D93829', { roughness: 0.68 }));
    beret.position.set(0.02, 0.31, 0);
    beret.rotation.set(-0.1, 0, -0.16);
    headPivot.add(beret);
  }

  // Expressive Glossy Black Eyes (+ White Sparkle) & Pink Oval Cheek Blushes on Front (+Z) of Head
  for (const ex of [-0.052, 0.052]) {
    const eye = new THREE.Mesh(NPC_SHARED_GEOS.eyeGeo, mEye);
    eye.position.set(ex, 0.165, 0.142);
    headPivot.add(eye);
    const shine = new THREE.Mesh(NPC_SHARED_GEOS.eyeShineGeo, mEyeShine);
    shine.position.set(ex + 0.005, 0.172, 0.156);
    headPivot.add(shine);
    const blush = new THREE.Mesh(NPC_SHARED_GEOS.blushGeo, mBlush);
    blush.position.set(ex * 1.45, 0.135, 0.135);
    headPivot.add(blush);
  }

  npc.userData = {
    headPivot,
    leftLegPivot,
    rightLegPivot,
    torso
  };
  return npc;
};

const buildSeatedMatchNPC = createNPC;

export function buildTamanKota(world, cx, cz, ry = Math.PI / 2, openWestBorder = false) {
  const g = new THREE.Group();
  g.position.set(cx, 0, cz);
  g.rotation.y = ry;
  world.add(g);

  const b = new Batch();
  const mCurb = mat('#BFB4A6', { roughness: 0.88 });
  const mSidewalk = mat('#D8D0C5', { map: sidewalkTileTex, roughness: 0.85 });
  const mLawn = mat('#6A9852', { map: grassTex, roughness: 0.90 });
  const mHedge = mat('#4F7745', { roughness: 0.84, flatShading: true });
  const mHedgeLight = mat('#669257', { roughness: 0.82, flatShading: true });
  const mIron = mat('#232629', { roughness: 0.45, metalness: 0.48 });
  const mBrickPath = mat('#D6987C', {
    map: herringboneBrickTex,
    roughness: 0.84,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2
  });
  const mPathBorder = mat('#DFD2BE', {
    roughness: 0.82,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1
  });
  const mFountainStone = mat('#EAE0CE', { roughness: 0.78 });
  const mFountainTrim = mat('#D6C8B2', { roughness: 0.82 });
  const mWater = mat('#5BB2C6', {
    roughness: 0.16,
    metalness: 0.20,
    emissive: '#286A7A',
    emissiveIntensity: 0.36
  });
  const mPondWater = mat('#55A4B2', {
    roughness: 0.18,
    metalness: 0.18,
    emissive: '#235E6B',
    emissiveIntensity: 0.32,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1
  });
  const mTimber = mat('#7C5336', { roughness: 0.82 });
  const mTimberLight = mat('#B68254', { roughness: 0.78 });
  const mShingleRoof = mat('#6E503B', { roughness: 0.84 });
  const mShingleDark = mat('#543B2A', { roughness: 0.86 });
  const mWillowBark = mat('#6A503B', { roughness: 0.88 });
  const mWillowLeaf = mat('#72A255', { roughness: 0.76, flatShading: true });
  const mWillowLight = mat('#88B66A', { roughness: 0.76, flatShading: true });
  const mOakLeaf = mat('#5C8B46', { roughness: 0.78, flatShading: true });
  const mOakLight = mat('#74A15A', { roughness: 0.78, flatShading: true });
  const mHydrangeaBlue = mat('#6C8EE0', { roughness: 0.68 });
  const mHydrangeaPurple = mat('#9A76D2', { roughness: 0.68 });
  const mHydrangeaPink = mat('#E87E96', { roughness: 0.68 });
  const mFlowerRose = mat('#E26882', { roughness: 0.65 });
  const mFlowerCream = mat('#FFF7E8', { roughness: 0.65 });
  const mFlowerYellow = mat('#F4CA56', { roughness: 0.65 });
  const mRiverStoneA = mat('#9E978D', { roughness: 0.88 });
  const mRiverStoneB = mat('#B6AFA4', { roughness: 0.86 });
  const mLilyPad = mat('#4B8A46', { roughness: 0.76 });
  const mCartWhite = mat('#FAF5EC', { roughness: 0.68 });
  const mCartRed = mat('#D8524E', { roughness: 0.70 });
  const mCartMint = mat('#92BFA8', { roughness: 0.74 });
  const mBrass = mat('#E2B24A', { roughness: 0.34, metalness: 0.62 });
  const mLanternGlow = mat('#FFF3CC', { emissive: '#FFD89B', emissiveIntensity: 1.1, roughness: 0.30 });
  bulbMaterials.push(mLanternGlow);
  const mDuckWhite = mat('#FAF6EE', { roughness: 0.65 });
  const mDuckBill = mat('#E89638', { roughness: 0.60 });
  const mTactileYellow = mat('#E2B842', { roughness: 0.72 });

  // --------------------------------------------------------------------------
  // 1. OUTER SIDEWALK (y = 0.16), INNER LAWN & BOUNDARY HEDGE + IRON FENCE
  //    WITH 4 OPEN ENTRYWAYS (North, South, East, West)
  //    When openWestBorder is true (Combined Superblock with Urban Pocket Park
  //    & Strawberry Corner), the continuous superblock Granite Plaza & Curb are
  //    built in buildUrbanPocketPark so all 3 zones share 100% seamless tiles!
  // --------------------------------------------------------------------------
  if (!openWestBorder) {
    b.add(mCurb, hollowCurbRingGeo(BLOCK, BLOCK, 1.2, 0.14, 0.190), 0, 0, 0);
    b.add(mSidewalk, lotGeometry(BLOCK - 0.28, 1.06, 0.180), 0, 0, 0);
    b.add(mTactileYellow, hollowCurbRingGeo(BLOCK - 0.36, BLOCK - 0.36, 1.02, 0.12, 0.015), 0, 0.180, 0);
  }
  b.add(mLawn, roundedRectGeometry(8.20, 8.20, 0.52, 0.008), 0, 0.180, 0);

  // Helper: Build Boundary Hedge (#4F7745) + Wrought-Iron Fence (#232629) segment from (x0, z0) to (x1, z1)
  const addHedgeFenceSeg = (x0, z0, x1, z1) => {
    const dx = x1 - x0;
    const dz = z1 - z0;
    const len = Math.hypot(dx, dz);
    const mx = (x0 + x1) * 0.5;
    const mz = (z0 + z1) * 0.5;
    const ang = Math.atan2(dx, dz);
    // Neatly trimmed Boundary Hedge (#4F7745) at base of fence (y = 0.168 -> 0.488)
    b.box(mHedge, mx, 0.318, mz, 0.34, 0.30, len, { ry: ang, r: 0.04 });
    b.box(mHedgeLight, mx, 0.472, mz, 0.28, 0.04, len - 0.04, { ry: ang, r: 0.01 });
    // Black Wrought-Iron Perimeter Fence mounted on top of the hedge (y = 0.47 -> 0.86)
    b.box(mIron, mx, 0.52, mz, 0.032, 0.028, len, { ry: ang });
    b.box(mIron, mx, 0.82, mz, 0.032, 0.028, len, { ry: ang });
    const nPickets = Math.max(3, Math.round(len / 0.17));
    for (let k = 0; k <= nPickets; k++) {
      const u = k / nPickets;
      const px = x0 + dx * u;
      const pz = z0 + dz * u;
      const isPost = k === 0 || k === nPickets;
      if (isPost) {
        b.box(mIron, px, 0.54, pz, 0.075, 0.74, 0.075, { ry: ang });
        b.sphere(mIron, px, 0.94, pz, 0.048);
      } else {
        b.cyl(mIron, px, 0.67, pz, 0.013, 0.34);
        b.add(mIron, unitCone, px, 0.865, pz, 0.032, 0.06, 0.032);
      }
    }
  };

  const pEdge = 4.10;
  const gateHalf = 0.72; // 1.44-unit wide Open Entryway on all 4 sides!
  // South border (lz = +4.10) with South Open Entryway at lx in [-0.72, +0.72]
  addHedgeFenceSeg(-pEdge, pEdge, -gateHalf, pEdge);
  addHedgeFenceSeg(gateHalf, pEdge, pEdge, pEdge);
  // North border (lz = -4.10) with North Open Entryway at lx in [-0.72, +0.72]
  addHedgeFenceSeg(-pEdge, -pEdge, -gateHalf, -pEdge);
  addHedgeFenceSeg(gateHalf, -pEdge, pEdge, -pEdge);
  // West border (lx = -4.10) with West Open Entryway at lz in [-0.87, +0.57] (aligned with zCenter = -0.15)
  // When openWestBorder is true (i === 2, j === -2 adjacent to the Contemporary Urban Pocket Park),
  // omit the West hedge/iron fence barrier so the two parks merge into one seamless double-park!
  if (!openWestBorder) {
    addHedgeFenceSeg(-pEdge, -pEdge, -pEdge, -0.87);
    addHedgeFenceSeg(-pEdge, 0.57, -pEdge, pEdge);
  }
  // East border (lx = +4.10) with East Open Entryway at lz in [-0.87, +0.57]
  addHedgeFenceSeg(pEdge, -pEdge, pEdge, -0.87);
  addHedgeFenceSeg(pEdge, 0.57, pEdge, pEdge);

  // Conical Topiary Cypress Shrubs inside the corners and flanking the entryways
  for (const [tx, tz] of [
    ...(openWestBorder ? [] : [[-3.68, -3.68], [-3.68, 3.68], [-3.68, -1.18], [-3.68, 0.88]]),
    [3.68, -3.68], [3.68, 3.68],
    [-1.08, 3.68], [1.08, 3.68]
  ]) {
    b.add(mHedge, unitCone, tx, 0.52, tz, 0.42, 0.72, 0.42);
    b.add(mHedgeLight, unitCone, tx, 0.72, tz, 0.28, 0.42, 0.28);
  }

  // --------------------------------------------------------------------------
  // 2. CIRCULAR HERRINGBONE BRICK PATHWAY (#C98C70, y = 0.175, polygonOffset)
  //    & CENTRAL STONE FOUNTAIN + 6 CURVED VINTAGE BENCHES & PLANTER BOXES
  // --------------------------------------------------------------------------
  const fz0 = -0.15; // Center of Circular Brick Plaza
  // Cream stone outer ring border (top at 0.192) & Terracotta Herringbone Circular Plaza (top at 0.198, strictly stepped)
  b.cyl(mPathBorder, 0, 0.189, fz0, 2.20, 0.006);
  b.cyl(mBrickPath, 0, 0.195, fz0, 2.08, 0.006);

  // 4 Radial Herringbone Brick Pathways connecting the Circular Plaza to the 4 Open Entryways
  // South branch (from z = fz0 + 2.00 to +4.10)
  b.box(mPathBorder, 0, 0.189, 2.98, 1.38, 0.006, 2.24);
  b.box(mBrickPath, 0, 0.195, 2.98, 1.22, 0.006, 2.24);
  // North branch (from z = fz0 - 2.00 through Gazebo to -4.10)
  b.box(mPathBorder, 0, 0.189, -3.12, 1.38, 0.006, 2.00);
  b.box(mBrickPath, 0, 0.195, -3.12, 1.22, 0.006, 2.00);
  // West branch (from x = -2.00 to -4.10 at z = fz0; meets the Unified Granite Plaza flush at the park threshold!)
  if (openWestBorder) {
    b.box(mPathBorder, -3.05, 0.189, fz0, 2.10, 0.006, 2.36);
    b.box(mBrickPath, -3.05, 0.195, fz0, 2.10, 0.006, 2.12);
  } else {
    b.box(mPathBorder, -3.05, 0.189, fz0, 2.10, 0.006, 1.38);
    b.box(mBrickPath, -3.05, 0.195, fz0, 2.10, 0.006, 1.22);
  }
  // East branch (from x = +2.00 to +4.10 at z = fz0)
  b.box(mPathBorder, 3.05, 0.189, fz0, 2.10, 0.006, 1.38);
  b.box(mBrickPath, 3.05, 0.195, fz0, 2.10, 0.006, 1.22);

  // Central Stone Fountain at (0, fz0)
  // Step base & profiled circular stone basin rim
  b.cyl(mFountainTrim, 0, 0.20, fz0, 0.96, 0.05);
  b.cyl(mFountainStone, 0, 0.29, fz0, 0.86, 0.16);
  b.cyl(mFountainTrim, 0, 0.38, fz0, 0.91, 0.045);
  // Clear blue water pool inside lower basin
  b.cyl(mWater, 0, 0.375, fz0, 0.78, 0.04);
  // Carved baluster pedestal & 2 tiered stone water bowls
  b.cyl(mFountainTrim, 0, 0.52, fz0, 0.22, 0.28);
  b.cyl(mFountainStone, 0, 0.68, fz0, 0.46, 0.06);
  b.cyl(mWater, 0, 0.71, fz0, 0.39, 0.025);
  b.cyl(mFountainTrim, 0, 0.82, fz0, 0.14, 0.20);
  b.cyl(mFountainStone, 0, 0.94, fz0, 0.26, 0.05);
  b.cyl(mWater, 0, 0.965, fz0, 0.21, 0.02);
  b.cyl(mFountainTrim, 0, 1.03, fz0, 0.07, 0.11);
  b.sphere(mFountainStone, 0, 1.11, fz0, 0.06);

  // Animated water droplets on the Central Stone Fountain
  const fountainDropsGroup = new THREE.Group();
  fountainDropsGroup.position.set(0, 0, fz0);
  g.add(fountainDropsGroup);
  const dropGeo = new THREE.SphereGeometry(0.028, 6, 5);
  const fountainDrops = [];
  for (let i = 0; i < 14; i++) {
    const dm = new THREE.Mesh(dropGeo, mWater);
    dm.userData = { angle: (i / 14) * Math.PI * 2, phase: i / 14 };
    fountainDropsGroup.add(dm);
    fountainDrops.push(dm);
  }

  // Helper: Vintage Bench with Scrolled Black Wrought-Iron Armrests + Wooden Planter Box Behind
  // (Matches Bottom-Right Panel: "Close-up: Vintage Bench & Planter Box Detail")
  const addVintageBenchWithPlanter = (bx, bz, faceRy) => {
    const cos = Math.cos(faceRy), sin = Math.sin(faceRy);
    const toW = (lx, lz) => [bx + lx * cos + lz * sin, bz - lx * sin + lz * cos];
    const yB = 0.175;
    // Slatted warm wood seat & backrest
    const [sx, sz] = toW(0, 0.05);
    b.box(mTimberLight, sx, yB + 0.22, sz, 0.92, 0.045, 0.30, { ry: faceRy, r: 0.01 });
    const [bkx, bkz] = toW(0, -0.10);
    b.box(mTimberLight, bkx, yB + 0.40, bkz, 0.92, 0.24, 0.045, { ry: faceRy, r: 0.01 });
    // Ornate scrolled black wrought-iron legs & curved armrests
    for (const lx of [-0.40, 0.40]) {
      const [lgx, lgz] = toW(lx, 0);
      b.box(mIron, lgx, yB + 0.12, lgz, 0.05, 0.24, 0.30, { ry: faceRy });
      b.box(mIron, lgx, yB + 0.31, lgz, 0.045, 0.13, 0.28, { ry: faceRy });
      const [arx, arz] = toW(lx, 0.14);
      b.cyl(mIron, arx, yB + 0.34, arz, 0.032, 0.05, { rz: Math.PI / 2 });
    }
    // Wooden Planter Box directly behind the bench backrest ("Planter Box Detail")
    const [px, pz] = toW(0, -0.30);
    b.box(mTimber, px, yB + 0.15, pz, 0.94, 0.28, 0.26, { ry: faceRy, r: 0.01 });
    b.box(mTimberLight, px, yB + 0.295, pz, 0.98, 0.03, 0.30, { ry: faceRy });
    for (let k = -1; k <= 1; k++) {
      const [fx, fz] = toW(k * 0.28, -0.30);
      b.add(k === 0 ? mHedgeLight : mHedge, crownGeo, fx, yB + 0.38, fz, 0.18, 0.15, 0.18);
      const fMat = k === -1 ? mFlowerRose : k === 0 ? mFlowerCream : mHydrangeaPink;
      b.sphere(fMat, fx + 0.04, yB + 0.47, fz + 0.03, 0.048);
      b.sphere(fMat, fx - 0.04, yB + 0.45, fz - 0.03, 0.042);
    }
  };

  // Curved Vintage Benches arranged around the Circular Plaza facing the Central Fountain
  // (Omitting -0.90 so the view between the Central Fountain and the Scenic Fish Pond is 100% open & unobstructed!)
  const benchAngles = [
    -2.00, -2.48,
     0.90,  2.00,  2.48
  ];
  const benchR = 1.92;
  for (const ang of benchAngles) {
    const bx = Math.sin(ang) * benchR;
    const bz = fz0 + Math.cos(ang) * benchR;
    const faceRy = Math.atan2(-bx, fz0 - bz);
    addVintageBenchWithPlanter(bx, bz, faceRy);
  }

  // Flowering Hydrangea Borders (Blue, Purple & Pink Hydrangeas framed by low Boxwood Borders, clear of the Fish Pond!)
  for (const [hx, hz, hCol] of [
    [-3.52, 3.05, mHydrangeaBlue],
    [-1.32, 3.05, mHydrangeaPurple],
    [1.95, 1.85, mHydrangeaPink],
    [1.45, 2.25, mHydrangeaBlue],
    [-1.95, -1.95, mHydrangeaPurple],
    [1.95, -1.95, mHydrangeaPink]
  ]) {
    b.box(mHedge, hx, 0.24, hz, 0.68, 0.14, 0.68, { r: 0.03 });
    b.add(mHedgeLight, crownGeo, hx, 0.38, hz, 0.32, 0.24, 0.32);
    for (const [dx, dz] of [[-0.12, -0.10], [0.12, 0.08], [-0.06, 0.12], [0.08, -0.12]]) {
      b.sphere(hCol, hx + dx, 0.49, hz + dz, 0.075);
    }
  }

  // --------------------------------------------------------------------------
  // 3A. TOP ZONE: SHADED TIMBER GAZEBO (Octagonal Deck, 8 Posts, Two-Tiered
  //     Brown Shingle Roof & Climbing Pink/Rose Vines) at (0, -2.68)
  // --------------------------------------------------------------------------
  const gzX = 0, gzZ = -2.68;
  const octR = 1.26;
  // Octagonal raised timber platform (8-sided cylinder at y = 0.175 -> 0.315)
  const octDeckGeo = new THREE.CylinderGeometry(octR, octR + 0.04, 0.14, 8).toNonIndexed();
  b.add(mTimber, octDeckGeo, gzX, 0.245, gzZ, 1, 1, 1, 0, Math.PI / 8, 0);
  const octFloorGeo = new THREE.CylinderGeometry(octR - 0.06, octR - 0.06, 0.02, 8).toNonIndexed();
  b.add(mTimberLight, octFloorGeo, gzX, 0.32, gzZ, 1, 1, 1, 0, Math.PI / 8, 0);
  // Front & back timber steps connecting Gazebo to Circular Plaza (+Z) and North Entryway (-Z)
  b.box(mTimberLight, gzX, 0.21, gzZ + octR + 0.08, 0.92, 0.07, 0.24, { r: 0.01 });
  b.box(mTimberLight, gzX, 0.21, gzZ - octR - 0.08, 0.92, 0.07, 0.24, { r: 0.01 });

  // 8 Octagonal Timber Posts, Lattice Railings (open on front k=0 and back k=4), & Climbing Rose Vines
  const postR = 1.08;
  for (let k = 0; k < 8; k++) {
    const a0 = (k + 0.5) * (Math.PI / 4);
    const a1 = (k + 1.5) * (Math.PI / 4);
    const px0 = gzX + Math.sin(a0) * postR;
    const pz0 = gzZ + Math.cos(a0) * postR;
    const px1 = gzX + Math.sin(a1) * postR;
    const pz1 = gzZ + Math.cos(a1) * postR;
    // Timber support post
    b.box(mTimber, px0, 1.12, pz0, 0.09, 1.60, 0.09, { ry: a0 });
    // Upper decorative arch spandrel beam between adjacent posts
    const mx = (px0 + px1) * 0.5;
    const mz = (pz0 + pz1) * 0.5;
    const segLen = Math.hypot(px1 - px0, pz1 - pz0);
    const segRy = Math.atan2(px1 - px0, pz1 - pz0);
    b.box(mTimber, mx, 1.84, mz, 0.08, 0.12, segLen, { ry: segRy });
    // Climbing green vines & pink/rose blossoms along the upper eaves & posts
    b.add(k % 2 === 0 ? mHedge : mHedgeLight, crownGeo, mx, 1.88, mz, 0.20, 0.14, 0.20);
    b.sphere(mFlowerRose, mx + 0.06, 1.92, mz + 0.04, 0.048);
    b.sphere(mHydrangeaPink, px0, 1.72, pz0, 0.052);

    // Low wooden lattice railing on the 6 side faces (skipping k = 7 front +Z and k = 3 back -Z)
    if (k !== 7 && k !== 3) {
      b.box(mTimberLight, mx, 0.68, mz, 0.05, 0.045, segLen, { ry: segRy });
      b.box(mTimberLight, mx, 0.38, mz, 0.05, 0.045, segLen, { ry: segRy });
      for (let bIdx = 1; bIdx <= 4; bIdx++) {
        const u = bIdx / 5;
        const bx = px0 + (px1 - px0) * u;
        const bz = pz0 + (pz1 - pz0) * u;
        b.box(mTimberLight, bx, 0.53, bz, 0.028, 0.28, 0.028, { ry: segRy });
      }
    }
  }

  // Two-Tiered Octagonal Brown Shingle Roof + Pointed Spire Finial
  const lowerRoofGeo = new THREE.ConeGeometry(1.48, 0.52, 8).toNonIndexed();
  b.add(mShingleRoof, lowerRoofGeo, gzX, 2.16, gzZ, 1, 1, 1, 0, Math.PI / 8, 0);
  const cupolaTierGeo = new THREE.CylinderGeometry(0.62, 0.66, 0.22, 8).toNonIndexed();
  b.add(mTimber, cupolaTierGeo, gzX, 2.38, gzZ, 1, 1, 1, 0, Math.PI / 8, 0);
  const upperRoofGeo = new THREE.ConeGeometry(0.76, 0.42, 8).toNonIndexed();
  b.add(mShingleDark, upperRoofGeo, gzX, 2.66, gzZ, 1, 1, 1, 0, Math.PI / 8, 0);
  b.cyl(mTimber, gzX, 2.92, gzZ, 0.032, 0.22);
  b.sphere(mBrass, gzX, 3.04, gzZ, 0.055);

  // --------------------------------------------------------------------------
  // 3B. LEFT ZONE: SCENIC KOI & DUCK FISH POND (Kidney Shape, River Stones,
  //     Lily Pads, 8 Swimming Koi/Goldfish, 4 Ducks & Scenic Fish Pond Bench)
  //     at (-2.42, +1.68)
  // --------------------------------------------------------------------------
  const pondX = -2.42, pondZ = 1.68;
  // Kidney/freeform organic blue-green water pool composed of 3 smooth overlapping lobes at y = 0.172
  b.cyl(mPondWater, pondX - 0.28, 0.171, pondZ - 0.18, 0.92, 0.008);
  b.cyl(mPondWater, pondX + 0.34, 0.171, pondZ + 0.24, 0.84, 0.008);
  b.cyl(mPondWater, pondX - 0.10, 0.171, pondZ + 0.42, 0.76, 0.008);

  // Natural river stones & pebbles ringing the organic shoreline
  const nStones = 26;
  for (let s = 0; s < nStones; s++) {
    const ang = (s / nStones) * Math.PI * 2;
    const rx = 1.12 + Math.sin(ang * 2.0) * 0.18;
    const rz = 0.98 + Math.cos(ang * 2.0) * 0.16;
    const sx = pondX + Math.cos(ang) * rx;
    const sz = pondZ + Math.sin(ang) * rz + 0.10;
    const sr = 0.11 + (s % 3) * 0.035;
    b.cyl(s % 2 === 0 ? mRiverStoneA : mRiverStoneB, sx, 0.185, sz, sr, 0.065);
  }

  // Floating Green Lily Pads (Daun Teratai) & Pink/White Lotus Blossoms
  for (const [lx, lz, lr, hasBloom] of [
    [-0.52, -0.32, 0.15, true],
    [-0.32, -0.45, 0.12, false],
    [0.52, 0.36, 0.14, true],
    [0.34, 0.54, 0.11, false],
    [-0.48, 0.46, 0.13, true],
    [0.56, -0.14, 0.12, false]
  ]) {
    b.cyl(mLilyPad, pondX + lx, 0.176, pondZ + lz, lr, 0.008);
    if (hasBloom) {
      b.sphere(mFlowerRose, pondX + lx, 0.19, pondZ + lz, 0.038);
    }
  }

  // 8 Animated Koi & Goldfish (Ikan Koi & Ikan Mas Kecil) swimming smoothly in loops right in front of the Fish Pond Bench!
  const mKoiRed = mat('#FF4E20', { roughness: 0.24, emissive: '#9E260A', emissiveIntensity: 0.26 });
  const mKoiGold = mat('#FFB01E', { roughness: 0.24, emissive: '#A66308', emissiveIntensity: 0.26 });
  const mKoiWhite = mat('#FFFDF8', { roughness: 0.26, emissive: '#B8A898', emissiveIntensity: 0.14 });
  const mKoiTangerine = mat('#FF7624', { roughness: 0.24, emissive: '#9E3E0A', emissiveIntensity: 0.24 });
  const mKoiFin = mat('#FFE8D6', { roughness: 0.32 });

  const koiConfigs = [
    // [cxOffset, czOffset, rx, rz, speed, phase, bodyMat, spotMat, scale, dir]
    [0.06, 0.28, 0.42, 0.30, 0.72, 0.00, mKoiRed, mKoiWhite, 1.08, 1],
    [-0.08, 0.24, 0.36, 0.26, 0.66, 0.28, mKoiGold, mKoiRed, 1.00, 1],
    [0.14, 0.20, 0.48, 0.34, 0.58, 0.54, mKoiWhite, mKoiRed, 1.12, -1],
    [-0.18, 0.12, 0.44, 0.32, 0.64, 0.16, mKoiTangerine, mKoiGold, 0.96, 1],
    [0.20, 0.16, 0.32, 0.24, 0.78, 0.72, mKoiGold, mKoiWhite, 0.92, -1],
    [-0.12, -0.05, 0.46, 0.34, 0.62, 0.41, mKoiRed, mKoiGold, 1.04, 1],
    [0.02, 0.34, 0.28, 0.20, 0.82, 0.85, mKoiWhite, mKoiRed, 0.94, 1],
    [-0.24, 0.22, 0.34, 0.26, 0.69, 0.63, mKoiGold, mKoiTangerine, 0.98, -1]
  ];
  const koiFish = [];
  const koiBodyGeo = roundedBox(0.064, 0.042, 0.165, 0.020);
  const koiHeadGeo = new THREE.SphereGeometry(0.032, 8, 6);
  const koiSpotGeo = new THREE.SphereGeometry(0.025, 8, 6);
  const koiPecGeo = roundedBox(0.082, 0.007, 0.038, 0.003);
  const koiTailGeo = roundedBox(0.012, 0.042, 0.068, 0.005);

  for (let k = 0; k < koiConfigs.length; k++) {
    const [cxOff, czOff, rx, rz, spd, phase, bodyMat, spotMat, sc, dir] = koiConfigs[k];
    const koiGroup = new THREE.Group();
    koiGroup.scale.setScalar(sc);

    const bodyMesh = new THREE.Mesh(koiBodyGeo, bodyMat);
    bodyMesh.position.set(0, 0.008, 0.01);
    koiGroup.add(bodyMesh);

    const headMesh = new THREE.Mesh(koiHeadGeo, bodyMat);
    headMesh.position.set(0, 0.008, 0.078);
    headMesh.scale.set(0.95, 0.72, 1.15);
    koiGroup.add(headMesh);

    // Kohaku / Calico dorsal markings along the back
    const spot1 = new THREE.Mesh(koiSpotGeo, spotMat);
    spot1.position.set(0, 0.022, 0.038);
    spot1.scale.set(0.92, 0.45, 1.25);
    const spot2 = new THREE.Mesh(koiSpotGeo, spotMat);
    spot2.position.set(0, 0.020, -0.025);
    spot2.scale.set(0.80, 0.42, 1.10);
    koiGroup.add(spot1, spot2);

    // Pectoral fins
    const pecFin = new THREE.Mesh(koiPecGeo, mKoiFin);
    pecFin.position.set(0, 0.004, 0.035);
    koiGroup.add(pecFin);

    // Articulated Tail Pivot for smooth swimming tail-wag
    const tailPivot = new THREE.Group();
    tailPivot.position.set(0, 0.008, -0.068);
    const tailMesh = new THREE.Mesh(koiTailGeo, mKoiFin);
    tailMesh.position.set(0, 0.004, -0.030);
    tailPivot.add(tailMesh);
    koiGroup.add(tailPivot);

    koiGroup.userData = {
      tailPivot,
      bodyMesh,
      cx: pondX + cxOff,
      cz: pondZ + czOff,
      rx,
      rz,
      speed: spd,
      phase,
      dir
    };
    g.add(koiGroup);
    koiFish.push(koiGroup);
  }

  // 4 Animated Small White Ducks swimming on the far (-Z) lobe of the Pond
  const ducks = [];
  for (let d = 0; d < 4; d++) {
    const duckGroup = new THREE.Group();
    const bDuck = new Batch();
    bDuck.box(mDuckWhite, 0, 0.045, 0, 0.11, 0.075, 0.17, { r: 0.03 });
    bDuck.sphere(mDuckWhite, 0, 0.105, 0.065, 0.048);
    bDuck.box(mDuckBill, 0, 0.10, 0.115, 0.036, 0.022, 0.045, { r: 0.005 });
    bDuck.build(duckGroup);
    duckGroup.userData = {
      phase: d * 0.25,
      rx: d < 3 ? 0.34 : 0.20,
      rz: d < 3 ? 0.24 : 0.16,
      cx: pondX - 0.34,
      cz: pondZ - 0.26
    };
    g.add(duckGroup);
    ducks.push(duckGroup);
  }

  // --------------------------------------------------------------------------
  // 3B-2. SCENIC FISH POND BENCH (Bangku Taman Tepi Kolam Ikan) & WARM
  //       PONDSIDE GARDEN LAMPS + SEATED MATCHMAKING NPCs (05:00)
  // --------------------------------------------------------------------------
  const pondBenchX = pondX;       // -2.42 (Directly centered on the Fish Pond)
  const pondBenchZ = 3.06;        // Right on the shore of the Fish Pond
  const pondBenchRy = Math.PI;    // Facing -Z (directly toward the Fish Pond & Koi Fish)
  const yBenchPad = 0.175;
  const seatTopY = yBenchPad + 0.245; // y = 0.420

  // Lakeside Stone & Herringbone Brick Patio Pad right at the water's edge
  b.box(mPathBorder, pondBenchX, 0.171, pondBenchZ - 0.04, 1.92, 0.012, 0.88, { r: 0.06 });
  b.box(mBrickPath, pondBenchX, 0.175, pondBenchZ - 0.04, 1.76, 0.014, 0.74, { r: 0.05 });

  // Generous 2-Seater Scenic Fish Pond Bench (width = 1.28u so NPC 1 & NPC 2 sit comfortably side-by-side)
  b.box(mTimberLight, pondBenchX, yBenchPad + 0.222, pondBenchZ - 0.04, 1.28, 0.046, 0.32, { ry: pondBenchRy, r: 0.012 });
  b.box(mTimberLight, pondBenchX, yBenchPad + 0.41, pondBenchZ + 0.11, 1.28, 0.25, 0.046, { ry: pondBenchRy, r: 0.012 });
  // Warm under-bench amber LED/lantern strip for cozy evening/night atmosphere
  b.box(mLanternGlow, pondBenchX, yBenchPad + 0.185, pondBenchZ - 0.14, 1.16, 0.022, 0.028, { ry: pondBenchRy });
  for (const lxLeg of [-0.58, 0.58]) {
    b.box(mIron, pondBenchX + lxLeg, yBenchPad + 0.12, pondBenchZ, 0.052, 0.24, 0.32);
    b.box(mIron, pondBenchX + lxLeg, yBenchPad + 0.315, pondBenchZ, 0.046, 0.135, 0.29);
    b.cyl(mIron, pondBenchX + lxLeg, yBenchPad + 0.345, pondBenchZ - 0.14, 0.032, 0.055, { rz: Math.PI / 2 });
  }
  // Lush Flowering Wooden Planter Box directly behind the Fish Pond Bench backrest
  b.box(mTimber, pondBenchX, yBenchPad + 0.155, pondBenchZ + 0.32, 1.32, 0.29, 0.28, { r: 0.012 });
  b.box(mTimberLight, pondBenchX, yBenchPad + 0.305, pondBenchZ + 0.32, 1.36, 0.032, 0.32);
  for (let k = -2; k <= 2; k++) {
    const fx = pondBenchX + k * 0.24;
    const fz = pondBenchZ + 0.32;
    b.add(k % 2 === 0 ? mHedgeLight : mHedge, crownGeo, fx, yBenchPad + 0.39, fz, 0.18, 0.15, 0.18);
    const fMat = k % 2 === 0 ? mFlowerRose : k === -1 ? mFlowerCream : mHydrangeaPink;
    b.sphere(fMat, fx + 0.03, yBenchPad + 0.48, fz - 0.02, 0.048);
    b.sphere(fMat, fx - 0.03, yBenchPad + 0.46, fz + 0.02, 0.042);
  }

  // 2 Warm Stone & Brass Pondside Garden Lanterns right on the shoreline + warm golden water reflection glow
  const mPondWarmGlow = glowMat('#FFD27D', 1.45);
  for (const lxLantern of [pondBenchX - 0.82, pondBenchX + 0.82]) {
    const lzLantern = 2.48;
    b.cyl(mFountainTrim, lxLantern, 0.21, lzLantern, 0.12, 0.08);
    b.cyl(mFountainStone, lxLantern, 0.38, lzLantern, 0.068, 0.28);
    b.box(mIron, lxLantern, 0.54, lzLantern, 0.18, 0.035, 0.18);
    b.box(mLanternGlow, lxLantern, 0.65, lzLantern, 0.13, 0.18, 0.13);
    b.add(mIron, unitCone, lxLantern, 0.79, lzLantern, 0.22, 0.12, 0.22);
    b.sphere(mBrass, lxLantern, 0.87, lzLantern, 0.028);
    // Warm golden glow disc on the pond water surface right beside the lantern
    b.cyl(mPondWarmGlow, lxLantern + (lxLantern < pondBenchX ? 0.22 : -0.22), 0.173, lzLantern - 0.24, 0.22, 0.004);
    const wPondLamp = g.localToWorld(new THREE.Vector3(lxLantern, 0.65, lzLantern));
    addLight(wPondLamp, '#ffbe76', 4.6, 2.5, 5);
  }

  // Distance-culled warm PointLight above the Fish Pond & Scenic Bench for syahdu evening/night glow
  const pondWarmLight = addPolePointLight(g, pondBenchX, 1.88, 2.38, 1.45, '#ffae52', 11.5, 1.45, 0.0);

  let matchmakingController = null;
  if (openWestBorder) {
    const matchGroup = new THREE.Group();
    matchGroup.visible = false; // Shown when user activates Seated Park Matchmaking from Strawberry Corner
    g.add(matchGroup);

    // NPC #1 (Pengguna / User Avatar): Seated on the LEFT side of the Fish Pond Bench facing the Fish Pond
    const npcUser = buildSeatedMatchNPC({
      shirtHex: '#E46C5E',
      pantsHex: '#35495E',
      hairHex: '#3B271E',
      shoeHex: '#FFFDF8',
      hasBerryDrink: true,
      hasBeret: false
    });
    npcUser.position.set(pondBenchX + 0.29, seatTopY, pondBenchZ - 0.02);
    npcUser.rotation.y = Math.PI; // Facing -Z (directly toward the Fish Pond & swimming Koi Fish)
    matchGroup.add(npcUser);

    // NPC #2 (Teman Ngobrol / Partner Avatar): Seated on the RIGHT side of the same Fish Pond Bench facing the Fish Pond
    const npcPartner = buildSeatedMatchNPC({
      shirtHex: '#FAF0E1',
      pantsHex: '#4E6E58',
      hairHex: '#5C3A28',
      shoeHex: '#F5E6D3',
      hasBerryDrink: true,
      hasBeret: true
    });
    npcPartner.position.set(pondBenchX - 0.29, seatTopY, pondBenchZ - 0.02);
    npcPartner.rotation.y = Math.PI; // Facing -Z (directly toward the Fish Pond & swimming Koi Fish)
    npcPartner.visible = false;
    npcPartner.scale.setScalar(0.001);
    matchGroup.add(npcPartner);

    matchmakingController = {
      parkGroup: g,
      matchGroup,
      npcUser,
      npcPartner,
      active: false,
      matched: false,
      partnerPopProgress: 0,
      talkLookUntil: 0,
      setSessionState(isActive, isMatched = false) {
        this.active = isActive;
        this.matched = isMatched;
        matchGroup.visible = isActive;
        if (!isActive) {
          npcPartner.visible = false;
          npcPartner.scale.setScalar(0.001);
          this.partnerPopProgress = 0;
        } else if (!isMatched) {
          npcPartner.visible = false;
          npcPartner.scale.setScalar(0.001);
          this.partnerPopProgress = 0;
        } else {
          npcPartner.visible = true;
        }
      },
      triggerTalkLook(durationSec = 2.6) {
        this.talkLookUntil = performance.now() * 0.001 + durationSec;
      },
      getCameraPose() {
        // Smooth camera across the Fish Pond with lookAt target locked at the exact center of the Fish Pond Bench
        const camPos = g.localToWorld(new THREE.Vector3(pondBenchX + 0.45, 2.08, -2.05));
        const lookAt = g.localToWorld(new THREE.Vector3(pondBenchX, seatTopY + 0.34, pondBenchZ - 0.02));
        return { camPos, lookAt };
      },
      getWorldAnchors() {
        return {
          benchStatus: g.localToWorld(new THREE.Vector3(pondBenchX, seatTopY + 1.06, pondBenchZ - 0.02)),
          userHead: g.localToWorld(new THREE.Vector3(pondBenchX + 0.29, seatTopY + 0.88, pondBenchZ - 0.02)),
          partnerHead: g.localToWorld(new THREE.Vector3(pondBenchX - 0.29, seatTopY + 0.88, pondBenchZ - 0.02))
        };
      }
    };
    g.userData.matchmaking = matchmakingController;
  }

  // --------------------------------------------------------------------------
  // 3C. RIGHT ZONE: VINTAGE ICE CREAM CART (Red-and-White Striped Umbrella)
  //     & PARK MAP SIGNBOARD at (+2.42, -1.25) & (+1.82, -1.92)
  // --------------------------------------------------------------------------
  const icX = 2.42, icZ = -1.25, icRy = -0.52;
  const cosIc = Math.cos(icRy), sinIc = Math.sin(icRy);
  const toIc = (lx, lz) => [icX + lx * cosIc + lz * sinIc, icZ - lx * sinIc + lz * cosIc];
  // Pastel-white vintage cart body + mint & berry trim
  b.box(mCartWhite, icX, 0.52, icZ, 0.62, 0.48, 0.92, { ry: icRy, r: 0.02 });
  b.box(mCartMint, icX, 0.32, icZ, 0.64, 0.08, 0.94, { ry: icRy });
  b.box(mTimberLight, icX, 0.77, icZ, 0.68, 0.04, 0.98, { ry: icRy, r: 0.01 });
  // 2 Freezer dome lids on counter top
  const [fl1x, fl1z] = toIc(0, -0.18);
  const [fl2x, fl2z] = toIc(0, 0.18);
  b.cyl(mIron, fl1x, 0.80, fl1z, 0.13, 0.03);
  b.cyl(mIron, fl2x, 0.80, fl2z, 0.13, 0.03);
  // Brass push handle at back of cart
  const [phx, phz] = toIc(0, -0.54);
  b.box(mBrass, phx, 0.74, phz, 0.48, 0.03, 0.03, { ry: icRy });
  // 2 Large spoked wheels on sides + 2 front caster wheels
  for (const sx of [-0.34, 0.34]) {
    const [wx, wz] = toIc(sx, 0.10);
    b.cyl(mIron, wx, 0.36, wz, 0.20, 0.04, { rz: Math.PI / 2, ry: icRy });
    b.cyl(mCartWhite, wx, 0.36, wz, 0.15, 0.045, { rz: Math.PI / 2, ry: icRy });
    b.cyl(mBrass, wx, 0.36, wz, 0.045, 0.055, { rz: Math.PI / 2, ry: icRy });
  }
  // Red-and-White Striped Umbrella Canopy over the Ice Cream Cart
  const [upx, upz] = toIc(0, 0.05);
  b.cyl(mIron, upx, 1.24, upz, 0.024, 0.96);
  for (let seg = 0; seg < 8; seg++) {
    const sAng = (seg / 8) * Math.PI * 2;
    const ux = upx + Math.cos(sAng) * 0.32;
    const uz = upz + Math.sin(sAng) * 0.32;
    b.add(
      seg % 2 === 0 ? mCartRed : mCartWhite,
      unitCone,
      ux,
      1.68,
      uz,
      0.42,
      0.26,
      0.42
    );
  }
  b.add(mCartRed, unitCone, upx, 1.76, upz, 0.96, 0.28, 0.96);
  b.sphere(mCartWhite, upx, 1.92, upz, 0.045);

  // Roofed Wooden Park Map Signboard beside the Ice Cream Cart
  const pmX = 1.78, pmZ = -1.88, pmRy = -0.65;
  b.box(mTimber, pmX, 0.62, pmZ, 0.64, 0.88, 0.06, { ry: pmRy });
  b.box(mCartWhite, pmX, 0.72, pmZ, 0.52, 0.42, 0.075, { ry: pmRy });
  b.box(mLawn, pmX, 0.72, pmZ, 0.42, 0.32, 0.082, { ry: pmRy });
  b.box(mShingleRoof, pmX, 1.08, pmZ, 0.76, 0.08, 0.28, { ry: pmRy, r: 0.01 });

  // --------------------------------------------------------------------------
  // 3D. TREES (Weeping Willow & Spreading Oak), 4 VINTAGE LAMP POSTS WITH
  //     HANGING FLOWER BASKETS & STONE DRINKING FOUNTAIN / BIRDBATH
  // --------------------------------------------------------------------------
  const windFronds = [];

  // Weeping Willow Tree (Pohon Dedalu Merunduk) at back-left of Gazebo (-2.68, -2.58)
  const wx0 = -2.68, wz0 = -2.58;
  b.cyl(mWillowBark, wx0, 1.05, wz0, 0.22, 1.78);
  b.add(mWillowLeaf, crownGeo, wx0, 2.35, wz0, 1.18, 0.82, 1.18);
  b.add(mWillowLight, crownGeo, wx0 - 0.35, 2.15, wz0 + 0.25, 0.88, 0.68, 0.88);
  b.add(mWillowLight, crownGeo, wx0 + 0.38, 2.18, wz0 - 0.22, 0.86, 0.68, 0.86);
  // 16 Long drooping green willow frond curtains swaying in the breeze
  const frondGeo = new THREE.CylinderGeometry(0.045, 0.09, 1.38, 5);
  frondGeo.translate(0, -0.69, 0);
  for (let f = 0; f < 16; f++) {
    const fAng = (f / 16) * Math.PI * 2;
    const fr = 0.58 + (f % 3) * 0.22;
    const fx = wx0 + Math.cos(fAng) * fr;
    const fz = wz0 + Math.sin(fAng) * fr;
    const fy = 2.18 + (f % 2) * 0.16;
    const frondMesh = new THREE.Mesh(frondGeo, f % 2 === 0 ? mWillowLeaf : mWillowLight);
    frondMesh.position.set(fx, fy, fz);
    frondMesh.castShadow = true;
    frondMesh.userData = { offset: f * 0.55 };
    g.add(frondMesh);
    windFronds.push(frondMesh);
  }

  // Spreading Oak Tree (Pohon Ek Rindang) at back-right of Gazebo (+2.68, -2.58) & front-right (+2.68, +2.48)
  for (const [ox, oz, sc] of [[2.68, -2.58, 1.08], [2.68, 2.48, 0.92]]) {
    b.cyl(mWillowBark, ox, 0.98 * sc, oz, 0.20 * sc, 1.65 * sc);
    b.add(mOakLeaf, crownGeo, ox, 2.18 * sc, oz, 1.12 * sc, 0.86 * sc, 1.12 * sc);
    b.add(mOakLight, crownGeo, ox - 0.42 * sc, 1.98 * sc, oz + 0.28 * sc, 0.78 * sc, 0.64 * sc, 0.78 * sc);
    b.add(mOakLight, crownGeo, ox + 0.42 * sc, 2.02 * sc, oz - 0.24 * sc, 0.76 * sc, 0.62 * sc, 0.76 * sc);
  }

  // Vintage Lamp Posts with 4-Sided Glass Lantern & Hanging Flower Basket
  // (Including 2 Pondside Lamp Posts flanking the Scenic Fish Pond Bench!)
  const addVintageLampWithBasket = (lx, lz, armDirX) => {
    const yBase = 0.168;
    b.cyl(mIron, lx, yBase + 0.14, lz, 0.13, 0.28);
    b.cyl(mIron, lx, yBase + 1.08, lz, 0.044, 1.88);
    // 4-sided tapered glass lantern at top + warm point light
    b.box(mIron, lx, yBase + 2.04, lz, 0.22, 0.04, 0.22);
    b.box(mLanternGlow, lx, yBase + 2.18, lz, 0.16, 0.24, 0.16);
    b.add(mIron, unitCone, lx, yBase + 2.38, lz, 0.26, 0.16, 0.26);
    b.sphere(mBrass, lx, yBase + 2.48, lz, 0.036);
    addPolePointLight(g, lx, yBase + 2.02, lz, 1.0, '#FFD89B', 9, 2.0);
    const wLamp = g.localToWorld(new THREE.Vector3(lx, yBase + 2.18, lz));
    addLight(wLamp, '#FFD89B', 4.4, 2.2, 5);

    // Scrolled horizontal side bracket + Hanging Flower Basket at y = yBase + 1.56
    const bx = lx + armDirX * 0.26;
    b.box(mIron, lx + armDirX * 0.14, yBase + 1.62, lz, 0.28, 0.032, 0.032);
    b.cyl(mIron, bx, yBase + 1.52, lz, 0.012, 0.18);
    b.cyl(mTimber, bx, yBase + 1.40, lz, 0.13, 0.10);
    b.add(mHedgeLight, crownGeo, bx, yBase + 1.46, lz, 0.16, 0.12, 0.16);
    b.sphere(mFlowerRose, bx + 0.05, yBase + 1.50, lz + 0.04, 0.042);
    b.sphere(mFlowerYellow, bx - 0.05, yBase + 1.48, lz - 0.04, 0.038);
  };

  addVintageLampWithBasket(-1.58, -1.42, 1);
  addVintageLampWithBasket(1.58, -1.42, -1);
  addVintageLampWithBasket(-3.46, 2.86, 1);
  addVintageLampWithBasket(-1.38, 2.86, -1);
  addVintageLampWithBasket(1.58, 1.65, -1);

  // Stone Drinking Fountain / Birdbath beside the pathway at (+1.58, +0.92)
  // (Matches Bottom-Right Panel: "Stone Drinking Fountain/Birdbath Detail")
  const dfX = 1.58, dfZ = 0.92;
  b.cyl(mFountainTrim, dfX, 0.22, dfZ, 0.22, 0.10);
  b.cyl(mFountainStone, dfX, 0.45, dfZ, 0.12, 0.38);
  b.cyl(mFountainStone, dfX, 0.68, dfZ, 0.28, 0.08);
  b.cyl(mWater, dfX, 0.715, dfZ, 0.23, 0.02);
  b.cyl(mFountainTrim, dfX, 0.79, dfZ, 0.055, 0.14);
  b.sphere(mFountainStone, dfX, 0.87, dfZ, 0.042);

  b.build(g);

  g.updateMatrixWorld();
  tamanKotaInstances.push({
    g,
    fountainDrops,
    ducks,
    koiFish,
    pondWarmLight,
    windFronds,
    cascadeDrops: [],
    matchmaking: matchmakingController
  });
  return g;
}

// ============================================================================
// CONTEMPORARY URBAN POCKET PARK & UNIFIED SUPERBLOCK GRANITE PLAZA
// (Bridging Store #6 Strawberry Corner + Central Pocket Park + Taman Ujung
//  Kolam Ikan into one 11.00 x 27.40 seamless superblock at y = 0.163)
// Built 100% from the 4-Panel Concept Sheet:
// 1) Unified Polished Concrete & Granite Plaza (#DFDDD6 tiles, #C5C2B8 grout
//    & curb) + Continuous Perimeter Bike Lane wrapping the entire superblock
// 2) L-Shaped Steel & Timber Pergola Pavilion on Raised Stone Terrace + Steps
// 3) Central Water Feature: Linear Cascading Water Wall & Granite Basin Pool
// 4) Timber Lounging Deck + 2 Reclining Wooden Sun-Loungers + Red Japanese Maple
// 5) Artisanal Coffee Kiosk (Dark Steel Frame, Wood Wainscot, Counter & Awning)
// 6) Consistent Street Furniture around the entire superblock perimeter:
//    Modern LED Light Bollards, Geometric Concrete Planters, Brushed-Steel
//    Inverted-U Bicycle Racks, and Wood-Slat Planter-Benches with Under-Bench LED
// ============================================================================
export function buildUrbanPocketPark(world, cx, cz) {
  const g = new THREE.Group();
  g.position.set(cx, 0, cz);
  world.add(g);

  const b = new Batch();
  const mCurb = mat('#C5C2B8', { roughness: 0.65 });
  const mGranitePlaza = mat('#FFFFFF', {
    map: granitePlazaTex,
    roughness: 0.65
  });
  const mGraniteStep = mat('#CECAC2', { roughness: 0.80 });
  const mConcrete = mat('#C4C0B7', { roughness: 0.82 });
  const mConcreteDark = mat('#9E9A92', { roughness: 0.85 });
  const mSoil = mat('#5E493A', { roughness: 0.92 });
  const mSteel = mat('#262A2E', { roughness: 0.42, metalness: 0.55 });
  const mBrushSteel = mat('#C8D0D8', { roughness: 0.28, metalness: 0.78 });
  const mTimber = mat('#B67D4A', { roughness: 0.76 });
  const mTimberDark = mat('#8A5A32', { roughness: 0.80 });
  const mDeckGroove = mat('#684224', { roughness: 0.86 });
  const mPoolWater = mat('#54B6CA', {
    roughness: 0.14,
    metalness: 0.22,
    emissive: '#236678',
    emissiveIntensity: 0.40
  });
  const mCascadeSheet = patch(
    new THREE.MeshStandardMaterial({
      color: '#88E8FA',
      roughness: 0.12,
      metalness: 0.15,
      emissive: '#3896B0',
      emissiveIntensity: 0.45,
      transparent: true,
      opacity: 0.78
    }),
    worldTone
  );
  const mFoam = glowMat('#F2FCFF', 1.35);
  const mLedStrip = mat('#FFF4CF', { emissive: '#FFD89B', emissiveIntensity: 1.1, roughness: 0.30 });
  const mBollardGlow = mat('#FFF4CF', { emissive: '#FFD89B', emissiveIntensity: 0.9, roughness: 0.32 });
  bulbMaterials.push(mLedStrip);
  bollardMaterials.push(mBollardGlow);
  const mKioskGlass = patch(
    new THREE.MeshStandardMaterial({
      color: '#9AD4E2',
      roughness: 0.14,
      metalness: 0.20,
      emissive: '#FFE09E',
      emissiveIntensity: 0.52,
      transparent: true,
      opacity: 0.72
    }),
    worldTone
  );
  const mChalkboard = mat('#1E2622', { roughness: 0.85 });
  const mCushion = mat('#F5EFE4', { roughness: 0.75 });
  const mGreenWall = mat('#4E8243', { roughness: 0.84, flatShading: true });
  const mGreenLight = mat('#6AA05A', { roughness: 0.80, flatShading: true });
  const mBirchBark = mat('#D8D2C7', { roughness: 0.82 });
  const mMapleTrunk = mat('#5C4030', { roughness: 0.86 });
  const mMapleRed = mat('#B84335', { roughness: 0.74, flatShading: true });
  const mMapleCoral = mat('#D45B48', { roughness: 0.72, flatShading: true });
  const mUmbCoral = mat('#D95B43', { roughness: 0.72 });
  const mUmbYellow = mat('#E8B842', { roughness: 0.72 });
  const mUmbTeal = mat('#4B96A6', { roughness: 0.72 });
  const mTactileYellow = mat('#E2B842', { roughness: 0.72 });

  // --------------------------------------------------------------------------
  // 1. UNIFIED SUPERBLOCK GRANITE PLAZA & PERIMETER SIDEWALK BIKE LANE
  //    One single continuous 11.00 x 27.40 block slab at y = 0.180 covering:
  //    - South (lz in [+2.70, +13.70]): Store #6 Strawberry Corner sidewalk & lot
  //    - Center (lz in [-2.70, +2.70]): Contemporary Urban Pocket Park Plaza
  //    - North (lz in [-13.70, -2.70]): Taman Ujung Kolam Ikan perimeter sidewalk
  // --------------------------------------------------------------------------
  const yP = 0.180;
  const superblockLen = PITCH + BLOCK; // 27.40u total length
  b.add(mCurb, hollowCurbRingGeo(BLOCK, superblockLen, 1.2, 0.14, 0.190), 0, 0, 0);
  b.add(mGranitePlaza, roundedRectGeometry(BLOCK - 0.28, superblockLen - 0.28, 1.06, 0.180), 0, 0, 0);
  b.add(mTactileYellow, hollowCurbRingGeo(BLOCK - 0.36, superblockLen - 0.36, 1.02, 0.12, 0.015), 0, 0.180, 0);

  // --------------------------------------------------------------------------
  // 2. BACK-LEFT ZONE: RAISED STONE TERRACE, STEP-DOWN ACCESS & L-SHAPED
  //    STEEL & TIMBER PERGOLA PAVILION
  // --------------------------------------------------------------------------
  const yDeck = yP + 0.14; // y = 0.303
  // L-shaped raised stone terrace platform:
  // Wing A (along +Z / Strawberry Corner side): lx in [-4.35, -0.65], lz in [0.35, 3.30]
  b.box(mConcrete, -2.50, yP + 0.07, 1.82, 3.70, 0.14, 2.95);
  b.box(mGraniteStep, -2.50, yDeck + 0.006, 1.82, 3.62, 0.012, 2.87);
  // Wing B (corner return along -X / rear side): lx in [-4.35, -2.05], lz in [-1.55, 0.35]
  b.box(mConcrete, -3.20, yP + 0.07, -0.60, 2.30, 0.14, 1.90);
  b.box(mGraniteStep, -3.20, yDeck + 0.006, -0.60, 2.22, 0.012, 1.82);

  // 3 Wide Stone Steps ("Step-Down Access & Seating") on the front (+X) edge of the pergola terrace
  for (let s = 0; s < 3; s++) {
    const stepH = 0.045;
    const sx = -0.58 + s * 0.18;
    const sy = yP + stepH * (2.5 - s);
    b.box(mGraniteStep, sx, sy * 0.5 + yP * 0.5, 1.65, 0.20, (3 - s) * stepH, 2.10);
  }

  // L-Shaped Steel & Timber Pergola Columns (8 dark charcoal steel H-posts)
  const pergH = 2.32;
  const yBeam = yDeck + pergH;
  const pergPosts = [
    [-4.15, 3.05], [-2.30, 3.05], [-0.45, 3.05],
    [-4.15, 0.65], [-2.20, 0.65], [-0.45, 0.65],
    [-4.15, -1.35], [-2.20, -1.35]
  ];
  for (const [px, pz] of pergPosts) {
    b.box(mConcreteDark, px, yDeck + 0.06, pz, 0.22, 0.12, 0.22);
    b.box(mSteel, px, yDeck + pergH * 0.5, pz, 0.13, pergH, 0.13);
  }

  // L-Shaped Perimeter Steel I-Beams at y = yBeam
  b.box(mSteel, -2.30, yBeam, 3.05, 3.92, 0.15, 0.15);
  b.box(mSteel, -1.32, yBeam, 0.65, 1.96, 0.15, 0.15);
  b.box(mSteel, -0.45, yBeam, 1.85, 0.15, 0.15, 2.55);
  b.box(mSteel, -4.15, yBeam, 0.85, 0.15, 0.15, 4.55);
  b.box(mSteel, -2.20, yBeam, -0.35, 0.15, 0.15, 2.15);
  b.box(mSteel, -3.18, yBeam, -1.35, 2.12, 0.15, 0.15);

  // Warm Cedar/Teak Timber Ceiling Louvers spanning across both wings of the L-Shaped Pergola
  for (let k = 0; k <= 18; k++) {
    const lx = -4.08 + (k / 18) * 3.56;
    b.box(k % 2 === 0 ? mTimber : mTimberDark, lx, yBeam + 0.09, 1.85, 0.065, 0.08, 2.52);
  }
  for (let k = 0; k <= 9; k++) {
    const lx = -4.08 + (k / 9) * 1.82;
    b.box(k % 2 === 0 ? mTimber : mTimberDark, lx, yBeam + 0.09, -0.35, 0.065, 0.08, 2.02);
  }
  // Warm recessed pergola LED strips for Night Mode
  b.box(mLedStrip, -2.50, yBeam - 0.07, 1.85, 2.60, 0.02, 0.06);
  b.box(mLedStrip, -3.18, yBeam - 0.07, -0.35, 1.40, 0.02, 0.06);
  addLight(g.localToWorld(new THREE.Vector3(-2.4, yBeam - 0.2, 1.8)), '#ffbe76', 5.5, 2.2, 5);

  // --------------------------------------------------------------------------
  // 3. CENTRAL WATER FEATURE: LINEAR CASCADING WATER WALL & GRANITE POOL
  //    Tucked into the L-corner of the Pergola (lx <= -0.12) so the central
  //    pedestrian corridor from Strawberry Corner to the Pergola & Taman Kota is 100% open!
  // --------------------------------------------------------------------------
  const wx0 = -1.10, wz0 = -0.58;
  const poolW = 1.96, poolD = 1.24;
  // Granite Basin Coping Walls & Glowing Crystal-Aqua Water Pool
  b.box(mConcrete, wx0, yP + 0.11, wz0, poolW, 0.22, poolD);
  b.box(mGraniteStep, wx0, yP + 0.225, wz0, poolW + 0.08, 0.03, poolD + 0.08);
  b.box(mPoolWater, wx0 + 0.08, yP + 0.21, wz0, poolW - 0.28, 0.04, poolD - 0.24);

  // Tall Architectural Stone Water Wall at the -X end of the pool
  const wallX = wx0 - poolW * 0.5 + 0.14;
  b.box(mConcrete, wallX, yP + 0.54, wz0, 0.28, 1.08, 1.14);
  b.box(mGraniteStep, wallX, yP + 1.09, wz0, 0.34, 0.04, 1.20);
  // Stainless-Steel Spillway Lip + Translucent Cascading Water Curtain + White Splash Foam Bar
  b.box(mBrushSteel, wallX + 0.16, yP + 0.94, wz0, 0.14, 0.03, 0.88);
  b.box(mCascadeSheet, wallX + 0.21, yP + 0.58, wz0, 0.04, 0.72, 0.84, { rz: -0.08 });
  b.box(mFoam, wallX + 0.25, yP + 0.24, wz0, 0.14, 0.045, 0.88);

  // 16 Animated Cascading Water Droplets & Splash Bubbles for updateTamanKota(t)
  const cascadeDrops = [];
  const dropGeo = new THREE.SphereGeometry(0.032, 6, 5);
  for (let i = 0; i < 16; i++) {
    const dm = new THREE.Mesh(dropGeo, i % 3 === 0 ? mFoam : mPoolWater);
    dm.userData = {
      baseX: wallX + 0.20,
      baseY: yP + 0.93,
      lz: wz0 - 0.38 + (i / 15) * 0.76,
      phase: (i * 0.19) % 1
    };
    g.add(dm);
    cascadeDrops.push(dm);
  }

  // --------------------------------------------------------------------------
  // 4. SIDE LOUNGE ZONE (BESIDE PERGOLA): TIMBER LOUNGING DECK, 2 RECLINING
  //    WOODEN SUN-LOUNGERS & CORNER PLANTER WITH RED JAPANESE MAPLE
  //    Repositioned to the -X side (lx <= -1.45) and outer rear-left corner
  //    (-3.45, -3.48) so the >= 2.8m straight entrance corridor to the Pergola
  //    and Taman Kota Herringbone Brick Gate is 100% unobstructed!
  // --------------------------------------------------------------------------
  const dkX = -2.50, dkZ = -2.32, dkW = 2.10, dkD = 1.44;
  const yTimber = yP + 0.09;
  b.box(mDeckGroove, dkX, yP + 0.045, dkZ, dkW, 0.09, dkD);
  // Individual warm teak deck planks with visible dark grooves
  const nPlanks = 10;
  for (let p = 0; p < nPlanks; p++) {
    const pz = dkZ - dkD * 0.5 + ((p + 0.5) / nPlanks) * dkD;
    b.box(p % 2 === 0 ? mTimber : mTimberDark, dkX, yTimber + 0.008, pz, dkW - 0.06, 0.018, dkD / nPlanks - 0.02);
  }
  // Low timber step along the +X front edge of the deck
  b.box(mTimber, dkX + dkW * 0.5 + 0.10, yP + 0.025, dkZ, 0.20, 0.05, dkD * 0.86);

  // 2 Wooden Sun-Loungers / Reclining Deck Chairs neatly arranged on the Timber Lounging Deck
  for (const lzChair of [dkZ + 0.35, dkZ - 0.35]) {
    const cxChair = dkX - 0.12;
    // Teak frame & legs
    b.box(mTimberDark, cxChair, yTimber + 0.09, lzChair, 1.28, 0.06, 0.48, { r: 0.01 });
    b.box(mTimber, cxChair + 0.20, yTimber + 0.13, lzChair, 0.78, 0.04, 0.44, { r: 0.01 });
    // Angled reclining backrest + cream lounge cushion
    b.box(mTimber, cxChair - 0.40, yTimber + 0.26, lzChair, 0.50, 0.04, 0.44, { rz: -0.48, r: 0.01 });
    b.box(mCushion, cxChair + 0.20, yTimber + 0.165, lzChair, 0.74, 0.035, 0.40, { r: 0.01 });
    b.box(mCushion, cxChair - 0.37, yTimber + 0.285, lzChair, 0.44, 0.035, 0.40, { rz: -0.48, r: 0.01 });
  }

  // Geometric Concrete Planter + Crimson/Red-Leaf Japanese Maple Tree tucked cleanly at the outer rear-left corner (-3.45, -3.48)
  const mpX = -3.45, mpZ = -3.48;
  b.box(mConcrete, mpX, yP + 0.22, mpZ, 0.84, 0.44, 0.84);
  b.box(mGraniteStep, mpX, yP + 0.45, mpZ, 0.90, 0.04, 0.90);
  b.add(mGreenWall, crownGeo, mpX - 0.18, yP + 0.54, mpZ + 0.15, 0.24, 0.18, 0.24);
  b.add(mGreenLight, crownGeo, mpX + 0.20, yP + 0.52, mpZ - 0.15, 0.22, 0.16, 0.22);
  // Multi-stemmed Japanese Maple trunk & vibrant crimson-red layered foliage canopy
  b.cyl(mMapleTrunk, mpX, yP + 0.98, mpZ, 0.085, 1.12, { rz: 0.08 });
  b.cyl(mMapleTrunk, mpX - 0.12, yP + 1.18, mpZ + 0.08, 0.055, 0.75, { rz: 0.24, rx: -0.15 });
  b.cyl(mMapleTrunk, mpX + 0.14, yP + 1.15, mpZ - 0.08, 0.055, 0.72, { rz: -0.22, rx: 0.14 });
  b.add(mMapleRed, crownGeo, mpX, yP + 1.68, mpZ, 0.78, 0.52, 0.78);
  b.add(mMapleCoral, crownGeo, mpX - 0.32, yP + 1.52, mpZ + 0.22, 0.56, 0.40, 0.56);
  b.add(mMapleCoral, crownGeo, mpX + 0.34, yP + 1.55, mpZ - 0.20, 0.54, 0.38, 0.54);
  b.add(mMapleRed, crownGeo, mpX + 0.05, yP + 1.92, mpZ + 0.04, 0.52, 0.36, 0.52);

  // --------------------------------------------------------------------------
  // 5. FRONT-RIGHT ZONE: ARTISANAL COFFEE KIOSK ("Compact Coffee Kiosk Detail")
  //    Dark Steel Frame, Warm Wood Wainscot, Service Counter, Slanted Awning,
  //    Chalkboard Menu & Interior Espresso Bar at (lx = +2.65, lz = -1.75)
  // --------------------------------------------------------------------------
  const kx = 2.65, kz = -1.75;
  const kw = 1.68, kd = 1.38, kh = 1.62;
  // Concrete plinth & dark steel structural frame
  b.box(mConcreteDark, kx, yP + 0.05, kz, kw + 0.10, 0.10, kd + 0.10);
  b.box(mSteel, kx, yP + kh * 0.5 + 0.05, kz, kw, kh, kd);
  // Warm Wood Lower Wainscot Panels (#B67D4A) framed by dark steel mullions
  b.box(mTimber, kx, yP + 0.44, kz, kw + 0.03, 0.68, kd + 0.03);
  b.box(mSteel, kx, yP + 0.78, kz, kw + 0.05, 0.04, kd + 0.05);
  // Glowing Glass Upper Windows on Front (+X), Left (+Z), and Right (-Z)
  b.box(mKioskGlass, kx, yP + 1.18, kz, kw + 0.02, 0.74, kd - 0.18);
  b.box(mKioskGlass, kx, yP + 1.18, kz, kw - 0.18, 0.74, kd + 0.02);
  // Corner & middle steel columns
  for (const sx of [-kw * 0.5, 0, kw * 0.5]) {
    for (const sz of [-kd * 0.5, kd * 0.5]) {
      b.box(mSteel, kx + sx, yP + kh * 0.5 + 0.05, kz + sz, 0.07, kh, 0.07);
    }
  }
  // Overhanging Flat Roof with Dark Fascia Cap
  b.box(mSteel, kx, yP + kh + 0.10, kz, kw + 0.28, 0.12, kd + 0.28);
  b.box(mGraniteStep, kx, yP + kh + 0.17, kz, kw + 0.16, 0.03, kd + 0.16);
  // Cantilevered Warm Wood Service Counter + Slanted Dark Steel Awning on Front (+X) & Plaza (+Z) faces
  b.box(mTimber, kx + kw * 0.5 + 0.12, yP + 0.78, kz + 0.18, 0.24, 0.045, 0.88, { r: 0.01 });
  b.box(mSteel, kx + kw * 0.5 + 0.24, yP + 1.48, kz + 0.18, 0.44, 0.04, 1.00, { rz: -0.24 });
  b.box(mTimber, kx, yP + 0.78, kz + kd * 0.5 + 0.12, 0.92, 0.045, 0.24, { r: 0.01 });
  b.box(mSteel, kx, yP + 1.48, kz + kd * 0.5 + 0.24, 1.04, 0.04, 0.44, { rx: 0.24 });
  // Chalkboard Menu Board ("MENU") & Interior Stainless-Steel Espresso Machine
  b.box(mChalkboard, kx + kw * 0.5 + 0.03, yP + 1.18, kz - 0.40, 0.03, 0.56, 0.34);
  b.box(mBrushSteel, kx + 0.15, yP + 0.94, kz - 0.15, 0.38, 0.32, 0.44);
  b.cyl(mCushion, kx + 0.32, yP + 0.88, kz + 0.22, 0.04, 0.09);
  addLight(g.localToWorld(new THREE.Vector3(kx + 0.4, yP + 1.35, kz + 0.3)), '#ffdfa0', 4.5, 2.0, 5);

  // --------------------------------------------------------------------------
  // 6. WOOD-SLAT TIMBER & CONCRETE PLANTER-BENCHES WITH UNDER-BENCH LED
  //    LIGHTING ("Detailed Close-Up View: Wood-Slat Timber & Concrete Bench")
  // --------------------------------------------------------------------------
  const addModernPlanterBench = (bx, bz, baseY, faceRy) => {
    const cos = Math.cos(faceRy), sin = Math.sin(faceRy);
    const toW = (lx, lz) => [bx + lx * cos + lz * sin, bz - lx * sin + lz * cos];
    // Monolithic concrete planter-bench base
    const [px, pz] = toW(0, -0.18);
    b.box(mConcrete, px, baseY + 0.21, pz, 1.68, 0.42, 0.52, { ry: faceRy });
    b.box(mGraniteStep, px, baseY + 0.43, pz, 1.72, 0.03, 0.56, { ry: faceRy });
    // Lush greenery inside integrated rear planter trough
    for (let k = -2; k <= 2; k++) {
      const [gx, gz] = toW(k * 0.32, -0.22);
      b.add(k % 2 === 0 ? mGreenWall : mGreenLight, crownGeo, gx, baseY + 0.52, gz, 0.22, 0.18, 0.22);
    }
    // Cantilevered Wood-Slat Timber Seat & Backrest (#B67D4A)
    const [sx, sz] = toW(-0.12, 0.18);
    b.box(mConcrete, sx, baseY + 0.14, sz, 1.24, 0.24, 0.26, { ry: faceRy });
    const [seatX, seatZ] = toW(-0.12, 0.22);
    b.box(mTimber, seatX, baseY + 0.28, seatZ, 1.34, 0.055, 0.38, { ry: faceRy, r: 0.01 });
    const [backX, backZ] = toW(-0.12, 0.04);
    b.box(mTimberDark, backX, baseY + 0.39, backZ, 1.34, 0.20, 0.05, { ry: faceRy, r: 0.01 });
    // Glowing Warm-White Under-Bench Linear LED Light Strip ("Under-Bench LED Lighting")
    const [ledX, ledZ] = toW(-0.12, 0.34);
    b.box(mLedStrip, ledX, baseY + 0.24, ledZ, 1.26, 0.024, 0.035, { ry: faceRy });
  };

  // 4 Wood-Slat Timber & Concrete Planter-Benches with Under-Bench LED Lighting
  addModernPlanterBench(-1.45, 1.35, yDeck, Math.PI);      // Under pergola facing Linear Cascading Water Wall & Pool
  addModernPlanterBench(2.45, -3.55, yP, Math.PI);         // Along right side (clear of central & front promenade paths)
  addModernPlanterBench(-3.55, -0.35, yDeck, Math.PI / 2); // Under pergola corner wing facing water wall
  addModernPlanterBench(-3.65, 8.20, yP, -Math.PI / 2);    // West sidewalk beside Store #6 Strawberry Corner

  // --------------------------------------------------------------------------
  // 7. URBAN GREENERY, VERTICAL LIVING GREEN WALL & GEOMETRIC CONCRETE
  //    PLANTERS ALONG THE ENTIRE SUPERBLOCK PERIMETER
  // --------------------------------------------------------------------------
  // Vertical Green Wall along the rear-right perimeter (lx = -4.25, lz in [-3.40, -1.45])
  b.box(mConcrete, -4.25, yP + 0.78, -2.42, 0.24, 1.56, 1.96);
  b.box(mGreenWall, -4.11, yP + 0.78, -2.42, 0.08, 1.38, 1.78);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      b.add(
        (r + c) % 2 === 0 ? mGreenLight : mGreenWall,
        crownGeo,
        -4.06,
        yP + 0.32 + r * 0.44,
        -3.08 + c * 0.44,
        0.16,
        0.22,
        0.22
      );
    }
  }

  // Airy Multi-Stem Birch/Shade Tree in Geometric Concrete Planter at the rear corner of the Pergola
  for (const [tx, tz, sc] of [
    [-4.15, 3.65, 1.02]
  ]) {
    b.box(mConcrete, tx, yP + 0.20, tz, 0.96, 0.40, 0.96);
    b.box(mGraniteStep, tx, yP + 0.41, tz, 1.02, 0.03, 1.02);
    b.cyl(mBirchBark, tx - 0.06, yP + 1.25 * sc, tz, 0.07 * sc, 1.85 * sc, { rz: 0.05 });
    b.cyl(mBirchBark, tx + 0.08, yP + 1.18 * sc, tz + 0.05, 0.055 * sc, 1.68 * sc, { rz: -0.07 });
    b.add(mGreenLight, crownGeo, tx, yP + 2.25 * sc, tz, 0.86 * sc, 0.72 * sc, 0.86 * sc);
    b.add(mGreenWall, crownGeo, tx - 0.28 * sc, yP + 2.02 * sc, tz + 0.22 * sc, 0.62 * sc, 0.54 * sc, 0.62 * sc);
    b.add(mGreenWall, crownGeo, tx + 0.30 * sc, yP + 2.05 * sc, tz - 0.20 * sc, 0.60 * sc, 0.52 * sc, 0.60 * sc);
  }

  // Helper: Low Minimalist Geometric Concrete Planter Box with Stone Coping & Lush Greenery
  const addGeometricConcretePlanter = (px, pz, pw, pd, withAccentTree = false) => {
    const ph = 0.34;
    b.box(mConcrete, px, yP + ph * 0.5, pz, pw, ph, pd);
    b.box(mGraniteStep, px, yP + ph + 0.015, pz, pw + 0.06, 0.03, pd + 0.06);
    b.box(mSoil, px, yP + ph - 0.01, pz, pw - 0.12, 0.03, pd - 0.12);
    const alongZ = pd >= pw;
    const span = (alongZ ? pd : pw) - 0.28;
    const nShrubs = Math.max(2, Math.round(span / 0.34));
    for (let k = 0; k < nShrubs; k++) {
      const u = nShrubs === 1 ? 0 : (k / (nShrubs - 1) - 0.5) * span;
      const gx = alongZ ? px + (k % 2 === 0 ? -0.04 : 0.04) : px + u;
      const gz = alongZ ? pz + u : pz + (k % 2 === 0 ? -0.04 : 0.04);
      b.add(k % 2 === 0 ? mGreenWall : mGreenLight, crownGeo, gx, yP + ph + 0.12, gz, 0.22, 0.18, 0.22);
    }
    if (withAccentTree) {
      b.cyl(mBirchBark, px, yP + ph + 0.55, pz, 0.042, 0.95, { rz: 0.04 });
      b.add(mGreenLight, crownGeo, px, yP + ph + 1.08, pz, 0.48, 0.42, 0.48);
      b.add(mGreenWall, crownGeo, px - 0.16, yP + ph + 0.95, pz + 0.12, 0.34, 0.30, 0.34);
    }
  };

  // Perimeter Geometric Concrete Planters wrapping Store #6 (Strawberry Corner) & Taman Ujung Kolam Ikan
  addGeometricConcretePlanter(3.85, 5.45, 0.72, 1.34, true);    // Strawberry Corner East-North sidewalk
  addGeometricConcretePlanter(3.85, 11.05, 0.72, 1.34, true);   // Strawberry Corner East-South sidewalk
  addGeometricConcretePlanter(-2.35, 12.18, 1.34, 0.68, false); // Strawberry Corner South-West sidewalk
  addGeometricConcretePlanter(2.35, 12.18, 1.34, 0.68, false);  // Strawberry Corner South-East sidewalk
  addGeometricConcretePlanter(-3.85, 5.55, 0.72, 1.34, false);  // Strawberry Corner West-North sidewalk
  addGeometricConcretePlanter(4.36, -5.85, 0.52, 1.24, false);  // Taman Ujung East-South sidewalk
  addGeometricConcretePlanter(4.36, -10.55, 0.52, 1.24, false); // Taman Ujung East-North sidewalk
  addGeometricConcretePlanter(-4.36, -5.85, 0.52, 1.24, false); // Taman Ujung West-South sidewalk
  addGeometricConcretePlanter(-4.36, -10.55, 0.52, 1.24, false);// Taman Ujung West-North sidewalk
  addGeometricConcretePlanter(-2.45, -12.48, 1.24, 0.52, false);// Taman Ujung North-West sidewalk
  addGeometricConcretePlanter(2.45, -12.48, 1.24, 0.52, false); // Taman Ujung North-East sidewalk

  // --------------------------------------------------------------------------
  // 8. PEDESTRIAN CORNER PLAZA (3 COLORFUL UMBRELLA BISTRO TABLES),
  //    CONSISTENT PERIMETER MODERN LED LIGHT BOLLARDS & U-BIKE RACKS
  // --------------------------------------------------------------------------
  const addBistroUmbrellaTable = (tx, tz, umbMat) => {
    // Round wooden table + central iron pedestal
    b.cyl(mSteel, tx, yP + 0.02, tz, 0.22, 0.04);
    b.cyl(mSteel, tx, yP + 0.24, tz, 0.032, 0.46);
    b.cyl(mTimber, tx, yP + 0.48, tz, 0.38, 0.035);
    // Patio umbrella pole & octagonal canopy
    b.cyl(mSteel, tx, yP + 0.96, tz, 0.022, 1.02);
    b.add(umbMat, unitCone, tx, yP + 1.46, tz, 0.78, 0.28, 0.78);
    // 3 Cafe stools/chairs around table
    for (let c = 0; c < 3; c++) {
      const a = (c / 3) * Math.PI * 2 + 0.4;
      const cx0 = tx + Math.cos(a) * 0.54;
      const cz0 = tz + Math.sin(a) * 0.54;
      b.cyl(mSteel, cx0, yP + 0.14, cz0, 0.024, 0.28);
      b.cyl(mTimber, cx0, yP + 0.29, cz0, 0.15, 0.03);
    }
  };

  // 3 Colorful Umbrella Bistro Tables neatly aligned along the outer +X edge of the plaza (lx = 3.45),
  // leaving a wide >= 2.8m straight pedestrian corridor from Strawberry Corner to the Pergola & Taman Kota!
  addBistroUmbrellaTable(3.45, 3.35, mUmbTeal);
  addBistroUmbrellaTable(3.45, 1.95, mUmbYellow);
  addBistroUmbrellaTable(3.45, 0.55, mUmbCoral);

  // Helper: Brushed-Steel Inverted-U Bicycle Racks ("Modern Bollard & Bike Rack")
  const addUBikeRackRow = (rx, rz, count, spacing, alongZ = true) => {
    const span = (count - 1) * spacing;
    // Low dark-steel base mounting rail
    if (alongZ) {
      b.box(mSteel, rx, yP + 0.012, rz, 0.34, 0.024, span + 0.24, { r: 0.005 });
    } else {
      b.box(mSteel, rx, yP + 0.012, rz, span + 0.24, 0.024, 0.34, { r: 0.005 });
    }
    for (let r = 0; r < count; r++) {
      const offset = (r - (count - 1) * 0.5) * spacing;
      const ux = alongZ ? rx : rx + offset;
      const uz = alongZ ? rz + offset : rz;
      if (alongZ) {
        b.cyl(mBrushSteel, ux, yP + 0.22, uz - 0.12, 0.018, 0.44);
        b.cyl(mBrushSteel, ux, yP + 0.22, uz + 0.12, 0.018, 0.44);
        b.box(mBrushSteel, ux, yP + 0.43, uz, 0.036, 0.036, 0.27, { r: 0.01 });
      } else {
        b.cyl(mBrushSteel, ux - 0.12, yP + 0.22, uz, 0.018, 0.44);
        b.cyl(mBrushSteel, ux + 0.12, yP + 0.22, uz, 0.018, 0.44);
        b.box(mBrushSteel, ux, yP + 0.43, uz, 0.27, 0.036, 0.036, { r: 0.01 });
      }
    }
  };

  // Strategic Brushed-Steel Inverted-U Bicycle Racks around the entire superblock perimeter
  addUBikeRackRow(3.55, -3.20, 4, 0.30, true);   // Central Pocket Park (beside Artisanal Coffee Kiosk)
  addUBikeRackRow(4.18, 4.25, 3, 0.28, true);    // Store #6 Strawberry Corner East-North sidewalk
  addUBikeRackRow(4.18, 9.65, 3, 0.28, true);    // Store #6 Strawberry Corner East-South sidewalk
  addUBikeRackRow(-0.20, 12.22, 3, 0.28, false); // Store #6 Strawberry Corner South sidewalk
  addUBikeRackRow(4.36, -7.25, 3, 0.28, true);   // Taman Ujung East Gate sidewalk
  addUBikeRackRow(-4.36, -7.25, 3, 0.28, true);  // Taman Ujung West Gate sidewalk
  addUBikeRackRow(1.28, -12.48, 3, 0.28, false); // Taman Ujung North Gate sidewalk

  b.build(g);
  g.updateMatrixWorld();

  tamanKotaInstances.push({
    g,
    fountainDrops: [],
    ducks: [],
    koiFish: [],
    pondWarmLight: null,
    windFronds: [],
    cascadeDrops,
    matchmaking: null
  });
  return g;
}

// ============================================================================
// DYNAMIC Y-ELEVATION SNAPPING & OBSTACLE EXCLUSION ZONES FOR URBAN POCKET PARK
// ============================================================================
export function getPocketParkElevationY(wx, wz) {
  const lx = wx - 2.5 * PITCH;
  const lz = wz + PITCH;
  const plazaBaseY = 0.180;
  const raisedPlatformY = 0.326; // Top of Raised Stone Terrace under L-Shaped Pergola (yDeck + 0.006)
  const timberDeckY = 0.279;     // Top of Timber Lounging Deck planks

  // 1) Raised L-Shaped Pergola Stone Terrace & 3-Step Access Stairs (Step-Down Access)
  if (lz >= 0.35 && lz <= 3.30) {
    if (lx <= -0.68 && lx >= -4.40) {
      return raisedPlatformY;
    }
    if (lx > -0.68 && lx < -0.02 && lz >= 0.55 && lz <= 2.75) {
      // Smoothly interpolate (lerp) across the 3 Stone Steps from plazaBaseY (0.180) to raisedPlatformY (0.326)
      const stepT = Math.max(0, Math.min(1, (-0.02 - lx) / (-0.02 - -0.68)));
      return plazaBaseY + (raisedPlatformY - plazaBaseY) * stepT;
    }
  }
  if (lx >= -4.40 && lx <= -2.05 && lz >= -1.55 && lz < 0.35) {
    return raisedPlatformY;
  }

  // 2) Timber Lounging Deck & Front Step (at dkX = -2.50, dkZ = -2.32, dkW = 2.10, dkD = 1.44)
  if (lx >= -3.55 && lx <= -1.45 && lz >= -3.04 && lz <= -1.60) {
    return timberDeckY;
  }
  if (lx > -1.45 && lx < -1.25 && lz >= -2.95 && lz <= -1.70) {
    const deckT = Math.max(0, Math.min(1, (-1.25 - lx) / (-1.25 - -1.45)));
    return plazaBaseY + (timberDeckY - plazaBaseY) * deckT;
  }

  // 3) Store #6 (Strawberry Corner) Sidewalk & Terrace (+Z, lz > 4.30) is 100% flush at y = 0.180!
  if (lz > 4.30) {
    return plazaBaseY;
  }

  // 4) Smooth transition onto Taman Kota Herringbone Brick Promenade (-Z, lz < -3.55)
  if (lz < -3.55) {
    const tPark = Math.max(0, Math.min(1, (-3.55 - lz) / 1.10));
    const parkTargetY = lx >= -1.55 && lx <= 1.85 ? 0.198 : plazaBaseY;
    return plazaBaseY + (parkTargetY - plazaBaseY) * tPark;
  }

  return plazaBaseY;
}

// Enforce the 4 No-Walk Exclusion Zones in the Urban Pocket Park Plaza:
// 1. Central Water Feature & Cascading Wall (NPCs never walk on water!)
// 2. Artisanal Coffee Kiosk & 3 Bistro Umbrella Tables + Stools
// 3. Geometric Concrete Planters, Slatted Benches, Bike Racks & LED Bollards
// 4. L-Shaped Pergola (reserved exclusively for the 2 Seated Matchmaking NPCs!) & Timber Lounging Deck
export function resolvePocketParkObstacleCollision(wx, wz) {
  let lx = wx - 2.5 * PITCH;
  let lz = wz + PITCH;
  if (Math.abs(lx) > 5.45 || Math.abs(lz) > 5.45) return [wx, wz];

  const pushOutAABB = (x0, x1, z0, z1) => {
    if (lx > x0 && lx < x1 && lz > z0 && lz < z1) {
      const dLeft = lx - x0;
      const dRight = x1 - lx;
      const dBack = lz - z0;
      const dFront = z1 - lz;
      const m = Math.min(dLeft, dRight, dBack, dFront);
      if (m === dRight) lx = x1 + 0.02;
      else if (m === dLeft) lx = x0 - 0.02;
      else if (m === dFront) lz = z1 + 0.02;
      else lz = z0 - 0.02;
    }
  };

  // Zone 4A: L-Shaped Pergola & Raised Terrace (reserved exclusively for the 2 Seated Matchmaking NPCs)
  pushOutAABB(-4.65, 0.05, 0.20, 3.55);
  pushOutAABB(-4.65, -1.85, -1.75, 0.35);

  // Zone 1: Central Water Feature & Cascading Water Wall + Pool
  pushOutAABB(-2.15, -0.05, -1.28, 0.14);

  // Zone 4B: Timber Lounging Deck & 2 Reclining Wooden Sun-Loungers (beside Pergola, lx <= -1.30)
  pushOutAABB(-3.65, -1.30, -3.12, -1.52);

  // Zone 3: Japanese Maple Concrete Planter (at outer rear-left corner -3.45, -3.48), Birch Tree Planter, Slatted Planter-Benches, & Bike Racks
  pushOutAABB(-3.98, -2.92, -4.02, -2.95);  // Japanese Maple Planter
  pushOutAABB(1.48, 3.42, -4.05, -2.98);   // Right Slatted Planter-Bench
  pushOutAABB(3.25, 3.92, -3.88, -2.55);   // Bicycle Racks
  pushOutAABB(-4.80, -3.45, 2.95, 4.30);   // Birch Planter #1
  pushOutAABB(-4.60, -3.82, -3.55, -1.30); // Vertical Green Wall

  // Zone 2A: Artisanal Coffee Kiosk Building & Cantilevered Counters
  pushOutAABB(1.62, 3.85, -2.62, -0.68);

  // Zone 2B: 3 Bistro Umbrella Tables & Stools along outer +X edge (Circular collision exclusion with radius 0.72)
  for (const [tx, tz, r] of [
    [3.45, 3.35, 0.72],
    [3.45, 1.95, 0.72],
    [3.45, 0.55, 0.72]
  ]) {
    const dx = lx - tx;
    const dz = lz - tz;
    const dSq = dx * dx + dz * dz;
    if (dSq < r * r && dSq > 0.00001) {
      const d = Math.sqrt(dSq);
      lx = tx + (dx / d) * (r + 0.02);
      lz = tz + (dz / d) * (r + 0.02);
    }
  }

  // Outer Bollard Rows at lx = ±4.95
  if (Math.abs(lz) < 3.45) {
    lx = Math.max(-4.62, Math.min(4.62, lx));
  }

  return [2.5 * PITCH + lx, -PITCH + lz];
}

export function getPocketParkMatchmaking() {
  for (let i = 0; i < tamanKotaInstances.length; i++) {
    if (tamanKotaInstances[i].matchmaking) {
      return tamanKotaInstances[i].matchmaking;
    }
  }
  return null;
}

export function updateTamanKota(t) {
  const nowSec = performance.now() * 0.001;
  for (let pIdx = 0; pIdx < tamanKotaInstances.length; pIdx++) {
    const inst = tamanKotaInstances[pIdx];
    // 1. Central Stone Fountain water droplets
    for (let i = 0; i < inst.fountainDrops.length; i++) {
      const dm = inst.fountainDrops[i];
      const u = (t * 0.92 + dm.userData.phase) % 1;
      const r = 0.06 + u * 0.62;
      const y = 1.08 + u * 0.38 - u * u * 0.98;
      const ang = dm.userData.angle;
      dm.position.set(Math.cos(ang) * r, y, Math.sin(ang) * r);
      dm.scale.setScalar(0.68 + Math.sin(u * Math.PI) * 0.45);
    }
    // 2. White Ducks swimming smoothly around the Duck Pond
    for (let d = 0; d < inst.ducks.length; d++) {
      const duck = inst.ducks[d];
      const ud = duck.userData;
      const ang = t * 0.42 + ud.phase * Math.PI * 2;
      const dx = Math.cos(ang) * ud.rx;
      const dz = Math.sin(ang) * ud.rz;
      const vx = -Math.sin(ang) * ud.rx;
      const vz = Math.cos(ang) * ud.rz;
      duck.position.set(ud.cx + dx, 0.172 + Math.sin(t * 3.2 + d) * 0.004, ud.cz + dz);
      duck.rotation.y = Math.atan2(vx, vz);
    }
    // 2B. Koi & Goldfish swimming in smooth circular/elliptical loops in front of the Fish Pond Bench
    if (inst.koiFish) {
      for (let k = 0; k < inst.koiFish.length; k++) {
        const koi = inst.koiFish[k];
        const ud = koi.userData;
        const ang = (t * ud.speed + ud.phase * Math.PI * 2) * ud.dir;
        const dx = Math.cos(ang) * ud.rx;
        const dz = Math.sin(ang) * ud.rz;
        const vx = -Math.sin(ang) * ud.rx * ud.dir;
        const vz = Math.cos(ang) * ud.rz * ud.dir;
        koi.position.set(ud.cx + dx, 0.174 + Math.sin(t * 4.2 + k) * 0.002, ud.cz + dz);
        koi.rotation.y = Math.atan2(vx, vz) + Math.sin(nowSec * 8.5 + k * 1.4) * 0.05;
        if (ud.tailPivot) {
          ud.tailPivot.rotation.y = Math.sin(nowSec * 10.5 + k * 1.4) * 0.36;
        }
      }
    }
    if (inst.pondWarmLight && inst.pondWarmLight.visible) {
      inst.pondWarmLight.intensity *= 0.94 + Math.sin(nowSec * 2.4) * 0.06;
    }
    // 3. Weeping Willow fronds swaying gently in the breeze
    for (let f = 0; f < inst.windFronds.length; f++) {
      const frond = inst.windFronds[f];
      const off = frond.userData.offset;
      frond.rotation.z = Math.sin(t * 1.6 + off) * 0.06;
      frond.rotation.x = Math.cos(t * 1.2 + off) * 0.04;
    }
    // 4. Contemporary Urban Pocket Park: Linear Cascading Water Wall droplets
    if (inst.cascadeDrops) {
      for (let c = 0; c < inst.cascadeDrops.length; c++) {
        const cd = inst.cascadeDrops[c];
        const ud = cd.userData;
        const u = (t * 1.45 + ud.phase) % 1;
        const x = ud.baseX + u * 0.14;
        const y = ud.baseY - u * u * 0.68;
        cd.position.set(x, y, ud.lz);
        cd.scale.setScalar(0.65 + Math.sin(u * Math.PI) * 0.45);
      }
    }
    // 5. Seated Park Matchmaking NPCs Animation (Leg Swinging, Idle Head Turns, Pop-In & Mutual Chat Look)
    if (inst.matchmaking && inst.matchmaking.active) {
      const mm = inst.matchmaking;
      const uData = mm.npcUser.userData;
      const pData = mm.npcPartner.userData;
      const isTalking = nowSec < mm.talkLookUntil;

      // Gentle alternating lower-leg swing for User NPC
      uData.leftLegPivot.rotation.x = Math.sin(nowSec * 2.1) * 0.15;
      uData.rightLegPivot.rotation.x = -Math.sin(nowSec * 2.1) * 0.15;

      if (!mm.matched) {
        // Seated Waiting State: User NPC looks gently left and right waiting for a companion
        const targetYaw = Math.sin(nowSec * 1.05) * 0.32;
        const targetPitch = Math.sin(nowSec * 1.8) * 0.05;
        uData.headPivot.rotation.y += (targetYaw - uData.headPivot.rotation.y) * 0.12;
        uData.headPivot.rotation.x += (targetPitch - uData.headPivot.rotation.x) * 0.12;
      } else {
        // Smooth elastic pop-in for Partner NPC on the right side of the bench
        mm.npcPartner.visible = true;
        if (mm.partnerPopProgress < 1) {
          mm.partnerPopProgress = Math.min(1, mm.partnerPopProgress + 0.048);
          const p = mm.partnerPopProgress;
          const backOut = 1 + 2.2 * Math.pow(p - 1, 3) + 1.2 * Math.pow(p - 1, 2);
          mm.npcPartner.scale.setScalar(Math.max(0.01, backOut));
        } else {
          mm.npcPartner.scale.setScalar(1);
        }

        // Gentle alternating lower-leg swing for Partner NPC
        pData.leftLegPivot.rotation.x = Math.cos(nowSec * 2.3 + 0.8) * 0.14;
        pData.rightLegPivot.rotation.x = -Math.cos(nowSec * 2.3 + 0.8) * 0.14;

        // When a chat message is sent or occasionally during conversation, both NPCs turn their heads toward each other!
        const periodicGlance = Math.sin(nowSec * 0.65) > 0.35;
        const lookAtEachOther = isTalking || periodicGlance;
        const userTargetYaw = lookAtEachOther
          ? 0.44 + Math.sin(nowSec * 3.4) * 0.05
          : Math.sin(nowSec * 0.9) * 0.14;
        const partnerTargetYaw = lookAtEachOther
          ? -0.44 + Math.cos(nowSec * 3.2) * 0.05
          : Math.cos(nowSec * 0.85) * 0.14;
        const nodPitch = isTalking ? Math.sin(nowSec * 5.5) * 0.065 : Math.sin(nowSec * 1.6) * 0.03;

        uData.headPivot.rotation.y += (userTargetYaw - uData.headPivot.rotation.y) * 0.14;
        uData.headPivot.rotation.x += (nodPitch - uData.headPivot.rotation.x) * 0.14;
        pData.headPivot.rotation.y += (partnerTargetYaw - pData.headPivot.rotation.y) * 0.14;
        pData.headPivot.rotation.x += (-nodPitch * 0.85 - pData.headPivot.rotation.x) * 0.14;
      }
    }
  }
}
