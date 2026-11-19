// Rook, the player character: on-foot movement with a mouse-orbit third-person camera,
// climbing into any car (which hides the character and hands the camera to a chase rig),
// and the little things — a swing timer for punches, an aiming pose for the pistol, and
// health with a slow recovery when the heat is off.

import * as THREE from 'three';
import { CITY, PLAYER } from './config.js';
import { animateHumanoid, buildHumanoid } from './pedestrians.js';
import { collideCircle } from './city.js';

export function createPlayer(scene, rng) {
  const parts = buildHumanoid(rng, 0x2ec4b6, 0x30343c);
  scene.add(parts.group);

  const player = {
    mesh: parts.group,
    parts,
    mode: 'foot', // 'foot' | 'car'
    vehicle: null,
    health: PLAYER.maxHealth,
    heading: Math.PI,
    phase: 0,
    swing: 0,
    aiming: 0,
    camYaw: Math.PI,
    camPitch: 0.32,
    camDist: 6.5,
    regenDelay: 0,
    get x() { return parts.group.position.x; },
    get z() { return parts.group.position.z; },

    teleport(x, z, heading = 0) {
      parts.group.position.set(x, 0.16, z);
      this.heading = heading;
      this.camYaw = heading + Math.PI;
      parts.group.rotation.y = heading;
    },

    /** The position other systems aim at: the character, or the car being driven. */
    focusPos() {
      if (this.mode === 'car' && this.vehicle) {
        return { x: this.vehicle.x, z: this.vehicle.z, y: 1 };
      }
      return { x: this.x, z: this.z, y: 1.2 };
    },

    speedNow() {
      if (this.mode === 'car' && this.vehicle) return Math.abs(this.vehicle.speed);
      return this._footSpeed ?? 0;
    },

    enterCar(v) {
      this.mode = 'car';
      this.vehicle = v;
      v.driver = 'player';
      parts.group.visible = false;
      this.camDist = 9.5;
    },

    exitCar(colliders) {
      const v = this.vehicle;
      if (!v) return;
      v.driver = null;
      this.mode = 'foot';
      this.vehicle = null;
      // Step out on the car's left side.
      const sx = v.x + Math.cos(v.heading) * -2.1;
      const sz = v.z + Math.sin(v.heading) * 2.1;
      const [x, z] = collideCircle(colliders, sx, sz, PLAYER.radius);
      parts.group.position.set(x, 0.16, z);
      parts.group.visible = true;
      this.heading = v.heading;
      this.camDist = 6.5;
    },

    takeDamage(amount) {
      this.health = Math.max(0, this.health - amount);
      this.regenDelay = 5;
      return this.health <= 0;
    },

    heal(amount) {
      this.health = Math.min(PLAYER.maxHealth, this.health + amount);
    },

    /** On-foot movement. input: {mx, mz} wish direction in world space, sprint flag. */
    update(dt, input, colliders, vehicles) {
      if (this.mode !== 'foot') return;
      const wish = Math.hypot(input.mx, input.mz);
      let vx = 0;
      let vz = 0;
      if (wish > 0.01) {
        const speed = input.sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
        vx = (input.mx / wish) * speed * Math.min(wish, 1);
        vz = (input.mz / wish) * speed * Math.min(wish, 1);
        const target = Math.atan2(vx, vz);
        let diff = target - this.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.heading += diff * Math.min(1, dt * 14);
      }
      let x = this.x + vx * dt;
      let z = this.z + vz * dt;
      [x, z] = collideCircle(colliders, x, z, PLAYER.radius);
      // Cars are solid to walk into.
      for (const v of vehicles) {
        const dx = x - v.x;
        const dz = z - v.z;
        const rr = PLAYER.radius + 1.35;
        const d2 = dx * dx + dz * dz;
        if (d2 < rr * rr && d2 > 1e-4) {
          const d = Math.sqrt(d2);
          x = v.x + (dx / d) * rr;
          z = v.z + (dz / d) * rr;
        }
      }
      x = Math.max(-CITY.bound, Math.min(CITY.bound, x));
      z = Math.max(-CITY.bound, Math.min(CITY.waterZ + 14, z));
      parts.group.position.x = x;
      parts.group.position.z = z;
      parts.group.rotation.y = this.heading;
      this._footSpeed = Math.hypot(vx, vz);
      this.phase += dt * this._footSpeed * 2.4;
      this.swing = Math.max(0, this.swing - dt);
      this.aiming = Math.max(0, this.aiming - dt);
      animateHumanoid(parts, this.phase, this._footSpeed, this.aiming > 0);
      if (this.swing > 0) parts.armR.rotation.x = -2.2 * Math.sin((this.swing / 0.25) * Math.PI);

      // Slow health recovery once the shooting stops.
      this.regenDelay = Math.max(0, this.regenDelay - dt);
      if (this.regenDelay <= 0 && this.health > 0) this.heal(dt * 3.5);
    },

    /** Third-person camera: mouse orbit on foot, a chase rig that settles behind the car. */
    updateCamera(camera, dt, input) {
      this.camYaw -= (input.yawDelta ?? 0);
      this.camPitch = Math.max(0.05, Math.min(1.15, this.camPitch + (input.pitchDelta ?? 0)));
      const focus = this.focusPos();
      if (this.mode === 'car' && this.vehicle) {
        // Settle behind the car unless the player is actively orbiting.
        const behind = this.vehicle.heading + Math.PI;
        let diff = behind - this.camYaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const settle = Math.abs(this.vehicle.speed) > 2 ? 1.6 : 0.25;
        if (Math.abs(input.yawDelta ?? 0) < 0.001) this.camYaw += diff * Math.min(1, dt * settle);
        this.camPitch += (0.3 - this.camPitch) * Math.min(1, dt * 2);
      }
      const d = this.mode === 'car' ? 9.5 : 6.5;
      const cx = focus.x + Math.sin(this.camYaw) * Math.cos(this.camPitch) * d;
      const cz = focus.z + Math.cos(this.camYaw) * Math.cos(this.camPitch) * d;
      const cy = focus.y + Math.sin(this.camPitch) * d + 0.6;
      camera.position.x += (cx - camera.position.x) * Math.min(1, dt * 10);
      camera.position.y += (cy - camera.position.y) * Math.min(1, dt * 10);
      camera.position.z += (cz - camera.position.z) * Math.min(1, dt * 10);
      camera.lookAt(focus.x, focus.y + 0.4, focus.z);
    },
  };

  player.teleport(-52, 208, Math.PI);
  return player;
}
