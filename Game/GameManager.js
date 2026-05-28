import { flatDistance } from "./Utils.js";
import { GAME_CONFIG, GAME_MODES } from "./GameConfig.js";
import { ROOM_TESTER_LEVELS, getRoomTesterLevel } from "./RoomTester.js";
import { createProceduralFloor } from "./ProceduralLevelFactory.js";
import { RunState, createRunSeed } from "./RunState.js";
import { ENEMY_DIFFICULTY } from "../CharacterData/enemyDefinitions.js";

export class GameManager {
  constructor(scene, config = GAME_CONFIG) {
    this.scene = scene;
    this.config = config;
    this.runState = new RunState({
      mode: config.mode,
      runSeed: config.run?.runSeed ?? createRunSeed(),
    });
    this.isGameOver = false;
    this.reloadTimer = null;
    this.combatStartRange = 1;
    this.enemyMovementPauseReason = "playerCombat";

    this.initializeModeState();
  }

  update() {
    if (this.isGameOver) return;

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
      this.onPlayerDeath();
    }

    if (event.type === "levelExitReached") {
      this.onLevelExitReached();
    }
  }

  onPlayerDeath() {
    if (this.isGameOver) return;

    this.isGameOver = true;
    this.runState.markLost();
    this.scene.addLog("You died. Restarting...");

    this.reloadTimer = window.setTimeout(() => {
      this.restart();
    }, 1800);
  }

  restart() {
    this.isGameOver = false;
    this.reloadTimer = null;
    this.initializeModeState();
    this.scene.resetGameplayProgress();
    this.scene.loadLevel();
  }

  onLevelExitReached() {
    if (this.isGameOver) return;

    this.resumeEnemyMovement(this.scene.enemies);

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
      const runSeed = this.config.run?.runSeed ?? createRunSeed();

      this.startRun({
        runSeed,
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
      floorType: GAME_MODES.TESTER,
      difficultyTier: ENEMY_DIFFICULTY.EASY,
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

    return {
      ...snapshot,
      levelIndex: snapshot.currentFloorIndex,
      definition: createProceduralFloor({
        runSeed: snapshot.runSeed,
        floorSeed: snapshot.currentFloorSeed,
        floorIndex: snapshot.currentFloorIndex,
        floorType: snapshot.floorType,
        difficultyTier: snapshot.difficultyTier,
      }),
    };
  }

  getRunFloorPlan(floorIndex) {
    const normalFloorCount = this.config.run?.normalFloorCount ?? 10;
    const shopFloorIndex = this.config.run?.shopFloorIndex ?? normalFloorCount + 1;
    const bossFloorIndex = this.config.run?.bossFloorIndex ?? shopFloorIndex + 1;

    if (floorIndex <= normalFloorCount) {
      return {
        floorType: "procedural",
        difficultyTier: this.getDifficultyTierForFloor(floorIndex),
        implemented: true,
      };
    }

    if (floorIndex === shopFloorIndex) {
      return {
        floorType: "shop",
        difficultyTier: ENEMY_DIFFICULTY.EASY,
        implemented: false,
      };
    }

    if (floorIndex === bossFloorIndex) {
      return {
        floorType: "boss",
        difficultyTier: ENEMY_DIFFICULTY.HARD,
        implemented: false,
      };
    }

    return {
      floorType: "complete",
      difficultyTier: ENEMY_DIFFICULTY.HARD,
      implemented: false,
    };
  }

  getDifficultyTierForFloor(floorIndex) {
    if (floorIndex >= 8) return ENEMY_DIFFICULTY.HARD;
    if (floorIndex >= 4) return ENEMY_DIFFICULTY.MEDIUM;
    return ENEMY_DIFFICULTY.EASY;
  }

  createFloorSeed(floorIndex) {
    return `${this.runState.runSeed}:floor:${String(floorIndex).padStart(2, "0")}`;
  }

  isTesterMode() {
    return this.runState.mode === GAME_MODES.TESTER;
  }

  capitalize(value) {
    const text = String(value ?? "");
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
}
