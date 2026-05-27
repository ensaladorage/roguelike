import { DecorationBuilder } from "./DecorationBuilder.js";
import {
  ENEMY_DIFFICULTY,
  pickEnemyDefinitionForDifficulty,
} from "../Data/enemyDefinitions.js";

function cloneArea(area) {
  return {
    ...area,
  };
}

const OUTER_WALL_ROTATION = {
  north: 0,
  south: Math.PI,
  west: Math.PI / 2,
  east: -Math.PI / 2,
};

const OPPOSITE_SIDE = {
  north: "south",
  south: "north",
  west: "east",
  east: "west",
};

const ROCK_COLLISION_SCALE = 0.55;
const BARREL_COLLISION_SCALE = 0.1;
const ENTRY_STAIRS_OFFSET_FROM_WALL = 1.5;
const EXIT_STAIRS_OFFSET_FROM_WALL = 1.5;
const EXIT_STAIRS_Y = -0.9;
const EXIT_STAIRS_FLOOR_HOLE_SIZE = 1;
const EXIT_STAIRS_DIRT_SIDE_OFFSET = 1;
const EXIT_STAIRS_DIRT_FRONT_OFFSET = 1;
const EXIT_STAIRS_DIRT_Y = -0.95;
const EXIT_STAIRS_WOOD_STRUCTURE_Y = -0.85;
const EXIT_STAIRS_WOOD_STRUCTURE_SIZE = { w: 1.2, d: 1.2, height: 1 };
const ENTRY_STAIRS_ROTATION_TOWARD_WALL_BY_SIDE = {
  north: 0,
  south: Math.PI,
  west: -Math.PI / 2,
  east: Math.PI / 2,
};
const EXIT_STAIRS_ROTATION_BY_SIDE = {
  north: Math.PI,
  south: 0,
  west: -Math.PI / 2,
  east: Math.PI / 2,
};
const EXIT_STAIRS_WOOD_STRUCTURE_ROTATION_BY_SIDE = {
  north: 0,
  south: Math.PI,
  west: Math.PI / 2,
  east: -Math.PI / 2,
};
const CONNECTOR_STYLES = {
  openCorridor: {
    id: "openCorridor",
    length: 3,
    depth: 2,
    wallThickness: 1,
    collisionWallThickness: 0.6,
    sideWallOffset: 1,
    floorModuleId: "floor",
    sideWallModuleId: "wallCorner",
    archModuleId: "woodSupport",
  },
};

export class LevelBuilder {
  constructor({ roomTemplateLibrary }) {
    this.roomTemplateLibrary = roomTemplateLibrary;
    this.decorationBuilder = new DecorationBuilder();
  }

  build(levelDefinition, buildOptions = {}) {
    if (!levelDefinition) return null;

    if (levelDefinition.kind === "authored") {
      return this.buildAuthoredLevel(levelDefinition);
    }

    if (levelDefinition.kind === "assembled") {
      return this.buildAssembledLevel(levelDefinition, buildOptions);
    }

    return this.buildLegacyLevel(levelDefinition);
  }

  buildAuthoredLevel(levelDefinition) {
    const environment = {
      tileSetId: levelDefinition.tileSetId ?? "scenarioDefault",
      floorModules: (levelDefinition.floorModules ?? []).map(cloneArea),
      wallModules: (levelDefinition.wallModules ?? []).map(cloneArea),
      doorwayModules: (levelDefinition.doorwayModules ?? []).map(cloneArea),
      decorativeModules: [
        ...(levelDefinition.setDressingModules ?? []),
        ...(levelDefinition.decorativeModules ?? []),
        ...(levelDefinition.obstacleModules ?? []),
      ].map(cloneArea),
    };

    const collisionWalls = [
      ...(levelDefinition.wallModules ?? []).map(cloneArea),
      ...this.createDecorationCollisionModules(levelDefinition),
    ];

    if (levelDefinition.outerBoundary) {
      const boundary = this.createOuterBoundaryModules(levelDefinition.outerBoundary);

      environment.wallModules.push(...boundary.wallModules);
      environment.decorativeModules.push(...boundary.decorativeModules);
      collisionWalls.push(...boundary.wallModules.map(cloneArea));
    }

    return {
      ...levelDefinition,
      environment,
      walkableAreas: (levelDefinition.walkableAreas ?? []).map(cloneArea),
      collisionWalls,
      chests: (levelDefinition.chests ?? []).map((chest) => ({ ...chest })),
      enemies: (levelDefinition.enemies ?? []).map((enemy) => ({
        ...enemy,
        patrol: (enemy.patrol ?? []).map((point) => ({ ...point })),
        patrolAreas: (enemy.patrolAreas ?? []).map(cloneArea),
      })),
      exit: levelDefinition.exit ? { ...levelDefinition.exit } : null,
    };
  }

  buildLegacyLevel(levelDefinition) {
    const floorModules = (levelDefinition.floorModules ?? levelDefinition.floorPatches ?? []).map(
      (patch) => ({
        ...patch,
        moduleId: patch.moduleId ?? "floor",
      })
    );

    const roomWallModules = (levelDefinition.rooms ?? []).flatMap((room) =>
      this.createLegacyRoomWallModules(room)
    );

    const doorwayModules = (levelDefinition.rooms ?? []).flatMap((room) =>
      this.createLegacyRoomDoorwayModules(room)
    );

    const wallModules = [...(levelDefinition.outerWalls ?? []), ...roomWallModules].map(
      (wall) => ({
        ...wall,
        moduleId: wall.moduleId ?? "wallNarrow",
      })
    );

    return {
      ...levelDefinition,
      environment: {
        tileSetId: levelDefinition.tileSetId ?? "scenarioDefault",
        floorModules,
        wallModules,
        doorwayModules,
        decorativeModules: [],
      },
      walkableAreas: (
        levelDefinition.walkableAreas ??
        levelDefinition.floorPatches ??
        []
      ).map(cloneArea),
      collisionWalls: wallModules.map(cloneArea),
      chests: (levelDefinition.chests ?? []).map((chest) => ({ ...chest })),
      enemies: (levelDefinition.enemies ?? []).map((enemy) => ({
        ...enemy,
        patrol: (enemy.patrol ?? []).map((point) => ({ ...point })),
        patrolAreas: (enemy.patrolAreas ?? []).map(cloneArea),
      })),
      exit: levelDefinition.exit ? { ...levelDefinition.exit } : null,
    };
  }

  buildAssembledLevel(levelDefinition, buildOptions = {}) {
    const environment = {
      tileSetId: levelDefinition.tileSetId ?? "scenarioDefault",
      floorModules: [],
      wallModules: [],
      doorwayModules: [],
      decorativeModules: [],
    };

    const walkableAreas = [];
    const collisionWalls = [];
    const chests = [];
    const enemies = [];
    let exit = levelDefinition.exit ? { ...levelDefinition.exit } : null;
    const rooms = (levelDefinition.rooms ?? []).map((roomPlacement) =>
      this.roomTemplateLibrary.resolveRoomPlacement(roomPlacement)
    );
    const connectorStyle = this.getConnectorStyle(levelDefinition.connectorStyleId);
    const connections = this.detectRoomConnections(rooms, connectorStyle);
    const endpointsByRoom = this.groupConnectionEndpointsByRoom(connections);

    for (const room of rooms) {
      const roomConnectionEndpoints = endpointsByRoom.get(room.id) ?? [];
      const wallModules = this.clipRoomWallModulesForConnections(
        room.wallModules,
        roomConnectionEndpoints
      );
      const doorwayModules = this.filterConnectedDoorwayModules(
        room.doorwayModules,
        roomConnectionEndpoints
      );
      const stairsModule = this.createRoomStairsModule(
        room,
        roomConnectionEndpoints
      );
      const generatedDecorativeModules = this.decorationBuilder.buildRoomDecorations({
        room,
        levelDefinition,
        buildOptions,
        extraOccupiedModules: stairsModule ? [stairsModule] : [],
      });
      const floorModules = stairsModule?.role === "exitStairs"
        ? this.hideFloorTileUnderModule(room.floorModules, stairsModule)
        : room.floorModules;

      environment.floorModules.push(...floorModules);
      environment.wallModules.push(...wallModules);
      environment.doorwayModules.push(...doorwayModules);
      environment.decorativeModules.push(...generatedDecorativeModules);
      environment.decorativeModules.push(...(room.setDressingModules ?? []));
      environment.decorativeModules.push(...(room.decorativeModules ?? []));
      environment.decorativeModules.push(...room.obstacleModules);
      if (stairsModule) {
        environment.decorativeModules.push(stairsModule);
        if (stairsModule.role === "exitStairs") {
          environment.decorativeModules.push(
            this.createExitStairsWoodStructureModule(stairsModule)
          );
          environment.decorativeModules.push(
            ...this.createExitStairsDirtModules(stairsModule)
          );
        }
      }

      walkableAreas.push(...room.walkableAreas.map(cloneArea));
      collisionWalls.push(...wallModules.map(cloneArea));
      collisionWalls.push(...doorwayModules.map(cloneArea));
      if (stairsModule?.collision) {
        collisionWalls.push(this.createObstacleCollision(stairsModule));
      }
      collisionWalls.push(
        ...this.createDecorationCollisionModules({
          decorativeModules: generatedDecorativeModules,
        })
      );
      collisionWalls.push(
        ...this.createDecorationCollisionModules(room)
      );
      chests.push(...room.chestSpawns.map((spawn) => ({ ...spawn })));
      enemies.push(
        ...room.enemySpawns.map((spawn, spawnIndex) =>
          this.resolveEnemySpawn({
            spawn,
            spawnIndex,
            room,
            levelDefinition,
            buildOptions,
          })
        )
      );

      if (stairsModule?.role === "exitStairs") {
        exit = {
          ...(exit ?? {}),
          x: stairsModule.x,
          z: stairsModule.z,
        };
      } else if (room.exitMarker) {
        exit = {
          ...(exit ?? {}),
          x: room.exitMarker.x,
          z: room.exitMarker.z,
        };
      }
    }

    for (const connection of connections) {
      const connector = this.createConnectionModules(connection, connectorStyle);

      environment.floorModules.push(...connector.floorModules);
      environment.wallModules.push(...connector.wallModules);
      environment.decorativeModules.push(...connector.decorativeModules);
      walkableAreas.push(...connector.walkableAreas);
      collisionWalls.push(...connector.collisionWalls);
    }

    if (levelDefinition.outerBoundary) {
      const boundary = this.createOuterBoundaryModules(levelDefinition.outerBoundary);

      environment.wallModules.push(...boundary.wallModules);
      environment.decorativeModules.push(...boundary.decorativeModules);
      collisionWalls.push(...boundary.wallModules.map(cloneArea));
    }

    return {
      ...levelDefinition,
      environment,
      walkableAreas,
      collisionWalls,
      chests,
      enemies,
      exit,
      connections,
    };
  }

  getConnectorStyle(connectorStyleId = "openCorridor") {
    return CONNECTOR_STYLES[connectorStyleId] ?? CONNECTOR_STYLES.openCorridor;
  }

  detectRoomConnections(rooms, connectorStyle) {
    const connections = [];
    const usedOpenings = new Set();

    for (let roomIndex = 0; roomIndex < rooms.length; roomIndex += 1) {
      const room = rooms[roomIndex];

      for (let otherRoomIndex = roomIndex + 1; otherRoomIndex < rooms.length; otherRoomIndex += 1) {
        const otherRoom = rooms[otherRoomIndex];

        for (const opening of room.doorOpenings) {
          const openingKey = this.getOpeningKey(room.id, opening);
          if (usedOpenings.has(openingKey)) continue;

          const matchingOpening = otherRoom.doorOpenings.find((candidate) => {
            const candidateKey = this.getOpeningKey(otherRoom.id, candidate);

            return (
              !usedOpenings.has(candidateKey) &&
              this.areOpeningsConnected(opening, candidate)
            );
          });

          if (!matchingOpening) continue;

          usedOpenings.add(openingKey);
          usedOpenings.add(this.getOpeningKey(otherRoom.id, matchingOpening));

          connections.push({
            id: `${room.id}:${opening.side}-${otherRoom.id}:${matchingOpening.side}`,
            styleId: connectorStyle.id,
            a: {
              roomId: room.id,
              opening,
            },
            b: {
              roomId: otherRoom.id,
              opening: matchingOpening,
            },
          });
        }
      }
    }

    return connections;
  }

  areOpeningsConnected(opening, otherOpening) {
    const epsilon = 0.001;

    return (
      OPPOSITE_SIDE[opening.side] === otherOpening.side &&
      Math.abs(opening.x - otherOpening.x) <= epsilon &&
      Math.abs(opening.z - otherOpening.z) <= epsilon
    );
  }

  getOpeningKey(roomId, opening) {
    return `${roomId}:${opening.side}:${opening.x.toFixed(3)}:${opening.z.toFixed(3)}`;
  }

  groupConnectionEndpointsByRoom(connections) {
    const endpointsByRoom = new Map();

    for (const connection of connections) {
      for (const endpoint of [connection.a, connection.b]) {
        const endpoints = endpointsByRoom.get(endpoint.roomId) ?? [];

        endpoints.push({
          ...endpoint,
          connectionId: connection.id,
          connectorLength:
            CONNECTOR_STYLES[connection.styleId]?.length ??
            CONNECTOR_STYLES.openCorridor.length,
        });
        endpointsByRoom.set(endpoint.roomId, endpoints);
      }
    }

    return endpointsByRoom;
  }

  clipRoomWallModulesForConnections(wallModules, endpoints) {
    return wallModules.flatMap((module) => {
      let pieces = [module];

      for (const endpoint of endpoints) {
        pieces = pieces.flatMap((piece) =>
          this.subtractConnectionOpeningFromWall(piece, endpoint)
        );
      }

      return pieces;
    });
  }

  subtractConnectionOpeningFromWall(module, endpoint) {
    if (!this.isModuleOnConnectionLine(module, endpoint)) {
      return [module];
    }

    const isHorizontal = this.isHorizontalSide(endpoint.opening.side);
    const moduleStart = isHorizontal
      ? module.x - module.w / 2
      : module.z - module.d / 2;
    const moduleEnd = isHorizontal
      ? module.x + module.w / 2
      : module.z + module.d / 2;
    const connectorWidth = endpoint.connectorLength;
    const openingCenter = isHorizontal ? endpoint.opening.x : endpoint.opening.z;
    const openingStart = openingCenter - connectorWidth / 2;
    const openingEnd = openingCenter + connectorWidth / 2;

    if (moduleEnd <= openingStart || moduleStart >= openingEnd) {
      return [module];
    }

    return [
      this.createClippedWallModule(module, moduleStart, openingStart, isHorizontal),
      this.createClippedWallModule(module, openingEnd, moduleEnd, isHorizontal),
    ].filter(Boolean);
  }

  createClippedWallModule(module, start, end, isHorizontal) {
    const length = end - start;
    if (length <= 0.05) return null;

    if (isHorizontal) {
      return {
        ...module,
        x: start + length / 2,
        w: length,
      };
    }

    return {
      ...module,
      z: start + length / 2,
      d: length,
    };
  }

  filterConnectedDoorwayModules(doorwayModules, endpoints) {
    return doorwayModules.filter(
      (module) =>
        !endpoints.some((endpoint) =>
          this.isModuleOnConnectionLine(module, endpoint)
        )
    );
  }

  isOpeningConnected(roomId, opening, endpoints) {
    return endpoints.some(
      (endpoint) =>
        endpoint.roomId === roomId &&
        endpoint.opening.side === opening.side &&
        endpoint.opening.x === opening.x &&
        endpoint.opening.z === opening.z
    );
  }

  isModuleOnConnectionLine(module, endpoint) {
    if (!module.side || module.side !== endpoint.opening.side) return false;

    const isHorizontal = this.isHorizontalSide(endpoint.opening.side);
    const lineCoordinate = isHorizontal ? module.z : module.x;
    const expectedLineCoordinate = this.getWallModuleLineCoordinate(endpoint.opening);

    return Math.abs(lineCoordinate - expectedLineCoordinate) <= 0.55;
  }

  getWallModuleLineCoordinate(opening) {
    switch (opening.side) {
      case "north":
        return opening.z + 0.5;
      case "south":
        return opening.z - 0.5;
      case "west":
        return opening.x + 0.5;
      case "east":
        return opening.x - 0.5;
      default:
        return 0;
    }
  }

  createConnectionModules(connection, style) {
    const opening = connection.a.opening;
    const isHorizontal = this.isHorizontalSide(opening.side);
    const x = (connection.a.opening.x + connection.b.opening.x) / 2;
    const z = (connection.a.opening.z + connection.b.opening.z) / 2;
    const length = style.length;
    const depth = style.depth;
    const wallThickness = style.wallThickness;
    const collisionWallThickness = style.collisionWallThickness ?? wallThickness;
    const sideWallOffset = style.sideWallOffset ?? length / 2;
    const wallRotationY = isHorizontal ? Math.PI / 2 : 0;
    const archRotationY = isHorizontal ? 0 : Math.PI / 2;

    const floorModule = {
      x,
      z,
      w: isHorizontal ? length : depth,
      d: isHorizontal ? depth : length,
      moduleId: style.floorModuleId,
      connectionId: connection.id,
    };

    const sideWallModules = isHorizontal
      ? [
          {
            x: x - sideWallOffset,
            z,
            w: wallThickness,
            d: depth,
            side: "west",
            rotationY: wallRotationY,
            moduleId: style.sideWallModuleId,
            connectionId: connection.id,
          },
          {
            x: x + sideWallOffset,
            z,
            w: wallThickness,
            d: depth,
            side: "east",
            rotationY: wallRotationY,
            moduleId: style.sideWallModuleId,
            connectionId: connection.id,
          },
        ]
      : [
          {
            x,
            z: z - sideWallOffset,
            w: depth,
            d: wallThickness,
            side: "north",
            rotationY: wallRotationY,
            moduleId: style.sideWallModuleId,
            connectionId: connection.id,
          },
          {
            x,
            z: z + sideWallOffset,
            w: depth,
            d: wallThickness,
            side: "south",
            rotationY: wallRotationY,
            moduleId: style.sideWallModuleId,
            connectionId: connection.id,
          },
        ];

    const archModule = {
      x,
      z,
      w: 1,
      d: 1,
      rotationY: archRotationY,
      moduleId: style.archModuleId,
      connectionId: connection.id,
    };

    return {
      floorModules: [floorModule],
      wallModules: sideWallModules,
      decorativeModules: [archModule],
      walkableAreas: [
        {
          x,
          z,
          w: floorModule.w,
          d: floorModule.d,
        },
      ],
      collisionWalls: sideWallModules.map((module) =>
        this.createConnectorWallCollision(module, collisionWallThickness, isHorizontal)
      ),
    };
  }

  createConnectorWallCollision(module, collisionWallThickness, isHorizontal) {
    if (isHorizontal) {
      return {
        ...module,
        w: collisionWallThickness,
      };
    }

    return {
      ...module,
      d: collisionWallThickness,
    };
  }

  createObstacleCollision(module) {
    const scale = module.collisionScale ?? this.getObstacleCollisionScale(module);

    return {
      ...module,
      w: module.w * scale,
      d: module.d * scale,
    };
  }

  getObstacleCollisionScale(module) {
    if (module.moduleId === "barrel") {
      return BARREL_COLLISION_SCALE;
    }

    if (module.moduleId === "rocks") {
      return ROCK_COLLISION_SCALE;
    }

    return 1;
  }

  resolveEnemySpawn({ spawn, spawnIndex, room, levelDefinition, buildOptions }) {
    const difficulty =
      spawn.enemyDifficulty ??
      room.enemyDifficulty ??
      levelDefinition.enemyDifficulty ??
      ENEMY_DIFFICULTY.EASY;
    const enemyDefinition = room.type === "combat"
      ? pickEnemyDefinitionForDifficulty(
        difficulty,
        this.createSeededRandomValue([
          buildOptions.runSeed ?? levelDefinition.decorationFill?.seed ?? "level",
          levelDefinition.name ?? "unnamed-level",
          room.id,
          spawnIndex,
          spawn.x,
          spawn.z,
        ].join(":"))
      )
      : null;

    return {
      ...spawn,
      enemyTypeId: enemyDefinition?.id ?? spawn.enemyTypeId,
      enemyName: enemyDefinition?.name ?? spawn.enemyName,
      enemyDifficulty: enemyDefinition?.difficulty ?? spawn.enemyDifficulty,
      modelId: enemyDefinition?.modelId ?? spawn.modelId,
      maxHp: enemyDefinition?.maxHp ?? spawn.maxHp,
      hp: enemyDefinition?.hp ?? spawn.hp,
      speed: enemyDefinition?.speed ?? spawn.speed,
      attackDamage: enemyDefinition?.attackDamage ?? spawn.attackDamage,
      attackRange: enemyDefinition?.attackRange ?? spawn.attackRange,
      attackCooldown: enemyDefinition?.attackCooldown ?? spawn.attackCooldown,
      collisionRadius: enemyDefinition?.collisionRadius ?? spawn.collisionRadius,
      patrolStopRange: enemyDefinition?.patrolStopRange ?? spawn.patrolStopRange,
      patrolMoveDuration:
        enemyDefinition?.patrolMoveDuration ?? spawn.patrolMoveDuration,
      patrolPauseDurations:
        enemyDefinition?.patrolPauseDurations ?? spawn.patrolPauseDurations,
      patrol: (spawn.patrol ?? []).map((point) => ({ ...point })),
      patrolAreas: room.walkableAreas.map(cloneArea),
    };
  }

  createSeededRandomValue(seed) {
    let state = 2166136261;
    const text = String(seed);

    for (let index = 0; index < text.length; index += 1) {
      state ^= text.charCodeAt(index);
      state = Math.imul(state, 16777619);
    }

    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);

    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  createDecorationCollisionModules(source) {
    return [
      ...(source.setDressingModules ?? []),
      ...(source.decorativeModules ?? []),
      ...(source.obstacleModules ?? []),
    ]
      .filter((module) => module.collision)
      .map((module) => this.createObstacleCollision(module));
  }

  createRoomStairsModule(room, endpoints) {
    if (room.type !== "enter" && room.type !== "exit") return null;

    const connectedOpening = (room.doorOpenings ?? []).find((opening) =>
      this.isOpeningConnected(room.id, opening, endpoints)
    );

    if (!connectedOpening) return null;

    const stairSide = OPPOSITE_SIDE[connectedOpening.side];
    const stairOpening = (room.doorOpenings ?? []).find(
      (opening) =>
        opening.side === stairSide &&
        !this.isOpeningConnected(room.id, opening, endpoints)
    );

    if (!stairOpening) return null;

    if (room.type === "exit") {
      return this.createStairsModuleAtOpening(stairOpening, {
        y: EXIT_STAIRS_Y,
        offsetFromWall: EXIT_STAIRS_OFFSET_FROM_WALL,
        rotationY:
          stairOpening.exitStairsRotationY ??
          EXIT_STAIRS_ROTATION_BY_SIDE[stairOpening.side],
        role: "exitStairs",
      });
    }

    return this.createStairsModuleAtOpening(stairOpening, {
      collision: true,
      rotationY:
        stairOpening.entryStairsRotationY ??
        ENTRY_STAIRS_ROTATION_TOWARD_WALL_BY_SIDE[stairOpening.side],
      role: "entryStairs",
    });
  }

  createStairsModuleAtOpening(opening, options = {}) {
    const offsetFromWall = options.offsetFromWall ?? ENTRY_STAIRS_OFFSET_FROM_WALL;
    const module = {
      x: opening.x,
      z: opening.z,
      w: 1,
      d: 1,
      side: opening.side,
      moduleId: "stairs",
      rotationY: options.rotationY ?? 0,
      generated: true,
      ...options,
    };

    delete module.offsetFromWall;

    switch (opening.side) {
      case "north":
        module.z += offsetFromWall;
        break;

      case "south":
        module.z -= offsetFromWall;
        break;

      case "west":
        module.x += offsetFromWall;
        break;

      case "east":
        module.x -= offsetFromWall;
        break;
    }

    return module;
  }

  createExitStairsDirtModules(stairsModule) {
    const sideVector = this.getSideVectorForSide(stairsModule.side);
    const frontVector = this.getFrontVectorForSide(stairsModule.side);
    if (!sideVector || !frontVector) return [];

    return [
      {
        x: stairsModule.x + sideVector.x * EXIT_STAIRS_DIRT_SIDE_OFFSET,
        y: EXIT_STAIRS_DIRT_Y,
        z: stairsModule.z + sideVector.z * EXIT_STAIRS_DIRT_SIDE_OFFSET,
        w: 1,
        d: 1,
        moduleId: "dirt",
        generated: true,
        role: "exitStairsLeftDirt",
      },
      {
        x: stairsModule.x - sideVector.x * EXIT_STAIRS_DIRT_SIDE_OFFSET,
        y: EXIT_STAIRS_DIRT_Y,
        z: stairsModule.z - sideVector.z * EXIT_STAIRS_DIRT_SIDE_OFFSET,
        w: 1,
        d: 1,
        moduleId: "dirt",
        generated: true,
        role: "exitStairsRightDirt",
      },
      {
        x: stairsModule.x + frontVector.x * EXIT_STAIRS_DIRT_FRONT_OFFSET,
        y: EXIT_STAIRS_DIRT_Y,
        z: stairsModule.z + frontVector.z * EXIT_STAIRS_DIRT_FRONT_OFFSET,
        w: 1,
        d: 1,
        moduleId: "dirt",
        generated: true,
        role: "exitStairsFrontDirt",
      },
    ];
  }

  createExitStairsWoodStructureModule(stairsModule) {
    return {
      x: stairsModule.x,
      y: EXIT_STAIRS_WOOD_STRUCTURE_Y,
      z: stairsModule.z,
      w: EXIT_STAIRS_WOOD_STRUCTURE_SIZE.w,
      d: EXIT_STAIRS_WOOD_STRUCTURE_SIZE.d,
      height: EXIT_STAIRS_WOOD_STRUCTURE_SIZE.height,
      side: stairsModule.side,
      moduleId: "woodStructure",
      rotationY: EXIT_STAIRS_WOOD_STRUCTURE_ROTATION_BY_SIDE[stairsModule.side] ?? 0,
      generated: true,
      role: "exitStairsWoodStructure",
    };
  }

  getSideVectorForSide(side) {
    switch (side) {
      case "north":
      case "south":
        return { x: 1, z: 0 };

      case "west":
      case "east":
        return { x: 0, z: 1 };

      default:
        return null;
    }
  }

  getFrontVectorForSide(side) {
    switch (side) {
      case "north":
        return { x: 0, z: 1 };

      case "south":
        return { x: 0, z: -1 };

      case "west":
        return { x: 1, z: 0 };

      case "east":
        return { x: -1, z: 0 };

      default:
        return null;
    }
  }

  hideFloorTileUnderModule(floorModules, module) {
    return floorModules.map((floorModule) => {
      if (!this.areaContainsPoint(floorModule, module)) return floorModule;

      return {
        ...floorModule,
        hiddenAreas: [
          ...(floorModule.hiddenAreas ?? []),
          {
            x: module.x,
            z: module.z,
            w: EXIT_STAIRS_FLOOR_HOLE_SIZE,
            d: EXIT_STAIRS_FLOOR_HOLE_SIZE,
            role: "exitStairsFloorHole",
          },
        ],
      };
    });
  }

  areaContainsPoint(area, point) {
    return (
      point.x >= area.x - area.w / 2 &&
      point.x <= area.x + area.w / 2 &&
      point.z >= area.z - area.d / 2 &&
      point.z <= area.z + area.d / 2
    );
  }

  isHorizontalSide(side) {
    return side === "north" || side === "south";
  }

  createOuterBoundaryModules(boundary) {
    const x = boundary.x ?? 0;
    const z = boundary.z ?? 0;
    const w = boundary.w;
    const d = boundary.d;
    const halfW = w / 2;
    const halfD = d / 2;
    const wallModuleId = boundary.wallModuleId ?? "wallHalf";
    const cornerModuleId = boundary.cornerModuleId ?? "wallCorner";
    const dirtModuleId = boundary.dirtModuleId ?? "dirt";

    const wallModules = [
      { x: x - halfW + 0.5, z: z - halfD + 0.5, w: 1, d: 1, moduleId: cornerModuleId },
      { x: x + halfW - 0.5, z: z - halfD + 0.5, w: 1, d: 1, moduleId: cornerModuleId },
      { x: x - halfW + 0.5, z: z + halfD - 0.5, w: 1, d: 1, moduleId: cornerModuleId },
      { x: x + halfW - 0.5, z: z + halfD - 0.5, w: 1, d: 1, moduleId: cornerModuleId },
      {
        x,
        z: z - halfD + 0.5,
        w: w - 2,
        d: 1,
        moduleId: wallModuleId,
        absoluteRotationY: OUTER_WALL_ROTATION.north,
      },
      {
        x,
        z: z + halfD - 0.5,
        w: w - 2,
        d: 1,
        moduleId: wallModuleId,
        absoluteRotationY: OUTER_WALL_ROTATION.south,
      },
      {
        x: x - halfW + 0.5,
        z,
        w: 1,
        d: d - 2,
        moduleId: wallModuleId,
        absoluteRotationY: OUTER_WALL_ROTATION.west,
      },
      {
        x: x + halfW - 0.5,
        z,
        w: 1,
        d: d - 2,
        moduleId: wallModuleId,
        absoluteRotationY: OUTER_WALL_ROTATION.east,
      },
    ];

    return {
      wallModules,
      decorativeModules: this.createOuterBoundaryDirt({
        x,
        z,
        w,
        d,
        dirtModuleId,
      }),
    };
  }

  createOuterBoundaryDirt({ x, z, w, d, dirtModuleId }) {
    const halfW = w / 2;
    const halfD = d / 2;
    const decorativeModules = [];

    for (let row = 1; row <= 2; row += 1) {
      decorativeModules.push(
        {
          x,
          z: z - halfD + 0.5 - row,
          w,
          d: 1,
          moduleId: dirtModuleId,
        },
        {
          x,
          z: z + halfD - 0.5 + row,
          w,
          d: 1,
          moduleId: dirtModuleId,
        },
        {
          x: x - halfW + 0.5 - row,
          z,
          w: 1,
          d: d - 2,
          moduleId: dirtModuleId,
        },
        {
          x: x + halfW - 0.5 + row,
          z,
          w: 1,
          d: d - 2,
          moduleId: dirtModuleId,
        }
      );
    }

    return decorativeModules;
  }

  createLegacyRoomWallModules(room) {
    const west = room.x - room.w / 2;
    const east = room.x + room.w / 2;
    const north = room.z - room.d / 2;
    const south = room.z + room.d / 2;

    return [
      ...this.createLegacyRoomWallSide(room, "north", room.x, north, room.w, 0.34),
      ...this.createLegacyRoomWallSide(room, "south", room.x, south, room.w, 0.34),
      ...this.createLegacyRoomWallSide(room, "west", west, room.z, 0.34, room.d),
      ...this.createLegacyRoomWallSide(room, "east", east, room.z, 0.34, room.d),
    ];
  }

  createLegacyRoomWallSide(room, side, x, z, w, d) {
    if (!room.door || room.door.side !== side) {
      return [
        {
          x,
          z,
          w,
          d,
          height: 1.65,
          moduleId: "wallNarrow",
        },
      ];
    }

    if (side === "north" || side === "south") {
      return this.createHorizontalWallWithOpening(room, z);
    }

    return this.createVerticalWallWithOpening(room, x);
  }

  createHorizontalWallWithOpening(room, z) {
    const wallStart = room.x - room.w / 2;
    const wallEnd = room.x + room.w / 2;
    const openingCenter = room.x + room.door.offset;
    const openingStart = openingCenter - room.door.width / 2;
    const openingEnd = openingCenter + room.door.width / 2;

    return [
      ...this.createWallFromRange(wallStart, openingStart, z, "horizontal"),
      ...this.createWallFromRange(openingEnd, wallEnd, z, "horizontal"),
    ];
  }

  createVerticalWallWithOpening(room, x) {
    const wallStart = room.z - room.d / 2;
    const wallEnd = room.z + room.d / 2;
    const openingCenter = room.z + room.door.offset;
    const openingStart = openingCenter - room.door.width / 2;
    const openingEnd = openingCenter + room.door.width / 2;

    return [
      ...this.createWallFromRange(wallStart, openingStart, x, "vertical"),
      ...this.createWallFromRange(openingEnd, wallEnd, x, "vertical"),
    ];
  }

  createWallFromRange(start, end, fixed, axis) {
    const length = end - start;
    if (length <= 0.1) return [];

    const center = start + length / 2;

    if (axis === "horizontal") {
      return [
        {
          x: center,
          z: fixed,
          w: length,
          d: 0.34,
          height: 1.65,
          moduleId: "wallNarrow",
        },
      ];
    }

    return [
      {
        x: fixed,
        z: center,
        w: 0.34,
        d: length,
        height: 1.65,
        moduleId: "wallNarrow",
      },
    ];
  }

  createLegacyRoomDoorwayModules(room) {
    if (!room.door) return [];

    const doorway = {
      moduleId: "wallOpening",
      height: 1.65,
    };

    switch (room.door.side) {
      case "north":
        return [
          {
            ...doorway,
            x: room.x + room.door.offset,
            z: room.z - room.d / 2,
            w: room.door.width,
            d: 0.34,
          },
        ];

      case "south":
        return [
          {
            ...doorway,
            x: room.x + room.door.offset,
            z: room.z + room.d / 2,
            w: room.door.width,
            d: 0.34,
          },
        ];

      case "west":
        return [
          {
            ...doorway,
            x: room.x - room.w / 2,
            z: room.z + room.door.offset,
            w: 0.34,
            d: room.door.width,
          },
        ];

      case "east":
        return [
          {
            ...doorway,
            x: room.x + room.w / 2,
            z: room.z + room.door.offset,
            w: 0.34,
            d: room.door.width,
          },
        ];

      default:
        return [];
    }
  }
}
