// Staged scenes for the entry's screenshots, behind ?shot=chase|drive|onfoot|mission.
// Each one arranges the real game — the player, traffic, police, a live mission stage —
// then hands the main loop a short script of inputs to play forward, so every frame is
// the game itself running, never a composite. The camera spec is applied at the end.

function baseCtl() {
  return {
    foot: { mx: 0, mz: 0, sprint: false },
    car: { throttle: 0, steer: 0, brake: false, handbrake: false },
    attack: false,
  };
}

const STAGES = {
  /** The cover: a three-star chase downtown, mid-delivery for Marina. The three
   *  cruisers are re-seated behind the player's car each step so the pursuit stays
   *  framed; the police system's own units converge on top of them. */
  chase(G) {
    const car = G.spawnCar('coupe', 0xd94f3d, 1.5, 48, Math.PI);
    G.player.enterCar(car);
    const cops = [
      G.spawnCar('police', 0xf2f2f0, 4.5, 60, Math.PI),
      G.spawnCar('police', 0xf2f2f0, -2.5, 66, Math.PI),
      G.spawnCar('police', 0xf2f2f0, 1.0, 74, Math.PI),
    ];
    for (const c of cops) c.driver = 'police';
    const offsets = [[3.1, 10.5], [-3.4, 15.5], [0.4, 22]];
    G.police.setWanted(3);
    G.missions.jumpTo(0, 2);
    return {
      steps: 30,
      cam: { yaw: 2.62, pitch: 0.21, dist: 10.5 },
      script() {
        const ctl = baseCtl();
        ctl.car.throttle = 0.8;
        ctl.car.steer = 0.04;
        const mine = G.player.vehicle;
        if (mine) {
          cops.forEach((c, i) => {
            c.mesh.position.set(mine.x + offsets[i][0], 0.05, mine.z + offsets[i][1]);
            c.mesh.rotation.y = Math.PI;
            c.heading = Math.PI;
          });
        }
        return ctl;
      },
    };
  },

  /** Golden-hour cruising on the coast road, the beach and sea behind the car. */
  drive(G) {
    const car = G.spawnCar('sedan', 0x3d7bd9, -140, 189.5, Math.PI / 2);
    G.player.enterCar(car);
    return {
      steps: 30,
      cam: { yaw: 2.3, pitch: 0.13, dist: 11 },
      script() {
        const ctl = baseCtl();
        ctl.car.throttle = 0.7;
        return ctl;
      },
    };
  },

  /** On foot downtown: sidewalks, shoppers, parked cars and towers. */
  onfoot(G) {
    G.player.teleport(10, 16, Math.PI);
    // Bring a handful of pedestrians onto the downtown block's sidewalk loop.
    const loop = G.city.sidewalkLoops.reduce((best, l) =>
      (Math.hypot(l.cx - 32, l.cz - 32) < Math.hypot(best.cx - 32, best.cz - 32) ? l : best), G.city.sidewalkLoops[0]);
    const per = 4 * (loop.halfX + loop.halfZ);
    const pointAt = (t) => {
      let d = ((t % 1) + 1) % 1 * per;
      if (d < 2 * loop.halfX) return [loop.cx - loop.halfX + d, loop.cz - loop.halfZ];
      d -= 2 * loop.halfX;
      if (d < 2 * loop.halfZ) return [loop.cx + loop.halfX, loop.cz - loop.halfZ + d];
      d -= 2 * loop.halfZ;
      if (d < 2 * loop.halfX) return [loop.cx + loop.halfX - d, loop.cz + loop.halfZ];
      d -= 2 * loop.halfX;
      return [loop.cx - loop.halfX, loop.cz + loop.halfZ - d];
    };
    const targets = [[7, 6], [20, 5.6], [5.6, 26], [30, 5.8], [12, 5.5]];
    G.peds.list.slice(0, targets.length).forEach((ped, i) => {
      ped.loop = loop;
      let bestT = 0;
      let bestD = Infinity;
      for (let s = 0; s < 400; s += 1) {
        const [x, z] = pointAt(s / 400);
        const d = Math.hypot(x - targets[i][0], z - targets[i][1]);
        if (d < bestD) { bestD = d; bestT = s / 400; }
      }
      ped.t = bestT;
      ped.state = 'walk';
    });
    return {
      steps: 40,
      cam: { yaw: 2.75, pitch: 0.15, dist: 7.5 },
      script() {
        const ctl = baseCtl();
        ctl.foot.mz = -1;
        ctl.foot.mx = -0.15;
        return ctl;
      },
    };
  },

  /** The Harbor Heat shootout: Rook south of the warehouse, the crew closing in. */
  mission(G) {
    G.player.teleport(212, 41, Math.PI);
    G.spawnCar('truck', 0x7a8894, 226, 40, 0.4);
    G.spawnCar('sedan', 0x8a4f9e, 192, 44, -0.5);
    G.combat.setWeapon('pistol');
    G.missions.jumpTo(3, 1);
    return {
      steps: 60,
      cam: { yaw: Math.PI * 2 + 0.3, pitch: 0.18, dist: 7 },
      script(t, step, steps) {
        const ctl = baseCtl();
        G.player.aiming = 0.25;
        G.player.heal(4);
        if (step === steps - 2 || step === steps - 12) ctl.attack = true;
        return ctl;
      },
    };
  },
};

export function stageShot(name, G) {
  const make = STAGES[name] ?? STAGES.chase;
  return make(G);
}
