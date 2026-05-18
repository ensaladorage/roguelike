export const HANDCRAFTED_LEVELS = [
  {
    kind: "assembled",
    tileSetId: "scenarioDefault",
    name: "Test Floor: EnterRoom + CombatRoom + ExitRoom",
    playerStart: { x: 0, z: -5.8 },
    floorSize: 34,
    rooms: [
      {
        id: "EnterRoom",
        templateId: "enter_room",
        position: { x: 0, z: -9 },
        rotationY: 0,
      },
      {
        id: "CombatRoom",
        templateId: "combat_room_example",
        position: { x: 0, z: 1 },
        rotationY: 0,
      },
      {
        id: "ExitRoom",
        templateId: "exit_room_example",
        position: { x: 0, z: 10 },
        rotationY: 0,
      },
    ],
  },
];
