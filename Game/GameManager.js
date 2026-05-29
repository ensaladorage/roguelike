import { flatDistance } from "./Utils.js";

export const GAME_MODES = {
  TESTER: "tester",
  RUN: "run",
};

const DEFAULT_RUN_RESET_CONFIG = {
  reuseSeedOnRestart: false,
};
const DEFEATED_RESET_DELAY_MS = 2000;

export class GameManager {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.mode = options.mode ?? GAME_MODES.TESTER;
    this.isGameOver = false;
    this.isResetting = false;
    this.resetTimer = null;
    this.combatStartRange = 1;
    this.enemyMovementPauseReason = "playerCombat";
    this.runResetConfig = {
      ...DEFAULT_RUN_RESET_CONFIG,
      ...(options.runResetConfig ?? {}),
    };
    this.runState = this.createRunState({
      mode: this.mode,
      runSeed: options.runSeed ?? this.scene.runSeed,
      floorIndex: this.scene.levelIndex ?? 0,
    });
  }

  update() {
    if (this.isGameOver || this.isResetting) return;

    this.updateCombatEngagement();
  }

  updateCombatEngagement() {
    const { player, enemies } = this.scene;

    if (!player || player.hp <= 0) {
      this.resumeEnemyMovement(enemies);
      return;
    }

    const activeEnemy = player.currentEnemy?.alive
      && !player.currentEnemy.isStunned?.()
      ? player.currentEnemy
      : null;

    if (activeEnemy) {
      this.pauseEnemyMovement(enemies, activeEnemy);
      activeEnemy.startCombat(player);
      return;
    }

    this.resumeEnemyMovement(enemies);

    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      if (enemy.isStunned?.()) continue;

      const distance = flatDistance(
        player.model.position,
        enemy.model.position
      );

      if (distance > this.combatStartRange) continue;

      player.enterCombat(enemy);
      enemy.startCombat(player);
      this.pauseEnemyMovement(enemies, enemy);
      return;
    }
  }

  pauseEnemyMovement(enemies = [], activeEnemy = null) {
    for (const enemy of enemies) {
      if (!enemy?.alive) continue;
      if (enemy === activeEnemy) continue;
      if (typeof enemy.pauseMovement !== "function") continue;

      enemy.pauseMovement(this.enemyMovementPauseReason);
    }
  }

  resumeEnemyMovement(enemies = []) {
    for (const enemy of enemies) {
      if (typeof enemy?.resumeMovement !== "function") continue;

      enemy.resumeMovement(this.enemyMovementPauseReason);
    }
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
    this.resumeEnemyMovement(this.scene.enemies);

    try {
      if (this.mode === GAME_MODES.RUN) {
        this.restartRun();
      } else {
        this.reloadTesterFloor();
      }
    } finally {
      this.isGameOver = false;
      this.isResetting = false;
      this.scene.hud?.hideDefeatedOverlay?.();
      this.scene.updateHud();
    }
  }

  restartRun() {
    const runSeed = this.getRestartRunSeed();

    this.mode = GAME_MODES.RUN;
    this.runState = this.createRunState({
      mode: GAME_MODES.RUN,
      runSeed,
      floorIndex: 0,
      status: "active",
    });

    this.scene.restartRun({
      runSeed,
      resetProgress: true,
      resetLog: true,
    });
  }

  reloadTesterFloor() {
    this.mode = GAME_MODES.TESTER;
    this.runState = this.createRunState({
      mode: GAME_MODES.TESTER,
      runSeed: this.scene.runSeed,
      floorIndex: this.scene.levelIndex,
      status: "active",
    });

    this.scene.reloadTesterFloor({
      resetProgress: true,
      resetLog: true,
    });
  }

  onLevelExitReached() {
    if (this.isGameOver) return;

    this.scene.addLog("Stairs reached. Rebuilding level 1...");
    this.resumeEnemyMovement(this.scene.enemies);
    this.scene.reloadCurrentLevel();
    this.syncRunStateFromScene();
  }

  getRestartRunSeed() {
    if (this.runResetConfig.reuseSeedOnRestart) {
      return this.runState.runSeed ?? this.scene.runSeed;
    }

    return this.scene.createRunSeed();
  }

  createRunState({
    mode = GAME_MODES.TESTER,
    runSeed = null,
    floorIndex = 0,
    status = "active",
  } = {}) {
    const safeFloorIndex = Math.max(0, floorIndex ?? 0);

    return {
      mode,
      runSeed,
      currentFloorIndex: safeFloorIndex,
      currentFloorSeed: runSeed ? `${runSeed}:floor:${safeFloorIndex + 1}` : null,
      floorType: mode === GAME_MODES.RUN ? "combat" : "tester",
      difficultyTier: "easy",
      status,
    };
  }

  clearResetTimer() {
    if (!this.resetTimer) return;

    window.clearTimeout(this.resetTimer);
    this.resetTimer = null;
  }

  syncRunStateFromScene(status = "active") {
    this.runState = this.createRunState({
      mode: this.mode,
      runSeed: this.scene.runSeed,
      floorIndex: this.scene.levelIndex,
      status,
    });
  }
}
