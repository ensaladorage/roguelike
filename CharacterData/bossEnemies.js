export const BOSS_ENEMY_DEFINITIONS = [
  {
    id: "boss_hollow_warden_01",
    name: "The Hollow Warden",
    difficulty: "hard",
    modelId: "enemy_boss_warden_01",
    isBoss: true,
    maxHp: 10,
    speed: 0.95,
    attackDamage: 25,
    attackRange: 2.3,
    attackCooldown: 1.8,
    collisionRadius: 0.72,
    chase: {
      aggroRange: 10,
      leashDistance: 24,
      leashTime: 8,
    },
    boss: {
      phaseTwoHpRatio: 0.5,
      phaseTwo: {
        name: "Rage",
        speedMultiplier: 1.22,
        attackDamageMultiplier: 1.18,
        attackCooldownMultiplier: 0.82,
      },
    },
  },
];
