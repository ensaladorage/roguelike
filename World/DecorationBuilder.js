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
      spotStrategy: entry.spotStrategy ?? rule.spotStrategy ?? "decorZones",
      spotTypes: entry.spotTypes ?? rule.spotTypes ?? ["corner", "door", "chest"],
      spotInset: entry.spotInset ?? rule.spotInset ?? 1.4,
      spotMinDistance: entry.spotMinDistance ?? rule.spotMinDistance ?? 4,
      doorSpotDepth: entry.doorSpotDepth ?? rule.doorSpotDepth ?? 2.2,
      doorSpotSideOffset: entry.doorSpotSideOffset ?? rule.doorSpotSideOffset ?? 2,
      chestSpotOffset: entry.chestSpotOffset ?? rule.chestSpotOffset ?? 1.8,
      w: entry.w ?? rule.w ?? 1,
      d: entry.d ?? rule.d ?? 1,
      collision: entry.collision ?? rule.collision ?? false,
      occupiesTile: entry.occupiesTile ?? rule.occupiesTile ?? true,
      clustersPerRoom: this.normalizeRange(entry.clustersPerRoom ?? rule.clustersPerRoom, 0, 0),
      clusterSize: this.normalizeRange(entry.clusterSize ?? rule.clusterSize, 1, 1),
      clusterRadius: entry.clusterRadius ?? rule.clusterRadius ?? 1.25,
      clusterScatterRadius: entry.clusterScatterRadius ?? rule.clusterScatterRadius ?? entry.clusterRadius ?? rule.clusterRadius ?? 1.25,
      placementFootprint: entry.placementFootprint ?? rule.placementFootprint ?? null,
      collisionFootprint: entry.collisionFootprint ?? rule.collisionFootprint ?? entry.placementFootprint ?? rule.placementFootprint ?? null,
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
      if (!this.isPointInsideAnyArea(module, room.walkableAreas ?? [])) continue;
      if (!this.canPlaceModule(module, occupiedModules)) continue;
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
    const spots = this.getClusterSpots(room, entry, clusterCount, occupiedModules);
    let acceptedClusterCount = 0;

    for (let spotIndex = 0; spotIndex < spots.length; spotIndex += 1) {
      if (acceptedClusterCount >= clusterCount) break;

      const cluster = this.createPropCluster({
        entry,
        room,
        spot: spots[spotIndex],
        occupiedModules,
        blockingModules,
        clusterIndex: spotIndex,
      });

      modules.push(...cluster);
      if (cluster.length >= entry.clusterSize.min) {
        acceptedClusterCount += 1;
      }
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

  getClusterSpots(room, entry, clusterCount, occupiedModules) {
    if (entry.spotStrategy === "semantic") {
      return this.createSemanticClusterSpots(
        room,
        entry,
        occupiedModules,
        clusterCount * 3
      );
    }

    return this.getClusterZones(room, entry, clusterCount).map((zone) => ({
      x: zone.x,
      z: zone.z,
      zone,
    }));
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

  createSemanticClusterSpots(room, entry, occupiedModules, clusterCount) {
    const spots = [
      ...this.createCornerClusterSpots(room, entry),
      ...this.createDoorClusterSpots(room, entry),
      ...this.createChestClusterSpots(room, entry),
    ]
      .filter((spot) => entry.spotTypes.includes(spot.kind))
      .filter((spot) => this.canUseClusterSpot(spot, entry, room, occupiedModules))
      .map((spot) => ({
        ...spot,
        sort: this.createDeterministicUnit(
          `${entry.seed}:${entry.moduleId}:${room.id}:semanticSpot:${spot.kind}:${spot.x.toFixed(3)}:${spot.z.toFixed(3)}`
        ),
      }))
      .sort((a, b) => a.sort - b.sort);

    const selected = [];
    for (const spot of spots) {
      if (selected.length >= clusterCount) break;
      if (selected.some((usedSpot) => this.distance2D(usedSpot, spot) < entry.spotMinDistance)) {
        continue;
      }

      selected.push(spot);
    }

    return selected;
  }

  createCornerClusterSpots(room, entry) {
    return (room.walkableAreas ?? []).flatMap((area, areaIndex) => {
      const insetX = Math.min(entry.spotInset, Math.max(0.1, area.w / 2 - 0.1));
      const insetZ = Math.min(entry.spotInset, Math.max(0.1, area.d / 2 - 0.1));
      const minX = area.x - area.w / 2 + insetX;
      const maxX = area.x + area.w / 2 - insetX;
      const minZ = area.z - area.d / 2 + insetZ;
      const maxZ = area.z + area.d / 2 - insetZ;

      return [
        { x: minX, z: minZ },
        { x: maxX, z: minZ },
        { x: minX, z: maxZ },
        { x: maxX, z: maxZ },
      ].map((spot, cornerIndex) => ({
        ...spot,
        kind: "corner",
        id: `${room.id}:corner:${areaIndex}:${cornerIndex}`,
      }));
    });
  }

  createDoorClusterSpots(room, entry) {
    return (room.doorOpenings ?? []).flatMap((opening, openingIndex) => {
      const frontVector = this.getFrontVectorForSide(opening.side);
      const sideVector = this.getSideVectorForSide(opening.side);
      if (!frontVector || !sideVector) return [];

      return [-1, 1].map((direction) => ({
        x: opening.x +
          frontVector.x * entry.doorSpotDepth +
          sideVector.x * direction * entry.doorSpotSideOffset,
        z: opening.z +
          frontVector.z * entry.doorSpotDepth +
          sideVector.z * direction * entry.doorSpotSideOffset,
        kind: "door",
        id: `${room.id}:door:${openingIndex}:${direction}`,
      }));
    });
  }

  createChestClusterSpots(room, entry) {
    const offsets = [
      { x: entry.chestSpotOffset, z: 0 },
      { x: -entry.chestSpotOffset, z: 0 },
      { x: 0, z: entry.chestSpotOffset },
      { x: 0, z: -entry.chestSpotOffset },
    ];

    return (room.chestSpawns ?? []).flatMap((chest, chestIndex) =>
      offsets.map((offset, offsetIndex) => ({
        x: chest.x + offset.x,
        z: chest.z + offset.z,
        kind: "chest",
        id: `${room.id}:chest:${chestIndex}:${offsetIndex}`,
      }))
    );
  }

  canUseClusterSpot(spot, entry, room, occupiedModules) {
    if (!this.isPointInsideAnyArea(spot, room.walkableAreas ?? [])) return false;

    return this.canPlaceModule({
      x: spot.x,
      z: spot.z,
      w: entry.w,
      d: entry.d,
      placementFootprint: entry.placementFootprint,
    }, occupiedModules);
  }

  createPropCluster({ entry, room, spot, occupiedModules, blockingModules, clusterIndex }) {
    const fixedAnchor = spot && !spot.zone
      ? [spot]
      : null;
    const anchors = (fixedAnchor ?? this.getCandidateTilesForEntry(room, entry, spot?.zone ?? null))
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
        zone: spot?.zone ?? null,
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
    const candidates = this.getClusterCandidatePoints(room, entry, anchor, clusterIndex, zone, targetSize);

    for (const point of candidates) {
      if (cluster.length >= targetSize) break;
      const module = this.createPropModule(entry, point, room, this.getTileKey(point), {
        usePositionJitter: false,
      });
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

  getClusterCandidatePoints(room, entry, anchor, clusterIndex, zone = null, targetSize = 1) {
    const candidates = [
      anchor,
      ...this.createCompactClusterPoints(entry, room, anchor, clusterIndex, targetSize),
    ];
    const attemptCount = Math.max(targetSize * 18, 36);

    for (let attemptIndex = 0; attemptIndex < attemptCount; attemptIndex += 1) {
      const unitAngle = this.createDeterministicUnit(
        `${entry.seed}:${entry.moduleId}:${room.id}:clusterAngle:${clusterIndex}:${this.getTileKey(anchor)}:${attemptIndex}`
      );
      const unitRadius = this.createDeterministicUnit(
        `${entry.seed}:${entry.moduleId}:${room.id}:clusterRadius:${clusterIndex}:${this.getTileKey(anchor)}:${attemptIndex}`
      );
      const radius = Math.sqrt(unitRadius) * entry.clusterScatterRadius;
      const angle = unitAngle * Math.PI * 2;
      const point = {
        x: anchor.x + Math.cos(angle) * radius,
        z: anchor.z + Math.sin(angle) * radius,
      };

      if (this.distance2D(point, anchor) > entry.clusterRadius) continue;
      if (!this.isPointInsideAnyArea(point, room.walkableAreas ?? [])) continue;
      if (zone && !this.areaContainsPoint(zone, point)) continue;

      candidates.push(point);
    }

    return candidates
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

  createCompactClusterPoints(entry, room, anchor, clusterIndex, targetSize) {
    const points = [];
    const footprint = entry.placementFootprint ?? { w: 0, d: 0 };
    const minimumStep = Math.max(footprint.w ?? 0, footprint.d ?? 0) + 0.001;
    const baseRadius = Math.min(
      entry.clusterRadius,
      Math.max(entry.clusterScatterRadius, minimumStep + 0.05)
    );
    if (baseRadius <= 0) return points;

    const angleOffset = this.createDeterministicUnit(
      `${entry.seed}:${entry.moduleId}:${room.id}:compactOffset:${clusterIndex}:${this.getTileKey(anchor)}`
    ) * Math.PI * 2;
    const pointCount = Math.max(targetSize * 2, 8);

    for (let index = 0; index < pointCount; index += 1) {
      const ring = 1 + Math.floor(index / 8);
      const radius = Math.min(entry.clusterRadius, baseRadius * ring);
      const angle = angleOffset + (index % 8) * (Math.PI / 4);

      const point = {
        x: anchor.x + Math.cos(angle) * radius,
        z: anchor.z + Math.sin(angle) * radius,
      };

      if (this.isPointInsideAnyArea(point, room.walkableAreas ?? [])) {
        points.push(point);
      }
    }

    return points;
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

  createPropModule(entry, tile, room, tileKey, options = {}) {
    const rotationIndex = Math.floor(
      this.createDeterministicUnit(`${entry.seed}:rotation:${entry.moduleId}:${room.id}:${tileKey}`) *
      DECORATION_FILL_ROTATIONS.length
    );
    const scaleMultiplier = this.createScaleMultiplier(entry, room, tileKey);
    const offset = options.usePositionJitter === false
      ? { x: 0, z: 0 }
      : this.createPositionJitter(entry, room, tileKey);

    return {
      x: tile.x + offset.x,
      z: tile.z + offset.z,
      w: entry.w,
      d: entry.d,
      placementFootprint: entry.placementFootprint,
      collisionFootprint: entry.collisionFootprint,
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
      this.areaContainsPoint(this.createBlockingArea(module), point)
    );
  }

  createBlockingArea(module) {
    return {
      ...module,
      w: module.collisionFootprint?.w ?? module.w,
      d: module.collisionFootprint?.d ?? module.d,
    };
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
