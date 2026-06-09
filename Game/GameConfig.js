export const GAME_MODES = Object.freeze({
  RUN: "run",
});

export const GAME_MODE = GAME_MODES.RUN;

export const GAME_CONFIG = Object.freeze({
  mode: GAME_MODE,
  run: {
    runSeed: null,
    startStageIndex: 1,
    startFloorIndex: 1,
  },
});
