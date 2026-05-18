export const HANDCRAFTED_LEVELS = [
  {
    kind: "assembled",
    tileSetId: "scenarioDefault",
    name: "Nivel Modular 1",
    playerStart: { x: 0, z: 13 },
    floorSize: 32,
    outerBoundary: {
      x: 3.5,
      z: 0.5,
      w: 21,
      d: 31,
      wallModuleId: "wallHalf",
      cornerModuleId: "wallCorner",
      dirtModuleId: "dirt",
    },
    rooms: [
      {
        id: "entry_corridor",
        templateId: "corridor_straight",
        position: { x: 0, z: 9.5 },
      },
      {
        id: "combat_room",
        templateId: "combat_room_basic",
        position: { x: 0, z: 0 },
      },
      {
        id: "side_alcove",
        templateId: "half_wall_alcove",
        position: { x: 9, z: 0 },
      },
      {
        id: "exit_room",
        templateId: "exit_room_basic",
        position: { x: 0, z: -9 },
      },
    ],
    exit: {
      nextLevel: null,
      disabled: true,
    },
  },
  {
    kind: "legacy",
    tileSetId: "scenarioDefault",
    name: "Nivel Fijo Debug",
    playerStart: { x: 0, z: 5 },
    floorSize: 18,
    floorPatches: [
      { x: 0, z: 0, w: 9, d: 13, moduleId: "floor" },
    ],
    walkableAreas: [
      { x: 0, z: 0, w: 9, d: 13 },
    ],
    rooms: [],
    outerWalls: [
      { x: -4, z: 0, w: 1, d: 13, moduleId: "wallNarrow" },
      { x: 4, z: 0, w: 1, d: 13, moduleId: "wallNarrow" },
      { x: 0, z: 6, w: 9, d: 1, moduleId: "wallNarrow" },
      { x: 0, z: -6, w: 9, d: 1, moduleId: "wallNarrow" },
    ],
    chests: [],
    enemies: [],
    exit: { x: 0, z: -4.5, nextLevel: null, disabled: true },
  },
];
