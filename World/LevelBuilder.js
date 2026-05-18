function cloneArea(area) {
  return {
    ...area,
  };
}

const OUTER_WALL_ROTATION = {
  north: Math.PI,
  south: 0,
  west: -Math.PI / 2,
  east: Math.PI / 2,
};

export class LevelBuilder {
  constructor({ roomTemplateLibrary }) {
    this.roomTemplateLibrary = roomTemplateLibrary;
  }

  build(levelDefinition) {
    if (!levelDefinition) return null;

    if (levelDefinition.kind === "assembled") {
      return this.buildAssembledLevel(levelDefinition);
    }

    return this.buildLegacyLevel(levelDefinition);
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
        coinDrop: enemy.coinDrop ? { ...enemy.coinDrop } : undefined,
      })),
      exit: levelDefinition.exit ? { ...levelDefinition.exit } : null,
    };
  }

  buildAssembledLevel(levelDefinition) {
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

    for (const roomPlacement of levelDefinition.rooms ?? []) {
      const room = this.roomTemplateLibrary.resolveRoomPlacement(roomPlacement);

      environment.floorModules.push(...room.floorModules);
      environment.wallModules.push(...room.wallModules);
      environment.doorwayModules.push(...room.doorwayModules);
      environment.decorativeModules.push(...room.decorativeModules);
      environment.decorativeModules.push(...room.obstacleModules);

      walkableAreas.push(...room.walkableAreas.map(cloneArea));
      collisionWalls.push(...room.wallModules.map(cloneArea));
      collisionWalls.push(
        ...room.obstacleModules
          .filter((module) => module.collision)
          .map(cloneArea)
      );
      chests.push(...room.chestSpawns.map((spawn) => ({ ...spawn })));
      enemies.push(
        ...room.enemySpawns.map((spawn) => ({
          ...spawn,
          patrol: (spawn.patrol ?? []).map((point) => ({ ...point })),
          coinDrop: spawn.coinDrop ? { ...spawn.coinDrop } : undefined,
        }))
      );

      if (room.exitMarker) {
        exit = {
          ...(exit ?? {}),
          x: room.exitMarker.x,
          z: room.exitMarker.z,
        };
      }
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
    };
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
          d,
          moduleId: dirtModuleId,
        },
        {
          x: x + halfW - 0.5 + row,
          z,
          w: 1,
          d,
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
