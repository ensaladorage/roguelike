export class WorldNavigationAdapter {
  constructor(navigationGrid) {
    this.navigationGrid = navigationGrid;
  }

  configure(options) {
    this.navigationGrid.configure(options);
  }

  clear() {
    this.navigationGrid.clear();
  }

  getBounds() {
    return this.navigationGrid.getBounds();
  }

  isWalkablePosition(position, radius = 0) {
    return this.navigationGrid.isWalkablePosition(position, radius);
  }

  movementHitsWall(from, to, radius) {
    return this.navigationGrid.movementHitsWall(from, to, radius);
  }

  canMoveBetween(from, to, radius = 0) {
    return this.navigationGrid.canMoveBetween(from, to, radius);
  }

  findPath(from, to, radius = 0) {
    return this.navigationGrid.findPath(from, to, radius);
  }

  findReachableTargetNear(from, to, radius = 0) {
    return this.navigationGrid.findReachableTargetNear(from, to, radius);
  }

  getRandomWalkablePoint(areas = [], radius = 0, origin = null) {
    return this.navigationGrid.getRandomWalkablePoint(areas, radius, origin);
  }

  getNearestWalkableCell(position, radius, options = {}) {
    return this.navigationGrid.getNearestWalkableCell(
      position,
      radius,
      options
    );
  }

  getNearestWalkablePosition(
    point,
    radius,
    maxSearchRadius = 3,
    searchStep = 0.2
  ) {
    return this.navigationGrid.getNearestWalkablePosition(
      point,
      radius,
      maxSearchRadius,
      searchStep
    );
  }

  getWalkableTargetCandidates(point, radius) {
    return this.navigationGrid.getWalkableTargetCandidates(point, radius);
  }

  cellToWorld(cell) {
    return this.navigationGrid.cellToWorld(cell);
  }

  isPointInsideWall(position, wall, radius) {
    return this.navigationGrid.isPointInsideWall(position, wall, radius);
  }
}
