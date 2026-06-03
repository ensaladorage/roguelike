import * as THREE from "three";
import { flatDistance } from "./Utils.js";
import {
  COFFIN_CHEST_MODEL_ID,
  DEFAULT_CHEST_MODEL_ID,
} from "../CharacterData/modelDefinitions.js";
import { getEnemyDefinition } from "../CharacterData/enemyDefinitions.js";
import {
  ITEM_RARITIES,
  getItemIdsByRarity,
} from "../CharacterData/itemDefinitions.js";
import { splitCoinValueIntoTypes } from "./Coin.js";

export const CHEST_REWARD = {
  itemChancePercent: 80,
  itemRollCount: 1,
  progressionMinFloor: 1,
  progressionMaxFloor: 10,
  rarityChancePercentByFloor: {
    [ITEM_RARITIES.COMMON]: {
      floor1: 88,
      floor10: 55,
    },
    [ITEM_RARITIES.RARE]: {
      floor1: 10,
      floor10: 32,
    },
    [ITEM_RARITIES.EPIC]: {
      floor1: 2,
      floor10: 13,
    },
  },
};

export const CHEST_COIN_DROP = {
  totalValueMin: 20,
  totalValueMax: 30,
  radius: 0.62,
};

export const CHEST_TYPES = {
  STANDARD: "standard",
  MIMIC_COFFIN: "mimicCoffin",
};

export const MIMIC_COFFIN_CONFIG = {
  modelId: COFFIN_CHEST_MODEL_ID,
  minFloorIndex: 4,
  optionalSpawnChancePercent: 30,
  vampireChancePercent: 25,
  vampireEnemyTypeId: "enemy_vampire_01",
  triggerRange: 1.35,
  spawnAdjacentToPlayerDistance: 0.85,
  spawnForwardOffset: 0.9,
  loot: {
    coinDrop: {
      totalValueMin: 45,
      totalValueMax: 70,
      radius: 0.75,
    },
    potionDrop: {
      itemId: "energyDrink",
      chancePercent: 35,
      radius: 0.82,
    },
  },
  vampireLootOverrides: {
    coinDrop: {
      totalValueMin: 18,
      totalValueMax: 32,
      radius: 0.8,
    },
    potionDrop: {
      itemId: "energyDrink",
      chancePercent: 30,
      radius: 0.82,
    },
  },
};

export function getChestReward(overrides = {}, context = {}) {
  const rewardConfig = {
    ...CHEST_REWARD,
    ...overrides,
    rarityChancePercentByFloor: mergeRarityChanceConfig(
      CHEST_REWARD.rarityChancePercentByFloor,
      overrides.rarityChancePercentByFloor ?? overrides.rarityWeightsByFloor
    ),
  };
  const itemIds = rollChestItems(rewardConfig, context);

  return {
    itemIds,
  };
}

function rollChestItems(rewardConfig, context = {}) {
  const progressFloor = getRewardProgressFloor(rewardConfig, context);
  const rollCount = Math.max(0, Math.floor(rewardConfig.itemRollCount ?? 0));
  const itemIds = [];

  for (let rollIndex = 0; rollIndex < rollCount; rollIndex += 1) {
    const itemDropRoll = rollPercentChance(rewardConfig.itemChancePercent);
    const rarityRoll = itemDropRoll.success
      ? rollChestRarity(rewardConfig, progressFloor)
      : null;
    const itemPool = rarityRoll
      ? getChestItemPoolForRarity(rewardConfig, rarityRoll.rarity)
      : [];
    const itemId = itemPool.length > 0
      ? itemPool[Math.floor(Math.random() * itemPool.length)]
      : null;

    console.log("chestItemDropRoll", {
      rollIndex,
      itemId,
      rarity: rarityRoll?.rarity ?? null,
      progressFloor,
      rarityChancePercent: rarityRoll?.chances ?? null,
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

function getRewardProgressFloor(rewardConfig, context = {}) {
  const minFloor = rewardConfig.progressionMinFloor ?? 1;
  const maxFloor = rewardConfig.progressionMaxFloor ?? 10;
  const rawFloor = context.floorIndex ?? context.progressFloor ?? minFloor;
  const numericFloor = Number.parseFloat(rawFloor);

  if (!Number.isFinite(numericFloor)) return minFloor;

  return Math.max(minFloor, Math.min(maxFloor, numericFloor));
}

function rollChestRarity(rewardConfig, progressFloor) {
  const chances = getChestRarityChances(rewardConfig, progressFloor);
  const totalChance = Object.values(chances).reduce(
    (sum, chance) => sum + chance,
    0
  );

  if (totalChance <= 0) {
    return {
      rarity: ITEM_RARITIES.COMMON,
      chances,
      roll: 0,
    };
  }

  const roll = Math.random() * totalChance;
  let cursor = 0;

  for (const rarity of Object.values(ITEM_RARITIES)) {
    cursor += chances[rarity] ?? 0;

    if (roll <= cursor) {
      return {
        rarity,
        chances,
        roll: Number(roll.toFixed(2)),
      };
    }
  }

  return {
    rarity: ITEM_RARITIES.COMMON,
    chances,
    roll: Number(roll.toFixed(2)),
  };
}

function getChestRarityChances(rewardConfig, progressFloor) {
  return Object.fromEntries(
    Object.values(ITEM_RARITIES).map((rarity) => [
      rarity,
      getProgressiveRarityChance(rewardConfig, rarity, progressFloor),
    ])
  );
}

function getProgressiveRarityChance(rewardConfig, rarity, progressFloor) {
  const chanceConfig =
    rewardConfig.rarityChancePercentByFloor?.[rarity] ??
    rewardConfig.rarityWeightsByFloor?.[rarity] ??
    0;

  if (typeof chanceConfig === "number") return normalizePercentChance(chanceConfig);

  const minFloor = rewardConfig.progressionMinFloor ?? 1;
  const maxFloor = rewardConfig.progressionMaxFloor ?? 10;
  const startChance = Number.parseFloat(chanceConfig.floor1 ?? chanceConfig.start ?? 0);
  const endChance = Number.parseFloat(chanceConfig.floor10 ?? chanceConfig.end ?? startChance);
  const safeStart = Number.isFinite(startChance) ? startChance : 0;
  const safeEnd = Number.isFinite(endChance) ? endChance : safeStart;
  const progress =
    maxFloor === minFloor
      ? 1
      : (progressFloor - minFloor) / (maxFloor - minFloor);

  return normalizePercentChance(safeStart + (safeEnd - safeStart) * progress);
}

function getChestItemPoolForRarity(rewardConfig, rarity) {
  return rewardConfig.itemPoolsByRarity?.[rarity] ?? getItemIdsByRarity(rarity);
}

function mergeRarityChanceConfig(defaultConfig, overrideConfig = {}) {
  return Object.fromEntries(
    Object.values(ITEM_RARITIES).map((rarity) => [
      rarity,
      {
        ...(defaultConfig?.[rarity] ?? {}),
        ...(overrideConfig?.[rarity] ?? {}),
      },
    ])
  );
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
      const animation = this.createChestAnimation(model);

      model.position.set(data.x, 0, data.z);
      model.rotation.y = data.rotationY;
      model.userData.interactable = {
        type: "chest",
      };
      this.applySpawnScale(model, data);

      this.scene.levelGroup.add(model);

      return {
        model,
        animation,
        roomId: data.roomId,
        roomTemplateId: data.roomTemplateId,
        chestType: data.chestType ?? CHEST_TYPES.STANDARD,
        triggerRange: data.triggerRange,
        mimicConfig: data.mimicConfig,
        rewardOverrides: data.rewardOverrides,
        collected: false,
      };
    });
  }

  // =========================
  // UPDATE LOOP ENTRY POINT
  // =========================
  update(delta = 0) {
    for (const chest of this.chests) {
      chest.animation?.mixer?.update(delta);
    }

    this.checkChestProximity();
  }

  // =========================
  // PROXIMITY CHECK
  // =========================
  checkChestProximity() {
    const playerPos = this.scene.player.model.position;

    for (const chest of this.chests) {
      if (chest.collected) continue;
      if (chest.model?.visible === false) continue;

      const distance = flatDistance(playerPos, chest.model.position);

      const triggerRange = chest.triggerRange ?? 1.25;

      if (distance <= triggerRange) {
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

    if (!this.playChestOpenAnimation(chest)) {
      const lid = chest.model.getObjectByName("lid");
      if (lid) lid.rotation.x = -0.85;
    }

    if (this.isMimicCoffin(chest)) {
      this.resolveMimicCoffin(chest);
    } else {
      this.spawnCoins(chest);
      this.collectChestItem(chest);
      this.scene.addLog("Chest opened.");
    }

    this.scene.updateHud();

    this.scene.sfx.play("chest");
  }

  isMimicCoffin(chest) {
    return chest.chestType === CHEST_TYPES.MIMIC_COFFIN;
  }

  resolveMimicCoffin(chest) {
    const config = this.getMimicConfig(chest);
    const vampireRoll = rollPercentChance(config.vampireChancePercent);

    console.log("mimicCoffinRoll", {
      chancePercent: config.vampireChancePercent,
      roll: vampireRoll.value,
      spawnedVampire: vampireRoll.success,
    });

    if (vampireRoll.success) {
      const enemy = this.spawnMimicVampire(chest, config);
      if (enemy) {
        this.scene.addLog("The sarcophagus opens. A Vampire awakens!");
        return;
      }
    }

    this.spawnMimicLoot(chest, config);
    this.scene.addLog("The sarcophagus opens. Treasure spills out.");
  }

  getMimicConfig(chest) {
    return {
      ...MIMIC_COFFIN_CONFIG,
      ...(chest.mimicConfig ?? {}),
      loot: {
        ...MIMIC_COFFIN_CONFIG.loot,
        ...(chest.mimicConfig?.loot ?? {}),
        coinDrop: {
          ...MIMIC_COFFIN_CONFIG.loot.coinDrop,
          ...(chest.mimicConfig?.loot?.coinDrop ?? {}),
        },
        potionDrop: {
          ...MIMIC_COFFIN_CONFIG.loot.potionDrop,
          ...(chest.mimicConfig?.loot?.potionDrop ?? {}),
        },
      },
      vampireLootOverrides: {
        ...MIMIC_COFFIN_CONFIG.vampireLootOverrides,
        ...(chest.mimicConfig?.vampireLootOverrides ?? {}),
        coinDrop: {
          ...MIMIC_COFFIN_CONFIG.vampireLootOverrides.coinDrop,
          ...(chest.mimicConfig?.vampireLootOverrides?.coinDrop ?? {}),
        },
        potionDrop: {
          ...MIMIC_COFFIN_CONFIG.vampireLootOverrides.potionDrop,
          ...(chest.mimicConfig?.vampireLootOverrides?.potionDrop ?? {}),
        },
      },
    };
  }

  spawnMimicLoot(chest, config) {
    this.spawnCoins(chest, config.loot.coinDrop);
    this.spawnPotionDrop(chest, config.loot.potionDrop);
  }

  spawnMimicVampire(chest, config) {
    const definition = getEnemyDefinition(config.vampireEnemyTypeId);
    if (!definition || typeof this.scene.spawnRuntimeEnemy !== "function") {
      console.warn("Mimic vampire could not spawn.", {
        vampireEnemyTypeId: config.vampireEnemyTypeId,
      });
      return null;
    }

    const position = this.getEnemySpawnPosition(chest, {
      collisionRadius: definition.collisionRadius,
      adjacentToPlayerDistance: config.spawnAdjacentToPlayerDistance,
      forwardOffset: config.spawnForwardOffset,
    });
    const enemy = this.scene.spawnRuntimeEnemy({
      x: position.x,
      z: position.z,
      rotationY: chest.model.rotation.y,
      enemyTypeId: definition.id,
      enemyName: definition.name,
      enemyDifficulty: definition.difficulty,
      modelId: definition.modelId,
      maxHp: definition.maxHp,
      hp: definition.hp ?? definition.maxHp,
      speed: definition.speed,
      attackDamage: definition.attackDamage,
      attackRange: definition.attackRange,
      attackCooldown: definition.attackCooldown,
      collisionRadius: definition.collisionRadius,
      patrolStopRange: definition.patrolStopRange,
      patrolMoveDuration: definition.patrolMoveDuration,
      patrolPauseDurations: definition.patrolPauseDurations,
      coinDrop: config.vampireLootOverrides.coinDrop,
      potionDrop: config.vampireLootOverrides.potionDrop,
      patrol: [{ x: position.x, z: position.z }],
      patrolAreas: chest.roomId
        ? this.scene.walkableAreas.filter((area) => area.roomId === chest.roomId)
        : [],
      roomId: chest.roomId,
      roomTemplateId: chest.roomTemplateId,
    });

    console.log("mimicVampireSpawned", {
      enemyTypeId: definition.id,
      position: { x: position.x, z: position.z },
      roomId: chest.roomId,
      roomTemplateId: chest.roomTemplateId,
    });

    return enemy;
  }

  getEnemySpawnPosition(chest, options = {}) {
    const adjacentToPlayer = this.getAdjacentPlayerSpawnPosition(options);
    if (adjacentToPlayer) return adjacentToPlayer;

    const origin = chest.model.position.clone();
    const forward = this.getChestForward(chest);
    const preferred = origin
      .clone()
      .addScaledVector(forward, options.forwardOffset ?? 0.9);
    const radius = options.collisionRadius ?? 0.32;

    preferred.y = 0;

    if (this.scene.isWalkablePosition?.(preferred, radius)) {
      return preferred;
    }

    const navCell = this.scene.getNearestWalkableNavCell?.(preferred, radius, {
      maxRing: 3,
    });

    if (navCell && typeof this.scene.navCellToWorld === "function") {
      return this.scene.navCellToWorld(navCell);
    }

    return origin;
  }

  getAdjacentPlayerSpawnPosition(options = {}) {
    const playerPosition = this.scene.player?.model?.position;
    if (!playerPosition) return null;

    const radius = options.collisionRadius ?? 0.32;
    const distance = options.adjacentToPlayerDistance ?? 0.85;
    const directions = [
      { x: 1, z: 0 },
      { x: -1, z: 0 },
      { x: 0, z: 1 },
      { x: 0, z: -1 },
      { x: 1, z: 1 },
      { x: -1, z: 1 },
      { x: 1, z: -1 },
      { x: -1, z: -1 },
    ];
    const candidates = directions.map((direction) => {
      const length = Math.hypot(direction.x, direction.z) || 1;

      return new THREE.Vector3(
        playerPosition.x + (direction.x / length) * distance,
        0,
        playerPosition.z + (direction.z / length) * distance
      );
    });

    candidates.sort(
      (a, b) =>
        flatDistance(a, this.scene.player.model.position) -
        flatDistance(b, this.scene.player.model.position)
    );

    for (const candidate of candidates) {
      if (!this.scene.isWalkablePosition?.(candidate, radius)) continue;
      if (this.scene.movementHitsWall?.(playerPosition, candidate, radius)) continue;

      return candidate;
    }

    return null;
  }

  spawnPotionDrop(chest, potionDropConfig = {}) {
    const roll = rollPercentChance(potionDropConfig.chancePercent);

    console.log("mimicCoffinPotionDropRoll", {
      itemId: potionDropConfig.itemId,
      chancePercent: potionDropConfig.chancePercent,
      roll: roll.value,
      spawned: roll.success,
    });

    if (!roll.success || !potionDropConfig.itemId) return;

    const origin = chest.model.position.clone();
    const position = origin
      .clone()
      .addScaledVector(this.getChestForward(chest), potionDropConfig.radius ?? 0.82);

    if (this.scene.itemDropManager) {
      this.scene.itemDropManager.addItemDrops([
        {
          itemId: potionDropConfig.itemId,
          position: new THREE.Vector3(position.x, 0, position.z),
          fallbackOrigin: origin.clone(),
        },
      ]);
    }
  }

  collectChestItem(chest) {
    if (!this.scene.inventory) return;

    const reward = getChestReward(chest.rewardOverrides, {
      floorIndex: this.getRewardProgressFloor(),
    });
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

  getRewardProgressFloor() {
    return (
      this.scene.currentFloorLoad?.currentFloorIndex ??
      this.scene.levelIndex ??
      1
    );
  }

  // =========================
  // COINS FROM CHEST
  // =========================
  spawnCoins(chest, coinDropConfig = CHEST_COIN_DROP) {
    const config = {
      ...CHEST_COIN_DROP,
      ...(coinDropConfig ?? {}),
    };
    const coins = [];
    const totalValue = rollIntegerRange(
      config.totalValueMin,
      config.totalValueMax
    );
    const coinTypes = splitCoinValueIntoTypes(totalValue);
    const count = coinTypes.length;

    const origin = chest.model.position;

    const forward = this.getChestForward(chest);

    const right = new THREE.Vector3(forward.z, 0, -forward.x);

    for (let i = 0; i < count; i++) {
      const coinType = coinTypes[i];
      const centered = i - (count - 1) / 2;

      const sideOffset = centered * 0.42 + (Math.random() * 0.18 - 0.09);
      const forwardOffset =
        config.radius +
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
      totalValueMin: config.totalValueMin,
      totalValueMax: config.totalValueMax,
    });

    if (this.scene.coinManager) {
      this.scene.coinManager.addCoinDrops(coins);
    } else {
      // fallback: try old API if coinManager not yet initialized
      if (typeof this.scene.addCoinDrops === 'function') this.scene.addCoinDrops(coins);
    }
  }

  getChestForward(chest) {
    return new THREE.Vector3(0, 0, 1)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), chest.model.rotation.y)
      .normalize();
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

  applySpawnScale(model, data = {}) {
    const scaleOverride = data.scale ?? data.scaleMultiplier;
    if (scaleOverride === undefined) return;

    if (typeof scaleOverride === "number") {
      model.scale.multiplyScalar(scaleOverride);
      return;
    }

    model.scale.set(
      model.scale.x * (scaleOverride.x ?? 1),
      model.scale.y * (scaleOverride.y ?? 1),
      model.scale.z * (scaleOverride.z ?? 1)
    );
  }

  createChestAnimation(model) {
    const clips = model.userData.animations ?? [];
    if (clips.length === 0) return null;

    const definition = model.userData.modelDefinition ?? {};
    const openClip =
      clips.find((clip) => clip.name === definition.openAnimationName) ??
      clips[definition.openAnimationIndex] ??
      clips[1] ??
      null;

    if (!openClip) return null;

    const mixer = new THREE.AnimationMixer(model);
    const action = mixer.clipAction(openClip);

    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;

    return {
      mixer,
      action,
      clipName: openClip.name,
    };
  }

  playChestOpenAnimation(chest) {
    const action = chest.animation?.action;
    if (!action) return false;

    action.reset();
    action.play();

    console.log("chestOpenAnimation", {
      clipName: chest.animation.clipName,
    });

    return true;
  }

  // =========================
  // CLEAN
  // =========================
  clear() {
    for (const chest of this.chests) {
      chest.animation?.mixer?.stopAllAction();
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
