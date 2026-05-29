const ROOM_ROTATION_SIDES = ["north", "east", "south", "west"];
const ROOM_ROTATION_CORNERS = ["northWest", "northEast", "southEast", "southWest"];

function normalizeQuarterTurns(quarterTurns = 0) {
  return ((quarterTurns % 4) + 4) % 4;
}

function rotatePoint(point, quarterTurns = 0) {
  const turns = normalizeQuarterTurns(quarterTurns);

  if (turns === 1) {
    return { x: -point.z, z: point.x };
  }

  if (turns === 2) {
    return { x: -point.x, z: -point.z };
  }

  if (turns === 3) {
    return { x: point.z, z: -point.x };
  }

  return { x: point.x, z: point.z };
}

function rotateSide(side, quarterTurns = 0) {
  const index = ROOM_ROTATION_SIDES.indexOf(side);

  if (index === -1) {
    return side;
  }

  return ROOM_ROTATION_SIDES[(index + normalizeQuarterTurns(quarterTurns)) % ROOM_ROTATION_SIDES.length];
}

function rotateCorner(corner, quarterTurns = 0) {
  const index = ROOM_ROTATION_CORNERS.indexOf(corner);

  if (index === -1) {
    return corner;
  }

  return ROOM_ROTATION_CORNERS[(index + normalizeQuarterTurns(quarterTurns)) % ROOM_ROTATION_CORNERS.length];
}

function rotateFootprint(module, quarterTurns = 0) {
  if (normalizeQuarterTurns(quarterTurns) % 2 === 0) {
    return { w: module.w, d: module.d };
  }

  return { w: module.d, d: module.w };
}

function rotateModule(module, quarterTurns = 0) {
  const point = rotatePoint(module, quarterTurns);
  const footprint = rotateFootprint(module, quarterTurns);
  const rotated = {
    ...module,
    ...point,
    ...footprint,
    rotationY: (module.rotationY ?? 0) + normalizeQuarterTurns(quarterTurns) * (Math.PI / 2),
  };

  if (module.side) {
    rotated.side = rotateSide(module.side, quarterTurns);
  }

  if (module.corner) {
    rotated.corner = rotateCorner(module.corner, quarterTurns);
  }

  return rotated;
}

function rotateArea(area, quarterTurns = 0) {
  const point = rotatePoint(area, quarterTurns);
  const footprint = rotateFootprint(area, quarterTurns);

  return {
    ...area,
    ...point,
    ...footprint,
  };
}

function getOpeningCenter(opening, dimensions) {
  const halfW = dimensions.w / 2;
  const halfD = dimensions.d / 2;

  switch (opening.side) {
    case "north":
      return { x: opening.offset, z: -halfD };
    case "south":
      return { x: opening.offset, z: halfD };
    case "west":
      return { x: -halfW, z: opening.offset };
    case "east":
      return { x: halfW, z: opening.offset };
    default:
      return { x: opening.offset ?? 0, z: opening.offset ?? 0 };
  }
}

function getOpeningOffset(point, side) {
  if (side === "north" || side === "south") {
    return point.x;
  }

  return point.z;
}

function rotateDoorOpening(opening, dimensions, quarterTurns = 0) {
  const side = rotateSide(opening.side, quarterTurns);
  const center = rotatePoint(getOpeningCenter(opening, dimensions), quarterTurns);

  return {
    ...opening,
    side,
    offset: getOpeningOffset(center, side),
  };
}

function rotateEnemySpawn(enemySpawn, quarterTurns = 0) {
  const point = rotatePoint(enemySpawn, quarterTurns);

  return {
    ...enemySpawn,
    ...point,
    rotationY: (enemySpawn.rotationY ?? 0) + normalizeQuarterTurns(quarterTurns) * (Math.PI / 2),
    patrol: enemySpawn.patrol?.map((patrolPoint) => rotatePoint(patrolPoint, quarterTurns)),
  };
}

function rotateChestSpawn(chestSpawn, quarterTurns = 0) {
  const point = rotatePoint(chestSpawn, quarterTurns);

  return {
    ...chestSpawn,
    ...point,
    rotationY: (chestSpawn.rotationY ?? 0) + normalizeQuarterTurns(quarterTurns) * (Math.PI / 2),
  };
}

const COMBAT_L_BASE_TEMPLATE = {
  type: "combat",
  dimensions: { w: 13, d: 13 },
  floorModules: [
    {
      x: -3,
      z: -3,
      w: 5,
      d: 7,
      moduleId: "floor",
    },
    {
      x: -2.5,
      z: 3,
      w: 6,
      d: 5,
      moduleId: "floor",
    },
    {
      x: 3.5,
      z: 3,
      w: 6,
      d: 5,
      moduleId: "floor",
    },
  ],
  walkableAreas: [
    {
      x: -3,
      z: -2.5,
      w: 5,
      d: 8,
    },
    {
      x: 0.5,
      z: 3,
      w: 12,
      d: 5,
    },
  ],
  wallModules: [
    {
      x: -5,
      z: -6,
      w: 1,
      d: 1,
      corner: "northWest",
      rotationY: 0,
      moduleId: "wallCorner",
    },
    {
      x: -1,
      z: -6,
      w: 1,
      d: 1,
      corner: "northEast",
      rotationY: Math.PI / 2,
      moduleId: "wallCorner",
    },
    {
      x: -1,
      z: 1,
      w: 1,
      d: 1,
      corner: "southWest",
      rotationY: Math.PI / 2,
      moduleId: "wallCorner",
    },
    {
      x: 6,
      z: 1,
      w: 1,
      d: 1,
      corner: "northEast",
      rotationY: Math.PI / 2,
      moduleId: "wallCorner",
    },
    {
      x: 6,
      z: 5,
      w: 1,
      d: 1,
      corner: "southEast",
      rotationY: Math.PI,
      moduleId: "wallCorner",
    },
    {
      x: -5,
      z: 5,
      w: 1,
      d: 1,
      corner: "southWest",
      rotationY: -Math.PI / 2,
      moduleId: "wallCorner",
    },
    {
      x: -1,
      z: -2.5,
      w: 1,
      d: 6,
      side: "east",
      rotationY: -Math.PI / 2,
      moduleId: "wallHalf",
    },
    {
      x: 2.5,
      z: 1,
      w: 6,
      d: 1,
      side: "north",
      rotationY: 0,
      moduleId: "wallHalf",
    },
    {
      x: 0.5,
      z: 5,
      w: 10,
      d: 1,
      side: "south",
      rotationY: Math.PI,
      moduleId: "wallHalf",
    },
    {
      x: -5,
      z: -0.5,
      w: 1,
      d: 10,
      side: "west",
      rotationY: Math.PI / 2,
      moduleId: "wallHalf",
    },
  ],
  doorwayModules: [
    {
      x: -3,
      z: -6,
      w: 3,
      d: 1,
      side: "north",
      rotationY: 0,
      moduleId: "wallHalf",
    },
    {
      x: 6,
      z: 3,
      w: 1,
      d: 3,
      side: "east",
      rotationY: -Math.PI / 2,
      moduleId: "wallHalf",
    },
  ],
  doorOpenings: [
    { side: "north", offset: -3, width: 1 },
    { side: "east", offset: 3, width: 1 },
  ],
  enemySpawns: [
    {
      x: -3,
      z: 1.7,
      modelId: "enemy_hog_01",
      patrol: [
        { x: -3, z: 1.7 },
        { x: -4.2, z: -2.8 },
        { x: -2, z: 4.1 },
      ],
    },
    {
      x: 3.2,
      z: 3.4,
      modelId: "enemy_hog_01",
      patrol: [
        { x: 3.2, z: 3.4 },
        { x: 0.6, z: 2 },
        { x: 5, z: 4 },
      ],
    },
  ],
  chestSpawns: [
    {
      x: -4,
      z: 4.2,
      rotationY: Math.PI,
      modelId: "chest_01",
      optional: true,
    },
  ],
  decorZones: [
    {
      id: "combat_L_rubble_scatter",
      type: "rubble",
      x: -2,
      z: 2.4,
      w: 2.5,
      d: 3,
    },
    {
      id: "combat_L_corner_storage",
      type: "barrel_storage",
      x: -4,
      z: -4.4,
      w: 2,
      d: 2,
    },
  ],
  obstacleModules: [],
};

function createCombatLRoom({ id, name, quarterTurns = 0 }) {
  return {
    ...COMBAT_L_BASE_TEMPLATE,
    id,
    name,
    floorModules: COMBAT_L_BASE_TEMPLATE.floorModules.map((module) => rotateModule(module, quarterTurns)),
    walkableAreas: COMBAT_L_BASE_TEMPLATE.walkableAreas.map((area) => rotateArea(area, quarterTurns)),
    wallModules: COMBAT_L_BASE_TEMPLATE.wallModules.map((module) => rotateModule(module, quarterTurns)),
    doorwayModules: COMBAT_L_BASE_TEMPLATE.doorwayModules.map((module) => rotateModule(module, quarterTurns)),
    doorOpenings: COMBAT_L_BASE_TEMPLATE.doorOpenings.map((opening) =>
      rotateDoorOpening(opening, COMBAT_L_BASE_TEMPLATE.dimensions, quarterTurns)
    ),
    enemySpawns: COMBAT_L_BASE_TEMPLATE.enemySpawns.map((enemySpawn) => rotateEnemySpawn(enemySpawn, quarterTurns)),
    chestSpawns: COMBAT_L_BASE_TEMPLATE.chestSpawns.map((chestSpawn) => rotateChestSpawn(chestSpawn, quarterTurns)),
    decorZones: COMBAT_L_BASE_TEMPLATE.decorZones.map((zone) => ({
      ...rotateArea(zone, quarterTurns),
      id: zone.id.replace("combat_L", id),
    })),
    obstacleModules: COMBAT_L_BASE_TEMPLATE.obstacleModules.map((module) => rotateModule(module, quarterTurns)),
  };
}

export const COMBAT_ROOM_TEMPLATES = [
  {
    id: "combat_01",
    type: "combat",
    name: "East/West Combat Room 01",
    dimensions: { w: 15, d: 9 },
    floorModules: [
      {
        x: 0,
        z: 0,
        w: 15,
        d: 9,
        moduleId: "floor",
      },
    ],
    walkableAreas: [
      {
        x: 0,
        z: 0,
        w: 15,
        d: 9,
      },
    ],
    wallModules: [
      {
        x: -7,
        z: -4,
        w: 1,
        d: 1,
        corner: "northWest",
        rotationY: 0,
        moduleId: "wallCorner",
      },
      {
        x: 7,
        z: -4,
        w: 1,
        d: 1,
        corner: "northEast",
        rotationY: Math.PI / 2,
        moduleId: "wallCorner",
      },
      {
        x: 7,
        z: 4,
        w: 1,
        d: 1,
        corner: "southEast",
        rotationY: Math.PI,
        moduleId: "wallCorner",
      },
      {
        x: -7,
        z: 4,
        w: 1,
        d: 1,
        corner: "southWest",
        rotationY: -Math.PI / 2,
        moduleId: "wallCorner",
      },
      {
        x: 0,
        z: -4,
        w: 13,
        d: 1,
        side: "north",
        rotationY: 0,
        moduleId: "wallHalf",
      },
      {
        x: 0,
        z: 4,
        w: 13,
        d: 1,
        side: "south",
        rotationY: Math.PI,
        moduleId: "wallHalf",
      },
      {
        x: -7,
        z: -2.5,
        w: 1,
        d: 2,
        side: "west",
        rotationY: Math.PI / 2,
        moduleId: "wallHalf",
      },
      {
        x: -7,
        z: 2.5,
        w: 1,
        d: 2,
        side: "west",
        rotationY: Math.PI / 2,
        moduleId: "wallHalf",
      },
      {
        x: 7,
        z: -2.5,
        w: 1,
        d: 2,
        side: "east",
        rotationY: -Math.PI / 2,
        moduleId: "wallHalf",
      },
      {
        x: 7,
        z: 2.5,
        w: 1,
        d: 2,
        side: "east",
        rotationY: -Math.PI / 2,
        moduleId: "wallHalf",
      },
    ],
    doorwayModules: [
      {
        x: -7,
        z: 0,
        w: 1,
        d: 3,
        side: "west",
        rotationY: Math.PI / 2,
        moduleId: "wallHalf",
      },
      {
        x: 7,
        z: 0,
        w: 1,
        d: 3,
        side: "east",
        rotationY: -Math.PI / 2,
        moduleId: "wallHalf",
      },
    ],
    doorOpenings: [
      { side: "west", offset: 0, width: 1 },
      { side: "east", offset: 0, width: 1 },
    ],
    enemySpawns: [
      {
        x: -4.6,
        z: -2,
        modelId: "enemy_hog_01",
        patrol: [
          { x: -4.6, z: -2 },
          { x: -5.3, z: 1.7 },
          { x: -2.4, z: 2.1 },
        ],
      },
      {
        x: 0,
        z: 1.9,
        modelId: "enemy_hog_01",
        patrol: [
          { x: 0, z: 1.9 },
          { x: -1.8, z: -1.8 },
          { x: 2, z: -1.8 },
        ],
      },
      {
        x: 4.6,
        z: -2,
        modelId: "enemy_hog_01",
        patrol: [
          { x: 4.6, z: -2 },
          { x: 5.3, z: 1.7 },
          { x: 2.4, z: 2.1 },
        ],
      },
    ],
    chestSpawns: [],
    decorZones: [
      {
        id: "combat_01_rubble_scatter",
        type: "rubble",
        x: 0,
        z: 0.5,
        w: 4,
        d: 2.5,
      },
    ],
    obstacleModules: [],
  },
  {
    id: "combat_02",
    type: "combat",
    name: "North U Corridor Combat Room 02",
    dimensions: { w: 25, d: 21 },
    floorModules: [
      {
        x: -8.5,
        z: 0,
        w: 8,
        d: 21,
        moduleId: "floor",
      },
      {
        x: 8.5,
        z: 0,
        w: 8,
        d: 21,
        moduleId: "floor",
      },
      {
        x: 0,
        z: 7,
        w: 25,
        d: 7,
        moduleId: "floor",
      },
    ],
    walkableAreas: [
      {
        x: -8.5,
        z: 0,
        w: 8,
        d: 21,
      },
      {
        x: 8.5,
        z: 0,
        w: 8,
        d: 21,
      },
      {
        x: 0,
        z: 7,
        w: 25,
        d: 7,
      },
    ],
    wallModules: [
      {
        x: -12,
        z: -10,
        w: 1,
        d: 1,
        corner: "northWest",
        rotationY: 0,
        moduleId: "wallCorner",
      },
      {
        x: 12,
        z: -10,
        w: 1,
        d: 1,
        corner: "northEast",
        rotationY: Math.PI / 2,
        moduleId: "wallCorner",
      },
      {
        x: 12,
        z: 10,
        w: 1,
        d: 1,
        corner: "southEast",
        rotationY: Math.PI,
        moduleId: "wallCorner",
      },
      {
        x: -12,
        z: 10,
        w: 1,
        d: 1,
        corner: "southWest",
        rotationY: -Math.PI / 2,
        moduleId: "wallCorner",
      },
      {
        x: -11,
        z: -10,
        w: 1,
        d: 1,
        side: "north",
        rotationY: 0,
        moduleId: "wallHalf",
      },
      {
        x: -10,
        z: -10,
        w: 1,
        d: 1,
        side: "north",
        rotationY: 0,
        moduleId: "wallHalf",
      },
      {
        x: -6,
        z: -10,
        w: 1,
        d: 1,
        side: "north",
        rotationY: 0,
        moduleId: "wallHalf",
      },
      {
        x: -5,
        z: -10,
        w: 1,
        d: 1,
        side: "north",
        rotationY: 0,
        moduleId: "wallHalf",
      },

      {
        x: -4,
        z: -10,
        w: 1,
        d: 1,
        corner: "northEast",
        rotationY: Math.PI / 2,
        moduleId: "wallCorner",
      },

      {
        x: 4,
        z: -10,
        w: 1,
        d: 1,
        corner: "northWest",
        rotationY: 0,
        moduleId: "wallCorner",
      },
      {
        x: 5,
        z: -10,
        w: 1,
        d: 1,
        side: "north",
        rotationY: 0,
        moduleId: "wallHalf",
      },
      {
        x: 6,
        z: -10,
        w: 1,
        d: 1,
        side: "north",
        rotationY: 0,
        moduleId: "wallHalf",
      },
      {
        x: 10,
        z: -10,
        w: 1,
        d: 1,
        side: "north",
        rotationY: 0,
        moduleId: "wallHalf",
      },
      {
        x: 11,
        z: -10,
        w: 1,
        d: 1,
        side: "north",
        rotationY: 0,
        moduleId: "wallHalf",
      },
      {
        x: 0,
        z: 10,
        w: 23,
        d: 1,
        side: "south",
        rotationY: Math.PI,
        moduleId: "wallHalf",
      },
      {
        x: -12,
        z: 0,
        w: 1,
        d: 19,
        side: "west",
        rotationY: Math.PI / 2,
        moduleId: "wallHalf",
      },
      {
        x: 12,
        z: 0,
        w: 1,
        d: 19,
        side: "east",
        rotationY: -Math.PI / 2,
        moduleId: "wallHalf",
      },
      {
        x: -4,
        z: -3,
        w: 1,
        d: 13,
        side: "east",
        rotationY: -Math.PI / 2,
        moduleId: "wallHalf",
      },
      {
        x: 4,
        z: -3,
        w: 1,
        d: 13,
        side: "west",
        rotationY: Math.PI / 2,
        moduleId: "wallHalf",
      },
      {
        x: 0,
        z: 4,
        w: 7,
        d: 1,
        side: "north",
        rotationY: 0,
        moduleId: "wallHalf",
      },
      {
        x: -4,
        z: 4,
        w: 1,
        d: 1,
        corner: "southEast",
        rotationY: Math.PI,
        moduleId: "wallCorner",
      },
      {
        x: 4,
        z: 4,
        w: 1,
        d: 1,
        corner: "southWest",
        rotationY: -Math.PI / 2,
        moduleId: "wallCorner",
      },
    ],
    doorwayModules: [
      {
        x: -8,
        z: -10,
        w: 3,
        d: 1,
        side: "north",
        rotationY: 0,
        moduleId: "wallHalf",
      },
      {
        x: 8,
        z: -10,
        w: 3,
        d: 1,
        side: "north",
        rotationY: 0,
        moduleId: "wallHalf",
      },
    ],
    doorOpenings: [
      { side: "north", offset: -8, width: 1 },
      { side: "north", offset: 8, width: 1 },
    ],
    enemySpawns: [
      {
        x: -8,
        z: 1.5,
        modelId: "enemy_hog_01",
        patrol: [
          { x: -8, z: 1.5 },
          { x: -8.5, z: -6 },
          { x: -7.4, z: 7.6 },
        ],
      },
      {
        x: 8,
        z: 1.5,
        modelId: "enemy_hog_01",
        patrol: [
          { x: 8, z: 1.5 },
          { x: 8.5, z: -6 },
          { x: 7.4, z: 7.6 },
        ],
      },
      {
        x: -8.2,
        z: 6.8,
        modelId: "enemy_hog_01",
        patrol: [
          { x: -8.2, z: 6.8 },
          { x: -9.4, z: 3.2 },
          { x: -7.1, z: 9.2 },
        ],
      },
      {
        x: 8.2,
        z: 6.8,
        modelId: "enemy_hog_01",
        patrol: [
          { x: 8.2, z: 6.8 },
          { x: 9.4, z: 3.2 },
          { x: 7.1, z: 9.2 },
        ],
      },
    ],
    chestSpawns: [
      {
        x: -9.5,
        z: 8,
        rotationY: Math.PI,
        modelId: "chest_01",
      },
      {
        x: 9.5,
        z: 8,
        rotationY: Math.PI,
        modelId: "chest_01",
      },
    ],
    decorZones: [
      {
        id: "combat_02_rubble_scatter",
        type: "rubble",
        x: 0,
        z: 7.2,
        w: 6,
        d: 3,
      },
    ],
    obstacleModules: [],
  },
  {
    id: "combat_03",
    type: "combat",
    name: "Small North/South Combat Room 03",
    dimensions: { w: 9, d: 7 },
    floorModules: [
      {
        x: 0,
        z: 0,
        w: 9,
        d: 7,
        moduleId: "floor",
      },
    ],
    walkableAreas: [
      {
        x: 0,
        z: 0,
        w: 9,
        d: 7,
      },
    ],
    wallModules: [
      {
        x: -4,
        z: -3,
        w: 1,
        d: 1,
        corner: "northWest",
        rotationY: 0,
        moduleId: "wallCorner",
      },
      {
        x: 4,
        z: -3,
        w: 1,
        d: 1,
        corner: "northEast",
        rotationY: Math.PI / 2,
        moduleId: "wallCorner",
      },
      {
        x: 4,
        z: 3,
        w: 1,
        d: 1,
        corner: "southEast",
        rotationY: Math.PI,
        moduleId: "wallCorner",
      },
      {
        x: -4,
        z: 3,
        w: 1,
        d: 1,
        corner: "southWest",
        rotationY: -Math.PI / 2,
        moduleId: "wallCorner",
      },
      {
        x: -2.5,
        z: -3,
        w: 2,
        d: 1,
        side: "north",
        rotationY: 0,
        moduleId: "wallHalf",
      },
      {
        x: 2.5,
        z: -3,
        w: 2,
        d: 1,
        side: "north",
        rotationY: 0,
        moduleId: "wallHalf",
      },
      {
        x: -2.5,
        z: 3,
        w: 2,
        d: 1,
        side: "south",
        rotationY: Math.PI,
        moduleId: "wallHalf",
      },
      {
        x: 2.5,
        z: 3,
        w: 2,
        d: 1,
        side: "south",
        rotationY: Math.PI,
        moduleId: "wallHalf",
      },
      {
        x: -4,
        z: 0,
        w: 1,
        d: 5,
        side: "west",
        rotationY: Math.PI / 2,
        moduleId: "wallHalf",
      },
      {
        x: 4,
        z: 0,
        w: 1,
        d: 5,
        side: "east",
        rotationY: -Math.PI / 2,
        moduleId: "wallHalf",
      },
    ],
    doorwayModules: [
      {
        x: 0,
        z: -3,
        w: 3,
        d: 1,
        side: "north",
        rotationY: 0,
        moduleId: "wallHalf",
      },
      {
        x: 0,
        z: 3,
        w: 3,
        d: 1,
        side: "south",
        rotationY: Math.PI,
        moduleId: "wallHalf",
      },
    ],
    doorOpenings: [
      { side: "north", offset: 0, width: 1 },
      { side: "south", offset: 0, width: 1 },
    ],
    enemySpawns: [
      {
        x: 0,
        z: 0,
        modelId: "enemy_hog_01",
        patrol: [
          { x: 0, z: 0 },
          { x: -2.2, z: -1.4 },
          { x: 2.2, z: 1.4 },
        ],
      },
    ],
    chestSpawns: [],
    decorZones: [
      {
        id: "combat_03_barrel_storage",
        type: "barrel_storage",
        x: -2.8,
        z: 1.7,
        w: 2,
        d: 2,
      },
      {
        id: "combat_03_rubble_scatter",
        type: "rubble",
        x: 1.8,
        z: -1.4,
        w: 2.5,
        d: 2,
      },
      {
        id: "combat_03_stones",
        type: "stones",
        x: 2.4,
        z: 1.5,
        w: 2,
        d: 2,
      },
    ],
    obstacleModules: [],
  },
  {
    id: "combat_04",
    type: "combat",
    name: "Four-Way Rock Ring Combat Room 04",
    dimensions: { w: 13, d: 13 },
    floorModules: [
      {
        x: 0,
        z: 0,
        w: 13,
        d: 13,
        moduleId: "floor",
      },
    ],
    walkableAreas: [
      {
        x: 0,
        z: 0,
        w: 13,
        d: 13,
      },
    ],
    wallModules: [
      {
        x: -6,
        z: -6,
        w: 1,
        d: 1,
        corner: "northWest",
        rotationY: 0,
        moduleId: "wallCorner",
      },
      {
        x: 6,
        z: -6,
        w: 1,
        d: 1,
        corner: "northEast",
        rotationY: Math.PI / 2,
        moduleId: "wallCorner",
      },
      {
        x: 6,
        z: 6,
        w: 1,
        d: 1,
        corner: "southEast",
        rotationY: Math.PI,
        moduleId: "wallCorner",
      },
      {
        x: -6,
        z: 6,
        w: 1,
        d: 1,
        corner: "southWest",
        rotationY: -Math.PI / 2,
        moduleId: "wallCorner",
      },
      {
        x: -3.5,
        z: -6,
        w: 4,
        d: 1,
        side: "north",
        rotationY: 0,
        moduleId: "wallHalf",
      },
      {
        x: 3.5,
        z: -6,
        w: 4,
        d: 1,
        side: "north",
        rotationY: 0,
        moduleId: "wallHalf",
      },
      {
        x: -3.5,
        z: 6,
        w: 4,
        d: 1,
        side: "south",
        rotationY: Math.PI,
        moduleId: "wallHalf",
      },
      {
        x: 3.5,
        z: 6,
        w: 4,
        d: 1,
        side: "south",
        rotationY: Math.PI,
        moduleId: "wallHalf",
      },
      {
        x: -6,
        z: -3.5,
        w: 1,
        d: 4,
        side: "west",
        rotationY: Math.PI / 2,
        moduleId: "wallHalf",
      },
      {
        x: -6,
        z: 3.5,
        w: 1,
        d: 4,
        side: "west",
        rotationY: Math.PI / 2,
        moduleId: "wallHalf",
      },
      {
        x: 6,
        z: -3.5,
        w: 1,
        d: 4,
        side: "east",
        rotationY: -Math.PI / 2,
        moduleId: "wallHalf",
      },
      {
        x: 6,
        z: 3.5,
        w: 1,
        d: 4,
        side: "east",
        rotationY: -Math.PI / 2,
        moduleId: "wallHalf",
      },
    ],
    doorwayModules: [
      {
        x: 0,
        z: -6,
        w: 3,
        d: 1,
        side: "north",
        rotationY: 0,
        moduleId: "wallHalf",
      },
      {
        x: 0,
        z: 6,
        w: 3,
        d: 1,
        side: "south",
        rotationY: Math.PI,
        moduleId: "wallHalf",
      },
      {
        x: -6,
        z: 0,
        w: 1,
        d: 3,
        side: "west",
        rotationY: Math.PI / 2,
        moduleId: "wallHalf",
      },
      {
        x: 6,
        z: 0,
        w: 1,
        d: 3,
        side: "east",
        rotationY: -Math.PI / 2,
        moduleId: "wallHalf",
      },
    ],
    doorOpenings: [
      { side: "north", offset: 0, width: 1 },
      { side: "south", offset: 0, width: 1 },
      { side: "west", offset: 0, width: 1 },
      { side: "east", offset: 0, width: 1 },
    ],
    enemySpawns: [
      {
        x: -3.4,
        z: -2.6,
        modelId: "enemy_hog_01",
        patrol: [
          { x: -3.4, z: -2.6 },
          { x: -4, z: 2.7 },
          { x: -1.8, z: 4 },
        ],
      },
      {
        x: 3.4,
        z: 2.6,
        modelId: "enemy_hog_01",
        patrol: [
          { x: 3.4, z: 2.6 },
          { x: 4, z: -2.7 },
          { x: 1.8, z: -4 },
        ],
      },
    ],
    chestSpawns: [],
    decorZones: [
      {
        id: "combat_04_barrel_storage",
        type: "barrel_storage",
        x: -4.5,
        z: 4.5,
        w: 2,
        d: 2,
      },
      {
        id: "combat_04_rubble_scatter",
        type: "rubble",
        x: 4,
        z: -4,
        w: 2.5,
        d: 2.5,
      },
      {
        id: "combat_04_stones",
        type: "stones",
        x: 0,
        z: 4.2,
        w: 3,
        d: 2,
      },
    ],
    obstacleModules: [
      {
        x: -1,
        z: -1,
        w: 1,
        d: 1,
        moduleId: "rocks",
        collision: true,
        collisionScale: 1,
      },
      {
        x: 0,
        z: -1,
        w: 1,
        d: 1,
        moduleId: "rocks",
        collision: true,
        collisionScale: 1,
      },
      {
        x: 1,
        z: -1,
        w: 1,
        d: 1,
        moduleId: "rocks",
        collision: true,
        collisionScale: 1,
      },
      {
        x: -1,
        z: 0,
        w: 1,
        d: 1,
        moduleId: "rocks",
        collision: true,
        collisionScale: 1,
      },
      {
        x: 0,
        z: 0,
        w: 1,
        d: 1,
        moduleId: "rocks",
        collision: true,
        collisionScale: 1,
      },
      {
        x: 1,
        z: 0,
        w: 1,
        d: 1,
        moduleId: "rocks",
        collision: true,
        collisionScale: 1,
      },
      {
        x: -1,
        z: 1,
        w: 1,
        d: 1,
        moduleId: "rocks",
        collision: true,
        collisionScale: 1,
      },
      {
        x: 0,
        z: 1,
        w: 1,
        d: 1,
        moduleId: "rocks",
        collision: true,
        collisionScale: 1,
      },
      {
        x: 1,
        z: 1,
        w: 1,
        d: 1,
        moduleId: "rocks",
        collision: true,
        collisionScale: 1,
      },
    ],
  },
  createCombatLRoom({
    id: "combat_L_01",
    name: "L Combat Room 01 North/East",
    quarterTurns: 0,
  }),
  createCombatLRoom({
    id: "combat_L_02",
    name: "L Combat Room 02 North/West",
    quarterTurns: 3,
  }),
  createCombatLRoom({
    id: "combat_L_03",
    name: "L Combat Room 03 East/South",
    quarterTurns: 1,
  }),
  createCombatLRoom({
    id: "combat_L_04",
    name: "L Combat Room 04 South/West",
    quarterTurns: 2,
  }),
  {
    id: "combat_obstacle_01",
    type: "combat",
    name: "Obstacle Combat Room 01",
    dimensions: { w: 11, d: 11 },
    floorModules: [
      {
        x: 0,
        z: 0,
        w: 11,
        d: 11,
        moduleId: "floor",
      },
    ],
    walkableAreas: [
      {
        x: 0,
        z: 0,
        w: 11,
        d: 11,
      },
    ],
    wallModules: [
      {
        x: -5,
        z: -5,
        w: 1,
        d: 1,
        corner: "northWest",
        rotationY: 0,
        moduleId: "wallCorner",
      },
      {
        x: 5,
        z: -5,
        w: 1,
        d: 1,
        corner: "northEast",
        rotationY: Math.PI / 2,
        moduleId: "wallCorner",
      },
      {
        x: 5,
        z: 5,
        w: 1,
        d: 1,
        corner: "southEast",
        rotationY: Math.PI,
        moduleId: "wallCorner",
      },
      {
        x: -5,
        z: 5,
        w: 1,
        d: 1,
        corner: "southWest",
        rotationY: -Math.PI / 2,
        moduleId: "wallCorner",
      }, 
      {
        x: -3,
        z: -5,
        w: 3,
        d: 1,
        side: "north",
        rotationY: 0,
        moduleId: "wallHalf",
      },
      {
        x: 3,
        z: -5,
        w: 3,
        d: 1,
        side: "north",
        rotationY: 0,
        moduleId: "wallHalf",
      },
      {
        x: -3,
        z: 5,
        w: 3,
        d: 1,
        side: "south",
        rotationY: -Math.PI,
        moduleId: "wallHalf",
      },
      {
        x: 3,
        z: 5,
        w: 3,
        d: 1,
        side: "south",
        rotationY: -Math.PI,
        moduleId: "wallHalf",
      },
      {
        x: -5,
        z: 0,
        w: 1,
        d: 9,
        side: "west",
        rotationY: Math.PI / 2,
        moduleId: "wallHalf",
      },
      {
        x: 5,
        z: 0,
        w: 1,
        d: 9,
        side: "east",
        rotationY: -Math.PI / 2,
        moduleId: "wallHalf",
      },
    ],
    doorwayModules: [
      {
        x: 0,
        z: -5,
        w: 3,
        d: 1,
        side: "north",
        rotationY: 0,
        moduleId: "wallHalf",
      },
      {
        x: 0,
        z: 5,
        w: 3,
        d: 1,
        side: "south",
        rotationY: -Math.PI,
        moduleId: "wallHalf",
      },
    ],
    doorOpenings: [
      { side: "north", offset: 0, width: 1 },
      { side: "south", offset: 0, width: 1 },
    ],
    enemySpawns: [
      {
        x: -3,
        z: -2.2,
        modelId: "enemy_hog_01",
        patrol: [
          { x: -3, z: -2.2 },
          { x: -3.4, z: 1.6 },
          { x: -1.3, z: 3.1 },
        ],
      },
      {
        x: 3,
        z: 2.2,
        modelId: "enemy_hog_01",
        patrol: [
          { x: 3, z: 2.2 },
          { x: 3.4, z: -1.6 },
          { x: 1.3, z: -3.1 },
        ],
      },
    ],
    chestSpawns: [
      {
        x: 3.5,
        z: -4,
        rotationY: 0,
        modelId: "chest_01",
        optional: true,
      },
    ],
    decorZones: [
      {
        id: "combat_obstacle_01_rubble_scatter",
        type: "rubble",
        x: -1.5,
        z: -1.5,
        w: 3,
        d: 3,
      },
    ],
    obstacleModules: [
      {
        x: 0,
        z: 0,
        w: 1,
        d: 1,
        moduleId: "rocks",
        collision: true,
      },
    ],
  },
];
