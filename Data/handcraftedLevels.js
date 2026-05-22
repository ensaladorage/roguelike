export const HANDCRAFTED_LEVELS = [
  {
    kind: "assembled",
    tileSetId: "scenarioDefault",
    name: "Test Floor: enter_room_east_west_01 + combat_01 + exit_room_east_west_01",
    connectorStyleId: "openCorridor",
    playerStart: { x: -12.4, z: 0 },
    floorSize: 42,
    rooms: [
      {
        id: "EnterRoom",
        templateId: "enter_room_east_west_01",
        position: { x: -11, z: 0 },
        rotationY: 0,
      },
      {
        id: "CombatRoom",
        templateId: "combat_01",
        position: { x: 0, z: 0 },
        rotationY: 0,
      },
      {
        id: "ExitRoom",
        templateId: "exit_room_east_west_01",
        position: { x: 11, z: 0 },
        rotationY: 0,
      },
    ],
  },
];
