// The story: four jobs for Marina Sol, the marina fixer who runs Verano Bay's quiet
// economy. A small stage interpreter drives them — go somewhere, steal a named car,
// deliver against the clock, hold a bank lobby, lose the police, clear a warehouse —
// with a glowing marker in the world, the objective on the HUD and the distance on
// the minimap. Finishing a job pays, saves, and unlocks the next.

import * as THREE from 'three';

const MISSIONS = [
  {
    id: 'welcome',
    title: 'WELCOME TO VERANO',
    intro: 'Marina Sol has work for a driver who does not ask questions.',
    reward: 450,
    stages: [
      { type: 'goto', at: 'marinaCafe', radius: 5, text: 'Meet Marina outside Café Sol' },
      { type: 'steal', text: 'Take the teal Solstice parked by the marina' },
      { type: 'deliver', at: 'garage', radius: 7.5, text: 'Bring the Solstice to Sol Customs' },
    ],
  },
  {
    id: 'pharmacy',
    title: 'NIGHT PHARMACY',
    intro: 'A package came in on the night tide. Marina wants it moved, quickly.',
    reward: 800,
    stages: [
      { type: 'goto', at: 'docks', radius: 6, text: 'Pick up the package at the docks', onArrive: 'heat2' },
      { type: 'goto', at: 'motel', radius: 7, text: 'Deliver it to the Palms Motel', timeLimit: 150 },
    ],
  },
  {
    id: 'loud-money',
    title: 'LOUD MONEY',
    intro: 'Verano Trust keeps its vault door polite and its lobby quiet. Today, neither.',
    reward: 1500,
    stages: [
      { type: 'goto', at: 'bank', radius: 5, text: 'Walk into Verano Trust', foot: true },
      { type: 'hold', at: 'bank', radius: 5, seconds: 6, text: 'Stay in the circle and fill the bag', onDone: 'heat3' },
      { type: 'escape', text: 'Lose the VBPD' },
    ],
  },
  {
    id: 'harbor-heat',
    title: 'HARBOR HEAT',
    intro: 'A rival crew is sitting on Marina’s cash at the dock warehouse. Take it back.',
    reward: 2600,
    stages: [
      { type: 'goto', at: 'warehouse', radius: 9, text: 'Go to the dock warehouse' },
      { type: 'shootout', at: 'warehouse', count: 5, text: 'Clear the warehouse crew' },
      { type: 'goto', at: 'warehouse', radius: 3.6, text: 'Grab the cash case', foot: true, onArrive: 'heat3' },
      { type: 'goto', at: 'safehouse', radius: 7, text: 'Get to the safehouse by the beach' },
    ],
  },
];

export function createMissions(api) {
  const { scene, locations } = api;

  // The objective marker: a pillar of light and a ring on the ground.
  const markerMat = new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.3, depthWrite: false });
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 34, 18, 1, true), markerMat);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.7, 2.2, 28),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  pillar.visible = false;
  ring.visible = false;
  scene.add(pillar);
  scene.add(ring);

  let missionIndex = 0;
  let stageIndex = 0;
  let active = false;
  let done = false;
  let stageTime = 0;
  let holdProgress = 0;
  let missionCar = null;
  let elapsed = 0;

  const mission = () => MISSIONS[missionIndex];
  const stage = () => mission()?.stages[stageIndex];

  function setMarker(x, z) {
    if (x == null) {
      pillar.visible = false;
      ring.visible = false;
      return;
    }
    pillar.position.set(x, 17, z);
    ring.position.set(x, 0.24, z);
    pillar.visible = true;
    ring.visible = true;
  }

  function stagePoint(st) {
    if (st.type === 'steal' && missionCar) return { x: missionCar.x, z: missionCar.z };
    if (st.at) return locations[st.at];
    return null;
  }

  function startStage() {
    const st = stage();
    stageTime = 0;
    holdProgress = 0;
    if (!st) return;
    if (st.type === 'steal') {
      missionCar = api.spawnMissionCar('coupe', 0x2ec4b6, -76, 176, 0.7);
    }
    if (st.type === 'deliver' && missionCar) {
      // The deliver stage always refers to the car stolen in the stage before.
    }
    if (st.type === 'shootout') {
      api.combat.clearGuards();
      const c = locations[st.at];
      const spots = [[-9, -7], [7, -11], [12, 5], [-13, 8], [0, 13]];
      for (let i = 0; i < st.count; i += 1) api.combat.spawnGuard(c.x + spots[i][0], c.z + spots[i][1]);
      api.toast('The crew is waiting — clear them out');
    }
    refreshObjective(0);
  }

  function startMission(index, announce = true) {
    missionIndex = index;
    stageIndex = 0;
    const m = mission();
    if (!m) { done = true; active = false; return; }
    active = true;
    if (announce) api.banner(m.title, m.intro);
    startStage();
  }

  function completeStage() {
    const st = stage();
    if (st?.onArrive === 'heat2' || st?.onDone === 'heat2') api.police.setWanted(Math.max(api.police.stars, 2));
    if (st?.onArrive === 'heat3' || st?.onDone === 'heat3') api.police.setWanted(Math.max(api.police.stars, 3));
    stageIndex += 1;
    if (stageIndex >= mission().stages.length) completeMission();
    else {
      api.audio.pickup();
      startStage();
    }
  }

  function completeMission() {
    const m = mission();
    api.addCash(m.reward);
    api.audio.complete();
    api.banner('MISSION COMPLETE', `${m.title} · +$${m.reward.toLocaleString('en-US')}`);
    api.onMissionDone(m);
    if (missionCar && missionCar.driver !== 'player') missionCar = null;
    const next = missionIndex + 1;
    if (next >= MISSIONS.length) {
      done = true;
      active = false;
      setMarker(null);
      api.objective('', '');
      api.onStoryComplete();
    } else {
      startMission(next);
    }
  }

  function failStage(reason) {
    api.audio.fail();
    api.toast(reason + ' — the job restarts');
    if (missionCar && missionCar.driver !== 'player') {
      api.removeVehicle(missionCar);
      missionCar = null;
    }
    stageIndex = 0;
    startStage();
  }

  function refreshObjective(dist) {
    const st = stage();
    if (!active || !st) { api.objective('', ''); return; }
    let text = st.text;
    if (st.type === 'hold') text += ` — ${Math.max(0, st.seconds - holdProgress).toFixed(0)}s`;
    if (st.timeLimit) text += ` — ${Math.max(0, st.timeLimit - stageTime).toFixed(0)}s left`;
    if (st.type === 'escape') text = 'Lose the VBPD — break their line of sight';
    api.objective(mission().title, text, dist);
  }

  function update(dt) {
    elapsed += dt;
    markerMat.opacity = 0.24 + Math.sin(elapsed * 3.2) * 0.08;
    if (!active) return;
    const st = stage();
    if (!st) return;
    const fp = api.player.focusPos();
    const point = stagePoint(st);
    if (point) setMarker(point.x, point.z);
    else setMarker(null);
    const dist = point ? Math.hypot(fp.x - point.x, fp.z - point.z) : null;
    refreshObjective(dist);
    stageTime += dt;

    if (st.timeLimit && stageTime > st.timeLimit) {
      failStage('Out of time');
      return;
    }

    switch (st.type) {
      case 'goto': {
        if (dist != null && dist < st.radius && (!st.foot || api.player.mode === 'foot')) completeStage();
        break;
      }
      case 'steal': {
        if (missionCar && api.player.mode === 'car' && api.player.vehicle === missionCar) {
          api.toast('Wheels up. Marina is already smiling');
          completeStage();
        }
        break;
      }
      case 'deliver': {
        if (missionCar && api.player.mode === 'car' && api.player.vehicle === missionCar && dist != null && dist < st.radius) completeStage();
        break;
      }
      case 'hold': {
        if (dist != null && dist < st.radius && api.player.mode === 'foot') {
          holdProgress += dt;
          if (holdProgress >= st.seconds) completeStage();
        } else holdProgress = Math.max(0, holdProgress - dt * 1.5);
        break;
      }
      case 'escape': {
        if (api.police.stars === 0) completeStage();
        break;
      }
      case 'shootout': {
        if (api.combat.guardsAlive() === 0) completeStage();
        break;
      }
      default:
        break;
    }
  }

  /** When the player goes down mid-job, reset the stage's clock and its car. */
  function onPlayerDown() {
    if (!active) return;
    stageTime = 0;
    holdProgress = 0;
    if (missionCar && api.player.vehicle !== missionCar) {
      api.removeVehicle(missionCar);
      missionCar = null;
      if (stage()?.type === 'steal' || stage()?.type === 'deliver') startStage();
    }
  }

  /** Staging hook for the screenshot scenes: land directly on a mission stage. */
  function jumpTo(index, stageIdx) {
    missionIndex = index;
    stageIndex = stageIdx;
    active = true;
    done = false;
    startStage();
  }

  return {
    update,
    startMission,
    jumpTo,
    onPlayerDown,
    markerPos() {
      const st = stage();
      if (!active || !st) return null;
      return stagePoint(st);
    },
    get active() { return active; },
    get done() { return done; },
    get index() { return missionIndex; },
    get total() { return MISSIONS.length; },
    currentTitle() { return active ? mission().title : null; },
  };
}
