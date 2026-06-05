export const RUN_STATUSES = Object.freeze({
  ACTIVE: "active",
  WON: "won",
  LOST: "lost",
});

export const RUN_FLOOR_TYPES = Object.freeze({
  TESTER: "tester",
  NORMAL: "normal",
  SHOP: "shop",
  BOSS: "boss",
  COMPLETE: "complete",
});

export function createRunSeed() {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${randomPart}`;
}

export class RunState {
  constructor({
    mode = "tester",
    runSeed = createRunSeed(),
    currentFloorIndex = 1,
    currentFloorSeed = null,
    floorType = RUN_FLOOR_TYPES.TESTER,
    difficultyTier = "easy",
    cycleIndex = 0,
    cycleFloorIndex = currentFloorIndex,
    difficultyScale = 1,
    status = RUN_STATUSES.ACTIVE,
  } = {}) {
    this.mode = mode;
    this.runSeed = runSeed;
    this.currentFloorIndex = currentFloorIndex;
    this.currentFloorSeed =
      currentFloorSeed ?? this.createFloorSeed(currentFloorIndex);
    this.floorType = floorType;
    this.difficultyTier = difficultyTier;
    this.cycleIndex = cycleIndex;
    this.cycleFloorIndex = cycleFloorIndex;
    this.difficultyScale = difficultyScale;
    this.status = status;
  }

  setMode(mode) {
    this.mode = mode;
  }

  setRunSeed(runSeed = createRunSeed()) {
    this.runSeed = runSeed;
    this.currentFloorSeed = this.createFloorSeed(this.currentFloorIndex);
  }

  setCurrentFloor({
    floorIndex,
    floorSeed = null,
    floorType = RUN_FLOOR_TYPES.NORMAL,
    difficultyTier = "easy",
    cycleIndex = 0,
    cycleFloorIndex = floorIndex,
    difficultyScale = 1,
  }) {
    this.currentFloorIndex = floorIndex;
    this.floorType = floorType;
    this.difficultyTier = difficultyTier;
    this.cycleIndex = cycleIndex;
    this.cycleFloorIndex = cycleFloorIndex;
    this.difficultyScale = difficultyScale;
    this.currentFloorSeed = floorSeed ?? this.createFloorSeed(floorIndex);
  }

  createFloorSeed(floorIndex = this.currentFloorIndex) {
    return `${this.runSeed}:floor:${String(floorIndex).padStart(2, "0")}`;
  }

  markActive() {
    this.status = RUN_STATUSES.ACTIVE;
  }

  markWon() {
    this.status = RUN_STATUSES.WON;
  }

  markLost() {
    this.status = RUN_STATUSES.LOST;
  }

  createSnapshot() {
    return {
      mode: this.mode,
      runSeed: this.runSeed,
      currentFloorIndex: this.currentFloorIndex,
      currentFloorSeed: this.currentFloorSeed,
      floorType: this.floorType,
      difficultyTier: this.difficultyTier,
      cycleIndex: this.cycleIndex,
      cycleFloorIndex: this.cycleFloorIndex,
      difficultyScale: this.difficultyScale,
      status: this.status,
    };
  }
}
