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
          density: 0.01,
          roomTypes: ["combat"],
        },
        {
          moduleId: "rocks",
          density: 0.012,
          roomTypes: ["combat"],
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
