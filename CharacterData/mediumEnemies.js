const MEDIUM_ENEMY_CHASE = {
  aggroRange: 2.3,
  leashDistance: 5.7,
  leashTime: 1.5,
};

export const MEDIUM_ENEMY_DEFINITIONS = [
  {
    id: "enemy_skeleton_01",
    name: "Skeleton",
    difficulty: "medium",
    modelId: "enemy_skeleton_01",
    maxHp: 70,
    speed: 1.4,
    attackDamage: 11,
    attackRange: 1.6,
    attackCooldown: 1.15,
    collisionRadius: 0.32,
    chase: { ...MEDIUM_ENEMY_CHASE },
  },
  {
    id: "enemy_zombie_01",
    name: "Zombie",
    difficulty: "medium",
    modelId: "enemy_zombie_01",
    maxHp: 90,
    speed: 0.85,
    attackDamage: 13,
    attackRange: 1.7,
    attackCooldown: 1.35,
    collisionRadius: 0.34,
    chase: { ...MEDIUM_ENEMY_CHASE },
  },
];
