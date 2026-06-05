export function createBossFloor({
  runSeed = "run",
  floorSeed = `${runSeed}:boss`,
  floorIndex = 12,
  cycleIndex = 0,
  difficultyScale = 1,
} = {}) {
  return {
    kind: "assembled",
    tileSetId: "scenarioDefault",
    name: `Boss Floor ${floorIndex}`,
    floorIndex,
    floorType: "boss",
    cycleIndex,
    difficultyScale,
    connectorStyleId: "openCorridor",
    enemyDifficulty: "hard",
    playerStart: {
      x: -16.5,
      z: 0,
      rotationY: Math.PI / 2,
    },
    floorSize: 42,
    floorCenter: {
      x: 0,
      z: 0,
    },
    decorationFill: {
      seed: floorSeed,
      modules: [],
    },
    rooms: [
      {
        id: "BossEnter",
        templateId: "enter_room_east_west_01",
        position: {
          x: -14,
          z: 0,
        },
        rotationY: 0,
      },
      {
        id: "BossRoom01",
        templateId: "boss_room_square_01",
        position: {
          x: 0,
          z: 0,
        },
        rotationY: 0,
      },
      {
        id: "BossExit",
        templateId: "exit_room_east_west_01",
        position: {
          x: 14,
          z: 0,
        },
        rotationY: 0,
      },
    ],
  };
}
