const EASY_ENEMY_CHASE = {
  aggroRange: 2,
  leashDistance: 5.5,
  leashTime: 1.2,
};

export const EASY_ENEMY_DEFINITIONS = [
  {
    id: "enemy_hog_01",
    name: "Hog",
    difficulty: "easy",
    modelId: "enemy_hog_01",
    maxHp: 50,
    speed: 1.2,
    attackDamage: 8,
    attackRange: 1.6,
    attackCooldown: 1.2,
    collisionRadius: 0.32,
    chase: { ...EASY_ENEMY_CHASE },
  },
  {
    id: "enemy_crab_01",
    name: "Crab",
    difficulty: "easy",
    modelId: "enemy_crab_01",
    maxHp: 45,
    speed: 1,
    attackDamage: 7,
    attackRange: 1.45,
    attackCooldown: 1.1,
    collisionRadius: 0.3,
    chase: { ...EASY_ENEMY_CHASE },
  },
];
