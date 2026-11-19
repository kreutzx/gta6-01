// Every tuning number for Verano Heat in one place: the city grid, the palette, physics
// constants and the save key. Nothing here depends on the screen size.

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** City layout: road centre lines sit on a grid; blocks of buildings live between them. */
export const CITY = {
  /** Distance between neighbouring road centre lines, in metres. */
  pitch: 64,
  /** Grid index range: road lines run from -grid*pitch to +grid*pitch on both axes. */
  grid: 3,
  /** Half the road's width; the asphalt spans centre line ± roadHalf. */
  roadHalf: 8,
  /** Sidewalk width beyond the asphalt. */
  sidewalk: 3.6,
  /** Lane offset from a road's centre line. */
  lane: 3.4,
  /** Sand starts at this z and the sea beyond it: Verano Bay's beach is the south edge. */
  beachZ: 232,
  waterZ: 288,
  /** Playable bounds for cars and people. */
  bound: 268,
};

export const PALETTE = {
  sky: 0x8ec9e8,
  fog: 0xa8cfe4,
  sun: 0xffe0b0,
  ground: 0x9aa08e,
  sidewalk: 0xcac2b2,
  asphalt: 0x3c4148,
  sand: 0xe8d194,
  water: 0x2e7fa8,
  palmTrunk: 0x8a6a48,
  palmLeaf: 0x3f9e4d,
  buildings: [0xf2e3c6, 0xf5c6a5, 0xeeb4b8, 0xbfe3dd, 0xf7ead7, 0xd9e6f2, 0xf3d9a4, 0xe8b4a0, 0xcfe0c3, 0xf6cfda],
  cars: [0xd94f3d, 0x3d7bd9, 0xf2b134, 0x53b06a, 0xe8e6df, 0x30343c, 0x9b59c9, 0x2ec4b6, 0xef8354, 0x7286a0],
};

/** The player character's numbers. */
export const PLAYER = {
  walkSpeed: 5.2,
  sprintSpeed: 8.6,
  radius: 0.55,
  height: 1.8,
  maxHealth: 100,
  enterRange: 3.4,
};

/** Arcade car handling, shared by every vehicle; kinds scale these in vehicles.js. */
export const CAR = {
  accel: 15,
  brake: 26,
  reverseMax: 9,
  drag: 0.55,
  rollDrag: 1.6,
  steerMax: 0.52,
  grip: 9,
  radius: 1.55,
};

/** Wanted tuning: crime points per act, and how the stars fall off when the heat loses you. */
export const WANTED = {
  perStar: 100,
  maxStars: 5,
  decayDelay: 11,
  decayRate: 9,
  policeByStar: [0, 2, 3, 4, 5, 6],
};

/** Where progress is kept between visits (this browser only). */
export const SAVE_KEY = 'verano-heat.save.v1';

/** The fixed world seed: Verano Bay is the same city on every visit. */
export const WORLD_SEED = 20261117;
