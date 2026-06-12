import * as THREE from "three";
import {
  ITEM_RARITIES,
  getItemDefinition,
  getItemIdsByRarity,
} from "../CharacterData/itemDefinitions.js";
import {
  createItemInstance,
  getItemDisplayName,
} from "./ItemInstanceFactory.js";
import { createSeededRandom } from "./Utils.js";

const DEFAULT_EPIC_CHEST_REWARD = {
  choiceCount: 3,
  possibleItemIds: [],
  rarityWeights: {
    [ITEM_RARITIES.RARE]: 45,
    [ITEM_RARITIES.EPIC]: 55,
  },
};

export class EpicChestRewardManager {
  constructor(scene) {
    this.scene = scene;
    this.pendingChest = null;
  }

  openChest(chest) {
    if (!this.scene?.hud || !this.scene?.inventory) return false;

    const options = this.createRewardOptions(chest);
    if (options.length === 0) {
      this.scene.addLog?.("The epic chest is empty.");
      return false;
    }

    this.pendingChest = chest;
    this.scene.setPlayerControlLocked?.(true, "epicChestReward");
    this.scene.hud.showEpicChestRewards?.(
      options,
      (option) => {
        this.selectReward(option);
      },
      () => {
        this.cancelRewardSelection({ hideOverlay: false, restoreChest: true });
      }
    );
    return true;
  }

  selectReward(option) {
    if (!option?.itemId || !this.scene?.inventory) return;

    const itemToPickup = option.itemInstance ?? option.itemId;
    const pickupBlockReason = this.scene.inventory.getPickupBlockReason?.(itemToPickup);
    if (pickupBlockReason === "slotOccupied") {
      this.requestRewardSwap(option);
      return;
    }

    if (pickupBlockReason) {
      this.scene.handleGameEvents?.([
        {
          type: "itemPickupBlocked",
          itemId: option.itemId,
          item: option.item,
          itemInstance: option.itemInstance,
          reason: pickupBlockReason,
          foodCategory: option.itemInstance?.foodCategory,
        },
      ]);
      return;
    }

    const picked = this.scene.inventory.pickupItem(itemToPickup, {
      source: "epicChest",
      chest: this.pendingChest,
      enemies: this.scene.enemies,
    });

    if (!picked) return;

    this.scene.flushInventoryEvents?.();
    this.scene.updateHud?.();
    this.scene.hud?.hideEpicChestRewards?.();
    this.scene.setPlayerControlLocked?.(false, "epicChestReward");
    this.scene.addLog?.(`Epic reward chosen: ${getItemDisplayName(option.item)}.`);
    this.pendingChest = null;
  }

  requestRewardSwap(option) {
    const itemToPickup = option.itemInstance ?? option.itemId;
    const candidate = this.scene.inventory.getReplacementCandidate?.(itemToPickup);
    if (!candidate?.previousItem || !candidate?.itemInstance) {
      this.scene.handleGameEvents?.([
        {
          type: "itemPickupBlocked",
          itemId: option.itemId,
          item: option.item,
          itemInstance: option.itemInstance,
          reason: "slotOccupied",
          foodCategory: option.itemInstance?.foodCategory,
        },
      ]);
      return;
    }

    const opened = this.scene.requestItemSwapConfirmation?.({
      currentItem: candidate.previousItem,
      newItem: candidate.itemInstance,
      onConfirm: () => this.confirmRewardSwap(option, candidate.itemInstance),
    });

    if (!opened) {
      this.scene.handleGameEvents?.([
        {
          type: "itemPickupBlocked",
          itemId: option.itemId,
          item: option.item,
          itemInstance: option.itemInstance,
          reason: "slotOccupied",
          foodCategory: option.itemInstance?.foodCategory,
        },
      ]);
    }
  }

  confirmRewardSwap(option, itemInstance) {
    const result = this.scene.inventory.replaceEquippedItem(itemInstance, {
      source: "epicChestSwap",
      chest: this.pendingChest,
      enemies: this.scene.enemies,
    });

    if (!result.success) return;

    this.dropPreviousItem(result.previousItem);
    this.scene.flushInventoryEvents?.();
    this.scene.updateHud?.();
    this.scene.hud?.hideEpicChestRewards?.();
    this.scene.setPlayerControlLocked?.(false, "epicChestReward");
    this.scene.addLog?.(`Epic reward chosen: ${getItemDisplayName(option.item)}.`);
    this.pendingChest = null;
  }

  dropPreviousItem(previousItem) {
    if (!previousItem || !this.scene.itemDropManager) return;

    const playerPosition = this.scene.player?.model?.position?.clone?.();
    const chestPosition = this.pendingChest?.model?.position?.clone?.();
    const origin = playerPosition ?? chestPosition;
    const position = chestPosition ?? playerPosition;
    if (!origin || !position) return;

    this.scene.itemDropManager.addItemDrops([
      {
        itemId: previousItem.baseItemId,
        itemInstance: previousItem,
        position: new THREE.Vector3(position.x, 0, position.z),
        fallbackOrigin: origin,
        source: "equipmentSwap",
      },
    ]);
  }

  cancelRewardSelection({ hideOverlay = true, restoreChest = false } = {}) {
    const chest = this.pendingChest;
    this.pendingChest = null;

    if (hideOverlay) {
      this.scene?.hud?.hideEpicChestRewards?.();
    }

    if (restoreChest && chest) {
      this.scene?.chestManager?.recloseChest?.(chest);
      this.scene?.addLog?.("Epic chest closed.");
    }

    this.scene?.setPlayerControlLocked?.(false, "epicChestReward");
  }

  cancel() {
    this.cancelRewardSelection({ hideOverlay: true, restoreChest: false });
  }

  createRewardOptions(chest) {
    const config = {
      ...DEFAULT_EPIC_CHEST_REWARD,
      ...(chest?.epicRewardConfig ?? {}),
    };
    const choiceCount = Math.max(1, Math.floor(config.choiceCount ?? 3));
    const fallbackIds = this.getFallbackCandidateItemIds(config);
    if (fallbackIds.length === 0) return [];

    const options = [];
    const random = createSeededRandom(this.createRewardSeed(chest));
    const usedItemIds = new Set();

    for (let index = 0; index < choiceCount; index += 1) {
      const itemId = this.pickRewardItemId(config, fallbackIds, random, usedItemIds);
      const itemInstance = createItemInstance(itemId, {
        runSeed: this.scene.currentFloorLoad?.runSeed,
        floorSeed: this.scene.currentFloorLoad?.currentFloorSeed,
        floorIndex: this.scene.currentFloorLoad?.currentFloorIndex,
        sourceKind: "epicChest",
        sourceId: this.getChestSourceId(chest),
        roomId: chest?.roomId,
        optionIndex: index,
        rarity: config.displayRarity ?? getItemDefinition(itemId)?.rarity,
      });
      if (!itemInstance) continue;
      usedItemIds.add(itemInstance.baseItemId);

      options.push({
        id: `${chest?.roomId ?? "epic"}:${index}:${itemInstance.baseItemId}`,
        itemId: itemInstance.baseItemId,
        item: itemInstance,
        itemInstance,
        rarity: itemInstance.rarity ?? ITEM_RARITIES.EPIC,
      });
    }

    return options;
  }

  pickRewardItemId(config, fallbackIds, random = Math.random, usedItemIds = new Set()) {
    const rarityPools = this.getRarityPools(config);
    const weightedRarities = Object.entries(config.rarityWeights ?? {})
      .map(([rarity, weight]) => ({
        rarity,
        weight: Math.max(0, Number.parseFloat(weight) || 0),
        pool: this.getAvailableRewardPool(rarityPools[rarity] ?? [], usedItemIds),
      }))
      .filter((entry) => entry.weight > 0 && entry.pool.length > 0);
    const totalWeight = weightedRarities.reduce((sum, entry) => sum + entry.weight, 0);

    if (totalWeight > 0) {
      let cursor = 0;
      const roll = random() * totalWeight;

      for (const entry of weightedRarities) {
        cursor += entry.weight;
        if (roll <= cursor) {
          return entry.pool[Math.floor(random() * entry.pool.length)];
        }
      }
    }

    const fallbackPool = this.getAvailableRewardPool(fallbackIds, usedItemIds);
    const pool = fallbackPool.length > 0 ? fallbackPool : fallbackIds;

    return pool[Math.floor(random() * pool.length)];
  }

  getAvailableRewardPool(itemIds = [], usedItemIds = new Set()) {
    const available = itemIds.filter((itemId) => !usedItemIds.has(itemId));

    return available.length > 0 ? available : itemIds;
  }

  getRarityPools(config) {
    const possibleIds = (config.possibleItemIds ?? [])
      .filter((itemId) => Boolean(getItemDefinition(itemId)));
    const sourceIds = possibleIds.length > 0
      ? possibleIds
      : [
          ...getItemIdsByRarity(ITEM_RARITIES.EPIC),
          ...getItemIdsByRarity(ITEM_RARITIES.RARE),
        ];

    return Object.fromEntries(
      Object.values(ITEM_RARITIES).map((rarity) => [
        rarity,
        sourceIds.filter((itemId) => getItemDefinition(itemId)?.rarity === rarity),
      ])
    );
  }

  getFallbackCandidateItemIds(config) {
    const explicitIds = (config.possibleItemIds ?? [])
      .filter((itemId) => Boolean(getItemDefinition(itemId)));

    if (explicitIds.length > 0) return explicitIds;

    return [
      ...getItemIdsByRarity(ITEM_RARITIES.EPIC),
      ...getItemIdsByRarity(ITEM_RARITIES.RARE),
    ];
  }

  createRewardSeed(chest) {
    return [
      this.scene.currentFloorLoad?.runSeed ?? "run",
      this.scene.currentFloorLoad?.currentFloorSeed ?? "floor",
      this.scene.currentFloorLoad?.currentFloorIndex ?? "x",
      "epicChest",
      this.getChestSourceId(chest),
      "choices",
    ].join(":");
  }

  getChestSourceId(chest) {
    return [
      chest?.roomId ?? "room",
      chest?.spawnIndex ?? "x",
      chest?.chestType ?? "epic",
    ].join(":");
  }
}
