// Fighting: a fist that swings on a short arc, a pistol that hitscans from the camera
// with a muzzle flash and a tracer, and the guards the story sends against the player —
// men who close in, take cover in the open the way amateurs do, and shoot back with
// more enthusiasm than aim. Every violent act reports itself so the police can care.

import * as THREE from 'three';
import { animateHumanoid, buildHumanoid } from './pedestrians.js';

export function createCombat(scene, rng, audio, hooks) {
  const raycaster = new THREE.Raycaster();
  const tracers = [];
  const guards = [];
  let cooldown = 0;
  let weapon = 'fists';

  const flashLight = new THREE.PointLight(0xffc873, 0, 9);
  scene.add(flashLight);
  const flashMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 6, 5),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0 }),
  );
  scene.add(flashMesh);

  const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.85 });
  const tracerGeo = new THREE.BoxGeometry(0.03, 0.03, 1);

  function addTracer(from, to) {
    const len = from.distanceTo(to);
    if (len < 0.5) return;
    const m = new THREE.Mesh(tracerGeo, tracerMat.clone());
    m.position.copy(from).lerp(to, 0.5);
    m.scale.z = len;
    m.lookAt(to);
    scene.add(m);
    tracers.push({ mesh: m, life: 0.07 });
  }

  function muzzleAt(pos) {
    flashLight.position.copy(pos);
    flashLight.intensity = 14;
    flashMesh.position.copy(pos);
    flashMesh.material.opacity = 0.95;
    flashMesh.scale.setScalar(1);
  }

  /** Damage a pedestrian; returns true when the hit lands. */
  function hurtPed(ped, dmg, fromX, fromZ) {
    ped.health -= dmg;
    if (ped.health <= 0) hooks.knockDownPed(ped);
    else {
      ped.state = 'flee';
      ped.fleeFrom = { x: fromX, z: fromZ };
      ped.fleeTime = 3.5;
    }
  }

  function hurtGuard(guard, dmg) {
    guard.health -= dmg;
    guard.state = 'combat';
    if (guard.health <= 0 && guard.state !== 'dead') {
      guard.state = 'dead';
      guard.mesh.rotation.x = -Math.PI / 2;
      guard.mesh.position.y = 0.25;
      hooks.onGuardDown?.(guard);
    }
  }

  /**
   * The player's attack, on a mouse click. On foot only. `camera` aims the pistol;
   * fists simply swing at whoever stands in front of the player.
   */
  function attack(player, camera, peds) {
    if (cooldown > 0 || player.mode !== 'foot') return;
    if (weapon === 'fists') {
      cooldown = 0.34;
      player.swing = 0.25;
      audio.punch();
      const fx = Math.sin(player.heading);
      const fz = Math.cos(player.heading);
      let hit = false;
      for (const ped of peds) {
        if (ped.state === 'down') continue;
        const dx = ped.x - player.x;
        const dz = ped.z - player.z;
        if (Math.hypot(dx, dz) < 1.9 && dx * fx + dz * fz > 0.2) {
          hurtPed(ped, 34, player.x, player.z);
          hit = true;
        }
      }
      for (const guard of guards) {
        if (guard.state === 'dead') continue;
        const dx = guard.x - player.x;
        const dz = guard.z - player.z;
        if (Math.hypot(dx, dz) < 1.9 && dx * fx + dz * fz > 0.2) {
          hurtGuard(guard, 30);
          hit = true;
        }
      }
      if (hit) hooks.onCrime(14, player.x, player.z);
      hooks.threat(player.x, player.z, 7);
      return;
    }

    // Pistol.
    cooldown = 0.27;
    player.aiming = 0.35;
    player.swing = 0.1;
    audio.shot();
    const origin = new THREE.Vector3(player.x, 1.42, player.z);
    const gun = origin.clone().add(new THREE.Vector3(Math.sin(player.heading) * 0.45, 0, Math.cos(player.heading) * 0.45));
    muzzleAt(gun);
    raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    raycaster.far = 70;
    const targets = [];
    for (const ped of peds) if (ped.state !== 'down') targets.push(ped.torso);
    for (const guard of guards) if (guard.state !== 'dead') targets.push(guard.torso);
    const hits = raycaster.intersectObjects(targets, false);
    let end;
    if (hits.length) {
      const hit = hits[0];
      end = hit.point;
      const ped = hit.object.userData.ped;
      const guard = hit.object.userData.guard;
      if (ped) { hurtPed(ped, 60, player.x, player.z); hooks.onCrime(26, player.x, player.z); }
      if (guard) hurtGuard(guard, 55);
    } else {
      end = raycaster.ray.at(70, new THREE.Vector3());
    }
    addTracer(gun, end);
    hooks.onCrime(18, player.x, player.z);
    hooks.threat(player.x, player.z, 30);
  }

  /** Add one hostile gunman at (x, z); missions clear them or die trying. */
  function spawnGuard(x, z) {
    const h = buildHumanoid(rng, 0x3a3f47, 0x24262b);
    h.group.position.set(x, 0.16, z);
    scene.add(h.group);
    const guard = {
      mesh: h.group,
      parts: h,
      torso: h.torso,
      health: 100,
      state: 'idle',
      phase: Math.random() * 6,
      fireTimer: 1 + Math.random(),
      strafeDir: Math.random() < 0.5 ? -1 : 1,
      strafeTimer: 2,
      get x() { return h.group.position.x; },
      get z() { return h.group.position.z; },
    };
    h.torso.userData.guard = guard;
    guards.push(guard);
    return guard;
  }

  function guardsAlive() {
    return guards.filter((g) => g.state !== 'dead').length;
  }

  function clearGuards() {
    for (const g of guards) scene.remove(g.mesh);
    guards.length = 0;
  }

  function guardShoot(guard, player) {
    const from = new THREE.Vector3(guard.x, 1.42, guard.z);
    const to = new THREE.Vector3(player.x ?? player.focusPos().x, 1.2, player.z ?? player.focusPos().z);
    // Amateurs: generous spread, worse at range.
    const spread = 0.9 + Math.hypot(to.x - from.x, to.z - from.z) * 0.03;
    to.x += (Math.random() - 0.5) * spread;
    to.z += (Math.random() - 0.5) * spread;
    to.y += (Math.random() - 0.5) * 0.5;
    muzzleAt(from.clone().add(new THREE.Vector3(0, 0, 0)));
    addTracer(from, to);
    audio.shot(0.35);
    const dist = from.distanceTo(new THREE.Vector3(player.focusPos().x, 1.2, player.focusPos().z));
    if (Math.random() < Math.max(0.12, 0.55 - dist * 0.012)) {
      hooks.onPlayerDamage(5 + Math.random() * 6, player.mode === 'car');
    }
  }

  function update(dt, player) {
    cooldown = Math.max(0, cooldown - dt);
    flashLight.intensity = Math.max(0, flashLight.intensity - dt * 160);
    flashMesh.material.opacity = Math.max(0, flashMesh.material.opacity - dt * 12);
    for (let i = tracers.length - 1; i >= 0; i -= 1) {
      tracers[i].life -= dt;
      tracers[i].mesh.material.opacity = Math.max(0, tracers[i].life / 0.07) * 0.85;
      if (tracers[i].life <= 0) {
        scene.remove(tracers[i].mesh);
        tracers.splice(i, 1);
      }
    }

    const fp = player.focusPos();
    for (const guard of guards) {
      if (guard.state === 'dead') continue;
      const dx = fp.x - guard.x;
      const dz = fp.z - guard.z;
      const dist = Math.hypot(dx, dz);
      if (guard.state === 'idle' && dist < 30) guard.state = 'combat';
      if (guard.state !== 'combat') continue;
      guard.mesh.rotation.y = Math.atan2(dx, dz);
      let mx = 0;
      let mz = 0;
      guard.strafeTimer -= dt;
      if (guard.strafeTimer <= 0) { guard.strafeDir *= -1; guard.strafeTimer = 1.4 + Math.random() * 1.6; }
      if (dist > 17) { mx = (dx / dist) * 3.1; mz = (dz / dist) * 3.1; }
      else if (dist < 7) { mx = -(dx / dist) * 2.2; mz = -(dz / dist) * 2.2; }
      else { mx = (-dz / dist) * guard.strafeDir * 1.5; mz = (dx / dist) * guard.strafeDir * 1.5; }
      guard.mesh.position.x += mx * dt;
      guard.mesh.position.z += mz * dt;
      const speed = Math.hypot(mx, mz);
      guard.phase += dt * speed * 2.4;
      animateHumanoid(guard.parts, guard.phase, speed, true);
      guard.fireTimer -= dt;
      if (guard.fireTimer <= 0 && dist < 40) {
        guard.fireTimer = 0.85 + Math.random() * 0.7;
        guardShoot(guard, player);
      }
    }
  }

  return {
    attack,
    update,
    spawnGuard,
    guardsAlive,
    clearGuards,
    guards,
    get weapon() { return weapon; },
    setWeapon(w) { weapon = w; },
  };
}
