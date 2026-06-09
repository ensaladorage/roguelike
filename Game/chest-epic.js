import {
  ITEM_RARITIES,
  getItemDefinition,
  getItemIdsByRarity,
} from "../CharacterData/itemDefinitions.js";

const DEFAULT_EPIC_CHEST_REWARD = {
  choiceCount: 3,
  possibleItemIds: ["ramen", "energyDrink"],
  rarityWeights: {
    [ITEM_RARITIES.RARE]: 45,
    [ITEM_RARITIES.EPIC]: 55,
  },
  displayRarity: ITEM_RARITIES.EPIC,
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
    this.scene.hud.showEpicChestRewards?.(options, (option) => {
      this.selectReward(option);
    });
    return true;
  }

  selectReward(option) {
    if (!option?.itemId || !this.scene?.inventory) return;

    if (!this.scene.inventory.canPickupItem(option.itemId)) {
      this.scene.handleGameEvents?.([
        {
          type: "itemPickupBlocked",
          itemId: option.itemId,
          item: option.item,
          reason: "inventoryFull",
        },
      ]);
      return;
    }

    const picked = this.scene.inventory.pickupItem(option.itemId, {
      source: "epicChest",
      chest: this.pendingChest,
      enemies: this.scene.enemies,
    });

    if (!picked) return;

    this.scene.flushInventoryEvents?.();
    this.scene.updateHud?.();
    this.scene.hud?.hideEpicChestRewards?.();
    this.scene.setPlayerControlLocked?.(false, "epicChestReward");
    this.scene.addLog?.(`Epic reward chosen: ${option.item.name}.`);
    this.pendingChest = null;
  }

  cancel() {
    this.pendingChest = null;
    this.scene?.hud?.hideEpicChestRewards?.();
    this.scene?.setPlayerControlLocked?.(false, "epicChestReward");
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

    for (let index = 0; index < choiceCount; index += 1) {
      const itemId = this.pickRewardItemId(config, fallbackIds);
      const item = getItemDefinition(itemId);
      if (!item) continue;

      options.push({
        id: `${chest?.roomId ?? "epic"}:${index}:${item.id}`,
        itemId: item.id,
        item,
        rarity: config.displayRarity ?? item.rarity ?? ITEM_RARITIES.EPIC,
      });
    }

    return options;
  }

  pickRewardItemId(config, fallbackIds) {
    const rarityPools = this.getRarityPools(config);
    const weightedRarities = Object.entries(config.rarityWeights ?? {})
      .map(([rarity, weight]) => ({
        rarity,
        weight: Math.max(0, Number.parseFloat(weight) || 0),
        pool: rarityPools[rarity] ?? [],
      }))
      .filter((entry) => entry.weight > 0 && entry.pool.length > 0);
    const totalWeight = weightedRarities.reduce((sum, entry) => sum + entry.weight, 0);

    if (totalWeight > 0) {
      let cursor = 0;
      const roll = Math.random() * totalWeight;

      for (const entry of weightedRarities) {
        cursor += entry.weight;
        if (roll <= cursor) {
          return entry.pool[Math.floor(Math.random() * entry.pool.length)];
        }
      }
    }

    return fallbackIds[Math.floor(Math.random() * fallbackIds.length)];
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
}
