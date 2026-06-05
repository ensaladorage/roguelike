import { GAME_CONFIG, GAME_MODES } from "./GameConfig.js";
import { ROOM_TESTER_LEVELS, getRoomTesterLevel } from "./RoomTester.js";
import { createProceduralFloor } from "./ProceduralLevelFactory.js";
import { createShopFloor } from "./ShopFloorFactory.js";
import { createBossFloor } from "./BossFloorFactory.js";
import { RUN_FLOOR_TYPES, RunState, createRunSeed } from "./RunState.js";
import { ENEMY_DIFFICULTY } from "../CharacterData/enemyDefinitions.js";

export { GAME_MODES } from "./GameConfig.js";

const DEFAULT_RUN_RESET_CONFIG = {
  reuseSeedOnRestart: false,
};
const DEFEATED_RESET_DELAY_MS = 2000;

export class GameManager {
  constructor(scene, config = GAME_CONFIG, options = {}) {
    this.scene = scene;
    this.config = this.resolveConfig(config, options);
    this.runResetConfig = {
      ...DEFAULT_RUN_RESET_CONFIG,
      ...(
        options.runResetConfig ??
        globalThis.window?.ROGUELIKE_CONFIG?.runReset ??
        {}
      ),
    };
    this.runState = new RunState({
      mode: this.config.mode,
      runSeed: this.config.run?.runSeed ?? options.runSeed ?? createRunSeed(),
    });
    this.isGameOver = false;
    this.isResetting = false;
    this.resetTimer = null;

    this.initializeModeState();
  }

  resolveConfig(config, options = {}) {
    const params = new URLSearchParams(globalThis.window?.location?.search ?? "");
    const requestedMode = params.get("mode");
    const requestedFloorIndex = Number.parseInt(
      params.get("floor") ?? params.get("startFloorIndex") ?? "",
      10
    );
    const requestedTesterLevelIndex = Number.parseInt(
      params.get("testerLevel") ?? params.get("level") ?? "",
      10
    );
    const mode = options.mode ?? (
      Object.values(GAME_MODES).includes(requestedMode)
        ? requestedMode
        : config.mode
    );
    const startFloorIndex = Number.isInteger(requestedFloorIndex) && requestedFloorIndex > 0
      ? requestedFloorIndex
      : config.run?.startFloorIndex;
    const testerLevelIndex = Number.isInteger(requestedTesterLevelIndex) && requestedTesterLevelIndex >= 0
      ? requestedTesterLevelIndex
      : config.tester?.levelIndex;

    return {
      ...config,
      mode,
      tester: {
        ...(config.tester ?? {}),
        levelIndex: testerLevelIndex,
      },
      run: {
        ...(config.run ?? {}),
        startFloorIndex,
      },
    };
  }

  update() {
    if (this.isGameOver || this.isResetting) return;
  }

  handleEvent(event) {
    if (event.type === "playerDefeated") {
      this.handlePlayerDeath();
    }

    if (event.type === "levelExitReached") {
      this.onLevelExitReached();
    }
  }

  handlePlayerDeath() {
    if (this.isGameOver) return;

    this.isGameOver = true;
    this.runState.markLost();
    this.clearResetTimer();
    this.scene.hud?.showDefeatedOverlay?.();
    this.scene.addLog("You died. Restarting...");

    this.resetTimer = window.setTimeout(() => {
      this.restartCurrentMode();
    }, DEFEATED_RESET_DELAY_MS);
  }

  restartCurrentMode() {
    if (this.isResetting) return;

    this.isResetting = true;
    this.clearResetTimer();

    try {
      if (this.isTesterMode()) {
        this.startTester({
          levelIndex: this.config.tester?.levelIndex ?? 0,
        });
      } else {
        this.startRun({
          runSeed: this.getRestartRunSeed(),
          floorIndex: this.config.run?.startFloorIndex ?? 1,
        });
      }

      this.scene.resetGameplayProgress();
      this.scene.loadLevel();
    } finally {
      this.isGameOver = false;
      this.isResetting = false;
      this.scene.hud?.hideDefeatedOverlay?.();
      this.scene.updateHud();
    }
  }

  onLevelExitReached() {
    if (this.isGameOver) return;

    if (this.isTesterMode()) {
      this.scene.addLog("Stairs reached. Rebuilding tester floor...");
      this.scene.reloadCurrentLevel({ preserveProgress: true });
      return;
    }

    const nextFloorIndex = this.runState.currentFloorIndex + 1;
    const floorPlan = this.getRunFloorPlan(nextFloorIndex);

    this.runState.setCurrentFloor({
      floorIndex: nextFloorIndex,
      floorSeed: this.createFloorSeed(nextFloorIndex),
      floorType: floorPlan.floorType,
      difficultyTier: floorPlan.difficultyTier,
      cycleIndex: floorPlan.cycleIndex,
      cycleFloorIndex: floorPlan.cycleFloorIndex,
      difficultyScale: floorPlan.difficultyScale,
    });

    if (!floorPlan.implemented) {
      this.scene.addLog(`${this.capitalize(floorPlan.floorType)} floor is reserved for a future update.`);
      console.log("futureFloorReached", this.runState.createSnapshot());
      return;
    }

    this.scene.addLog(`Stairs reached. Loading floor ${nextFloorIndex}...`);
    this.scene.loadLevel({ preserveProgress: true });
  }

  initializeModeState() {
    if (this.config.mode === GAME_MODES.RUN) {
      this.startRun({
        runSeed: this.config.run?.runSeed ?? createRunSeed(),
        floorIndex: this.config.run?.startFloorIndex ?? 1,
      });
      return;
    }

    this.startTester({
      levelIndex: this.config.tester?.levelIndex ?? 0,
    });
  }

  startTester({ levelIndex = 0 } = {}) {
    this.runState.setMode(GAME_MODES.TESTER);
    this.runState.markActive();
    this.runState.setCurrentFloor({
      floorIndex: levelIndex + 1,
      floorSeed: `tester:${levelIndex}:${this.runState.runSeed}`,
      floorType: RUN_FLOOR_TYPES.TESTER,
      difficultyTier: ENEMY_DIFFICULTY.EASY,
      cycleIndex: 0,
      cycleFloorIndex: levelIndex + 1,
      difficultyScale: 1,
    });
  }

  startRun({ runSeed = createRunSeed(), floorIndex = 1 } = {}) {
    const floorPlan = this.getRunFloorPlan(floorIndex);

    this.runState.setMode(GAME_MODES.RUN);
    this.runState.setRunSeed(runSeed);
    this.runState.markActive();
    this.runState.setCurrentFloor({
      floorIndex,
      floorSeed: this.createFloorSeed(floorIndex),
      floorType: floorPlan.floorType,
      difficultyTier: floorPlan.difficultyTier,
      cycleIndex: floorPlan.cycleIndex,
      cycleFloorIndex: floorPlan.cycleFloorIndex,
      difficultyScale: floorPlan.difficultyScale,
    });
  }

  getPreloadTileSetIds() {
    if (this.isTesterMode()) {
      return [
        ...new Set(
          ROOM_TESTER_LEVELS.map((level) => level.tileSetId ?? "scenarioDefault")
        ),
      ];
    }

    return ["scenarioDefault"];
  }

  resolveFloor() {
    const snapshot = this.runState.createSnapshot();

    if (this.isTesterMode()) {
      const levelIndex = Math.max(0, snapshot.currentFloorIndex - 1);

      return {
        ...snapshot,
        levelIndex,
        definition: getRoomTesterLevel(levelIndex),
      };
    }

    const floorPlan = this.getRunFloorPlan(snapshot.currentFloorIndex);

    if (!floorPlan.implemented) {
      return {
        ...snapshot,
        definition: null,
      };
    }

    const definition = this.createRunFloorDefinition(floorPlan, snapshot);

    return {
      ...snapshot,
      levelIndex: snapshot.currentFloorIndex,
      definition,
    };
  }

  createRunFloorDefinition(floorPlan, snapshot) {
    if (floorPlan.floorType === RUN_FLOOR_TYPES.SHOP) {
      return createShopFloor({
        runSeed: snapshot.runSeed,
        floorSeed: snapshot.currentFloorSeed,
        floorIndex: snapshot.currentFloorIndex,
      });
    }

    if (floorPlan.floorType === RUN_FLOOR_TYPES.BOSS) {
      return createBossFloor({
        runSeed: snapshot.runSeed,
        floorSeed: snapshot.currentFloorSeed,
        floorIndex: snapshot.currentFloorIndex,
        cycleIndex: snapshot.cycleIndex,
        difficultyScale: snapshot.difficultyScale,
      });
    }

    return createProceduralFloor({
      runSeed: snapshot.runSeed,
      floorSeed: snapshot.currentFloorSeed,
      floorIndex: snapshot.currentFloorIndex,
      floorType: snapshot.floorType,
      difficultyTier: snapshot.difficultyTier,
      cycleIndex: snapshot.cycleIndex,
      cycleFloorIndex: snapshot.cycleFloorIndex,
      difficultyScale: snapshot.difficultyScale,
    });
  }

  getRunFloorPlan(floorIndex) {
    const normalFloorCount = this.config.run?.normalFloorCount ?? 10;
    const shopFloorIndex = this.config.run?.shopFloorIndex ?? normalFloorCount + 1;
    const bossFloorIndex = this.config.run?.bossFloorIndex ?? shopFloorIndex + 1;
    const cycleLength = bossFloorIndex;
    const cycleIndex = Math.floor((floorIndex - 1) / cycleLength);
    const cycleFloorIndex = ((floorIndex - 1) % cycleLength) + 1;
    const difficultyScale = 1 + cycleIndex * 0.15;
    const basePlan = {
      cycleIndex,
      cycleFloorIndex,
      difficultyScale,
      implemented: true,
    };

    if (cycleFloorIndex <= normalFloorCount) {
      return {
        ...basePlan,
        floorType: RUN_FLOOR_TYPES.NORMAL,
        difficultyTier: this.getDifficultyTierForFloor(cycleFloorIndex),
      };
    }

    if (cycleFloorIndex === shopFloorIndex) {
      return {
        ...basePlan,
        floorType: RUN_FLOOR_TYPES.SHOP,
        difficultyTier: ENEMY_DIFFICULTY.EASY,
      };
    }

    if (cycleFloorIndex === bossFloorIndex) {
      return {
        ...basePlan,
        floorType: RUN_FLOOR_TYPES.BOSS,
        difficultyTier: ENEMY_DIFFICULTY.HARD,
      };
    }

    return {
      ...basePlan,
      floorType: RUN_FLOOR_TYPES.COMPLETE,
      difficultyTier: ENEMY_DIFFICULTY.HARD,
      implemented: false,
    };
  }

  getDifficultyTierForFloor(floorIndex) {
    if (floorIndex >= 8) return ENEMY_DIFFICULTY.HARD;
    if (floorIndex >= 4) return ENEMY_DIFFICULTY.MEDIUM;
    return ENEMY_DIFFICULTY.EASY;
  }

  getRestartRunSeed() {
    if (this.runResetConfig.reuseSeedOnRestart) {
      return this.runState.runSeed ?? createRunSeed();
    }

    return createRunSeed();
  }

  createFloorSeed(floorIndex) {
    return `${this.runState.runSeed}:floor:${String(floorIndex).padStart(2, "0")}`;
  }

  clearResetTimer() {
    if (!this.resetTimer) return;

    window.clearTimeout(this.resetTimer);
    this.resetTimer = null;
  }

  isTesterMode() {
    return this.runState.mode === GAME_MODES.TESTER;
  }

  capitalize(value) {
    const text = String(value ?? "");
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
}
