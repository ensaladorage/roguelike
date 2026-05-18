import { flatDistance } from "./Utils.js";

export class GameManager {
  constructor(scene) {
    this.scene = scene;
    this.isGameOver = false;
    this.reloadTimer = null;
    this.combatStartRange = 1.55;
    this.currentLevelIndex = 0;
    this.levelExitLocked = false;
  }

  update() {
    if (this.isGameOver) return;

    this.updateCombatEngagement();
  }

  updateCombatEngagement() {
    const { player, enemies } = this.scene;

    if (!player || player.hp <= 0) return;
    if (player.currentEnemy?.alive) {
      player.currentEnemy.startCombat(player);
      return;
    }

    for (const enemy of enemies) {
      if (!enemy.alive) continue;

      const distance = flatDistance(
        player.model.position,
        enemy.model.position
      );

      if (distance > this.combatStartRange) continue;

      player.enterCombat(enemy);
      enemy.startCombat(player);
      return;
    }
  }

  handleEvent(event) {
    if (event.type === "playerDefeated") {
      this.onPlayerDeath();
    }
  }

  setLevel(levelIndex) {
    this.currentLevelIndex = levelIndex;
    this.levelExitLocked = false;
  }

  activateLevelExit() {
    if (this.isGameOver) return;
    if (this.levelExitLocked) return;

    this.levelExitLocked = true;
    console.log("floorExitActivated", { floor: this.currentLevelIndex + 1 });
  }

  onPlayerDeath() {
    if (this.isGameOver) return;

    this.isGameOver = true;
    this.scene.addLog("Has muerto. Reiniciando...");

    this.reloadTimer = window.setTimeout(() => {
      this.restart();
    }, 1800);
  }

  restart() {
    window.location.reload();
  }
}
