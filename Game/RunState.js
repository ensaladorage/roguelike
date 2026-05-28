export const RUN_STATUSES = Object.freeze({
  ACTIVE: "active",
  WON: "won",
  LOST: "lost",
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
    floorType = "tester",
    difficultyTier = "easy",
    status = RUN_STATUSES.ACTIVE,
  } = {}) {
    this.mode = mode;
    this.runSeed = runSeed;
    this.currentFloorIndex = currentFloorIndex;
    this.currentFloorSeed =
      currentFloorSeed ?? this.createFloorSeed(currentFloorIndex);
    this.floorType = floorType;
    this.difficultyTier = difficultyTier;
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
    floorType = "procedural",
    difficultyTier = "easy",
  }) {
    this.currentFloorIndex = floorIndex;
    this.floorType = floorType;
    this.difficultyTier = difficultyTier;
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
      status: this.status,
    };
  }
}
