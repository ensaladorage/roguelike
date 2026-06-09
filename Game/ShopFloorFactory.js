export function createShopFloor({
  runSeed = "run",
  floorSeed = `${runSeed}:shop`,
  floorIndex = 11,
  stage = null,
  shopTier = null,
} = {}) {
  const healing = shopTier?.healing ?? stage?.shop?.healing ?? null;

  return {
    kind: "assembled",
    tileSetId: "scenarioDefault",
    name: stage?.name ?? `Shop Floor ${floorIndex}`,
    floorIndex,
    floorType: "shop",
    stage,
    shopTier,
    connectorStyleId: "openCorridor",
    playerStart: {
      x: -7.5,
      z: 0,
      rotationY: Math.PI / 2,
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
    healingFountainSpawns: healing?.enabled
      ? [
        {
          id: "shop_fountain_01",
          x: 1,
          z: 1.7,
          rotationY: Math.PI,
          roomId: "ShopRoom01",
          roomTemplateId: "shop_room_01",
          healAmount: healing.healAmount ?? 25,
          uses: healing.uses ?? 1,
        },
      ]
      : [],
  };
}
