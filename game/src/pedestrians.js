// People: a low-poly humanoid built from boxes with swinging limbs — shared by the
// pedestrians here, the player and the mission guards — and the crowd itself:
// residents who stroll the sidewalk loops, hurry away from trouble, and go down when
// a car or a fist finds them.

import * as THREE from 'three';
import { CITY } from './config.js';

const boxGeo = new THREE.BoxGeometry(1, 1, 1);

function lambert(color) {
  return new THREE.MeshLambertMaterial({ color });
}

const SKIN = [0xf2c9a0, 0xc98d5e, 0x8a5a34, 0x6e4525, 0xffdbb8];
const SHIRTS = [0xef8354, 0x2ec4b6, 0xf2e3c6, 0x3d7bd9, 0xe5638c, 0x53b06a, 0xf7ead7, 0x9b59c9];
const PANTS = [0x30343c, 0x5a6a7a, 0x8a6a48, 0xe8e2d2, 0x44546a];

/** A person facing +z, feet on y=0, about 1.8 m tall, with named parts for animation. */
export function buildHumanoid(rng, shirtColor, pantsColor) {
  const g = new THREE.Group();
  const skin = lambert(rng ? rng.pick(SKIN) : SKIN[0]);
  const shirt = lambert(shirtColor);
  const pants = lambert(pantsColor);

  function limb(mat, w, h, d, x, y, z) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, z);
    const m = new THREE.Mesh(boxGeo, mat);
    m.scale.set(w, h, d);
    m.position.y = -h / 2;
    m.castShadow = true;
    pivot.add(m);
    g.add(pivot);
    return pivot;
  }

  const legL = limb(pants, 0.17, 0.8, 0.19, -0.11, 0.8, 0);
  const legR = limb(pants, 0.17, 0.8, 0.19, 0.11, 0.8, 0);
  const torso = new THREE.Mesh(boxGeo, shirt);
  torso.scale.set(0.46, 0.62, 0.24);
  torso.position.y = 1.11;
  torso.castShadow = true;
  g.add(torso);
  const armL = limb(shirt, 0.13, 0.68, 0.15, -0.31, 1.4, 0);
  const armR = limb(shirt, 0.13, 0.68, 0.15, 0.31, 1.4, 0);
  const head = new THREE.Mesh(boxGeo, skin);
  head.scale.set(0.26, 0.28, 0.26);
  head.position.y = 1.58;
  head.castShadow = true;
  g.add(head);
  const hair = new THREE.Mesh(boxGeo, lambert(rng ? rng.pick([0x2a2018, 0x4a3018, 0x8a6a48, 0xd8c8a0, 0xb03a2e]) : 0x2a2018));
  hair.scale.set(0.28, 0.09, 0.28);
  hair.position.y = 1.75;
  g.add(hair);

  return { group: g, legL, legR, armL, armR, torso, head };
}

/** Swing the limbs for a walker at `speed`; phase advances with distance travelled. */
export function animateHumanoid(h, phase, speed, aiming = false) {
  const swing = Math.min(Math.abs(speed) / 3, 1) * 0.62;
  h.legL.rotation.x = Math.sin(phase) * swing;
  h.legR.rotation.x = Math.sin(phase + Math.PI) * swing;
  h.armL.rotation.x = Math.sin(phase + Math.PI) * swing * 0.8;
  if (aiming) h.armR.rotation.x = -Math.PI / 2 + 0.12;
  else h.armR.rotation.x = Math.sin(phase) * swing * 0.8;
}

export function createPedestrians(scene, city, rng, count = 22) {
  const list = [];

  function loopPoint(loop, t) {
    // A point on the loop's rectangle perimeter, t in [0, 1).
    const px = loop.halfX;
    const pz = loop.halfZ;
    const per = 4 * (px + pz);
    let d = (t % 1) * per;
    if (d < 2 * px) return [loop.cx - px + d, loop.cz - pz];
    d -= 2 * px;
    if (d < 2 * pz) return [loop.cx + px, loop.cz - pz + d];
    d -= 2 * pz;
    if (d < 2 * px) return [loop.cx + px - d, loop.cz + pz];
    d -= 2 * px;
    return [loop.cx - px, loop.cz + pz - d];
  }

  function placeOnLoop(ped, nearFocus) {
    let loop = rng.pick(city.sidewalkLoops);
    if (nearFocus) {
      let best = Infinity;
      for (const l of city.sidewalkLoops) {
        const d = Math.hypot(l.cx - nearFocus.x, l.cz - nearFocus.z);
        if (d < best) { best = d; loop = l; }
      }
    }
    ped.loop = loop;
    ped.t = rng.next();
    const [x, z] = loopPoint(loop, ped.t);
    ped.mesh.position.set(x, 0.16, z);
  }

  for (let i = 0; i < count; i += 1) {
    const h = buildHumanoid(rng, rng.pick(SHIRTS), rng.pick(PANTS));
    scene.add(h.group);
    const ped = {
      mesh: h.group,
      parts: h,
      torso: h.torso,
      loop: null,
      t: 0,
      speed: rng.range(1.1, 1.7),
      phase: rng.range(0, 6),
      state: 'walk',
      health: 60,
      fleeFrom: null,
      fleeTime: 0,
      downTime: 0,
      get x() { return h.group.position.x; },
      get z() { return h.group.position.z; },
    };
    h.torso.userData.ped = ped;
    placeOnLoop(ped, null);
    list.push(ped);
  }

  /** Everyone within radius of (x, z) runs from it. */
  function threat(x, z, radius) {
    for (const ped of list) {
      if (ped.state === 'down') continue;
      if (Math.hypot(ped.x - x, ped.z - z) < radius) {
        ped.state = 'flee';
        ped.fleeFrom = { x, z };
        ped.fleeTime = rng.range(2.5, 4.5);
      }
    }
  }

  /** Knock a pedestrian down (car hit, blast of fists). They get up after a while. */
  function knockDown(ped, getUp = true) {
    if (ped.state === 'down') return;
    ped.state = 'down';
    ped.downTime = getUp ? 7 : 9999;
    ped.mesh.rotation.x = -Math.PI / 2;
    ped.mesh.position.y = 0.25;
  }

  function update(dt, focus) {
    for (const ped of list) {
      if (ped.state === 'down') {
        ped.downTime -= dt;
        if (ped.downTime <= 0) {
          ped.state = 'flee';
          ped.fleeTime = 2;
          ped.fleeFrom = { x: focus.x, z: focus.z };
          ped.mesh.rotation.x = 0;
          ped.mesh.position.y = 0.16;
          ped.health = 40;
        }
        continue;
      }

      // Recycle far-away pedestrians to loops near the focus.
      if (focus && Math.hypot(ped.x - focus.x, ped.z - focus.z) > 210) placeOnLoop(ped, focus);

      let vx = 0;
      let vz = 0;
      let speed = ped.speed;
      if (ped.state === 'flee') {
        ped.fleeTime -= dt;
        const dx = ped.x - ped.fleeFrom.x;
        const dz = ped.z - ped.fleeFrom.z;
        const d = Math.hypot(dx, dz) || 1;
        vx = (dx / d) * 4.3;
        vz = (dz / d) * 4.3;
        speed = 4.3;
        if (ped.fleeTime <= 0) {
          ped.state = 'walk';
          placeOnLoop(ped, { x: ped.x, z: ped.z });
        }
      } else {
        const per = 4 * (ped.loop.halfX + ped.loop.halfZ);
        ped.t += (ped.speed * dt) / per;
        const [nx, nz] = loopPoint(ped.loop, ped.t);
        vx = (nx - ped.x) / Math.max(dt, 1e-4);
        vz = (nz - ped.z) / Math.max(dt, 1e-4);
        ped.mesh.position.x = nx;
        ped.mesh.position.z = nz;
      }
      if (ped.state === 'flee') {
        ped.mesh.position.x += vx * dt;
        ped.mesh.position.z += vz * dt;
        ped.mesh.position.x = Math.max(-CITY.bound, Math.min(CITY.bound, ped.mesh.position.x));
        ped.mesh.position.z = Math.max(-CITY.bound, Math.min(CITY.bound, ped.mesh.position.z));
      }
      const moving = Math.hypot(vx, vz);
      if (moving > 0.1) {
        const targetHeading = Math.atan2(vx, vz);
        let diff = targetHeading - ped.mesh.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        ped.mesh.rotation.y += diff * Math.min(1, dt * 10);
        ped.phase += dt * moving * 2.4;
      }
      animateHumanoid(ped.parts, ped.phase, moving);
      void speed;
    }
  }

  return { list, update, threat, knockDown };
}
