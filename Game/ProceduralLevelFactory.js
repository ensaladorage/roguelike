import { ENEMY_DIFFICULTY } from "../CharacterData/enemyDefinitions.js";
import { COMBAT_ROOM_TEMPLATES } from "../RoomData/combatRooms.js";
import { ENTER_ROOM_TEMPLATES } from "../RoomData/enterRooms.js";
import { EXIT_ROOM_TEMPLATES } from "../RoomData/exitRooms.js";
import { TREASURE_ROOM_TEMPLATES } from "../RoomData/treasureRooms.js";

const MAX_GENERATION_ATTEMPTS = 120;
const ROOM_TOUCH_EPSILON = 0.001;

const OPPOSITE_SIDE = {
  north: "south",
  south: "north",
  west: "east",
  east: "west",
};

const SIDE_VECTOR = {
  north: { x: 0, z: -1 },
  south: { x: 0, z: 1 },
  west: { x: -1, z: 0 },
  east: { x: 1, z: 0 },
};

const COMBAT_ROOM_COUNT = { min: 2, max: 3 };
const TREASURE_ROOM_COUNT = { min: 3, max: 4 };
const ENTRY_STAIRS_OFFSET_FROM_WALL = 1.5;
const PLAYER_START_OFFSET_FROM_ENTRY_STAIRS = 1;

const PROCEDURAL_DECORATION_FILL = {
  seed: "random",
  modules: [
    {
      moduleId: "floorDetail",
      density: 0.3,
    },
    {
      moduleId: "barrel",
      density: 1,
      roomTypes: ["combat", "treasure"],
      spotStrategy: "semantic",
      spotTypes: ["corner", "door", "chest"],
      spotMinDistance: 5,
      spotInset: 1.4,
      doorSpotDepth: 2.2,
      doorSpotSideOffset: 2,
      chestSpotOffset: 1.8,
      clustersPerRoom: { min: 3, max: 5 },
      clusterSize: { min: 2, max: 5 },
      clusterRadius: 1,
      clusterScatterRadius: 0.4,
      placementFootprint: { w: 0.6, d: 0.6 },
      collisionFootprint: { w: 0.1, d: 0.1 },
      positionJitter: 1,
      scaleVariation: { min: 0.8, max: 1.6 },
    },
    {
      moduleId: "stones",
      density: 0.05,
      zoneTypes: null,
      allowUnzoned: true,
      placementFootprint: { w: 0.35, d: 0.35 },
      positionJitter: 0.35,
      scaleVariation: { min: 0.5, max: 1.2 },
    },
  ],
};

export const PROCEDURAL_LEVELS = [
  {
    id: "procedural_level_1",
    tileSetId: "scenarioDefault",
    create: createProceduralLevelOne,
  },
];

export function createProceduralFloor(options = {}) {
  return createProceduralLevelOne(options);
}

export function createProceduralLevelOne(options = {}) {
  const floorIndex = getFloorIndex(options);
  const floorSeed =
    options.floorSeed ??
    `${options.runSeed ?? Date.now()}:floor:${String(floorIndex).padStart(2, "0")}`;
  const rng = createSeededRandom(floorSeed);

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const level = tryCreateProceduralLevelOne(
      rng,
      {
        ...options,
        floorIndex,
        floorSeed,
      },
      attempt
    );

    if (level) return level;
  }

  throw new Error(`Could not generate a connected procedural floor ${floorIndex}.`);
}

function tryCreateProceduralLevelOne(rng, options, attempt) {
  const treasureCount = randomInt(
    rng,
    TREASURE_ROOM_COUNT.min,
    TREASURE_ROOM_COUNT.max
  );
  const combatCount = randomInt(
    rng,
    COMBAT_ROOM_COUNT.min,
    COMBAT_ROOM_COUNT.max
  );
  const enterTemplate = pickOne(rng, ENTER_ROOM_TEMPLATES);
  const rooms = [];

  const enterPlacement = createRoomPlacement({
    id: "EnterRoom",
    template: enterTemplate,
    position: { x: 0, z: 0 },
  });
  rooms.push(enterPlacement);

  const middleChain = buildMiddleRoomChain({
    rng,
    rooms,
    currentRoom: enterPlacement,
    usedOpenings: new Set(),
    remainingCounts: {
      combat: combatCount,
      treasure: treasureCount,
    },
  });

  if (!middleChain) return null;

  const exitPlacement = placeExitRoom({
    rng,
    rooms: middleChain.rooms,
    currentRoom: middleChain.currentRoom,
    usedOpenings: middleChain.usedOpenings,
  });

  if (!exitPlacement) return null;

  rooms.splice(0, rooms.length, ...middleChain.rooms, exitPlacement.room);

  const placements = rooms.map((room) => ({
    id: room.id,
    templateId: room.templateId,
    position: { ...room.position },
    rotationY: room.rotationY,
  }));
  const playerStart = getPlayerStartFromEnterRoom(rooms[0], rooms[1]);
  const bounds = getRoomBounds(rooms);
  const floorCenter = {
    x: (bounds.minX + bounds.maxX) / 2,
    z: (bounds.minZ + bounds.maxZ) / 2,
  };
  const floorSize = Math.ceil(
    Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ) + 10
  );
  const roomSummary = rooms
    .map((room) => room.templateId.replace(/_room/g, ""))
    .join(" -> ");

  const floorIndex = getFloorIndex(options);
  const floorSeed = options.floorSeed ?? `${options.runSeed ?? "run"}:floor:${floorIndex}`;
  const difficultyTier = options.difficultyTier ?? ENEMY_DIFFICULTY.EASY;

  return {
    kind: "assembled",
    tileSetId: "scenarioDefault",
    name: `Procedural Floor ${floorIndex} (${roomSummary})`,
    connectorStyleId: "openCorridor",
    enemyDifficulty: difficultyTier,
    decorationFill: PROCEDURAL_DECORATION_FILL,
    playerStart,
    floorSize,
    floorCenter,
    procedural: {
      floor: floorIndex,
      floorSeed,
      floorType: options.floorType ?? "procedural",
      difficultyTier,
      attempt,
      roomCount: rooms.length,
      treasureCount,
      combatCount,
    },
    rooms: placements,
  };
}

function buildMiddleRoomChain({
  rng,
  rooms,
  currentRoom,
  usedOpenings,
  remainingCounts,
}) {
  if (remainingCounts.combat <= 0 && remainingCounts.treasure <= 0) {
    return {
      rooms,
      currentRoom,
      usedOpenings,
    };
  }

  const candidates = getCompatibleRoomCandidates({
    rng,
    rooms,
    currentRoom,
    usedOpenings,
    remainingCounts,
    templateGroups: {
      combat: COMBAT_ROOM_TEMPLATES,
      treasure: TREASURE_ROOM_TEMPLATES,
    },
  });

  for (const candidate of candidates) {
    const nextUsedOpenings = new Set(usedOpenings);
    nextUsedOpenings.add(getOpeningUseKey(currentRoom.id, candidate.targetOpening));
    nextUsedOpenings.add(getOpeningUseKey(candidate.room.id, candidate.incomingOpening));

    const nextRemainingCounts = {
      ...remainingCounts,
      [candidate.type]: remainingCounts[candidate.type] - 1,
    };

    const result = buildMiddleRoomChain({
      rng,
      rooms: [...rooms, candidate.room],
      currentRoom: candidate.room,
      usedOpenings: nextUsedOpenings,
      remainingCounts: nextRemainingCounts,
    });

    if (result) return result;
  }

  return null;
}

function placeExitRoom({ rng, rooms, currentRoom, usedOpenings }) {
  const candidates = getCompatibleRoomCandidates({
    rng,
    rooms,
    currentRoom,
    usedOpenings,
    remainingCounts: { exit: 1 },
    templateGroups: {
      exit: EXIT_ROOM_TEMPLATES,
    },
  });

  return candidates[0] ?? null;
}

function getCompatibleRoomCandidates({
  rng,
  rooms,
  currentRoom,
  usedOpenings,
  remainingCounts,
  templateGroups,
}) {
  const freeOpenings = getFreeOpenings(currentRoom, usedOpenings);
  const candidates = [];

  for (const targetOpening of shuffle(rng, freeOpenings)) {
    for (const type of shuffle(rng, Object.keys(templateGroups))) {
      if ((remainingCounts[type] ?? 0) <= 0) continue;

      for (const template of shuffle(rng, templateGroups[type])) {
        const incomingOpenings = getTemplateOpenings(template).filter(
          (opening) => opening.side === OPPOSITE_SIDE[targetOpening.side]
        );

        for (const incomingOpening of shuffle(rng, incomingOpenings)) {
          const room = createPlacedRoomFromConnection({
            template,
            type,
            rooms,
            targetOpening,
            incomingOpening,
          });

          if (!room) continue;

          candidates.push({
            type,
            room,
            targetOpening,
            incomingOpening: room.openings[incomingOpening.openingIndex],
          });
        }
      }
    }
  }

  return shuffle(rng, candidates);
}

function createPlacedRoomFromConnection({
  template,
  type,
  rooms,
  targetOpening,
  incomingOpening,
}) {
  const index = rooms.length;
  const position = {
    x: targetOpening.x - incomingOpening.x,
    z: targetOpening.z - incomingOpening.z,
  };
  const room = createRoomPlacement({
    id: createRoomId({ ...template, type }, index),
    template,
    position,
  });

  if (roomOverlapsExisting(room, rooms)) return null;

  const placedIncomingOpening = room.openings[incomingOpening.openingIndex];
  if (!placedIncomingOpening) return null;
  if (
    countOpeningMatchesWithExistingRooms(room, rooms) !== 1 ||
    !areOpeningsConnected(targetOpening, placedIncomingOpening)
  ) {
    return null;
  }

  return room;
}

function countOpeningMatchesWithExistingRooms(room, rooms) {
  let matchCount = 0;

  for (const opening of room.openings) {
    for (const existingRoom of rooms) {
      for (const existingOpening of existingRoom.openings) {
        if (areOpeningsConnected(opening, existingOpening)) {
          matchCount += 1;
        }
      }
    }
  }

  return matchCount;
}

function areOpeningsConnected(opening, otherOpening) {
  return (
    OPPOSITE_SIDE[opening.side] === otherOpening.side &&
    almostEqual(opening.x, otherOpening.x) &&
    almostEqual(opening.z, otherOpening.z)
  );
}

function createRoomId(template, index) {
  const suffix = String(index).padStart(2, "0");
  const readableType = template.type?.[0]?.toUpperCase() + template.type?.slice(1);

  return `${readableType ?? "Room"}${suffix}`;
}

function createRoomPlacement({ id, template, position }) {
  const openings = getTemplateOpenings(template, position);
  const dimensions = { ...template.dimensions };

  return {
    id,
    templateId: template.id,
    type: template.type,
    position,
    rotationY: 0,
    dimensions,
    openings,
    bounds: getPlacementBounds(position, dimensions),
  };
}

function getTemplateOpenings(template, position = { x: 0, z: 0 }) {
  return template.doorOpenings.map((opening, openingIndex) => {
    const localCenter = getOpeningLocalCenter(opening, template.dimensions);

    return {
      ...opening,
      openingIndex,
      x: position.x + localCenter.x,
      z: position.z + localCenter.z,
    };
  });
}

function getFreeOpenings(room, usedOpenings) {
  return room.openings.filter(
    (opening) => !usedOpenings.has(getOpeningUseKey(room.id, opening))
  );
}

function getOpeningUseKey(roomId, opening) {
  return `${roomId}:${opening.openingIndex}`;
}

function getOpeningLocalCenter(opening, dimensions) {
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
      return { x: 0, z: 0 };
  }
}

function getPlacementBounds(position, dimensions) {
  return {
    minX: position.x - dimensions.w / 2,
    maxX: position.x + dimensions.w / 2,
    minZ: position.z - dimensions.d / 2,
    maxZ: position.z + dimensions.d / 2,
  };
}

function getRoomBounds(rooms) {
  return rooms.reduce(
    (bounds, room) => ({
      minX: Math.min(bounds.minX, room.bounds.minX),
      maxX: Math.max(bounds.maxX, room.bounds.maxX),
      minZ: Math.min(bounds.minZ, room.bounds.minZ),
      maxZ: Math.max(bounds.maxZ, room.bounds.maxZ),
    }),
    {
      minX: Infinity,
      maxX: -Infinity,
      minZ: Infinity,
      maxZ: -Infinity,
    }
  );
}

function roomOverlapsExisting(room, rooms) {
  return rooms.some((existing) => rectanglesOverlap(room.bounds, existing.bounds));
}

function rectanglesOverlap(a, b) {
  return (
    a.minX < b.maxX - ROOM_TOUCH_EPSILON &&
    a.maxX > b.minX + ROOM_TOUCH_EPSILON &&
    a.minZ < b.maxZ - ROOM_TOUCH_EPSILON &&
    a.maxZ > b.minZ + ROOM_TOUCH_EPSILON
  );
}

function getPlayerStartFromEnterRoom(enterRoom, nextRoom) {
  const connectedOpening = enterRoom.openings.find((opening) =>
    nextRoom.openings.some(
      (candidate) =>
        candidate.side === OPPOSITE_SIDE[opening.side] &&
        almostEqual(candidate.x, opening.x) &&
        almostEqual(candidate.z, opening.z)
    )
  );

  const startOpening = enterRoom.openings.find(
    (opening) => opening.side === OPPOSITE_SIDE[connectedOpening?.side]
  ) ?? enterRoom.openings[0];
  const direction = SIDE_VECTOR[OPPOSITE_SIDE[startOpening.side]];
  const offset = ENTRY_STAIRS_OFFSET_FROM_WALL + PLAYER_START_OFFSET_FROM_ENTRY_STAIRS;

  return {
    x: startOpening.x + direction.x * offset,
    z: startOpening.z + direction.z * offset,
  };
}

function pickOne(rng, source) {
  return source[Math.floor(rng() * source.length)];
}

function shuffle(rng, source) {
  const result = [...source];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    const current = result[index];

    result[index] = result[swapIndex];
    result[swapIndex] = current;
  }

  return result;
}

function randomInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function almostEqual(a, b) {
  return Math.abs(a - b) <= 0.001;
}

function createSeededRandom(seed) {
  let state = hashString(seed);

  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);

    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(value) {
  let hash = 2166136261;
  const text = String(value);

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function getFloorIndex(options = {}) {
  return options.floorIndex ?? (options.levelIndex ?? 0) + 1;
}
