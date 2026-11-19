// A small seeded random generator (mulberry32) and the helpers the world builders use.
// The city is generated from a fixed seed, so Verano Bay looks the same on every load —
// which is also what makes the staged screenshots reproducible.

export function createRandom(seed) {
  let state = seed >>> 0;
  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    /** Float in [min, max). */
    range(min, max) { return min + next() * (max - min); },
    /** Integer in [min, max]. */
    int(min, max) { return Math.floor(min + next() * (max - min + 1)); },
    /** One item of the array. */
    pick(items) { return items[Math.floor(next() * items.length)]; },
    /** True with probability p. */
    chance(p) { return next() < p; },
  };
}
