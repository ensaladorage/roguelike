export const HANDCRAFTED_LEVELS = [
  {
    kind: "assembled",
    tileSetId: "scenarioDefault",
    name: "Example Enter Room",
    playerStart: { x: 0, z: 3.2 },
    floorSize: 18,
    rooms: [
      {
        id: "enter_preview",
        templateId: "enter_room",
        position: { x: 0, z: 0 },
      },
    ],
    exit: {
      x: 0,
      z: -3.7,
      nextLevel: 1,
    },
  },
  {
    kind: "assembled",
    tileSetId: "scenarioDefault",
    name: "Example Combat Room",
    playerStart: { x: 0, z: 3 },
    floorSize: 20,
    rooms: [
      {
        id: "combat_preview",
        templateId: "combat_room_example",
        position: { x: 0, z: 0 },
      },
    ],
    exit: {
      x: 0,
      z: -3.2,
      nextLevel: 2,
    },
  },
  {
    kind: "assembled",
    tileSetId: "scenarioDefault",
    name: "Example Exit Room",
    playerStart: { x: 0, z: -3 },
    floorSize: 20,
    rooms: [
      {
        id: "exit_preview",
        templateId: "exit_room_example",
        position: { x: 0, z: 0 },
      },
    ],
    exit: {
      nextLevel: null,
      disabled: true,
    },
  },
];
