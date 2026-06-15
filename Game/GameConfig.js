export const GAME_MODES = Object.freeze({
  RUN: "run",
});

export const GAME_MODE = GAME_MODES.RUN;

export const GAME_CONFIG = Object.freeze({
  mode: GAME_MODE,
  run: {
    runSeed: null,
    startStageIndex: 1,
    // Deprecated alias for old floor configs; startStageIndex is authoritative.
    startFloorIndex: 1,
  },
});
