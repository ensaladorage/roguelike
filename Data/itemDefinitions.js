export const ITEM_TYPES = {
  PASSIVE: "passive",
  CONSUMABLE: "consumable",
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
    name: "Bistec",
    type: ITEM_TYPES.PASSIVE,
    imagePath: "Assets/Images/Steak.png",
    effect: ITEM_EFFECTS.DAMAGE_UP,
    modifiers: {
      attackDamage: 5,
    },
  },

  chili: {
    id: "chili",
    name: "Chile",
    type: ITEM_TYPES.PASSIVE,
    imagePath: "Assets/Images/Chili.png",
    effect: ITEM_EFFECTS.ATTACK_SPEED_UP,
    modifiers: {
      attackCooldownMultiplier: 0.88,
      minAttackCooldown: 0.25,
    },
  },

  ramen: {
    id: "ramen",
    name: "Ramen",
    type: ITEM_TYPES.PASSIVE,
    imagePath: "Assets/Images/Ramen.png",
    effect: ITEM_EFFECTS.MAX_HP_UP,
    modifiers: {
      maxHp: 25,
      heal: 25,
    },
  },

  energyDrink: {
    id: "energyDrink",
    name: "Bebida energetica",
    type: ITEM_TYPES.CONSUMABLE,
    imagePath: "Assets/Images/EnergyDrink.png",
    effect: ITEM_EFFECTS.HEAL,
    inventory: {
      maxStack: 3,
    },
    consumable: {
      heal: 35,
    },
  },

  purpleShroom: {
    id: "purpleShroom",
    name: "Seta morada",
    type: ITEM_TYPES.CONSUMABLE,
    imagePath: "Assets/Images/PurpleShroom.pmg.png",
    effect: ITEM_EFFECTS.STUN_ENEMY,
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

export function getItemDefinitionsByType(type) {
  return Object.values(ITEM_DEFINITIONS).filter(
    (definition) => definition.type === type
  );
}
