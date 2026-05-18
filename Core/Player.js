import * as THREE from "three";

export const PLAYER_STATES = {
  IDLE: "idle",
  MOVING: "moving",
  COMBAT: "combat",
  DEAD: "dead",
};

export class Player {
  constructor(model) {
    this.model = model;
    this.groundY = model.position.y;

    this.state = PLAYER_STATES.IDLE;

    this.target = null;
    this.path = [];

    this.speed = 4.2;

    this.maxHp = 100;
    this.hp = this.maxHp;
    this.gold = 0;

    this.attackDamage = 10;
    this.attackRange = 1.65;
    this.attackCooldown = 0.7;
    this.attackTimer = 0;

    this.currentEnemy = null;

    this.events = [];

    // 🔥 IMPORTANTE
    // Guardamos la rotación visual aparte para evitar
    // que lookAt() rompa la dirección del personaje.
    this.visualRotation = 0;
  }

  setTarget(position) {
    if (this.state === PLAYER_STATES.COMBAT) return;
    if (this.state === PLAYER_STATES.DEAD) return;

    this.path = [];

    this.target = position.clone();
    this.target.y = this.groundY;

    this.state = PLAYER_STATES.MOVING;
  }

  setPath(points) {
    if (this.state === PLAYER_STATES.COMBAT) return;
    if (this.state === PLAYER_STATES.DEAD) return;
    if (!points || points.length === 0) return;

    this.path = points.map((point) => {
      const waypoint = point.clone();
      waypoint.y = this.groundY;
      return waypoint;
    });

    this.target = this.path.shift();
    this.state = PLAYER_STATES.MOVING;
  }

  setEnemy(enemy) {
    this.enterCombat(enemy);
  }

  enterCombat(enemy) {
    if (this.hp <= 0) return;
    if (!enemy || !enemy.alive) return;

    const wasInCombat =
      this.state === PLAYER_STATES.COMBAT;

    const isSameEnemy =
      this.currentEnemy === enemy;

    this.target = null;
    this.path = [];

    this.currentEnemy = enemy;
    this.state = PLAYER_STATES.COMBAT;

    if (!wasInCombat || !isSameEnemy) {
      this.attackTimer = this.attackCooldown;
    }

    if (wasInCombat && isSameEnemy) return;

    this.emit({
      type: "combatStart",
      enemy,
    });
  }

  addGold(amount) {
    if (this.state === PLAYER_STATES.DEAD) return;

    this.gold += amount;
  }

  takeDamage(amount, source) {
    if (this.state === PLAYER_STATES.DEAD) return 0;

    this.enterCombat(source);

    const previousHp = this.hp;

    this.hp = Math.max(
      0,
      this.hp - amount
    );

    const damageTaken =
      previousHp - this.hp;

    if (damageTaken <= 0) return 0;

    this.emit({
      type: "playerDamaged",
      source,
      damage: damageTaken,
      hp: this.hp,
      maxHp: this.maxHp,
    });

    if (this.hp <= 0) {
      this.die();
    }

    return damageTaken;
  }

  die() {
    if (this.state === PLAYER_STATES.DEAD) return;

    this.target = null;
    this.path = [];
    this.currentEnemy = null;

    this.state = PLAYER_STATES.DEAD;

    this.emit({
      type: "playerDefeated",
    });
  }

  collectChest(chest) {
    if (this.state === PLAYER_STATES.DEAD) return 0;
    if (chest.collected) return 0;

    chest.collected = true;

    this.addGold(chest.gold);

    return chest.gold;
  }

  clearTarget() {
    if (this.state === PLAYER_STATES.DEAD) return;

    this.target = null;
    this.path = [];

    this.state = PLAYER_STATES.IDLE;
  }

  emit(event) {
    this.events.push(event);
  }

  consumeEvents() {
    const events = this.events;
    this.events = [];

    return events;
  }

  update(delta) {
    switch (this.state) {
      case PLAYER_STATES.IDLE:
      case PLAYER_STATES.DEAD:
        break;

      case PLAYER_STATES.MOVING:
        this.updateMoving(delta);
        break;

      case PLAYER_STATES.COMBAT:
        this.updateCombat(delta);
        break;
    }
  }

  updateMoving(delta) {
    if (!this.target) {
      this.state = PLAYER_STATES.IDLE;
      return;
    }

    const toTarget =
      this.target.clone().sub(this.model.position);

    toTarget.y = 0;

    const distance = toTarget.length();

    if (distance < 0.08) {
      this.model.position.copy(this.target);

      if (this.path.length > 0) {
        this.target = this.path.shift();
      } else {
        this.target = null;
        this.state = PLAYER_STATES.IDLE;
      }

      return;
    }

    const step = Math.min(
      distance,
      this.speed * delta
    );

    const direction = toTarget.normalize();

    this.model.position.addScaledVector(
      direction,
      step
    );

    // 🔥 ROTACIÓN MANUAL LIMPIA
    this.visualRotation = Math.atan2(
      direction.x,
      direction.z
    );

    this.model.rotation.y =
      this.visualRotation;
  }

  updateCombat(delta) {
    if (
      !this.currentEnemy ||
      !this.currentEnemy.alive
    ) {
      this.currentEnemy = null;

      this.state = PLAYER_STATES.IDLE;

      return;
    }

    const enemyPos =
      this.currentEnemy.model.position;

    const dx =
      enemyPos.x - this.model.position.x;

    const dz =
      enemyPos.z - this.model.position.z;

    const distance =
      Math.sqrt(dx * dx + dz * dz);

    // 🔥 YA NO USAMOS lookAt()
    // porque rompe la rotación acumulada del modelo.
    const angle = Math.atan2(dx, dz);

    this.model.rotation.y = angle;

    if (distance > this.attackRange) return;

    this.attackTimer += delta;

    if (
      this.attackTimer <
      this.attackCooldown
    ) {
      return;
    }

    this.attackTimer = 0;

    if (!this.currentEnemy.takeDamage) return;

    const enemy = this.currentEnemy;

    const damageDone =
      enemy.takeDamage(
        this.attackDamage,
        this
      );

    this.emit({
      type: "playerAttack",
      enemy,
      damage: damageDone,
      enemyHp: enemy.hp,
    });

    if (!enemy.alive) {
      this.currentEnemy = null;

      this.state = PLAYER_STATES.IDLE;
    }
  }
}