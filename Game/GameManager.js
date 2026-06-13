import { GAME_CONFIG, GAME_MODES } from "./GameConfig.js";
import { createProceduralFloor } from "./ProceduralLevelFactory.js";
import { createShopFloor } from "./ShopFloorFactory.js";
import { createBossFloor } from "./BossFloorFactory.js";
import { RUN_FLOOR_TYPES, RunState, createRunSeed } from "./RunState.js";
import { ENEMY_DIFFICULTY } from "../CharacterData/enemyDefinitions.js";
import {
  RUN_PLAN,
  RUN_STAGE_TYPES,
  getRunStage,
  getRunStageCount,
  getShopTierDefinition,
} from "./RunPlan.js";

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
    this.runPlan = options.runPlan ?? this.config.run?.runPlan ?? RUN_PLAN;
    this.stageClearState = this.createEmptyStageClearState();
    this.isGameOver = false;
    this.isResetting = false;
    this.resetTimer = null;

    this.initializeModeState();
  }

  resolveConfig(config, options = {}) {
    const params = new URLSearchParams(globalThis.window?.location?.search ?? "");
    const requestedStageIndex = Number.parseInt(
      params.get("stage") ??
        params.get("floor") ??
        params.get("startStageIndex") ??
        params.get("startFloorIndex") ??
        "",
      10
    );
    const mode = GAME_MODES.RUN;
    const startStageIndex = Number.isInteger(requestedStageIndex) && requestedStageIndex > 0
      ? requestedStageIndex
      : config.run?.startStageIndex ?? config.run?.startFloorIndex ?? 1;

    return {
      ...config,
      mode,
      run: {
        ...(config.run ?? {}),
        startStageIndex,
        startFloorIndex: startStageIndex,
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

    if (event.type === "enemyDefeated") {
      this.handleEnemyDefeated(event.enemy);
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
      this.startRun({
        runSeed: this.getRestartRunSeed(),
        floorIndex: this.config.run?.startStageIndex ?? this.config.run?.startFloorIndex ?? 1,
      });

      this.scene.resetGameplayProgress();
      this.scene.loadLevel();
    } finally {
      this.isGameOver = false;
      this.isResetting = false;
      this.scene.hud?.hideDefeatedOverlay?.();
      this.scene.hud?.hideVictoryOverlay?.();
      this.scene.updateHud();
    }
  }

  onLevelExitReached() {
    if (this.isGameOver) return;

    if (this.runState.status === "won") return;

    const currentPlan = this.getRunFloorPlan(this.runState.currentFloorIndex);
    if (currentPlan.isFinalStage) {
      this.handleRunVictory();
      return;
    }

    const nextFloorIndex = this.runState.currentFloorIndex + 1;
    const floorPlan = this.getRunFloorPlan(nextFloorIndex);

    if (!floorPlan.implemented) {
      this.handleRunVictory();
      return;
    }

    this.runState.setCurrentFloor({
      floorIndex: nextFloorIndex,
      floorSeed: this.createFloorSeed(nextFloorIndex),
      floorType: floorPlan.floorType,
      stageId: floorPlan.stageId,
      stageName: floorPlan.stageName,
      stageType: floorPlan.stageType,
      shopTier: floorPlan.shopTier,
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

    this.scene.addLog(`Stairs reached. Loading stage ${nextFloorIndex}...`);
    this.scene.loadLevel({ preserveProgress: true });
  }

  handleRunVictory() {
    if (this.isGameOver || this.runState.status === "won") return;

    this.isGameOver = true;
    this.runState.markWon();
    this.clearResetTimer();
    this.scene.hud?.showVictoryOverlay?.();
    this.scene.addLog("Completed! Restarting...");
    console.log("runWon", this.runState.createSnapshot());

    this.resetTimer = window.setTimeout(() => {
      this.restartCurrentMode();
    }, DEFEATED_RESET_DELAY_MS);
  }

  initializeModeState() {
    this.startRun({
      runSeed: this.config.run?.runSeed ?? createRunSeed(),
      floorIndex: this.config.run?.startStageIndex ?? this.config.run?.startFloorIndex ?? 1,
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
      stageId: floorPlan.stageId,
      stageName: floorPlan.stageName,
      stageType: floorPlan.stageType,
      shopTier: floorPlan.shopTier,
      difficultyTier: floorPlan.difficultyTier,
      cycleIndex: floorPlan.cycleIndex,
      cycleFloorIndex: floorPlan.cycleFloorIndex,
      difficultyScale: floorPlan.difficultyScale,
    });
  }

  getPreloadTileSetIds() {
    return ["scenarioDefault"];
  }

  resolveFloor() {
    const snapshot = this.runState.createSnapshot();

    const floorPlan = this.getRunFloorPlan(snapshot.currentFloorIndex);

    if (!floorPlan.implemented) {
      return {
        ...snapshot,
        definition: null,
        stagePlan: floorPlan.stage,
        shopTierDefinition: floorPlan.shopTierDefinition,
      };
    }

    const definition = this.createRunFloorDefinition(floorPlan, snapshot);

    return {
      ...snapshot,
      levelIndex: snapshot.currentFloorIndex,
      definition,
      stagePlan: floorPlan.stage,
      shopTierDefinition: floorPlan.shopTierDefinition,
    };
  }

  createRunFloorDefinition(floorPlan, snapshot) {
    if (floorPlan.floorType === RUN_FLOOR_TYPES.SHOP) {
      return createShopFloor({
        runSeed: snapshot.runSeed,
        floorSeed: snapshot.currentFloorSeed,
        floorIndex: snapshot.currentFloorIndex,
        stage: floorPlan.stage,
        shopTier: floorPlan.shopTierDefinition,
      });
    }

    if (floorPlan.floorType === RUN_FLOOR_TYPES.BOSS) {
      return createBossFloor({
        runSeed: snapshot.runSeed,
        floorSeed: snapshot.currentFloorSeed,
        floorIndex: snapshot.currentFloorIndex,
        stage: floorPlan.stage,
        cycleIndex: snapshot.cycleIndex,
        difficultyScale: snapshot.difficultyScale,
      });
    }

    return createProceduralFloor({
      runSeed: snapshot.runSeed,
      floorSeed: snapshot.currentFloorSeed,
      floorIndex: snapshot.currentFloorIndex,
      floorType: snapshot.floorType,
      stage: floorPlan.stage,
      stageProfile: floorPlan.stage?.compact ? "compactCombat" : "procedural",
      enemyPoolWeights: floorPlan.stage?.enemyPoolWeights,
      enemyCoinDrop: floorPlan.stage?.enemyCoinDrop,
      enemyPotionDrop: floorPlan.stage?.enemyPotionDrop,
      treasureReward: floorPlan.stage?.treasureReward,
      difficultyTier: snapshot.difficultyTier,
      cycleIndex: snapshot.cycleIndex,
      cycleFloorIndex: snapshot.cycleFloorIndex,
      difficultyScale: snapshot.difficultyScale,
    });
  }

  getRunFloorPlan(floorIndex) {
    const stage = getRunStage(floorIndex, this.runPlan);
    const stageCount = getRunStageCount(this.runPlan);
    const basePlan = {
      cycleIndex: 0,
      cycleFloorIndex: floorIndex,
      difficultyScale: stage?.difficultyScale ?? 1,
      implemented: Boolean(stage),
      stage,
      stageId: stage?.stageIndex ?? null,
      stageName: stage?.name ?? null,
      stageType: stage?.type ?? RUN_FLOOR_TYPES.COMPLETE,
      shopTier: stage?.shopTier ?? null,
      shopTierDefinition: stage?.shopTier
        ? getShopTierDefinition(stage.shopTier)
        : null,
      isFinalStage: Boolean(stage && stage.stageIndex === stageCount),
    };

    if (!stage) {
      return {
        ...basePlan,
        floorType: RUN_FLOOR_TYPES.COMPLETE,
        difficultyTier: ENEMY_DIFFICULTY.HARD,
        implemented: false,
      };
    }

    if (stage.type === RUN_STAGE_TYPES.COMBAT) {
      return {
        ...basePlan,
        floorType: RUN_FLOOR_TYPES.COMBAT,
        difficultyTier: this.getPrimaryDifficultyTier(stage.enemyPoolWeights),
      };
    }

    if (stage.type === RUN_STAGE_TYPES.SHOP) {
      return {
        ...basePlan,
        floorType: RUN_FLOOR_TYPES.SHOP,
        difficultyTier: ENEMY_DIFFICULTY.EASY,
      };
    }

    return {
      ...basePlan,
      floorType: RUN_FLOOR_TYPES.BOSS,
      difficultyTier: ENEMY_DIFFICULTY.HARD,
    };
  }

  getPrimaryDifficultyTier(enemyPoolWeights = {}) {
    let bestDifficulty = ENEMY_DIFFICULTY.EASY;
    let bestWeight = Number.NEGATIVE_INFINITY;

    for (const [difficulty, weight] of Object.entries(enemyPoolWeights)) {
      const numericWeight = Number.parseFloat(weight);
      if (!Number.isFinite(numericWeight) || numericWeight <= bestWeight) continue;

      bestDifficulty = difficulty;
      bestWeight = numericWeight;
    }

    return bestDifficulty;
  }

  registerStageClearTargets(level, enemies = []) {
    const floorPlan = this.getRunFloorPlan(this.runState.currentFloorIndex);
    const stage = floorPlan?.stage;

    this.stageClearState = this.createEmptyStageClearState({
      stageIndex: this.runState.currentFloorIndex,
      stageType: stage?.type ?? this.runState.floorType,
    });

    if (!stage || !this.stageRequiresClear(stage)) {
      this.stageClearState.cleared = true;
      return;
    }

    const roomTypesById = new Map(
      (level.roomTags ?? []).map((room) => [room.id, room.type])
    );
    const requiredRoomTypes = stage.type === RUN_STAGE_TYPES.BOSS
      ? new Set(["boss"])
      : new Set(["combat"]);

    for (const enemy of enemies) {
      const roomType = roomTypesById.get(enemy.roomId);
      if (!requiredRoomTypes.has(roomType)) continue;

      this.stageClearState.requiredEnemies.add(enemy);
    }

    this.stageClearState.totalRequiredEnemies =
      this.stageClearState.requiredEnemies.size;
    this.stageClearState.remainingRequiredEnemies =
      this.stageClearState.requiredEnemies.size;
    this.stageClearState.cleared =
      this.stageClearState.remainingRequiredEnemies === 0;
  }

  handleEnemyDefeated(enemy) {
    const state = this.stageClearState;
    if (!state?.requiredEnemies?.has(enemy)) return;

    state.requiredEnemies.delete(enemy);
    state.remainingRequiredEnemies = state.requiredEnemies.size;

    if (state.remainingRequiredEnemies > 0 || state.cleared) return;

    state.cleared = true;

    if (state.stageType === RUN_STAGE_TYPES.BOSS) {
      this.scene.addLog("Boss defeated.");
      this.scene.onStageCleared?.({
        stageIndex: state.stageIndex,
        stageType: state.stageType,
      });
      this.handleRunVictory();
      return;
    }

    this.scene.addLog("Room cleared!");
    this.scene.onStageCleared?.({
      stageIndex: state.stageIndex,
      stageType: state.stageType,
    });
  }

  stageRequiresClear(stage) {
    return (
      stage.type === RUN_STAGE_TYPES.COMBAT ||
      stage.type === RUN_STAGE_TYPES.BOSS
    );
  }

  isStageExitLocked() {
    if (!this.stageClearState.requiresClear) return false;

    return !this.stageClearState.cleared;
  }

  getStageExitLockedMessage() {
    if (this.stageClearState.stageType === RUN_STAGE_TYPES.BOSS) {
      return "Defeat the boss before leaving.";
    }

    return "Defeat all enemies before leaving.";
  }

  createEmptyStageClearState(overrides = {}) {
    return {
      stageIndex: null,
      stageType: null,
      requiresClear: false,
      cleared: false,
      requiredEnemies: new Set(),
      totalRequiredEnemies: 0,
      remainingRequiredEnemies: 0,
      ...overrides,
      requiresClear: this.stageRequiresClear({
        type: overrides.stageType,
      }),
    };
  }

  getRestartRunSeed() {
    if (this.runResetConfig.reuseSeedOnRestart) {
      return this.runState.runSeed ?? createRunSeed();
    }

    return createRunSeed();
  }

  createFloorSeed(floorIndex) {
    return `${this.runState.runSeed}:stage:${String(floorIndex).padStart(2, "0")}`;
  }

  clearResetTimer() {
    if (!this.resetTimer) return;

    window.clearTimeout(this.resetTimer);
    this.resetTimer = null;
  }
  capitalize(value) {
    const text = String(value ?? "");
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
}
