// Edit ROOM_TESTER_LEVELS while GAME_MODE is "tester" to debug manual room chains.
// Place rooms so opposite openings touch in world space; LevelBuilder will resolve the connector.
export const ROOM_TESTER_LEVELS = [
  {
    kind: "assembled",
    tileSetId: "scenarioDefault",
    name: "Room Tester: enter + combat_02 + exit",
    connectorStyleId: "openCorridor",
    enemyDifficulty: "easy",
    decorationFill: {
      seed: "random",
      modules: [
        {
          moduleId: "floorDetail",
          density: 0.3,
        },
        {
          moduleId: "barrel",
          density: 1,
          roomTypes: ["combat", "treasure"],
          spotStrategy: "semantic",
          spotTypes: ["corner", "door", "chest"],
          spotMinDistance: 5,
          spotInset: 1.4,
          doorSpotDepth: 2.2,
          doorSpotSideOffset: 2,
          chestSpotOffset: 1.8,
          clustersPerRoom: { min: 3, max: 5 },
          clusterSize: { min: 2, max: 5 },
          clusterRadius: 1,
          clusterScatterRadius: 0.4,
          placementFootprint: { w: 0.6, d: 0.6 },
          collisionFootprint: { w: 0.1, d: 0.1 },
          positionJitter: 1,
          scaleVariation: { min: 0.8, max: 1.6 },
        },
        {
          moduleId: "stones",
          density: 0.05,
          zoneTypes: null,
          allowUnzoned: true,
          placementFootprint: { w: 0.35, d: 0.35 },
          positionJitter: 0.35,
          scaleVariation: { min: 0.5, max: 1.2 },
        },
      ],
    },
    playerStart: { x: -8, z: -17 },
    floorSize: 34,
    floorCenter: { x: 0, z: 0 },
    rooms: [
      {
        id: "TesterEnter",
        templateId: "enter_room_north_south_01",
        position: { x: -8, z: -16 },
        rotationY: 0,
      },
      {
        id: "TesterCombat02",
        templateId: "combat_02",
        position: { x: 0, z: 0 },
        rotationY: 0,
      },
      {
        id: "TesterExit",
        templateId: "exit_room_north_south_01",
        position: { x: 8, z: -15 },
        rotationY: 0,
      },
    ],
  },
];

export function getRoomTesterLevel(levelIndex = 0) {
  return ROOM_TESTER_LEVELS[levelIndex] ?? ROOM_TESTER_LEVELS[0] ?? null;
}
