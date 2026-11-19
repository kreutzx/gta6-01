// Verano Bay itself: a procedural sun-soaked coastal city built from the seeded RNG —
// a grid of pastel blocks with window-lit facades, palms and streetlights along the
// sidewalks, a marina beach and working docks, plus the named places the story visits.
// Everything the other systems need to know about the world (building colliders, road
// lines, sidewalk loops, parking spots, named locations) is returned with the meshes.

import * as THREE from 'three';
import { CITY, PALETTE } from './config.js';

/** Road centre-line coordinates on both axes. */
export const ROAD_LINES = [];
for (let i = -CITY.grid; i <= CITY.grid; i += 1) ROAD_LINES.push(i * CITY.pitch);

/** A canvas facade: pale plaster, a grid of windows (some lit warm), a shopfront band below. */
function facadeTexture(rng, floors, cols) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 128, 256);
  const winW = 128 / cols;
  const winH = 256 / (floors + 2);
  for (let f = 0; f < floors; f += 1) {
    for (let c = 0; c < cols; c += 1) {
      const lit = rng.chance(0.24);
      g.fillStyle = lit ? '#ffd98a' : (rng.chance(0.5) ? '#33506b' : '#27435c');
      g.fillRect(c * winW + winW * 0.22, f * winH + winH * 0.2, winW * 0.56, winH * 0.55);
    }
  }
  // Shopfront band: darker glass, an awning stripe and a door.
  const bandY = 256 - winH * 1.6;
  g.fillStyle = '#3d4a55';
  g.fillRect(0, bandY, 128, 256 - bandY);
  g.fillStyle = '#e2543e';
  g.fillRect(0, bandY, 128, 7);
  g.fillStyle = '#8fd0e8';
  g.fillRect(10, bandY + 14, 46, 256 - bandY - 20);
  g.fillRect(72, bandY + 14, 46, 256 - bandY - 20);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** A canvas sign for one of the city's invented businesses. */
function signTexture(name, sub, bg, fg) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const g = canvas.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 160);
  g.fillStyle = fg;
  g.font = '900 62px "Avenir Next", "Segoe UI", sans-serif';
  g.textAlign = 'center';
  g.fillText(name, 256, 74);
  g.font = '700 30px "Avenir Next", "Segoe UI", sans-serif';
  g.fillText(sub, 256, 122);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Asphalt with a dashed centre line, repeated along the road's length. */
function roadTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const g = canvas.getContext('2d');
  g.fillStyle = '#3c4148';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#4a5058';
  for (let i = 0; i < 260; i += 1) g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  g.fillStyle = '#e8e4d2';
  g.fillRect(61, 8, 6, 44);
  g.fillRect(6, 0, 3, 128);
  g.fillRect(119, 0, 3, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function createCity(scene, rng) {
  const group = new THREE.Group();
  const colliders = [];
  const sidewalkLoops = [];
  const parkingSpots = [];
  scene.add(group);

  const lambert = (color, opts = {}) => new THREE.MeshLambertMaterial({ color, ...opts });

  // ---- Sky dome, sun glow and drifting clouds -------------------------------
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = 4;
  skyCanvas.height = 256;
  const sg = skyCanvas.getContext('2d');
  const grad = sg.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#5ea9dd');
  grad.addColorStop(0.55, '#9fd0ea');
  grad.addColorStop(0.8, '#ffe3ba');
  grad.addColorStop(1, '#ffd9a8');
  sg.fillStyle = grad;
  sg.fillRect(0, 0, 4, 256);
  const skyTex = new THREE.CanvasTexture(skyCanvas);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(880, 24, 12),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false }),
  );
  group.add(sky);

  const cloudCanvas = document.createElement('canvas');
  cloudCanvas.width = 256;
  cloudCanvas.height = 128;
  const cg = cloudCanvas.getContext('2d');
  for (const [x, y, r] of [[70, 80, 42], [120, 66, 54], [178, 80, 40], [105, 88, 48], [150, 90, 44]]) {
    const rg = cg.createRadialGradient(x, y, 4, x, y, r);
    rg.addColorStop(0, 'rgba(255,255,255,0.85)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    cg.fillStyle = rg;
    cg.beginPath();
    cg.arc(x, y, r, 0, Math.PI * 2);
    cg.fill();
  }
  const cloudTex = new THREE.CanvasTexture(cloudCanvas);
  const clouds = [];
  for (let i = 0; i < 9; i += 1) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(rng.range(90, 170), rng.range(30, 55)),
      new THREE.MeshBasicMaterial({ map: cloudTex, transparent: true, depthWrite: false, fog: false }),
    );
    m.position.set(rng.range(-700, 700), rng.range(120, 190), rng.range(-700, 700));
    m.rotation.x = -0.25;
    clouds.push(m);
    group.add(m);
  }

  // ---- Ground, beach and sea -------------------------------------------------
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(760, 760), lambert(PALETTE.ground));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 40);
  ground.receiveShadow = true;
  group.add(ground);

  const sand = new THREE.Mesh(new THREE.PlaneGeometry(760, CITY.waterZ - CITY.beachZ + 60), lambert(PALETTE.sand));
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.03, (CITY.beachZ + CITY.waterZ) / 2 + 14);
  sand.receiveShadow = true;
  group.add(sand);

  const waterMat = new THREE.MeshLambertMaterial({ color: PALETTE.water, transparent: true, opacity: 0.88 });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1500, 620), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.22, CITY.waterZ + 260);
  group.add(water);
  const foam = new THREE.Mesh(
    new THREE.PlaneGeometry(760, 3.2),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }),
  );
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(0, 0.3, CITY.waterZ + 1);
  group.add(foam);

  // ---- Roads -----------------------------------------------------------------
  const roadTex = roadTexture();
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
  const extent = CITY.grid * CITY.pitch + 44;
  for (const line of ROAD_LINES) {
    const len = extent + CITY.beachZ - 40;
    const vTex = roadTex.clone();
    vTex.needsUpdate = true;
    vTex.repeat.set(1, len / 16);
    const v = new THREE.Mesh(new THREE.PlaneGeometry(CITY.roadHalf * 2, len), new THREE.MeshLambertMaterial({ map: vTex }));
    v.rotation.x = -Math.PI / 2;
    v.rotation.z = Math.PI / 2;
    v.position.set(line, 0.04, (CITY.beachZ - extent) / 2 + 4);
    v.receiveShadow = true;
    group.add(v);
    const hTex = roadTex.clone();
    hTex.needsUpdate = true;
    hTex.repeat.set(len / 16, 1);
    const h = new THREE.Mesh(new THREE.PlaneGeometry(len, CITY.roadHalf * 2), new THREE.MeshLambertMaterial({ map: hTex }));
    h.rotation.x = -Math.PI / 2;
    h.position.set(0, 0.045, line);
    h.receiveShadow = true;
    group.add(h);
  }

  // ---- Blocks: sidewalks, buildings, palms, lights ---------------------------
  const facades = [facadeTexture(rng, 6, 5), facadeTexture(rng, 9, 6), facadeTexture(rng, 4, 4)];
  const roofMat = lambert(0x8d8578);
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const palmSpots = [];
  const lightSpots = [];

  for (let bi = -CITY.grid; bi < CITY.grid; bi += 1) {
    for (let bj = -CITY.grid; bj < CITY.grid; bj += 1) {
      const x0 = ROAD_LINES[bi + CITY.grid] + CITY.roadHalf;
      const x1 = ROAD_LINES[bi + CITY.grid + 1] - CITY.roadHalf;
      const z0 = ROAD_LINES[bj + CITY.grid] + CITY.roadHalf;
      const z1 = ROAD_LINES[bj + CITY.grid + 1] - CITY.roadHalf;
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      const w = x1 - x0;
      const d = z1 - z0;

      const slab = new THREE.Mesh(boxGeo, lambert(PALETTE.sidewalk));
      slab.scale.set(w + CITY.sidewalk * 2, 0.16, d + CITY.sidewalk * 2);
      slab.position.set(cx, 0.08, cz);
      slab.receiveShadow = true;
      group.add(slab);
      sidewalkLoops.push({ cx, cz, halfX: w / 2 + CITY.sidewalk - 1.1, halfZ: d / 2 + CITY.sidewalk - 1.1 });

      const downtown = Math.abs(bi + 0.5) <= 1 && Math.abs(bj + 0.5) <= 1;
      // Four lots per block; a few stay open as parking or plaza.
      for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const lotCx = cx + lx * w / 4;
        const lotCz = cz + lz * d / 4;
        if (rng.chance(0.14)) {
          // Open lot: a couple of parked-car spots and crates.
          parkingSpots.push({ x: lotCx - 4, z: lotCz, heading: Math.PI / 2 });
          parkingSpots.push({ x: lotCx + 4, z: lotCz, heading: Math.PI / 2 });
          continue;
        }
        const bw = rng.range(15, 21);
        const bd = rng.range(15, 21);
        const bh = downtown ? rng.range(24, 52) : rng.range(8, 26);
        const facade = facades[rng.int(0, facades.length - 1)];
        const side = new THREE.MeshLambertMaterial({ map: facade, color: rng.pick(PALETTE.buildings) });
        const b = new THREE.Mesh(boxGeo, [side, side, roofMat, roofMat, side, side]);
        b.scale.set(bw, bh, bd);
        b.position.set(lotCx, 0.16 + bh / 2, lotCz);
        b.castShadow = true;
        b.receiveShadow = true;
        group.add(b);
        colliders.push({ minX: lotCx - bw / 2, maxX: lotCx + bw / 2, minZ: lotCz - bd / 2, maxZ: lotCz + bd / 2 });
        if (rng.chance(0.4)) {
          const ac = new THREE.Mesh(boxGeo, roofMat);
          ac.scale.set(rng.range(2, 4), rng.range(1, 1.8), rng.range(2, 4));
          ac.position.set(lotCx + rng.range(-5, 5), 0.16 + bh + ac.scale.y / 2, lotCz + rng.range(-5, 5));
          group.add(ac);
        }
      }

      // Palms at the block's corners, lights mid-edge.
      for (const [px, pz] of [[x0 - 2.2, z0 - 2.2], [x1 + 2.2, z0 - 2.2], [x0 - 2.2, z1 + 2.2], [x1 + 2.2, z1 + 2.2]]) {
        if (rng.chance(0.8)) palmSpots.push({ x: px, z: pz });
      }
      lightSpots.push({ x: cx, z: z0 - 2.4 }, { x: cx, z: z1 + 2.4 }, { x: x0 - 2.4, z: cz }, { x: x1 + 2.4, z: cz });
    }
  }

  // Roadside parking bays along the outer avenues.
  for (const line of ROAD_LINES) {
    for (let s = -CITY.grid * CITY.pitch + 18; s < CITY.grid * CITY.pitch - 10; s += 26) {
      if (rng.chance(0.55)) parkingSpots.push({ x: line - CITY.roadHalf + 1.6, z: s, heading: 0 });
      if (rng.chance(0.55)) parkingSpots.push({ x: line + CITY.roadHalf - 1.6, z: s + 12, heading: Math.PI });
    }
  }

  // ---- Palms (instanced) -------------------------------------------------------
  for (let x = -240; x <= 240; x += 16) palmSpots.push({ x: x + rng.range(-3, 3), z: CITY.beachZ + rng.range(4, 22) });
  const trunkGeo = new THREE.CylinderGeometry(0.13, 0.24, 5.2, 5);
  trunkGeo.translate(0, 2.6, 0);
  const trunkMesh = new THREE.InstancedMesh(trunkGeo, lambert(PALETTE.palmTrunk), palmSpots.length);
  const frondGeo = new THREE.ConeGeometry(0.55, 3.8, 4);
  frondGeo.translate(0, 1.9, 0);
  frondGeo.scale(1, 1, 0.16);
  const frondMesh = new THREE.InstancedMesh(frondGeo, lambert(PALETTE.palmLeaf), palmSpots.length * 6);
  const dummy = new THREE.Object3D();
  let fi = 0;
  palmSpots.forEach((p, i) => {
    const lean = rng.range(0.02, 0.1);
    const leanDir = rng.range(0, Math.PI * 2);
    dummy.position.set(p.x, 0.1, p.z);
    dummy.rotation.set(Math.cos(leanDir) * lean, rng.range(0, Math.PI), Math.sin(leanDir) * lean);
    dummy.updateMatrix();
    trunkMesh.setMatrixAt(i, dummy.matrix);
    const topX = p.x - Math.sin(leanDir) * Math.sin(lean) * 5.2 * -1;
    const topZ = p.z - Math.cos(leanDir) * Math.sin(lean) * 5.2 * -1;
    for (let k = 0; k < 6; k += 1) {
      dummy.position.set(topX, 5.15, topZ);
      dummy.rotation.set(1.72, (k / 6) * Math.PI * 2, 0, 'YXZ');
      dummy.updateMatrix();
      frondMesh.setMatrixAt(fi, dummy.matrix);
      fi += 1;
    }
  });
  trunkMesh.castShadow = true;
  frondMesh.castShadow = true;
  group.add(trunkMesh);
  group.add(frondMesh);

  // ---- Streetlights (instanced) -------------------------------------------------
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.11, 5.6, 5);
  poleGeo.translate(0, 2.8, 0);
  const poleMesh = new THREE.InstancedMesh(poleGeo, lambert(0x4a5058), lightSpots.length);
  const lampGeo = new THREE.BoxGeometry(0.5, 0.16, 1.1);
  lampGeo.translate(0, 5.6, 0.4);
  const lampMesh = new THREE.InstancedMesh(lampGeo, new THREE.MeshBasicMaterial({ color: 0xffe9b0 }), lightSpots.length);
  lightSpots.forEach((p, i) => {
    dummy.position.set(p.x, 0.1, p.z);
    dummy.rotation.set(0, rng.range(0, Math.PI * 2), 0);
    dummy.updateMatrix();
    poleMesh.setMatrixAt(i, dummy.matrix);
    lampMesh.setMatrixAt(i, dummy.matrix);
  });
  group.add(poleMesh);
  group.add(lampMesh);

  // ---- Beach dressing: umbrellas and the pier -----------------------------------
  const umbGeo = new THREE.ConeGeometry(1.7, 0.7, 7);
  const umbMesh = new THREE.InstancedMesh(umbGeo, lambert(0xef8354), 26);
  const umbPoleGeo = new THREE.CylinderGeometry(0.05, 0.05, 2.1, 4);
  const umbPoleMesh = new THREE.InstancedMesh(umbPoleGeo, lambert(0xe8e2d2), 26);
  for (let i = 0; i < 26; i += 1) {
    const x = rng.range(-250, 250);
    const z = CITY.beachZ + rng.range(8, 44);
    dummy.position.set(x, 2.05, z);
    dummy.rotation.set(rng.range(-0.1, 0.1), 0, rng.range(-0.1, 0.1));
    dummy.updateMatrix();
    umbMesh.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, 1.05, z);
    dummy.updateMatrix();
    umbPoleMesh.setMatrixAt(i, dummy.matrix);
  }
  group.add(umbMesh);
  group.add(umbPoleMesh);

  const pierMat = lambert(0x9a7a54);
  const pier = new THREE.Mesh(boxGeo, pierMat);
  pier.scale.set(7, 0.7, 74);
  pier.position.set(-40, 1.1, CITY.waterZ + 30);
  pier.castShadow = true;
  group.add(pier);
  colliders.push({ minX: -43.5, maxX: -36.5, minZ: CITY.waterZ - 6, maxZ: CITY.waterZ + 66 });

  // ---- The docks: warehouses, containers, crates ---------------------------------
  const dockMat = lambert(0x7f96a8);
  const dockMat2 = lambert(0xa87f6a);
  for (const [wx, wz, ww, wd, mat] of [[222, -52, 34, 60, dockMat], [222, 26, 34, 52, dockMat2], [222, 92, 30, 40, dockMat]]) {
    const wh = new THREE.Mesh(boxGeo, mat);
    wh.scale.set(ww, 11, wd);
    wh.position.set(wx, 5.5, wz);
    wh.castShadow = true;
    wh.receiveShadow = true;
    group.add(wh);
    colliders.push({ minX: wx - ww / 2, maxX: wx + ww / 2, minZ: wz - wd / 2, maxZ: wz + wd / 2 });
  }
  const containerColors = [0xd94f3d, 0x3d7bd9, 0x53b06a, 0xf2b134, 0x7286a0];
  for (let i = 0; i < 14; i += 1) {
    const cxp = rng.range(196, 214);
    const czp = rng.range(-80, 110);
    const level = rng.chance(0.4) ? 1 : 0;
    const c = new THREE.Mesh(boxGeo, lambert(rng.pick(containerColors)));
    c.scale.set(6, 2.6, 2.4);
    c.position.set(cxp, 1.3 + level * 2.6, czp);
    c.rotation.y = rng.chance(0.5) ? 0 : Math.PI / 2;
    c.castShadow = true;
    group.add(c);
    if (!level) colliders.push({ minX: cxp - 3, maxX: cxp + 3, minZ: czp - 1.6, maxZ: czp + 1.6 });
  }

  // ---- Business signs --------------------------------------------------------------
  const signs = [
    { name: 'VERANO TRUST', sub: 'BANK · EST. 1962', bg: '#27435c', fg: '#ffd98a', x: 14, z: -14, rotY: Math.PI / 4 },
    { name: 'SOL CUSTOMS', sub: 'AUTO WORKS', bg: '#30343c', fg: '#ffd23e', x: 148, z: -138, rotY: -Math.PI / 3 },
    { name: 'PALMS MOTEL', sub: 'VACANCY · POOL', bg: '#7a3b5e', fg: '#ffe9c9', x: -158, z: -52, rotY: Math.PI / 3 },
    { name: 'CAFÉ SOL', sub: 'MARINA · OPEN LATE', bg: '#e2543e', fg: '#ffffff', x: -88, z: 196, rotY: 0.4 },
    { name: 'VERANO GENERAL', sub: 'HOSPITAL', bg: '#eef1f5', fg: '#27435c', x: 76, z: 52, rotY: -0.5 },
    { name: 'VBPD', sub: 'VERANO BAY POLICE', bg: '#20303c', fg: '#9fd0ea', x: -22, z: -132, rotY: 0.3 },
  ];
  for (const s of signs) {
    const tex = signTexture(s.name, s.sub, s.bg, s.fg);
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(11, 3.4),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }),
    );
    board.position.set(s.x, 5.4, s.z);
    board.rotation.y = s.rotY;
    group.add(board);
    const post = new THREE.Mesh(boxGeo, lambert(0x4a5058));
    post.scale.set(0.3, 5.4, 0.3);
    post.position.set(s.x, 2.7, s.z);
    group.add(post);
  }

  /** Named places the story and systems use, in world coordinates. */
  const locations = {
    spawn: { x: -52, z: 208 },
    marinaCafe: { x: -88, z: 190 },
    garage: { x: 150, z: -128 },
    docks: { x: 196, z: 20 },
    warehouse: { x: 214, z: 24 },
    bank: { x: 16, z: -16 },
    motel: { x: -160, z: -44 },
    safehouse: { x: -148, z: 168 },
    hospital: { x: 78, z: 58 },
    policeStation: { x: -24, z: -126 },
    pier: { x: -40, z: 268 },
  };

  /** True when (x, z) is on asphalt. */
  function isRoad(x, z) {
    if (z > CITY.beachZ + 10) return false;
    for (const line of ROAD_LINES) {
      if (Math.abs(x - line) <= CITY.roadHalf || Math.abs(z - line) <= CITY.roadHalf) return true;
    }
    return false;
  }

  let elapsed = 0;
  function update(dt) {
    elapsed += dt;
    water.position.y = 0.22 + Math.sin(elapsed * 0.7) * 0.05;
    foam.material.opacity = 0.35 + Math.sin(elapsed * 1.4) * 0.18;
    foam.position.z = CITY.waterZ + 1 + Math.sin(elapsed * 0.7) * 1.2;
    for (const c of clouds) {
      c.position.x += dt * 1.1;
      if (c.position.x > 760) c.position.x = -760;
    }
  }

  return { group, colliders, sidewalkLoops, parkingSpots, locations, isRoad, update };
}

/** Push a circle at (x, z) out of every AABB collider; returns the corrected [x, z]. */
export function collideCircle(colliders, x, z, radius) {
  for (const c of colliders) {
    const nx = Math.max(c.minX, Math.min(x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(z, c.maxZ));
    const dx = x - nx;
    const dz = z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        x = nx + (dx / d) * radius;
        z = nz + (dz / d) * radius;
      } else {
        // Centre inside the box: leave by the nearest face.
        const left = x - c.minX;
        const right = c.maxX - x;
        const top = z - c.minZ;
        const bottom = c.maxZ - z;
        const m = Math.min(left, right, top, bottom);
        if (m === left) x = c.minX - radius;
        else if (m === right) x = c.maxX + radius;
        else if (m === top) z = c.minZ - radius;
        else z = c.maxZ + radius;
      }
    }
  }
  return [x, z];
}
