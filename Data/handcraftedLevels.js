export const HANDCRAFTED_LEVELS = [
  {
    kind: "assembled",
    tileSetId: "scenarioDefault",
    name: "Test Floor: EnterRoom + combat_obstacle_01 + ExitRoom",
    connectorStyleId: "openCorridor",
    playerStart: { x: 0, z: -5.8 },
    floorSize: 38,
    rooms: [
      {
        id: "EnterRoom",
        templateId: "enter_room",
        position: { x: 0, z: -9 },
        rotationY: 0,
      },
      {
        id: "CombatRoom",
        templateId: "combat_obstacle_01",
        position: { x: 0, z: 2 },
        rotationY: 0,
      },
      {
        id: "ExitRoom",
        templateId: "exit_room_example",
        position: { x: 0, z: 12 },
        rotationY: 0,
      },
    ],
  },
];
