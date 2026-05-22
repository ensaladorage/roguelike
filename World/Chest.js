import * as THREE from "three";
import { flatDistance } from "../Game/Utils.js";
import { DEFAULT_CHEST_MODEL_ID } from "../Data/modelDefinitions.js";
import { splitCoinValueIntoTypes } from "./Coin.js";

export const CHEST_REWARD = {
  itemChancePercent: 80,
  itemRollCount: 1,
  itemPool: [
    "steak",
    "chili",
    "ramen",
    "purpleShroom",
  ],
  potionDropItemId: "energyDrink",
  potionDropChancePercent: 20,
  potionDropRadius: 0.9,
};

export const CHEST_COIN_DROP = {
  totalValueMin: 20,
  totalValueMax: 30,
  radius: 0.62,
};

export function getChestReward(overrides = {}) {
  const rewardConfig = {
    ...CHEST_REWARD,
    ...overrides,
  };
  const itemIds = rollChestItems(rewardConfig);

  return {
    itemIds,
  };
}

function rollChestItems(rewardConfig) {
  const itemPool = rewardConfig.itemPool ?? [];
  const rollCount = Math.max(0, Math.floor(rewardConfig.itemRollCount ?? 0));
  const itemIds = [];

  for (let rollIndex = 0; rollIndex < rollCount; rollIndex += 1) {
    const itemDropRoll = rollPercentChance(rewardConfig.itemChancePercent);
    const itemId =
      itemPool.length > 0 && itemDropRoll.success
        ? itemPool[Math.floor(Math.random() * itemPool.length)]
        : null;

    console.log("chestItemDropRoll", {
      rollIndex,
      itemId,
      chancePercent: rewardConfig.itemChancePercent,
      roll: itemDropRoll.value,
      spawned: Boolean(itemId),
    });

    if (itemId) {
      itemIds.push(itemId);
    }
  }

  return itemIds;
}

function rollPercentChance(chancePercent) {
  const safeChancePercent = normalizePercentChance(chancePercent);
  const value = Math.random() * 100;

  return {
    value: Number(value.toFixed(2)),
    success: value < safeChancePercent,
  };
}

function normalizePercentChance(chancePercent) {
  const numericChance = Number.parseFloat(chancePercent);

  if (!Number.isFinite(numericChance)) return 0;

  return Math.max(0, Math.min(100, numericChance));
}

function rollIntegerRange(min, max) {
  const safeMin = Math.ceil(Math.min(min, max));
  const safeMax = Math.floor(Math.max(min, max));

  return safeMin + Math.floor(Math.random() * (safeMax - safeMin + 1));
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

      return {
        model,
        rewardOverrides: data.rewardOverrides,
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
    if (chest.collected) return;

    chest.collected = true;

    const lid = chest.model.getObjectByName("lid");
    if (lid) lid.rotation.x = -0.85;

    this.spawnCoins(chest);
    this.spawnPotionDrop(chest);
    this.collectChestItem(chest);

    this.scene.updateHud();
    this.scene.addLog("Chest opened.");

    this.scene.sfx.play("chest");
  }

  collectChestItem(chest) {
    if (!this.scene.inventory) return;

    const reward = getChestReward(chest.rewardOverrides);
    const itemIds = reward.itemIds ?? [];

    console.log("chestItemsGranted", {
      count: itemIds.length,
      itemIds,
    });

    for (const itemId of itemIds) {
      this.scene.inventory.pickupItem(itemId, {
        source: "chest",
        chest,
        enemies: this.scene.enemies,
      });
    }

    if (typeof this.scene.flushInventoryEvents === "function") {
      this.scene.flushInventoryEvents();
    }
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
    return rollPercentChance(CHEST_REWARD.potionDropChancePercent);
  }

  // =========================
  // COINS FROM CHEST
  // =========================
  spawnCoins(chest) {
    const coins = [];
    const totalValue = rollIntegerRange(
      CHEST_COIN_DROP.totalValueMin,
      CHEST_COIN_DROP.totalValueMax
    );
    const coinTypes = splitCoinValueIntoTypes(totalValue);
    const count = coinTypes.length;

    const origin = chest.model.position;

    const forward = new THREE.Vector3(0, 0, 1)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), chest.model.rotation.y)
      .normalize();

    const right = new THREE.Vector3(forward.z, 0, -forward.x);

    for (let i = 0; i < count; i++) {
      const coinType = coinTypes[i];
      const centered = i - (count - 1) / 2;

      const sideOffset = centered * 0.42 + (Math.random() * 0.18 - 0.09);
      const forwardOffset =
        CHEST_COIN_DROP.radius +
        0.45 +
        (Math.abs(centered) % 2) * 0.14 +
        (Math.random() * 0.2 - 0.1);

      const position = origin
        .clone()
        .addScaledVector(forward, forwardOffset)
        .addScaledVector(right, sideOffset);

      coins.push({
        typeId: coinType.typeId,
        value: coinType.value,
        position: new THREE.Vector3(position.x, 0, position.z),
        fallbackOrigin: origin.clone(),
      });
    }

    console.log("chestCoinsDropped", {
      totalValue,
      count: coins.length,
      breakdown: coins.map((coin) => ({
        typeId: coin.typeId,
        value: coin.value,
      })),
      totalValueMin: CHEST_COIN_DROP.totalValueMin,
      totalValueMax: CHEST_COIN_DROP.totalValueMax,
    });

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
