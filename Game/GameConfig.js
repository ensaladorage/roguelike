export const GAME_MODES = Object.freeze({
  TESTER: "tester",
  RUN: "run",
});

export const GAME_MODE = GAME_MODES.TESTER;

export const GAME_CONFIG = Object.freeze({
  mode: GAME_MODE,
  tester: {
    levelIndex: 0,
  },
  run: {
    runSeed: null,
    startFloorIndex: 1,
    normalFloorCount: 10,
    shopFloorIndex: 11,
    bossFloorIndex: 12,
  },
});
