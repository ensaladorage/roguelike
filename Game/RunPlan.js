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
      "steak",
      "chili",
      "potato",
      "energyDrink",
      "purpleShroom",
      "ramen",
      "fish",
    ]),
    priceMultiplier: 0.7,
    rarityWeights: Object.freeze({
      [ITEM_RARITIES.COMMON]: 70,
      [ITEM_RARITIES.RARE]: 30,
      [ITEM_RARITIES.EPIC]: 0,
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
      "energyDrink",
      "purpleShroom",
      "ramen",
      "fish",
      "garlic",
      "iceCream",
      "dragonSteak",
      "spicySauce",
      "dragonFruit",
    ]),
    priceMultiplier: 0.8,
    rarityWeights: Object.freeze({
      [ITEM_RARITIES.COMMON]: 20,
      [ITEM_RARITIES.RARE]: 65,
      [ITEM_RARITIES.EPIC]: 15,
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
    priceMultiplier: 0.9,
    rarityWeights: Object.freeze({
      [ITEM_RARITIES.COMMON]: 0,
      [ITEM_RARITIES.RARE]: 50,
      [ITEM_RARITIES.EPIC]: 50,
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
      combatEnemyCountTarget: 3,
      enemyCoinDrop: Object.freeze({ totalValueMin: 12, totalValueMax: 16 }),
      enemyPotionDrop: ENEMY_POTION_DROP_EARLY,
      difficultyScale: 1,
      compact: true,
      treasureReward: createTreasureReward({
        normalChestCount: Object.freeze({ min: 1, max: 1 }),
        normalRareItemChancePercent: 0,
        normalChestCoinDrop: Object.freeze({ totalValueMin: 12, totalValueMax: 18 }),
        epicChest: Object.freeze({ enabled: false }),
      }),
    }),
    Object.freeze({
      stageIndex: 2,
      type: RUN_STAGE_TYPES.COMBAT,
      name: "Stage 2 - Hungry Dark",
      enemyPoolWeights: Object.freeze({ [ENEMY_DIFFICULTY.EASY]: 100 }),
      combatEnemyCountTarget: 3,
      enemyCoinDrop: Object.freeze({ totalValueMin: 14, totalValueMax: 18 }),
      enemyPotionDrop: ENEMY_POTION_DROP_EARLY,
      difficultyScale: 1.08,
      compact: true,
      treasureReward: createTreasureReward({
        normalChestCount: Object.freeze({ min: 1, max: 2 }),
        normalRareItemChancePercent: 10,
        normalChestCoinDrop: Object.freeze({ totalValueMin: 14, totalValueMax: 22 }),
        epicChest: Object.freeze({ enabled: false }),
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
        [ENEMY_DIFFICULTY.EASY]: 50,
        [ENEMY_DIFFICULTY.MEDIUM]: 50,
      }),
      combatEnemyCountTarget: 4,
      enemyCoinDrop: Object.freeze({ totalValueMin: 16, totalValueMax: 22 }),
      enemyPotionDrop: ENEMY_POTION_DROP_MID,
      difficultyScale: 1.2,
      compact: true,
      treasureReward: createTreasureReward({
        normalChestCount: Object.freeze({ min: 2, max: 2 }),
        normalRareItemChancePercent: 35,
        normalChestCoinDrop: Object.freeze({ totalValueMin: 20, totalValueMax: 30 }),
        epicChest: Object.freeze({ enabled: false }),
      }),
    }),
    Object.freeze({
      stageIndex: 5,
      type: RUN_STAGE_TYPES.COMBAT,
      name: "Stage 5 - Locked Spoils",
      enemyPoolWeights: Object.freeze({
        [ENEMY_DIFFICULTY.EASY]: 20,
        [ENEMY_DIFFICULTY.MEDIUM]: 60,
        [ENEMY_DIFFICULTY.HARD]: 20,
      }),
      combatEnemyCountTarget: 4,
      enemyCoinDrop: Object.freeze({ totalValueMin: 18, totalValueMax: 26 }),
      enemyPotionDrop: ENEMY_POTION_DROP_MID,
      difficultyScale: 1.35,
      compact: true,
      treasureReward: createTreasureReward({
        normalChestCount: Object.freeze({ min: 2, max: 2 }),
        normalRareItemChancePercent: 45,
        normalChestCoinDrop: Object.freeze({ totalValueMin: 26, totalValueMax: 36 }),
        epicChest: Object.freeze({
          rarityWeights: Object.freeze({
            [ITEM_RARITIES.RARE]: 95,
            [ITEM_RARITIES.EPIC]: 5,
          }),
        }),
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
        [ENEMY_DIFFICULTY.MEDIUM]: 45,
        [ENEMY_DIFFICULTY.HARD]: 55,
      }),
      combatEnemyCountTarget: 5,
      enemyCoinDrop: Object.freeze({ totalValueMin: 22, totalValueMax: 30 }),
      enemyPotionDrop: ENEMY_POTION_DROP_LATE,
      difficultyScale: 1.5,
      compact: true,
      treasureReward: createTreasureReward({
        normalChestCount: Object.freeze({ min: 2, max: 2 }),
        normalRareItemChancePercent: 50,
        normalChestCoinDrop: Object.freeze({ totalValueMin: 34, totalValueMax: 46 }),
        epicChest: Object.freeze({
          rarityWeights: Object.freeze({
            [ITEM_RARITIES.RARE]: 85,
            [ITEM_RARITIES.EPIC]: 15,
          }),
        }),
      }),
    }),
    Object.freeze({
      stageIndex: 8,
      type: RUN_STAGE_TYPES.COMBAT,
      name: "Stage 8 - Last Cache",
      enemyPoolWeights: Object.freeze({
        [ENEMY_DIFFICULTY.MEDIUM]: 25,
        [ENEMY_DIFFICULTY.HARD]: 75,
      }),
      combatEnemyCountTarget: 5,
      enemyCoinDrop: Object.freeze({ totalValueMin: 28, totalValueMax: 38 }),
      enemyPotionDrop: ENEMY_POTION_DROP_LATE,
      difficultyScale: 1.7,
      compact: true,
      treasureReward: createTreasureReward({
        normalChestCount: Object.freeze({ min: 2, max: 2 }),
        normalRareItemChancePercent: 55,
        normalChestCoinDrop: Object.freeze({ totalValueMin: 42, totalValueMax: 58 }),
        epicChest: Object.freeze({
          rarityWeights: Object.freeze({
            [ITEM_RARITIES.RARE]: 55,
            [ITEM_RARITIES.EPIC]: 45,
          }),
        }),
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
        maxHp: 720,
        hp: 720,
        attackDamage: 24,
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
