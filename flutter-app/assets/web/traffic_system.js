import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ============================================================================
// CERIA TOWN LIVING ROAD, TRAFFIC SIGNAL, VEHICLE & PEDESTRIAN SYSTEM
// Strict Y-Layering Hierarchy (Zero Z-Fighting & Zero Shadow Acne):
//   - y = 0.000 : Tanah dasar (Base ground)
//   - y = 0.030 : Permukaan aspal jalan (Road surface)
//   - y = 0.055 : Jalur sepeda hijau & marka jalan (Bike lanes, crosswalks, stop lines, arrows)
//   - y = 0.080 : Pendaran lampu mobil/jalan di aspal (Ground glow planes)
//   - y = 0.150 : Trotoar (Sidewalk surface)
//   - y = 0.175 : Tactile paving kuning di sudut trotoar
// ============================================================================

export function createTrafficSystem({
  world,
  roadsGroup = world,
  decorGroup = world,
  vehiclesGroup = world,
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
}) {
  const ROAD_W = PITCH - 11.0; // 5.40u exact width between raised lot curbs (1.421x wider than 3.80u!)
  const BOX_HALF = ROAD_W * 0.5; // 2.70u clean inner junction box [-2.70, +2.70]
  const INTER_HALF = BOX_HALF + 1.10; // 3.80u intersection + crosswalk zone [-3.80, +3.80]
  const CROSSWALK_DIST = BOX_HALF + 0.55; // 3.25u center of zebra crossing from intersection center (d=2.70 to d+1.10=3.80)
  const BIKE_STOP_DIST = 4.28; // Cyclist stop position right behind the Stop Line (clear of zebra cross)
  const CAR_STOP_DIST = 4.48; // Motor vehicle stop position right behind the Stop Line (clear of zebra cross)

  // Exact Y-Layering Constants (Bike lane at y = 0.015, concrete curb top at y = 0.190, yellow tactile paving at y = 0.195)
  const Y_ROAD = 0.008;
  const Y_MARKINGS = 0.015;
  const Y_GLOW = 0.032;
  const Y_SIDEWALK = 0.180;

  // --------------------------------------------------------------------------
  // 1. PROCEDURAL TEXTURES: ASPHALT BASE (y = 0.03) & MARKINGS LAYER (y = 0.055)
  // --------------------------------------------------------------------------
  const asphaltTex = (() => {
    const S = 512;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const ctx = c.getContext('2d');

    ctx.fillStyle = '#343a44';
    ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 2400; i++) {
      const v = 46 + Math.floor(random() * 20);
      ctx.fillStyle = `rgba(${v},${v + 4},${v + 9},0.28)`;
      ctx.fillRect(random() * S, random() * S, 2, 2);
    }

    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
    return t;
  })();

  // Transparent-background Markings Texture for Road Segments at y = 0.055:
  // Intersection-Relative Layout along segLen = 8.80 units (W = 512 across 5.40u road, H = 1024 along 8.80u):
  //   - Left half (x < W/2): dir = +1 lane approaching the y = H intersection end (flows DOWN +y, flipY = true)
  //   - Right half (x > W/2): dir = -1 lane approaching the y = 0 intersection end (flows UP -y, flipY = false)
  //   - Motor lane width = 1.52u (~1.60x car width 0.95u, centered at latOffset = 0.90)
  //   - Green Bike Lane width = 0.82u (centered at latOffset = 2.12, giving cyclists 0.38u generous room)
  function makeRoadMarkingsTex(stopY0 = true, stopYH = true, drawArrows = true) {
    const W = 512, H = 1024;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d');

    ctx.clearRect(0, 0, W, H);

    // Stop Line offset from each end of the road segment (before the zebra cross)
    const stopClipY = 48;
    const y0 = stopY0 ? stopClipY : 0;
    const y1 = stopYH ? H - stopClipY : H;
    const spanH = y1 - y0;

    // 1) Green Bike Lanes (#2E9B4F) trimmed strictly inside the outer concrete curb face (never extending under curb or yellow tactile tiles!)
    const bikeOuterPad = 14;
    const bikeW = 78;
    ctx.fillStyle = '#2E9B4F';
    ctx.fillRect(bikeOuterPad, y0, bikeW, spanH);
    ctx.fillRect(W - bikeOuterPad - bikeW, y0, bikeW, spanH);

    // Crisp white inner buffer lines separating the Green Bike Lane from the Motor Lane
    ctx.fillStyle = '#e8eef7';
    ctx.fillRect(bikeOuterPad + bikeW, y0, 5, spanH);
    ctx.fillRect(W - bikeOuterPad - bikeW - 5, y0, 5, spanH);

    // 2) Double Yellow Center Line (Garis Kuning Ganda)
    ctx.fillStyle = '#f2ba36';
    ctx.fillRect(W * 0.5 - 10, y0, 5, spanH);
    ctx.fillRect(W * 0.5 + 5, y0, 5, spanH);

    // 3) Thick White Stop Lines (Garis Henti) spanning the full widened incoming lane
    ctx.fillStyle = '#f5f8fc';
    if (stopY0) {
      ctx.fillRect(W * 0.5 + 11, stopClipY - 20, W * 0.5 - 13, 20);
    }
    if (stopYH) {
      ctx.fillRect(bikeOuterPad, H - stopClipY, W * 0.5 - 13, 20);
    }

    // 4) White Bicycle Icon + Forward Arrow centered in the widened Green Bike Lane
    const drawBikeMark = (cx, cy, flipY) => {
      ctx.save();
      ctx.translate(cx, cy);
      if (flipY) ctx.rotate(Math.PI);

      ctx.fillStyle = 'rgba(246, 252, 249, 0.96)';
      ctx.strokeStyle = 'rgba(246, 252, 249, 0.96)';
      ctx.lineWidth = 3.6;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.fillRect(-3, -38, 6, 16);
      ctx.beginPath();
      ctx.moveTo(0, -52);
      ctx.lineTo(-12, -36);
      ctx.lineTo(12, -36);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.arc(0, -9, 7.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 18, 7.5, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(0, 18);
      ctx.moveTo(-9, -6);
      ctx.lineTo(9, -6);
      ctx.moveTo(-5, 10);
      ctx.lineTo(5, 10);
      ctx.stroke();

      ctx.restore();
    };

    // 5) Single Straight + 90-Degree Turn Lane Arrow centered in the widened Motor Lane
    const drawLaneArrow = (cx, cy, flipY) => {
      ctx.save();
      ctx.translate(cx, cy);
      if (flipY) ctx.rotate(Math.PI);
      ctx.fillStyle = 'rgba(242, 246, 252, 0.94)';

      ctx.fillRect(-6, -22, 12, 64);
      ctx.beginPath();
      ctx.moveTo(0, -58);
      ctx.lineTo(-20, -20);
      ctx.lineTo(20, -20);
      ctx.closePath();
      ctx.fill();

      ctx.fillRect(6, -2, 22, 11);
      ctx.beginPath();
      ctx.moveTo(48, 3.5);
      ctx.lineTo(25, -13);
      ctx.lineTo(25, 20);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    };

    if (drawArrows) {
      const leftBikeCx = bikeOuterPad + bikeW * 0.5;
      const rightBikeCx = W - bikeOuterPad - bikeW * 0.5;
      const motorInnerEdge = bikeOuterPad + bikeW + 5;
      const leftMotorCx = motorInnerEdge + (W * 0.5 - 10 - motorInnerEdge) * 0.5;
      const rightMotorCx = W * 0.5 + 10 + (W * 0.5 - 10 - motorInnerEdge) * 0.5;
      const arrowOffsetPx = stopClipY + 290;
      if (stopY0) {
        drawLaneArrow(rightMotorCx, arrowOffsetPx, false);
        drawBikeMark(rightBikeCx, arrowOffsetPx, false);
      }
      if (stopYH) {
        drawLaneArrow(leftMotorCx, H - arrowOffsetPx, true);
        drawBikeMark(leftBikeCx, H - arrowOffsetPx, true);
      }
    }

    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
    return t;
  }

  const roadMarkingsTex = makeRoadMarkingsTex(true, true, true);
  const roadMarkingsNoY0Tex = makeRoadMarkingsTex(false, true, true);
  const roadMarkingsNoYHTex = makeRoadMarkingsTex(true, false, true);
  const roadMarkingsContinuousTex = makeRoadMarkingsTex(false, false, false);

  // Transparent-background Zebra Crosswalk Strip Texture at y = 0.055
  // Placed immediately outside the clean intersection box (d = 2.70 to d + 1.10 = 3.80 across full 5.40u road width)
  const crosswalkMarkingsTex = (() => {
    const W = 512, H = 128;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d');

    ctx.clearRect(0, 0, W, H);

    // Parallel white crosswalk boundary lines framing the zebra bars
    ctx.fillStyle = 'rgba(243, 246, 251, 0.88)';
    ctx.fillRect(14, 6, W - 28, 5);
    ctx.fillRect(14, H - 11, W - 28, 5);

    // White continental zebra crossing bars perpendicular to the crosswalk (connecting left & right sidewalks across 5.40u)
    ctx.fillStyle = '#f5f8fc';
    const numBars = 12;
    const spanW = W - 40;
    const pitch = spanW / numBars;
    for (let i = 0; i < numBars; i++) {
      const bx = 20 + i * pitch + pitch * 0.16;
      ctx.fillRect(bx, 16, pitch * 0.68, H - 32);
    }

    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
    return t;
  })();

  // Transparent-background Clean Intersection Box Texture at y = 0.055 (|dx| < 2.70, |dz| < 2.70):
  // ALL yellow lines, white lane lines, and green bike lanes STOP outside this box;
  // ONLY dashed curved turning guide lines (turning guide curves) appear on the clean asphalt!
  const interMarkingsTex = (() => {
    const S = 512;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const ctx = c.getContext('2d');

    ctx.clearRect(0, 0, S, S);

    ctx.strokeStyle = 'rgba(238, 244, 252, 0.56)';
    ctx.lineWidth = 4.5;
    ctx.setLineDash([14, 16]);

    // 4 quarter-circle dashed turning guide curves connecting incoming/outgoing lanes around each corner
    const rInner = 170; // matches motor lane center offset (2.70 - 0.90 = 1.80u -> 170px) from corner
    for (const [cx, cy, a0, a1] of [
      [0, 0, 0, Math.PI * 0.5],
      [S, 0, Math.PI * 0.5, Math.PI],
      [S, S, Math.PI, Math.PI * 1.5],
      [0, S, Math.PI * 1.5, Math.PI * 2]
    ]) {
      ctx.beginPath();
      ctx.arc(cx, cy, rInner, a0 + 0.12, a1 - 0.12);
      ctx.stroke();
    }

    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
    return t;
  })();

  // Yellow Tactile Paving Texture (Sudut Trotoar at y = 0.175)
  const tactileTex = (() => {
    const S = 128;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const ctx = c.getContext('2d');

    ctx.fillStyle = '#eab82e';
    ctx.fillRect(0, 0, S, S);
    ctx.strokeStyle = '#c59216';
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, S - 4, S - 4);

    for (let r = 0; r < 6; r++) {
      for (let col = 0; col < 6; col++) {
        const cx = 14 + col * 20;
        const cy = 14 + r * 20;
        ctx.fillStyle = '#c48f12';
        ctx.beginPath();
        ctx.arc(cx + 1.5, cy + 1.5, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffe066';
        ctx.beginPath();
        ctx.arc(cx, cy, 5.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
    return t;
  })();

  // Bus Shelter Illuminated Route Map Texture
  const shelterMapTex = (() => {
    const W = 256, H = 384;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d');

    ctx.fillStyle = '#182232';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#25354d';
    ctx.fillRect(10, 10, W - 20, H - 20);

    ctx.fillStyle = '#2e8b62';
    ctx.fillRect(10, 10, W - 20, 54);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 22px "DM Sans", Arial, sans-serif';
    ctx.fillText('TRANSIT CERRIA', 26, 45);

    ctx.strokeStyle = '#4ce695';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(52, 95);
    ctx.lineTo(52, 330);
    ctx.stroke();

    ctx.strokeStyle = '#ffc14d';
    ctx.beginPath();
    ctx.moveTo(52, 165);
    ctx.lineTo(205, 165);
    ctx.lineTo(205, 310);
    ctx.stroke();

    for (const [x, y, label] of [
      [52, 105, 'Pos Budi & Fauna'],
      [52, 165, 'Simpang Utama'],
      [52, 235, 'Pos Botani & Sains'],
      [52, 305, 'Pos Karya'],
      [205, 265, 'Strawberry Corner']
    ]) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fill();
      if (x === 52) {
        ctx.fillStyle = '#d8e3f2';
        ctx.font = '500 15px "DM Sans", Arial, sans-serif';
        ctx.fillText(label, 72, y + 5);
      }
    }

    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();

  // 1) Base Road Surface Material (y = 0.03)
  const mAsphaltSurface = patch(
    new THREE.MeshStandardMaterial({
      map: asphaltTex,
      roughness: 0.88,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    }),
    worldTone
  );
  mAsphaltSurface.userData.noCast = true;

  // 2) Road Markings & Bike Lanes Materials (y = 0.012, polygonOffset -1/-1, noCast, noReceive)
  const makeMarkingsMat = tex => {
    const m = patch(
      new THREE.MeshStandardMaterial({
        map: tex,
        transparent: true,
        alphaTest: 0.05,
        roughness: 0.78,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1
      }),
      worldTone
    );
    m.userData.noCast = true;
    m.userData.noReceive = true;
    return m;
  };
  const mRoadMarkings = makeMarkingsMat(roadMarkingsTex);
  const mRoadMarkingsNoY0 = makeMarkingsMat(roadMarkingsNoY0Tex);
  const mRoadMarkingsNoYH = makeMarkingsMat(roadMarkingsNoYHTex);
  const mRoadMarkingsContinuous = makeMarkingsMat(roadMarkingsContinuousTex);

  // 3) Zebra Crossings Material (y = 0.012, polygonOffset -1/-1, noCast, noReceive)
  const mCrosswalkMarkings = patch(
    new THREE.MeshStandardMaterial({
      map: crosswalkMarkingsTex,
      transparent: true,
      alphaTest: 0.05,
      roughness: 0.78,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    }),
    worldTone
  );
  mCrosswalkMarkings.userData.noCast = true;
  mCrosswalkMarkings.userData.noReceive = true;

  // 4) Intersection Bike Guide Dashes Material (y = 0.012, polygonOffset -1/-1, noCast, noReceive)
  const mInterMarkings = patch(
    new THREE.MeshStandardMaterial({
      map: interMarkingsTex,
      transparent: true,
      alphaTest: 0.05,
      roughness: 0.78,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    }),
    worldTone
  );
  mInterMarkings.userData.noCast = true;
  mInterMarkings.userData.noReceive = true;

  // 5) Yellow Tactile Paving Material (flush on top of sidewalk tiles inside curb, polygonOffset -1/-1, noCast, noReceive)
  const mTactile = patch(
    new THREE.MeshStandardMaterial({
      map: tactileTex,
      roughness: 0.75,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    }),
    worldTone
  );
  mTactile.userData.noCast = true;
  mTactile.userData.noReceive = true;

  const mDarkPole = mat('#232832', { roughness: 0.45, metalness: 0.45 });
  const mSignalHead = mat('#171b22', { roughness: 0.4, metalness: 0.3 });
  const mShelterWood = mat('#b87d4b', { roughness: 0.8 });
  const mShelterSign = glowMat('#38bdf8', 1.4);
  const mShelterSignMat = mShelterSign;
  mShelterSignMat.userData.noCast = true;
  mShelterSignMat.userData.noReceive = true;
  const mShelterLight = glowMat('#fff3d6', 1.8);
  mShelterLight.userData.noCast = true;
  mShelterLight.userData.noReceive = true;
  const mShelterMap = new THREE.MeshBasicMaterial({
    map: shelterMapTex,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2
  });
  mShelterMap.userData.noCast = true;
  mShelterMap.userData.noReceive = true;

  // --------------------------------------------------------------------------
  // 2. BUILD LAYERED ROAD SURFACE (y = 0.03), MARKINGS (y = 0.055) & TACTILE (y = 0.185)
  // --------------------------------------------------------------------------
  const roadBatch = new Batch();
  const planeGeo = new THREE.PlaneGeometry(1, 1).toNonIndexed();
  planeGeo.rotateX(-Math.PI / 2);

  const segLen = PITCH - INTER_HALF * 2; // 14.8 - 5.6 = 9.20 units (disjoint from intersection tiles)
  const crossLen = INTER_HALF - BOX_HALF; // 2.8 - 1.9 = 0.90 units

  // Continuous green bike lane material (#2E9B4F) to close off T-Junction side road mouths along the Tennis Court Superblock
  const mContinuousBikeLane = new THREE.MeshStandardMaterial({
    color: '#2E9B4F',
    roughness: 0.72,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1
  });
  mContinuousBikeLane.userData.noCast = true;

  // Closed road segments:
  // 1) N-S road at x = 2 * PITCH between z = 0 and z = PITCH -> toko6 (Apex Sport) + Outdoor Tennis Court Superblock
  // 2) N-S road at x = 1 * PITCH between z = PITCH and z = 2 * PITCH -> Mayor's Office + Central Park Unified Civic Superblock
  // 3) E-W road at z = -1 * PITCH between x = 2 * PITCH and x = 3 * PITCH -> toko5 (Strawberry Corner) + Contemporary Urban Pocket Park + Taman Kota Superblock
  const isSouthMouthClosed = (c, c2) =>
    (Math.abs(c - 2 * PITCH) < 0.1 && Math.abs(c2 - PITCH) < 0.1) ||
    (Math.abs(c - PITCH) < 0.1 && Math.abs(c2 - 2 * PITCH) < 0.1);
  const isNorthMouthClosed = (c, c2) =>
    (Math.abs(c - 2 * PITCH) < 0.1 && Math.abs(c2 - 0) < 0.1) ||
    (Math.abs(c - PITCH) < 0.1 && Math.abs(c2 - PITCH) < 0.1);
  const isClosedNSSegment = (c, c2) =>
    (Math.abs(c - 2 * PITCH) < 0.1 && Math.abs(c2 - 0) < 0.1) ||
    (Math.abs(c - PITCH) < 0.1 && Math.abs(c2 - PITCH) < 0.1);
  const isEastMouthClosed = (c, c2) =>
    Math.abs(c - 2 * PITCH) < 0.1 && Math.abs(c2 + PITCH) < 0.1;
  const isWestMouthClosed = (c, c2) =>
    Math.abs(c - 3 * PITCH) < 0.1 && Math.abs(c2 + PITCH) < 0.1;
  const isClosedEWSegment = (c, c2) =>
    Math.abs(c - 2 * PITCH) < 0.1 && Math.abs(c2 + PITCH) < 0.1;

  for (let i = 0; i < LINES.length; i++) {
    const c = LINES[i];
    for (let j = 0; j < LINES.length; j++) {
      const c2 = LINES[j];
      const noMinusZLeg = isSouthMouthClosed(c, c2); // -Z leg (z < c2) is closed at (2*PITCH, PITCH) & (PITCH, 2*PITCH)
      const noPlusZLeg = isNorthMouthClosed(c, c2);  // +Z leg (z > c2) is closed at (2*PITCH, 0) & (PITCH, PITCH)
      const noPlusXLeg = isEastMouthClosed(c, c2);   // +X leg (x > c) is closed at (2*PITCH, -PITCH) for Pocket Park
      const noMinusXLeg = isWestMouthClosed(c, c2);  // -X leg (x < c) is closed at (3*PITCH, -PITCH) for Pocket Park
      const isTJunc = noMinusZLeg || noPlusZLeg;
      const isEWJunc = noPlusXLeg || noMinusXLeg;

      // --- LAYER y = 0.008: Disjoint Asphalt Road Surface covering intersection + crosswalks + rounded corner spandrels ---
      const MARK_W = ROAD_W - 0.12; // Trimmed so markings/bike lane mesh stops strictly at outer curb face and never goes under curb
      roadBatch.add(mAsphaltSurface, planeGeo, c, Y_ROAD, c2, INTER_HALF * 2 - 0.08, 1, INTER_HALF * 2 - 0.08);

      // --- LAYER y = 0.015: Clean Intersection Turning Curves, Zebra Crossings, Bike Lanes & Arrows ---
      if (!isTJunc && !isEWJunc) {
        roadBatch.add(mInterMarkings, planeGeo, c, Y_MARKINGS, c2, BOX_HALF * 2, 1, BOX_HALF * 2);
      } else if (isEWJunc) {
        // Continuous North-South road markings & green bike lanes (#2E9B4F) along the Urban Pocket Park Superblock
        roadBatch.add(mRoadMarkingsContinuous, planeGeo, c, Y_MARKINGS, c2, MARK_W, 1, BOX_HALF * 2);
      } else if (isTJunc) {
        // Continuous East-West road markings & green bike lanes (#2E9B4F) along merged superblocks
        roadBatch.add(mRoadMarkingsContinuous, planeGeo, c, Y_MARKINGS, c2, MARK_W, 1, BOX_HALF * 2, 0, Math.PI / 2, 0);
      }
      if (!noMinusZLeg) {
        roadBatch.add(
          isEWJunc ? mRoadMarkingsContinuous : mCrosswalkMarkings,
          planeGeo,
          c,
          Y_MARKINGS,
          c2 - CROSSWALK_DIST,
          MARK_W,
          1,
          crossLen
        );
      }
      if (!noPlusZLeg) {
        roadBatch.add(
          isEWJunc ? mRoadMarkingsContinuous : mCrosswalkMarkings,
          planeGeo,
          c,
          Y_MARKINGS,
          c2 + CROSSWALK_DIST,
          MARK_W,
          1,
          crossLen
        );
      }
      if (!isTJunc) {
        if (!noMinusXLeg) {
          roadBatch.add(mCrosswalkMarkings, planeGeo, c - CROSSWALK_DIST, Y_MARKINGS, c2, MARK_W, 1, crossLen, 0, Math.PI / 2, 0);
        }
        if (!noPlusXLeg) {
          roadBatch.add(mCrosswalkMarkings, planeGeo, c + CROSSWALK_DIST, Y_MARKINGS, c2, MARK_W, 1, crossLen, 0, Math.PI / 2, 0);
        }
      } else {
        // At T-Junctions along the merged superblock sidewalks (toko6 Apex Sport <-> Tennis Court & Mayor's Office <-> Taman Kota),
        // omit the E-W zebra crossings and continue the straight road markings cleanly!
        roadBatch.add(mRoadMarkingsContinuous, planeGeo, c - CROSSWALK_DIST, Y_MARKINGS, c2, MARK_W, 1, crossLen, 0, Math.PI / 2, 0);
        roadBatch.add(mRoadMarkingsContinuous, planeGeo, c + CROSSWALK_DIST, Y_MARKINGS, c2, MARK_W, 1, crossLen, 0, Math.PI / 2, 0);
      }

      // --- Curved Yellow Tactile Paving on outer background blocks (main 7-store & park blocks already have 3D M.tactileYellow at y = 0.195) ---
      if (Math.hypot(c - PITCH, c2 - PITCH) < 86) {
        for (const sx of [-1, 1]) {
          for (const sz of [-1, 1]) {
            if (noMinusZLeg && sz === -1) continue;
            if (noPlusZLeg && sz === 1) continue;
            if (noPlusXLeg && sx === 1) continue;
            if (noMinusXLeg && sx === -1) continue;
            const blkX = c + sx * 0.5 * PITCH;
            const blkZ = c2 + sz * 0.5 * PITCH;
            const isMainBlockWithTactileRing =
              (Math.abs(blkZ - 1.5 * PITCH) < 1 && (Math.abs(blkX - 0.5 * PITCH) < 1 || Math.abs(blkX - 1.5 * PITCH) < 1)) ||
              (Math.abs(blkZ - 0.5 * PITCH) < 1 && (Math.abs(blkX - 1.5 * PITCH) < 1 || Math.abs(blkX - 2.5 * PITCH) < 1)) ||
              (Math.abs(blkX - 0.5 * PITCH) < 1 && Math.abs(blkZ - 0.5 * PITCH) < 1) ||
              (Math.abs(blkX - 0.5 * PITCH) < 1 && Math.abs(blkZ + 0.5 * PITCH) < 1) ||
              (Math.abs(blkX + 0.5 * PITCH) < 1 && Math.abs(blkZ + 0.5 * PITCH) < 1) ||
              (Math.abs(blkX + 0.5 * PITCH) < 1 && Math.abs(blkZ - 0.5 * PITCH) < 1) ||
              (Math.abs(blkX - 2.5 * PITCH) < 1 && (Math.abs(blkZ + 0.5 * PITCH) < 1 || Math.abs(blkZ + 1.5 * PITCH) < 1)) ||
              (Math.abs(blkX - 3.5 * PITCH) < 1 && Math.abs(blkZ + 0.5 * PITCH) < 1);
            if (isMainBlockWithTactileRing) continue;
            const arcCx = c + sx * (BOX_HALF + 1.20);
            const arcCz = c2 + sz * (BOX_HALF + 1.20);
            const rPad = 0.90;
            for (const tFrac of [0.22, 0.78]) {
              const ang = tFrac * (Math.PI * 0.5);
              const px = arcCx - sx * Math.cos(ang) * rPad;
              const pz = arcCz - sz * Math.sin(ang) * rPad;
              const tangentRy = Math.atan2(-sx * Math.sin(ang), sz * Math.cos(ang));
              roadBatch.add(mTactile, planeGeo, px, 0.153, pz, 0.20, 1, 0.34, 0, tangentRy, 0);
            }
          }
        }
      }

      // Straight Road Segments between this intersection and the next (+PITCH)
      // Skip the closed N-S road segments (Tennis Court & Unified Civic Park)
      if (j < LINES.length - 1 && !isClosedNSSegment(c, c2)) {
        const c2Next = LINES[j + 1];
        const midZ = (c2 + c2Next) * 0.5;
        const northIsEWJunc = isEastMouthClosed(c, c2) || isWestMouthClosed(c, c2);
        const southIsEWJunc = isEastMouthClosed(c, c2Next) || isWestMouthClosed(c, c2Next);
        const nsMarkMat =
          northIsEWJunc && southIsEWJunc
            ? mRoadMarkingsContinuous
            : northIsEWJunc
              ? mRoadMarkingsNoY0
              : southIsEWJunc
                ? mRoadMarkingsNoYH
                : mRoadMarkings;
        roadBatch.add(mAsphaltSurface, planeGeo, c, Y_ROAD, midZ, ROAD_W - 0.08, 1, segLen);
        roadBatch.add(nsMarkMat, planeGeo, c, Y_MARKINGS, midZ, MARK_W, 1, segLen);
      }
      // Skip the closed E-W road segment at z = -PITCH between x = 2*PITCH and x = 3*PITCH (Contemporary Urban Pocket Park)
      if (i < LINES.length - 1 && !isClosedEWSegment(c, c2)) {
        const cNext = LINES[i + 1];
        const midX = (c + cNext) * 0.5;
        const westIsTJunc = isSouthMouthClosed(c, c2) || isNorthMouthClosed(c, c2);
        const eastIsTJunc = isSouthMouthClosed(cNext, c2) || isNorthMouthClosed(cNext, c2);
        const ewMarkMat =
          westIsTJunc && eastIsTJunc
            ? mRoadMarkingsContinuous
            : westIsTJunc
              ? mRoadMarkingsNoY0
              : eastIsTJunc
                ? mRoadMarkingsNoYH
                : mRoadMarkings;
        roadBatch.add(mAsphaltSurface, planeGeo, midX, Y_ROAD, c2, ROAD_W - 0.08, 1, segLen, 0, Math.PI / 2, 0);
        roadBatch.add(ewMarkMat, planeGeo, midX, Y_MARKINGS, c2, MARK_W, 1, segLen, 0, Math.PI / 2, 0);
      }
    }
  }

  // --------------------------------------------------------------------------
  // 3. GLASS BUS SHELTERS (HALTE KACA)
  // --------------------------------------------------------------------------
  const shelterGlassPositions = [];
  const busCurbOff = BOX_HALF + 0.38; // 3.08u from road center (sitting cleanly on the outer sidewalk curb)
  const busStops = [
    [PITCH + busCurbOff, 0.5 * PITCH - 1.6, -Math.PI / 2, 1, PITCH, -1, 0.5 * PITCH - 1.6],
    [0 - (busCurbOff + 0.54), 0.5 * PITCH - 0.35, Math.PI / 2, 1, 0, 1, 0.5 * PITCH - 0.35],
    [0.5 * PITCH + 1.6, PITCH + busCurbOff, Math.PI, 0, PITCH, 1, 0.5 * PITCH + 1.6],
    [1.5 * PITCH - 2.6, PITCH - busCurbOff, 0, 0, PITCH, -1, 1.5 * PITCH - 2.6],
    [0 + busCurbOff, 1.5 * PITCH - 1.4, -Math.PI / 2, 1, 0, -1, 1.5 * PITCH - 1.4],
    [2 * PITCH + busCurbOff, 1.5 * PITCH + 1.4, -Math.PI / 2, 1, 2 * PITCH, -1, 1.5 * PITCH + 1.4]
  ];

  function addBusShelter(bx, bz, ry) {
    const cos = Math.cos(ry), sin = Math.sin(ry);
    const toW = (lx, lz) => [bx + lx * cos + lz * sin, bz - lx * sin + lz * cos];

    // Shelter base pad on top of sidewalk (y = 0.15 -> pad top at 0.18)
    const [px, pz] = toW(0, 0);
    roadBatch.box(mDarkPole, px, Y_SIDEWALK + 0.015, pz, 1.85, 0.03, 0.78, { ry });

    // 4 vertical steel pillars at back & side corners
    for (const [lx, lz] of [[-0.82, -0.32], [0.82, -0.32], [-0.82, 0.28], [0.82, 0.28]]) {
      const [wx, wz] = toW(lx, lz);
      roadBatch.cyl(mDarkPole, wx, Y_SIDEWALK + 0.69, wz, 0.032, 1.32);
    }

    // Cantilevered dark metallic roof canopy + glowing ceiling light strip
    const [rx0, rz0] = toW(0, 0.02);
    roadBatch.box(mDarkPole, rx0, Y_SIDEWALK + 1.37, rz0, 1.96, 0.06, 0.88, { ry, r: 0.02 });
    const [lx0, lz0] = toW(0, 0.04);
    roadBatch.box(mShelterLight, lx0, Y_SIDEWALK + 1.33, lz0, 1.45, 0.015, 0.28, { ry });

    // Illuminated route map lightbox on the right side (map plane +0.04 in front of box)
    const [mx, mz] = toW(0.82, 0);
    roadBatch.box(mDarkPole, mx, Y_SIDEWALK + 0.69, mz, 0.08, 1.18, 0.56, { ry });
    const [mfx, mfz] = toW(0.75, 0);
    roadBatch.add(mShelterMap, new THREE.PlaneGeometry(0.48, 1.04).toNonIndexed(), mfx, Y_SIDEWALK + 0.69, mfz, 1, 1, 1, 0, ry - Math.PI / 2, 0);

    // Wooden waiting bench inside shelter
    const [bwx, bwz] = toW(-0.15, -0.16);
    roadBatch.box(mShelterWood, bwx, Y_SIDEWALK + 0.31, bwz, 1.05, 0.05, 0.28, { ry, r: 0.01 });
    roadBatch.box(mDarkPole, bwx, Y_SIDEWALK + 0.17, bwz, 0.88, 0.24, 0.06, { ry });

    // Curbside Bus Stop Flag Pole
    const [fpx, fpz] = toW(1.18, 0.26);
    roadBatch.cyl(mDarkPole, fpx, Y_SIDEWALK + 0.75, fpz, 0.026, 1.48);
    roadBatch.box(mShelterSign, fpx, Y_SIDEWALK + 1.39, fpz, 0.22, 0.26, 0.04, { ry });

    // Record glass panel transforms
    const [gbx, gbz] = toW(0, -0.32);
    shelterGlassPositions.push({ x: gbx, y: Y_SIDEWALK + 0.69, z: gbz, w: 1.58, h: 1.24, d: 0.025, ry });
    const [glx, glz] = toW(-0.82, -0.02);
    shelterGlassPositions.push({ x: glx, y: Y_SIDEWALK + 0.69, z: glz, w: 0.025, h: 1.24, d: 0.56, ry });
  }

  for (const [bx, bz, ry] of busStops) {
    addBusShelter(bx, bz, ry);
  }

  // --------------------------------------------------------------------------
  // 4. 3D CANTILEVER TRAFFIC LIGHT POLES AT INTERSECTIONS
  // --------------------------------------------------------------------------
  const intersections = [];
  const interMap = new Map();
  const lensInstances = [];

  for (let ix = 0; ix < LANES.length; ix++) {
    for (let iz = 0; iz < LANES.length; iz++) {
      const rx = LANES[ix];
      const rz = LANES[iz];
      const dist = Math.hypot(rx - PITCH, rz - PITCH);
      const inter = {
        ix,
        iz,
        x: rx,
        z: rz,
        offset: (ix * 4.5 + iz * 6.2) % 32,
        cycle: 32,
        nsState: 'G',
        ewState: 'R',
        nsWalk: true,
        ewWalk: false
      };
      intersections.push(inter);
      interMap.set(`${ix},${iz}`, inter);

      if (dist > 64) continue;

      // Placed on sidewalk corner right before each zebra cross (4.02 units along approach axis before zebra cross,
      // 3.08 units from road center on the sidewalk curb edge, well clear of the 2.70u asphalt roadway!).
      // Cantilever arm (ax, az) extends over the widened asphalt lanes; signal faces (faceRy) oncoming traffic.
      const poleSide = BOX_HALF + 0.38; // 3.08u
      const poleAlong = INTER_HALF + 0.22; // 4.02u
      const corners = [
        // SE corner: for Northbound (-Z) traffic on East lanes (x > rx), arm extends West (-X), faces South (+Z, faceRy = 0)
        [rx + poleSide, rz + poleAlong, -1, 0, 0, 1],
        // NW corner: for Southbound (+Z) traffic on West lanes (x < rx), arm extends East (+X), faces North (-Z, faceRy = Math.PI)
        [rx - poleSide, rz - poleAlong, 1, 0, Math.PI, 1],
        // SW corner: for Eastbound (+X) traffic on South lanes (z > rz), arm extends North (-Z), faces West (-X, faceRy = -Math.PI / 2)
        [rx - poleAlong, rz + poleSide, 0, -1, -Math.PI / 2, 0],
        // NE corner: for Westbound (-X) traffic on North lanes (z < rz), arm extends South (+Z), faces East (+X, faceRy = Math.PI / 2)
        [rx + poleAlong, rz - poleSide, 0, 1, Math.PI / 2, 0]
      ];

      const noMinusZLeg = isSouthMouthClosed(rx, rz); // -Z leg (z < rz) is closed at (2*PITCH, PITCH) & (PITCH, 2*PITCH)
      const noPlusZLeg = isNorthMouthClosed(rx, rz);  // +Z leg (z > rz) is closed at (2*PITCH, 0) & (PITCH, PITCH)
      const noPlusXLeg = isEastMouthClosed(rx, rz);   // +X leg (x > rx) is closed at (2*PITCH, -PITCH) for Pocket Park
      const noMinusXLeg = isWestMouthClosed(rx, rz);  // -X leg (x < rx) is closed at (3*PITCH, -PITCH) for Pocket Park
      const isTJunc = noMinusZLeg || noPlusZLeg || noPlusXLeg || noMinusXLeg;

      for (const [rawPx, rawPz, ax, az, faceRy, ctrlAxis] of corners) {
        // Audit & Clean Up Traffic Light Poles at T-Junctions, Atelier Boutique, Cozy Bites & Circuit & Byte Main Plazas:
        // 1) Remove all traffic light poles at the closed superblock junctions so no leftover poles stand along merged sidewalks!
        // 2) Keep traffic signal mast-arm poles out of the Atelier Boutique sidewalk & front corner plaza (-PITCH, -PITCH) and
        //    Cozy Bites & Sips sidewalk & front corner intersections (PITCH, 0) / (PITCH, -PITCH).
        // 3) On Pos 4 (Circuit & Byte block), snap the left-side (0, 0) and front-bottom (-PITCH, PITCH) traffic light mast arms
        //    strictly to the outer curb corner lip (3.12u from road center = 5.08u from block center, 0.25m from the curb)
        //    and keep the front-left kiosk corner (-PITCH, 0) clear so no pole stands in the middle of the sidewalk!
        const onAtelierBlock = rawPx >= -PITCH - 0.5 && rawPx <= -1.5 && rawPz >= -PITCH - 0.5 && rawPz <= -1.5;
        const isAtelierCornerInter = Math.abs(rx - -PITCH) < 0.5 && Math.abs(rz - -PITCH) < 0.5;
        const onCozyBlock = rawPx >= 1.5 && rawPx <= PITCH + 0.5 && rawPz >= -PITCH - 0.5 && rawPz <= -1.5;
        const isCozyCornerInter = Math.abs(rx - PITCH) < 0.5 && (Math.abs(rz) < 0.5 || Math.abs(rz - -PITCH) < 0.5);
        const onCircuitBlock = rawPx >= -PITCH - 0.5 && rawPx <= -1.5 && rawPz >= 1.5 && rawPz <= PITCH + 0.5;
        const isCircuitKioskCorner = onCircuitBlock && Math.abs(rx - -PITCH) < 0.5 && Math.abs(rz) < 0.5;
        const isCircuitRearRightCorner = onCircuitBlock && Math.abs(rx) < 0.5 && Math.abs(rz - PITCH) < 0.5;
        const isMayorFrontRightInter = Math.abs(rx - 2 * PITCH) < 0.5 && Math.abs(rz - 2 * PITCH) < 0.5;
        const isMayorForegroundPole = isMayorFrontRightInter && rawPx < rx;
        if (
          isTJunc ||
          onAtelierBlock ||
          isAtelierCornerInter ||
          onCozyBlock ||
          isCozyCornerInter ||
          isCircuitKioskCorner ||
          isCircuitRearRightCorner ||
          isMayorForegroundPole
        )
          continue;
        const px = onCircuitBlock ? rx + Math.sign(rawPx - rx) * (BOX_HALF + 0.42) : rawPx;
        const pz = onCircuitBlock ? rz + Math.sign(rawPz - rz) * (BOX_HALF + 0.42) : rawPz;
        roadBatch.cyl(mDarkPole, px, Y_SIDEWALK + 1.32, pz, 0.045, 2.65);
        roadBatch.cyl(mDarkPole, px, Y_SIDEWALK + 0.07, pz, 0.09, 0.14);

        const armLen = 2.15;
        const armCx = px + ax * (armLen * 0.5);
        const armCz = pz + az * (armLen * 0.5);
        roadBatch.box(
          mDarkPole,
          armCx,
          Y_SIDEWALK + 2.51,
          armCz,
          ax !== 0 ? armLen : 0.05,
          0.05,
          az !== 0 ? armLen : 0.05
        );

        const headX = px + ax * 1.88;
        const headZ = pz + az * 1.88;
        const headY = Y_SIDEWALK + 2.35;
        roadBatch.box(
          mSignalHead,
          headX,
          headY,
          headZ,
          ax !== 0 ? 0.22 : 0.12,
          0.54,
          az !== 0 ? 0.22 : 0.12,
          { r: 0.02 }
        );

        const secX = px + Math.sin(faceRy) * 0.07;
        const secZ = pz + Math.cos(faceRy) * 0.07;
        const secY = Y_SIDEWALK + 1.51;
        roadBatch.box(
          mSignalHead,
          secX,
          secY,
          secZ,
          ax !== 0 ? 0.16 : 0.10,
          0.42,
          az !== 0 ? 0.16 : 0.10
        );

        const pedY = Y_SIDEWALK + 1.01;
        roadBatch.box(
          mSignalHead,
          secX,
          pedY,
          secZ,
          ax !== 0 ? 0.14 : 0.09,
          0.24,
          az !== 0 ? 0.14 : 0.09
        );

        const fwdX = Math.sin(faceRy);
        const fwdZ = Math.cos(faceRy);

        for (const [aspect, dy1, dy2, sc] of [
          ['R', 0.16, 0.12, 1.0],
          ['Y', 0.0, 0.0, 1.0],
          ['G', -0.16, -0.12, 1.0]
        ]) {
          lensInstances.push({
            inter,
            axis: ctrlAxis,
            aspect,
            x: headX + fwdX * 0.085,
            y: headY + dy1,
            z: headZ + fwdZ * 0.085,
            ry: faceRy,
            scale: sc
          });
          lensInstances.push({
            inter,
            axis: ctrlAxis,
            aspect,
            x: secX + fwdX * 0.072,
            y: secY + dy2,
            z: secZ + fwdZ * 0.072,
            ry: faceRy,
            scale: 0.78
          });
        }

        lensInstances.push({
          inter,
          axis: ctrlAxis,
          aspect: 'DONT',
          x: secX + fwdX * 0.068,
          y: pedY + 0.05,
          z: secZ + fwdZ * 0.068,
          ry: faceRy,
          scale: 0.65
        });
        lensInstances.push({
          inter,
          axis: ctrlAxis,
          aspect: 'WALK',
          x: secX + fwdX * 0.068,
          y: pedY - 0.05,
          z: secZ + fwdZ * 0.068,
          ry: faceRy,
          scale: 0.65
        });
      }
    }
  }

  roadBatch.build(roadsGroup);

  // Build Translucent Tempered Glass Panels for Bus Shelters (Halte Kaca)
  const mShelterGlass = new THREE.MeshStandardMaterial({
    color: '#9ad8ec',
    roughness: 0.15,
    metalness: 0.1,
    transparent: true,
    opacity: 0.38,
    depthWrite: false
  });
  const shelterGlassMesh = new THREE.InstancedMesh(unitBox, mShelterGlass, shelterGlassPositions.length);
  shelterGlassMesh.name = 'Environment_BusShelterGlass';
  shelterGlassMesh.castShadow = false;
  shelterGlassMesh.receiveShadow = false;
  const dummy = new THREE.Object3D();
  shelterGlassPositions.forEach((p, idx) => {
    dummy.position.set(p.x, p.y, p.z);
    dummy.rotation.set(0, p.ry, 0);
    dummy.scale.set(p.w, p.h, p.d);
    dummy.updateMatrix();
    shelterGlassMesh.setMatrixAt(idx, dummy.matrix);
  });
  decorGroup.add(shelterGlassMesh);

  // Build InstancedMesh for Dynamic Traffic Light Lenses (polygonOffset -2/-2, no shadow)
  const lensGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.02, 10).toNonIndexed();
  lensGeo.rotateX(Math.PI / 2);
  const lensMat = new THREE.MeshBasicMaterial({
    color: '#ffffff',
    fog: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2
  });
  const trafficLenses = new THREE.InstancedMesh(lensGeo, lensMat, lensInstances.length);
  trafficLenses.name = 'Environment_TrafficLightLenses';
  trafficLenses.castShadow = false;
  trafficLenses.receiveShadow = false;
  lensInstances.forEach((l, idx) => {
    dummy.position.set(l.x, l.y, l.z);
    dummy.rotation.set(0, l.ry, 0);
    dummy.scale.setScalar(l.scale);
    dummy.updateMatrix();
    trafficLenses.setMatrixAt(idx, dummy.matrix);
  });
  decorGroup.add(trafficLenses);

  const colRedOn = new THREE.Color('#ff5a4a').multiplyScalar(2.4);
  const colYellowOn = new THREE.Color('#ffc14d').multiplyScalar(2.4);
  const colGreenOn = new THREE.Color('#5ee39a').multiplyScalar(2.4);
  const colLensOff = new THREE.Color('#1d222b');

  function updateIntersections(simTime) {
    for (const inter of intersections) {
      const t = ((simTime + inter.offset) % inter.cycle + inter.cycle) % inter.cycle;
      if (t < 12.0) {
        inter.nsState = 'G';
        inter.ewState = 'R';
        inter.nsWalk = t < 9.5;
        inter.ewWalk = false;
      } else if (t < 14.6) {
        inter.nsState = 'Y';
        inter.ewState = 'R';
        inter.nsWalk = false;
        inter.ewWalk = false;
      } else if (t < 16.0) {
        inter.nsState = 'R';
        inter.ewState = 'R';
        inter.nsWalk = false;
        inter.ewWalk = false;
      } else if (t < 28.0) {
        inter.nsState = 'R';
        inter.ewState = 'G';
        inter.nsWalk = false;
        inter.ewWalk = t < 25.5;
      } else if (t < 30.6) {
        inter.nsState = 'R';
        inter.ewState = 'Y';
        inter.nsWalk = false;
        inter.ewWalk = false;
      } else {
        inter.nsState = 'R';
        inter.ewState = 'R';
        inter.nsWalk = false;
        inter.ewWalk = false;
      }
    }

    for (let i = 0; i < lensInstances.length; i++) {
      const l = lensInstances[i];
      const state = l.axis === 1 ? l.inter.nsState : l.inter.ewState;
      const walk = l.axis === 1 ? l.inter.nsWalk : l.inter.ewWalk;
      let c = colLensOff;
      if (l.aspect === 'R' && state === 'R') c = colRedOn;
      else if (l.aspect === 'Y' && state === 'Y') c = colYellowOn;
      else if (l.aspect === 'G' && state === 'G') c = colGreenOn;
      else if (l.aspect === 'WALK' && walk) c = colGreenOn;
      else if (l.aspect === 'DONT' && !walk) c = colRedOn;
      trafficLenses.setColorAt(i, c);
    }
    trafficLenses.instanceColor.needsUpdate = true;
  }

  // --------------------------------------------------------------------------
  // 5. REVERSE-ENGINEERED PROCEDURAL 3D VEHICLES (FROM https://sael.net/parking/)
  //    - Pure Three.js Fritsch-Carlson Monotone Cubic Hermite Spline Lofted Body
  //      across 16 longitudinal stations (Za = -2.10 .. +2.185) & 8 feature curves
  //    - Parabolic roof/hood crown lofting + creased/smooth normal blending
  //    - Polygonal SDF mapping for recessed glass windows, headlights, taillights,
  //      front grille, bumpers, and lower rocker trim
  //    - Circular wheel-arch cutouts + 3D inner wheel-arch fender well liners (Jl)
  //    - 4 Independent Rotating Wheels per vehicle with grooved radial tires (Lathe)
  //      + extruded 5-Spoke Star Alloy Rims (ExtrudeGeometry) + internal brake discs
  //    - Exterior details: aerodynamic side mirrors, flush door handles, windshield
  //      wipers, shark-fin antenna, rear spoiler, and front/rear license plates
  //    - 3 Body Variations: 'sedan' (Sedan/Coupe), 'suv' (Hatchback/SUV), 'van' (Delivery Van)
  //    - Automatic THREE.Box3 normalization so tire bottoms sit 100% flush at y = 0.000
  // --------------------------------------------------------------------------
  const SAEL_WHEEL_R = 0.316;
  const SAEL_WHEEL_W = 0.205;

  // Fritsch-Carlson Monotone Cubic Hermite Spline Interpolator (Sr from sael.net/parking)
  function monoSpline(xs, ys) {
    const n = xs.length;
    const dx = new Array(n - 1);
    const sec = new Array(n - 1);
    for (let i = 0; i < n - 1; i++) {
      dx[i] = xs[i + 1] - xs[i];
      sec[i] = (ys[i + 1] - ys[i]) / dx[i];
    }
    const m = new Array(n);
    m[0] = sec[0];
    m[n - 1] = sec[n - 2];
    for (let i = 1; i < n - 1; i++) {
      m[i] = sec[i - 1] * sec[i] <= 0 ? 0 : (sec[i - 1] + sec[i]) * 0.5;
    }
    for (let i = 0; i < n - 1; i++) {
      if (Math.abs(sec[i]) < 1e-8) {
        m[i] = 0;
        m[i + 1] = 0;
      } else {
        const a = m[i] / sec[i];
        const b = m[i + 1] / sec[i];
        const h = Math.hypot(a, b);
        if (h > 3) {
          m[i] = (3 / h) * a * sec[i];
          m[i + 1] = (3 / h) * b * sec[i];
        }
      }
    }
    return x => {
      const xc = Math.max(xs[0], Math.min(xs[n - 1], x));
      let lo = 0;
      let hi = n - 2;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (xs[mid] <= xc) lo = mid;
        else hi = mid - 1;
      }
      const h = dx[lo];
      const t = (xc - xs[lo]) / h;
      const t2 = t * t;
      const t3 = t2 * t;
      return (
        (2 * t3 - 3 * t2 + 1) * ys[lo] +
        (t3 - 2 * t2 + t) * h * m[lo] +
        (-2 * t3 + 3 * t2) * ys[lo + 1] +
        (t3 - t2) * h * m[lo + 1]
      );
    };
  }

  // 2D Polygon Signed Distance Field (Mr from sael.net/parking)
  function polySDF(u, v, poly) {
    let dSq = Infinity;
    let s = 1;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1];
      const xj = poly[j][0], yj = poly[j][1];
      const ex = xj - xi, ey = yj - yi;
      const wx = u - xi, wy = v - yi;
      const t = Math.max(0, Math.min(1, (wx * ex + wy * ey) / (ex * ex + ey * ey + 1e-8)));
      const bx = wx - ex * t, by = wy - ey * t;
      dSq = Math.min(dSq, bx * bx + by * by);
      const c1 = u >= yi, c2 = u < yj, c3 = ex * wy > ey * wx;
      if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s;
    }
    return s * Math.sqrt(dSq);
  }

  // Helper to tag any BufferGeometry with aPart, aCarObj, and vertex color
  function tagCarPart(geo, partId, r = 1, g = 1, b = 1, ox = 0, oy = 0, oz = 0) {
    const c = solid(geo.clone());
    if (ox || oy || oz) c.translate(ox, oy, oz);
    c.computeVertexNormals();
    for (const key of Object.keys(c.attributes)) {
      if (key !== 'position' && key !== 'normal') c.deleteAttribute(key);
    }
    const pos = c.attributes.position;
    const count = pos.count;
    const col = new Float32Array(count * 3);
    const part = new Float32Array(count);
    const carObj = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      col[i * 3] = r;
      col[i * 3 + 1] = g;
      col[i * 3 + 2] = b;
      part[i] = partId;
      carObj[i * 3] = pos.getX(i);
      carObj[i * 3 + 1] = pos.getY(i);
      carObj[i * 3 + 2] = pos.getZ(i);
    }
    c.setAttribute('color', new THREE.BufferAttribute(col, 3));
    c.setAttribute('aPart', new THREE.BufferAttribute(part, 1));
    c.setAttribute('aCarObj', new THREE.BufferAttribute(carObj, 3));
    return c;
  }

  // Reverse-Engineered Wheel Geometry from sael.net/parking (Cr radial tire + Ir barrel + ns 5-spoke star alloy rim + brake rotor)
  // Built in Ceria Town wheel local space (axle along X, centered at [0, 0, 0], radius = SAEL_WHEEL_R = 0.316)
  let _cachedDetailedWheelGeo = null;
  function createDetailedWheelGeo() {
    if (_cachedDetailedWheelGeo) return _cachedDetailedWheelGeo;
    const parts = [];
    const R = SAEL_WHEEL_R; // 0.316
    const W = SAEL_WHEEL_W; // 0.205
    const rimR = R * 0.643; // 0.2032
    const hW = W * 0.5;
    const bev = 0.025;

    // 1. Grooved Radial Tire Profile (LatheGeometry around Y, then rotated so axle is X)
    const tirePts = [
      new THREE.Vector2(rimR - 0.008, -hW + 0.012),
      new THREE.Vector2(rimR + 0.022, -hW - 0.004),
      new THREE.Vector2(R - bev * 0.45, -hW - 0.002),
      new THREE.Vector2(R - bev * 0.12, -hW + bev * 0.45),
      new THREE.Vector2(R, -hW + bev),
      new THREE.Vector2(R, -0.028),
      new THREE.Vector2(R - 0.007, -0.024),
      new THREE.Vector2(R - 0.007, -0.015),
      new THREE.Vector2(R, -0.011),
      new THREE.Vector2(R, 0.011),
      new THREE.Vector2(R - 0.007, 0.015),
      new THREE.Vector2(R - 0.007, 0.024),
      new THREE.Vector2(R, 0.028),
      new THREE.Vector2(R, hW - bev),
      new THREE.Vector2(R - bev * 0.12, hW - bev * 0.45),
      new THREE.Vector2(R - bev * 0.45, hW + 0.002),
      new THREE.Vector2(rimR + 0.022, hW + 0.004),
      new THREE.Vector2(rimR - 0.008, hW - 0.012)
    ];
    const tireGeo = new THREE.LatheGeometry(tirePts, 28);
    tireGeo.rotateZ(-Math.PI / 2);
    parts.push(tagCarPart(tireGeo, 2, 0.13, 0.14, 0.16));

    // 2. Dark Inner Wheel Cavity & Recessed Alloy Barrel (Ir)
    const cavityGeo = new THREE.CylinderGeometry(rimR - 0.006, rimR - 0.006, W * 0.84, 24);
    cavityGeo.rotateZ(-Math.PI / 2);
    parts.push(tagCarPart(cavityGeo, 3, 0.08, 0.09, 0.11));

    const barrelPts = [
      new THREE.Vector2(rimR + 0.004, hW - 0.012),
      new THREE.Vector2(rimR - 0.009, hW - 0.022),
      new THREE.Vector2(rimR - 0.018, hW - 0.055),
      new THREE.Vector2(rimR - 0.018, -hW + 0.055),
      new THREE.Vector2(rimR - 0.009, -hW + 0.022),
      new THREE.Vector2(rimR + 0.004, -hW + 0.012)
    ];
    const barrelGeo = new THREE.LatheGeometry(barrelPts, 24);
    barrelGeo.rotateZ(-Math.PI / 2);
    parts.push(tagCarPart(barrelGeo, 6, 0.84, 0.87, 0.92));

    // 3. Internal Brake Rotor Disc (disc)
    const rotorGeo = new THREE.CylinderGeometry(rimR * 0.72, rimR * 0.72, 0.024, 20);
    rotorGeo.rotateZ(-Math.PI / 2);
    parts.push(tagCarPart(rotorGeo, 6, 0.62, 0.65, 0.70));

    // 4. Extruded 5-Spoke Star Alloy Wheel Face (ns from sael.net/parking) on both +X and -X wheel faces
    //    so both left (-X) and right (+X) mounted wheels display the 5-spoke star alloy face outward
    //    with positive determinant scale!
    const rimShape = new THREE.Shape();
    rimShape.absarc(0, 0, rimR - 0.006, 0, Math.PI * 2, false);
    const nSpokes = 5;
    const stepA = (Math.PI * 2) / nSpokes;
    const rIn = rimR * 0.30;
    const rOut = rimR * 0.84;
    const halfSpoke = 0.14;
    for (let i = 0; i < nSpokes; i++) {
      const a0 = i * stepA + halfSpoke;
      const a1 = (i + 1) * stepA - halfSpoke;
      const aMid = (a0 + a1) * 0.5;
      const hole = new THREE.Path();
      hole.moveTo(Math.cos(a0 + 0.06) * rIn, Math.sin(a0 + 0.06) * rIn);
      hole.lineTo(Math.cos(a0 - 0.02) * rOut, Math.sin(a0 - 0.02) * rOut);
      hole.quadraticCurveTo(
        Math.cos(aMid) * (rOut + 0.012),
        Math.sin(aMid) * (rOut + 0.012),
        Math.cos(a1 + 0.02) * rOut,
        Math.sin(a1 + 0.02) * rOut
      );
      hole.lineTo(Math.cos(a1 - 0.06) * rIn, Math.sin(a1 - 0.06) * rIn);
      hole.quadraticCurveTo(
        Math.cos(aMid) * (rIn - 0.010),
        Math.sin(aMid) * (rIn - 0.010),
        Math.cos(a0 + 0.06) * rIn,
        Math.sin(a0 + 0.06) * rIn
      );
      rimShape.holes.push(hole);
    }
    const spokeDepth = 0.018;
    const spokeFaceGeo = new THREE.ExtrudeGeometry(rimShape, {
      depth: spokeDepth,
      bevelEnabled: true,
      bevelThickness: 0.004,
      bevelSize: 0.003,
      bevelSegments: 1,
      curveSegments: 18
    });
    spokeFaceGeo.rotateY(Math.PI / 2);

    const rightFace = spokeFaceGeo.clone();
    rightFace.translate(hW - 0.026, 0, 0);
    parts.push(tagCarPart(rightFace, 6, 0.86, 0.89, 0.94));

    const leftFace = spokeFaceGeo.clone();
    leftFace.translate(-hW + 0.026 - spokeDepth, 0, 0);
    parts.push(tagCarPart(leftFace, 6, 0.86, 0.89, 0.94));

    // 5. Center Hub Cap & 5 Recessed Lug Nuts on both wheel faces
    const capGeo = new THREE.CylinderGeometry(rimR * 0.16, rimR * 0.18, W - 0.014, 14);
    capGeo.rotateZ(-Math.PI / 2);
    parts.push(tagCarPart(capGeo, 3, 0.10, 0.12, 0.15));

    const lugGeo = new THREE.CylinderGeometry(0.010, 0.010, W - 0.018, 8);
    lugGeo.rotateZ(-Math.PI / 2);
    for (let i = 0; i < nSpokes; i++) {
      const a = i * stepA;
      const ly = Math.cos(a) * (rimR * 0.22);
      const lz = Math.sin(a) * (rimR * 0.22);
      parts.push(tagCarPart(lugGeo, 3, 0.12, 0.14, 0.17, 0, ly, lz));
    }

    _cachedDetailedWheelGeo = mergeGeometries(parts, false);
    _cachedDetailedWheelGeo.computeVertexNormals();
    return _cachedDetailedWheelGeo;
  }

  // 16-Station Longitudinal Coordinates from sael.net/parking (Za)
  const SAEL_ZA = [-2.1, -2.04, -1.95, -1.75, -1.5, -1.0, -0.5, 0.0, 0.5, 0.95, 1.3, 1.7, 2.0, 2.1, 2.155, 2.185];

  // 3 Vehicle Body Specifications derived from sael.net/parking's 8-curve lofted architecture:
  //   1) 'suv'   : Exact sael.net/parking crossover SUV / hatchback silhouette (Ja)
  //   2) 'sedan' : Sleek 3-box notchback sedan / coupe with lower roofline & trunk deck
  //   3) 'van'   : High-roof commercial / transit delivery van with panoramic cab & cargo livery
  const CAR_SPECS = {
    suv: {
      scale: 0.57,
      archF: 1.32,
      archR: -1.32,
      archRad: 0.358,
      wheelTrack: 0.785,
      hasRoofRails: true,
      hasSpoiler: 'roof',
      isVanLivery: false,
      stations: [
        [[0.55, 0], [0.55, 0.48], [0.68, 0.55], [0.74, 0.62], [0.7, 0.65], [0.6, 0.68], [0.38, 0.65], [0.35, 0]],
        [[0.36, 0], [0.95, 0.55], [0.98, 0.6], [0.92, 0.7], [0.78, 0.75], [0.58, 0.78], [0.28, 0.72], [0.21, 0]],
        [[0.29, 0], [1.34, 0.56], [1.28, 0.63], [0.96, 0.74], [0.85, 0.82], [0.55, 0.85], [0.24, 0.77], [0.21, 0]],
        [[0.26, 0], [1.43, 0.58], [1.36, 0.66], [0.97, 0.78], [0.87, 0.87], [0.55, 0.895], [0.22, 0.8], [0.21, 0]],
        [[0.25, 0], [1.46, 0.6], [1.4, 0.67], [0.97, 0.79], [0.87, 0.875], [0.55, 0.895], [0.22, 0.8], [0.21, 0]],
        [[0.25, 0], [1.48, 0.61], [1.42, 0.68], [0.97, 0.79], [0.87, 0.875], [0.55, 0.895], [0.22, 0.8], [0.21, 0]],
        [[0.25, 0], [1.48, 0.61], [1.42, 0.68], [0.96, 0.79], [0.86, 0.875], [0.55, 0.895], [0.22, 0.8], [0.21, 0]],
        [[0.25, 0], [1.47, 0.6], [1.41, 0.67], [0.96, 0.79], [0.86, 0.875], [0.55, 0.895], [0.22, 0.8], [0.21, 0]],
        [[0.25, 0], [1.42, 0.58], [1.36, 0.65], [0.95, 0.79], [0.86, 0.875], [0.55, 0.895], [0.22, 0.8], [0.21, 0]],
        [[0.25, 0], [1.0, 0.67], [0.98, 0.73], [0.95, 0.78], [0.87, 0.875], [0.55, 0.895], [0.22, 0.8], [0.21, 0]],
        [[0.25, 0], [0.96, 0.68], [0.94, 0.74], [0.93, 0.77], [0.86, 0.875], [0.55, 0.895], [0.22, 0.8], [0.21, 0]],
        [[0.25, 0], [0.91, 0.64], [0.89, 0.7], [0.88, 0.74], [0.81, 0.84], [0.54, 0.86], [0.22, 0.78], [0.21, 0]],
        [[0.25, 0], [0.82, 0.56], [0.8, 0.64], [0.78, 0.7], [0.73, 0.76], [0.52, 0.79], [0.23, 0.72], [0.21, 0]],
        [[0.27, 0], [0.74, 0.48], [0.72, 0.55], [0.68, 0.62], [0.6, 0.68], [0.45, 0.7], [0.24, 0.64], [0.21, 0]],
        [[0.31, 0], [0.67, 0.37], [0.64, 0.44], [0.59, 0.5], [0.51, 0.54], [0.39, 0.56], [0.26, 0.5], [0.22, 0]],
        [[0.39, 0], [0.57, 0.25], [0.55, 0.31], [0.5, 0.35], [0.43, 0.38], [0.35, 0.39], [0.28, 0.35], [0.27, 0]]
      ],
      sideWin: [[-1.7, 1.03], [0.82, 1.01], [0.46, 1.35], [-1.52, 1.38]],
      windshield: [[0.52, 0], [0.52, 0.54], [0.92, 0.63], [0.92, 0]],
      backlight: [[-1.93, 0], [-1.93, 0.52], [-1.52, 0.55], [-1.52, 0]],
      mirrorPos: [0.80, 1.02, 0.76],
      handlesX: [0.33, -0.86],
      handleY: 0.925,
      wiperX: 1.02,
      wiperY: 0.992
    },
    sedan: {
      scale: 0.53,
      archF: 1.32,
      archR: -1.32,
      archRad: 0.352,
      wheelTrack: 0.775,
      hasRoofRails: false,
      hasSpoiler: 'lip',
      isVanLivery: false,
      stations: [
        [[0.52, 0], [0.52, 0.46], [0.64, 0.54], [0.70, 0.60], [0.66, 0.64], [0.56, 0.66], [0.36, 0.63], [0.33, 0]],
        [[0.34, 0], [0.90, 0.54], [0.89, 0.60], [0.86, 0.68], [0.75, 0.74], [0.55, 0.77], [0.26, 0.71], [0.21, 0]],
        [[0.28, 0], [0.93, 0.56], [0.92, 0.62], [0.90, 0.72], [0.81, 0.81], [0.53, 0.84], [0.23, 0.76], [0.21, 0]],
        [[0.25, 0], [0.95, 0.58], [0.94, 0.65], [0.92, 0.76], [0.83, 0.85], [0.53, 0.88], [0.22, 0.79], [0.21, 0]],
        [[0.25, 0], [0.97, 0.60], [0.95, 0.66], [0.93, 0.78], [0.84, 0.86], [0.53, 0.885], [0.22, 0.79], [0.21, 0]],
        [[0.25, 0], [1.22, 0.59], [1.18, 0.66], [0.94, 0.78], [0.84, 0.865], [0.53, 0.885], [0.22, 0.79], [0.21, 0]],
        [[0.25, 0], [1.35, 0.59], [1.30, 0.66], [0.94, 0.78], [0.84, 0.865], [0.53, 0.885], [0.22, 0.79], [0.21, 0]],
        [[0.25, 0], [1.36, 0.59], [1.31, 0.66], [0.94, 0.78], [0.84, 0.865], [0.53, 0.885], [0.22, 0.79], [0.21, 0]],
        [[0.25, 0], [1.32, 0.57], [1.27, 0.64], [0.93, 0.78], [0.84, 0.865], [0.53, 0.885], [0.22, 0.79], [0.21, 0]],
        [[0.25, 0], [0.95, 0.66], [0.93, 0.72], [0.91, 0.77], [0.84, 0.865], [0.53, 0.885], [0.22, 0.79], [0.21, 0]],
        [[0.25, 0], [0.90, 0.67], [0.88, 0.73], [0.87, 0.76], [0.82, 0.86], [0.52, 0.88], [0.22, 0.79], [0.21, 0]],
        [[0.25, 0], [0.84, 0.63], [0.82, 0.69], [0.81, 0.73], [0.76, 0.83], [0.51, 0.85], [0.22, 0.77], [0.21, 0]],
        [[0.25, 0], [0.76, 0.55], [0.74, 0.63], [0.72, 0.69], [0.68, 0.75], [0.49, 0.78], [0.22, 0.71], [0.21, 0]],
        [[0.26, 0], [0.68, 0.47], [0.66, 0.54], [0.63, 0.61], [0.56, 0.67], [0.43, 0.69], [0.23, 0.63], [0.21, 0]],
        [[0.30, 0], [0.61, 0.36], [0.59, 0.43], [0.55, 0.49], [0.48, 0.53], [0.37, 0.55], [0.25, 0.49], [0.22, 0]],
        [[0.37, 0], [0.52, 0.24], [0.50, 0.30], [0.46, 0.34], [0.40, 0.37], [0.33, 0.38], [0.26, 0.34], [0.26, 0]]
      ],
      sideWin: [[-1.22, 0.99], [0.82, 0.97], [0.42, 1.27], [-0.88, 1.28]],
      windshield: [[0.44, 0], [0.44, 0.53], [0.90, 0.61], [0.90, 0]],
      backlight: [[-1.42, 0], [-1.42, 0.52], [-0.62, 0.54], [-0.62, 0]],
      mirrorPos: [0.78, 0.97, 0.75],
      handlesX: [0.32, -0.68],
      handleY: 0.89,
      wiperX: 0.98,
      wiperY: 0.94
    },
    van: {
      scale: 0.62,
      archF: 1.34,
      archR: -1.32,
      archRad: 0.358,
      wheelTrack: 0.805,
      hasRoofRails: true,
      hasSpoiler: 'none',
      isVanLivery: true,
      stations: [
        [[0.56, 0], [0.58, 0.54], [0.72, 0.62], [0.80, 0.68], [0.76, 0.72], [0.62, 0.74], [0.38, 0.70], [0.34, 0]],
        [[0.36, 0], [1.56, 0.62], [1.50, 0.68], [0.98, 0.76], [0.86, 0.82], [0.58, 0.84], [0.26, 0.78], [0.21, 0]],
        [[0.28, 0], [1.64, 0.65], [1.58, 0.72], [1.00, 0.80], [0.88, 0.87], [0.56, 0.89], [0.23, 0.81], [0.21, 0]],
        [[0.25, 0], [1.66, 0.66], [1.60, 0.73], [1.00, 0.82], [0.89, 0.89], [0.56, 0.91], [0.22, 0.82], [0.21, 0]],
        [[0.25, 0], [1.66, 0.66], [1.60, 0.73], [1.00, 0.82], [0.89, 0.89], [0.56, 0.91], [0.22, 0.82], [0.21, 0]],
        [[0.25, 0], [1.66, 0.66], [1.60, 0.73], [1.00, 0.82], [0.89, 0.89], [0.56, 0.91], [0.22, 0.82], [0.21, 0]],
        [[0.25, 0], [1.66, 0.66], [1.60, 0.73], [1.00, 0.82], [0.89, 0.89], [0.56, 0.91], [0.22, 0.82], [0.21, 0]],
        [[0.25, 0], [1.66, 0.66], [1.60, 0.73], [1.00, 0.82], [0.89, 0.89], [0.56, 0.91], [0.22, 0.82], [0.21, 0]],
        [[0.25, 0], [1.65, 0.65], [1.59, 0.72], [1.00, 0.82], [0.89, 0.89], [0.56, 0.91], [0.22, 0.82], [0.21, 0]],
        [[0.25, 0], [1.60, 0.64], [1.54, 0.71], [0.99, 0.81], [0.89, 0.89], [0.56, 0.91], [0.22, 0.82], [0.21, 0]],
        [[0.25, 0], [1.22, 0.67], [1.18, 0.73], [0.98, 0.80], [0.88, 0.88], [0.56, 0.90], [0.22, 0.81], [0.21, 0]],
        [[0.25, 0], [0.96, 0.65], [0.94, 0.71], [0.91, 0.76], [0.83, 0.85], [0.54, 0.87], [0.22, 0.79], [0.21, 0]],
        [[0.25, 0], [0.86, 0.58], [0.84, 0.65], [0.81, 0.71], [0.75, 0.77], [0.52, 0.80], [0.23, 0.73], [0.21, 0]],
        [[0.27, 0], [0.76, 0.49], [0.74, 0.56], [0.70, 0.63], [0.62, 0.69], [0.46, 0.71], [0.24, 0.65], [0.21, 0]],
        [[0.31, 0], [0.68, 0.38], [0.65, 0.45], [0.60, 0.51], [0.52, 0.55], [0.40, 0.57], [0.26, 0.51], [0.22, 0]],
        [[0.39, 0], [0.58, 0.26], [0.56, 0.32], [0.51, 0.36], [0.44, 0.39], [0.36, 0.40], [0.28, 0.36], [0.27, 0]]
      ],
      sideWin: [[0.18, 1.05], [1.46, 1.03], [1.12, 1.50], [0.18, 1.54]],
      windshield: [[1.02, 0], [1.02, 0.60], [1.56, 0.65], [1.56, 0]],
      backlight: [[-2.02, 0], [-2.02, 0.56], [-1.82, 0.58], [-1.82, 0]],
      mirrorPos: [1.18, 1.06, 0.78],
      handlesX: [0.55, -0.35],
      handleY: 0.94,
      wiperX: 1.52,
      wiperY: 1.02
    }
  };

  // Build the Lofted Spline Body + 3D Inner Wheel Wells + Exterior Details in sael.net/parking space,
  // then rotate -90 deg around Y (+X_sael -> +Z_ceria forward) and normalize via THREE.Box3
  function createDetailedCar(type = 'suv', colorPalette = ['#4a7c9b']) {
    const spec = CAR_SPECS[type] || CAR_SPECS.suv;
    const J = spec.stations;
    const curves = Array.from({ length: 8 }, (_, k) => ({
      y: monoSpline(SAEL_ZA, J.map(row => row[k][0])),
      z: monoSpline(SAEL_ZA, J.map(row => row[k][1]))
    }));

    function sampleStation(x) {
      const xc = Math.max(-2.1, Math.min(2.185, x));
      const pts = curves.map(c => [c.y(xc), Math.max(0, c.z(xc))]);
      const crown =
        xc > -2.0 && xc < 2.12
          ? xc > -1.85 && xc < 0.85
            ? 0.055 * Math.sin(((xc + 1.85) / 2.7) * Math.PI)
            : xc >= 0.85
              ? 0.028 * Math.sin(((xc - 0.85) / 1.27) * Math.PI)
              : 0.015
          : 0;
      const y1 = pts[1][0], z1 = pts[1][1];
      const y0 = y1 + crown;
      const yMid = y1 + 0.75 * crown;
      const zMid = 0.5 * z1;
      return [[y0, 0], [yMid, zMid], ...pts.slice(1)];
    }

    // 1. Lofted Spline Outer Body Shell (Ol from sael.net/parking) with wheel-arch cutouts
    const nx = 68;
    const M = 9;
    const R = 2 * M - 1;
    const xs = [];
    for (let i = 0; i <= nx; i++) {
      const t = i / nx;
      const s = t < 0.14 ? (t / 0.14) * 0.08 : t > 0.86 ? 0.92 + ((t - 0.86) / 0.14) * 0.08 : 0.08 + ((t - 0.14) / 0.72) * 0.84;
      xs.push(-2.1 + s * (2.185 - -2.1));
    }

    const gridPos = [];
    for (let i = 0; i <= nx; i++) {
      const x = xs[i];
      const prof = sampleStation(x);
      const col = new Array(R);
      for (let j = 0; j < M; j++) {
        const [y, z] = prof[j];
        col[M - 1 + j] = [x, y, z];
        col[M - 1 - j] = [x, y, -z];
      }
      gridPos.push(col);
    }

    // Polygonal SDF regions for windows, lights, bumpers & trim (Mr from sael.net/parking)
    const frontHeadlightPoly = [[1.95, 0.42], [1.95, 0.70], [2.15, 0.65], [2.16, 0.38]];
    const frontGrillePoly = [[2.06, 0.0], [2.06, 0.56], [2.19, 0.42], [2.19, 0.0]];
    const rearTaillightPoly = [[-2.07, 0.34], [-2.07, 0.70], [-1.85, 0.74], [-1.92, 0.34]];
    const rearDiffuserPoly = [[-2.11, 0.0], [-2.11, 0.64], [-1.98, 0.72], [-1.98, 0.0]];

    const classifyPoint = (x, y, z) => {
      const az = Math.abs(z);
      // Side windows, windshield & rear backlight
      const dSide = az > 0.45 ? polySDF(x, y, spec.sideWin) : 1;
      const dWind = y > 0.85 ? polySDF(x, az, spec.windshield) : 1;
      const dBack = y > 0.82 ? polySDF(x, az, spec.backlight) : 1;
      const dGlass = Math.min(dSide, dWind, dBack);
      if (dGlass < -0.015) return { part: 1, r: 0.08, g: 0.12, b: 0.17, recess: 0.014 };
      if (dGlass < 0.026) return { part: 3, r: 0.07, g: 0.08, b: 0.10, recess: 0.004 }; // Dark window frame / pillar outline

      // Front headlights
      if (x > 1.88 && y > 0.60 && y < 0.86 && polySDF(x, az, frontHeadlightPoly) < 0) {
        return { part: 4, r: 1.0, g: 0.97, b: 0.88, recess: 0.003 };
      }
      // Rear taillights & full-width LED tail bar
      if (x < -1.82 && y > 0.84 && y < 1.02 && (polySDF(x, az, rearTaillightPoly) < 0 || (x < -2.01 && y > 0.90 && y < 0.955 && az < 0.68))) {
        return { part: 5, r: 0.95, g: 0.14, b: 0.10, recess: 0.003 };
      }
      // Lower front grille, rear diffuser & lower rocker cladding
      const dFGrille = y < 0.62 ? polySDF(x, az, frontGrillePoly) : 1;
      const dRDiff = y < 0.56 ? polySDF(x, az, rearDiffuserPoly) : 1;
      if (dFGrille < 0 || dRDiff < 0 || y < 0.34) {
        return { part: 2, r: 0.12, g: 0.14, b: 0.16, recess: 0.006 };
      }
      // Delivery Van warm-ivory upper cargo panel with colored lower livery stripe
      if (spec.isVanLivery && x < 0.12 && x > -1.98 && y > 0.94 && y < 1.54 && az > 0.58) {
        return { part: 7, r: 0.96, g: 0.94, b: 0.90, recess: 0 };
      }
      return { part: 0, r: 1, g: 1, b: 1, recess: 0 };
    };

    // Apply window/grille surface recess along inward normal (similar to Ol in sael.net/parking)
    for (let i = 0; i <= nx; i++) {
      for (let j = 0; j < R; j++) {
        const [x, y, z] = gridPos[i][j];
        const info = classifyPoint(x, y, z);
        if (info.recess > 0) {
          const s = z >= 0 ? 1 : -1;
          gridPos[i][j][1] -= info.recess * 0.45;
          gridPos[i][j][2] -= s * info.recess * 0.85;
        }
      }
    }

    const bodyPositions = [];
    const bodyColors = [];
    const bodyParts = [];
    const bodyCarObj = [];
    const glassPositions = [];

    // Outward normal offset helper for separated solid cabin glass panels (windshield, side windows, rear backlight)
    const pushGlassTri = (p0, p1, p2) => {
      for (const p of [p0, p1, p2]) {
        const s = p[2] >= 0 ? 1 : -1;
        const ox = p[0] > 0.3 ? 0.005 : p[0] < -1.2 ? -0.005 : 0;
        const oy = p[1] > 1.05 ? 0.005 : 0.003;
        const oz = Math.abs(p[2]) > 0.35 ? s * 0.006 : 0;
        glassPositions.push(p[0] + ox, p[1] + oy, p[2] + oz);
      }
    };

    const pushBodyTri = (p0, p1, p2) => {
      const cx = (p0[0] + p1[0] + p2[0]) / 3;
      const cy = (p0[1] + p1[1] + p2[1]) / 3;
      const cz = (p0[2] + p1[2] + p2[2]) / 3;
      // Circular wheel-arch cutout (uArch[2] from sael.net/parking)
      if (Math.abs(cz) > 0.56) {
        const df = Math.hypot(cx - spec.archF, cy - SAEL_WHEEL_R);
        const dr = Math.hypot(cx - spec.archR, cy - SAEL_WHEEL_R);
        if (df < spec.archRad - 0.015 || dr < spec.archRad - 0.015) return;
      }
      const info = classifyPoint(cx, cy, cz);
      // Separate cabin window triangles into dedicated glassGeo (rendered with separate opaque 0x24303C carGlassMaterial),
      // while keeping a solid dark cabin backing shell (part 3) underneath on bodyGeo so the cabin is 100% sealed & non-see-through!
      if (info.part === 1) {
        pushGlassTri(p0, p1, p2);
      }
      const bodyPartId = info.part === 1 ? 3 : info.part;
      const br = info.part === 1 ? 0.08 : info.r;
      const bg = info.part === 1 ? 0.10 : info.g;
      const bb = info.part === 1 ? 0.13 : info.b;
      for (const p of [p0, p1, p2]) {
        bodyPositions.push(p[0], p[1], p[2]);
        bodyColors.push(br, bg, bb);
        bodyParts.push(bodyPartId);
        bodyCarObj.push(p[0], p[1], p[2]);
      }
    };

    // Counter-clockwise outward triangle winding:
    // Because j goes from top roof (prof[0]) down to bottom chassis (prof[8]) on the +Z side,
    // (p00, p11, p10) and (p00, p01, p11) produce 100% outward-pointing face normals!
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < R - 1; j++) {
        const p00 = gridPos[i][j];
        const p10 = gridPos[i + 1][j];
        const p01 = gridPos[i][j + 1];
        const p11 = gridPos[i + 1][j + 1];
        pushBodyTri(p00, p11, p10);
        pushBodyTri(p00, p01, p11);
      }
    }

    const loftedBodyGeo = new THREE.BufferGeometry();
    loftedBodyGeo.setAttribute('position', new THREE.Float32BufferAttribute(bodyPositions, 3));
    loftedBodyGeo.setAttribute('color', new THREE.Float32BufferAttribute(bodyColors, 3));
    loftedBodyGeo.setAttribute('aPart', new THREE.Float32BufferAttribute(bodyParts, 1));
    loftedBodyGeo.setAttribute('aCarObj', new THREE.Float32BufferAttribute(bodyCarObj, 3));
    loftedBodyGeo.computeVertexNormals();

    const glassGeo = new THREE.BufferGeometry();
    glassGeo.setAttribute('position', new THREE.Float32BufferAttribute(glassPositions, 3));
    glassGeo.computeVertexNormals();

    const parts = [loftedBodyGeo];

    // Solid enclosed underbody chassis slab so the lower body is 100% sealed from every angle
    const chassisSlab = new THREE.BoxGeometry(3.86, 0.14, 1.44);
    parts.push(tagCarPart(chassisSlab, 2, 0.10, 0.11, 0.13, 0.02, 0.29, 0));

    // 2. 3D Inner Wheel-Arch Fender Well Liners + Arch Lip Trim Rings (Jl from sael.net/parking)
    const buildWheelWell = (ax, zSign) => {
      const segs = 22;
      const rIn = 0.24;
      const rOut = spec.archRad + 0.025;
      const zOut = zSign * 0.875;
      const zIn = zSign * 0.54;
      const wellPos = [];
      const addQuad = (a, b, c, d) => {
        if (zSign > 0) {
          wellPos.push(...a, ...b, ...c, ...a, ...c, ...d);
        } else {
          wellPos.push(...a, ...c, ...b, ...a, ...d, ...c);
        }
      };
      for (let i = 0; i < segs; i++) {
        const a0 = -0.18 + (i / segs) * (Math.PI + 0.36);
        const a1 = -0.18 + ((i + 1) / segs) * (Math.PI + 0.36);
        const c0 = Math.cos(a0), s0 = Math.sin(a0);
        const c1 = Math.cos(a1), s1 = Math.sin(a1);
        const pO0 = [ax + c0 * rOut, SAEL_WHEEL_R + s0 * rOut, zOut];
        const pO1 = [ax + c1 * rOut, SAEL_WHEEL_R + s1 * rOut, zOut];
        const pI0 = [ax + c0 * rOut, SAEL_WHEEL_R + s0 * rOut, zIn];
        const pI1 = [ax + c1 * rOut, SAEL_WHEEL_R + s1 * rOut, zIn];
        const pB0 = [ax + c0 * rIn, SAEL_WHEEL_R + s0 * rIn, zIn];
        const pB1 = [ax + c1 * rIn, SAEL_WHEEL_R + s1 * rIn, zIn];
        addQuad(pO0, pO1, pI1, pI0);
        addQuad(pI0, pI1, pB1, pB0);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(wellPos, 3));
      parts.push(tagCarPart(g, 2, 0.08, 0.09, 0.11));

      // Dark Storybook Ink Outline Fender Flare Arch Rim
      const lipPos = [];
      const rLip0 = spec.archRad - 0.012;
      const rLip1 = spec.archRad + 0.032;
      const zLip = zSign * 0.892;
      for (let i = 0; i < segs; i++) {
        const a0 = -0.08 + (i / segs) * (Math.PI + 0.16);
        const a1 = -0.08 + ((i + 1) / segs) * (Math.PI + 0.16);
        const c0 = Math.cos(a0), s0 = Math.sin(a0);
        const c1 = Math.cos(a1), s1 = Math.sin(a1);
        const p0 = [ax + c0 * rLip0, SAEL_WHEEL_R + s0 * rLip0, zLip];
        const p1 = [ax + c1 * rLip0, SAEL_WHEEL_R + s1 * rLip0, zLip];
        const p2 = [ax + c1 * rLip1, SAEL_WHEEL_R + s1 * rLip1, zLip];
        const p3 = [ax + c0 * rLip1, SAEL_WHEEL_R + s0 * rLip1, zLip];
        if (zSign > 0) lipPos.push(...p0, ...p1, ...p2, ...p0, ...p2, ...p3);
        else lipPos.push(...p0, ...p2, ...p1, ...p0, ...p3, ...p2);
      }
      const lipGeo = new THREE.BufferGeometry();
      lipGeo.setAttribute('position', new THREE.Float32BufferAttribute(lipPos, 3));
      parts.push(tagCarPart(lipGeo, 3, 0.09, 0.10, 0.12));
    };

    for (const ax of [spec.archF, spec.archR]) {
      buildWheelWell(ax, 1);
      buildWheelWell(ax, -1);
    }

    // 3. Exterior Details from sael.net/parking (Er & tc):
    //    Side Mirrors, Door Handles, Wipers, Shark-Fin Antenna, Spoiler, Grille Slats, LED Bars & License Plates
    const [mx, my, mz] = spec.mirrorPos;
    for (const zSign of [-1, 1]) {
      // Mirror stalk
      const stalk = roundedBox(0.07, 0.038, 0.11, 0.01);
      stalk.rotateX(zSign * 0.22);
      parts.push(tagCarPart(stalk, 3, 0.10, 0.11, 0.13, mx, my, zSign * (mz + 0.04)));
      // Body-colored aerodynamic mirror cap
      const cap = roundedBox(0.14, 0.095, 0.16, 0.028);
      parts.push(tagCarPart(cap, 0, 1, 1, 1, mx - 0.02, my + 0.028, zSign * (mz + 0.12)));
      // Reflective mirror glass face
      const glass = new THREE.BoxGeometry(0.015, 0.072, 0.125);
      parts.push(tagCarPart(glass, 6, 0.85, 0.89, 0.95, mx - 0.088, my + 0.028, zSign * (mz + 0.12)));

      // Flush Door Handles (front & rear doors)
      for (const hx of spec.handlesX) {
        const hRecess = new THREE.BoxGeometry(0.17, 0.042, 0.022);
        parts.push(tagCarPart(hRecess, 3, 0.08, 0.09, 0.11, hx, spec.handleY, zSign * 0.875));
        const hBar = roundedBox(0.16, 0.032, 0.036, 0.01);
        parts.push(tagCarPart(hBar, 0, 1, 1, 1, hx, spec.handleY, zSign * 0.892));
      }
    }

    // Front Windshield Wipers & Rear Wiper
    for (const wz of [-0.18, 0.18]) {
      const wiper = new THREE.BoxGeometry(0.03, 0.022, 0.42);
      wiper.rotateY(0.18);
      parts.push(tagCarPart(wiper, 3, 0.08, 0.09, 0.11, spec.wiperX, spec.wiperY, wz));
    }
    if (!spec.isVanLivery) {
      // Shark-fin roof antenna
      const fin = roundedBox(0.18, 0.09, 0.05, 0.015);
      const finY = type === 'sedan' ? 1.35 : 1.47;
      const finX = type === 'sedan' ? -0.95 : -1.52;
      parts.push(tagCarPart(fin, 3, 0.09, 0.10, 0.12, finX, finY, 0));
    }

    // Roof Rails for SUV & Delivery Van
    if (spec.hasRoofRails) {
      const railY = spec.isVanLivery ? 1.67 : 1.48;
      const railLen = spec.isVanLivery ? 2.45 : 1.95;
      const railX = spec.isVanLivery ? -0.55 : -0.52;
      for (const zSign of [-1, 1]) {
        const rail = roundedBox(railLen, 0.042, 0.048, 0.012);
        parts.push(tagCarPart(rail, 3, 0.10, 0.11, 0.14, railX, railY, zSign * 0.56));
      }
    }

    // Rear Roof Spoiler (SUV) or Trunk Lip Spoiler (Sedan)
    if (spec.hasSpoiler === 'roof') {
      const spWing = roundedBox(0.28, 0.048, 1.18, 0.015);
      spWing.rotateZ(0.08);
      parts.push(tagCarPart(spWing, 0, 1, 1, 1, -1.82, 1.435, 0));
      const spEdge = new THREE.BoxGeometry(0.06, 0.032, 1.18);
      parts.push(tagCarPart(spEdge, 3, 0.09, 0.10, 0.12, -1.94, 1.435, 0));
    } else if (spec.hasSpoiler === 'lip') {
      const lip = roundedBox(0.14, 0.045, 1.16, 0.012);
      parts.push(tagCarPart(lip, 3, 0.09, 0.10, 0.12, -1.96, 0.95, 0));
    }

    // Front Grille Slats, Lower Intake & Front/Rear License Plates (Ql from sael.net/parking)
    for (let k = 0; k < 3; k++) {
      const slat = new THREE.BoxGeometry(0.04, 0.022, 0.88 - k * 0.06);
      parts.push(tagCarPart(slat, 3, 0.08, 0.09, 0.11, 2.155, 0.42 + k * 0.065, 0));
    }
    // Front & Rear License Plates (#F4F1E8 with dark bezel)
    parts.push(tagCarPart(new THREE.BoxGeometry(0.03, 0.12, 0.44), 3, 0.09, 0.10, 0.12, 2.172, 0.43, 0));
    parts.push(tagCarPart(new THREE.BoxGeometry(0.036, 0.095, 0.40), 7, 0.95, 0.93, 0.89, 2.176, 0.43, 0));
    parts.push(tagCarPart(new THREE.BoxGeometry(0.03, 0.12, 0.44), 3, 0.09, 0.10, 0.12, -2.065, 0.64, 0));
    parts.push(tagCarPart(new THREE.BoxGeometry(0.036, 0.095, 0.40), 7, 0.95, 0.93, 0.89, -2.070, 0.64, 0));

    // Extruded Warm-White LED DRL Headlight Lenses, Amber Indicators & Ruby-Red Taillight Lenses
    for (const zSign of [-1, 1]) {
      const hl = roundedBox(0.14, 0.085, 0.26, 0.02);
      parts.push(tagCarPart(hl, 4, 1.0, 0.97, 0.88, 2.08, 0.72, zSign * 0.55));
      const drl = new THREE.BoxGeometry(0.15, 0.028, 0.28);
      parts.push(tagCarPart(drl, 4, 1.0, 0.98, 0.92, 2.095, 0.76, zSign * 0.55));
      const fTurn = new THREE.BoxGeometry(0.12, 0.026, 0.14);
      parts.push(tagCarPart(fTurn, 8, 1.0, 0.65, 0.20, 2.09, 0.66, zSign * 0.62));

      const tl = roundedBox(0.12, 0.095, 0.32, 0.02);
      parts.push(tagCarPart(tl, 5, 0.95, 0.14, 0.10, -2.02, 0.92, zSign * 0.54));
      const rTurn = new THREE.BoxGeometry(0.11, 0.028, 0.16);
      parts.push(tagCarPart(rTurn, 8, 1.0, 0.65, 0.20, -2.03, 0.86, zSign * 0.58));
    }
    // Full-width Rear LED Light Bar & High-Mount Third Brake Light
    parts.push(tagCarPart(new THREE.BoxGeometry(0.06, 0.034, 1.16), 5, 0.95, 0.14, 0.10, -2.035, 0.935, 0));

    // Delivery Van amber roof clearance lights
    if (spec.isVanLivery) {
      parts.push(tagCarPart(new THREE.BoxGeometry(0.06, 0.045, 0.52), 8, 1.0, 0.68, 0.22, 0.98, 1.63, 0));
    }

    const bodyGeo = mergeGeometries(parts, false);

    // Rotate -90 degrees around Y so +X_sael (front bumper) maps to +Z_ceria (forward in Ceria Town)
    // and +Z_sael maps to -X_ceria while preserving counter-clockwise winding and outward normals!
    bodyGeo.rotateY(-Math.PI / 2);
    glassGeo.rotateY(-Math.PI / 2);

    // 4. Automatic THREE.Box3 Scale & Ground-Contact Normalization:
    //    Assemble a complete reference THREE.Group (body + glass + 4 wheels at their axle positions),
    //    apply spec.scale, and measure with THREE.Box3 so the lowest point of the tires sits at y = 0.000!
    const wheelGeo = createDetailedWheelGeo();
    const s = spec.scale;
    bodyGeo.scale(s, s, s);
    glassGeo.scale(s, s, s);

    const wheelOffsets = [
      // Front-Left (+X in Ceria Town), Front-Right (-X), Rear-Left (+X), Rear-Right (-X)
      { name: 'wheel_fl', lx: spec.wheelTrack * s, y: SAEL_WHEEL_R * s, lz: spec.archF * s, isFront: true },
      { name: 'wheel_fr', lx: -spec.wheelTrack * s, y: SAEL_WHEEL_R * s, lz: spec.archF * s, isFront: true },
      { name: 'wheel_rl', lx: spec.wheelTrack * s, y: SAEL_WHEEL_R * s, lz: spec.archR * s, isFront: false },
      { name: 'wheel_rr', lx: -spec.wheelTrack * s, y: SAEL_WHEEL_R * s, lz: spec.archR * s, isFront: false }
    ];

    const refBodyMat = new THREE.MeshStandardMaterial({
      color: colorPalette[0] || '#4a7c9b',
      vertexColors: true,
      roughness: 0.35,
      metalness: 0.15,
      transparent: false,
      opacity: 1.0,
      depthWrite: true,
      depthTest: true,
      side: THREE.DoubleSide
    });
    const refGlassMat = new THREE.MeshStandardMaterial({
      color: 0x24303c,
      roughness: 0.12,
      metalness: 0.6,
      transparent: false,
      opacity: 1.0,
      depthWrite: true,
      depthTest: true,
      side: THREE.DoubleSide
    });

    const carGroup = new THREE.Group();
    const bodyMesh = new THREE.Mesh(bodyGeo, refBodyMat);
    bodyMesh.name = 'body';
    const glassMesh = new THREE.Mesh(glassGeo, refGlassMat);
    glassMesh.name = 'glass';
    carGroup.add(bodyMesh, glassMesh);
    for (const wo of wheelOffsets) {
      const wm = new THREE.Mesh(wheelGeo, refBodyMat);
      wm.name = wo.name;
      wm.position.set(wo.lx, wo.y, wo.lz);
      wm.scale.setScalar(s);
      carGroup.add(wm);
    }
    const box = new THREE.Box3().setFromObject(carGroup);
    const yShift = -box.min.y;
    if (Math.abs(yShift) > 1e-6) {
      bodyGeo.translate(0, yShift, 0);
      glassGeo.translate(0, yShift, 0);
      for (const wo of wheelOffsets) wo.y += yShift;
    }

    // Recompute smooth outward vertex normals after all positive transforms
    bodyGeo.computeVertexNormals();
    glassGeo.computeVertexNormals();

    // Add depth-safe EdgesGeometry contour lines on the reference carGroup
    const outlineMat = new THREE.LineBasicMaterial({
      color: 0x181c22,
      transparent: false,
      opacity: 1.0,
      depthTest: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    });
    const outlineEdges = new THREE.LineSegments(new THREE.EdgesGeometry(bodyGeo, 28), outlineMat);
    outlineEdges.name = 'outline';
    carGroup.add(outlineEdges);

    const wheelRadius = SAEL_WHEEL_R * s;
    const halfLen = (box.max.z - box.min.z) * 0.5;
    const frontZ = box.max.z;
    const headlightSep = 0.55 * s;
    const trailY = 0.72 * s + yShift;

    return {
      type,
      colorPalette,
      group: carGroup,
      bodyGeo,
      glassGeo,
      wheelGeo,
      wheelOffsets,
      wheelScale: s,
      wheelRadius,
      halfLen,
      frontZ,
      headlightSep,
      trailY
    };
  }

  function makeCyclistGeo() {
    const parts = [];
    const push = (g, r, gr, bl, x, y, z) => {
      let partId = 9;
      if (r === 1 && gr === 1 && bl === 1) partId = 0; // Cozy Sweater colored by instanceColor (bikePalette)
      else if (r > 2 && gr > 1) partId = 4; // Warm-white bike headlamp
      else if (r > 2 && gr < 1) partId = 5; // Red rear reflector
      else if (r > 0.75 && gr > 0.78 && bl > 0.82 && r < 0.92) partId = 6; // Silver rim & frame
      parts.push(tagCarPart(g, partId, r, gr, bl, x, y, z));
    };
    // 1.62x Bicycle Wheels (r = 0.18 at y = 0.18 -> tire bottom 100% flush at y = 0.000!) + Silver Rims
    const wheel = new THREE.CylinderGeometry(0.18, 0.18, 0.045, 12).toNonIndexed();
    wheel.rotateZ(Math.PI / 2);
    const rim = new THREE.CylinderGeometry(0.12, 0.12, 0.05, 10).toNonIndexed();
    rim.rotateZ(Math.PI / 2);
    for (const wz of [0.31, -0.31]) {
      push(wheel, 0.16, 0.18, 0.20, 0, 0.18, wz);
      push(rim, 0.78, 0.82, 0.86, 0, 0.18, wz);
    }
    // Diamond bicycle frame, handlebars (y = 0.58), & saddle (y = 0.50) matching 1.60x NPC hip/leg height
    push(roundedBox(0.065, 0.24, 0.62, 0.02), 0.86, 0.89, 0.94, 0, 0.32, 0);
    push(solid(new THREE.BoxGeometry(0.05, 0.28, 0.05)), 0.22, 0.25, 0.30, 0, 0.44, 0.24);
    push(solid(new THREE.BoxGeometry(0.38, 0.042, 0.042)), 0.22, 0.25, 0.30, 0, 0.58, 0.25);
    push(roundedBox(0.11, 0.045, 0.16, 0.015), 0.20, 0.22, 0.25, 0, 0.50, -0.10);

    // Cozy Chibi Cyclist Rider (Raka & Kamu Proportions):
    // 1. Separate Denim Trousers Legs (#4A647C) + Warm Skin Ankles + White/Cream Sneakers (#F5EFE6) on Pedals
    const legCyl = solid(new THREE.CylinderGeometry(0.048, 0.042, 0.26, 8));
    push(legCyl, 0.08, 0.14, 0.22, -0.072, 0.36, -0.02);
    push(legCyl, 0.08, 0.14, 0.22,  0.072, 0.36,  0.02);
    const shoeG = roundedBox(0.076, 0.055, 0.135, 0.022);
    push(shoeG, 0.92, 0.88, 0.82, -0.072, 0.21, 0.01);
    push(shoeG, 0.92, 0.88, 0.82,  0.072, 0.21, 0.05);
    // 2. Pelvis, Cozy Rounded Sweater Torso ([1,1,1] instance color) & Cream Collar Ring (#FFF8E7) + Warm Skin Neck
    push(roundedBox(0.23, 0.11, 0.16, 0.035), 0.08, 0.14, 0.22, 0, 0.51, -0.08);
    push(roundedBox(0.26, 0.33, 0.18, 0.065), 1, 1, 1, 0, 0.67, -0.05);
    const collarG = solid(new THREE.TorusGeometry(0.066, 0.020, 7, 12));
    collarG.rotateX(Math.PI * 0.5);
    push(collarG, 0.98, 0.94, 0.82, 0, 0.825, -0.03);
    push(solid(new THREE.CylinderGeometry(0.046, 0.052, 0.06, 8)), 0.96, 0.72, 0.48, 0, 0.845, -0.02);
    // 3. Rounded Sweater Arms + Cream Cuffs + Spherical Warm Skin Hands Gripping Handlebars
    const armCyl = solid(new THREE.CylinderGeometry(0.038, 0.032, 0.26, 8));
    armCyl.rotateX(Math.PI * 0.38);
    push(armCyl, 1, 1, 1, -0.15, 0.68, 0.07);
    push(armCyl, 1, 1, 1,  0.15, 0.68, 0.07);
    const handSph = solid(new THREE.SphereGeometry(0.036, 7, 6));
    push(handSph, 0.96, 0.72, 0.48, -0.15, 0.59, 0.22);
    push(handSph, 0.96, 0.72, 0.48,  0.15, 0.59, 0.22);
    // 4. Cozy Chibi Round Head (#FFE0BD) + 2 Glossy Black Dot Eyes (+ White Sparkle) + 2 Pink Oval Cheek Blushes (#F08A84)
    push(solid(new THREE.SphereGeometry(0.118, 12, 10)), 0.96, 0.72, 0.48, 0, 0.935, 0.0);
    const eyeSph = solid(new THREE.SphereGeometry(0.016, 7, 6));
    eyeSph.scale(1.0, 1.15, 0.65);
    push(eyeSph, 0.02, 0.02, 0.03, -0.044, 0.946, 0.116);
    push(eyeSph, 0.02, 0.02, 0.03,  0.044, 0.946, 0.116);
    const shineSph = solid(new THREE.SphereGeometry(0.006, 5, 5));
    push(shineSph, 0.99, 0.99, 0.99, -0.038, 0.953, 0.125);
    push(shineSph, 0.99, 0.99, 0.99,  0.050, 0.953, 0.125);
    const blushSph = solid(new THREE.SphereGeometry(0.022, 7, 6));
    blushSph.scale(1.35, 0.72, 0.42);
    push(blushSph, 0.86, 0.26, 0.24, -0.068, 0.916, 0.108);
    push(blushSph, 0.86, 0.26, 0.24,  0.068, 0.916, 0.108);
    // 5. Voluminous Espresso-Brown Hair (#4A2E1B): Crown Cap + Rounded Front Bangs + Back Hair + Rear Bun
    push(solid(new THREE.SphereGeometry(0.126, 12, 9, 0, Math.PI * 2, 0, Math.PI * 0.62)), 0.075, 0.032, 0.014, 0, 0.948, -0.006);
    const bangsG = roundedBox(0.205, 0.068, 0.088, 0.032);
    bangsG.rotateX(0.18);
    push(bangsG, 0.075, 0.032, 0.014, 0, 0.996, 0.095);
    push(roundedBox(0.225, 0.145, 0.115, 0.048), 0.075, 0.032, 0.014, 0, 0.912, -0.072);
    push(solid(new THREE.SphereGeometry(0.052, 8, 7)), 0.075, 0.032, 0.014, 0, 0.935, -0.145);

    // Front warm-white bike headlamp & rear red reflector
    push(solid(new THREE.BoxGeometry(0.07, 0.06, 0.04)), 3.2, 2.8, 1.8, 0, 0.46, 0.34);
    push(solid(new THREE.BoxGeometry(0.07, 0.06, 0.04)), 2.8, 0.3, 0.2, 0, 0.40, -0.36);
    return mergeGeometries(parts, false);
  }

  // Headlight Beam Cone Texture projected onto the asphalt surface at y = 0.08
  const headlightBeamTex = (() => {
    const W = 128, H = 256;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d');

    const drawCone = cx => {
      const grad = ctx.createLinearGradient(cx, H, cx, 0);
      grad.addColorStop(0.0, 'rgba(255, 244, 204, 0.85)');
      grad.addColorStop(0.28, 'rgba(255, 236, 178, 0.48)');
      grad.addColorStop(0.72, 'rgba(255, 228, 155, 0.14)');
      grad.addColorStop(1.0, 'rgba(255, 224, 140, 0.0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(cx - 8, H - 4);
      ctx.lineTo(cx + 8, H - 4);
      ctx.lineTo(cx + 34, 4);
      ctx.lineTo(cx - 34, 4);
      ctx.closePath();
      ctx.fill();
    };
    drawCone(W * 0.32);
    drawCone(W * 0.68);

    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();

  // --------------------------------------------------------------------------
  // 6. SPAWN VEHICLES & INTELLIGENT DRIVER MODEL (IDM) + TURNING SIMULATION
  // --------------------------------------------------------------------------
  const carPalette = [
    '#e06d44', '#498467', '#eab308', '#4a7c9b', '#d97706',
    '#b85a4c', '#e6dfd5', '#688f4e', '#3b82f6', '#8e6343'
  ];
  const suvPalette = ['#3b6e8c', '#587d5a', '#c86446', '#d49b35', '#64748b', '#7c5d46'];
  const busPalette = ['#f59e0b', '#10b981', '#ef4444', '#0ea5e9'];
  const bikePalette = ['#FF7F50', '#FFF8E7', '#F4C430', '#9DC183', '#E8A598', '#89CFF0', '#C3B1E1'];

  // Instantiate the 3 Reverse-Engineered Vehicle Blueprints ('sedan', 'suv', 'van')
  const sedanBlueprint = createDetailedCar('sedan', carPalette);
  const suvBlueprint = createDetailedCar('suv', suvPalette);
  const vanBlueprint = createDetailedCar('van', busPalette);
  const makeVehicleWheels = bp =>
    bp.wheelOffsets.map(wo => ({
      name: wo.name,
      lx: wo.lx,
      y: wo.y,
      lz: wo.lz,
      isFront: wo.isFront,
      rotation: { x: 0, y: 0, z: 0 }
    }));

  const S_MIN = LINES[0] - 4.0;
  const S_MAX = LINES[LINES.length - 1] + 4.0;
  const S_SPAN = S_MAX - S_MIN;

  const carAgents = [];
  const suvAgents = [];
  const busAgents = [];
  const bikeAgents = [];
  const allVehicles = [];

  // Superblock & Closed Road Segment helper functions:
  // 1) N-S road at roadIdx === 3 (x = 2 * PITCH) between z = 0 (iz = 1) and z = PITCH (iz = 2)
  //    is closed for the toko6 (Apex Sport) + Outdoor Tennis Court + Adjacent Building Superblock.
  // 2) N-S road at roadIdx === 2 (x = 1 * PITCH) between z = PITCH (iz = 2) and z = 2 * PITCH (iz = 3)
  //    is closed for the Mayor's Office + Central Park Unified Civic Superblock.
  // 3) E-W road at roadIdx === 0 (z = -1 * PITCH) between x = 2 * PITCH (ix = 3) and x = 3 * PITCH (ix = 4)
  //    is closed for the toko5 (Strawberry Corner) + Contemporary Urban Pocket Park + Taman Kota Superblock.
  const isClosedRoadPos = (axis, roadIdx, s) =>
    (axis === 1 &&
      ((roadIdx === 3 && s > -3.9 && s < PITCH + 3.9) ||
        (roadIdx === 2 && s > PITCH - 3.9 && s < 2 * PITCH + 3.9))) ||
    (axis === 0 && roadIdx === 0 && s > 2 * PITCH - 3.9 && s < 3 * PITCH + 3.9);
  const wouldEnterClosedRoad = (newAxis, newRoadIdx, newDir, exitS) =>
    (newAxis === 1 &&
      ((newRoadIdx === 3 &&
        ((newDir > 0 && exitS >= -1.0 && exitS < PITCH) || (newDir < 0 && exitS <= PITCH + 1.0 && exitS > 0))) ||
        (newRoadIdx === 2 &&
          ((newDir > 0 && exitS >= PITCH - 1.0 && exitS < 2 * PITCH) ||
            (newDir < 0 && exitS <= 2 * PITCH + 1.0 && exitS > PITCH))))) ||
    (newAxis === 0 &&
      newRoadIdx === 0 &&
      ((newDir > 0 && exitS >= 2 * PITCH - 1.0 && exitS < 3 * PITCH) ||
        (newDir < 0 && exitS <= 3 * PITCH + 1.0 && exitS > 2 * PITCH)));

  LANES.forEach((roadCoord, li) => {
    for (const axis of [0, 1]) {
      for (const dir of [-1, 1]) {
        // Spawn 2 well-spaced motor vehicles per lane direction (Sedan/Coupe + SUV/Hatchback or Delivery Van)
        // so vehicles have > 1.7x safe following distance and never queue-spill across intersections!
        const totalMotor = 2;
        const hasTruck = (li + axis + (dir > 0 ? 1 : 0)) % 2 === 0;

        for (let slot = 0; slot < totalMotor; slot++) {
          let s = S_MIN + ((slot + 0.18 + random() * 0.24) / totalMotor) * S_SPAN;
          if (isClosedRoadPos(axis, li, s)) {
            s =
              axis === 0
                ? dir > 0
                  ? 2 * PITCH - 6.4 - slot * 6.8
                  : 2 * PITCH - 5.4 - slot * 6.8
                : li === 3
                  ? dir > 0
                    ? PITCH + 5.4 + slot * 6.8
                    : -5.4 - slot * 6.8
                  : dir > 0
                    ? 2 * PITCH + 5.4 + slot * 6.8
                    : PITCH - 5.4 - slot * 6.8;
          }
          if (slot === 1 && hasTruck) {
            const b = {
              kind: 'bus',
              carType: 'van',
              axis,
              roadIdx: li,
              roadCoord,
              dir,
              s,
              speed: 3.3,
              maxSpeed: 4.0 + random() * 0.4,
              halfLen: vanBlueprint.halfLen,
              frontZ: vanBlueprint.frontZ,
              headlightSep: vanBlueprint.headlightSep,
              trailY: vanBlueprint.trailY,
              wheelRadius: vanBlueprint.wheelRadius,
              wheelScale: vanBlueprint.wheelScale,
              wheels: makeVehicleWheels(vanBlueprint),
              minGap: 1.08,
              latOffset: 0.90,
              color: new THREE.Color(busPalette[(li + axis) % busPalette.length]),
              turning: null,
              intentTurn: 0,
              intentInterIdx: -1,
              turnSignal: 0,
              lastTurnInter: -1,
              braking: false,
              x: 0,
              z: 0,
              ry: 0
            };
            busAgents.push(b);
            allVehicles.push(b);
          } else if (slot === 1) {
            const sv = {
              kind: 'suv',
              carType: 'suv',
              axis,
              roadIdx: li,
              roadCoord,
              dir,
              s,
              speed: 3.5 + random() * 0.8,
              maxSpeed: 4.4 + random() * 0.6,
              halfLen: suvBlueprint.halfLen,
              frontZ: suvBlueprint.frontZ,
              headlightSep: suvBlueprint.headlightSep,
              trailY: suvBlueprint.trailY,
              wheelRadius: suvBlueprint.wheelRadius,
              wheelScale: suvBlueprint.wheelScale,
              wheels: makeVehicleWheels(suvBlueprint),
              minGap: 0.96,
              latOffset: 0.90,
              color: new THREE.Color(suvPalette[(slot + li * 2 + axis) % suvPalette.length]),
              turning: null,
              intentTurn: 0,
              intentInterIdx: -1,
              turnSignal: 0,
              lastTurnInter: -1,
              braking: false,
              x: 0,
              z: 0,
              ry: 0
            };
            suvAgents.push(sv);
            allVehicles.push(sv);
          } else {
            const v = {
              kind: 'car',
              carType: 'sedan',
              axis,
              roadIdx: li,
              roadCoord,
              dir,
              s,
              speed: 3.6 + random() * 1.0,
              maxSpeed: 4.6 + random() * 0.8,
              halfLen: sedanBlueprint.halfLen,
              frontZ: sedanBlueprint.frontZ,
              headlightSep: sedanBlueprint.headlightSep,
              trailY: sedanBlueprint.trailY,
              wheelRadius: sedanBlueprint.wheelRadius,
              wheelScale: sedanBlueprint.wheelScale,
              wheels: makeVehicleWheels(sedanBlueprint),
              minGap: 0.88,
              latOffset: 0.90,
              color: new THREE.Color(carPalette[(slot * 3 + li + axis * 2) % carPalette.length]),
              turning: null,
              intentTurn: 0,
              intentInterIdx: -1,
              turnSignal: 0,
              lastTurnInter: -1,
              braking: false,
              x: 0,
              z: 0,
              ry: 0
            };
            carAgents.push(v);
            allVehicles.push(v);
          }
        }

        for (let k = 0; k < 2; k++) {
          let s = S_MIN + ((k + 0.18 + random() * 0.26) / 2) * S_SPAN;
          if (isClosedRoadPos(axis, li, s)) {
            s =
              axis === 0
                ? dir > 0
                  ? 2 * PITCH - 6.4 - k * 5.8
                  : 2 * PITCH - 5.4 - k * 5.8
                : li === 3
                  ? dir > 0
                    ? PITCH + 5.4 + k * 5.8
                    : -5.4 - k * 5.8
                  : dir > 0
                    ? 2 * PITCH + 5.4 + k * 5.8
                    : PITCH - 5.4 - k * 5.8;
          }
          const bk = {
            kind: 'bike',
            axis,
            roadIdx: li,
            roadCoord,
            dir,
            s,
            speed: 2.35,
            maxSpeed: 2.55 + random() * 0.4,
            halfLen: 0.50,
            minGap: 0.68,
            latOffset: 2.12,
            color: new THREE.Color(bikePalette[(k + li + axis) % bikePalette.length]),
            turning: null,
            intentTurn: 0,
            intentInterIdx: -1,
            turnSignal: 0,
            lastTurnInter: -1,
            braking: false,
            x: 0,
            z: 0,
            ry: 0
          };
          bikeAgents.push(bk);
          allVehicles.push(bk);
        }
      }
    }
  });

  // 1. 100% SOLID OPAQUE Car Body, Chassis, Bumper, Alloy Rim & Tire Material (vMat / carBodyMaterial):
  //    Explicitly enforces transparent: false, opacity: 1.0, depthWrite: true, depthTest: true, side: THREE.DoubleSide!
  const uCarNight = { value: 0.25 };
  const vMat = patch(
    new THREE.MeshStandardMaterial({
      color: '#ffffff',
      vertexColors: true,
      roughness: 0.35,
      metalness: 0.15,
      transparent: false,
      opacity: 1.0,
      depthWrite: true,
      depthTest: true,
      side: THREE.DoubleSide
    }),
    worldTone,
    Object.assign(
      s => {
        s.uniforms.uCarNight = uCarNight;
        s.vertexShader = s.vertexShader
          .replace(
            '#include <common>',
            '#include <common>\nattribute float aPart;\nattribute vec3 aCarObj;\nvarying float vPart;\nvarying vec3 vCarObj;\nvarying vec3 vRawVertCol;'
          )
          .replace(
            '#include <color_vertex>',
            '#include <color_vertex>\nvPart = aPart;\nvCarObj = aCarObj;\nvRawVertCol = color.rgb;'
          );
        s.fragmentShader = s.fragmentShader
          .replace(
            '#include <common>',
            `#include <common>
            uniform float uCarNight;
            varying float vPart;
            varying vec3 vCarObj;
            varying vec3 vRawVertCol;
            float carSeamD(vec3 p) {
              float az = abs(p.z), d = 10.0;
              if (az > 0.72 && p.y > 0.31 && p.y < 1.00) {
                d = min(d, abs(p.x - 0.78));
                d = min(d, abs(p.x + 0.22));
                d = min(d, abs(p.x + 1.16));
              }
              if (az > 0.78 && p.x > -1.16 && p.x < 0.78) d = min(d, abs(p.y - 0.32));
              if (az < 0.65 && p.y > 0.56) d = min(d, abs(p.x - 1.98));
              if (p.x > 0.96 && p.x < 1.98 && p.y > 0.60) d = min(d, abs(az - 0.64));
              if (az < 0.62 && p.y > 0.38 && p.y < 1.34) d = min(d, abs(p.x + 1.97));
              if (p.x < -1.85 && p.y > 0.42 && p.y < 0.96) d = min(d, abs(az - 0.58));
              if (p.x > -1.55 && p.x < 0.50 && p.y > 1.24) d = min(d, abs(az - 0.56));
              return d;
            }`
          )
          .replace(
            '#include <color_fragment>',
            `#include <color_fragment>
            if (vPart < 0.5) {
              float sd = carSeamD(vCarObj);
              float seam = 1.0 - smoothstep(0.005, 0.016, sd);
              diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.06, 0.07, 0.09), seam * 0.78);
            } else if (vPart < 1.5) {
              diffuseColor.rgb = vec3(0.141, 0.188, 0.235);
            } else if (vPart < 2.5) {
              diffuseColor.rgb = vec3(0.12, 0.135, 0.16);
            } else if (vPart < 3.5) {
              diffuseColor.rgb = vec3(0.065, 0.075, 0.095);
            } else if (vPart < 4.5) {
              diffuseColor.rgb = vec3(1.0, 0.97, 0.88);
            } else if (vPart < 5.5) {
              diffuseColor.rgb = vec3(0.95, 0.14, 0.10);
            } else if (vPart < 6.5) {
              diffuseColor.rgb = vRawVertCol;
            } else if (vPart < 7.5) {
              diffuseColor.rgb = vec3(0.95, 0.93, 0.89);
              float sd = carSeamD(vCarObj);
              float seam = 1.0 - smoothstep(0.005, 0.016, sd);
              diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.10, 0.11, 0.14), seam * 0.65);
            } else if (vPart < 8.5) {
              diffuseColor.rgb = vec3(1.0, 0.64, 0.18);
            } else {
              diffuseColor.rgb = vRawVertCol;
            }
            diffuseColor.a = 1.0;`
          )
          .replace(
            '#include <roughnessmap_fragment>',
            `#include <roughnessmap_fragment>
            if (vPart < 0.5) roughnessFactor = 0.35;
            else if (vPart < 1.5) roughnessFactor = 0.12;
            else if (vPart < 2.5) roughnessFactor = 0.78;
            else if (vPart < 3.5) roughnessFactor = 0.36;
            else if (vPart > 5.5 && vPart < 6.5) roughnessFactor = 0.22;
            else if (vPart > 6.5 && vPart < 7.5) roughnessFactor = 0.38;`
          )
          .replace(
            '#include <metalnessmap_fragment>',
            `#include <metalnessmap_fragment>
            if (vPart < 0.5) metalnessFactor = 0.15;
            else if (vPart < 1.5) metalnessFactor = 0.60;
            else if (vPart < 2.5) metalnessFactor = 0.06;
            else if (vPart > 5.5 && vPart < 6.5) metalnessFactor = 0.82;`
          )
          .replace(
            '#include <emissivemap_fragment>',
            `#include <emissivemap_fragment>
            float glowBoost = 0.55 + 0.95 * uCarNight;
            if (vPart > 3.5 && vPart < 4.5) {
              totalEmissiveRadiance += vec3(3.1, 2.65, 1.85) * glowBoost;
            } else if (vPart > 4.5 && vPart < 5.5) {
              totalEmissiveRadiance += vec3(2.85, 0.24, 0.15) * glowBoost;
            } else if (vPart > 7.5 && vPart < 8.5) {
              totalEmissiveRadiance += vec3(1.8, 1.0, 0.18) * glowBoost;
            }`
          );
      },
      { key: 'sael_detailed_car_solid' }
    )
  );

  // 2. SEPARATE SOLID REFLECTIVE CABIN WINDOW MATERIAL (carGlassMaterial):
  //    Uses dark glossy reflective finish (color: 0x24303C, roughness: 0.12, metalness: 0.6, transparent: false, opacity: 1.0)
  //    so cabin windows look sleek & reflective without ever leaking transparency or showing hollow interiors!
  const carGlassMaterial = patch(
    new THREE.MeshStandardMaterial({
      color: 0x24303c,
      roughness: 0.12,
      metalness: 0.6,
      transparent: false,
      opacity: 1.0,
      depthWrite: true,
      depthTest: true,
      side: THREE.DoubleSide
    }),
    worldTone
  );

  const carsMesh = new THREE.InstancedMesh(sedanBlueprint.bodyGeo, vMat, carAgents.length);
  const suvsMesh = new THREE.InstancedMesh(suvBlueprint.bodyGeo, vMat, suvAgents.length);
  const busesMesh = new THREE.InstancedMesh(vanBlueprint.bodyGeo, vMat, busAgents.length);
  const carsGlassMesh = new THREE.InstancedMesh(sedanBlueprint.glassGeo, carGlassMaterial, carAgents.length);
  const suvsGlassMesh = new THREE.InstancedMesh(suvBlueprint.glassGeo, carGlassMaterial, suvAgents.length);
  const busesGlassMesh = new THREE.InstancedMesh(vanBlueprint.glassGeo, carGlassMaterial, busAgents.length);
  const bikesMesh = new THREE.InstancedMesh(makeCyclistGeo(), vMat, bikeAgents.length);
  carsMesh.name = 'Vehicles_Sedans_Body';
  suvsMesh.name = 'Vehicles_SUVs_Body';
  busesMesh.name = 'Vehicles_Vans_Body';
  carsGlassMesh.name = 'Vehicles_Sedans_Glass';
  suvsGlassMesh.name = 'Vehicles_SUVs_Glass';
  busesGlassMesh.name = 'Vehicles_Vans_Glass';
  bikesMesh.name = 'Vehicles_Cyclists';
  carsMesh.castShadow = carsMesh.receiveShadow = true;
  suvsMesh.castShadow = suvsMesh.receiveShadow = true;
  busesMesh.castShadow = busesMesh.receiveShadow = true;
  carsGlassMesh.castShadow = carsGlassMesh.receiveShadow = true;
  suvsGlassMesh.castShadow = suvsGlassMesh.receiveShadow = true;
  busesGlassMesh.castShadow = busesGlassMesh.receiveShadow = true;
  bikesMesh.castShadow = bikesMesh.receiveShadow = true;

  carAgents.forEach((v, i) => carsMesh.setColorAt(i, v.color));
  suvAgents.forEach((v, i) => suvsMesh.setColorAt(i, v.color));
  busAgents.forEach((v, i) => busesMesh.setColorAt(i, v.color));
  bikeAgents.forEach((v, i) => bikesMesh.setColorAt(i, v.color));
  vehiclesGroup.add(carsMesh, suvsMesh, busesMesh, carsGlassMesh, suvsGlassMesh, busesGlassMesh, bikesMesh);

  // 4 Independent Rotating Wheels per Motor Vehicle (Grooved Radial Tires + 5-Spoke Alloy Rims)
  const motorVehicles = [...carAgents, ...suvAgents, ...busAgents];
  const wheelsMesh = new THREE.InstancedMesh(createDetailedWheelGeo(), vMat, motorVehicles.length * 4);
  wheelsMesh.name = 'Vehicles_Wheels';
  wheelsMesh.castShadow = wheelsMesh.receiveShadow = true;
  const whiteWheelCol = new THREE.Color('#ffffff');
  for (let i = 0; i < motorVehicles.length * 4; i++) {
    wheelsMesh.setColorAt(i, whiteWheelCol);
  }
  vehiclesGroup.add(wheelsMesh);

  // Headlight Beams projected on the asphalt at y = 0.08 (polygonOffset -2/-2, no shadow):
  // Rotated 180 degrees (Math.PI) around Y before translating +1.35 along +Z so the narrow bright origin
  // starts at the front bumper and the wide cone projects forward onto the road ahead of the hood!
  const beamGeo = new THREE.PlaneGeometry(1.24, 3.10).toNonIndexed();
  beamGeo.rotateX(-Math.PI / 2);
  beamGeo.rotateY(Math.PI);
  beamGeo.translate(0, 0, 1.55);
  const beamMat = new THREE.MeshBasicMaterial({
    map: headlightBeamTex,
    transparent: true,
    opacity: 0.42,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2
  });
  const headlightBeams = new THREE.InstancedMesh(beamGeo, beamMat, motorVehicles.length);
  headlightBeams.name = 'Vehicles_HeadlightBeams';
  headlightBeams.frustumCulled = false;
  headlightBeams.castShadow = false;
  headlightBeams.receiveShadow = false;
  vehiclesGroup.add(headlightBeams);

  // Shutter motion trails + Blinking Amber Turn Signals (polygonOffset -2/-2, no shadow)
  function makeTrailGeo() {
    const segs = 10;
    const g = new THREE.PlaneGeometry(0.08, 1, 1, segs).toNonIndexed();
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, -0.5);
    const pos = g.attributes.position;
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const a = Math.pow(1 + pos.getZ(i), 1.6);
      col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = a;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  }

  const trailMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.68,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2
  });
  // 6 instances per motor vehicle: 0,1 = front headlights; 2,3 = rear tail/brake lights; 4,5 = front & rear blinking amber turn signals
  const trails = new THREE.InstancedMesh(makeTrailGeo(), trailMat, motorVehicles.length * 6);
  trails.name = 'Vehicles_LightTrails';
  trails.frustumCulled = false;
  trails.castShadow = false;
  trails.receiveShadow = false;
  const headCol = new THREE.Color(1.35, 1.1, 0.7);
  const tailCol = new THREE.Color(1.5, 0.24, 0.14);
  const brakeCol = new THREE.Color(2.6, 0.28, 0.16);
  const blinkerCol = new THREE.Color(2.8, 1.65, 0.18);
  motorVehicles.forEach((_, i) => {
    trails.setColorAt(i * 6 + 0, headCol);
    trails.setColorAt(i * 6 + 1, headCol);
    trails.setColorAt(i * 6 + 2, tailCol);
    trails.setColorAt(i * 6 + 3, tailCol);
    trails.setColorAt(i * 6 + 4, blinkerCol);
    trails.setColorAt(i * 6 + 5, blinkerCol);
  });
  vehiclesGroup.add(trails);

  function laneWorldPose(axis, roadCoord, dir, s, latOffset) {
    if (axis === 1) {
      return [roadCoord - dir * latOffset, s, dir > 0 ? 0 : Math.PI];
    }
    return [s, roadCoord + dir * latOffset, dir > 0 ? Math.PI / 2 : -Math.PI / 2];
  }

  // Forward declaration so vehicles can yield to pedestrians actively crossing
  const pedAgents = [];

  function updateVehiclesSim(dt, shutter, simTime = 0) {
    const laneGroups = new Map();
    const addToLaneGroup = (laneKey, entry) => {
      if (!laneGroups.has(laneKey)) laneGroups.set(laneKey, []);
      laneGroups.get(laneKey).push(entry);
    };

    for (const v of allVehicles) {
      const bikeFlag = v.kind === 'bike' ? 1 : 0;
      if (v.turning) {
        const T = v.turning;
        if (T.u < 0.45) {
          addToLaneGroup(`${v.axis}_${v.roadIdx}_${v.dir}_${bikeFlag}`, {
            ref: v,
            s: T.entryS,
            halfLen: v.halfLen,
            speed: v.speed
          });
        }
        if (T.u >= 0.30) {
          addToLaneGroup(`${T.newAxis}_${T.newRoadIdx}_${T.newDir}_${bikeFlag}`, {
            ref: v,
            s: T.exitS,
            halfLen: v.halfLen,
            speed: v.speed
          });
        }
        continue;
      }
      addToLaneGroup(`${v.axis}_${v.roadIdx}_${v.dir}_${bikeFlag}`, {
        ref: v,
        s: v.s,
        halfLen: v.halfLen,
        speed: v.speed
      });
    }
    for (const [key, list] of laneGroups.entries()) {
      const dir = key.includes('_-1_') ? -1 : 1;
      list.sort((a, b) => (a.s - b.s) * dir);
    }

    for (const v of allVehicles) {
      if (v.turning) {
        const T = v.turning;
        v.turnSignal = T.turnSide;

        // Check if any pedestrian is actively crossing on the zebra cross right ahead of this turning vehicle
        let pedBlocked = false;
        for (let pi = 0; pi < pedAgents.length; pi++) {
          const p = pedAgents[pi];
          if (p.state === 'crossing') {
            const dx = p.x - v.x;
            const dz = p.z - v.z;
            const fwd = dx * Math.sin(v.ry) + dz * Math.cos(v.ry);
            const lat = Math.abs(dx * Math.cos(v.ry) - dz * Math.sin(v.ry));
            if (fwd > 0.1 && fwd < 2.45 && lat < 1.15) {
              pedBlocked = true;
              break;
            }
          }
        }

        if (pedBlocked) {
          v.speed = Math.max(0, v.speed - 4.5 * dt);
          v.braking = true;
        } else {
          v.speed = Math.min(v.maxSpeed * 0.78, Math.max(1.8, v.speed + 1.5 * dt));
          v.braking = false;
        }

        T.u += (v.speed * dt) / T.arcLen;
        if (T.u >= 1.0) {
          v.axis = T.newAxis;
          v.roadIdx = T.newRoadIdx;
          v.roadCoord = T.newRoadCoord;
          v.dir = T.newDir;
          v.s = T.exitS;
          v.turning = null;
          v.intentTurn = 0;
          v.turnSignal = 0;
          const [wx, wz, wry] = laneWorldPose(v.axis, v.roadCoord, v.dir, v.s, v.latOffset);
          v.x = wx;
          v.z = wz;
          v.ry = wry;
          v.braking = false;
        } else {
          const u = T.u;
          const om = 1 - u;
          v.x = om * om * T.x0 + 2 * om * u * T.x1 + u * u * T.x2;
          v.z = om * om * T.z0 + 2 * om * u * T.z1 + u * u * T.z2;
          const tx = 2 * om * (T.x1 - T.x0) + 2 * u * (T.x2 - T.x1);
          const tz = 2 * om * (T.z1 - T.z0) + 2 * u * (T.z2 - T.z1);
          v.ry = Math.atan2(tx, tz);
        }
        continue;
      }

      const laneKey = `${v.axis}_${v.roadIdx}_${v.dir}_${v.kind === 'bike' ? 1 : 0}`;
      const list = laneGroups.get(laneKey) || [];
      let idx = -1;
      for (let k = 0; k < list.length; k++) {
        if (list[k].ref === v) {
          idx = k;
          break;
        }
      }
      let gap = 999;
      let leadSpeed = v.maxSpeed;
      if (idx >= 0 && idx < list.length - 1) {
        const lead = list[idx + 1];
        gap = (lead.s - v.s) * v.dir - (lead.halfLen + v.halfLen);
        leadSpeed = lead.speed;
      }

      const vehicleStopDist = v.kind === 'bike' ? BIKE_STOP_DIST : CAR_STOP_DIST;

      let redGap = 999;
      let upcomingInter = null;
      let upcomingInterIdx = -1;
      let nearestApproachDist = 999;
      let nearestInterIdx = -1;

      for (let m = 0; m < LANES.length; m++) {
        const ic = LANES[m];
        const stopS = ic - v.dir * vehicleStopDist;
        const distToStop = (stopS - v.s) * v.dir - v.halfLen;
        if (distToStop >= -0.35 && distToStop < 16.0) {
          const ix = v.axis === 1 ? v.roadIdx : m;
          const iz = v.axis === 1 ? m : v.roadIdx;
          const inter = interMap.get(`${ix},${iz}`);
          if (inter) {
            const interIdx = ix * 10 + iz;
            if (distToStop >= -0.25 && distToStop < nearestApproachDist) {
              nearestApproachDist = distToStop;
              nearestInterIdx = interIdx;
            }
            const isEWThroughTJunc =
              v.axis === 0 && (interIdx === 31 || interIdx === 32 || interIdx === 22 || interIdx === 23);
            const isNSThroughTJunc =
              v.axis === 1 && (interIdx === 30 || interIdx === 40);
            const sig =
              v.axis === 1
                ? isNSThroughTJunc
                  ? 'G'
                  : inter.nsState
                : isEWThroughTJunc
                  ? 'G'
                  : inter.ewState;
            if (sig === 'R' || (sig === 'Y' && distToStop > 1.1)) {
              if (distToStop < redGap) redGap = Math.max(0.02, distToStop);
            } else if (sig === 'G' && distToStop <= 1.25 && distToStop >= -0.35) {
              upcomingInter = inter;
              upcomingInterIdx = interIdx;
            }
          }
        }
      }

      // Mandatory T-Junction rerouting:
      // 1) Any vehicle (car, suv, bus, bike) on axis === 1, roadIdx === 3 approaching the closed Tennis Court segment (z in [0, PITCH])
      // 2) Any vehicle (car, suv, bus, bike) on axis === 1, roadIdx === 2 approaching the closed Civic Park segment (z in [PITCH, 2 * PITCH])
      // 3) Any vehicle (car, suv, bus, bike) on axis === 0, roadIdx === 0 approaching the closed Pocket Park segment (x in [2 * PITCH, 3 * PITCH])
      //    MUST turn onto the perimeter road!
      const approachingClosedHeadOn =
        (v.axis === 1 &&
          ((v.roadIdx === 3 && ((v.dir > 0 && nearestInterIdx === 31) || (v.dir < 0 && nearestInterIdx === 32))) ||
            (v.roadIdx === 2 && ((v.dir > 0 && nearestInterIdx === 22) || (v.dir < 0 && nearestInterIdx === 23))))) ||
        (v.axis === 0 &&
          v.roadIdx === 0 &&
          ((v.dir > 0 && nearestInterIdx === 30) || (v.dir < 0 && nearestInterIdx === 40)));

      // Decide turn intention ahead of time (~8 units before stop line) so turn signal blinks while approaching/waiting
      if (nearestInterIdx !== -1 && nearestApproachDist < 8.2) {
        if (approachingClosedHeadOn) {
          if (v.intentInterIdx !== nearestInterIdx || v.intentTurn === 0) {
            v.intentInterIdx = nearestInterIdx;
            v.intentTurn = random() < 0.55 ? 1 : -1;
          }
          v.turnSignal = v.intentTurn;
          if (!upcomingInter && nearestApproachDist <= 1.45) {
            upcomingInter = interMap.get(
              v.axis === 0
                ? v.dir > 0
                  ? '3,0'
                  : '4,0'
                : v.roadIdx === 3
                  ? v.dir > 0
                    ? '3,1'
                    : '3,2'
                  : v.dir > 0
                    ? '2,2'
                    : '2,3'
            );
            upcomingInterIdx = nearestInterIdx;
          }
        } else if (v.kind === 'car' || v.kind === 'suv') {
          if (v.intentInterIdx !== nearestInterIdx) {
            v.intentInterIdx = nearestInterIdx;
            const roll = random();
            let candidateTurn = roll < 0.22 ? 1 : roll < 0.36 ? -1 : 0;
            // Block any turn from E-W perimeter roads into the closed N-S segments (Tennis Court [0, PITCH] & Civic Park [PITCH, 2*PITCH])
            if (candidateTurn !== 0 && v.axis === 0) {
              const interIx = Math.floor(nearestInterIdx / 10);
              const testDir = v.dir * candidateTurn;
              if (
                (interIx === 3 && ((v.roadIdx === 1 && testDir > 0) || (v.roadIdx === 2 && testDir < 0))) ||
                (interIx === 2 && ((v.roadIdx === 2 && testDir > 0) || (v.roadIdx === 3 && testDir < 0)))
              ) {
                candidateTurn = 0; // Continue straight along the superblock perimeter!
              }
            }
            // Block any turn from N-S perimeter roads into the closed E-W Pocket Park segment ([2*PITCH, 3*PITCH] at z = -PITCH)
            if (candidateTurn !== 0 && v.axis === 1) {
              const interIy = nearestInterIdx % 10;
              const testDir = -v.dir * candidateTurn;
              if (interIy === 0 && ((v.roadIdx === 3 && testDir > 0) || (v.roadIdx === 4 && testDir < 0))) {
                candidateTurn = 0; // Continue straight along the Pocket Park perimeter!
              }
            }
            v.intentTurn = candidateTurn;
          }
          v.turnSignal = v.intentTurn;
        } else {
          v.turnSignal = 0;
        }
      } else {
        v.turnSignal = 0;
      }

      // Execute smooth Quadratic Bezier turn across the clean intersection box when reaching entryS
      if (
        dt > 0 &&
        (v.kind === 'car' || v.kind === 'suv' || approachingClosedHeadOn) &&
        upcomingInter &&
        v.lastTurnInter !== upcomingInterIdx &&
        v.intentTurn !== 0 &&
        (gap > 2.2 || approachingClosedHeadOn)
      ) {
        const turnSide = v.intentTurn; // +1 = right turn, -1 = left turn
        const newAxis = 1 - v.axis;
        const newRoadIdx = v.axis === 1 ? upcomingInter.iz : upcomingInter.ix;
        const newRoadCoord = LANES[newRoadIdx];
        const newDir = v.axis === 1 ? -v.dir * turnSide : v.dir * turnSide;
        const entryS = newRoadCoord - v.dir * BOX_HALF;
        const distToEntry = (entryS - v.s) * v.dir;

        // Never allow turning into the closed Tennis Court road segment; redirect straight instead
        if (wouldEnterClosedRoad(newAxis, newRoadIdx, newDir, v.roadCoord + newDir * BOX_HALF)) {
          v.intentTurn = 0;
          v.turnSignal = 0;
        } else if (distToEntry <= 0.45 && distToEntry >= -0.45) {
          v.lastTurnInter = upcomingInterIdx;
          const exitS = v.roadCoord + newDir * BOX_HALF;
          const targetKey = `${newAxis}_${newRoadIdx}_${newDir}_${v.kind === 'bike' ? 1 : 0}`;
          const targetList = laneGroups.get(targetKey) || [];
          const clear = approachingClosedHeadOn || targetList.every(o => Math.abs(o.s - exitS) > 3.4);
          if (clear) {
            const [x0, z0] = laneWorldPose(v.axis, v.roadCoord, v.dir, entryS, v.latOffset);
            const [x2, z2] = laneWorldPose(newAxis, newRoadCoord, newDir, exitS, v.latOffset);
            const x1 = v.axis === 1 ? x0 : x2;
            const z1 = v.axis === 1 ? z2 : z0;
            const arcLen = Math.max(1.2, Math.hypot(x1 - x0, z1 - z0) + Math.hypot(x2 - x1, z2 - z1)) * 0.82;
            v.turning = {
              u: 0,
              arcLen,
              x0,
              z0,
              x1,
              z1,
              x2,
              z2,
              newAxis,
              newRoadIdx,
              newRoadCoord,
              newDir,
              entryS,
              exitS,
              turnSide
            };
          } else {
            v.intentTurn = 0;
            v.turnSignal = 0;
          }
        }
      }

      let effGap = gap;
      let effLeadSpeed = leadSpeed;
      if (redGap < effGap) {
        effGap = redGap;
        effLeadSpeed = 0;
      }

      const aMax = 3.0;
      const bComfort = 3.4;
      const T_headway = 0.78; // 1.5x larger time headway for enlarged vehicles
      const dv = v.speed - effLeadSpeed;
      const sStar =
        v.minGap +
        Math.max(0, v.speed * T_headway + (v.speed * dv) / (2 * Math.sqrt(aMax * bComfort)));
      const ratioV = Math.pow(v.speed / v.maxSpeed, 4);
      const ratioS = effGap < 28 ? Math.pow(sStar / Math.max(0.08, effGap), 2) : 0;
      const accel = aMax * (1 - ratioV - ratioS);

      v.speed = Math.max(0, Math.min(v.maxSpeed, v.speed + accel * dt));
      if (effGap < 0.42 && effLeadSpeed < 0.12) v.speed = 0;
      // Guarantee smooth minimum forward speed when green and clear ahead
      if (redGap > 5.2 && gap > 2.2 && v.speed < 1.85) {
        v.speed = Math.min(v.maxSpeed, v.speed + 3.8 * dt);
      }
      // Strict bumper-to-bumper safe separation (minimum 0.78u gap for motor vehicles, 0.55u for bikes) so vehicles NEVER clip!
      const minBumperGap = v.kind === 'bike' ? 0.55 : 0.78;
      if (idx >= 0 && idx < list.length - 1 && gap < minBumperGap) {
        v.speed = Math.min(v.speed, leadSpeed * 0.45);
        v.s = list[idx + 1].s - v.dir * (list[idx + 1].halfLen + v.halfLen + minBumperGap);
      }
      v.braking = accel < -0.6 || v.speed < 0.35;

      v.s += v.dir * v.speed * dt;
      // Bounding Box Protection: if any vehicle on axis === 1 ever reaches the closed Tennis Court segment [0, PITCH]
      // or the closed Civic Park segment [PITCH, 2 * PITCH], immediately redirect it onto the perimeter E-W road!
      if (v.axis === 1 && v.roadIdx === 3 && v.s > -BOX_HALF && v.s < PITCH + BOX_HALF) {
        const toFront = v.dir < 0 || Math.abs(v.s - PITCH) < Math.abs(v.s);
        v.axis = 0;
        v.roadIdx = toFront ? 2 : 1;
        v.roadCoord = LANES[v.roadIdx];
        v.dir = random() < 0.5 ? 1 : -1;
        v.s = 2 * PITCH + v.dir * (BOX_HALF + 0.6);
        v.turning = null;
        v.intentTurn = 0;
        v.turnSignal = 0;
      } else if (v.axis === 1 && v.roadIdx === 2 && v.s > PITCH - BOX_HALF && v.s < 2 * PITCH + BOX_HALF) {
        const toFront = v.dir < 0 || Math.abs(v.s - 2 * PITCH) < Math.abs(v.s - PITCH);
        v.axis = 0;
        v.roadIdx = toFront ? 3 : 2;
        v.roadCoord = LANES[v.roadIdx];
        v.dir = random() < 0.5 ? 1 : -1;
        v.s = PITCH + v.dir * (BOX_HALF + 0.6);
        v.turning = null;
        v.intentTurn = 0;
        v.turnSignal = 0;
      } else if (v.axis === 0 && v.roadIdx === 0 && v.s > 2 * PITCH - BOX_HALF && v.s < 3 * PITCH + BOX_HALF) {
        const toEast = v.dir < 0 || Math.abs(v.s - 3 * PITCH) < Math.abs(v.s - 2 * PITCH);
        v.axis = 1;
        v.roadIdx = toEast ? 4 : 3;
        v.roadCoord = LANES[v.roadIdx];
        v.dir = random() < 0.5 ? 1 : -1;
        v.s = -PITCH + v.dir * (BOX_HALF + 0.6);
        v.turning = null;
        v.intentTurn = 0;
        v.turnSignal = 0;
      }
      if (v.dir > 0 && v.s > S_MAX) {
        v.s -= S_SPAN;
        v.lastTurnInter = -1;
        v.intentInterIdx = -1;
        v.intentTurn = 0;
      } else if (v.dir < 0 && v.s < S_MIN) {
        v.s += S_SPAN;
        v.lastTurnInter = -1;
        v.intentInterIdx = -1;
        v.intentTurn = 0;
      }

      const [wx, wz, wry] = laneWorldPose(v.axis, v.roadCoord, v.dir, v.s, v.latOffset);
      v.x = wx;
      v.z = wz;
      v.ry = wry;
    }

    // Update InstancedMeshes for Cars, SUVs/Vans, Box Trucks, Separate Solid Cabin Glass, and Cyclists (tire bottom at y = 0.000 sitting 100% flush on Y_ROAD / Y_MARKINGS!)
    for (let i = 0; i < carAgents.length; i++) {
      const v = carAgents[i];
      dummy.position.set(v.x, Y_ROAD, v.z);
      dummy.rotation.set(0, v.ry, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      carsMesh.setMatrixAt(i, dummy.matrix);
      carsGlassMesh.setMatrixAt(i, dummy.matrix);
    }
    for (let i = 0; i < suvAgents.length; i++) {
      const v = suvAgents[i];
      dummy.position.set(v.x, Y_ROAD, v.z);
      dummy.rotation.set(0, v.ry, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      suvsMesh.setMatrixAt(i, dummy.matrix);
      suvsGlassMesh.setMatrixAt(i, dummy.matrix);
    }
    for (let i = 0; i < busAgents.length; i++) {
      const v = busAgents[i];
      dummy.position.set(v.x, Y_ROAD, v.z);
      dummy.rotation.set(0, v.ry, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      busesMesh.setMatrixAt(i, dummy.matrix);
      busesGlassMesh.setMatrixAt(i, dummy.matrix);
    }
    for (let i = 0; i < bikeAgents.length; i++) {
      const v = bikeAgents[i];
      dummy.position.set(v.x, Y_MARKINGS, v.z);
      dummy.rotation.set(0, v.ry, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      bikesMesh.setMatrixAt(i, dummy.matrix);
    }

    // Update 4 Independent Rotating Wheels per Vehicle, Headlight Beams on Asphalt (y = Y_GLOW = 0.08),
    // Shutter Trails & Blinking Turn Signals
    let ti = 0;
    let wi = 0;
    const blinkOn = Math.floor(simTime * 5.2) % 2 === 0;
    for (let i = 0; i < motorVehicles.length; i++) {
      const v = motorVehicles[i];
      const fz = v.frontZ || (v.kind === 'bus' ? 1.35 : v.kind === 'suv' ? 1.24 : 1.15);
      const sin = Math.sin(v.ry), cos = Math.cos(v.ry);

      // Animate all 4 wheels proportional to forward speed + front-wheel steering yaw during turns
      const steerYaw = v.turning ? v.turning.turnType * 0.34 : v.turnSignal * 0.12;
      v.wheels.forEach(w => {
        w.rotation.x = (w.rotation.x + (v.speed / v.wheelRadius) * dt) % (Math.PI * 2);
        w.rotation.y = w.isFront ? steerYaw : 0;
        dummy.position.set(v.x + w.lx * cos + w.lz * sin, Y_ROAD + w.y, v.z - w.lx * sin + w.lz * cos);
        dummy.rotation.set(w.rotation.x, v.ry + w.rotation.y, 0, 'YXZ');
        dummy.scale.setScalar(v.wheelScale);
        dummy.updateMatrix();
        wheelsMesh.setMatrixAt(wi++, dummy.matrix);
      });

      dummy.position.set(v.x + fz * sin, Y_GLOW, v.z + fz * cos);
      dummy.rotation.set(0, v.ry, 0);
      dummy.scale.set(v.kind === 'bus' ? 1.15 : 1.0, 1, v.kind === 'bus' ? 1.15 : 1.0);
      dummy.updateMatrix();
      headlightBeams.setMatrixAt(i, dummy.matrix);

      const sep = v.headlightSep || (v.kind === 'bus' ? 0.34 : v.kind === 'suv' ? 0.31 : 0.29);
      const yTrail = Y_ROAD + (v.trailY || (v.kind === 'bus' ? 0.44 : v.kind === 'suv' ? 0.41 : 0.38));
      const span = v.speed * shutter;
      const len = v.braking ? Math.max(0.18, span) : Math.max(0.001, Math.min(12, span));
      const show = (shutter > 0.01 && span > 0.05) || v.braking ? 1 : 0.0001;

      trails.setColorAt(i * 6 + 2, v.braking ? brakeCol : tailCol);
      trails.setColorAt(i * 6 + 3, v.braking ? brakeCol : tailCol);

      const placeTrail = (lx, lz, w, lScale, forceShow = false) => {
        dummy.position.set(v.x + lx * cos + lz * sin, yTrail, v.z - lx * sin + lz * cos);
        dummy.rotation.set(0, v.ry, 0);
        dummy.scale.set(w, 1, lScale * (forceShow ? 1 : show));
        dummy.updateMatrix();
        trails.setMatrixAt(ti++, dummy.matrix);
      };
      placeTrail(-sep, fz, 1, Math.max(0.001, span));
      placeTrail(sep, fz, 1, Math.max(0.001, span));
      placeTrail(-sep, -fz, v.braking ? 1.65 : 1.25, len);
      placeTrail(sep, -fz, v.braking ? 1.65 : 1.25, len);

      const showBlinker = v.turnSignal !== 0 && blinkOn;
      const blinkLx = -v.turnSignal * (sep + 0.06);
      placeTrail(blinkLx, fz + 0.02, showBlinker ? 2.1 : 0.001, showBlinker ? 0.18 : 0.0001, true);
      placeTrail(blinkLx, -fz + 0.08, showBlinker ? 2.1 : 0.001, showBlinker ? 0.18 : 0.0001, true);
    }

    carsMesh.instanceMatrix.needsUpdate = true;
    suvsMesh.instanceMatrix.needsUpdate = true;
    busesMesh.instanceMatrix.needsUpdate = true;
    carsGlassMesh.instanceMatrix.needsUpdate = true;
    suvsGlassMesh.instanceMatrix.needsUpdate = true;
    busesGlassMesh.instanceMatrix.needsUpdate = true;
    bikesMesh.instanceMatrix.needsUpdate = true;
    wheelsMesh.instanceMatrix.needsUpdate = true;
    headlightBeams.instanceMatrix.needsUpdate = true;
    trails.instanceMatrix.needsUpdate = true;
    if (trails.instanceColor) trails.instanceColor.needsUpdate = true;
    trails.visible = true;
  }

  // --------------------------------------------------------------------------
  // 7. UNIFIED NPC MANAGEMENT IN APP.JS (No Duplicate Sidewalk / Plaza Spawners)
  // --------------------------------------------------------------------------
  function updatePedestriansSim() {
    // All sidewalk, plaza, cafe, and window-shopping NPCs are managed by the
    // unified per-block FSM quota system in app.js (strictly 3–4 NPCs per block,
    // 25–28 NPCs across Ceria Town, zero duplicate spawners).
  }

  updateIntersections(0);
  updateVehiclesSim(0.016, 0.12, 0);
  updatePedestriansSim(0.016, 0);

  return {
    createDetailedCar,
    createDetailedWheelGeo,
    headlightBeams,
    trails,
    mAsphaltSurface,
    update(dt, simTime, shutter, night) {
      const stepDt = Math.min(0.05, Math.max(0.0, dt));
      uCarNight.value = night;
      updateIntersections(simTime);
      updateVehiclesSim(stepDt, shutter, simTime);
      updatePedestriansSim(stepDt, simTime);
      beamMat.opacity = 0.26 + 0.54 * night;
      trailMat.opacity = 0.24 + 0.56 * night;
    },
    setOverlaysVisible(vis) {
      headlightBeams.visible = vis;
      trails.visible = vis;
    }
  };
}
