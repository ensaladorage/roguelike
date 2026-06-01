export function createShopFloor({
  runSeed = "run",
  floorSeed = `${runSeed}:shop`,
  floorIndex = 11,
} = {}) {
  return {
    kind: "assembled",
    tileSetId: "scenarioDefault",
    name: `Shop Floor ${floorIndex}`,
    floorIndex,
    floorType: "shop",
    connectorStyleId: "openCorridor",
    playerStart: {
      x: -10,
      z: 0,
    },
    floorSize: 38,
    floorCenter: {
      x: 1,
      z: 0,
    },
    decorationFill: {
      seed: floorSeed,
      modules: [],
    },
    rooms: [
      {
        id: "ShopEnter",
        templateId: "enter_room_east_west_01",
        position: {
          x: -8,
          z: 0,
        },
        rotationY: 0,
      },
      {
        id: "ShopRoom01",
        templateId: "shop_room_01",
        position: {
          x: 1,
          z: 0,
        },
        rotationY: 0,
      },
      {
        id: "ShopExit",
        templateId: "exit_room_east_west_02",
        position: {
          x: 12,
          z: 0,
        },
        rotationY: 0,
      },
    ],
  };
}
