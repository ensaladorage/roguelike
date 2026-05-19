import * as THREE from "three";
import { COIN_REWARD_SOURCE, getCoinReward } from "./Coin.js";

export const ENEMY_STATES = {
  PATROL: "patrol",
  COMBAT: "combat",
  DEAD: "dead",
};

export class EnemyAI {
  constructor(model, patrolPoints = [], options = {}) {
    this.model = model;

    this.state = ENEMY_STATES.PATROL;
    this.spawnPosition = model.position.clone();
    this.patrolPoints = patrolPoints.length > 0
      ? patrolPoints.map((point) => point.clone())
      : [model.position.clone()];
    this.currentPatrolIndex = 0;
    this.patrolPath = [];
    this.patrolMode = "moving";
    this.patrolMoveTimer = 0;
    this.patrolPauseTimer = 0;
    this.patrolMoveDuration = {
      min: options.patrolMoveDuration?.min ?? 2,
      max: options.patrolMoveDuration?.max ?? 4,
    };
    this.patrolPauseDurations = options.patrolPauseDurations ?? [0.5, 1];
    this.patrolAreas = (options.patrolAreas ?? []).map((area) => ({ ...area }));

    this.speed = 1.35;
    this.patrolStopRange = 0.08;
    this.collisionRadius = options.collisionRadius ?? 0.32;
    this.navigation = options.navigation ?? null;

    this.attackRange = 1.6;
    this.attackDamage = 8;
    this.attackCooldown = 1.2;
    this.attackTimer = 0;

    this.hp = 50;
    this.maxHp = this.hp;
    this.alive = true;
    this.target = null;
    this.events = [];
    this.hasTakenCombatHit = false;
    this.healthBar = this.createHealthBar();
    this.model.add(this.healthBar);

    this.chooseNextPatrolRoute();
  }

  update(delta, camera) {
    if (!this.alive) return;

    switch (this.state) {
      case ENEMY_STATES.PATROL:
        this.updatePatrol(delta);
        break;

      case ENEMY_STATES.COMBAT:
        this.updateCombat(delta);
        break;

      case ENEMY_STATES.DEAD:
        break;
    }

    this.updateHealthBarBillboard(camera);
  }

  startCombat(target) {
    if (!this.alive) return;
    if (!target || target.hp <= 0) return;

    const alreadyInCombat = this.state === ENEMY_STATES.COMBAT;

    this.target = target;
    this.state = ENEMY_STATES.COMBAT;

    if (!alreadyInCombat) {
      this.attackTimer = 0;
      this.hasTakenCombatHit = false;
      this.healthBar.visible = false;
      this.emit({
        type: "enemyStateChanged",
        enemy: this,
        state: this.state,
      });
    }
  }

  stopCombat() {
    if (!this.alive) return;

    this.target = null;
    this.state = ENEMY_STATES.PATROL;
    this.healthBar.visible = false;
    this.startPatrolPause();

    this.emit({
      type: "enemyStateChanged",
      enemy: this,
      state: this.state,
    });
  }

  updatePatrol(delta) {
    if (this.patrolMode === "waiting") {
      this.patrolPauseTimer -= delta;

      if (this.patrolPauseTimer <= 0) {
        this.chooseNextPatrolRoute();
      }

      return;
    }

    this.patrolMoveTimer -= delta;

    if (this.patrolMoveTimer <= 0) {
      this.startPatrolPause();
      return;
    }

    if (this.patrolPath.length === 0) {
      this.chooseNextPatrolRoute();
      return;
    }

    const target = this.patrolPath[0];
    const movement = this.moveTo(target, delta, this.patrolStopRange);

    if (movement.blocked) {
      this.startPatrolPause();
      return;
    }

    if (movement.arrived) {
      this.patrolPath.shift();

      if (this.patrolPath.length === 0) {
        this.startPatrolPause();
      }
    }
  }

  updateCombat(delta) {
    if (!this.target || this.target.hp <= 0) {
      this.stopCombat();
      return;
    }

    const targetPos = this.target.model.position;
    const distance = this.flatDistance(targetPos, this.model.position);

    this.face(targetPos);

    if (distance > this.attackRange) return;

    this.attackTimer += delta;

    if (this.attackTimer < this.attackCooldown) return;

    this.attackTimer = 0;

    this.emit({
      type: "enemyAttack",
      enemy: this,
      damage: this.attackDamage,
    });

    this.target.takeDamage(this.attackDamage, this);
  }

  chooseNextPatrolRoute() {
    for (let i = 0; i < 8; i += 1) {
      const target = this.pickRandomPatrolTarget();

      if (!target) break;

      const path = this.getNavigationPath(this.model.position, target);

      if (path.length === 0) continue;

      this.patrolPath = path;
      this.patrolMoveTimer = this.randomRange(
        this.patrolMoveDuration.min,
        this.patrolMoveDuration.max
      );
      this.patrolMode = "moving";
      return;
    }

    this.useAuthoredPatrolFallback();
  }

  pickRandomPatrolTarget() {
    if (this.navigation?.getRandomWalkablePoint) {
      const point = this.navigation.getRandomWalkablePoint(
        this.patrolAreas,
        this.collisionRadius,
        this.model.position
      );

      if (point) return point;
    }

    return this.pickRandomAuthoredPatrolPoint();
  }

  pickRandomAuthoredPatrolPoint() {
    if (this.patrolPoints.length === 0) return null;

    const target =
      this.patrolPoints[Math.floor(Math.random() * this.patrolPoints.length)];

    return target.clone();
  }

  getNavigationPath(from, to) {
    if (this.navigation?.findPath) {
      const path = this.navigation.findPath(from, to, this.collisionRadius);

      if (path.length > 0) {
        return path.map((point) => this.toGroundPoint(point));
      }
    }

    if (this.canMoveBetween(from, to)) {
      return [this.toGroundPoint(to)];
    }

    return [];
  }

  useAuthoredPatrolFallback() {
    if (this.patrolPoints.length === 0) return;

    const target = this.patrolPoints[this.currentPatrolIndex];
    this.currentPatrolIndex =
      (this.currentPatrolIndex + 1) % this.patrolPoints.length;

    const path = this.getNavigationPath(this.model.position, target);

    if (path.length === 0) {
      this.startPatrolPause();
      return;
    }

    this.patrolPath = path;
    this.patrolMoveTimer = this.randomRange(
      this.patrolMoveDuration.min,
      this.patrolMoveDuration.max
    );
    this.patrolMode = "moving";
  }

  startPatrolPause() {
    this.patrolPath = [];
    this.patrolMode = "waiting";
    this.patrolPauseTimer =
      this.patrolPauseDurations[
        Math.floor(Math.random() * this.patrolPauseDurations.length)
      ] ?? 0.5;
  }

  moveTo(target, delta, stopRange) {
    const dir = new THREE.Vector3().subVectors(target, this.model.position);
    dir.y = 0;

    const distance = dir.length();

    if (distance <= stopRange) {
      this.model.position.x = target.x;
      this.model.position.z = target.z;
      return { arrived: true, blocked: false };
    }

    dir.normalize();

    const step = Math.min(distance, this.speed * delta);
    const previousPosition = this.model.position.clone();
    const desiredPosition = previousPosition.clone().addScaledVector(dir, step);
    const nextPosition = this.resolveMovement(previousPosition, desiredPosition);

    if (!nextPosition) {
      return { arrived: false, blocked: true };
    }

    this.model.position.copy(nextPosition);
    this.face(target);

    return { arrived: false, blocked: false };
  }

  resolveMovement(previousPosition, desiredPosition) {
    if (this.canMoveBetween(previousPosition, desiredPosition)) {
      return desiredPosition;
    }

    const candidates = [
      new THREE.Vector3(
        desiredPosition.x,
        previousPosition.y,
        previousPosition.z
      ),
      new THREE.Vector3(
        previousPosition.x,
        previousPosition.y,
        desiredPosition.z
      ),
    ];

    const validCandidates = candidates.filter((candidate) =>
      this.canMoveBetween(previousPosition, candidate)
    );

    if (validCandidates.length === 0) return null;

    validCandidates.sort(
      (a, b) =>
        a.distanceToSquared(desiredPosition) -
        b.distanceToSquared(desiredPosition)
    );

    return validCandidates[0];
  }

  canMoveBetween(from, to) {
    if (!this.navigation?.canMoveBetween) return true;

    return this.navigation.canMoveBetween(from, to, this.collisionRadius);
  }

  toGroundPoint(point) {
    return new THREE.Vector3(point.x, this.model.position.y, point.z);
  }

  randomRange(min, max) {
    return min + Math.random() * (max - min);
  }

  takeDamage(amount, source) {
    if (!this.alive) return 0;

    const previousHp = this.hp;
    this.hp = Math.max(0, this.hp - amount);
    const damageTaken = previousHp - this.hp;

    if (damageTaken <= 0) return 0;

    this.emit({
      type: "enemyDamaged",
      enemy: this,
      source,
      damage: damageTaken,
      hp: this.hp,
    });

    if (this.state === ENEMY_STATES.COMBAT) {
      this.hasTakenCombatHit = true;
      this.healthBar.visible = true;
    }

    this.updateHealthBar();

    if (this.hp <= 0) {
      this.die();
    }

    return damageTaken;
  }

  die() {
    if (!this.alive) return;

    this.alive = false;
    this.target = null;
    this.state = ENEMY_STATES.DEAD;
    this.model.visible = false;
    this.healthBar.visible = false;

    this.emit({
      type: "enemyCoinsDropped",
      enemy: this,
      coins: this.createCoinDrops(),
    });

    this.emit({
      type: "enemyDefeated",
      enemy: this,
    });
  }

  createCoinDrops() {
    const coins = [];
    const coinReward = getCoinReward(COIN_REWARD_SOURCE.ENEMY);
    const count = Math.max(0, coinReward.count);
    if (count === 0) return coins;

    const origin = this.model.position.clone();

    const forward = new THREE.Vector3(0, 0, 1)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), this.model.rotation.y)
      .normalize();

    const right = new THREE.Vector3(forward.z, 0, -forward.x);

    for (let i = 0; i < count; i += 1) {
      const centered = i - (count - 1) / 2;
      const sideOffset = centered * 0.42 + (Math.random() * 0.18 - 0.09);
      const ringOffset = Math.abs(centered) % 2 === 0 ? 0 : 0.16;
      const distance = coinReward.radius + 0.45 + ringOffset + (Math.random() * 0.18 - 0.09);

      const position = origin
        .clone()
        .addScaledVector(forward, distance)
        .addScaledVector(right, sideOffset);

      coins.push({
        value: coinReward.value,
        position: new THREE.Vector3(position.x, 0, position.z),
        fallbackOrigin: origin.clone(),
      });
    }

    console.log("enemyCoinsDropped", {
      count: coins.length,
      value: coinReward.value,
    });

    return coins;
  }

  face(target) {
    this.model.lookAt(target.x, this.model.position.y, target.z);
  }

  createHealthBar() {
    const group = new THREE.Group();
    group.name = "healthBar";
    group.visible = false;
    group.position.set(0, 0.9, 0);

    const background = new THREE.Mesh(
      new THREE.BoxGeometry(1.05, 0.12, 0.05),
      new THREE.MeshBasicMaterial({ color: 0x151515 })
    );
    background.userData.ignoreFlash = true;

    const fill = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 0.08, 0.06),
      new THREE.MeshBasicMaterial({ color: 0x56c271 })
    );

    fill.name = "healthFill";
    fill.position.z = 0.01;
    fill.userData.ignoreFlash = true;

    group.add(background);
    group.add(fill);

    return group;
  }

  updateHealthBar() {
    const fill = this.healthBar.getObjectByName("healthFill");
    if (!fill) return;

    const ratio = Math.max(0, Math.min(1, this.hp / this.maxHp));

    fill.scale.x = ratio;
    fill.position.x = -0.475 * (1 - ratio);

    if (ratio <= 0.35) {
      fill.material.color.setHex(0xd84848);
    } else if (ratio <= 0.65) {
      fill.material.color.setHex(0xd9c35f);
    } else {
      fill.material.color.setHex(0x56c271);
    }
  }

  updateHealthBarBillboard(camera) {
    if (!camera || !this.healthBar.visible) return;

    const parentWorldRotation = new THREE.Quaternion();
    this.model.getWorldQuaternion(parentWorldRotation);

    this.healthBar.quaternion.copy(parentWorldRotation.invert());
    this.healthBar.quaternion.multiply(camera.quaternion);
  }

  flatDistance(a, b) {
    const dx = a.x - b.x;
    const dz = a.z - b.z;

    return Math.sqrt(dx * dx + dz * dz);
  }

  emit(event) {
    this.events.push(event);
  }

  consumeEvents() {
    const events = this.events;
    this.events = [];

    return events;
  }
}
