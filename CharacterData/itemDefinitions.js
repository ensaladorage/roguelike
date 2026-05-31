export const ITEM_TYPES = {
  PASSIVE: "passive",
  CONSUMABLE: "consumable",
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
};

export const ITEM_DEFINITIONS = {
  steak: {
    id: "steak",
    name: "Steak",
    type: ITEM_TYPES.PASSIVE,
    rarity: ITEM_RARITIES.COMMON,
    hudSlot: 4,
    imagePath: "Assets/Images/Steak.png",
    effect: ITEM_EFFECTS.DAMAGE_UP,
    modifiers: {
      attackDamage: 5,
    },
  },

  chili: {
    id: "chili",
    name: "Chili",
    type: ITEM_TYPES.PASSIVE,
    rarity: ITEM_RARITIES.RARE,
    hudSlot: 5,
    imagePath: "Assets/Images/Chili.png",
    effect: ITEM_EFFECTS.ATTACK_SPEED_UP,
    modifiers: {
      attackSpeed: 0.2,
      maxAttackSpeed: 4,
    },
  },

  ramen: {
    id: "ramen",
    name: "Ramen",
    type: ITEM_TYPES.PASSIVE,
    rarity: ITEM_RARITIES.EPIC,
    hudSlot: 3,
    imagePath: "Assets/Images/Ramen.png",
    effect: ITEM_EFFECTS.MAX_HP_UP,
    modifiers: {
      maxHp: 25,
    },
  },

  energyDrink: {
    id: "energyDrink",
    name: "Energy Drink",
    type: ITEM_TYPES.CONSUMABLE,
    rarity: ITEM_RARITIES.RARE,
    hudSlot: 1,
    useSlot: 1,
    imagePath: "Assets/Images/EnergyDrink.png",
    effect: ITEM_EFFECTS.HEAL,
    inventory: {
      maxStack: 3,
    },
    consumable: {
      heal: 30,
    },
  },

  purpleShroom: {
    id: "purpleShroom",
    name: "Purple Shroom",
    type: ITEM_TYPES.CONSUMABLE,
    rarity: ITEM_RARITIES.COMMON,
    hudSlot: 2,
    useSlot: 2,
    imagePath: "Assets/Images/PurpleShroom.png",
    effect: ITEM_EFFECTS.STUN_ENEMY,
    inventory: {
      maxStack: 3,
    },
    consumable: {
      stunDuration: 3,
      radius: 3,
    },
  },
};

export function getItemDefinition(itemId) {
  return ITEM_DEFINITIONS[itemId] ?? null;
}

export function getItemMaxStack(itemId) {
  return getItemDefinition(itemId)?.inventory?.maxStack ?? Infinity;
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
    (definition) => definition.rarity === rarity
  );
}

export function getItemIdsByRarity(rarity) {
  return getItemDefinitionsByRarity(rarity).map((definition) => definition.id);
}
