import * as THREE from "three";
import { splitCoinValueIntoTypes } from "../Game/Coin.js";

export const ENEMY_POTION_DROP = {
  itemId: "energyDrink",
  chancePercent: 10,
  radius: 0.82,
};

export const ENEMY_COIN_DROP = {
  totalValueMin: 2,
  totalValueMax: 5,
  radius: 0.7,
};

const ENEMY_CHASE_DEFAULTS = {
  pathRefreshTime: 0.25,
  aggroRange: 5.5,
  movementSpeedMultiplier: 1.5,
  attackTimerOutOfRangeGrace: 0.2,
  easy: {
    leashDistance: 5.5,
    leashTime: 1.2,
  },
  medium: {
    leashDistance: 5.7,
    leashTime: 1.5,
  },
  hard: {
    leashDistance: 6,
    leashTime: 1.8,
  },
};

const ENEMY_PATROL_REGEN = {
  maxHpPercentPerSecond: 2,
};

const STUN_MARKER_INNER_RADIUS = 0.5;
const STUN_MARKER_OUTER_RADIUS = 0.58;
const STUN_MARKER_Y = 0.055;
const STUN_MARKER_RENDER_ORDER = 86;
const STUN_MARKER_BASE_COLOR = 0x7f3cff;
const STUN_MARKER_PULSE_COLOR = 0xd8a8ff;
const STUN_MARKER_BASE_OPACITY = 0.72;
const STUN_MARKER_PULSE_OPACITY = 0.96;
const STUN_MARKER_PULSE_SCALE = 0.14;
const STUN_MARKER_PULSE_SPEED = 4.8;

export const ENEMY_STATES = {
  PATROL: "patrol",
  CHASE: "chase",
  RETURNING: "returning",
  STUNNED: "stunned",
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
    this.returnPath = [];

    this.enemyTypeId = options.enemyTypeId ?? "enemy_unknown";
    this.enemyName = options.enemyName ?? "Enemy";
    this.enemyDifficulty = options.enemyDifficulty ?? "easy";

    this.speed = options.speed ?? 1.2;
    this.patrolStopRange = options.patrolStopRange ?? 0.08;
    this.collisionRadius = options.collisionRadius ?? 0.32;
    this.navigation = options.navigation ?? null;
    this.movementPauseReasons = new Set();

    this.attackRange = options.attackRange ?? 1.6;
    this.attackDamage = options.attackDamage ?? 8;
    this.attackCooldown = options.attackCooldown ?? 1.2;
    this.attackTimer = 0;
    this.attackOutOfRangeTimer = 0;
    this.chasePath = [];
    this.chasePathRefreshTimer = 0;
    this.leashTimer = 0;
    this.stunTimer = 0;
    this.coinDropConfig = {
      ...ENEMY_COIN_DROP,
      ...(options.coinDrop ?? {}),
    };
    this.potionDropConfig = {
      ...ENEMY_POTION_DROP,
      ...(options.potionDrop ?? {}),
    };

    this.maxHp = options.maxHp ?? options.hp ?? 50;
    this.hp = options.hp ?? this.maxHp;
    this.patrolRegenPercentPerSecond = this.normalizePercentChance(
      options.patrolRegenPercentPerSecond ??
        ENEMY_PATROL_REGEN.maxHpPercentPerSecond
    );
    this.isRegeneratingAfterLeash = false;
    this.alive = true;
    this.target = null;
    this.events = [];
    this.hasTakenCombatHit = this.hp < this.maxHp;
    this.healthBar = this.createHealthBar();
    this.model.add(this.healthBar);
    this.stunMarkerPulseTime = 0;
    this.stunMarkerBaseColor = new THREE.Color(STUN_MARKER_BASE_COLOR);
    this.stunMarkerPulseColor = new THREE.Color(STUN_MARKER_PULSE_COLOR);
    this.stunMarker = this.createStunMarker();
    this.model.add(this.stunMarker);

    this.chooseNextPatrolRoute();
  }

  update(delta, camera, player = null) {
    if (!this.alive) return;

    switch (this.state) {
      case ENEMY_STATES.PATROL:
        if (this.shouldAggroFromProximity(player)) {
          this.startChase(player, "proximity");
          this.updateChase(delta);
          break;
        }

        this.updatePatrol(delta);
        break;

      case ENEMY_STATES.CHASE:
        this.updateChase(delta);
        break;

      case ENEMY_STATES.RETURNING:
        this.updateReturning(delta);
        break;

      case ENEMY_STATES.STUNNED:
        this.updateStunned(delta);
        break;

      case ENEMY_STATES.DEAD:
        break;
    }

    this.updateStunMarker(delta);
    this.updateHealthBarBillboard(camera);
  }

  startCombat(target) {
    this.startChase(target, "combat");
  }

  startChase(target, reason = "damage") {
    if (!this.alive) return;
    if (this.isStunned()) return;
    if (!target || target.hp <= 0) return;

    const alreadyChasing =
      this.state === ENEMY_STATES.CHASE &&
      this.target === target;

    this.target = target;
    this.state = ENEMY_STATES.CHASE;
    this.returnPath = [];
    this.isRegeneratingAfterLeash = false;

    if (!alreadyChasing) {
      this.attackTimer = 0;
      this.attackOutOfRangeTimer = 0;
      this.hasTakenCombatHit =
        this.hasTakenCombatHit || this.hp < this.maxHp;
      this.chasePath = [];
      this.chasePathRefreshTimer = 0;
      this.leashTimer = 0;
      this.updateHealthBarVisibility();
      this.emit({
        type: "enemyStateChanged",
        enemy: this,
        state: this.state,
        reason,
      });
    }
  }

  stopCombat() {
    if (!this.alive) return;

    this.target = null;
    this.chasePath = [];
    this.returnPath = [];
    this.leashTimer = 0;
    this.attackOutOfRangeTimer = 0;
    this.state = ENEMY_STATES.PATROL;
    this.updateHealthBarVisibility();
    this.isRegeneratingAfterLeash = false;
    this.startPatrolPause();

    this.emit({
      type: "enemyStateChanged",
      enemy: this,
      state: this.state,
    });
  }

  applyStun(duration = 3, source = null) {
    if (!this.alive) return;

    this.target = null;
    this.patrolPath = [];
    this.chasePath = [];
    this.returnPath = [];
    this.attackTimer = 0;
    this.attackOutOfRangeTimer = 0;
    this.leashTimer = 0;
    this.stunTimer = Math.max(this.stunTimer, duration);
    this.state = ENEMY_STATES.STUNNED;
    this.updateHealthBarVisibility();
    this.isRegeneratingAfterLeash = false;
    this.setStunMarkerVisible(true);

    this.emit({
      type: "enemyStunned",
      enemy: this,
      source,
      duration: this.stunTimer,
    });
  }

  updateStunned(delta) {
    this.stunTimer -= delta;

    if (this.stunTimer > 0) return;

    this.stunTimer = 0;
    this.state = ENEMY_STATES.PATROL;
    this.target = null;
    this.chasePath = [];
    this.returnPath = [];
    this.setStunMarkerVisible(false);
    this.startPatrolPause();

    this.emit({
      type: "enemyStunEnded",
      enemy: this,
      state: this.state,
    });
  }

  isStunned() {
    return this.state === ENEMY_STATES.STUNNED || this.stunTimer > 0;
  }

  updatePatrol(delta) {
    this.updatePatrolRegeneration(delta);

    if (this.isMovementPaused()) return;

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

  shouldAggroFromProximity(player) {
    if (!player || player.hp <= 0) return false;
    if (this.enemyDifficulty === "easy") return false;
    if (!["medium", "hard"].includes(this.enemyDifficulty)) return false;

    const distance = this.flatDistance(player.model.position, this.model.position);

    return distance <= ENEMY_CHASE_DEFAULTS.aggroRange;
  }

  updateChase(delta) {
    if (!this.target || this.target.hp <= 0) {
      this.stopCombat();
      return;
    }

    const targetPos = this.target.model.position;
    const distance = this.flatDistance(targetPos, this.model.position);

    this.face(targetPos);
    this.updateLeash(delta, distance);

    if (this.state !== ENEMY_STATES.CHASE) return;

    const isInAttackRange = distance <= this.attackRange;

    this.updateAttackTimer(delta, isInAttackRange);

    if (!isInAttackRange) {
      this.moveTowardChaseTarget(delta, targetPos);
      return;
    }

    if (this.attackTimer < this.attackCooldown) return;

    this.attackTimer = 0;

    this.emit({
      type: "enemyAttack",
      enemy: this,
      damage: this.attackDamage,
    });

    this.target.takeDamage(this.attackDamage, this);
  }

  updateLeash(delta, distance) {
    const chaseConfig = this.getChaseConfig();

    if (distance <= chaseConfig.leashDistance) {
      this.leashTimer = 0;
      return;
    }

    this.leashTimer += delta;

    if (this.leashTimer < chaseConfig.leashTime) return;

    this.loseChaseTarget();
  }

  loseChaseTarget() {
    this.target = null;
    this.chasePath = [];
    this.leashTimer = 0;
    this.attackOutOfRangeTimer = 0;
    this.startPatrolRegeneration();

    if (this.enemyDifficulty === "easy") {
      this.state = ENEMY_STATES.RETURNING;
      this.returnPath = [];
    } else {
      this.patrolAreas = [];
      this.patrolPoints = [this.model.position.clone()];
      this.currentPatrolIndex = 0;
      this.state = ENEMY_STATES.PATROL;
      this.startPatrolPause();
    }

    this.emit({
      type: "enemyStateChanged",
      enemy: this,
      state: this.state,
      reason: "leash",
    });
  }

  moveTowardChaseTarget(delta, targetPos) {
    if (this.isMovementPaused()) return;

    this.chasePathRefreshTimer -= delta;

    if (this.chasePathRefreshTimer <= 0 || this.chasePath.length === 0) {
      this.chasePath = this.getNavigationPath(this.model.position, targetPos);
      this.chasePathRefreshTimer = ENEMY_CHASE_DEFAULTS.pathRefreshTime;
    }

    if (this.chasePath.length === 0) return;

    const target = this.chasePath[0];
    const isFinalWaypoint = this.chasePath.length === 1;
    const movement = this.moveTo(
      target,
      delta,
      isFinalWaypoint ? this.getAttackStopRange() : this.patrolStopRange,
      {
        snapOnArrive: !isFinalWaypoint,
        speedMultiplier: ENEMY_CHASE_DEFAULTS.movementSpeedMultiplier,
      }
    );

    if (movement.blocked) {
      this.chasePath = [];
      this.chasePathRefreshTimer = 0;
      return;
    }

    if (movement.arrived) {
      this.chasePath.shift();
    }
  }

  updateReturning(delta) {
    this.updatePatrolRegeneration(delta);

    if (this.isMovementPaused()) return;

    const distance = this.flatDistance(this.spawnPosition, this.model.position);

    if (distance <= this.patrolStopRange) {
      this.model.position.x = this.spawnPosition.x;
      this.model.position.z = this.spawnPosition.z;
      this.returnPath = [];
      this.state = ENEMY_STATES.PATROL;
      this.startPatrolPause();
      this.emit({
        type: "enemyStateChanged",
        enemy: this,
        state: this.state,
        reason: "returned",
      });
      return;
    }

    if (this.returnPath.length === 0) {
      this.returnPath = this.getNavigationPath(
        this.model.position,
        this.spawnPosition
      );
    }

    if (this.returnPath.length === 0) return;

    const movement = this.moveTo(
      this.returnPath[0],
      delta,
      this.patrolStopRange
    );

    if (movement.blocked) {
      this.returnPath = [];
      return;
    }

    if (movement.arrived) {
      this.returnPath.shift();
    }
  }

  pauseMovement(reason = "external") {
    const wasPaused = this.isMovementPaused();
    this.movementPauseReasons.add(reason);

    if (wasPaused) return;

    this.emit({
      type: "enemyMovementPaused",
      enemy: this,
      reason,
    });
  }

  resumeMovement(reason = "external") {
    const wasPaused = this.isMovementPaused();
    this.movementPauseReasons.delete(reason);

    if (!wasPaused || this.isMovementPaused()) return;

    this.emit({
      type: "enemyMovementResumed",
      enemy: this,
      reason,
    });
  }

  isMovementPaused() {
    return this.movementPauseReasons.size > 0;
  }

  getAttackStopRange() {
    return this.attackRange * 0.9;
  }

  advanceAttackTimer(delta) {
    this.attackTimer = Math.min(
      this.attackCooldown,
      this.attackTimer + delta
    );
  }

  updateAttackTimer(delta, isInAttackRange) {
    if (isInAttackRange) {
      this.attackOutOfRangeTimer = 0;
      this.advanceAttackTimer(delta);
      return;
    }

    const graceRemaining = Math.max(
      0,
      ENEMY_CHASE_DEFAULTS.attackTimerOutOfRangeGrace -
        this.attackOutOfRangeTimer
    );

    if (graceRemaining > 0) {
      this.advanceAttackTimer(Math.min(delta, graceRemaining));
    }

    this.attackOutOfRangeTimer += delta;
  }

  getChaseConfig() {
    return (
      ENEMY_CHASE_DEFAULTS[this.enemyDifficulty] ??
      ENEMY_CHASE_DEFAULTS.easy
    );
  }

  startPatrolRegeneration() {
    this.updateHealthBarVisibility();
    this.isRegeneratingAfterLeash =
      this.alive &&
      this.hp > 0 &&
      this.hp < this.maxHp &&
      this.patrolRegenPercentPerSecond > 0;
  }

  updatePatrolRegeneration(delta) {
    if (!this.isRegeneratingAfterLeash) return;
    if (
      this.state !== ENEMY_STATES.PATROL &&
      this.state !== ENEMY_STATES.RETURNING
    ) {
      return;
    }
    if (this.hp >= this.maxHp) {
      this.isRegeneratingAfterLeash = false;
      this.updateHealthBarVisibility();
      return;
    }

    const regenPerSecond =
      this.maxHp * (this.patrolRegenPercentPerSecond / 100);
    this.hp = Math.min(this.maxHp, this.hp + regenPerSecond * delta);

    if (this.hp >= this.maxHp) {
      this.hp = this.maxHp;
      this.isRegeneratingAfterLeash = false;
    }

    this.updateHealthBar();
    this.updateHealthBarVisibility();
  }

  updateHealthBarVisibility() {
    if (!this.healthBar) return;

    this.healthBar.visible =
      this.alive &&
      this.model.visible !== false &&
      this.hasTakenCombatHit &&
      this.hp > 0 &&
      this.hp < this.maxHp;
  }

  chooseNextPatrolRoute() {
    for (let i = 0; i < 8; i += 1) {
      const target = this.pickRandomPatrolTarget();

      if (!target) break;

      const path = this.getPatrolNavigationPath(this.model.position, target);

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

  getPatrolNavigationPath(from, to) {
    if (!this.isWithinPatrolAreas(from) || !this.isWithinPatrolAreas(to)) {
      return [];
    }

    const path = this.getNavigationPath(from, to);

    if (!this.isPatrolPathWithinAreas(path)) {
      return [];
    }

    return path;
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

    const path = this.getPatrolNavigationPath(this.model.position, target);

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

  isPatrolPathWithinAreas(path) {
    return path.every((point) => this.isWithinPatrolAreas(point));
  }

  isWithinPatrolAreas(point) {
    if (this.patrolAreas.length === 0) return true;

    return this.patrolAreas.some((area) =>
      point.x >= area.x - area.w / 2 &&
      point.x <= area.x + area.w / 2 &&
      point.z >= area.z - area.d / 2 &&
      point.z <= area.z + area.d / 2
    );
  }

  moveTo(target, delta, stopRange, options = {}) {
    const snapOnArrive = options.snapOnArrive ?? true;
    const speedMultiplier = options.speedMultiplier ?? 1;
    const dir = new THREE.Vector3().subVectors(target, this.model.position);
    dir.y = 0;

    const distance = dir.length();

    if (distance <= stopRange) {
      if (snapOnArrive) {
        this.model.position.x = target.x;
        this.model.position.z = target.z;
      }

      return { arrived: true, blocked: false };
    }

    dir.normalize();

    const step = Math.min(distance, this.speed * speedMultiplier * delta);
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

    if (this.hp <= 0) {
      this.die();
    } else if (source?.model) {
      this.startChase(source, "damage");
    }

    this.hasTakenCombatHit = true;
    this.updateHealthBar();
    this.updateHealthBarVisibility();

    return damageTaken;
  }

  die() {
    if (!this.alive) return;

    this.alive = false;
    this.target = null;
    this.chasePath = [];
    this.returnPath = [];
    this.state = ENEMY_STATES.DEAD;
    this.model.visible = false;
    this.healthBar.visible = false;
    this.setStunMarkerVisible(false);

    this.emit({
      type: "enemyCoinsDropped",
      enemy: this,
      coins: this.createCoinDrops(),
    });

    const potionDrops = this.createPotionDrops();
    if (potionDrops.length > 0) {
      this.emit({
        type: "enemyItemsDropped",
        enemy: this,
        items: potionDrops,
      });
    }

    this.emit({
      type: "enemyDefeated",
      enemy: this,
    });
  }

  createCoinDrops() {
    const coins = [];
    const totalValue = this.rollIntegerRange(
      this.coinDropConfig.totalValueMin,
      this.coinDropConfig.totalValueMax
    );
    const coinTypes = splitCoinValueIntoTypes(totalValue);
    const count = coinTypes.length;

    if (count === 0) return coins;

    const origin = this.model.position.clone();

    const forward = new THREE.Vector3(0, 0, 1)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), this.model.rotation.y)
      .normalize();

    const right = new THREE.Vector3(forward.z, 0, -forward.x);

    for (let i = 0; i < count; i += 1) {
      const coinType = coinTypes[i];
      const centered = i - (count - 1) / 2;
      const sideOffset = centered * 0.42 + (Math.random() * 0.18 - 0.09);
      const ringOffset = Math.abs(centered) % 2 === 0 ? 0 : 0.16;
      const distance =
        this.coinDropConfig.radius +
        0.45 +
        ringOffset +
        (Math.random() * 0.18 - 0.09);

      const position = origin
        .clone()
        .addScaledVector(forward, distance)
        .addScaledVector(right, sideOffset);

      coins.push({
        typeId: coinType.typeId,
        value: coinType.value,
        position: new THREE.Vector3(position.x, 0, position.z),
        fallbackOrigin: origin.clone(),
      });
    }

    console.log("enemyCoinsDropped", {
      totalValue,
      count: coins.length,
      breakdown: coins.map((coin) => ({
        typeId: coin.typeId,
        value: coin.value,
      })),
      totalValueMin: this.coinDropConfig.totalValueMin,
      totalValueMax: this.coinDropConfig.totalValueMax,
    });

    return coins;
  }

  createPotionDrops() {
    const roll = this.rollPercentChance(this.potionDropConfig.chancePercent);
    console.log("enemyPotionDropRoll", {
      itemId: this.potionDropConfig.itemId,
      chancePercent: this.potionDropConfig.chancePercent,
      roll: roll.value,
      spawned: roll.success,
    });

    if (!roll.success) return [];

    const origin = this.model.position.clone();

    const forward = new THREE.Vector3(0, 0, 1)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), this.model.rotation.y)
      .normalize();

    const position = origin
      .clone()
      .addScaledVector(forward, this.potionDropConfig.radius);

    console.log("enemyPotionDropped", {
      itemId: this.potionDropConfig.itemId,
      chancePercent: this.potionDropConfig.chancePercent,
    });

    return [
      {
        itemId: this.potionDropConfig.itemId,
        position: new THREE.Vector3(position.x, 0, position.z),
        fallbackOrigin: origin.clone(),
      },
    ];
  }

  rollPercentChance(chancePercent) {
    const safeChancePercent = this.normalizePercentChance(chancePercent);
    const value = Math.random() * 100;

    return {
      value: Number(value.toFixed(2)),
      success: value < safeChancePercent,
    };
  }

  normalizePercentChance(chancePercent) {
    const numericChance = Number.parseFloat(chancePercent);

    if (!Number.isFinite(numericChance)) return 0;

    return Math.max(0, Math.min(100, numericChance));
  }

  rollIntegerRange(min, max) {
    const safeMin = Math.ceil(Math.min(min, max));
    const safeMax = Math.floor(Math.max(min, max));

    return safeMin + Math.floor(Math.random() * (safeMax - safeMin + 1));
  }

  face(target) {
    this.model.lookAt(target.x, this.model.position.y, target.z);
  }

  createStunMarker() {
    const group = new THREE.Group();
    group.name = "enemyStunMarker";
    group.visible = false;
    group.position.y = STUN_MARKER_Y;
    group.renderOrder = STUN_MARKER_RENDER_ORDER;
    group.userData.ignoreFlash = true;

    const material = new THREE.MeshBasicMaterial({
      color: STUN_MARKER_BASE_COLOR,
      transparent: true,
      opacity: STUN_MARKER_BASE_OPACITY,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(
        STUN_MARKER_INNER_RADIUS,
        STUN_MARKER_OUTER_RADIUS,
        64
      ),
      material
    );
    ring.name = "enemyStunRing";
    ring.rotation.x = -Math.PI / 2;
    ring.renderOrder = STUN_MARKER_RENDER_ORDER;
    ring.userData.ignoreFlash = true;

    group.add(ring);

    return group;
  }

  setStunMarkerVisible(visible) {
    if (!this.stunMarker) return;

    this.stunMarker.visible = Boolean(visible);

    if (visible) {
      this.stunMarkerPulseTime = 0;
      this.updateStunMarker(0);
      return;
    }

    this.stunMarker.scale.setScalar(1);

    const ring = this.stunMarker.getObjectByName("enemyStunRing");
    const material = ring?.material;

    if (material?.color) {
      material.color.copy(this.stunMarkerBaseColor);
      material.opacity = STUN_MARKER_BASE_OPACITY;
    }
  }

  updateStunMarker(delta) {
    if (!this.stunMarker) return;

    const shouldShow =
      this.alive && this.model.visible !== false && this.isStunned();
    this.stunMarker.visible = shouldShow;

    if (!shouldShow) return;

    this.stunMarkerPulseTime += delta;

    const wave =
      (Math.sin(this.stunMarkerPulseTime * STUN_MARKER_PULSE_SPEED) + 1) / 2;
    const scale = 1 + wave * STUN_MARKER_PULSE_SCALE;
    const ring = this.stunMarker.getObjectByName("enemyStunRing");
    const material = ring?.material;

    this.stunMarker.scale.set(scale, scale, scale);

    if (material?.color) {
      material.color.copy(this.stunMarkerBaseColor);
      material.color.lerp(this.stunMarkerPulseColor, wave);
    }

    if (material) {
      material.opacity = THREE.MathUtils.lerp(
        STUN_MARKER_BASE_OPACITY,
        STUN_MARKER_PULSE_OPACITY,
        wave
      );
    }
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
