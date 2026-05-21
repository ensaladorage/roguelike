import * as THREE from "three";
import { flatDistance } from "../Game/Utils.js";
import { DEFAULT_CHEST_MODEL_ID } from "../Data/modelDefinitions.js";
import { COIN_REWARD_SOURCE, getCoinReward } from "./Coin.js";

export const CHEST_REWARD = {
  gold: 20,
  itemChance: 100,
  itemPool: [
    "steak",
    "chili",
    "ramen",
    "purpleShroom",
  ],
  potionDropItemId: "energyDrink",
  potionDropChancePercent: 100,
  potionDropRadius: 0.9,
};

export function getChestReward() {
  const itemPool = CHEST_REWARD.itemPool ?? [];
  const itemId =
    itemPool.length > 4 && Math.random() <= CHEST_REWARD.itemChance
      ? itemPool[Math.floor(Math.random() * itemPool.length)]
      : null;

  return {
    gold: CHEST_REWARD.gold,
    itemId,
  };
}

export class ChestManager {
  constructor(scene) {
    this.scene = scene;

    this.chests = [];
  }

  // =========================
  // LOAD CHESTS FROM LEVEL
  // =========================
  load(level) {
    this.clear();

    this.chests = level.chests.map((data) => {
      const model = this.createChestModel(data.modelId);

      model.position.set(data.x, 0, data.z);
      model.rotation.y = data.rotationY;
      model.scale.set(1, 1, 1);

      this.scene.levelGroup.add(model);
      const reward = getChestReward();

      return {
        model,
        gold: reward.gold,
        itemId: reward.itemId,
        collected: false,
      };
    });
  }

  // =========================
  // UPDATE LOOP ENTRY POINT
  // =========================
  update() {
    this.checkChestProximity();
  }

  // =========================
  // PROXIMITY CHECK
  // =========================
  checkChestProximity() {
    const playerPos = this.scene.player.model.position;

    for (const chest of this.chests) {
      if (chest.collected) continue;

      const distance = flatDistance(playerPos, chest.model.position);

      if (distance <= 1.25) {
        this.collectChest(chest);
      }
    }
  }

  // =========================
  // COLLECT CHEST
  // =========================
  collectChest(chest) {
    const collectedGold = this.scene.player.collectChest(chest);

    if (collectedGold <= 0) return;

    chest.collected = true;

    const lid = chest.model.getObjectByName("lid");
    if (lid) lid.rotation.x = -0.85;

    this.spawnCoins(chest);
    this.spawnPotionDrop(chest);
    this.collectChestItem(chest);

    this.scene.updateHud();
    this.scene.addLog(`Chest opened: +${collectedGold} gold.`);

    this.scene.sfx.play("chest");
  }

  collectChestItem(chest) {
    if (!chest.itemId || !this.scene.inventory) return;

    this.scene.inventory.pickupItem(chest.itemId, {
      source: "chest",
      chest,
      enemies: this.scene.enemies,
    });
  }

  spawnPotionDrop(chest) {
    const roll = this.rollPotionDrop();
    console.log("chestPotionDropRoll", {
      itemId: CHEST_REWARD.potionDropItemId,
      chancePercent: CHEST_REWARD.potionDropChancePercent,
      roll: roll.value,
      spawned: roll.success,
    });

    if (!roll.success || !this.scene.itemDropManager) return;

    const origin = chest.model.position.clone();
    const forward = new THREE.Vector3(0, 0, 1)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), chest.model.rotation.y)
      .normalize();

    const position = origin
      .clone()
      .addScaledVector(forward, CHEST_REWARD.potionDropRadius);

    this.scene.itemDropManager.addItemDrops([
      {
        itemId: CHEST_REWARD.potionDropItemId,
        position: new THREE.Vector3(position.x, 0, position.z),
        fallbackOrigin: origin,
      },
    ]);

    console.log("chestPotionDropped", {
      itemId: CHEST_REWARD.potionDropItemId,
      chancePercent: CHEST_REWARD.potionDropChancePercent,
    });
  }

  rollPotionDrop() {
    const value = Math.random() * 100;

    return {
      value: Number(value.toFixed(2)),
      success: value < CHEST_REWARD.potionDropChancePercent,
    };
  }

  // =========================
  // COINS FROM CHEST
  // =========================
  spawnCoins(chest) {
    const coins = [];
    const coinReward = getCoinReward(COIN_REWARD_SOURCE.CHEST);
    const count = Math.max(0, coinReward.count ?? 0);

    const origin = chest.model.position;

    const forward = new THREE.Vector3(0, 0, 1)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), chest.model.rotation.y)
      .normalize();

    const right = new THREE.Vector3(forward.z, 0, -forward.x);

    for (let i = 0; i < count; i++) {
      const centered = i - (count - 1) / 2;

      const sideOffset = centered * 0.42 + (Math.random() * 0.18 - 0.09);
      const forwardOffset =
        coinReward.radius + 0.45 + (Math.abs(centered) % 2) * 0.14 + (Math.random() * 0.2 - 0.1);

      const position = origin
        .clone()
        .addScaledVector(forward, forwardOffset)
        .addScaledVector(right, sideOffset);

      coins.push({
        value: coinReward.value,
        position: new THREE.Vector3(position.x, 0, position.z),
        fallbackOrigin: origin.clone(),
      });
    }

    if (this.scene.coinManager) {
      this.scene.coinManager.addCoinDrops(coins);
    } else {
      // fallback: try old API if coinManager not yet initialized
      if (typeof this.scene.addCoinDrops === 'function') this.scene.addCoinDrops(coins);
    }
  }

  // =========================
  // COIN UPDATE
  // =========================


  // =========================
  // CREATE CHEST MODEL
  // =========================
  createChestModel(modelId = DEFAULT_CHEST_MODEL_ID) {
    if (typeof this.scene.cloneGameModel === "function") {
      try {
        const cloned = this.scene.cloneGameModel(modelId);
        if (cloned) return cloned;
      } catch (e) {
        console.warn(`Chest model ${modelId} clone failed:`, e);
      }
    }

    console.warn(`Chest model ${modelId} is not loaded. Using fallback.`);
    return new THREE.Group();
  }

  // =========================
  // CLEAN
  // =========================
  clear() {
    for (const chest of this.chests) {
      chest.model.removeFromParent();
    }

    if (this.scene.coinManager) {
      this.scene.coinManager.clear();
    }

    if (this.scene.itemDropManager) {
      this.scene.itemDropManager.clear();
    }

    this.chests = [];
  }
}
