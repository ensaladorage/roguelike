export const ITEM_TYPES = {
  EQUIPPABLE: "equippable",
  PASSIVE: "equippable",
  CONSUMABLE: "consumable",
};

export const ITEM_FOOD_CATEGORIES = {
  PROTEIN: "protein",
  SPICY: "spicy",
  HEARTY: "hearty",
  ABILITY: "ability",
};

export const ITEM_RARITIES = {
  COMMON: "common",
  RARE: "rare",
  EPIC: "epic",
};

export const ITEM_EFFECTS = {
  DAMAGE_UP: "damageUp",
  ATTACK_SPEED_UP: "attackSpeedUp",
  MAX_HP_UP: "maxHpUp",
  HEAL: "heal",
  STUN_ENEMY: "stunEnemy",
  AREA_STUN_POISON: "areaStunPoison",
};

export const ITEM_DEFINITIONS = {
  steak: {
    id: "steak",
    name: "Steak",
    descriptionTemplate: "+{attackDamage} attack damage",
    type: ITEM_TYPES.EQUIPPABLE,
    rarity: ITEM_RARITIES.COMMON,
    foodCategory: ITEM_FOOD_CATEGORIES.PROTEIN,
    hudSlot: 4,
    imagePath: "Assets/Images/Steak.png",
    effect: ITEM_EFFECTS.DAMAGE_UP,
    effects: [
      {
        stat: "attackDamage",
        op: "add",
        range: { min: 2, max: 10, step: 1 },
      },
    ],
    modifiers: {
      positive: ["attackDamage"],
      negative: [],
    },
    shop: { basePrice: 100 },
  },

  chili: {
    id: "chili",
    name: "Chili",
    descriptionTemplate: "+{attackSpeed} attack speed",
    type: ITEM_TYPES.EQUIPPABLE,
    rarity: ITEM_RARITIES.COMMON,
    foodCategory: ITEM_FOOD_CATEGORIES.SPICY,
    hudSlot: 5,
    imagePath: "Assets/Images/Chili.png",
    effect: ITEM_EFFECTS.ATTACK_SPEED_UP,
    effects: [
      {
        stat: "attackSpeed",
        op: "add",
        range: { min: 0.12, max: 0.35, step: 0.01 },
      },
      {
        stat: "maxAttackSpeed",
        op: "set",
        value: 4,
        display: false,
      },
    ],
    modifiers: {
      positive: ["attackSpeed"],
      negative: [],
    },
    shop: { basePrice: 100 },
  },

  ramen: {
    id: "ramen",
    name: "Ramen",
    descriptionTemplate: "+{maxHp} max HP",
    type: ITEM_TYPES.EQUIPPABLE,
    rarity: ITEM_RARITIES.COMMON,
    foodCategory: ITEM_FOOD_CATEGORIES.HEARTY,
    hudSlot: 3,
    imagePath: "Assets/Images/Ramen.png",
    effect: ITEM_EFFECTS.MAX_HP_UP,
    effects: [
      {
        stat: "maxHp",
        op: "add",
        range: { min: 15, max: 35, step: 1 },
      },
    ],
    modifiers: {
      positive: ["maxHp"],
      negative: [],
    },
    shop: { basePrice: 120 },
  },

  energyDrink: {
    id: "energyDrink",
    name: "Energy Drink",
    description: "Restores HP when used.",
    type: ITEM_TYPES.CONSUMABLE,
    rarity: ITEM_RARITIES.COMMON,
    hudSlot: 1,
    useSlot: 1,
    imagePath: "Assets/Images/EnergyDrink.png",
    effect: ITEM_EFFECTS.HEAL,
    inventory: {
      maxStack: 3,
    },
    effects: [
      {
        stat: "heal",
        op: "add",
        value: 30,
      },
    ],
    modifiers: {
      positive: ["heal"],
      negative: [],
    },
    shop: { basePrice: 80 },
  },

  purpleShroom: {
    id: "purpleShroom",
    name: "Purple Shroom",
    description: "Stuns and poisons nearby enemies.",
    type: ITEM_TYPES.CONSUMABLE,
    rarity: ITEM_RARITIES.COMMON,
    hudSlot: 2,
    useSlot: 2,
    imagePath: "Assets/Images/PurpleShroom.png",
    effect: ITEM_EFFECTS.AREA_STUN_POISON,
    inventory: {
      maxStack: 3,
    },
    effects: [
      { stat: "radius", op: "add", value: 2, display: false },
      { stat: "vfxRadius", op: "add", value: 1.5, display: false },
      {
        stat: "stunDuration",
        op: "add",
        value: 3,
      },
      {
        stat: "poisonDamagePerSecond",
        op: "add",
        value: 5,
      },
      { stat: "poisonDuration", op: "add", value: 3, display: false },
      { stat: "poisonTickInterval", op: "add", value: 0.5, display: false },
    ],
    modifiers: {
      positive: ["stunDuration", "poisonDamagePerSecond"],
      negative: [],
    },
    shop: { basePrice: 100 },
  },

  fish: {
    id: "fish",
    name: "Fish",
    descriptionTemplate: "+{attackDamage} attack damage, {moveSpeed} move speed",
    type: ITEM_TYPES.EQUIPPABLE,
    rarity: ITEM_RARITIES.RARE,
    foodCategory: ITEM_FOOD_CATEGORIES.PROTEIN,
    hudSlot: 6,
    imagePath: "Assets/Images/Steak.png",
    effect: ITEM_EFFECTS.DAMAGE_UP,
    disabled: true,
    effects: [
      {
        stat: "attackDamage",
        op: "add",
        range: { min: 4, max: 12, step: 1 },
      },
      {
        stat: "moveSpeed",
        op: "add",
        range: { min: -0.35, max: -0.1, step: 0.01 },
      },
    ],
    modifiers: {
      positive: ["attackDamage"],
      negative: ["moveSpeed"],
    },
    shop: { basePrice: 180 },
  },
};

export function getItemDefinition(itemId) {
  return ITEM_DEFINITIONS[itemId] ?? null;
}

export function getItemMaxStack(itemId) {
  return getItemDefinition(itemId)?.inventory?.maxStack ?? Infinity;
}

export function getItemStats(itemOrDefinition) {
  if (itemOrDefinition?.rolledStats) {
    return { ...itemOrDefinition.rolledStats };
  }

  const definition =
    typeof itemOrDefinition === "string"
      ? getItemDefinition(itemOrDefinition)
      : itemOrDefinition;
  if (!definition) return {};

  const rarity = definition.rarity ?? ITEM_RARITIES.COMMON;
  const commonStats = definition.statsByRarity?.[ITEM_RARITIES.COMMON] ?? {};
  const rarityStats = definition.statsByRarity?.[rarity] ?? {};

  const legacyStats = {
    ...commonStats,
    ...rarityStats,
  };

  if (Object.keys(legacyStats).length > 0) return legacyStats;

  return Object.fromEntries(
    (definition.effects ?? [])
      .filter((effect) => effect?.stat)
      .map((effect) => [
        effect.stat,
        effect.value ?? effect.range?.max ?? effect.range?.min ?? 0,
      ])
  );
}

export function getItemDescription(itemOrDefinition) {
  if (itemOrDefinition?.display?.description) {
    return itemOrDefinition.display.description;
  }

  const definition =
    typeof itemOrDefinition === "string"
      ? getItemDefinition(itemOrDefinition)
      : itemOrDefinition;
  if (!definition) return "";

  if (definition.description) return definition.description;

  const stats = getItemStats(definition);
  if (definition.descriptionTemplate) {
    return fillItemDescriptionTemplate(definition.descriptionTemplate, stats);
  }

  const parts = [];

  if (stats.attackDamage) parts.push(`+${stats.attackDamage} attack damage`);
  if (stats.attackSpeed) parts.push(`+${stats.attackSpeed} attack speed`);
  if (stats.maxHp) parts.push(`+${stats.maxHp} max HP`);
  if (stats.heal) parts.push(`Restores ${stats.heal} HP`);
  if (stats.stunDuration) parts.push(`Stuns for ${stats.stunDuration}s`);

  return parts.join(", ") || "Adds a useful effect.";
}

export function getItemDefinitionByUseSlot(useSlot) {
  return Object.values(ITEM_DEFINITIONS).find(
    (definition) => definition.useSlot === useSlot
  ) ?? null;
}

export function getItemDefinitionsByType(type) {
  return Object.values(ITEM_DEFINITIONS).filter(
    (definition) => definition.type === type
  );
}

export function getItemDefinitionsByRarity(rarity) {
  return Object.values(ITEM_DEFINITIONS).filter(
    (definition) => definition.rarity === rarity && !definition.disabled
  );
}

export function getItemIdsByRarity(rarity) {
  return getItemDefinitionsByRarity(rarity).map((definition) => definition.id);
}

function fillItemDescriptionTemplate(template, stats = {}) {
  return String(template).replace(/\{([a-zA-Z0-9_]+)\}/g, (_, statName) => {
    const value = stats[statName];
    if (value === undefined || value === null) return "0";

    return formatItemStatValue(value);
  });
}

function formatItemStatValue(value) {
  const numericValue = Number.parseFloat(value);
  if (!Number.isFinite(numericValue)) return String(value);

  return Number.isInteger(numericValue)
    ? String(numericValue)
    : numericValue.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}
