// The save file: one JSON record in localStorage — cash, the story's mission index,
// whether the story is finished, and lifetime stats. Reading is defensive: a missing
// or corrupt record simply means a fresh start in Verano Bay.

import { SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return {
      cash: Number.isFinite(data.cash) ? data.cash : 0,
      missionIndex: Number.isFinite(data.missionIndex) ? data.missionIndex : 0,
      storyDone: !!data.storyDone,
      stats: {
        carsStolen: data.stats?.carsStolen ?? 0,
        missionsDone: data.stats?.missionsDone ?? 0,
        timesBusted: data.stats?.timesBusted ?? 0,
        timesWasted: data.stats?.timesWasted ?? 0,
      },
    };
  } catch {
    return null;
  }
}

export function storeSave(save) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Private windows and full storage: the visit simply goes unsaved.
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear.
  }
}
