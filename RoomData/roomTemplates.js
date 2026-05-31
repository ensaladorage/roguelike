import { ENTER_ROOM_TEMPLATES } from "./enterRooms.js";
import { COMBAT_ROOM_TEMPLATES } from "./combatRooms.js";
import { TREASURE_ROOM_TEMPLATES } from "./treasureRooms.js";
import { EXIT_ROOM_TEMPLATES } from "./exitRooms.js";

const WALL_TILE_SIZE = 1;

const WALL_ROTATION_BY_SIDE = {
  north: 0,
  south: 0,
  west: Math.PI / 2,
  east: Math.PI / 2,
};

const CORNER_ROTATION_BY_CORNER = {
  northWest: 0,
  northEast: Math.PI / 2,
  southEast: Math.PI,
  southWest: -Math.PI / 2,
};

function createWallSegment(side, dimensions, startOffset, endOffset, moduleId) {
  const length = endOffset - startOffset;
  if (length <= 0.05) return null;

  const halfW = dimensions.w / 2;
  const halfD = dimensions.d / 2;
  const centerOffset = startOffset + length / 2;

  switch (side) {
    case "north":
      return {
        x: centerOffset,
        z: -halfD + WALL_TILE_SIZE / 2,
        w: length,
        d: WALL_TILE_SIZE,
        side,
        rotationY: WALL_ROTATION_BY_SIDE[side],
        moduleId,
      };

    case "south":
      return {
        x: centerOffset,
        z: halfD - WALL_TILE_SIZE / 2,
        w: length,
        d: WALL_TILE_SIZE,
        side,
        rotationY: WALL_ROTATION_BY_SIDE[side],
        moduleId,
      };

    case "west":
      return {
        x: -halfW + WALL_TILE_SIZE / 2,
        z: centerOffset,
        w: WALL_TILE_SIZE,
        d: length,
        side,
        rotationY: WALL_ROTATION_BY_SIDE[side],
        moduleId,
      };

    case "east":
      return {
        x: halfW - WALL_TILE_SIZE / 2,
        z: centerOffset,
        w: WALL_TILE_SIZE,
        d: length,
        side,
        rotationY: WALL_ROTATION_BY_SIDE[side],
        moduleId,
      };

    default:
      return null;
  }
}

function createDoorwayModule(opening, dimensions) {
  const halfW = dimensions.w / 2;
  const halfD = dimensions.d / 2;
  const moduleId = opening.moduleId ?? "wallOpening";
  const width = opening.width ?? 1;

  switch (opening.side) {
    case "north":
      return {
        x: opening.offset,
        z: -halfD + WALL_TILE_SIZE / 2,
        w: width,
        d: WALL_TILE_SIZE,
        side: opening.side,
        rotationY: WALL_ROTATION_BY_SIDE[opening.side],
        moduleId,
      };

    case "south":
      return {
        x: opening.offset,
        z: halfD - WALL_TILE_SIZE / 2,
        w: width,
        d: WALL_TILE_SIZE,
        side: opening.side,
        rotationY: WALL_ROTATION_BY_SIDE[opening.side],
        moduleId,
      };

    case "west":
      return {
        x: -halfW + WALL_TILE_SIZE / 2,
        z: opening.offset,
        w: WALL_TILE_SIZE,
        d: width,
        side: opening.side,
        rotationY: WALL_ROTATION_BY_SIDE[opening.side],
        moduleId,
      };

    case "east":
      return {
        x: halfW - WALL_TILE_SIZE / 2,
        z: opening.offset,
        w: WALL_TILE_SIZE,
        d: width,
        side: opening.side,
        rotationY: WALL_ROTATION_BY_SIDE[opening.side],
        moduleId,
      };

    default:
      return null;
  }
}

function createCornerModules(dimensions, moduleId = "wallCorner") {
  const halfW = dimensions.w / 2;
  const halfD = dimensions.d / 2;

  return [
    {
      x: -halfW + 0.5,
      z: -halfD + 0.5,
      w: 1,
      d: 1,
      corner: "northWest",
      rotationY: CORNER_ROTATION_BY_CORNER.northWest,
      moduleId,
    },
    {
      x: halfW - 0.5,
      z: -halfD + 0.5,
      w: 1,
      d: 1,
      corner: "northEast",
      rotationY: CORNER_ROTATION_BY_CORNER.northEast,
      moduleId,
    },
    {
      x: halfW - 0.5,
      z: halfD - 0.5,
      w: 1,
      d: 1,
      corner: "southEast",
      rotationY: CORNER_ROTATION_BY_CORNER.southEast,
      moduleId,
    },
    {
      x: -halfW + 0.5,
      z: halfD - 0.5,
      w: 1,
      d: 1,
      corner: "southWest",
      rotationY: CORNER_ROTATION_BY_CORNER.southWest,
      moduleId,
    },
  ];
}

function createPerimeterModules({
  dimensions,
  doorOpenings = [],
  wallModuleId = "wallNarrow",
  cornerModuleId = "wallCorner",
}) {
  const wallModules = createCornerModules(dimensions, cornerModuleId);
  const doorwayModules = [];
  const sides = ["north", "south", "west", "east"];

  for (const side of sides) {
    const sideLength = side === "north" || side === "south"
      ? dimensions.w
      : dimensions.d;
    const usableStart = -sideLength / 2 + WALL_TILE_SIZE;
    const usableEnd = sideLength / 2 - WALL_TILE_SIZE;
    const openings = doorOpenings
      .filter((opening) => opening.side === side)
      .map((opening) => ({
        ...opening,
        width: opening.width ?? 1,
        start: opening.offset - (opening.width ?? 1) / 2,
        end: opening.offset + (opening.width ?? 1) / 2,
      }))
      .sort((a, b) => a.start - b.start);

    let cursor = usableStart;

    for (const opening of openings) {
      const segment = createWallSegment(
        side,
        dimensions,
        cursor,
        opening.start,
        wallModuleId
      );

      if (segment) wallModules.push(segment);

      const doorway = createDoorwayModule(opening, dimensions);
      if (doorway) doorwayModules.push(doorway);

      cursor = opening.end;
    }

    const tail = createWallSegment(
      side,
      dimensions,
      cursor,
      usableEnd,
      wallModuleId
    );

    if (tail) wallModules.push(tail);
  }

  return {
    wallModules,
    doorwayModules,
  };
}

function createRectRoomTemplate({
  id,
  type = "utility",
  name,
  tags = [],
  dimensions,
  floorModules,
  walkableAreas,
  doorOpenings = [],
  wallModuleId = "wallNarrow",
  cornerModuleId = "wallCorner",
  enemySpawns = [],
  chestSpawns = [],
  exitMarker = null,
  setDressingModules = [],
  obstacleModules = [],
  decorZones = [],
}) {
  const perimeter = createPerimeterModules({
    dimensions,
    doorOpenings,
    wallModuleId,
    cornerModuleId,
  });

  return {
    id,
    type,
    name,
    tags,
    dimensions,
    floorModules: floorModules ?? [
      {
        x: 0,
        z: 0,
        w: dimensions.w,
        d: dimensions.d,
        moduleId: "floor",
      },
    ],
    walkableAreas: walkableAreas ?? [
      {
        x: 0,
        z: 0,
        w: dimensions.w,
        d: dimensions.d,
      },
    ],
    wallModules: perimeter.wallModules,
    doorwayModules: perimeter.doorwayModules,
    doorOpenings,
    enemySpawns,
    chestSpawns,
    exitMarker,
    setDressingModules,
    obstacleModules,
    decorZones,
  };
}

export const ROOM_TEMPLATES = [
  ...ENTER_ROOM_TEMPLATES,
  ...COMBAT_ROOM_TEMPLATES,
  ...TREASURE_ROOM_TEMPLATES,
  ...EXIT_ROOM_TEMPLATES,
  createRectRoomTemplate({
    id: "corridor_straight",
    type: "connector",
    name: "Straight Corridor",
    tags: ["connector", "small", "narrow", "three_way"],
    dimensions: { w: 5, d: 10 },
    doorOpenings: [
      { side: "north", offset: 0, width: 1 },
      { side: "south", offset: 0, width: 1 },
      { side: "east", offset: 0, width: 1 },
    ],
  }),
  createRectRoomTemplate({
    id: "combat_room_basic",
    type: "combat",
    name: "Combat Room",
    tags: ["combat", "standard", "open", "obstacle", "guarded", "easy", "north_south"],
    dimensions: { w: 11, d: 9 },
    doorOpenings: [
      { side: "north", offset: 0, width: 1 },
      { side: "south", offset: 0, width: 1 },
    ],
    enemySpawns: [
      {
        x: -2.5,
        z: -1,
        patrol: [
          { x: -2.5, z: -1 },
          { x: 2.5, z: -1 },
          { x: 2.5, z: 2 },
          { x: -2.5, z: 2 },
        ],
      },
      {
        x: 3,
        z: 2,
        patrol: [
          { x: 3, z: 2 },
          { x: 0.5, z: 2.5 },
          { x: -3, z: -2 },
          { x: 2.5, z: -2.2 },
        ],
      },
    ],
    chestSpawns: [
      { x: 3.5, z: 2.6, rotationY: Math.PI },
      { x: -3.7, z: 2.4, rotationY: Math.PI / 2 },
    ],
    obstacleModules: [
      { x: 0, z: 1.4, w: 1, d: 1, moduleId: "rocks", collision: true },
    ],
  }),
  createRectRoomTemplate({
    id: "exit_room_basic",
    type: "exit",
    name: "Exit Room",
    tags: ["exit", "standard", "open", "treasure", "dead_end", "south"],
    dimensions: { w: 9, d: 9 },
    doorOpenings: [
      { side: "south", offset: 0, width: 1 },
    ],
    exitMarker: {
      x: 0,
      z: -1.4,
    },
    chestSpawns: [
      { x: -2.7, z: 1.9, rotationY: Math.PI / 2 },
    ],
  }),
  createRectRoomTemplate({
    id: "half_wall_alcove",
    type: "treasure",
    name: "Side Alcove",
    tags: ["treasure", "small", "open", "dead_end", "west"],
    dimensions: { w: 7, d: 7 },
    wallModuleId: "wallNarrow",
    cornerModuleId: "wallCorner",
    doorOpenings: [
      { side: "west", offset: 0, width: 1 },
    ],
    chestSpawns: [
      { x: -1.6, z: 0.8, rotationY: Math.PI / 2 },
    ],
  }),
];

export const ROOM_TEMPLATES_BY_ID = Object.fromEntries(
  ROOM_TEMPLATES.map((template) => [template.id, template])
);
