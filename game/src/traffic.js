// Ambient traffic: AI drivers who follow Verano Bay's lanes — right-hand offsets on the
// road grid, turns at intersections, braking for the car ahead and for pedestrians on
// the asphalt. Cars spawn far from the focus and are quietly recycled when left behind,
// so the streets near the player always feel lived in. Any of these cars can be stolen;
// when the player takes one, traffic releases it.

import { CITY, PALETTE } from './config.js';
import { ROAD_LINES } from './city.js';
import { createVehicle, updateVehicle } from './vehicles.js';

const KINDS = ['sedan', 'sedan', 'coupe', 'hatch', 'taxi', 'truck'];

/** The lane centre for a car travelling (dx, dz) on the road whose centre line is `line`. */
function laneCenter(line, dx, dz) {
  if (dz === 1) return line + CITY.lane;   // heading +z keeps to x = line + lane
  if (dz === -1) return line - CITY.lane;  // heading -z
  if (dx === 1) return line - CITY.lane;   // heading +x keeps to z = line - lane
  return line + CITY.lane;                 // heading -x
}

export function createTraffic(scene, city, rng, vehicles, count = 14) {
  const cars = [];

  function spawnCar(focus) {
    for (let tries = 0; tries < 12; tries += 1) {
      const vertical = rng.chance(0.5);
      const line = rng.pick(ROAD_LINES);
      const along = rng.range(-CITY.grid * CITY.pitch + 10, CITY.grid * CITY.pitch - 10);
      const dirSign = rng.chance(0.5) ? 1 : -1;
      const dx = vertical ? 0 : dirSign;
      const dz = vertical ? dirSign : 0;
      const cross = laneCenter(line, dx, dz);
      const x = vertical ? cross : along;
      const z = vertical ? along : cross;
      if (focus && Math.hypot(x - focus.x, z - focus.z) < 55) continue;
      if (z > CITY.beachZ) continue;
      const kind = rng.pick(KINDS);
      const color = kind === 'taxi' ? 0xf2b134 : rng.pick(PALETTE.cars);
      const v = createVehicle(scene, kind, color, x, z, Math.atan2(dx, dz));
      v.driver = 'traffic';
      v.ai = { dx, dz, line, cruise: rng.range(9.5, 13), turnCooldown: 0 };
      vehicles.push(v);
      cars.push(v);
      return v;
    }
    return null;
  }

  function nearestLineAhead(v) {
    // Distance to the next perpendicular road line the car is driving toward.
    const { dx, dz } = v.ai;
    let best = Infinity;
    for (const line of ROAD_LINES) {
      const d = dz !== 0 ? (line - v.z) * dz : (line - v.x) * dx;
      if (d > 2 && d < best) best = d;
    }
    return best;
  }

  function update(dt, focus, peds, colliders) {
    // Keep the fleet at strength near the focus.
    for (let i = cars.length - 1; i >= 0; i -= 1) {
      const v = cars[i];
      if (v.driver !== 'traffic') { cars.splice(i, 1); continue; }
      if (focus && Math.hypot(v.x - focus.x, v.z - focus.z) > 250) {
        scene.remove(v.mesh);
        vehicles.splice(vehicles.indexOf(v), 1);
        cars.splice(i, 1);
      }
    }
    while (cars.length < count) { if (!spawnCar(focus)) break; }

    for (const v of cars) {
      const ai = v.ai;
      ai.turnCooldown = Math.max(0, ai.turnCooldown - dt);

      // Maybe turn at the next intersection.
      const ahead = nearestLineAhead(v);
      if (ahead < 7 && ai.turnCooldown <= 0) {
        ai.turnCooldown = 2.5;
        const roll = rng.next();
        if (roll < 0.42) {
          const left = roll < 0.21;
          const { dx, dz } = ai;
          const ndx = left ? dz : -dz;
          const ndz = left ? -dx : dx;
          // The road we are about to cross becomes the new road.
          const crossLine = dz !== 0 ? v.z + ahead * dz : v.x + ahead * dx;
          ai.dx = ndx;
          ai.dz = ndz;
          ai.line = Math.round(crossLine / CITY.pitch) * CITY.pitch;
        }
      }

      // Lookahead point on our lane, a little ahead of the car.
      const cross = laneCenter(ai.line, ai.dx, ai.dz);
      const look = 9;
      const tx = ai.dz !== 0 ? cross : v.x + ai.dx * look;
      const tz = ai.dz !== 0 ? v.z + ai.dz * look : cross;
      const desired = Math.atan2(tx - v.x, tz - v.z);
      let diff = desired - v.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const steer = Math.max(-1, Math.min(1, diff * 1.6));

      // Slow for whatever is ahead: another car, or a pedestrian on the road.
      let targetSpeed = ai.cruise * (1 - Math.min(Math.abs(diff) * 0.55, 0.6));
      const fx = Math.sin(v.heading);
      const fz = Math.cos(v.heading);
      for (const o of vehicles) {
        if (o === v) continue;
        const ox = o.x - v.x;
        const oz = o.z - v.z;
        const fwd = ox * fx + oz * fz;
        const lat = Math.abs(ox * fz - oz * fx);
        if (fwd > 0 && fwd < 9 && lat < 1.9) targetSpeed = Math.min(targetSpeed, Math.max(0, (fwd - 5.5) * 1.6));
      }
      for (const p of peds) {
        if (p.state === 'down') continue;
        const ox = p.x - v.x;
        const oz = p.z - v.z;
        const fwd = ox * fx + oz * fz;
        const lat = Math.abs(ox * fz - oz * fx);
        if (fwd > 0 && fwd < 7 && lat < 1.8) targetSpeed = 0;
      }

      const throttle = v.speed < targetSpeed ? 0.75 : -0.4;
      updateVehicle(v, dt, { throttle, steer, brake: targetSpeed === 0 && v.speed > 0.5 }, colliders, vehicles);
    }
  }

  return { update, cars };
}
