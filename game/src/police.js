// The VBPD: a wanted level fed by reported crimes, and pursuit cars that spawn on the
// roads around the player, hunt the player's position, and try to hold the player
// still long enough to fill the busted meter. Lose sight of the player long enough
// and the heat bleeds away, star by star.

import { CITY, WANTED } from './config.js';
import { ROAD_LINES } from './city.js';
import { createVehicle, updateLightBar, updateVehicle } from './vehicles.js';

export function createPolice(scene, city, rng, vehicles, audio) {
  const cars = [];
  let heat = 0;
  let sawTimer = 0;
  let bustedProgress = 0;
  let elapsed = 0;

  const stars = () => Math.max(0, Math.min(WANTED.maxStars, Math.ceil(heat / WANTED.perStar)));

  function reportCrime(points) {
    heat = Math.min(WANTED.maxStars * WANTED.perStar, heat + points);
  }

  function setWanted(level) {
    heat = level <= 0 ? 0 : (level - 1) * WANTED.perStar + 1;
  }

  function clearWanted() {
    heat = 0;
    bustedProgress = 0;
  }

  function nearestRoadPoint(x, z) {
    let bx = x;
    let bz = z;
    let best = Infinity;
    for (const line of ROAD_LINES) {
      if (Math.abs(line - x) < best) { best = Math.abs(line - x); bx = line; bz = z; }
    }
    for (const line of ROAD_LINES) {
      if (Math.abs(line - z) < best) { best = Math.abs(line - z); bx = x; bz = line; }
    }
    return { x: bx, z: bz };
  }

  function spawnCop(focus) {
    for (let tries = 0; tries < 10; tries += 1) {
      const vertical = rng.chance(0.5);
      const line = rng.pick(ROAD_LINES);
      const along = Math.max(-250, Math.min(250, (vertical ? focus.z : focus.x) + rng.range(65, 105) * (rng.chance(0.5) ? -1 : 1)));
      const x = vertical ? line : along;
      const z = vertical ? along : line;
      if (Math.hypot(x - focus.x, z - focus.z) < 55) continue;
      if (z > CITY.beachZ) continue;
      const v = createVehicle(scene, 'police', 0xf2f2f0, x, z, rng.range(0, Math.PI * 2));
      v.driver = 'police';
      vehicles.push(v);
      cars.push(v);
      return v;
    }
    return null;
  }

  function removeCop(v) {
    scene.remove(v.mesh);
    const vi = vehicles.indexOf(v);
    if (vi >= 0) vehicles.splice(vi, 1);
    const ci = cars.indexOf(v);
    if (ci >= 0) cars.splice(ci, 1);
  }

  function steerToward(v, tx, tz, dt, topSpeed) {
    const desired = Math.atan2(tx - v.x, tz - v.z);
    let diff = desired - v.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, diff * 1.9));
    const dist = Math.hypot(tx - v.x, tz - v.z);
    let throttle = 1;
    if (Math.abs(diff) > 2.2) throttle = -0.5; // turn around rather than orbit
    else if (Math.abs(diff) > 1.1) throttle = 0.35;
    if (dist < 7) throttle = Math.min(throttle, 0.4);
    if (v.speed > topSpeed) throttle = Math.min(throttle, 0);
    return { throttle, steer, brake: false };
  }

  function update(dt, player, colliders, onBusted) {
    elapsed += dt;
    const focus = player.focusPos();
    const level = stars();

    // Sight and decay.
    let seen = false;
    for (const v of cars) {
      if (Math.hypot(v.x - focus.x, v.z - focus.z) < 58) { seen = true; break; }
    }
    if (player.mode === 'car' && level > 0 && Math.abs(player.vehicle?.speed ?? 0) > 3) seen = true;
    if (seen) sawTimer = 0;
    else sawTimer += dt;
    if (level > 0 && sawTimer > WANTED.decayDelay) {
      heat = Math.max(0, heat - WANTED.decayRate * dt);
      if (heat === 0) bustedProgress = 0;
    }

    // Fleet size follows the stars.
    const wanted = WANTED.policeByStar[stars()];
    if (cars.length < wanted) spawnCop(focus);
    for (let i = cars.length - 1; i >= 0; i -= 1) {
      const v = cars[i];
      const d = Math.hypot(v.x - focus.x, v.z - focus.z);
      if ((stars() === 0 && d > 130) || d > 260) removeCop(v);
    }

    // Sirens follow the nearest unit.
    let nearest = Infinity;
    for (const v of cars) nearest = Math.min(nearest, Math.hypot(v.x - focus.x, v.z - focus.z));
    audio.setSiren(stars() > 0 && cars.length > 0, nearest);

    // The busted meter: an officer close to a slow or on-foot player fills it.
    let closeCop = false;
    for (const v of cars) {
      if (Math.hypot(v.x - focus.x, v.z - focus.z) < 6.2) { closeCop = true; break; }
    }
    const playerSlow = player.mode === 'foot' || Math.abs(player.vehicle?.speed ?? 0) < 1.4;
    if (stars() > 0 && closeCop && playerSlow) bustedProgress = Math.min(1, bustedProgress + dt * 0.45);
    else bustedProgress = Math.max(0, bustedProgress - dt * 0.6);
    if (bustedProgress >= 1) {
      clearWanted();
      for (let i = cars.length - 1; i >= 0; i -= 1) removeCop(cars[i]);
      onBusted();
      return;
    }

    // Drive the pursuit.
    for (const v of cars) {
      updateLightBar(v, elapsed);
      if (stars() === 0) {
        // Called off: cruise ahead and leave.
        updateVehicle(v, dt, { throttle: 0.5, steer: 0, brake: false }, colliders, vehicles);
        continue;
      }
      let tx = focus.x;
      let tz = focus.z;
      const d = Math.hypot(tx - v.x, tz - v.z);
      if (d > 38 && !city.isRoad(v.x, v.z)) {
        const rp = nearestRoadPoint(focus.x, focus.z);
        tx = rp.x;
        tz = rp.z;
      }
      // Aim a touch ahead of a moving player.
      if (player.mode === 'car' && player.vehicle) {
        tx += Math.sin(player.vehicle.heading) * Math.abs(player.vehicle.speed) * 0.45;
        tz += Math.cos(player.vehicle.heading) * Math.abs(player.vehicle.speed) * 0.45;
      }
      const top = stars() >= 4 ? 41 : 38;
      const control = steerToward(v, tx, tz, dt, top);
      // Sit on the player when alongside and the player is stopped: block, don't ram forever.
      if (d < 4.5 && playerSlow) { control.throttle = 0; control.brake = true; }
      updateVehicle(v, dt, control, colliders, vehicles);
    }
  }

  return {
    update,
    reportCrime,
    setWanted,
    clearWanted,
    cars,
    get stars() { return stars(); },
    get heat() { return heat; },
    get bustedProgress() { return bustedProgress; },
    get anyClose() { return bustedProgress > 0.02; },
  };
}
