import {
  ITEM_FOOD_CATEGORIES,
  ITEM_RARITIES,
  getItemDefinition,
  getItemDescription,
} from "../CharacterData/itemDefinitions.js";
import { createSeededRandom } from "./Utils.js";

const STAT_LABELS = {
  attackDamage: "attack damage",
  attackRange: "attack range",
  attackSpeed: "attack speed",
  maxHp: "max HP",
  heal: "HP",
  stunDuration: "stun duration",
  poisonDamagePerSecond: "poison damage",
  moveSpeed: "move speed",
  dashDistance: "dash distance",
  dashCooldownSeconds: "dash cooldown",
};

export function createItemInstance(baseItemId, context = {}) {
  const definition = getItemDefinition(baseItemId);
  if (!definition) return null;

  const seed = createItemInstanceSeed(definition.id, context);
  const random = context.rng ?? createSeededRandom(seed);
  const rolledStats = rollItemStats(definition, random);
  const rarity = context.rarity ?? context.displayRarity ?? definition.rarity ?? ITEM_RARITIES.COMMON;
  const itemInstance = {
    instanceId: context.instanceId ?? seed,
    baseItemId: definition.id,
    itemId: definition.id,
    name: definition.name,
    rarity,
    type: definition.type,
    foodCategory: definition.foodCategory ?? null,
    imagePath: definition.imagePath,
    modelId: definition.modelId ?? null,
    hudSlot: definition.hudSlot,
    useSlot: definition.useSlot,
    rolledStats,
    rollQuality: getItemRollQuality(definition, rolledStats),
    source: createItemSource(context),
  };

  return withItemDisplay(itemInstance);
}

export function normalizeItemInstance(itemOrId, context = {}) {
  if (!itemOrId) return null;

  if (typeof itemOrId === "string") {
    return createItemInstance(itemOrId, context);
  }

  if (itemOrId.baseItemId && itemOrId.rolledStats) {
    return withItemDisplay({
      ...itemOrId,
      itemId: itemOrId.itemId ?? itemOrId.baseItemId,
      source: itemOrId.source ?? createItemSource(context),
    });
  }

  if (itemOrId.itemInstance) {
    return normalizeItemInstance(itemOrId.itemInstance, context);
  }

  if (itemOrId.id) {
    return createItemInstance(itemOrId.id, context);
  }

  return null;
}

export function getItemBaseId(itemOrId) {
  if (typeof itemOrId === "string") return itemOrId;

  return itemOrId?.baseItemId ?? itemOrId?.itemId ?? itemOrId?.id ?? null;
}

export function getItemDisplayName(itemOrDefinition) {
  return itemOrDefinition?.display?.name ?? itemOrDefinition?.name ?? "";
}

export function getItemDisplayDescription(itemOrDefinition) {
  return itemOrDefinition?.display?.description ?? getItemDescription(itemOrDefinition);
}

export function getItemDefinitionForInstance(itemOrDefinition) {
  const baseItemId = getItemBaseId(itemOrDefinition);

  return baseItemId ? getItemDefinition(baseItemId) : null;
}

export function createItemInstanceSeed(baseItemId, context = {}) {
  return [
    context.runSeed ?? "run",
    context.floorSeed ?? context.currentFloorSeed ?? "floor",
    context.floorIndex ?? context.currentFloorIndex ?? "x",
    context.sourceKind ?? context.kind ?? context.source ?? "item",
    context.sourceId ?? context.chestId ?? context.offerId ?? context.roomId ?? "source",
    context.rollIndex ?? context.optionIndex ?? context.offerIndex ?? 0,
    baseItemId,
  ].join(":");
}

export function getItemRollQuality(definition, rolledStats = {}) {
  const qualities = (definition.effects ?? [])
    .filter((effect) => effect?.range && rolledStats[effect.stat] !== undefined)
    .map((effect) => getStatRollQuality(effect, rolledStats[effect.stat]));

  if (qualities.length === 0) return 1;

  const total = qualities.reduce((sum, quality) => sum + quality, 0);
  return clamp(total / qualities.length, 0, 1);
}

function rollItemStats(definition, random) {
  const stats = {};

  for (const effect of definition.effects ?? []) {
    if (!effect?.stat) continue;

    if (effect.range) {
      stats[effect.stat] = rollRange(effect.range, random);
      continue;
    }

    stats[effect.stat] = effect.value ?? 0;
  }

  return stats;
}

function rollRange(range, random) {
  const min = Number.parseFloat(range.min ?? 0);
  const max = Number.parseFloat(range.max ?? min);
  const step = Number.parseFloat(range.step ?? 1);
  const safeMin = Number.isFinite(min) ? min : 0;
  const safeMax = Number.isFinite(max) ? max : safeMin;
  const low = Math.min(safeMin, safeMax);
  const high = Math.max(safeMin, safeMax);
  const safeStep = Number.isFinite(step) && step > 0 ? step : 1;
  const steps = Math.max(0, Math.round((high - low) / safeStep));
  const value = low + Math.floor(random() * (steps + 1)) * safeStep;

  return roundStatValue(Math.min(high, value));
}

function getStatRollQuality(effect, value) {
  const min = Number.parseFloat(effect.range.min ?? 0);
  const max = Number.parseFloat(effect.range.max ?? min);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return 1;

  const low = Math.min(min, max);
  const high = Math.max(min, max);
  const normalized = (Number.parseFloat(value) - low) / (high - low);

  return effect.higherIsBetter === false
    ? 1 - normalized
    : normalized;
}

function withItemDisplay(itemInstance) {
  const definition = getItemDefinition(itemInstance.baseItemId);
  if (!definition) return itemInstance;

  const tooltipLines = createTooltipLines(definition, itemInstance.rolledStats);

  return {
    ...itemInstance,
    display: {
      name: definition.name,
      description: definition.descriptionTemplate
        ? fillTemplate(definition.descriptionTemplate, itemInstance.rolledStats)
        : tooltipLines.join(", ") || getItemDescription(definition),
      tooltipLines,
    },
  };
}

function createTooltipLines(definition, stats) {
  const lines = [];

  for (const effect of definition.effects ?? []) {
    if (effect.display === false || !effect.stat) continue;

    const value = stats[effect.stat];
    if (value === undefined || value === null) continue;

    lines.push(formatStatLine(effect.stat, value));
  }

  return lines;
}

function formatStatLine(stat, value) {
  const label = STAT_LABELS[stat] ?? stat;
  const numericValue = Number.parseFloat(value);
  if (!Number.isFinite(numericValue)) return `${value} ${label}`;

  if (stat === "heal") return `Restores ${formatStatValue(numericValue)} ${label}`;
  if (stat === "stunDuration") return `Stuns for ${formatStatValue(numericValue)}s`;
  if (stat === "dashCooldownSeconds") {
    return `${formatStatValue(numericValue)}s ${label}`;
  }
  if (stat === "poisonDamagePerSecond") {
    return `${formatSignedValue(numericValue)} ${label}/s`;
  }

  return `${formatSignedValue(numericValue)} ${label}`;
}

function fillTemplate(template, stats = {}) {
  return String(template).replace(/\{([a-zA-Z0-9_]+)\}/g, (_, statName) => {
    const value = stats[statName];

    return value === undefined ? "0" : formatStatValue(value);
  });
}

function formatSignedValue(value) {
  const numericValue = Number.parseFloat(value);
  if (!Number.isFinite(numericValue)) return String(value);

  return numericValue > 0
    ? `+${formatStatValue(numericValue)}`
    : formatStatValue(numericValue);
}

function formatStatValue(value) {
  const numericValue = Number.parseFloat(value);
  if (!Number.isFinite(numericValue)) return String(value);

  return Number.isInteger(numericValue)
    ? String(numericValue)
    : numericValue.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function roundStatValue(value) {
  return Number.parseFloat(Number(value).toFixed(4));
}

function createItemSource(context = {}) {
  return {
    kind: context.sourceKind ?? context.kind ?? context.source ?? null,
    runSeed: context.runSeed ?? null,
    floorSeed: context.floorSeed ?? context.currentFloorSeed ?? null,
    floorIndex: context.floorIndex ?? context.currentFloorIndex ?? null,
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export { ITEM_FOOD_CATEGORIES };
