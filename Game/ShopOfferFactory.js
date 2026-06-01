import {
  ITEM_RARITIES,
  getItemDefinition,
} from "../CharacterData/itemDefinitions.js";
import { createSeededRandom } from "./Utils.js";
import { SHOP_DEFINITION } from "./shopDefinitions.js";

export function createShopOffers({
  config = SHOP_DEFINITION,
  context = {},
  rng = null,
} = {}) {
  const random = rng ?? createSeededRandom(createShopSeed(context));
  const offerCount = Math.max(0, Math.floor(config.offerCount ?? 0));
  const offers = [];
  const usedItemIds = new Set();

  for (let offerIndex = 0; offerIndex < offerCount; offerIndex += 1) {
    const rarity = rollShopRarity(config, context, random);
    const item = pickShopItemForRarity(config, rarity, random, usedItemIds)
      ?? pickShopItem(config, random, usedItemIds);

    if (!item) break;

    usedItemIds.add(item.id);
    offers.push(createShopOffer({
      offerIndex,
      item,
      price: getShopItemPrice(config, item),
      context,
    }));
  }

  return offers;
}

export function createShopOffer({ offerIndex, item, price, context = {} }) {
  return {
    id: createOfferId(context, offerIndex, item.id),
    offerIndex,
    itemId: item.id,
    itemDefinition: item,
    item,
    rarity: item.rarity,
    price,
    purchased: false,
  };
}

export function getShopRarityWeights(config = SHOP_DEFINITION, context = {}) {
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

export function getShopItemPrice(config = SHOP_DEFINITION, item) {
  const overridePrice = config.itemPriceOverrides?.[item.id];
  const itemPrice = item.shop?.price ?? item.price;
  const fallbackPrice = config.fallbackPriceByRarity?.[item.rarity];
  const price = overridePrice ?? itemPrice ?? fallbackPrice ?? 0;
  const numericPrice = Number.parseInt(price, 10);

  return Number.isFinite(numericPrice) ? Math.max(0, numericPrice) : 0;
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
