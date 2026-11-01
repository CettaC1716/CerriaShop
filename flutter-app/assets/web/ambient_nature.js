import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * PROCEDURAL AMBIENT NATURE & WIND ECOSYSTEM (60 FPS Zero-Lag)
 * ----------------------------------------------------------------------------
 * 1. Dynamic 3D Bird State Machine (16 Low-Poly 3D Birds across Ceria Town):
 *    - FLYING: Smooth Bezier / orbital flight paths at y = 3.5m – 9.0m with
 *      wing flapping (wing.rotation.z = Math.sin(time * 18) * 0.6).
 *    - LANDING: Smooth curved descent toward safe perches on open plazas,
 *      sidewalks, park benches, pergolas, and building rooftops.
 *    - GROUND_PECKING / HOPPING: Folded wings, playful small hops, and beak
 *      pecking on the ground/roof for 4 – 8 seconds.
 *    - TAKEOFF: Rapid wing flapping and steep ascent back to the sky after
 *      pecking finishes OR immediately if any NPC walks within < 1.8m!
 *
 * 2. Fluttering Butterflies Near Flowers & Night Fireflies (24 Instances):
 *    - 2 thin pastel wing plates (warm yellow, pink, sky blue, orange, white)
 *      fluttering at Math.sin(time * 22) along Lissajous / Perlin-like curves
 *      around flower planters, hanging baskets, pergolas, and park gardens,
 *      occasionally perching on a flower for 2 – 3 seconds.
 *    - Night Mode (19:00 – 05:00): Smoothly transforms into glowing warm-yellow
 *      fireflies (kunang-kunang) drifting over the gardens.
 *
 * 3. Soft Wind Breeze Ribbons & Drifting Petals (18 Wind Streaks + 24 Petals):
 *    - Curved translucent wind ribbons (opacity 0.18 – 0.30) + blossom petals
 *      flowing horizontally-undulating with the breeze and fading in/out.
 *
 * 4. 60 FPS Zero-Lag Optimization:
 *    - 100% Shared BufferGeometries (2–4 triangles per wing/petal), zero
 *      PointLights, and castShadow = false on all ambient nature particles.
 */
export function createAmbientNatureSystem(world, stores, tamanKotaSites) {
  const root = new THREE.Group();
  root.name = 'AmbientNatureSystem';
  world.add(root);

  // Deterministic pseudo-random helper
  let _seed = 1337;
  const rand = () => {
    _seed = (_seed * 1664525 + 1013904223) >>> 0;
    return _seed / 4294967296;
  };
  const randRange = (min, max) => min + rand() * (max - min);

  // ==========================================================================
  // SHARED LOW-POLY GEOMETRIES (Zero-Lag, 2–8 Triangles Each, No Shadows)
  // ==========================================================================
  // 1) Bird Body Geometry (compact low-poly body + head + tail + beak)
  const birdBodyGeo = (() => {
    const torso = new THREE.BoxGeometry(0.10, 0.085, 0.17).toNonIndexed();
    const head = new THREE.BoxGeometry(0.082, 0.078, 0.085).toNonIndexed();
    head.translate(0, 0.048, 0.072);
    const tail = new THREE.BoxGeometry(0.065, 0.025, 0.095).toNonIndexed();
    tail.rotateX(0.28);
    tail.translate(0, 0.015, -0.115);
    return mergeGeometries([torso, head, tail], false);
  })();

  const birdBeakGeo = (() => {
    const g = new THREE.ConeGeometry(0.022, 0.055, 4).toNonIndexed();
    g.rotateX(Math.PI / 2);
    g.translate(0, 0.045, 0.135);
    return g;
  })();

  // Left & Right Bird Wing Geometries (2 triangles per wing, pivoted at shoulder x = ±0.045)
  const birdWingLeftGeo = (() => {
    const g = new THREE.PlaneGeometry(0.16, 0.10, 1, 1);
    g.rotateX(-Math.PI / 2);
    g.translate(-0.08, 0, -0.005);
    return g;
  })();
  const birdWingRightGeo = (() => {
    const g = new THREE.PlaneGeometry(0.16, 0.10, 1, 1);
    g.rotateX(-Math.PI / 2);
    g.translate(0.08, 0, -0.005);
    return g;
  })();

  // 2) Butterfly Wing Geometries (2 triangles per wing, pivoted along center body seam)
  const butterflyWingLeftGeo = (() => {
    const g = new THREE.PlaneGeometry(0.075, 0.095, 1, 1);
    g.rotateX(-Math.PI / 2);
    g.translate(-0.038, 0, 0);
    return g;
  })();
  const butterflyWingRightGeo = (() => {
    const g = new THREE.PlaneGeometry(0.075, 0.095, 1, 1);
    g.rotateX(-Math.PI / 2);
    g.translate(0.038, 0, 0);
    return g;
  })();

  // Tiny 6-triangle Firefly Glow Orb Geometry (Night Mode 19:00 – 05:00)
  const fireflyOrbGeo = new THREE.OctahedronGeometry(0.042, 0);

  // 3) Curved Translucent Wind Breeze Ribbon Geometry (tapered sine-wave strip)
  const windRibbonGeo = (() => {
    const segs = 12;
    const len = 2.85;
    const maxHalfW = 0.032;
    const positions = [];
    const uvs = [];
    const indices = [];
    for (let i = 0; i <= segs; i++) {
      const u = i / segs;
      const x = (u - 0.5) * len;
      // Taper width to 0 at both head and tail so the wind streak has soft pointed tips
      const taper = Math.sin(u * Math.PI);
      const yCurve = Math.sin(u * Math.PI * 2.0) * 0.07;
      const zCurve = Math.cos(u * Math.PI * 1.5) * 0.05;
      const hw = maxHalfW * taper;
      positions.push(x, yCurve + hw, zCurve);
      positions.push(x, yCurve - hw, zCurve);
      uvs.push(u, 1);
      uvs.push(u, 0);
      if (i < segs) {
        const a = i * 2;
        const b = a + 1;
        const c = a + 2;
        const d = a + 3;
        indices.push(a, b, c, b, d, c);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  })();

  // 4) Drifting Blossom Petal / Leaf Geometry (2 triangles)
  const petalGeo = (() => {
    const g = new THREE.PlaneGeometry(0.11, 0.068, 1, 1);
    return g;
  })();

  // ==========================================================================
  // 1. DYNAMIC BIRD STATE MACHINE (16 Birds across Ceria Town)
  // ==========================================================================
  const birdPalettes = [
    { body: '#7C5841', wing: '#5E402D', beak: '#F2C14E' }, // Warm Brown Sparrow
    { body: '#5A9BD5', wing: '#3E78B2', beak: '#F4C44E' }, // Sky Bluebird
    { body: '#D96B4E', wing: '#A84830', beak: '#F6D052' }, // Cozy Robin
    { body: '#E5B95C', wing: '#B88C32', beak: '#E87A38' }, // Golden Finch
    { body: '#F4EFE6', wing: '#DCD4C6', beak: '#F0B848' }  // Cream Dove
  ];
  const birdMats = birdPalettes.map(p => ({
    body: new THREE.MeshLambertMaterial({ color: p.body }),
    wing: new THREE.MeshLambertMaterial({ color: p.wing, side: THREE.DoubleSide }),
    beak: new THREE.MeshLambertMaterial({ color: p.beak })
  }));

  // Collect safe world-space landing perches (Ground Plazas, Park Benches, Pergolas, Rooftops)
  const perchSpots = [];
  const addLocalPerch = (site, lx, ly, lz, isGround = true) => {
    if (!site || !site.g) return;
    site.g.updateMatrixWorld();
    const wp = site.g.localToWorld(new THREE.Vector3(lx, ly, lz));
    perchSpots.push({
      pos: wp,
      isGround,
      occupiedBy: null
    });
  };

  stores.forEach(s => {
    if (s.style === 'mayor') {
      // Pos 7 — Mayor · Balai Warga: Rooftop ridges, front porphyry plaza, trellis arch & park benches
      addLocalPerch(s, -0.84, 6.44, -0.52, false);
      addLocalPerch(s, 0.84, 6.44, -0.52, false);
      addLocalPerch(s, -1.58, 4.38, -0.55, false);
      addLocalPerch(s, 1.62, 4.38, -0.55, false);
      addLocalPerch(s, -6.35, 2.52, 0.00, false); // Top of wooden trellis archway
      addLocalPerch(s, -1.55, 0.22, 3.15, true);  // Front porphyry plaza
      addLocalPerch(s, 1.65, 0.22, 3.25, true);   // Front porphyry plaza
      addLocalPerch(s, -8.65, 0.22, 1.15, true);  // Civic Park footpath
      addLocalPerch(s, -11.20, 0.22, -1.35, true);// Civic Park near fountain
    } else if (s.style === 'strawberry') {
      // Pos 6 — Strawberry Corner: Rooftop railing, 2nd-floor balcony railing & front terrace
      addLocalPerch(s, -2.15, 7.18, 1.33, false);
      addLocalPerch(s, 0.55, 7.18, 1.33, false);
      addLocalPerch(s, 2.28, 4.14, 1.12, false);
      addLocalPerch(s, -1.65, 0.18, 3.15, true);
      addLocalPerch(s, 1.45, 0.18, 2.95, true);
    } else if (s.style === 'shop') {
      // Pos 3 — Atelier & Boutique: Wavy pebble promenade & upper cornice
      addLocalPerch(s, 0.85, 0.18, 3.15, true);
      addLocalPerch(s, -1.55, 0.18, 3.25, true);
      addLocalPerch(s, 0.00, 6.12, 1.45, false);
    } else if (s.style === 'pavilion') {
      // Pos 2 — Cozy Bites & Sips (Verdant & Bloom): Front cobblestone mosaic & roof ridge
      addLocalPerch(s, -0.65, 0.18, 3.15, true);
      addLocalPerch(s, 1.75, 0.18, 3.25, true);
      addLocalPerch(s, 0.00, 5.75, 0.20, false);
    } else if (s.style === 'gable') {
      // Pos 1 — Glow Studio: Front plaza & balcony parapet
      addLocalPerch(s, -1.25, 0.18, 3.15, true);
      addLocalPerch(s, 1.75, 0.18, 3.15, true);
      addLocalPerch(s, 0.00, 5.95, 0.50, false);
    } else if (s.style === 'studio') {
      // Pos 4 — Circuit & Byte: Front plaza
      addLocalPerch(s, 0.65, 0.18, 3.35, true);
      addLocalPerch(s, -1.85, 0.18, 3.35, true);
    } else if (s.style === 'brick') {
      // Pos 5 — Apex Sport: Front granite plaza & courtside
      addLocalPerch(s, -1.85, 0.18, 3.65, true);
      addLocalPerch(s, 1.95, 0.18, 3.65, true);
    }
  });

  tamanKotaSites.forEach(tk => {
    if (tk.style === 'urban_pocket_park') {
      addLocalPerch(tk, -2.30, 2.72, 1.85, false); // L-shaped pergola timber beam
      addLocalPerch(tk, -1.20, 2.72, 3.05, false); // L-shaped pergola front beam
      addLocalPerch(tk, 0.65, 0.18, 1.85, true);   // Open granite plaza corridor
      addLocalPerch(tk, 0.45, 0.18, -1.85, true);  // Open granite plaza near garden gate
    } else {
      addLocalPerch(tk, 0.00, 3.04, -2.68, false); // Octagonal Gazebo finial peak
      addLocalPerch(tk, 1.35, 0.20, 1.15, true);   // Herringbone brick circular plaza
      addLocalPerch(tk, -1.35, 0.20, -1.15, true); // Herringbone brick plaza near Koi Pond
    }
  });

  const BIRD_COUNT = 16;
  const birds = [];
  const _tmpV1 = new THREE.Vector3();
  const _tmpV2 = new THREE.Vector3();

  const pickFreePerch = (preferGround = false) => {
    const free = perchSpots.filter(p => !p.occupiedBy && (!preferGround || p.isGround));
    const pool = free.length > 0 ? free : perchSpots.filter(p => !p.occupiedBy);
    if (!pool.length) return perchSpots[Math.floor(rand() * perchSpots.length)];
    return pool[Math.floor(rand() * pool.length)];
  };

  for (let i = 0; i < BIRD_COUNT; i++) {
    const pal = birdMats[i % birdMats.length];
    const birdGrp = new THREE.Group();
    const rigGrp = new THREE.Group();
    birdGrp.add(rigGrp);

    const bodyMesh = new THREE.Mesh(birdBodyGeo, pal.body);
    const beakMesh = new THREE.Mesh(birdBeakGeo, pal.beak);
    bodyMesh.castShadow = bodyMesh.receiveShadow = false;
    beakMesh.castShadow = beakMesh.receiveShadow = false;
    rigGrp.add(bodyMesh, beakMesh);

    const wingL = new THREE.Mesh(birdWingLeftGeo, pal.wing);
    wingL.position.set(-0.042, 0.025, 0.01);
    wingL.castShadow = wingL.receiveShadow = false;

    const wingR = new THREE.Mesh(birdWingRightGeo, pal.wing);
    wingR.position.set(0.042, 0.025, 0.01);
    wingR.castShadow = wingR.receiveShadow = false;

    rigGrp.add(wingL, wingR);
    const sc = 0.92 + (i % 3) * 0.10;
    birdGrp.scale.setScalar(sc);
    root.add(birdGrp);

    // Assign initial state: half start in FLYING, half start in GROUND_PECKING on perches
    const startPerch = pickFreePerch(i % 2 === 0);
    const orbitCenter = startPerch
      ? startPerch.pos.clone()
      : new THREE.Vector3(16.4, 0, 16.4);
    const flyHeight = randRange(4.0, 8.4);
    const orbitRx = randRange(3.8, 8.5);
    const orbitRz = randRange(3.8, 8.5);
    const orbitSpeed = randRange(0.42, 0.68) * (i % 2 === 0 ? 1 : -1);
    const phase = randRange(0, Math.PI * 2);

    const bState = {
      group: birdGrp,
      rig: rigGrp,
      wingL,
      wingR,
      state: i < 9 ? 'FLYING' : 'GROUND_PECKING',
      stateTimer: randRange(3.0, 8.0),
      transProgress: 0,
      transDuration: 2.0,
      phase,
      orbitCenter: new THREE.Vector3(orbitCenter.x, flyHeight, orbitCenter.z),
      orbitRx,
      orbitRz,
      orbitSpeed,
      orbitAngle: phase,
      startPos: new THREE.Vector3(),
      ctrlPos: new THREE.Vector3(),
      endPos: new THREE.Vector3(),
      perch: null,
      hopOffset: new THREE.Vector3(),
      baseYaw: randRange(0, Math.PI * 2)
    };

    if (bState.state === 'GROUND_PECKING' && startPerch) {
      startPerch.occupiedBy = bState;
      bState.perch = startPerch;
      birdGrp.position.copy(startPerch.pos);
      birdGrp.rotation.set(0, bState.baseYaw, 0);
    } else {
      birdGrp.position.set(
        orbitCenter.x + Math.cos(phase) * orbitRx,
        flyHeight,
        orbitCenter.z + Math.sin(phase) * orbitRz
      );
    }

    birds.push(bState);
  }

  // Helper to trigger TAKEOFF from GROUND_PECKING
  const triggerBirdTakeoff = b => {
    if (b.perch) {
      b.perch.occupiedBy = null;
      b.perch = null;
    }
    b.state = 'TAKEOFF';
    b.transProgress = 0;
    b.transDuration = randRange(1.45, 1.95);
    b.startPos.copy(b.group.position);

    // Choose next air orbit center above a random perch across town
    const nextRef = perchSpots[Math.floor(rand() * perchSpots.length)];
    const nextY = randRange(4.2, 8.6);
    b.orbitCenter.set(
      nextRef.pos.x + randRange(-2.5, 2.5),
      nextY,
      nextRef.pos.z + randRange(-2.5, 2.5)
    );
    b.orbitRx = randRange(3.6, 7.8);
    b.orbitRz = randRange(3.6, 7.8);
    b.orbitSpeed = randRange(0.44, 0.68) * (rand() > 0.5 ? 1 : -1);
    b.orbitAngle = randRange(0, Math.PI * 2);

    b.endPos.set(
      b.orbitCenter.x + Math.cos(b.orbitAngle) * b.orbitRx,
      nextY,
      b.orbitCenter.z + Math.sin(b.orbitAngle) * b.orbitRz
    );
    b.ctrlPos.set(
      (b.startPos.x + b.endPos.x) * 0.5,
      Math.max(b.startPos.y + 2.8, nextY + 0.8),
      (b.startPos.z + b.endPos.z) * 0.5
    );
  };

  // ==========================================================================
  // 2. FLUTTERING BUTTERFLIES NEAR FLOWERS & NIGHT FIREFLIES (24 Instances)
  // ==========================================================================
  const butterflyColors = [
    '#FFE066', // Warm Buttercup Yellow
    '#FF9EBB', // Pastel Blossom Pink
    '#8CE0FF', // Sky Blue
    '#FFB067', // Soft Apricot Orange
    '#FFFDF2'  // Daisy Cream White
  ];
  const butterflyWingMats = butterflyColors.map(
    hex =>
      new THREE.MeshBasicMaterial({
        color: hex,
        side: THREE.DoubleSide
      })
  );
  const fireflyMat = new THREE.MeshBasicMaterial({
    color: '#FFE866',
    transparent: true,
    opacity: 0.92,
    depthWrite: false
  });

  // Curated floral spawn anchors across Mayor's Office, Strawberry Corner, Pocket Park, Taman Kota, Atelier, Cozy Bites & Glow Studio
  const flowerAnchors = [];
  const addFlowerAnchor = (site, lx, ly, lz, radius = 0.85) => {
    if (!site || !site.g) return;
    site.g.updateMatrixWorld();
    const wp = site.g.localToWorld(new THREE.Vector3(lx, ly, lz));
    flowerAnchors.push({ pos: wp, radius });
  };

  stores.forEach(s => {
    if (s.style === 'mayor') {
      // Mayor · Balai Warga: Front Curved Stone Balustrade Hydrangea/Lavender Planters, Wooden Trellis Archway & Park Flower Beds
      addFlowerAnchor(s, -2.25, 0.78, 1.35, 0.95);
      addFlowerAnchor(s, 2.25, 0.78, 1.35, 0.95);
      addFlowerAnchor(s, -6.35, 1.35, 0.00, 0.90);
      addFlowerAnchor(s, -9.80, 0.68, 2.15, 1.05);
      addFlowerAnchor(s, -9.80, 0.68, -2.15, 1.05);
      addFlowerAnchor(s, -13.50, 0.68, 2.10, 1.05);
    } else if (s.style === 'strawberry') {
      // Strawberry Corner: Front Arched Window Flower Box, Side Entrance Pots & Rooftop Strawberry Garden
      addFlowerAnchor(s, -0.62, 4.15, 1.68, 0.75);
      addFlowerAnchor(s, -2.86, 0.72, 0.55, 0.75);
      addFlowerAnchor(s, -0.85, 7.25, -0.35, 0.95);
    } else if (s.style === 'shop') {
      // Atelier & Boutique: Right Ornamental Pink Blossom Tree & Left Lavender Planters
      addFlowerAnchor(s, 2.95, 1.05, 1.38, 0.85);
      addFlowerAnchor(s, -4.15, 0.82, 2.85, 0.80);
    } else if (s.style === 'pavilion') {
      // Cozy Bites & Sips (Verdant & Bloom): Hanging Wicker Flower Baskets & Window Planters
      addFlowerAnchor(s, -1.25, 0.78, 1.65, 0.85);
      addFlowerAnchor(s, 1.65, 0.78, 1.65, 0.85);
    } else if (s.style === 'gable') {
      // Glow Studio: Front Floral Planter & Arched Balcony Greenery
      addFlowerAnchor(s, -2.12, 0.75, 1.69, 0.80);
    }
  });

  tamanKotaSites.forEach(tk => {
    if (tk.style === 'urban_pocket_park') {
      // Urban Pocket Park: Pergola Planters, Vertical Living Green Wall & Japanese Maple
      addFlowerAnchor(tk, -1.45, 0.88, 1.25, 0.95);
      addFlowerAnchor(tk, -3.95, 1.05, -2.40, 0.90);
      addFlowerAnchor(tk, -3.45, 1.15, -3.48, 0.85);
    } else {
      // Taman Kota: Blue/Purple/Pink Hydrangea Borders, Vintage Bench Planter Boxes & Rose-Vine Gazebo
      addFlowerAnchor(tk, -3.52, 0.65, 3.05, 0.95);
      addFlowerAnchor(tk, -1.32, 0.65, 3.05, 0.95);
      addFlowerAnchor(tk, 1.95, 0.65, 1.85, 0.95);
      addFlowerAnchor(tk, -1.95, 0.65, -1.95, 0.95);
      addFlowerAnchor(tk, 1.95, 0.65, -1.95, 0.95);
      addFlowerAnchor(tk, 0.00, 1.45, -2.68, 1.10);
    }
  });

  const BUTTERFLY_COUNT = 24;
  const butterflies = [];
  for (let i = 0; i < BUTTERFLY_COUNT; i++) {
    const anchor = flowerAnchors[i % Math.max(1, flowerAnchors.length)] || {
      pos: new THREE.Vector3(16.4, 0.8, 16.4),
      radius: 0.9
    };
    const bGrp = new THREE.Group();
    const wingsGrp = new THREE.Group();
    const wMat = butterflyWingMats[i % butterflyWingMats.length];

    const wL = new THREE.Mesh(butterflyWingLeftGeo, wMat);
    const wR = new THREE.Mesh(butterflyWingRightGeo, wMat);
    wL.castShadow = wL.receiveShadow = false;
    wR.castShadow = wR.receiveShadow = false;
    wingsGrp.add(wL, wR);

    const fireflyMesh = new THREE.Mesh(fireflyOrbGeo, fireflyMat);
    fireflyMesh.castShadow = fireflyMesh.receiveShadow = false;
    fireflyMesh.visible = false;

    bGrp.add(wingsGrp, fireflyMesh);
    bGrp.position.copy(anchor.pos);
    root.add(bGrp);

    butterflies.push({
      group: bGrp,
      wingsGrp,
      wingL: wL,
      wingR: wR,
      fireflyMesh,
      homePos: anchor.pos.clone(),
      radius: anchor.radius,
      phase: randRange(0, Math.PI * 2),
      freqX: randRange(1.15, 1.85),
      freqZ: randRange(1.05, 1.75),
      freqY: randRange(2.10, 3.20),
      state: i % 4 === 0 ? 'PERCHED' : 'FLUTTERING',
      stateTimer: randRange(2.5, 7.5),
      perchOffset: new THREE.Vector3(
        randRange(-0.35, 0.35),
        randRange(-0.18, 0.05),
        randRange(-0.35, 0.35)
      ),
      prevX: anchor.pos.x,
      prevZ: anchor.pos.z
    });
  }

  // ==========================================================================
  // 3. SOFT WIND BREEZE RIBBONS & DRIFTING PETALS (18 Ribbons + 24 Petals)
  // ==========================================================================
  const WIND_RIBBON_COUNT = 18;
  const windRibbons = [];
  const ribbonColors = ['#FFFFFF', '#FFF8EC', '#EBF7FF'];

  for (let i = 0; i < WIND_RIBBON_COUNT; i++) {
    const rMat = new THREE.MeshBasicMaterial({
      color: ribbonColors[i % ribbonColors.length],
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const rMesh = new THREE.Mesh(windRibbonGeo, rMat);
    rMesh.castShadow = rMesh.receiveShadow = false;
    root.add(rMesh);

    windRibbons.push({
      mesh: rMesh,
      mat: rMat,
      age: randRange(0, 4.5),
      life: randRange(3.6, 5.4),
      maxOpacity: randRange(0.18, 0.28),
      speed: randRange(2.4, 3.8),
      baseY: randRange(1.1, 4.8),
      offsetX: randRange(-14, 14),
      offsetZ: randRange(-14, 14),
      phase: randRange(0, Math.PI * 2),
      scaleLen: randRange(0.75, 1.25)
    });
  }

  const PETAL_COUNT = 24;
  const petals = [];
  const petalPalette = ['#FFB7C5', '#FFD6E0', '#96C27E', '#F8E394'].map(
    hex =>
      new THREE.MeshBasicMaterial({
        color: hex,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        side: THREE.DoubleSide
      })
  );

  for (let i = 0; i < PETAL_COUNT; i++) {
    const pMesh = new THREE.Mesh(petalGeo, petalPalette[i % petalPalette.length]);
    pMesh.castShadow = pMesh.receiveShadow = false;
    root.add(pMesh);
    petals.push({
      mesh: pMesh,
      relX: randRange(-13, 13),
      relY: randRange(0.6, 5.5),
      relZ: randRange(-13, 13),
      speedX: randRange(0.85, 1.45),
      speedY: randRange(0.22, 0.42),
      phase: randRange(0, Math.PI * 2),
      rotSpdX: randRange(1.2, 2.6),
      rotSpdY: randRange(1.4, 2.8)
    });
  }

  // ==========================================================================
  // MAIN FRAME UPDATE (Called every frame in animate())
  // ==========================================================================
  function update(time, dt, daytime, cameraTarget, npcWorldPos, npcAgents, isVisible = true, windStrength = 0) {
    root.visible = isVisible;
    if (!isVisible) return;

    const safeDt = Math.min(0.05, Math.max(0.001, dt));
    const isNightButterfly = daytime >= 19.0 || daytime < 5.0;
    const effWind = Math.max(0, Math.min(1.5, windStrength));

    // ------------------------------------------------------------------------
    // A. UPDATE 16 DYNAMIC BIRDS (FLYING -> LANDING -> GROUND_PECKING -> TAKEOFF)
    // ------------------------------------------------------------------------
    for (let i = 0; i < birds.length; i++) {
      const b = birds[i];

      if (b.state === 'FLYING') {
        b.stateTimer -= safeDt;
        b.orbitAngle += b.orbitSpeed * safeDt;

        // Smooth figure-8 / orbital flight path at y = 3.5m – 9.0m
        const targetX =
          b.orbitCenter.x +
          Math.cos(b.orbitAngle) * b.orbitRx +
          Math.sin(b.orbitAngle * 2.0 + b.phase) * 0.85;
        const targetZ =
          b.orbitCenter.z +
          Math.sin(b.orbitAngle) * b.orbitRz +
          Math.cos(b.orbitAngle * 2.0 + b.phase) * 0.85;
        const targetY =
          b.orbitCenter.y + Math.sin(time * 1.8 + b.phase) * 0.42;

        const vx = targetX - b.group.position.x;
        const vy = targetY - b.group.position.y;
        const vz = targetZ - b.group.position.z;
        b.group.position.set(targetX, targetY, targetZ);

        if (vx * vx + vz * vz > 0.00001) {
          b.group.rotation.y = Math.atan2(vx, vz);
        }
        // Subtle pitch & banking into turns
        b.rig.rotation.x = Math.max(-0.35, Math.min(0.35, -vy * 2.5));
        b.rig.rotation.z = -b.orbitSpeed * 0.28;

        // Active wing flapping: wing.rotation.z = Math.sin(time * 18) * 0.6
        b.wingL.scale.x = b.wingR.scale.x = 1.0;
        const flap = Math.sin(time * 18.0 + b.phase) * 0.6;
        b.wingL.rotation.z = flap;
        b.wingR.rotation.z = -flap;

        // Periodically transition to LANDING toward a safe perch
        if (b.stateTimer <= 0) {
          const targetPerch = pickFreePerch(rand() < 0.62);
          if (targetPerch) {
            targetPerch.occupiedBy = b;
            b.perch = targetPerch;
            b.state = 'LANDING';
            b.transProgress = 0;
            b.transDuration = randRange(1.85, 2.55);
            b.startPos.copy(b.group.position);
            b.endPos.copy(targetPerch.pos);
            b.ctrlPos.set(
              (b.startPos.x + b.endPos.x) * 0.5,
              Math.max(b.startPos.y, b.endPos.y + 2.2),
              (b.startPos.z + b.endPos.z) * 0.5
            );
          } else {
            b.stateTimer = randRange(4.0, 7.0);
          }
        }
      } else if (b.state === 'LANDING') {
        b.transProgress = Math.min(1.0, b.transProgress + safeDt / b.transDuration);
        const u = b.transProgress;
        // Smooth ease-out quadratic Bezier descent
        const t = 1 - Math.pow(1 - u, 1.65);
        const omt = 1 - t;

        _tmpV1.copy(b.group.position);
        const nx = omt * omt * b.startPos.x + 2 * omt * t * b.ctrlPos.x + t * t * b.endPos.x;
        const ny = omt * omt * b.startPos.y + 2 * omt * t * b.ctrlPos.y + t * t * b.endPos.y;
        const nz = omt * omt * b.startPos.z + 2 * omt * t * b.ctrlPos.z + t * t * b.endPos.z;
        b.group.position.set(nx, ny, nz);

        const dx = nx - _tmpV1.x;
        const dz = nz - _tmpV1.z;
        if (dx * dx + dz * dz > 0.000004) {
          b.baseYaw = Math.atan2(dx, dz);
          b.group.rotation.y = b.baseYaw;
        }
        b.rig.rotation.x = (1 - u) * 0.25;
        b.rig.rotation.z = 0;

        // Flutter wings as it swoops down and flare before touchdown
        const flap = Math.sin(time * 20.0 + b.phase) * 0.65 * (1 - u * 0.35);
        b.wingL.scale.x = b.wingR.scale.x = 1.0;
        b.wingL.rotation.z = flap;
        b.wingR.rotation.z = -flap;

        if (b.transProgress >= 1.0) {
          b.state = 'GROUND_PECKING';
          b.stateTimer = randRange(4.0, 8.0); // 4 – 8 seconds pecking & hopping
          b.hopOffset.set(0, 0, 0);
        }
      } else if (b.state === 'GROUND_PECKING') {
        b.stateTimer -= safeDt;

        // Fold wings neatly against sides while on the ground/roof
        b.wingL.scale.x = b.wingR.scale.x = 0.42;
        b.wingL.rotation.z = -0.22;
        b.wingR.rotation.z = 0.22;
        b.rig.rotation.z = 0;

        // Alternate between playful hopping and ground pecking
        const cycle = (time * 1.35 + b.phase) % 3.2;
        let hopY = 0;
        let peckPitch = 0;
        if (cycle < 1.1) {
          // Small playful hops
          const hopWave = Math.sin(time * 10.5 + b.phase);
          hopY = Math.max(0, hopWave) * 0.065;
          if (b.perch && b.perch.isGround && hopWave > 0.7) {
            b.hopOffset.x = Math.sin(time * 0.9 + b.phase) * 0.14;
            b.hopOffset.z = Math.cos(time * 0.9 + b.phase) * 0.14;
          }
        } else if (cycle < 2.35) {
          // Ground pecking (head/body pitches down & up rapidly)
          peckPitch = Math.max(0, Math.sin(time * 15.0 + b.phase)) * 0.56;
        }

        const basePos = b.perch ? b.perch.pos : b.group.position;
        b.group.position.set(
          basePos.x + b.hopOffset.x,
          basePos.y + hopY,
          basePos.z + b.hopOffset.z
        );
        b.rig.rotation.x = peckPitch;
        b.group.rotation.y = b.baseYaw + Math.sin(time * 1.7 + b.phase) * 0.38;

        // Check if any walking NPC approaches within < 1.8m!
        let startledByNpc = false;
        if (b.perch && b.perch.isGround && npcWorldPos && npcAgents) {
          const bx = b.group.position.x;
          const bz = b.group.position.z;
          for (let n = 0; n < npcAgents.length; n++) {
            const ag = npcAgents[n];
            if (!ag || ag.visible === false || ag.fsmState === 'INSIDE_STORE') continue;
            const np = npcWorldPos[n];
            if (!np) continue;
            const dx = np.x - bx;
            const dz = np.z - bz;
            if (dx * dx + dz * dz < 1.8 * 1.8) {
              startledByNpc = true;
              break;
            }
          }
        }

        if (startledByNpc || b.stateTimer <= 0) {
          triggerBirdTakeoff(b);
        }
      } else if (b.state === 'TAKEOFF') {
        b.transProgress = Math.min(1.0, b.transProgress + safeDt / b.transDuration);
        const u = b.transProgress;
        const t = Math.pow(u, 0.85);
        const omt = 1 - t;

        _tmpV2.copy(b.group.position);
        const nx = omt * omt * b.startPos.x + 2 * omt * t * b.ctrlPos.x + t * t * b.endPos.x;
        const ny = omt * omt * b.startPos.y + 2 * omt * t * b.ctrlPos.y + t * t * b.endPos.y;
        const nz = omt * omt * b.startPos.z + 2 * omt * t * b.ctrlPos.z + t * t * b.endPos.z;
        b.group.position.set(nx, ny, nz);

        const dx = nx - _tmpV2.x;
        const dz = nz - _tmpV2.z;
        if (dx * dx + dz * dz > 0.000004) {
          b.group.rotation.y = Math.atan2(dx, dz);
        }
        b.rig.rotation.x = -0.28 * (1 - u);
        b.rig.rotation.z = 0;

        // Rapid energetic wing flapping during takeoff
        b.wingL.scale.x = b.wingR.scale.x = 1.0;
        const flap = Math.sin(time * 24.0 + b.phase) * 0.72;
        b.wingL.rotation.z = flap;
        b.wingR.rotation.z = -flap;

        if (b.transProgress >= 1.0) {
          b.state = 'FLYING';
          b.stateTimer = randRange(5.5, 11.0);
        }
      }
    }

    // ------------------------------------------------------------------------
    // B. UPDATE 24 BUTTERFLIES NEAR FLOWERS (or NIGHT FIREFLIES 19:00–05:00)
    // ------------------------------------------------------------------------
    for (let i = 0; i < butterflies.length; i++) {
      const bf = butterflies[i];
      bf.wingsGrp.visible = !isNightButterfly;
      bf.fireflyMesh.visible = isNightButterfly;

      if (isNightButterfly) {
        // Night Mode (19:00 – 05:00): Glowing Warm Firefly drifting gently around garden beds
        const tSlow = time * 0.55 + bf.phase;
        const r = bf.radius * 1.15;
        const nx = bf.homePos.x + Math.sin(tSlow * bf.freqX) * r;
        const nz = bf.homePos.z + Math.cos(tSlow * bf.freqZ) * r;
        const ny = bf.homePos.y + 0.25 + Math.sin(time * 1.6 + bf.phase) * 0.24;
        bf.group.position.set(nx, ny, nz);
        const pulse = 0.55 + 0.55 * Math.sin(time * 3.4 + bf.phase * 2.0);
        bf.fireflyMesh.scale.setScalar(0.65 + pulse * 0.55);
        continue;
      }

      // Daytime Butterfly State Machine: FLUTTERING <-> PERCHED on flower
      bf.stateTimer -= safeDt;
      if (bf.state === 'FLUTTERING') {
        const tFlut = time * 0.95 + bf.phase;
        const r = bf.radius;
        // Lissajous + harmonic wave around the floral anchor
        const dx =
          Math.sin(tFlut * bf.freqX) * r * 0.75 +
          Math.cos(tFlut * bf.freqZ * 1.6) * r * 0.30;
        const dz =
          Math.cos(tFlut * bf.freqZ) * r * 0.75 +
          Math.sin(tFlut * bf.freqX * 1.4) * r * 0.30;
        const dy =
          0.18 +
          Math.sin(time * bf.freqY + bf.phase) * 0.16 +
          Math.abs(Math.cos(time * 4.5 + bf.phase)) * 0.06;

        const nx = bf.homePos.x + dx;
        const ny = bf.homePos.y + dy;
        const nz = bf.homePos.z + dz;

        const vx = nx - bf.prevX;
        const vz = nz - bf.prevZ;
        if (vx * vx + vz * vz > 0.000001) {
          bf.group.rotation.y = Math.atan2(vx, vz);
        }
        bf.prevX = nx;
        bf.prevZ = nz;
        bf.group.position.set(nx, ny, nz);

        // Rapid butterfly wing flutter: Math.sin(time * 22)
        const flap = Math.sin(time * 22.0 + bf.phase) * 0.85;
        bf.wingL.rotation.z = flap;
        bf.wingR.rotation.z = -flap;

        if (bf.stateTimer <= 0) {
          bf.state = 'PERCHED';
          bf.stateTimer = randRange(2.0, 3.2); // Rest on flower for 2–3 seconds
          const ang = randRange(0, Math.PI * 2);
          const dist = randRange(0.08, bf.radius * 0.55);
          bf.perchOffset.set(
            Math.cos(ang) * dist,
            randRange(-0.10, 0.06),
            Math.sin(ang) * dist
          );
        }
      } else {
        // PERCHED quietly on a flower blossom with slow gentle wing breathing
        const targetX = bf.homePos.x + bf.perchOffset.x;
        const targetY = bf.homePos.y + bf.perchOffset.y;
        const targetZ = bf.homePos.z + bf.perchOffset.z;
        bf.group.position.lerp(_tmpV1.set(targetX, targetY, targetZ), Math.min(1, safeDt * 6.0));
        const breathe = 0.52 + Math.sin(time * 3.0 + bf.phase) * 0.22;
        bf.wingL.rotation.z = breathe;
        bf.wingR.rotation.z = -breathe;

        if (bf.stateTimer <= 0) {
          bf.state = 'FLUTTERING';
          bf.stateTimer = randRange(4.8, 8.8);
        }
      }
    }

    // ------------------------------------------------------------------------
    // C. UPDATE 18 SOFT WIND BREEZE RIBBONS & 24 DRIFTING PETALS
    //    Dynamic wind gusts: completely off during Sunny (Cerah) or calm lulls,
    //    and flows in natural intermittent gusts during Breezy / Cloudy / Overcast.
    // ------------------------------------------------------------------------
    const cx = cameraTarget ? cameraTarget.fx : 16.4;
    const cz = cameraTarget ? cameraTarget.fz : 16.4;
    const windAngle = 0.38 + Math.sin(time * 0.12) * 0.18;
    const windCos = Math.cos(windAngle);
    const windSin = Math.sin(windAngle);
    const showWindStreaks = effWind > 0.04;

    for (let i = 0; i < windRibbons.length; i++) {
      const r = windRibbons[i];
      if (!showWindStreaks) {
        r.mesh.visible = false;
        r.mat.opacity = 0;
        continue;
      }
      r.mesh.visible = true;
      r.age += safeDt * (0.65 + 0.65 * effWind);
      if (r.age >= r.life) {
        r.age = 0;
        r.life = randRange(3.6, 5.4);
        r.offsetX = randRange(-13.5, 13.5);
        r.offsetZ = randRange(-13.5, 13.5);
        r.baseY = randRange(1.0, 4.6);
      }

      const u = r.age / r.life; // 0..1 lifecycle
      // Smooth fade-in (0..0.25) and fade-out (0.70..1.0), scaled by dynamic windStrength
      const fade =
        u < 0.25
          ? u / 0.25
          : u > 0.70
            ? Math.max(0, (1.0 - u) / 0.30)
            : 1.0;
      r.mat.opacity = r.maxOpacity * fade * Math.min(1.0, effWind);

      const travel = (u - 0.5) * r.speed * (0.6 + 0.5 * effWind) * r.life;
      const wx = cx + r.offsetX + windCos * travel;
      const wz = cz + r.offsetZ + windSin * travel;
      const wy = r.baseY + Math.sin(time * 2.4 + r.phase + u * 4.0) * 0.22;

      r.mesh.position.set(wx, wy, wz);
      r.mesh.rotation.y = -windAngle + Math.sin(time * 2.0 + r.phase) * 0.12;
      r.mesh.rotation.z = Math.cos(time * 2.6 + r.phase) * 0.08;
      r.mesh.scale.set(r.scaleLen * (0.7 + 0.3 * fade), 1, 1);
    }

    for (let i = 0; i < petals.length; i++) {
      const p = petals[i];
      if (!showWindStreaks) {
        p.mesh.visible = false;
        continue;
      }
      p.mesh.visible = true;
      p.mesh.material.opacity = 0.85 * Math.min(1.0, effWind);
      const driftSpd = p.speedX * (0.45 + 0.75 * effWind);
      p.relX += windCos * driftSpd * safeDt;
      p.relZ += windSin * driftSpd * safeDt + Math.sin(time * 1.8 + p.phase) * 0.25 * safeDt;
      p.relY -= p.speedY * safeDt;

      if (p.relY < 0.22 || p.relX > 14.5 || p.relZ > 14.5) {
        p.relX = randRange(-13.5, -4.0);
        p.relZ = randRange(-12.5, 12.5);
        p.relY = randRange(3.6, 6.2);
      }

      p.mesh.position.set(cx + p.relX, p.relY, cz + p.relZ);
      p.mesh.rotation.x = time * p.rotSpdX + p.phase;
      p.mesh.rotation.y = time * p.rotSpdY + p.phase;
      p.mesh.rotation.z = Math.sin(time * 2.2 + p.phase) * 0.65;
    }
  }

  return {
    group: root,
    birds,
    butterflies,
    windRibbons,
    update
  };
}
