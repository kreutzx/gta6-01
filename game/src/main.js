// VERANO HEAT — boot and conductor. Builds the world (city, traffic, pedestrians,
// police, combat, missions), owns the screens and the input, runs the fixed-step
// simulation, keeps the HUD honest, and saves progress. When the URL carries
// ?shot=<name>, it stages that screenshot scene instead of showing the title.

import * as THREE from 'three';
import { STEP, CITY, PALETTE, PLAYER, WORLD_SEED } from './config.js';
import { createRandom } from './random.js';
import { createCity } from './city.js';
import { createVehicle, updateVehicle, updateLightBar, CAR_KINDS } from './vehicles.js';
import { createTraffic } from './traffic.js';
import { createPedestrians } from './pedestrians.js';
import { createPlayer } from './player.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { loadSave, storeSave, clearSave } from './save.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');

// ---------- renderer / scene ----------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(PALETTE.fog, 130, 640);
const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 1500);
camera.position.set(0, 30, 190);

const hemi = new THREE.HemisphereLight(0xbfe0ff, 0xffd9a0, 0.85);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe3b3, 2.3);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -100;
sun.shadow.camera.right = 100;
sun.shadow.camera.top = 100;
sun.shadow.camera.bottom = -100;
sun.shadow.camera.far = 520;
sun.shadow.bias = -0.0006;
scene.add(sun);
scene.add(sun.target);

// ---------- world ----------
const city = createCity(scene, createRandom(WORLD_SEED));
const vehicles = [];
const carRng = createRandom(WORLD_SEED + 7);

function spawnCar(kind, color, x, z, heading) {
  const v = createVehicle(scene, kind, color, x, z, heading);
  vehicles.push(v);
  return v;
}
function removeVehicle(v) {
  scene.remove(v.group);
  const i = vehicles.indexOf(v);
  if (i >= 0) vehicles.splice(i, 1);
}

// Parked cars along the curbs.
{
  let parked = 0;
  for (const spot of city.parkingSpots) {
    if (parked >= 44) break;
    if (!carRng.chance(0.3)) continue;
    const kind = carRng.pick(['sedan', 'sedan', 'hatch', 'coupe', 'truck']);
    spawnCar(kind, carRng.pick(PALETTE.cars), spot.x, spot.z, spot.heading + (carRng.chance(0.5) ? Math.PI : 0));
    parked += 1;
  }
}

const audio = createAudio();
const hud = createHud();
const player = createPlayer(scene, createRandom(WORLD_SEED + 3));
const traffic = createTraffic(scene, city, createRandom(WORLD_SEED + 5), vehicles, 12);
const peds = createPedestrians(scene, city, createRandom(WORLD_SEED + 9), 22);
const police = createPolice(scene, city, createRandom(WORLD_SEED + 11), vehicles, audio);

let mode = 'title'; // title | playing | paused | wasted | busted
let storyMode = true;
let lastStars = 0;
let pendingBusted = false;

const saveData = loadSave() ?? {
  cash: 250,
  missionIndex: 0,
  storyDone: false,
  stats: { carsStolen: 0, missionsDone: 0, timesBusted: 0, timesWasted: 0 },
};

const combat = createCombat(scene, createRandom(WORLD_SEED + 13), audio, {
  onCrime: (points) => police.reportCrime(points),
  threat: (x, z, r) => peds.threat(x, z, r),
  knockDownPed: (ped) => peds.knockDown(ped),
  onPlayerDamage: (dmg) => { player.takeDamage(dmg); },
  onGuardDown: () => hud.toast('Hostile down'),
});

const missions = createMissions({
  scene,
  locations: city.locations,
  player,
  police,
  combat,
  audio,
  spawnMissionCar: (kind, color, x, z, heading) => spawnCar(kind, color, x, z, heading),
  removeVehicle,
  addCash: (n) => { saveData.cash += n; },
  objective: (t, x, d) => hud.objective(t, x, d),
  banner: (t, s) => hud.banner(t, s),
  toast: (m) => hud.toast(m),
  onMissionDone: () => {
    saveData.stats.missionsDone += 1;
    saveData.missionIndex = Math.min(missions.index + 1, missions.total);
    storeSave(saveData);
  },
  onStoryComplete: () => {
    saveData.storyDone = true;
    storeSave(saveData);
    hud.banner('STORY COMPLETE', 'Verano Bay is yours, Rook. The city stays open.');
  },
});

// ---------- screens ----------
const screens = {
  title: document.getElementById('title-screen'),
  pause: document.getElementById('pause-screen'),
  wasted: document.getElementById('wasted-screen'),
  busted: document.getElementById('busted-screen'),
};
function showScreen(name) {
  for (const [key, el] of Object.entries(screens)) el.style.display = key === name ? 'flex' : 'none';
}
document.getElementById('status').style.display = 'none';
if (saveData.missionIndex > 0 && !saveData.storyDone) {
  document.getElementById('btn-continue').style.display = 'block';
  document.getElementById('btn-start').textContent = 'NEW STORY';
}

function startGame(kind) {
  audio.ensure();
  audio.click();
  if (kind === 'new') {
    clearSave();
    saveData.cash = 250;
    saveData.missionIndex = 0;
    saveData.storyDone = false;
    saveData.stats = { carsStolen: 0, missionsDone: 0, timesBusted: 0, timesWasted: 0 };
    player.teleport(city.locations.spawn.x, city.locations.spawn.z, Math.PI);
    police.clearWanted();
    player.heal(1000);
  }
  storyMode = kind !== 'free';
  mode = 'playing';
  showScreen(null);
  hud.show(true);
  if (storyMode && !saveData.storyDone) missions.startMission(saveData.missionIndex);
  else if (storyMode && saveData.storyDone) hud.toast('The story is done — Verano Bay is yours to roam');
  else hud.toast('Free roam — WASD move · F enter car · click to fight · P pause');
  canvas.requestPointerLock?.();
}
document.getElementById('btn-start').addEventListener('click', () => startGame('new'));
document.getElementById('btn-continue').addEventListener('click', () => startGame('continue'));
document.getElementById('btn-free').addEventListener('click', () => startGame('free'));
document.getElementById('btn-resume').addEventListener('click', () => {
  mode = 'playing';
  showScreen(null);
  canvas.requestPointerLock?.();
});
document.getElementById('btn-respawn').addEventListener('click', () => respawnAt(city.locations.hospital));
document.getElementById('btn-bail').addEventListener('click', () => respawnAt(city.locations.policeStation));

function respawnAt(loc) {
  player.teleport(loc.x + 4, loc.z + 6, 0);
  player.heal(1000);
  police.clearWanted();
  missions.onPlayerDown();
  mode = 'playing';
  showScreen(null);
  storeSave(saveData);
  canvas.requestPointerLock?.();
}

function wasted() {
  mode = 'wasted';
  saveData.stats.timesWasted += 1;
  saveData.cash = Math.max(0, saveData.cash - 150);
  audio.stopEngine();
  audio.fail();
  document.exitPointerLock?.();
  showScreen('wasted');
  storeSave(saveData);
}

function busted() {
  mode = 'busted';
  saveData.stats.timesBusted += 1;
  const bail = 100 + lastStars * 60;
  saveData.cash = Math.max(0, saveData.cash - bail);
  document.getElementById('busted-sub').textContent =
    `The VBPD impounds your ride and lightens your wallet by $${bail}.`;
  audio.stopEngine();
  document.exitPointerLock?.();
  showScreen('busted');
  storeSave(saveData);
}

// ---------- input ----------
const keys = new Set();
let interactQueued = false;
let attackQueued = false;
let mouseDX = 0;
let mouseDY = 0;
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyF' && mode === 'playing') interactQueued = true;
  if (e.code === 'KeyM') { audio.setMuted(!audio.muted); hud.toast(audio.muted ? 'Sound off' : 'Sound on'); }
  if (e.code === 'Digit1') combat.setWeapon('fists');
  if (e.code === 'Digit2') combat.setWeapon('pistol');
  if ((e.code === 'KeyP' || e.code === 'Escape') && mode === 'playing') {
    mode = 'paused';
    showScreen('pause');
    document.exitPointerLock?.();
  }
  keys.add(e.code);
  if (['ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
canvas.addEventListener('click', () => {
  if (mode === 'playing' && document.pointerLockElement !== canvas) canvas.requestPointerLock?.();
});
document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement === canvas && mode === 'playing') {
    mouseDX += e.movementX;
    mouseDY += e.movementY;
  }
});
document.addEventListener('mousedown', (e) => {
  if (document.pointerLockElement === canvas && mode === 'playing' && e.button === 0) attackQueued = true;
});
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== canvas && mode === 'playing' && !shotName) {
    mode = 'paused';
    showScreen('pause');
  }
});

function liveControl() {
  const ctl = {
    foot: { mx: 0, mz: 0, sprint: keys.has('ShiftLeft') || keys.has('ShiftRight') },
    car: { throttle: 0, steer: 0, brake: false, handbrake: keys.has('Space') },
    attack: attackQueued,
    interact: interactQueued,
  };
  attackQueued = false;
  interactQueued = false;
  const f = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
  const r = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
  const sy = Math.sin(player.camYaw);
  const cy = Math.cos(player.camYaw);
  ctl.foot.mx = (-sy) * f + cy * r;
  ctl.foot.mz = (-cy) * f + (-sy) * r;
  if (player.mode === 'car' && player.vehicle) {
    const v = player.vehicle;
    if (f > 0) ctl.car.throttle = 1;
    else if (f < 0) { if (v.speed > 0.6) ctl.car.brake = true; else ctl.car.throttle = -0.55; }
    ctl.car.steer = r;
  }
  return ctl;
}

// ---------- simulation ----------
let elapsed = 0;
let gameMinutes = 10 * 60 + 24;
let crimeCooldown = 0;
let minimapTimer = 0;

function zoneName(x, z) {
  if (z > CITY.beachZ) return 'Verano Beach';
  if (x > 168) return 'The Docks';
  if (Math.abs(x) < 72 && Math.abs(z) < 72) return 'Downtown';
  if (z > 140) return 'The Marina';
  if (x < -120) return 'Westside';
  return 'Verano Bay';
}

function stepGame(dt, ctl) {
  elapsed += dt;
  gameMinutes += dt * 2.2;
  crimeCooldown = Math.max(0, crimeCooldown - dt);
  const focus = player.focusPos();

  if (ctl.interact) {
    if (player.mode === 'car') {
      player.exitCar(city.colliders);
      audio.stopEngine();
    } else {
      let best = null;
      let bestD = PLAYER.enterRange;
      for (const v of vehicles) {
        if (v.driver === 'player') continue;
        const d = Math.hypot(v.x - focus.x, v.z - focus.z);
        if (d < bestD) { bestD = d; best = v; }
      }
      if (best) {
        const wasTraffic = best.driver === 'traffic';
        player.enterCar(best);
        audio.ensure();
        audio.startEngine();
        if (wasTraffic) {
          saveData.stats.carsStolen += 1;
          police.reportCrime(25);
          hud.toast('Vehicle stolen');
        } else if (best.kind === 'police') {
          saveData.stats.carsStolen += 1;
          police.reportCrime(45);
          hud.toast('You just stole a police cruiser. Bold.');
        }
      }
    }
  }

  if (player.mode === 'car' && player.vehicle) {
    const impact = updateVehicle(player.vehicle, dt, ctl.car, city.colliders, vehicles);
    const v = player.vehicle;
    audio.setEngine(Math.min(1, Math.abs(v.speed) / CAR_KINDS[v.kind].topSpeed), ctl.car.throttle !== 0 ? 1 : 0.3);
    if (impact > 9 && crimeCooldown <= 0) {
      audio.punch();
      police.reportCrime(10);
      crimeCooldown = 1.2;
    }
    hud.setSpeedo(Math.round(Math.abs(v.speed) * 3.6) + ' km/h');
  } else {
    player.update(dt, { mx: ctl.foot.mx, mz: ctl.foot.mz, sprint: ctl.foot.sprint }, city.colliders, vehicles);
    if (ctl.attack) combat.attack(player, camera, peds.list);
    hud.setSpeedo(null);
  }

  // Cars versus pedestrians.
  for (const v of vehicles) {
    if (Math.abs(v.speed) < 4.5) continue;
    for (const ped of peds.list) {
      if (ped.state === 'down') continue;
      if (Math.hypot(ped.x - v.x, ped.z - v.z) < CAR_KINDS[v.kind].width / 2 + 0.8) {
        peds.knockDown(ped);
        audio.punch();
        if (v.driver === 'player' && crimeCooldown <= 0) {
          police.reportCrime(35);
          crimeCooldown = 1.2;
        }
      }
    }
  }

  traffic.update(dt, focus, peds.list, city.colliders);
  peds.update(dt, focus);
  lastStars = police.stars;
  police.update(dt, player, city.colliders, () => { pendingBusted = true; });
  if (pendingBusted) { pendingBusted = false; busted(); return; }
  combat.update(dt, player);
  if (storyMode) missions.update(dt);
  city.update(dt, elapsed);

  if (player.health <= 0 && mode === 'playing') { wasted(); return; }

  // HUD refresh.
  hud.setCash(saveData.cash);
  hud.setWanted(police.stars);
  hud.setHealth(player.health / PLAYER.maxHealth);
  const hh = String(Math.floor(gameMinutes / 60) % 24).padStart(2, '0');
  const mm = String(Math.floor(gameMinutes) % 60).padStart(2, '0');
  hud.setClock(`${hh}:${mm}`);
  hud.setZone(zoneName(focus.x, focus.z));
  hud.setWeapon(player.mode === 'car' ? null : (combat.weapon === 'pistol' ? 'PISTOL · ∞' : 'FISTS'), player.mode === 'car');
  hud.bustedBar(police.bustedProgress);

  // The interaction prompt.
  if (player.mode === 'car') hud.prompt('F', 'Exit vehicle · Space handbrake');
  else {
    let near = false;
    for (const v of vehicles) {
      if (Math.hypot(v.x - focus.x, v.z - focus.z) < PLAYER.enterRange) { near = true; break; }
    }
    hud.prompt(near ? 'F' : null, 'Enter vehicle');
  }

  // Sun + shadow frustum follow the player.
  sun.position.set(focus.x + 130, 190, focus.z + 70);
  sun.target.position.set(focus.x, 0, focus.z);

  // The minimap redraws at ~8 Hz — plenty for a map, kinder to the frame budget.
  minimapTimer -= dt;
  if (minimapTimer <= 0) {
    minimapTimer = 0.12;
    hud.drawMinimap({
      player: { x: focus.x, z: focus.z, heading: player.heading },
      traffic: vehicles.filter((v) => v.driver === 'traffic'),
      police: police.cars,
      hostiles: combat.guards,
      marker: storyMode ? missions.markerPos() : null,
    });
  }
}

function stepAmbient(dt) {
  elapsed += dt;
  const focus = player.focusPos();
  traffic.update(dt, focus, peds.list, city.colliders);
  peds.update(dt, focus);
  city.update(dt, elapsed);
  for (const v of vehicles) if (v.kind === 'police') updateLightBar(v, elapsed);
}

// ---------- camera helpers ----------
function snapCamera(yaw, pitch, dist) {
  const focus = player.focusPos();
  const cx = focus.x + Math.sin(yaw) * Math.cos(pitch) * dist;
  const cz = focus.z + Math.cos(yaw) * Math.cos(pitch) * dist;
  const cyy = focus.y + Math.sin(pitch) * dist + 1.1;
  camera.position.set(cx, Math.max(cyy, 1.2), cz);
  camera.lookAt(focus.x, focus.y + 1.2, focus.z);
}

// ---------- main loop ----------
let last = performance.now();
let accumulator = 0;
let saveTimer = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (mode === 'playing') {
    const yawDelta = mouseDX * 0.0026;
    const pitchDelta = mouseDY * 0.0021;
    mouseDX = 0;
    mouseDY = 0;
    accumulator += dt;
    while (accumulator >= STEP) {
      stepGame(STEP, liveControl());
      accumulator -= STEP;
      if (mode !== 'playing') { accumulator = 0; break; }
    }
    if (mode === 'playing') player.updateCamera(camera, Math.min(dt, 0.05), { yawDelta, pitchDelta });
    saveTimer += dt;
    if (saveTimer > 15) { saveTimer = 0; storeSave(saveData); }
  } else if (mode === 'title') {
    stepAmbient(dt);
    const t = now / 1000;
    camera.position.set(Math.sin(t * 0.05) * 150, 42, 120 + Math.cos(t * 0.05) * 60);
    camera.lookAt(0, 8, -10);
  }
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});


// ---------- screenshot mode ----------
const G = {
  scene, camera, renderer, city, player, vehicles, traffic, peds, police, combat, missions, hud, audio, spawnCar,
};

if (shotName) {
  showScreen(null);
  hud.show(true);
  storyMode = true;
  mode = 'playing';
  const spec = stageShot(shotName, G);
  for (let i = 0; i < spec.steps; i += 1) {
    const ctl = spec.script(i / 30, i, spec.steps);
    ctl.interact = false;
    stepGame(1 / 30, ctl);
    for (const v of vehicles) if (v.kind === 'police') updateLightBar(v, elapsed);
    if (mode !== 'playing') break;
  }
  mode = 'playing';
  showScreen(null);
  hud.show(true);
  snapCamera(spec.cam.yaw, spec.cam.pitch, spec.cam.dist);
  renderer.render(scene, camera);
  renderer.render(scene, camera);
  window.__shotReady = true;
} else {
  showScreen('title');
  requestAnimationFrame(frame);
}
