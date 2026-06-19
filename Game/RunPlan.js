import { ENEMY_DIFFICULTY } from "../CharacterData/enemyDefinitions.js";
import { ITEM_RARITIES } from "../CharacterData/itemDefinitions.js";

export const RUN_STAGE_TYPES = Object.freeze({
  COMBAT: "combat",
  SHOP: "shop",
  BOSS: "boss",
});

const COMMON_TREASURE_REWARD = Object.freeze({
  enabled: true,
  lockedUntilStageClear: true,
  normalChestCount: Object.freeze({ min: 1, max: 2 }),
  normalItemCount: Object.freeze({ min: 1, max: 2 }),
  normalItemPool: Object.freeze(["steak", "chili", "potato", "purpleShroom"]),
  normalItemRarity: ITEM_RARITIES.COMMON,
  normalRareItemChancePercent: 30,
  normalRareItemPool: Object.freeze(["garlic", "ramen", "fish"]),
  normalChestCoinDrop: Object.freeze({ totalValueMin: 10, totalValueMax: 16 }),
  epicChest: Object.freeze({
    enabled: true,
    choiceCount: 3,
    possibleItemIds: Object.freeze([]),
    rarityWeights: Object.freeze({
      [ITEM_RARITIES.RARE]: 45,
      [ITEM_RARITIES.EPIC]: 55,
    }),
  }),
});

const ENEMY_POTION_DROP_EARLY = Object.freeze({ chancePercent: 20 });
const ENEMY_POTION_DROP_MID = Object.freeze({ chancePercent: 22 });
const ENEMY_POTION_DROP_LATE = Object.freeze({ chancePercent: 25 });

function createTreasureReward(overrides = {}) {
  return Object.freeze({
    ...COMMON_TREASURE_REWARD,
    ...overrides,
    normalChestCount: Object.freeze({
      ...COMMON_TREASURE_REWARD.normalChestCount,
      ...(overrides.normalChestCount ?? {}),
    }),
    normalItemCount: Object.freeze({
      ...COMMON_TREASURE_REWARD.normalItemCount,
      ...(overrides.normalItemCount ?? {}),
    }),
    normalItemPool: Object.freeze(
      overrides.normalItemPool ?? COMMON_TREASURE_REWARD.normalItemPool
    ),
    normalRareItemPool: Object.freeze(
      overrides.normalRareItemPool ?? COMMON_TREASURE_REWARD.normalRareItemPool
    ),
    normalChestCoinDrop: Object.freeze({
      ...COMMON_TREASURE_REWARD.normalChestCoinDrop,
      ...(overrides.normalChestCoinDrop ?? overrides.chestCoinDrop ?? {}),
    }),
    epicChest: Object.freeze({
      ...COMMON_TREASURE_REWARD.epicChest,
      ...(overrides.epicChest ?? {}),
      possibleItemIds: Object.freeze(
        overrides.epicChest?.possibleItemIds ??
        COMMON_TREASURE_REWARD.epicChest.possibleItemIds
      ),
      rarityWeights: Object.freeze({
        ...COMMON_TREASURE_REWARD.epicChest.rarityWeights,
        ...(overrides.epicChest?.rarityWeights ?? {}),
      }),
    }),
  });
}

export const SHOP_TIERS = Object.freeze({
  1: Object.freeze({
    tier: 1,
    offerCount: 2,
    possibleItemIds: Object.freeze([
      "ramen",
      "fish",
      "garlic",
      "iceCream",
      "dragonSteak",
      "spicySauce",
      "dragonFruit",
    ]),
    priceMultiplier: 0.95,
    rarityWeights: Object.freeze({
      [ITEM_RARITIES.RARE]: 85,
      [ITEM_RARITIES.EPIC]: 15,
    }),
    healing: Object.freeze({
      enabled: false,
      healAmount: 0,
      uses: 0,
    }),
  }),
  2: Object.freeze({
    tier: 2,
    offerCount: 3,
    possibleItemIds: Object.freeze([
      "ramen",
      "fish",
      "garlic",
      "iceCream",
      "dragonSteak",
      "spicySauce",
      "dragonFruit",
    ]),
    priceMultiplier: 1,
    rarityWeights: Object.freeze({
      [ITEM_RARITIES.RARE]: 70,
      [ITEM_RARITIES.EPIC]: 30,
    }),
    healing: Object.freeze({
      enabled: true,
      healAmount: 25,
      uses: 1,
    }),
  }),
  3: Object.freeze({
    tier: 3,
    offerCount: 3,
    possibleItemIds: Object.freeze([
      "ramen",
      "fish",
      "garlic",
      "iceCream",
      "dragonSteak",
      "spicySauce",
      "dragonFruit",
    ]),
    priceMultiplier: 1.1,
    rarityWeights: Object.freeze({
      [ITEM_RARITIES.RARE]: 55,
      [ITEM_RARITIES.EPIC]: 45,
    }),
    healing: Object.freeze({
      enabled: true,
      healAmount: 45,
      uses: 1,
    }),
  }),
});

export const RUN_PLAN = Object.freeze({
  id: "short-finite-run-v1",
  stages: Object.freeze([
    Object.freeze({
      stageIndex: 1,
      type: RUN_STAGE_TYPES.COMBAT,
      name: "Stage 1 - Old Bones",
      enemyPoolWeights: Object.freeze({ [ENEMY_DIFFICULTY.EASY]: 100 }),
      enemyCoinDrop: Object.freeze({ totalValueMin: 4, totalValueMax: 6 }),
      enemyPotionDrop: ENEMY_POTION_DROP_EARLY,
      difficultyScale: 1,
      compact: true,
      treasureReward: createTreasureReward({
        normalChestCoinDrop: Object.freeze({ totalValueMin: 8, totalValueMax: 12 }),
      }),
    }),
    Object.freeze({
      stageIndex: 2,
      type: RUN_STAGE_TYPES.COMBAT,
      name: "Stage 2 - Hungry Dark",
      enemyPoolWeights: Object.freeze({ [ENEMY_DIFFICULTY.EASY]: 100 }),
      enemyCoinDrop: Object.freeze({ totalValueMin: 4, totalValueMax: 7 }),
      enemyPotionDrop: ENEMY_POTION_DROP_EARLY,
      difficultyScale: 1.05,
      compact: true,
      treasureReward: createTreasureReward({
        normalChestCoinDrop: Object.freeze({ totalValueMin: 9, totalValueMax: 14 }),
      }),
    }),
    Object.freeze({
      stageIndex: 3,
      type: RUN_STAGE_TYPES.SHOP,
      name: "Stage 3 - Wayfarer Shop",
      shopTier: 1,
    }),
    Object.freeze({
      stageIndex: 4,
      type: RUN_STAGE_TYPES.COMBAT,
      name: "Stage 4 - Split Teeth",
      enemyPoolWeights: Object.freeze({
        [ENEMY_DIFFICULTY.EASY]: 65,
        [ENEMY_DIFFICULTY.MEDIUM]: 35,
      }),
      enemyCoinDrop: Object.freeze({ totalValueMin: 5, totalValueMax: 8 }),
      enemyPotionDrop: ENEMY_POTION_DROP_MID,
      difficultyScale: 1.08,
      compact: true,
      treasureReward: createTreasureReward({
        normalChestCoinDrop: Object.freeze({ totalValueMin: 11, totalValueMax: 18 }),
      }),
    }),
    Object.freeze({
      stageIndex: 5,
      type: RUN_STAGE_TYPES.COMBAT,
      name: "Stage 5 - Locked Spoils",
      enemyPoolWeights: Object.freeze({
        [ENEMY_DIFFICULTY.EASY]: 55,
        [ENEMY_DIFFICULTY.MEDIUM]: 45,
      }),
      enemyCoinDrop: Object.freeze({ totalValueMin: 5, totalValueMax: 8 }),
      enemyPotionDrop: ENEMY_POTION_DROP_MID,
      difficultyScale: 1.12,
      compact: true,
      treasureReward: createTreasureReward({
        normalChestCoinDrop: Object.freeze({ totalValueMin: 15, totalValueMax: 25 }),
      }),
    }),
    Object.freeze({
      stageIndex: 6,
      type: RUN_STAGE_TYPES.SHOP,
      name: "Stage 6 - Deep Shop",
      shopTier: 2,
    }),
    Object.freeze({
      stageIndex: 7,
      type: RUN_STAGE_TYPES.COMBAT,
      name: "Stage 7 - Iron Hunt",
      enemyPoolWeights: Object.freeze({
        [ENEMY_DIFFICULTY.EASY]: 35,
        [ENEMY_DIFFICULTY.MEDIUM]: 45,
        [ENEMY_DIFFICULTY.HARD]: 20,
      }),
      enemyCoinDrop: Object.freeze({ totalValueMin: 6, totalValueMax: 9 }),
      enemyPotionDrop: ENEMY_POTION_DROP_LATE,
      difficultyScale: 1.16,
      compact: true,
      treasureReward: createTreasureReward({
        normalChestCoinDrop: Object.freeze({ totalValueMin: 16, totalValueMax: 28 }),
      }),
    }),
    Object.freeze({
      stageIndex: 8,
      type: RUN_STAGE_TYPES.COMBAT,
      name: "Stage 8 - Last Cache",
      enemyPoolWeights: Object.freeze({
        [ENEMY_DIFFICULTY.EASY]: 25,
        [ENEMY_DIFFICULTY.MEDIUM]: 45,
        [ENEMY_DIFFICULTY.HARD]: 30,
      }),
      enemyCoinDrop: Object.freeze({ totalValueMin: 7, totalValueMax: 10 }),
      enemyPotionDrop: ENEMY_POTION_DROP_LATE,
      difficultyScale: 1.2,
      compact: true,
      treasureReward: createTreasureReward({
        normalChestCoinDrop: Object.freeze({ totalValueMin: 20, totalValueMax: 35 }),
      }),
    }),
    Object.freeze({
      stageIndex: 9,
      type: RUN_STAGE_TYPES.SHOP,
      name: "Stage 9 - Last Light Shop",
      shopTier: 3,
    }),
    Object.freeze({
      stageIndex: 10,
      type: RUN_STAGE_TYPES.BOSS,
      name: "Stage 10 - Hollow Warden",
      enemyPoolWeights: Object.freeze({ [ENEMY_DIFFICULTY.HARD]: 100 }),
      difficultyScale: 1,
      // Deprecated marker: the stage now uses the boss/victory reset flow.
      bossPlaceholder: true,
      bossEnemyOverrides: Object.freeze({
        maxHp: 260,
        hp: 260,
        attackDamage: 18,
        coinDrop: Object.freeze({ totalValueMin: 0, totalValueMax: 0 }),
        potionDrop: Object.freeze({ chancePercent: 0 }),
      }),
    }),
  ]),
});

export function getRunStage(stageIndex, runPlan = RUN_PLAN) {
  return (
    runPlan.stages.find((stage) => stage.stageIndex === stageIndex) ?? null
  );
}

export function getRunStageCount(runPlan = RUN_PLAN) {
  return runPlan.stages.length;
}

export function getShopTierDefinition(tier, tiers = SHOP_TIERS) {
  return tiers[tier] ?? null;
}
