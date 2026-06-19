const HARD_ENEMY_CHASE = {
  aggroRange: 2.5,
  leashDistance: 6,
  leashTime: 1.8,
};

export const HARD_ENEMY_DEFINITIONS = [
  {
    id: "enemy_orc_01",
    name: "Orc",
    difficulty: "hard",
    modelId: "enemy_orc_01",
    maxHp: 120,
    speed: 1.1,
    attackDamage: 20,
    attackRange: 1.8,
    attackCooldown: 1.2,
    collisionRadius: 0.38,
    chase: { ...HARD_ENEMY_CHASE },
  },
  {
    id: "enemy_vampire_01",
    name: "Vampire",
    difficulty: "hard",
    modelId: "enemy_vampire_01",
    maxHp: 95,
    speed: 1.55,
    attackDamage: 12,
    attackRange: 1.75,
    attackCooldown: 1,
    collisionRadius: 0.32,
    chase: { ...HARD_ENEMY_CHASE },
  },
];
