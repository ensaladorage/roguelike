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
  UNLOCK_DASH: "unlockDash",
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
        range: { min: 2, max: 7, step: 1 },
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
        range: { min: 0.1, max: 0.25, step: 0.01 },
      },
    ],
    modifiers: {
      positive: ["attackSpeed"],
      negative: [],
    },
    shop: { basePrice: 100 },
  },

  garlic: {
    id: "garlic",
    name: "Garlic",
    descriptionTemplate: "+{attackSpeed} attack speed",
    type: ITEM_TYPES.EQUIPPABLE,
    rarity: ITEM_RARITIES.RARE,
    foodCategory: ITEM_FOOD_CATEGORIES.SPICY,
    hudSlot: 8,
    imagePath: "Assets/Images/Garlic.png",
    effect: ITEM_EFFECTS.ATTACK_SPEED_UP,
    effects: [
      {
        stat: "attackSpeed",
        op: "add",
        range: { min: 0.35, max: 0.65, step: 0.01 },
      },
    ],
    modifiers: {
      positive: ["attackSpeed"],
      negative: [],
    },
    shop: { basePrice: 250 },
  },

  ramen: {
    id: "ramen",
    name: "Ramen",
    descriptionTemplate: "+{maxHp} max HP",
    type: ITEM_TYPES.EQUIPPABLE,
    rarity: ITEM_RARITIES.RARE,
    foodCategory: ITEM_FOOD_CATEGORIES.HEARTY,
    hudSlot: 3,
    imagePath: "Assets/Images/Ramen.png",
    effect: ITEM_EFFECTS.MAX_HP_UP,
    effects: [
      {
        stat: "maxHp",
        op: "add",
        range: { min: 20, max: 40, step: 1 },
      },
    ],
    modifiers: {
      positive: ["maxHp"],
      negative: [],
    },
    shop: { basePrice: 120 },
  },

  potato: {
    id: "potato",
    name: "Potato",
    descriptionTemplate: "+{maxHp} max HP",
    type: ITEM_TYPES.EQUIPPABLE,
    rarity: ITEM_RARITIES.COMMON,
    foodCategory: ITEM_FOOD_CATEGORIES.HEARTY,
    hudSlot: 3,
    imagePath: "Assets/Images/Potato.png",
    effect: ITEM_EFFECTS.MAX_HP_UP,
    effects: [
      {
        stat: "maxHp",
        op: "add",
        range: { min: 6, max: 12, step: 1 },
      },
    ],
    modifiers: {
      positive: ["maxHp"],
      negative: [],
    },
    shop: { basePrice: 70 },
  },

  energyDrink: {
    id: "energyDrink",
    name: "Energy Drink",
    descriptionTemplate: "Restores {heal} HP when used.",
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
        value: 50,
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
    descriptionTemplate: "Stuns {stunDuration}s and poisons {poisonDamagePerSecond}/s nearby enemies.",
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

  iceCream: {
    id: "iceCream",
    name: "Ice Cream",
    descriptionTemplate: "Grants dash. Distance: {dashDistance}. Cooldown: {dashCooldownSeconds}s.",
    type: ITEM_TYPES.EQUIPPABLE,
    rarity: ITEM_RARITIES.EPIC,
    foodCategory: ITEM_FOOD_CATEGORIES.ABILITY,
    hudSlot: 7,
    imagePath: "Assets/Images/Icecream.png",
    effect: ITEM_EFFECTS.UNLOCK_DASH,
    effects: [
      {
        stat: "dashDistance",
        op: "set",
        range: { min: 2, max: 3.5, step: 0.1 },
      },
      {
        stat: "dashCooldownSeconds",
        op: "set",
        range: { min: 1.5, max: 4, step: 0.1 },
        higherIsBetter: false,
      },
    ],
    modifiers: {
      positive: ["dashDistance", "dashCooldownSeconds"],
      negative: [],
    },
    shop: { basePrice: 220 },
  },

  fish: {
    id: "fish",
    name: "Fish",
    descriptionTemplate: "+{attackDamage} attack damage",
    type: ITEM_TYPES.EQUIPPABLE,
    rarity: ITEM_RARITIES.RARE,
    foodCategory: ITEM_FOOD_CATEGORIES.PROTEIN,
    hudSlot: 6,
    imagePath: "Assets/Images/Fish.png",
    effect: ITEM_EFFECTS.DAMAGE_UP,
    effects: [
      {
        stat: "attackDamage",
        op: "add",
        range: { min: 7, max: 14, step: 1 },
      },
    ],
    modifiers: {
      positive: ["attackDamage"],
      negative: [],
    },
    shop: { basePrice: 180 },
  },

  dragonSteak: {
    id: "dragonSteak",
    name: "Dragon Steak",
    descriptionTemplate: "+{attackDamage} attack damage, {attackRange} attack range",
    type: ITEM_TYPES.EQUIPPABLE,
    rarity: ITEM_RARITIES.EPIC,
    foodCategory: ITEM_FOOD_CATEGORIES.PROTEIN,
    hudSlot: 4,
    imagePath: "Assets/Images/DragonSteak.png",
    effect: ITEM_EFFECTS.DAMAGE_UP,
    effects: [
      {
        stat: "attackDamage",
        op: "add",
        range: { min: 18, max: 28, step: 1 },
      },
      {
        stat: "attackRange",
        op: "add",
        range: { min: -0.3, max: -0.15, step: 0.01 },
      },
    ],
    modifiers: {
      positive: ["attackDamage"],
      negative: ["attackRange"],
    },
    shop: { basePrice: 400 },
  },

  spicySauce: {
    id: "spicySauce",
    name: "Spicy Sauce",
    descriptionTemplate: "+{attackSpeed} attack speed, {moveSpeed} move speed",
    type: ITEM_TYPES.EQUIPPABLE,
    rarity: ITEM_RARITIES.EPIC,
    foodCategory: ITEM_FOOD_CATEGORIES.SPICY,
    hudSlot: 5,
    imagePath: "Assets/Images/SpicySauce.png",
    effect: ITEM_EFFECTS.ATTACK_SPEED_UP,
    effects: [
      {
        stat: "attackSpeed",
        op: "add",
        range: { min: 0.75, max: 1.15, step: 0.01 },
      },
      {
        stat: "moveSpeed",
        op: "add",
        range: { min: -0.25, max: -0.15, step: 0.01 },
      },
    ],
    modifiers: {
      positive: ["attackSpeed"],
      negative: ["moveSpeed"],
    },
    shop: { basePrice: 420 },
  },

  dragonFruit: {
    id: "dragonFruit",
    name: "Dragon Fruit",
    descriptionTemplate: "+{maxHp} max HP",
    type: ITEM_TYPES.EQUIPPABLE,
    rarity: ITEM_RARITIES.EPIC,
    foodCategory: ITEM_FOOD_CATEGORIES.HEARTY,
    hudSlot: 3,
    imagePath: "Assets/Images/DragonFruit.png",
    effect: ITEM_EFFECTS.MAX_HP_UP,
    effects: [
      {
        stat: "maxHp",
        op: "add",
        range: { min: 55, max: 80, step: 1 },
      },
    ],
    modifiers: {
      positive: ["maxHp"],
      negative: [],
    },
    shop: { basePrice: 430 },
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
