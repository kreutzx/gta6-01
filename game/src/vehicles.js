// Cars: stylised low-poly meshes built from boxes (with a taxi sign, a truck bed and a
// police light bar among the kinds) and one shared arcade physics step — throttle,
// steering that fades with speed, lateral grip, building and car collisions — used by
// the player, the traffic and the police alike.

import * as THREE from 'three';
import { CAR } from './config.js';
import { collideCircle } from './city.js';

export const CAR_KINDS = {
  sedan: { topSpeed: 37, accel: 15, length: 4.3, width: 1.85 },
  coupe: { topSpeed: 43, accel: 18.5, length: 4.2, width: 1.85 },
  hatch: { topSpeed: 34, accel: 14, length: 3.8, width: 1.8 },
  taxi: { topSpeed: 36, accel: 15, length: 4.3, width: 1.85 },
  truck: { topSpeed: 29, accel: 11, length: 5.6, width: 2.1 },
  police: { topSpeed: 42, accel: 18, length: 4.4, width: 1.9 },
};

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
wheelGeo.rotateZ(Math.PI / 2);

function lambert(color, opts = {}) {
  return new THREE.MeshLambertMaterial({ color, ...opts });
}

/** Build the mesh for one car kind; forward is +z, the ground is y=0. */
function buildCarMesh(kind, color) {
  const spec = CAR_KINDS[kind];
  const g = new THREE.Group();
  const paint = lambert(kind === 'police' ? 0xf2f2f0 : color);
  const dark = lambert(0x22262e);
  const glass = lambert(0x517b96);

  const body = new THREE.Mesh(boxGeo, paint);
  body.scale.set(spec.width, 0.55, spec.length);
  body.position.y = 0.55;
  body.castShadow = true;
  g.add(body);

  if (kind === 'truck') {
    const cab = new THREE.Mesh(boxGeo, paint);
    cab.scale.set(spec.width, 0.75, 1.3);
    cab.position.set(0, 1.15, spec.length / 2 - 0.75);
    cab.castShadow = true;
    g.add(cab);
    const cargo = new THREE.Mesh(boxGeo, lambert(0xd8d4c8));
    cargo.scale.set(spec.width + 0.1, 1.5, spec.length - 1.7);
    cargo.position.set(0, 1.25, -0.6);
    cargo.castShadow = true;
    g.add(cargo);
  } else {
    const cabin = new THREE.Mesh(boxGeo, kind === 'police' ? dark : glass);
    cabin.scale.set(spec.width - 0.35, 0.5, spec.length * 0.45);
    cabin.position.set(0, 1.05, -0.15);
    cabin.castShadow = true;
    g.add(cabin);
    const hood = new THREE.Mesh(boxGeo, paint);
    hood.scale.set(spec.width - 0.1, 0.16, spec.length * 0.2);
    hood.position.set(0, 0.88, spec.length * 0.36);
    g.add(hood);
  }

  if (kind === 'taxi') {
    const sign = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ color: 0xffd23e }));
    sign.scale.set(0.7, 0.22, 0.3);
    sign.position.set(0, 1.42, -0.15);
    g.add(sign);
  }

  let lightBar = null;
  if (kind === 'police') {
    lightBar = new THREE.Group();
    const base = new THREE.Mesh(boxGeo, dark);
    base.scale.set(1.1, 0.1, 0.34);
    lightBar.add(base);
    const red = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ color: 0xff2a20 }));
    red.scale.set(0.5, 0.14, 0.3);
    red.position.x = -0.28;
    red.position.y = 0.1;
    lightBar.add(red);
    const blue = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ color: 0x2255ff }));
    blue.scale.set(0.5, 0.14, 0.3);
    blue.position.x = 0.28;
    blue.position.y = 0.1;
    lightBar.add(blue);
    lightBar.position.set(0, 1.36, -0.15);
    lightBar.userData = { red, blue };
    g.add(lightBar);
    const stripe = new THREE.Mesh(boxGeo, dark);
    stripe.scale.set(spec.width + 0.02, 0.3, spec.length * 0.5);
    stripe.position.y = 0.55;
    g.add(stripe);
  }

  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6cf });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xd92b1f });
  for (const sx of [-1, 1]) {
    const hl = new THREE.Mesh(boxGeo, headMat);
    hl.scale.set(0.34, 0.14, 0.06);
    hl.position.set(sx * (spec.width / 2 - 0.3), 0.62, spec.length / 2 + 0.01);
    g.add(hl);
    const tl = new THREE.Mesh(boxGeo, tailMat);
    tl.scale.set(0.34, 0.12, 0.06);
    tl.position.set(sx * (spec.width / 2 - 0.3), 0.64, -spec.length / 2 - 0.01);
    g.add(tl);
  }

  const wheels = [];
  const wheelMat = lambert(0x1c1e22);
  for (const [wx, wz, front] of [[-1, 1, 1], [1, 1, 1], [-1, -1, 0], [1, -1, 0]]) {
    const pivot = new THREE.Group();
    pivot.position.set(wx * (spec.width / 2 - 0.05), 0.36, wz * (spec.length / 2 - 0.85));
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.castShadow = true;
    pivot.add(wheel);
    g.add(pivot);
    wheels.push({ pivot, wheel, front: !!front });
  }

  return { group: g, wheels, lightBar, tailMat };
}

/** Create one vehicle and add it to the scene. */
export function createVehicle(scene, kind, color, x, z, heading) {
  const { group, wheels, lightBar, tailMat } = buildCarMesh(kind, color);
  group.position.set(x, 0.05, z);
  group.rotation.y = heading;
  scene.add(group);
  return {
    kind,
    mesh: group,
    wheels,
    lightBar,
    tailMat,
    heading,
    speed: 0,
    vx: 0,
    vz: 0,
    steerAngle: 0,
    radius: CAR.radius,
    driver: null, // null = parked; otherwise 'player', 'traffic' or 'police'
    ai: null,
    dead: false,
    flashPhase: Math.random() * Math.PI * 2,
    get x() { return group.position.x; },
    get z() { return group.position.z; },
  };
}

/**
 * Advance one vehicle by dt under `control` ({throttle: -1..1, steer: -1..1, brake}).
 * Returns the impact speed of any hard collision this step (0 when none), so callers
 * can price the crash in noise, damage and wanted points.
 */
export function updateVehicle(v, dt, control, colliders, others) {
  const spec = CAR_KINDS[v.kind];
  const fx = Math.sin(v.heading);
  const fz = Math.cos(v.heading);
  const rx = fz;
  const rz = -fx;

  // Split velocity into forward and lateral parts; grip bleeds the lateral part away.
  let vf = v.vx * fx + v.vz * fz;
  let vr = v.vx * rx + v.vz * rz;

  const steerTarget = control.steer * CAR.steerMax * (1 - Math.min(Math.abs(vf) / spec.topSpeed, 1) * 0.5);
  v.steerAngle += (steerTarget - v.steerAngle) * Math.min(1, dt * 8);

  if (control.throttle > 0) vf += CAR.accel * (spec.accel / 15) * control.throttle * dt * (1 - Math.max(0, vf) / spec.topSpeed);
  else if (control.throttle < 0) {
    if (vf > 0.6) vf -= CAR.brake * dt;
    else vf = Math.max(vf + CAR.accel * 0.6 * control.throttle * dt, -CAR.reverseMax);
  }
  if (control.brake) vf -= Math.sign(vf) * Math.min(Math.abs(vf), CAR.brake * 1.4 * dt);
  vf -= vf * CAR.drag * 0.12 * dt;
  if (!control.throttle && !control.brake) vf -= Math.sign(vf) * Math.min(Math.abs(vf), CAR.rollDrag * dt);
  vr *= Math.exp(-CAR.grip * dt);

  if (Math.abs(vf) > 0.05) v.heading += (vf / 2.7) * Math.tan(v.steerAngle) * dt * (control.handbrake ? 1.5 : 1);
  if (control.handbrake) vr *= Math.exp(-2.2 * dt);

  const nfx = Math.sin(v.heading);
  const nfz = Math.cos(v.heading);
  const nrx = nfz;
  const nrz = -nfx;
  v.vx = nfx * vf + nrx * vr;
  v.vz = nfz * vf + nrz * vr;
  v.speed = vf;

  let x = v.mesh.position.x + v.vx * dt;
  let z = v.mesh.position.z + v.vz * dt;

  // Buildings: push out and price the hit.
  let impact = 0;
  const before = Math.hypot(v.vx, v.vz);
  [x, z] = collideCircle(colliders, x, z, v.radius);
  const moved = Math.hypot(x - v.mesh.position.x, z - v.mesh.position.z);
  if (moved < Math.hypot(v.vx * dt, v.vz * dt) - 0.02 && before > 4) {
    impact = before;
    v.vx *= 0.35;
    v.vz *= 0.35;
  }

  // Other vehicles: soft circles, share the shove.
  for (const o of others) {
    if (o === v || o.dead) continue;
    const dx = x - o.mesh.position.x;
    const dz = z - o.mesh.position.z;
    const rr = v.radius + o.radius;
    const d2 = dx * dx + dz * dz;
    if (d2 < rr * rr && d2 > 1e-4) {
      const d = Math.sqrt(d2);
      const push = (rr - d) / 2;
      const ux = dx / d;
      const uz = dz / d;
      x += ux * push;
      z += uz * push;
      if (!o.driver || o.driver === 'traffic') {
        o.mesh.position.x -= ux * push * 0.7;
        o.mesh.position.z -= uz * push * 0.7;
      }
      if (before > 5) impact = Math.max(impact, before * 0.7);
      v.vx *= 0.8;
      v.vz *= 0.8;
    }
  }

  const B = 262;
  x = Math.max(-B, Math.min(B, x));
  z = Math.max(-B, Math.min(292, z));
  v.mesh.position.x = x;
  v.mesh.position.z = z;
  v.mesh.rotation.y = v.heading;

  // Wheels and brake lights follow the motion.
  for (const w of v.wheels) {
    w.wheel.rotation.x += (vf * dt) / 0.36;
    if (w.front) w.pivot.rotation.y = v.steerAngle;
  }
  v.tailMat.color.setHex(control.throttle < 0 || control.brake ? 0xff4a3a : 0xd92b1f);
  return impact;
}

/** Flash a police light bar (call every frame for police cars). */
export function updateLightBar(v, elapsed) {
  if (!v.lightBar) return;
  const on = Math.sin(elapsed * 11 + v.flashPhase) > 0;
  v.lightBar.userData.red.material.color.setHex(on ? 0xff2a20 : 0x57120d);
  v.lightBar.userData.blue.material.color.setHex(on ? 0x2255ff : 0x101f57);
}
