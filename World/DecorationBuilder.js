import {
  DECORATION_FILL_ROTATIONS,
  getPropPlacementRule,
} from "./PropPlacementRules.js";

const DECORATION_DOOR_CLEARANCE = 3;
const DEFAULT_SEED = "decorationFill";
const TILE_KEY_PRECISION = 3;

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

export class DecorationBuilder {
  buildRoomDecorations({
    room,
    levelDefinition,
    buildOptions = {},
    extraOccupiedModules = [],
  }) {
    const config = this.normalizeDecorationFillConfig(levelDefinition, buildOptions);
    if (!config || config.entries.length === 0) return [];

    const occupiedModules = this.createDecorationOccupiedModules(
      room,
      levelDefinition,
      extraOccupiedModules
    );
    const blockingModules = this.createNavigationBlockingModules(
      room,
      extraOccupiedModules
    );
    const modules = [];

    for (const entry of config.entries) {
      if (!this.canPlaceEntryInRoom(entry, room)) continue;

      if (entry.placement === "cluster") {
        const clusters = this.createClusteredProps({
          entry,
          room,
          occupiedModules,
          blockingModules,
        });

        modules.push(...clusters);
        continue;
      }

      const scatter = this.createScatteredProps({
        entry,
        room,
        occupiedModules,
        blockingModules,
      });

      modules.push(...scatter);
    }

    return modules;
  }

  normalizeDecorationFillConfig(levelDefinition, buildOptions = {}) {
    if (levelDefinition.decorationFill) {
      const fillConfig = levelDefinition.decorationFill;
      const seed = this.resolveDecorationSeed(fillConfig.seed, buildOptions);
      const entries = (fillConfig.modules ?? fillConfig.entries ?? [])
        .map((entry) => this.normalizeDecorationEntry(entry, seed))
        .filter((entry) => entry.enabled && entry.density > 0);

      return {
        seed,
        entries,
      };
    }

    if (levelDefinition.floorDetailFill) {
      const seed = this.resolveDecorationSeed(levelDefinition.floorDetailFill.seed, buildOptions);
      const entry = typeof levelDefinition.floorDetailFill === "number"
        ? { moduleId: "floorDetail", density: levelDefinition.floorDetailFill }
        : {
            moduleId: levelDefinition.floorDetailFill.moduleId ?? "floorDetail",
            density: levelDefinition.floorDetailFill.density ?? 0,
          };

      return {
        seed,
        entries: [this.normalizeDecorationEntry(entry, seed)],
      };
    }

    return null;
  }

  normalizeDecorationEntry(entry, sharedSeed) {
    const rule = getPropPlacementRule(entry.moduleId);
    const moduleId = entry.moduleId;

    return {
      moduleId,
      enabled: entry.enabled ?? true,
      placement: entry.placement ?? rule.placement,
      density: clamp01(entry.density ?? rule.density ?? 0),
      seed: this.resolveDecorationSeed(entry.seed ?? sharedSeed, { runSeed: sharedSeed }),
      role: entry.role ?? rule.role ?? `${moduleId}Fill`,
      roomTypes: entry.roomTypes ?? rule.roomTypes ?? null,
      zoneTypes: entry.zoneTypes ?? rule.zoneTypes ?? null,
      allowUnzoned: entry.allowUnzoned ?? rule.allowUnzoned ?? true,
      w: entry.w ?? rule.w ?? 1,
      d: entry.d ?? rule.d ?? 1,
      collision: entry.collision ?? rule.collision ?? false,
      occupiesTile: entry.occupiesTile ?? rule.occupiesTile ?? true,
      clustersPerRoom: this.normalizeRange(entry.clustersPerRoom ?? rule.clustersPerRoom, 0, 0),
      clusterSize: this.normalizeRange(entry.clusterSize ?? rule.clusterSize, 1, 1),
      clusterRadius: entry.clusterRadius ?? rule.clusterRadius ?? 1.25,
      placementFootprint: entry.placementFootprint ?? rule.placementFootprint ?? null,
      positionJitter: entry.positionJitter ?? rule.positionJitter ?? 0,
      scaleVariation: entry.scaleVariation ?? rule.scaleVariation ?? null,
    };
  }

  normalizeRange(range, fallbackMin, fallbackMax) {
    if (typeof range === "number") {
      return {
        min: range,
        max: range,
      };
    }

    return {
      min: Math.max(0, Math.round(range?.min ?? fallbackMin)),
      max: Math.max(0, Math.round(range?.max ?? fallbackMax)),
    };
  }

  resolveDecorationSeed(seed, buildOptions = {}) {
    if (seed !== undefined && seed !== null && seed !== "random") {
      return String(seed);
    }

    return String(buildOptions.runSeed ?? DEFAULT_SEED);
  }

  canPlaceEntryInRoom(entry, room) {
    if (!entry.roomTypes) return true;

    return entry.roomTypes.includes(room.type);
  }

  createScatteredProps({ entry, room, occupiedModules, blockingModules }) {
    const modules = [];
    const usedTileKeys = new Set();
    const candidateTiles = this.getCandidateTilesForEntry(room, entry);

    for (const tile of candidateTiles) {
      const key = this.getTileKey(tile);
      if (usedTileKeys.has(key)) continue;
      usedTileKeys.add(key);

      if (!this.canPlaceAtTile(tile, entry, occupiedModules)) continue;

      const roll = this.createDeterministicUnit(
        `${entry.seed}:${entry.moduleId}:${room.id}:${key}`
      );
      if (roll >= entry.density) continue;

      const module = this.createPropModule(entry, tile, room, key);
      if (!this.keepsNavigationValid(room, module, blockingModules)) continue;

      modules.push(module);
      if (entry.occupiesTile) occupiedModules.push(module);
      if (entry.collision) blockingModules.push(module);
    }

    return modules;
  }

  createClusteredProps({ entry, room, occupiedModules, blockingModules }) {
    const modules = [];
    const clusterCount = this.getClusterCount(entry, room);
    if (clusterCount <= 0) return modules;
    const zones = this.getClusterZones(room, entry, clusterCount);

    for (let clusterIndex = 0; clusterIndex < clusterCount; clusterIndex += 1) {
      const cluster = this.createPropCluster({
        entry,
        room,
        zone: zones[clusterIndex] ?? null,
        occupiedModules,
        blockingModules,
        clusterIndex,
      });

      modules.push(...cluster);
    }

    return modules;
  }

  getClusterCount(entry, room) {
    const { min, max } = entry.clustersPerRoom;
    if (max <= 0) return 0;

    return this.createDeterministicInteger(
      `${entry.seed}:${entry.moduleId}:${room.id}:clusterCount`,
      min,
      max
    );
  }

  getClusterZones(room, entry, clusterCount) {
    const zones = this.getZonesForEntry(room, entry);
    if (zones.length === 0) return [];

    return zones
      .map((zone) => ({
        zone,
        sort: this.createDeterministicUnit(
          `${entry.seed}:${entry.moduleId}:${room.id}:zone:${zone.id ?? zone.x}:${zone.z}`
        ),
      }))
      .sort((a, b) => a.sort - b.sort)
      .slice(0, clusterCount)
      .map((candidate) => candidate.zone);
  }

  createPropCluster({ entry, room, zone, occupiedModules, blockingModules, clusterIndex }) {
    const anchors = this.getCandidateTilesForEntry(room, entry, zone)
      .map((tile) => ({
        tile,
        sort: this.createDeterministicUnit(
          `${entry.seed}:${entry.moduleId}:${room.id}:anchor:${clusterIndex}:${this.getTileKey(tile)}`
        ),
      }))
      .sort((a, b) => a.sort - b.sort)
      .map((candidate) => candidate.tile);

    for (const anchor of anchors) {
      if (!this.canPlaceAtTile(anchor, entry, occupiedModules)) continue;

      const cluster = this.createClusterAtAnchor({
        entry,
        room,
        anchor,
        zone,
        occupiedModules,
        blockingModules,
        clusterIndex,
      });

      if (cluster.length >= entry.clusterSize.min) return cluster;
    }

    return [];
  }

  createClusterAtAnchor({ entry, room, anchor, zone, occupiedModules, blockingModules, clusterIndex }) {
    const targetSize = this.createDeterministicInteger(
      `${entry.seed}:${entry.moduleId}:${room.id}:clusterSize:${clusterIndex}:${this.getTileKey(anchor)}`,
      entry.clusterSize.min,
      entry.clusterSize.max
    );
    const localOccupied = [...occupiedModules];
    const localBlocking = [...blockingModules];
    const cluster = [];
    const candidates = this.getClusterCandidateTiles(room, entry, anchor, clusterIndex, zone);

    for (const tile of candidates) {
      if (cluster.length >= targetSize) break;
      const module = this.createPropModule(entry, tile, room, this.getTileKey(tile));
      if (!this.canPlaceModule(module, localOccupied)) continue;
      if (!this.keepsNavigationValid(room, module, localBlocking)) continue;

      cluster.push(module);
      if (entry.occupiesTile) localOccupied.push(module);
      if (entry.collision) localBlocking.push(module);
    }

    if (cluster.length < entry.clusterSize.min) return [];

    occupiedModules.push(...cluster.filter(() => entry.occupiesTile));
    blockingModules.push(...cluster.filter(() => entry.collision));

    return cluster;
  }

  getClusterCandidateTiles(room, entry, anchor, clusterIndex, zone = null) {
    return this.getCandidateTilesForEntry(room, entry, zone)
      .filter((tile) => this.distance2D(tile, anchor) <= entry.clusterRadius)
      .map((tile) => ({
        tile,
        distance: this.distance2D(tile, anchor),
        sort: this.createDeterministicUnit(
          `${entry.seed}:${entry.moduleId}:${room.id}:cluster:${clusterIndex}:${this.getTileKey(anchor)}:${this.getTileKey(tile)}`
        ),
      }))
      .sort((a, b) => a.distance - b.distance || a.sort - b.sort)
      .map((candidate) => candidate.tile);
  }

  getCandidateTilesForEntry(room, entry, preferredZone = null) {
    const zones = this.getZonesForEntry(room, entry);
    const sources = preferredZone
      ? [preferredZone]
      : entry.zoneTypes && zones.length > 0
      ? zones
      : entry.allowUnzoned
        ? room.walkableAreas ?? []
        : [];

    const tiles = [];

    for (const source of sources) {
      for (const tile of this.createTileCentersForArea(source)) {
        if (!this.isPointInsideAnyArea(tile, room.walkableAreas ?? [])) continue;
        tiles.push(tile);
      }
    }

    return tiles;
  }

  getZonesForEntry(room, entry) {
    const zones = room.decorZones ?? [];
    if (!entry.zoneTypes) return zones;

    return zones.filter((zone) => {
      const values = [zone.type, ...(zone.tags ?? [])].filter(Boolean);

      return values.some((value) => entry.zoneTypes.includes(value));
    });
  }

  canPlaceAtTile(tile, entry, occupiedModules) {
    return this.canPlaceModule({
      x: tile.x,
      z: tile.z,
      w: entry.w,
      d: entry.d,
      placementFootprint: entry.placementFootprint,
    }, occupiedModules);
  }

  canPlaceModule(module, occupiedModules) {
    return !this.isAreaInsideAnyModule(this.createPlacementArea(module), occupiedModules);
  }

  createPropModule(entry, tile, room, tileKey) {
    const rotationIndex = Math.floor(
      this.createDeterministicUnit(`${entry.seed}:rotation:${entry.moduleId}:${room.id}:${tileKey}`) *
      DECORATION_FILL_ROTATIONS.length
    );
    const scaleMultiplier = this.createScaleMultiplier(entry, room, tileKey);
    const offset = this.createPositionJitter(entry, room, tileKey);

    return {
      x: tile.x + offset.x,
      z: tile.z + offset.z,
      w: entry.w,
      d: entry.d,
      placementFootprint: entry.placementFootprint,
      moduleId: entry.moduleId,
      rotationY: DECORATION_FILL_ROTATIONS[rotationIndex] ?? 0,
      collision: entry.collision,
      scaleMultiplier,
      generated: true,
      role: entry.role,
    };
  }

  createPositionJitter(entry, room, tileKey) {
    const amount = entry.positionJitter ?? 0;
    if (amount <= 0) return { x: 0, z: 0 };

    const unitX = this.createDeterministicUnit(
      `${entry.seed}:jitterX:${entry.moduleId}:${room.id}:${tileKey}`
    );
    const unitZ = this.createDeterministicUnit(
      `${entry.seed}:jitterZ:${entry.moduleId}:${room.id}:${tileKey}`
    );

    return {
      x: (unitX * 2 - 1) * amount,
      z: (unitZ * 2 - 1) * amount,
    };
  }

  createScaleMultiplier(entry, room, tileKey) {
    if (!entry.scaleVariation) return undefined;

    const min = entry.scaleVariation.min ?? 1;
    const max = entry.scaleVariation.max ?? 1;
    const unit = this.createDeterministicUnit(
      `${entry.seed}:scale:${entry.moduleId}:${room.id}:${tileKey}`
    );

    return min + (max - min) * unit;
  }

  keepsNavigationValid(room, candidateModule, blockingModules) {
    if (!candidateModule.collision) return true;

    const openings = room.doorOpenings ?? [];
    if (openings.length <= 1) return true;

    const blockers = [...blockingModules, candidateModule];
    const openingTiles = openings
      .map((opening) => this.findNearestWalkableTile(opening, room, blockers))
      .filter(Boolean);

    if (openingTiles.length <= 1) return true;

    const reachable = this.findReachableTileKeys(openingTiles[0], room, blockers);

    return openingTiles.every((tile) => reachable.has(this.getTileKey(tile)));
  }

  findNearestWalkableTile(point, room, blockers) {
    const tiles = this.getUniqueWalkableTiles(room)
      .filter((tile) => !this.isPointInsideAnyModule(tile, blockers))
      .map((tile) => ({
        tile,
        distance: this.distance2D(tile, point),
      }))
      .sort((a, b) => a.distance - b.distance);

    return tiles[0]?.tile ?? null;
  }

  findReachableTileKeys(startTile, room, blockers) {
    const walkableTiles = this.getUniqueWalkableTiles(room)
      .filter((tile) => !this.isPointInsideAnyModule(tile, blockers));
    const walkableByKey = new Map(
      walkableTiles.map((tile) => [this.getTileKey(tile), tile])
    );
    const startKey = this.getTileKey(startTile);
    const reachable = new Set();
    const queue = [startKey];

    while (queue.length > 0) {
      const key = queue.shift();
      if (reachable.has(key)) continue;

      const tile = walkableByKey.get(key);
      if (!tile) continue;

      reachable.add(key);

      for (const neighbor of this.getNeighborTiles(tile)) {
        const neighborKey = this.getTileKey(neighbor);
        if (reachable.has(neighborKey)) continue;
        if (!walkableByKey.has(neighborKey)) continue;
        queue.push(neighborKey);
      }
    }

    return reachable;
  }

  getNeighborTiles(tile) {
    return [
      { x: tile.x + 1, z: tile.z },
      { x: tile.x - 1, z: tile.z },
      { x: tile.x, z: tile.z + 1 },
      { x: tile.x, z: tile.z - 1 },
    ];
  }

  createDecorationOccupiedModules(room, levelDefinition, extraOccupiedModules) {
    return [
      ...(room.wallModules ?? []),
      ...(room.doorwayModules ?? []),
      ...(room.decorativeModules ?? []),
      ...(room.obstacleModules ?? []),
      ...(room.chestSpawns ?? []).map((spawn) => ({ ...spawn, w: 1, d: 1 })),
      ...(room.enemySpawns ?? []).map((spawn) => ({ ...spawn, w: 1, d: 1 })),
      ...(levelDefinition.playerStart
        ? [{ ...levelDefinition.playerStart, w: 1, d: 1 }]
        : []),
      ...this.createDoorOpeningProtectedModules(room),
      ...(extraOccupiedModules ?? []),
    ];
  }

  createNavigationBlockingModules(room, extraOccupiedModules) {
    return [
      ...(room.decorativeModules ?? []),
      ...(room.obstacleModules ?? []),
      ...(extraOccupiedModules ?? []),
    ].filter((module) => module.collision);
  }

  createDoorOpeningProtectedModules(room) {
    return (room.doorOpenings ?? []).map((opening) => {
      const frontVector = this.getFrontVectorForSide(opening.side);
      const isHorizontal = this.isHorizontalSide(opening.side);
      const width = Math.max(opening.width ?? 1, 3);

      return {
        x: opening.x + frontVector.x * (DECORATION_DOOR_CLEARANCE / 2),
        z: opening.z + frontVector.z * (DECORATION_DOOR_CLEARANCE / 2),
        w: isHorizontal ? width : DECORATION_DOOR_CLEARANCE,
        d: isHorizontal ? DECORATION_DOOR_CLEARANCE : width,
      };
    });
  }

  getUniqueWalkableTiles(room) {
    const tilesByKey = new Map();

    for (const area of room.walkableAreas ?? []) {
      for (const tile of this.createTileCentersForArea(area)) {
        tilesByKey.set(this.getTileKey(tile), tile);
      }
    }

    return [...tilesByKey.values()];
  }

  createTileCentersForArea(area) {
    const countX = Math.max(1, Math.round(area.w));
    const countZ = Math.max(1, Math.round(area.d));
    const tileW = area.w / countX;
    const tileD = area.d / countZ;
    const startX = area.x - area.w / 2 + tileW / 2;
    const startZ = area.z - area.d / 2 + tileD / 2;
    const tiles = [];

    for (let ix = 0; ix < countX; ix += 1) {
      for (let iz = 0; iz < countZ; iz += 1) {
        tiles.push({
          x: startX + ix * tileW,
          z: startZ + iz * tileD,
        });
      }
    }

    return tiles;
  }

  getTileKey(tile) {
    return `${tile.x.toFixed(TILE_KEY_PRECISION)}:${tile.z.toFixed(TILE_KEY_PRECISION)}`;
  }

  isAreaInsideAnyModule(area, modules) {
    return modules.some((module) =>
      this.areasOverlap(area, this.createPlacementArea(module))
    );
  }

  createPlacementArea(module) {
    return {
      ...module,
      w: module.placementFootprint?.w ?? module.w,
      d: module.placementFootprint?.d ?? module.d,
    };
  }

  isPointInsideAnyModule(point, modules) {
    return modules.some((module) =>
      this.areaContainsPoint(module, point)
    );
  }

  isPointInsideAnyArea(point, areas) {
    return areas.some((area) => this.areaContainsPoint(area, point));
  }

  areasOverlap(a, b) {
    return (
      Math.abs(a.x - b.x) < (a.w + b.w) / 2 &&
      Math.abs(a.z - b.z) < (a.d + b.d) / 2
    );
  }

  areaContainsPoint(area, point) {
    return (
      point.x >= area.x - area.w / 2 &&
      point.x <= area.x + area.w / 2 &&
      point.z >= area.z - area.d / 2 &&
      point.z <= area.z + area.d / 2
    );
  }

  distance2D(a, b) {
    return Math.hypot(a.x - b.x, a.z - b.z);
  }

  isHorizontalSide(side) {
    return side === "north" || side === "south";
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
        return { x: 0, z: 0 };
    }
  }

  createDeterministicInteger(seed, min, max) {
    if (max <= min) return min;

    return min + Math.floor(
      this.createDeterministicUnit(seed) * (max - min + 1)
    );
  }

  createDeterministicUnit(value) {
    let hash = 2166136261;

    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }

    return (hash >>> 0) / 4294967296;
  }
}
