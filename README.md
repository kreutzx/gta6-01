# gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/kreutzx/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/kreutzx/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**VERANO HEAT** — an original open-world crime game that runs entirely in the browser. You are **Rook**, a driver newly arrived in **Verano Bay**, a sun-soaked coastal city of pastel towers, palm-lined avenues, a marina, a beach and a working dockyard. Fixer **Marina Sol** has four jobs for you — a stolen coupe to deliver, a night-tide package to move against the clock, a bank lobby to hold up, and a warehouse crew to clear out — while the Verano Bay PD tracks your wanted level across five stars and hunts you through the streets.

Everything is procedural and offline: the city (a 7×7 road grid with downtown towers, shops, a hospital, a police station, a motel, a pier and container docks), the traffic that obeys the lanes, the pedestrians on the sidewalks, the police pursuit AI, and even the soundtrack — engine, sirens and gunshots are synthesised live with WebAudio. No assets are downloaded; Three.js is vendored beside the game's own ES modules under `game/src/` (`city.js`, `vehicles.js`, `traffic.js`, `pedestrians.js`, `police.js`, `player.js`, `missions.js`, `combat.js`, `hud.js`, `audio.js`, `save.js`).

## Play it

Serve the game folder with the bundled static server and open it in desktop Chrome:

```sh
node serve.ts            # http://localhost:8080
```

Pick **Start Story** (or **Continue** with a saved game), or roam freely. Progress — cash, story position, lifetime stats — saves to `localStorage`.

For the make.fun handover, `main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` to the output directory and writes the dossier:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Controls

| Input | Action |
| --- | --- |
| W A S D / arrows | Walk, drive |
| Mouse (pointer lock) | Orbit camera / aim |
| Shift | Sprint |
| F | Enter / exit vehicle |
| Left click | Punch / shoot |
| 1 / 2 | Fists / pistol |
| Space | Handbrake |
| P / Esc | Pause |
| M | Mute |

Steal any car you can reach — traffic drivers included — outrun or outwait the VBPD to cool your wanted stars, and don't get caught standing still next to a cruiser: that's how you get **BUSTED**. Drop to zero health and you're **WASTED**; either way the city takes its cut and you walk out of the hospital or the station house to try again.

---

<sub>Entered on [make.fun](https://make.fun/?ref=24q484pk&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
