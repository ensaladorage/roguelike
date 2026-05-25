export const HANDCRAFTED_LEVELS = [
  {
    kind: "assembled",
    tileSetId: "scenarioDefault",
    name: "Test Floor: enter_room_north_south_01 + combat_02 + exit_room_north_south_01",
    connectorStyleId: "openCorridor",
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
          roomTypes: ["combat"],
          zoneTypes: ["storage", "corner", "wall", "barrelStorage"],
          clustersPerRoom: { min: 1, max: 1 },
          clusterSize: { min: 2, max: 4 },
          clusterRadius: 1.35,
          scaleVariation: { min: 0.94, max: 1.06 },
        },
        {
          moduleId: "stones",
          density: 0.18,
          roomTypes: ["combat"],
          zoneTypes: ["rubble", "cover", "rockCover"],
          scaleVariation: { min: 0.92, max: 1.08 },
        },
      ],
    },
    playerStart: { x: -8, z: -13 },
    floorSize: 54,
    rooms: [
      {
        id: "EnterRoom",
        templateId: "enter_room_north_south_01",
        position: { x: -8, z: -11 },
        rotationY: 0,
      },
      {
        id: "CombatRoom",
        templateId: "combat_02",
        position: { x: 0, z: 5 },
        rotationY: 0,
      },
      {
        id: "ExitRoom",
        templateId: "exit_room_north_south_01",
        position: { x: 8, z: -10 },
        rotationY: 0,
      },
    ],
  },
];
