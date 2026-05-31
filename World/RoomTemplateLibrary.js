const QUARTER_TURN = Math.PI / 2;

function normalizeQuarterTurns(rotationY = 0) {
  const rawTurns = Math.round(rotationY / QUARTER_TURN);
  return ((rawTurns % 4) + 4) % 4;
}

function rotatePoint(point, quarterTurns) {
  switch (quarterTurns) {
    case 1:
      return { x: -point.z, z: point.x };
    case 2:
      return { x: -point.x, z: -point.z };
    case 3:
      return { x: point.z, z: -point.x };
    default:
      return { x: point.x, z: point.z };
  }
}

function rotateSide(side, quarterTurns) {
  const sides = ["north", "east", "south", "west"];
  const index = sides.indexOf(side);
  if (index === -1) return side;
  return sides[(index + quarterTurns) % sides.length];
}

function rotateCorner(corner, quarterTurns) {
  const corners = ["northWest", "northEast", "southEast", "southWest"];
  const index = corners.indexOf(corner);
  if (index === -1) return corner;
  return corners[(index + quarterTurns) % corners.length];
}

function transformArea(area, placement, quarterTurns) {
  const rotated = rotatePoint(area, quarterTurns);
  const swapAxes = quarterTurns % 2 === 1;

  const transformed = {
    ...area,
    x: placement.position.x + rotated.x,
    z: placement.position.z + rotated.z,
    w: swapAxes ? area.d : area.w,
    d: swapAxes ? area.w : area.d,
    rotationY: (area.rotationY ?? 0) + quarterTurns * QUARTER_TURN,
  };

  if (area.side) {
    transformed.side = rotateSide(area.side, quarterTurns);
  }

  if (area.corner) {
    transformed.corner = rotateCorner(area.corner, quarterTurns);
  }

  return transformed;
}

function transformPoint(point, placement, quarterTurns) {
  const rotated = rotatePoint(point, quarterTurns);

  return {
    ...point,
    x: placement.position.x + rotated.x,
    z: placement.position.z + rotated.z,
  };
}

function transformDoorOpening(opening, dimensions, placement, quarterTurns) {
  const halfW = dimensions.w / 2;
  const halfD = dimensions.d / 2;

  let localCenter = { x: 0, z: 0 };

  switch (opening.side) {
    case "north":
      localCenter = { x: opening.offset, z: -halfD };
      break;
    case "south":
      localCenter = { x: opening.offset, z: halfD };
      break;
    case "west":
      localCenter = { x: -halfW, z: opening.offset };
      break;
    case "east":
      localCenter = { x: halfW, z: opening.offset };
      break;
  }

  const worldCenter = rotatePoint(localCenter, quarterTurns);

  return {
    ...opening,
    sourceSide: opening.side,
    side: rotateSide(opening.side, quarterTurns),
    x: placement.position.x + worldCenter.x,
    z: placement.position.z + worldCenter.z,
    rotationY: quarterTurns * QUARTER_TURN,
  };
}

function transformEnemySpawn(enemySpawn, placement, quarterTurns) {
  const enemy = transformPoint(enemySpawn, placement, quarterTurns);

  return {
    ...enemy,
    patrol: (enemySpawn.patrol ?? []).map((point) =>
      transformPoint(point, placement, quarterTurns)
    ),
    patrolAreas: (enemySpawn.patrolAreas ?? []).map((area) =>
      transformArea(area, placement, quarterTurns)
    ),
  };
}

function transformChestSpawn(chestSpawn, placement, quarterTurns) {
  return {
    ...transformPoint(chestSpawn, placement, quarterTurns),
    rotationY: chestSpawn.rotationY ?? 0,
  };
}

export class RoomTemplateLibrary {
  constructor(templates = []) {
    this.templates = new Map(
      templates.map((template) => [template.id, template])
    );
  }

  getTemplate(templateId) {
    return this.templates.get(templateId) ?? null;
  }

  resolveRoomPlacement(placement) {
    const template = this.getTemplate(placement.templateId);
    if (!template) {
      throw new Error(`Room template not found: ${placement.templateId}`);
    }

    const quarterTurns = normalizeQuarterTurns(placement.rotationY ?? 0);

    return {
      id: placement.id ?? placement.templateId,
      templateId: template.id,
      type: template.type,
      name: template.name,
      tags: [...(template.tags ?? [])],
      dimensions: quarterTurns % 2 === 1
        ? { w: template.dimensions.d, d: template.dimensions.w }
        : { ...template.dimensions },
      floorModules: template.floorModules.map((module) =>
        transformArea(module, placement, quarterTurns)
      ),
      wallModules: template.wallModules.map((module) =>
        transformArea(module, placement, quarterTurns)
      ),
      doorwayModules: template.doorwayModules.map((module) =>
        transformArea(module, placement, quarterTurns)
      ),
      setDressingModules: (template.setDressingModules ?? []).map((module) =>
        transformArea(module, placement, quarterTurns)
      ),
      decorativeModules: (template.decorativeModules ?? []).map((module) =>
        transformArea(module, placement, quarterTurns)
      ),
      obstacleModules: template.obstacleModules.map((module) =>
        transformArea(module, placement, quarterTurns)
      ),
      decorZones: (template.decorZones ?? []).map((zone) =>
        transformArea(zone, placement, quarterTurns)
      ),
      decorationProtectedAreas: (template.decorationProtectedAreas ?? []).map((area) =>
        transformArea(area, placement, quarterTurns)
      ),
      walkableAreas: template.walkableAreas.map((area) =>
        transformArea(area, placement, quarterTurns)
      ),
      doorOpenings: template.doorOpenings.map((opening) =>
        transformDoorOpening(opening, template.dimensions, placement, quarterTurns)
      ),
      enemySpawns: template.enemySpawns.map((spawn) =>
        transformEnemySpawn(spawn, placement, quarterTurns)
      ),
      chestSpawns: template.chestSpawns.map((spawn) =>
        transformChestSpawn(spawn, placement, quarterTurns)
      ),
      exitMarker: template.exitMarker
        ? transformPoint(template.exitMarker, placement, quarterTurns)
        : null,
    };
  }
}
