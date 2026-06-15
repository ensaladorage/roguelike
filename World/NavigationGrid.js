import * as THREE from "three";

export class NavigationGrid {
  constructor({
    gridSize,
    groundY,
    targetSearchRadius,
    targetSearchStep,
  }) {
    this.gridSize = gridSize;
    this.groundY = groundY;
    this.targetSearchRadius = targetSearchRadius;
    this.targetSearchStep = targetSearchStep;

    this.walkableAreas = [];
    this.collisionWalls = [];
    this.bounds = null;
  }

  configure({ walkableAreas = [], collisionWalls = [] } = {}) {
    this.walkableAreas = walkableAreas.map((area) => ({ ...area }));
    this.collisionWalls = collisionWalls.map((wall) => ({ ...wall }));
    this.bounds = this.calculateBounds(this.walkableAreas);
  }

  clear() {
    this.walkableAreas = [];
    this.collisionWalls = [];
    this.bounds = null;
  }

  getBounds() {
    return this.bounds ? { ...this.bounds } : null;
  }

  calculateBounds(areas) {
    if (areas.length === 0) return null;

    return areas.reduce(
      (bounds, area) => ({
        minX: Math.min(bounds.minX, area.x - area.w / 2),
        maxX: Math.max(bounds.maxX, area.x + area.w / 2),
        minZ: Math.min(bounds.minZ, area.z - area.d / 2),
        maxZ: Math.max(bounds.maxZ, area.z + area.d / 2),
      }),
      {
        minX: Infinity,
        maxX: -Infinity,
        minZ: Infinity,
        maxZ: -Infinity,
      }
    );
  }

  findPath(from, to, radius = 0) {
    if (!this.bounds) return [];

    if (this.canMoveBetween(from, to, radius)) {
      return [to.clone()];
    }

    const start =
      this.getNearestWalkableCell(from, radius, {
        maxRing: 3,
        mustConnectToPosition: true,
      }) ??
      this.getNearestWalkableCell(from, radius, {
        maxRing: 3,
      });

    const goal = this.getNearestWalkableCell(to, radius, {
      maxRing: 3,
      mustConnectToPosition: true,
    });

    if (!start || !goal) return [];

    const open = [start];
    const cameFrom = new Map();
    const gScore = new Map([[this.cellKey(start), 0]]);
    const fScore = new Map([[this.cellKey(start), this.heuristic(start, goal)]]);
    const closed = new Set();

    while (open.length > 0) {
      open.sort(
        (a, b) =>
          (fScore.get(this.cellKey(a)) ?? Infinity) -
          (fScore.get(this.cellKey(b)) ?? Infinity)
      );

      const current = open.shift();
      const currentKey = this.cellKey(current);

      if (current.x === goal.x && current.z === goal.z) {
        return this.simplifyPath(
          this.reconstructPath(cameFrom, current).concat(to.clone()),
          from,
          radius
        );
      }

      closed.add(currentKey);

      for (const neighbor of this.getNeighbors(current, radius)) {
        const neighborKey = this.cellKey(neighbor);
        if (closed.has(neighborKey)) continue;

        const tentativeG =
          (gScore.get(currentKey) ?? Infinity) + this.stepCost(current, neighbor);

        if (tentativeG >= (gScore.get(neighborKey) ?? Infinity)) {
          continue;
        }

        cameFrom.set(neighborKey, current);
        gScore.set(neighborKey, tentativeG);
        fScore.set(neighborKey, tentativeG + this.heuristic(neighbor, goal));

        if (!open.some((cell) => this.cellKey(cell) === neighborKey)) {
          open.push(neighbor);
        }
      }
    }

    return [];
  }

  findReachableTargetNear(from, to, radius = 0) {
    const candidates = this.getWalkableTargetCandidates(to, radius);

    for (const target of candidates) {
      const path = this.findPath(from, target, radius);

      if (path.length > 0) {
        return { target, path };
      }
    }

    return null;
  }

  worldToCell(position) {
    if (!this.bounds) return null;

    return {
      x: Math.round((position.x - this.bounds.minX) / this.gridSize),
      z: Math.round((position.z - this.bounds.minZ) / this.gridSize),
    };
  }

  cellToWorld(cell) {
    if (!this.bounds || !cell) return null;

    return new THREE.Vector3(
      this.bounds.minX + cell.x * this.gridSize,
      this.groundY,
      this.bounds.minZ + cell.z * this.gridSize
    );
  }

  isCellWalkable(cell, radius = 0) {
    const position = this.cellToWorld(cell);
    return position ? this.isWalkablePosition(position, radius) : false;
  }

  getNearestWalkableCell(position, radius, options = {}) {
    if (!this.bounds) return null;

    const maxRing = options.maxRing ?? 2;
    const center = this.worldToCell(position);
    if (!center) return null;

    const candidates = [];

    for (let ring = 0; ring <= maxRing; ring += 1) {
      for (let x = center.x - ring; x <= center.x + ring; x += 1) {
        for (let z = center.z - ring; z <= center.z + ring; z += 1) {
          const cellRing = Math.max(
            Math.abs(x - center.x),
            Math.abs(z - center.z)
          );

          if (cellRing !== ring) {
            continue;
          }

          candidates.push({ x, z });
        }
      }
    }

    candidates.sort((a, b) => {
      const aWorld = this.cellToWorld(a);
      const bWorld = this.cellToWorld(b);

      return (
        aWorld.distanceToSquared(position) -
        bWorld.distanceToSquared(position)
      );
    });

    for (const cell of candidates) {
      if (!this.isCellInBounds(cell)) continue;
      if (!this.isCellWalkable(cell, radius)) continue;

      const cellWorld = this.cellToWorld(cell);
      if (
        options.mustConnectToPosition &&
        !this.canMoveBetween(cellWorld, position, radius)
      ) {
        continue;
      }

      return cell;
    }

    return null;
  }

  getNeighbors(cell, radius = 0) {
    const neighbors = [];
    const directions = [
      { x: 1, z: 0 },
      { x: -1, z: 0 },
      { x: 0, z: 1 },
      { x: 0, z: -1 },
      { x: 1, z: 1 },
      { x: 1, z: -1 },
      { x: -1, z: 1 },
      { x: -1, z: -1 },
    ];

    for (const dir of directions) {
      const neighbor = {
        x: cell.x + dir.x,
        z: cell.z + dir.z,
      };

      if (!this.isCellInBounds(neighbor)) continue;
      if (!this.isCellWalkable(neighbor, radius)) continue;

      const currentWorld = this.cellToWorld(cell);
      const neighborWorld = this.cellToWorld(neighbor);

      if (!this.canMoveBetween(currentWorld, neighborWorld, radius)) continue;

      if (
        dir.x !== 0 &&
        dir.z !== 0 &&
        (!this.isCellWalkable({ x: cell.x + dir.x, z: cell.z }, radius) ||
          !this.isCellWalkable({ x: cell.x, z: cell.z + dir.z }, radius))
      ) {
        continue;
      }

      neighbors.push(neighbor);
    }

    return neighbors;
  }

  isCellInBounds(cell) {
    const position = this.cellToWorld(cell);
    if (!position) return false;

    return (
      position.x >= this.bounds.minX &&
      position.x <= this.bounds.maxX &&
      position.z >= this.bounds.minZ &&
      position.z <= this.bounds.maxZ
    );
  }

  cellKey(cell) {
    return `${cell.x},${cell.z}`;
  }

  heuristic(a, b) {
    const dx = Math.abs(a.x - b.x);
    const dz = Math.abs(a.z - b.z);
    return Math.hypot(dx, dz);
  }

  stepCost(a, b) {
    return a.x !== b.x && a.z !== b.z ? Math.SQRT2 : 1;
  }

  reconstructPath(cameFrom, current) {
    const cells = [current];
    let currentKey = this.cellKey(current);

    while (cameFrom.has(currentKey)) {
      current = cameFrom.get(currentKey);
      cells.unshift(current);
      currentKey = this.cellKey(current);
    }

    return cells.slice(1).map((cell) => this.cellToWorld(cell));
  }

  simplifyPath(points, from, radius = 0) {
    if (points.length <= 2) return points;

    const simplified = [];
    let anchor = from.clone();
    let index = 0;

    while (index < points.length) {
      let nextIndex = index;

      for (let i = points.length - 1; i >= index; i -= 1) {
        if (this.canMoveBetween(anchor, points[i], radius)) {
          nextIndex = i;
          break;
        }
      }

      const next = points[nextIndex].clone();
      simplified.push(next);
      anchor = next;
      index = nextIndex + 1;
    }

    return simplified;
  }

  getWalkableTargetCandidates(point, radius) {
    const candidates = [];
    const seen = new Set();
    const maxSnapDistanceSq =
      this.targetSearchRadius * this.targetSearchRadius;

    const addCandidate = (x, z) => {
      const target = new THREE.Vector3(x, this.groundY, z);
      const key = `${target.x.toFixed(3)},${target.z.toFixed(3)}`;

      if (seen.has(key)) return;
      if (!this.isWalkablePosition(target, radius)) return;

      seen.add(key);
      candidates.push(target);
    };

    addCandidate(point.x, point.z);

    for (const area of this.walkableAreas) {
      const minX = area.x - area.w / 2 + radius;
      const maxX = area.x + area.w / 2 - radius;
      const minZ = area.z - area.d / 2 + radius;
      const maxZ = area.z + area.d / 2 - radius;

      if (minX > maxX || minZ > maxZ) continue;

      const clampedX = THREE.MathUtils.clamp(point.x, minX, maxX);
      const clampedZ = THREE.MathUtils.clamp(point.z, minZ, maxZ);
      const dx = clampedX - point.x;
      const dz = clampedZ - point.z;

      if (dx * dx + dz * dz > maxSnapDistanceSq) continue;

      addCandidate(clampedX, clampedZ);
    }

    const angleStep = Math.PI / 8;

    for (
      let distance = this.targetSearchStep;
      distance <= this.targetSearchRadius;
      distance += this.targetSearchStep
    ) {
      for (let angle = 0; angle < Math.PI * 2; angle += angleStep) {
        addCandidate(
          point.x + Math.cos(angle) * distance,
          point.z + Math.sin(angle) * distance
        );
      }
    }

    candidates.sort(
      (a, b) => a.distanceToSquared(point) - b.distanceToSquared(point)
    );

    return candidates;
  }

  getNearestWalkablePosition(
    point,
    radius,
    maxSearchRadius = 3,
    searchStep = 0.2
  ) {
    const candidates = [];
    const seen = new Set();

    const addCandidate = (x, z) => {
      const candidate = new THREE.Vector3(x, this.groundY, z);
      const key = `${candidate.x.toFixed(3)},${candidate.z.toFixed(3)}`;

      if (seen.has(key)) return;
      if (!this.isWalkablePosition(candidate, radius)) return;

      seen.add(key);
      candidates.push(candidate);
    };

    addCandidate(point.x, point.z);

    for (const area of this.walkableAreas) {
      const minX = area.x - area.w / 2 + radius;
      const maxX = area.x + area.w / 2 - radius;
      const minZ = area.z - area.d / 2 + radius;
      const maxZ = area.z + area.d / 2 - radius;

      if (minX > maxX || minZ > maxZ) continue;

      addCandidate(
        THREE.MathUtils.clamp(point.x, minX, maxX),
        THREE.MathUtils.clamp(point.z, minZ, maxZ)
      );
    }

    const angleStep = Math.PI / 8;

    for (
      let distance = searchStep;
      distance <= maxSearchRadius;
      distance += searchStep
    ) {
      for (let angle = 0; angle < Math.PI * 2; angle += angleStep) {
        addCandidate(
          point.x + Math.cos(angle) * distance,
          point.z + Math.sin(angle) * distance
        );
      }

      if (candidates.length > 0) break;
    }

    candidates.sort(
      (a, b) => a.distanceToSquared(point) - b.distanceToSquared(point)
    );

    return candidates[0] ?? null;
  }

  getRandomWalkablePoint(areas = [], radius = 0, origin = null) {
    const sourceAreas = areas.length > 0 ? areas : this.walkableAreas;
    const validAreas = sourceAreas.filter(
      (area) => area.w > radius * 2 && area.d > radius * 2
    );

    if (validAreas.length === 0) return null;

    for (let i = 0; i < 48; i += 1) {
      const area = validAreas[Math.floor(Math.random() * validAreas.length)];
      const x =
        area.x - area.w / 2 + radius + Math.random() * (area.w - radius * 2);
      const z =
        area.z - area.d / 2 + radius + Math.random() * (area.d - radius * 2);
      const point = new THREE.Vector3(x, this.groundY, z);

      if (!this.isWalkablePosition(point, radius)) continue;
      if (origin && this.flatDistance(origin, point) < radius * 3) continue;

      return point;
    }

    return null;
  }

  isWalkablePosition(position, radius = 0) {
    const insideWalkableArea = this.walkableAreas.some((area) =>
      this.isInsideArea(position, area, radius)
    );

    if (!insideWalkableArea) return false;

    return !this.collisionWalls.some((wall) =>
      this.isInsideWall(position, wall, radius)
    );
  }

  isInsideArea(position, area, radius) {
    return (
      position.x >= area.x - area.w / 2 + radius &&
      position.x <= area.x + area.w / 2 - radius &&
      position.z >= area.z - area.d / 2 + radius &&
      position.z <= area.z + area.d / 2 - radius
    );
  }

  isPointInsideWall(position, wall, radius) {
    return this.isInsideWall(position, wall, radius);
  }

  isInsideWall(position, wall, radius) {
    return (
      position.x >= wall.x - wall.w / 2 - radius &&
      position.x <= wall.x + wall.w / 2 + radius &&
      position.z >= wall.z - wall.d / 2 - radius &&
      position.z <= wall.z + wall.d / 2 + radius
    );
  }

  canMoveBetween(from, to, radius = 0) {
    const target = {
      x: to.x,
      z: to.z,
    };

    return (
      this.isWalkablePosition(target, radius) &&
      !this.movementHitsWall(from, to, radius)
    );
  }

  movementHitsWall(from, to, radius) {
    const dx = from.x - to.x;
    const dz = from.z - to.z;
    if (dx * dx + dz * dz <= 0.000001) return false;

    return this.collisionWalls.some((wall) =>
      this.segmentIntersectsWall(from, to, wall, radius)
    );
  }

  segmentIntersectsWall(from, to, wall, radius) {
    const minX = wall.x - wall.w / 2 - radius;
    const maxX = wall.x + wall.w / 2 + radius;
    const minZ = wall.z - wall.d / 2 - radius;
    const maxZ = wall.z + wall.d / 2 + radius;

    const directionX = to.x - from.x;
    const directionZ = to.z - from.z;
    let minT = 0;
    let maxT = 1;

    const xRange = this.clipSegmentAxis(
      from.x,
      directionX,
      minX,
      maxX,
      minT,
      maxT
    );

    if (!xRange) return false;

    minT = xRange.minT;
    maxT = xRange.maxT;

    const zRange = this.clipSegmentAxis(
      from.z,
      directionZ,
      minZ,
      maxZ,
      minT,
      maxT
    );

    return Boolean(zRange);
  }

  clipSegmentAxis(origin, direction, min, max, minT, maxT) {
    if (Math.abs(direction) < 0.000001) {
      if (origin < min || origin > max) return null;
      return { minT, maxT };
    }

    let axisMinT = (min - origin) / direction;
    let axisMaxT = (max - origin) / direction;

    if (axisMinT > axisMaxT) {
      const temp = axisMinT;
      axisMinT = axisMaxT;
      axisMaxT = temp;
    }

    const nextMinT = Math.max(minT, axisMinT);
    const nextMaxT = Math.min(maxT, axisMaxT);

    if (nextMinT > nextMaxT) return null;

    return {
      minT: nextMinT,
      maxT: nextMaxT,
    };
  }

  flatDistance(a, b) {
    const dx = a.x - b.x;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dz * dz);
  }
}
