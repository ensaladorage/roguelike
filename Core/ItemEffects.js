import { flatDistance } from "../Game/Utils.js";
import {
  ITEM_EFFECTS,
  getItemDefinition,
} from "../CharacterData/itemDefinitions.js";

export class ItemEffects {
  apply(itemId, context = {}) {
    const definition = getItemDefinition(itemId);
    if (!definition) {
      return {
        applied: false,
        consumed: false,
        reason: "unknownItem",
      };
    }

    switch (definition.effect) {
      case ITEM_EFFECTS.DAMAGE_UP:
        return this.applyDamageUp(definition, context);

      case ITEM_EFFECTS.ATTACK_SPEED_UP:
        return this.applyAttackSpeedUp(definition, context);

      case ITEM_EFFECTS.MAX_HP_UP:
        return this.applyMaxHpUp(definition, context);

      case ITEM_EFFECTS.HEAL:
        return this.applyHeal(definition, context);

      case ITEM_EFFECTS.STUN_ENEMY:
        return this.applyEnemyStun(definition, context);

      default:
        return {
          applied: false,
          consumed: false,
          reason: "unsupportedEffect",
        };
    }
  }

  applyDamageUp(definition, { player } = {}) {
    if (!player) return this.missingPlayerResult();

    const amount = definition.modifiers?.attackDamage ?? 0;
    player.attackDamage += amount;

    return {
      applied: true,
      consumed: true,
      stat: "attackDamage",
      amount,
      value: player.attackDamage,
    };
  }

  applyAttackSpeedUp(definition, { player } = {}) {
    if (!player) return this.missingPlayerResult();

    const amount = definition.modifiers?.attackSpeed ?? 0;
    const maxAttackSpeed = definition.modifiers?.maxAttackSpeed ?? Infinity;
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

  applyMaxHpUp(definition, { player } = {}) {
    if (!player) return this.missingPlayerResult();

    const maxHpIncrease = definition.modifiers?.maxHp ?? 0;
    const heal = definition.modifiers?.heal ?? 0;

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

  applyHeal(definition, { player } = {}) {
    if (!player) return this.missingPlayerResult();
    if (player.hp >= player.maxHp) {
      return {
        applied: false,
        consumed: false,
        reason: "fullHp",
      };
    }

    const heal = definition.consumable?.heal ?? 0;
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

  applyEnemyStun(definition, { player, enemies = [] } = {}) {
    if (!player) return this.missingPlayerResult();

    const radius = definition.consumable?.radius ?? 3;
    const stunDuration = definition.consumable?.stunDuration ?? 3;
    const enemy = this.findStunTarget(player, enemies, radius);

    if (!enemy) {
      return {
        applied: false,
        consumed: false,
        reason: "noEnemyInRange",
      };
    }

    if (typeof enemy.applyStun === "function") {
      enemy.applyStun(stunDuration, player);
    }

    if (typeof player.leaveCombat === "function") {
      player.leaveCombat(enemy);
    } else {
      player.currentEnemy = null;
      player.clearTarget();
    }

    return {
      applied: true,
      consumed: true,
      enemy,
      duration: stunDuration,
      radius,
    };
  }

  findStunTarget(player, enemies, radius) {
    const currentEnemy = player.currentEnemy;
    if (currentEnemy?.alive) return currentEnemy;

    const playerPosition = player.model.position;

    return enemies
      .filter((enemy) => enemy?.alive && !enemy.isStunned?.())
      .map((enemy) => ({
        enemy,
        distance: flatDistance(playerPosition, enemy.model.position),
      }))
      .filter(({ distance }) => distance <= radius)
      .sort((a, b) => a.distance - b.distance)[0]?.enemy ?? null;
  }

  missingPlayerResult() {
    return {
      applied: false,
      consumed: false,
      reason: "missingPlayer",
    };
  }
}
