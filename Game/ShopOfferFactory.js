import {
  ITEM_RARITIES,
  getItemDefinition,
} from "../CharacterData/itemDefinitions.js";
import { createItemInstance } from "./ItemInstanceFactory.js";
import { createSeededRandom } from "./Utils.js";
import { SHOP_DEFINITION } from "./shopDefinitions.js";

export function createShopOffers({
  config = SHOP_DEFINITION,
  context = {},
  rng = null,
} = {}) {
  const effectiveConfig = createEffectiveShopConfig(config, context);
  const random = rng ?? createSeededRandom(createShopSeed(context));
  const offerCount = Math.max(0, Math.floor(effectiveConfig.offerCount ?? 0));
  const offers = [];
  const usedItemIds = new Set();

  for (let offerIndex = 0; offerIndex < offerCount; offerIndex += 1) {
    const rarity = rollShopRarity(effectiveConfig, context, random);
    const item = pickShopItemForRarity(effectiveConfig, rarity, random, usedItemIds)
      ?? pickShopItem(effectiveConfig, random, usedItemIds);

    if (!item) break;

    usedItemIds.add(item.id);
    const itemInstance = createItemInstance(item.id, {
      ...context,
      sourceKind: "shop",
      sourceId: createOfferId(context, offerIndex, item.id),
      offerIndex,
    });
    offers.push(createShopOffer({
      offerIndex,
      item,
      itemInstance,
      price: getShopItemPrice(effectiveConfig, item, itemInstance),
      context,
    }));
  }

  return offers;
}

export function createShopOffer({ offerIndex, item, itemInstance = null, price, context = {} }) {
  return {
    id: createOfferId(context, offerIndex, item.id),
    offerIndex,
    itemId: item.id,
    itemDefinition: item,
    item: itemInstance ?? item,
    itemInstance,
    rarity: itemInstance?.rarity ?? item.rarity,
    price,
    purchased: false,
  };
}

export function getShopRarityWeights(config = SHOP_DEFINITION, context = {}) {
  if (context.rarityWeights ?? context.shopTierDefinition?.rarityWeights) {
    return {
      ...(context.rarityWeights ?? context.shopTierDefinition?.rarityWeights),
    };
  }

  return {
    ...(config.rarityWeights?.default ?? {}),
    ...(getShopRarityWeightEntry(config, context)?.weights ?? {}),
  };
}

export function getShopRarityWeightEntry(config = SHOP_DEFINITION, context = {}) {
  const rarityConfig = config.rarityWeights ?? {};
  const progress = getShopProgressContext(context);
  const entries = rarityConfig.byRunProgress ?? rarityConfig.byProgress ?? [];

  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    const minFloor = entry.minFloorIndex ?? Number.NEGATIVE_INFINITY;
    const maxFloor = entry.maxFloorIndex ?? Number.POSITIVE_INFINITY;
    const minCompleted = entry.minCompletedFloors ?? Number.NEGATIVE_INFINITY;
    const maxCompleted = entry.maxCompletedFloors ?? Number.POSITIVE_INFINITY;
    const matchesFloor =
      progress.floorIndex >= minFloor && progress.floorIndex <= maxFloor;
    const matchesCompleted =
      progress.completedFloors >= minCompleted &&
      progress.completedFloors <= maxCompleted;

    if (matchesFloor && matchesCompleted) return entry;
  }

  return null;
}

export function getShopProgressContext(context = {}) {
  const floorIndex = parseProgressNumber(
    context.floorIndex ?? context.currentFloorIndex,
    1
  );
  const completedFloors = parseProgressNumber(
    context.completedFloors ?? context.completedFloorCount,
    Math.max(0, floorIndex - 1)
  );

  return {
    floorIndex,
    completedFloors,
  };
}

export function getShopItemPrice(config = SHOP_DEFINITION, item, itemInstance = null) {
  const overridePrice = config.itemPriceOverrides?.[item.id];
  const itemPrice = item.shop?.basePrice ?? item.shop?.price ?? item.price;
  const rarity = itemInstance?.rarity ?? item.rarity;
  const fallbackPrice = config.fallbackPriceByRarity?.[rarity];
  const price = overridePrice ?? itemPrice ?? fallbackPrice ?? 0;
  const numericPrice = Number.parseInt(price, 10);
  const multiplier = Number.parseFloat(config.priceMultiplier ?? 1);
  const safeMultiplier = Number.isFinite(multiplier) ? Math.max(0, multiplier) : 1;
  const qualityMultiplier = getRollQualityPriceMultiplier(config, itemInstance);

  return Number.isFinite(numericPrice)
    ? Math.max(0, Math.round(numericPrice * safeMultiplier * qualityMultiplier))
    : 0;
}

function getRollQualityPriceMultiplier(config, itemInstance) {
  if (!itemInstance?.rollQuality) return 1;

  const priceSpread = Number.parseFloat(config.rollQualityPriceSpread ?? 0.25);
  const safeSpread = Number.isFinite(priceSpread) ? Math.max(0, priceSpread) : 0.25;

  return 1 + itemInstance.rollQuality * safeSpread;
}

function createEffectiveShopConfig(config = SHOP_DEFINITION, context = {}) {
  const tierConfig = context.shopTierDefinition ?? {};

  return {
    ...config,
    offerCount: tierConfig.offerCount ?? context.offerCount ?? config.offerCount,
    possibleItemIds:
      tierConfig.possibleItemIds ??
      context.possibleItemIds ??
      config.possibleItemIds,
    priceMultiplier:
      tierConfig.priceMultiplier ??
      context.priceMultiplier ??
      config.priceMultiplier ??
      1,
  };
}

function rollShopRarity(config, context, random) {
  const weights = getShopRarityWeights(config, context);
  const totalWeight = Object.values(weights).reduce(
    (sum, weight) => sum + normalizeWeight(weight),
    0
  );

  if (totalWeight <= 0) return ITEM_RARITIES.COMMON;

  const roll = random() * totalWeight;
  let cursor = 0;

  for (const rarity of Object.values(ITEM_RARITIES)) {
    cursor += normalizeWeight(weights[rarity]);

    if (roll <= cursor) return rarity;
  }

  return ITEM_RARITIES.COMMON;
}

function pickShopItemForRarity(config, rarity, random, usedItemIds) {
  return pickFromPool(
    getShopItemPool(config).filter((item) => item.rarity === rarity),
    random,
    usedItemIds
  );
}

function pickShopItem(config, random, usedItemIds) {
  return pickFromPool(getShopItemPool(config), random, usedItemIds);
}

function getShopItemPool(config) {
  const itemIds = config.possibleItemIds ?? [];

  return itemIds
    .map((itemId) => getItemDefinition(itemId))
    .filter(Boolean);
}

function pickFromPool(items, random, usedItemIds) {
  const available = items.filter((item) => !usedItemIds.has(item.id));
  if (available.length === 0) return null;

  return available[Math.floor(random() * available.length)];
}

function createShopSeed(context = {}) {
  return [
    context.runSeed ?? "shop",
    context.floorSeed ?? context.currentFloorSeed ?? "floor",
    context.floorIndex ?? context.currentFloorIndex ?? 0,
    "offers",
  ].join(":");
}

function createOfferId(context, offerIndex, itemId) {
  const floorIndex = context.floorIndex ?? context.currentFloorIndex ?? "x";

  return `shop-${floorIndex}-${offerIndex + 1}-${itemId}`;
}

function normalizeWeight(weight) {
  const numericWeight = Number.parseFloat(weight);

  if (!Number.isFinite(numericWeight)) return 0;

  return Math.max(0, numericWeight);
}

function parseProgressNumber(value, fallback) {
  const numericValue = Number.parseInt(value, 10);

  return Number.isFinite(numericValue) ? numericValue : fallback;
}
