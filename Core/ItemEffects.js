import { flatDistance } from "../Game/Utils.js";
import {
  ITEM_EFFECTS,
  getItemDefinition,
  getItemStats,
} from "../CharacterData/itemDefinitions.js";

export class ItemEffects {
  apply(itemOrId, context = {}) {
    const definition = this.getDefinition(itemOrId);
    if (!definition) {
      return {
        applied: false,
        consumed: false,
        reason: "unknownItem",
      };
    }

    switch (definition.effect) {
      case ITEM_EFFECTS.DAMAGE_UP:
        return this.applyDamageUp(itemOrId, context);

      case ITEM_EFFECTS.ATTACK_SPEED_UP:
        return this.applyAttackSpeedUp(itemOrId, context);

      case ITEM_EFFECTS.MAX_HP_UP:
        return this.applyMaxHpUp(itemOrId, context);

      case ITEM_EFFECTS.HEAL:
        return this.applyHeal(itemOrId, context);

      case ITEM_EFFECTS.STUN_ENEMY:
      case ITEM_EFFECTS.AREA_STUN_POISON:
        return this.applyAreaStunPoison(itemOrId, context);

      default:
        return {
          applied: false,
          consumed: false,
          reason: "unsupportedEffect",
        };
    }
  }

  revert(itemOrId, context = {}) {
    const definition = this.getDefinition(itemOrId);
    if (!definition) {
      return {
        applied: false,
        consumed: false,
        reason: "unknownItem",
      };
    }

    switch (definition.effect) {
      case ITEM_EFFECTS.DAMAGE_UP:
        return this.revertDamageUp(itemOrId, context);

      case ITEM_EFFECTS.ATTACK_SPEED_UP:
        return this.revertAttackSpeedUp(itemOrId, context);

      case ITEM_EFFECTS.MAX_HP_UP:
        return this.revertMaxHpUp(itemOrId, context);

      default:
        return {
          applied: false,
          consumed: false,
          reason: "unsupportedRevert",
        };
    }
  }

  applyEquipmentTotals({ player, previousTotals = {}, nextTotals = {} } = {}) {
    if (!player) return this.missingPlayerResult();

    const allStats = new Set([
      ...Object.keys(previousTotals),
      ...Object.keys(nextTotals),
    ]);
    const changedStats = [];
    let firstAmount = 0;

    for (const stat of allStats) {
      const previous = previousTotals[stat] ?? 0;
      const next = nextTotals[stat] ?? 0;
      const delta = next - previous;
      if (delta === 0) continue;

      this.applyStatDelta(player, stat, delta);
      if (changedStats.length === 0) {
        firstAmount = delta;
      }
      changedStats.push(stat);
    }

    if (player.hp > player.maxHp) {
      player.hp = player.maxHp;
    }

    return {
      applied: true,
      consumed: true,
      stat: changedStats[0] ?? null,
      stats: changedStats,
      amount: firstAmount,
      value: changedStats[0] ? player[changedStats[0]] : undefined,
      totals: { ...nextTotals },
    };
  }

  applyStatDelta(player, stat, delta) {
    switch (stat) {
      case "attackDamage":
        player.attackDamage = Math.max(0, (player.attackDamage ?? 0) + delta);
        break;

      case "attackSpeed": {
        const nextSpeed = (player.attackSpeed ?? 0) + delta;
        if (typeof player.setAttackSpeed === "function") {
          player.setAttackSpeed(nextSpeed);
        } else {
          player.attackSpeed = Math.max(0.1, nextSpeed);
          player.attackCooldown = 1 / player.attackSpeed;
        }
        break;
      }

      case "maxHp":
        player.maxHp = Math.max(1, (player.maxHp ?? 1) + delta);
        break;

      case "moveSpeed":
      case "speed":
        player.speed = Math.max(0.1, (player.speed ?? 0) + delta);
        break;
    }
  }

  applyDamageUp(itemOrDefinition, { player } = {}) {
    if (!player) return this.missingPlayerResult();

    const stats = getItemStats(itemOrDefinition);
    const amount = stats.attackDamage ?? 0;
    player.attackDamage += amount;

    return {
      applied: true,
      consumed: true,
      stat: "attackDamage",
      amount,
      value: player.attackDamage,
    };
  }

  applyAttackSpeedUp(itemOrDefinition, { player } = {}) {
    if (!player) return this.missingPlayerResult();

    const stats = getItemStats(itemOrDefinition);
    const amount = stats.attackSpeed ?? 0;
    const maxAttackSpeed = stats.maxAttackSpeed ?? Infinity;
    const previousValue =
      player.attackSpeed ?? (player.attackCooldown > 0 ? 1 / player.attackCooldown : 1);
    const nextValue = Math.min(maxAttackSpeed, previousValue + amount);

    if (typeof player.setAttackSpeed === "function") {
      player.setAttackSpeed(nextValue);
    } else {
      player.attackSpeed = nextValue;
      player.attackCooldown = 1 / nextValue;
    }

    return {
      applied: true,
      consumed: true,
      stat: "attackSpeed",
      amount: player.attackSpeed - previousValue,
      value: player.attackSpeed,
      attackCooldown: player.attackCooldown,
    };
  }

  applyMaxHpUp(itemOrDefinition, { player } = {}) {
    if (!player) return this.missingPlayerResult();

    const stats = getItemStats(itemOrDefinition);
    const maxHpIncrease = stats.maxHp ?? 0;
    const heal = stats.heal ?? 0;

    player.maxHp += maxHpIncrease;
    player.hp = Math.min(player.maxHp, player.hp + heal);

    return {
      applied: true,
      consumed: true,
      stat: "maxHp",
      amount: maxHpIncrease,
      value: player.maxHp,
      hp: player.hp,
    };
  }

  revertDamageUp(itemOrDefinition, { player } = {}) {
    if (!player) return this.missingPlayerResult();

    const stats = getItemStats(itemOrDefinition);
    const amount = stats.attackDamage ?? 0;
    player.attackDamage = Math.max(0, player.attackDamage - amount);

    return {
      applied: true,
      consumed: true,
      stat: "attackDamage",
      amount: -amount,
      value: player.attackDamage,
    };
  }

  revertAttackSpeedUp(itemOrDefinition, { player } = {}) {
    if (!player) return this.missingPlayerResult();

    const stats = getItemStats(itemOrDefinition);
    const amount = stats.attackSpeed ?? 0;
    const previousValue =
      player.attackSpeed ?? (player.attackCooldown > 0 ? 1 / player.attackCooldown : 1);
    const nextValue = previousValue - amount;

    if (typeof player.setAttackSpeed === "function") {
      player.setAttackSpeed(nextValue);
    } else {
      player.attackSpeed = Math.max(0.1, nextValue);
      player.attackCooldown = 1 / player.attackSpeed;
    }

    return {
      applied: true,
      consumed: true,
      stat: "attackSpeed",
      amount: player.attackSpeed - previousValue,
      value: player.attackSpeed,
      attackCooldown: player.attackCooldown,
    };
  }

  revertMaxHpUp(itemOrDefinition, { player } = {}) {
    if (!player) return this.missingPlayerResult();

    const stats = getItemStats(itemOrDefinition);
    const maxHpDecrease = stats.maxHp ?? 0;
    player.maxHp = Math.max(1, player.maxHp - maxHpDecrease);
    player.hp = Math.min(player.hp, player.maxHp);

    return {
      applied: true,
      consumed: true,
      stat: "maxHp",
      amount: -maxHpDecrease,
      value: player.maxHp,
      hp: player.hp,
    };
  }

  applyHeal(itemOrDefinition, { player } = {}) {
    if (!player) return this.missingPlayerResult();
    if (player.hp >= player.maxHp) {
      return {
        applied: false,
        consumed: false,
        reason: "fullHp",
      };
    }

    const stats = getItemStats(itemOrDefinition);
    const heal = stats.heal ?? 0;
    const previousHp = player.hp;
    player.hp = Math.min(player.maxHp, player.hp + heal);

    return {
      applied: true,
      consumed: true,
      stat: "hp",
      amount: player.hp - previousHp,
      value: player.hp,
      maxHp: player.maxHp,
    };
  }

  applyAreaStunPoison(itemOrDefinition, { player, enemies = [] } = {}) {
    if (!player) return this.missingPlayerResult();

    const definition = this.getDefinition(itemOrDefinition);
    const stats = getItemStats(itemOrDefinition);
    const radius = stats.radius ?? 3;
    const vfxRadius = stats.vfxRadius ?? radius;
    const stunDuration = stats.stunDuration ?? 3;
    const poisonDamagePerSecond = stats.poisonDamagePerSecond ?? 0;
    const poisonDuration = stats.poisonDuration ?? 0;
    const poisonTickInterval = stats.poisonTickInterval ?? 0.5;
    const center = player.model.position.clone();
    const targets = this.findEnemiesInRadius(center, enemies, radius);

    if (targets.length === 0) {
      return {
        applied: false,
        consumed: false,
        reason: "noEnemyInRange",
      };
    }

    for (const enemy of targets) {
      if (typeof enemy.applyStun === "function") {
        enemy.applyStun(stunDuration, player);
      }

      if (typeof enemy.applyPoison === "function") {
        enemy.applyPoison({
          damagePerSecond: poisonDamagePerSecond,
          duration: poisonDuration,
          tickInterval: poisonTickInterval,
          source: player,
          itemId: definition?.id,
        });
      }
    }

    const combatEnemy = targets.includes(player.currentEnemy)
      ? player.currentEnemy
      : targets[0];

    this.leavePlayerCombat(player, combatEnemy);

    return {
      applied: true,
      consumed: true,
      enemy: targets[0],
      enemies: targets,
      enemyCount: targets.length,
      center,
      duration: stunDuration,
      stunDuration,
      radius,
      vfxRadius,
      poisonDamagePerSecond,
      poisonDuration,
      poisonTickInterval,
    };
  }

  findEnemiesInRadius(center, enemies, radius) {
    return enemies
      .filter((enemy) => enemy?.alive)
      .map((enemy) => ({
        enemy,
        distance: flatDistance(center, enemy.model.position),
      }))
      .filter(({ distance }) => distance <= radius)
      .sort((a, b) => a.distance - b.distance)
      .map(({ enemy }) => enemy);
  }

  leavePlayerCombat(player, enemy) {
    if (typeof player.leaveCombat === "function") {
      player.leaveCombat(enemy);
      return;
    }

    player.currentEnemy = null;
    player.clearTarget?.();
  }

  missingPlayerResult() {
    return {
      applied: false,
      consumed: false,
      reason: "missingPlayer",
    };
  }

  getDefinition(itemOrId) {
    if (typeof itemOrId === "string") return getItemDefinition(itemOrId);

    return getItemDefinition(itemOrId?.baseItemId ?? itemOrId?.itemId ?? itemOrId?.id);
  }
}
