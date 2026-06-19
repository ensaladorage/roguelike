import * as THREE from "three";

export const PLAYER_STATES = {
  IDLE: "idle",
  MOVING: "moving",
  DEAD: "dead",
};

export const PLAYER_ATTACK_STATES = {
  READY: "ready",
  WINDUP: "windup",
  COOLDOWN: "cooldown",
};

const OCCLUSION_RING_INNER_RADIUS = 0.42;
const OCCLUSION_RING_OUTER_RADIUS = 0.5;
const OCCLUSION_RING_Y = 0.06;
const OCCLUSION_SAMPLE_HEIGHTS = [0.12, 0.42, 0.75];
const OCCLUSION_MIN_COVERED_SAMPLES = 1;
const MIN_ATTACK_SPEED = 0.1;
const DIRECT_MOVEMENT_ACCELERATION = 100;
const DIRECT_MOVEMENT_ROTATION_RESPONSE = 45;
const DASH_DURATION_SECONDS = 0.14;
const DASH_DIRECTION_EPSILON = 0.0001;
export const PLAYER_COMBAT_CONFIG = {
  attackWindupDuration: 0.18,
  attackArcDegrees: 105,
};
const BASE_PLAYER_STATS = {
  maxHp: 120,
  hp: 120,
  gold: 0,
  attackDamage: 10,
  speed: 3.5,
  attackRange: 1.65,
  attackSpeed: 1.2,
  attackArcDegrees: PLAYER_COMBAT_CONFIG.attackArcDegrees,
};

const ATTACK_DIRECTION_EPSILON = 0.0001;
const ENEMY_ATTACK_COLLISION_RADIUS_FALLBACK = 0;

export class Player {
  constructor(model) {
    this.model = model;
    this.groundY = model.position.y;

    this.state = PLAYER_STATES.IDLE;

    this.target = null;
    this.path = [];

    this.speed = BASE_PLAYER_STATS.speed;

    this.maxHp = BASE_PLAYER_STATS.maxHp;
    this.hp = BASE_PLAYER_STATS.hp;
    this.gold = BASE_PLAYER_STATS.gold;

    this.attackDamage = BASE_PLAYER_STATS.attackDamage;
    this.attackRange = BASE_PLAYER_STATS.attackRange;
    this.attackSpeed = BASE_PLAYER_STATS.attackSpeed;
    this.attackArcDegrees = BASE_PLAYER_STATS.attackArcDegrees;
    this.attackCooldown = this.getAttackCooldownFromSpeed(this.attackSpeed);
    this.attackTimer = this.attackCooldown;
    this.attackState = PLAYER_ATTACK_STATES.READY;
    this.attackWindupDuration = PLAYER_COMBAT_CONFIG.attackWindupDuration;
    this.attackWindupTimer = 0;
    this.lockedAttackDirection = null;
    this.pendingAttackEnemies = [];

    this.events = [];
    this.directMovementVelocity = new THREE.Vector3();
    this.dashUnlocked = false;
    this.dashDistance = 0;
    this.dashCooldown = 0;
    this.dashCooldownTimer = 0;
    this.dashDuration = DASH_DURATION_SECONDS;
    this.dashActive = false;
    this.dashElapsed = 0;
    this.dashStartPosition = new THREE.Vector3();
    this.dashEndPosition = new THREE.Vector3();
    this.dashDirection = new THREE.Vector3(0, 0, 1);

    // Keep visual rotation separate so lookAt() cannot override the character direction.
    this.visualRotation = 0;

    this.occlusionRaycaster = new THREE.Raycaster();
    this.occlusionDirection = new THREE.Vector3();
    this.occlusionSample = new THREE.Vector3();
    this.occlusionMarker = this.createOcclusionMarker();
    this.model.add(this.occlusionMarker);
  }

  getAttackCooldownFromSpeed(attackSpeed) {
    return 1 / Math.max(MIN_ATTACK_SPEED, attackSpeed);
  }

  setAttackSpeed(attackSpeed) {
    this.attackSpeed = Math.max(MIN_ATTACK_SPEED, attackSpeed);
    this.attackCooldown = this.getAttackCooldownFromSpeed(this.attackSpeed);
    this.attackTimer = Math.min(this.attackTimer, this.attackCooldown);
  }

  setAttackWindupDuration(duration = PLAYER_COMBAT_CONFIG.attackWindupDuration) {
    const numericDuration = Number.parseFloat(duration);

    this.attackWindupDuration = Number.isFinite(numericDuration)
      ? Math.max(0, numericDuration)
      : PLAYER_COMBAT_CONFIG.attackWindupDuration;
    this.attackWindupTimer = Math.min(
      this.attackWindupTimer,
      this.attackWindupDuration
    );
  }

  configureDash({ unlocked = false, distance = 0, cooldown = 0 } = {}) {
    const safeDistance = this.normalizePositiveNumber(distance);
    const safeCooldown = this.normalizePositiveNumber(cooldown);
    const wasUnlocked = this.dashUnlocked;

    this.dashUnlocked = Boolean(unlocked && safeDistance > 0 && safeCooldown > 0);
    this.dashDistance = this.dashUnlocked ? safeDistance : 0;
    this.dashCooldown = this.dashUnlocked ? safeCooldown : 0;

    if (!this.dashUnlocked) {
      this.clearDashRuntimeState();
      return;
    }

    if (!wasUnlocked) {
      this.dashCooldownTimer = this.dashCooldown;
      return;
    }

    this.dashCooldownTimer = Math.min(
      this.dashCooldown,
      this.dashCooldownTimer
    );
  }

  normalizePositiveNumber(value) {
    const numericValue = Number.parseFloat(value);

    return Number.isFinite(numericValue) ? Math.max(0, numericValue) : 0;
  }

  createProgressSnapshot() {
    return {
      maxHp: this.maxHp,
      hp: this.hp,
      gold: this.gold,
      attackDamage: this.attackDamage,
      speed: this.speed,
      attackRange: this.attackRange,
      attackSpeed: this.attackSpeed,
      attackArcDegrees: this.attackArcDegrees,
      attackCooldown: this.attackCooldown,
      attackWindupDuration: this.attackWindupDuration,
      dashUnlocked: this.dashUnlocked,
      dashDistance: this.dashDistance,
      dashCooldown: this.dashCooldown,
      dashCooldownTimer: this.dashCooldownTimer,
    };
  }

  restoreProgressSnapshot(snapshot) {
    if (!snapshot) return;

    this.maxHp = snapshot.maxHp ?? this.maxHp;
    this.hp = Math.min(snapshot.hp ?? this.hp, this.maxHp);
    this.gold = snapshot.gold ?? this.gold;
    this.attackDamage = snapshot.attackDamage ?? this.attackDamage;
    this.speed = snapshot.speed ?? this.speed;
    this.attackRange = snapshot.attackRange ?? this.attackRange;
    this.attackArcDegrees = snapshot.attackArcDegrees ?? this.attackArcDegrees;

    if (snapshot.attackSpeed !== undefined) {
      this.setAttackSpeed(snapshot.attackSpeed);
    } else if (snapshot.attackCooldown !== undefined) {
      this.attackCooldown = snapshot.attackCooldown;
    }

    if (snapshot.attackWindupDuration !== undefined) {
      this.setAttackWindupDuration(snapshot.attackWindupDuration);
    }

    if (snapshot.dashUnlocked) {
      this.configureDash({
        unlocked: snapshot.dashUnlocked,
        distance: snapshot.dashDistance,
        cooldown: snapshot.dashCooldown,
      });
      this.dashCooldownTimer = Math.min(
        this.dashCooldown,
        snapshot.dashCooldownTimer ?? this.dashCooldown
      );
    }
  }

  resetForNewRun() {
    this.maxHp = BASE_PLAYER_STATS.maxHp;
    this.hp = BASE_PLAYER_STATS.hp;
    this.gold = BASE_PLAYER_STATS.gold;
    this.attackDamage = BASE_PLAYER_STATS.attackDamage;
    this.speed = BASE_PLAYER_STATS.speed;
    this.attackRange = BASE_PLAYER_STATS.attackRange;
    this.attackArcDegrees = BASE_PLAYER_STATS.attackArcDegrees;
    this.setAttackSpeed(BASE_PLAYER_STATS.attackSpeed);
    this.setAttackWindupDuration(PLAYER_COMBAT_CONFIG.attackWindupDuration);
    this.configureDash({ unlocked: false });
    this.resetRuntimeState();
  }

  resetRuntimeState() {
    this.target = null;
    this.path = [];
    this.state = PLAYER_STATES.IDLE;
    this.attackTimer = this.attackCooldown;
    this.attackState = PLAYER_ATTACK_STATES.READY;
    this.attackWindupTimer = 0;
    this.lockedAttackDirection = null;
    this.pendingAttackEnemies = [];
    this.events = [];
    this.clearDashRuntimeState({
      preserveCooldown: this.dashUnlocked,
    });
    this.stopDirectMovement();
    this.visualRotation = 0;
    this.model.rotation.y = 0;
    this.model.visible = true;

    if (this.occlusionMarker) {
      this.occlusionMarker.visible = false;
    }
  }

  setFacingRotation(rotationY = 0) {
    this.visualRotation = rotationY;
    this.model.rotation.y = rotationY;
  }

  createOcclusionMarker() {
    const marker = new THREE.Group();
    marker.name = "playerOcclusionMarker";
    marker.visible = false;
    marker.position.y = OCCLUSION_RING_Y;
    marker.renderOrder = 90;

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(
        OCCLUSION_RING_INNER_RADIUS,
        OCCLUSION_RING_OUTER_RADIUS,
        64
      ),
      new THREE.MeshBasicMaterial({
        color: 0x56c271,
        transparent: true,
        opacity: 0.92,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );

    ring.rotation.x = -Math.PI / 2;
    ring.renderOrder = 90;
    ring.userData.ignoreFlash = true;
    marker.add(ring);

    return marker;
  }

  updateOcclusionMarker(camera, wallMeshes = []) {
    if (
      !this.occlusionMarker ||
      !this.model.visible ||
      !camera ||
      wallMeshes.length === 0
    ) {
      if (this.occlusionMarker) this.occlusionMarker.visible = false;
      return;
    }

    const coveredSamples = OCCLUSION_SAMPLE_HEIGHTS.map((sampleY) =>
      this.isOcclusionSampleCovered(camera, wallMeshes, sampleY)
    );
    const coveredCount = coveredSamples.filter(Boolean).length;

    this.occlusionMarker.visible =
      coveredCount >= OCCLUSION_MIN_COVERED_SAMPLES;
  }

  isOcclusionSampleCovered(camera, wallMeshes, sampleY) {
    this.occlusionSample.copy(this.model.position);
    this.occlusionSample.y += sampleY;

    this.occlusionDirection.subVectors(
      this.occlusionSample,
      camera.position
    );

    const distance = this.occlusionDirection.length();
    if (distance <= 0.0001) return false;

    this.occlusionDirection.normalize();
    this.occlusionRaycaster.set(camera.position, this.occlusionDirection);
    this.occlusionRaycaster.far = distance - 0.08;

    return this.occlusionRaycaster.intersectObjects(
      wallMeshes,
      true
    ).length > 0;
  }

  applyRecoveryPath(points) {
    if (this.state === PLAYER_STATES.DEAD) return false;
    if (!points || points.length === 0) return false;

    this.clearAttackIntent();
    this.stopDirectMovement();
    this.path = points.map((point) => {
      const waypoint = point.clone();
      waypoint.y = this.groundY;
      return waypoint;
    });

    this.target = this.path.shift();
    this.state = PLAYER_STATES.MOVING;
    return true;
  }

  clearAttackIntent() {
    this.cancelAttackWindup(null);
  }

  addGold(amount) {
    if (this.state === PLAYER_STATES.DEAD) return;

    this.gold += amount;
  }

  spendGold(amount) {
    if (this.state === PLAYER_STATES.DEAD) return false;
    if (amount <= 0) return true;
    if (this.gold < amount) return false;

    this.gold -= amount;
    return true;
  }

  takeDamage(amount, source) {
    if (this.state === PLAYER_STATES.DEAD) return 0;

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
    this.attackState = PLAYER_ATTACK_STATES.READY;
    this.attackWindupTimer = 0;
    this.lockedAttackDirection = null;
    this.pendingAttackEnemies = [];
    this.clearDashRuntimeState();

    this.state = PLAYER_STATES.DEAD;

    this.emit({
      type: "playerDefeated",
    });
  }

  collectChest(chest) {
    if (this.state === PLAYER_STATES.DEAD) return false;
    if (chest.collected) return false;

    chest.collected = true;

    return true;
  }

  clearTarget() {
    if (this.state === PLAYER_STATES.DEAD) return;

    this.clearAttackIntent();
    this.stopMovement();
  }

  stopMovement() {
    if (this.state === PLAYER_STATES.DEAD) return;

    this.clearDashRuntimeState({
      preserveCooldown: true,
    });
    this.stopDirectMovement();
    this.target = null;
    this.path = [];

    this.state = PLAYER_STATES.IDLE;
  }

  requestDirectionalAttack(point, { enemies = [] } = {}) {
    if (this.hp <= 0) return false;
    if (this.state === PLAYER_STATES.DEAD) return false;
    if (this.attackState !== PLAYER_ATTACK_STATES.READY) return false;
    if (!point) return false;

    const direction = new THREE.Vector3(
      point.x - this.model.position.x,
      0,
      point.z - this.model.position.z
    );

    if (direction.lengthSq() <= ATTACK_DIRECTION_EPSILON) {
      return false;
    }

    direction.normalize();
    this.startDirectionalAttackWindup(direction, enemies);
    return true;
  }

  requestDash(direction, { resolveDestination = null } = {}) {
    if (this.hp <= 0 || this.state === PLAYER_STATES.DEAD) return false;

    if (!this.dashUnlocked) {
      this.emit({
        type: "dashLocked",
      });
      return false;
    }

    if (this.dashActive) return false;

    if (this.dashCooldownTimer < this.dashCooldown) {
      this.emit({
        type: "dashCooldownBlocked",
        remaining: this.dashCooldown - this.dashCooldownTimer,
        cooldown: this.dashCooldown,
      });
      return false;
    }

    const dashDirection = this.normalizeDashDirection(direction);
    if (!dashDirection) return false;

    const start = this.model.position.clone();
    start.y = this.groundY;
    const desiredEnd = start
      .clone()
      .addScaledVector(dashDirection, this.dashDistance);
    desiredEnd.y = this.groundY;

    const resolvedEnd =
      typeof resolveDestination === "function"
        ? resolveDestination(start, dashDirection, this.dashDistance, desiredEnd)
        : desiredEnd;

    if (
      !resolvedEnd ||
      start.distanceToSquared(resolvedEnd) <= DASH_DIRECTION_EPSILON
    ) {
      this.emit({
        type: "dashBlocked",
        direction: dashDirection.clone(),
      });
      return false;
    }

    this.startDash(start, resolvedEnd, dashDirection);
    return true;
  }

  normalizeDashDirection(direction) {
    if (
      !direction ||
      typeof direction.lengthSq !== "function" ||
      direction.lengthSq() <= DASH_DIRECTION_EPSILON
    ) {
      return null;
    }

    const dashDirection = direction.clone();
    dashDirection.y = 0;

    if (dashDirection.lengthSq() <= DASH_DIRECTION_EPSILON) return null;

    return dashDirection.normalize();
  }

  startDash(start, end, direction) {
    this.dashActive = true;
    this.dashElapsed = 0;
    this.dashStartPosition.copy(start);
    this.dashEndPosition.copy(end);
    this.dashDirection.copy(direction);
    this.dashCooldownTimer = 0;
    this.stopDirectMovement();
    this.target = null;
    this.path = [];
    this.state = PLAYER_STATES.MOVING;

    this.visualRotation = Math.atan2(direction.x, direction.z);
    this.model.rotation.y = this.visualRotation;

    this.emit({
      type: "dashStarted",
      start: this.dashStartPosition.clone(),
      end: this.dashEndPosition.clone(),
      direction: this.dashDirection.clone(),
      distance: this.dashStartPosition.distanceTo(this.dashEndPosition),
      cooldown: this.dashCooldown,
      duration: this.dashDuration,
    });
  }

  startDirectionalAttackWindup(direction, enemies = []) {
    this.clearAttackIntent();
    this.lockedAttackDirection = direction.clone();
    this.pendingAttackEnemies = Array.isArray(enemies) ? [...enemies] : [];
    this.attackState = PLAYER_ATTACK_STATES.WINDUP;
    this.attackWindupTimer = 0;
    this.faceAttackDirection();

    this.emit({
      type: "attackWindupStarted",
      direction: this.lockedAttackDirection.clone(),
      duration: this.attackWindupDuration,
    });
  }

  emit(event) {
    this.events.push(event);
  }

  consumeEvents() {
    const events = this.events;
    this.events = [];

    return events;
  }

  update(delta, movementInput = null) {
    if (
      this.state !== PLAYER_STATES.DEAD &&
      this.attackState === PLAYER_ATTACK_STATES.COOLDOWN
    ) {
      this.updateAttackCooldown(delta);
    }

    if (this.state !== PLAYER_STATES.DEAD) {
      this.updateDashCooldown(delta);
    }

    if (this.dashActive) {
      this.updateDash(delta);
      return;
    }

    if (this.hasDirectMovementInput(movementInput)) {
      this.updateDirectMovement(delta, movementInput);
      return;
    }

    this.stopDirectMovement();

    switch (this.state) {
      case PLAYER_STATES.IDLE:
        this.updateAttackState(delta);
        break;

      case PLAYER_STATES.DEAD:
        break;

      case PLAYER_STATES.MOVING:
        this.updateMoving(delta);
        break;
    }
  }

  updateDash(delta) {
    this.dashElapsed += delta;
    const duration = Math.max(0.001, this.dashDuration);
    const t = Math.min(1, this.dashElapsed / duration);
    const eased = 1 - Math.pow(1 - t, 2);

    this.model.position.lerpVectors(
      this.dashStartPosition,
      this.dashEndPosition,
      eased
    );
    this.model.position.y = this.groundY;

    if (this.shouldFaceAttackDirection()) {
      this.faceAttackDirection();
    } else {
      this.visualRotation = Math.atan2(
        this.dashDirection.x,
        this.dashDirection.z
      );
      this.model.rotation.y = this.visualRotation;
    }

    this.updateAttackState(delta);

    if (t < 1) return;

    this.finishDash();
  }

  finishDash() {
    if (!this.dashActive) return;

    this.model.position.copy(this.dashEndPosition);
    this.dashActive = false;
    this.dashElapsed = 0;
    this.state = PLAYER_STATES.IDLE;

    this.emit({
      type: "dashEnded",
      position: this.model.position.clone(),
      direction: this.dashDirection.clone(),
      cooldown: this.dashCooldown,
    });
  }

  updateDashCooldown(delta) {
    if (!this.dashUnlocked || this.dashCooldown <= 0) return;
    if (this.dashCooldownTimer >= this.dashCooldown) return;

    const wasReady = this.isDashReady();
    this.dashCooldownTimer = Math.min(
      this.dashCooldown,
      this.dashCooldownTimer + delta
    );

    if (!wasReady && this.isDashReady()) {
      this.emit({
        type: "dashReady",
        cooldown: this.dashCooldown,
      });
    }
  }

  isDashReady() {
    return Boolean(
      this.dashUnlocked &&
      this.dashCooldown > 0 &&
      this.dashCooldownTimer >= this.dashCooldown
    );
  }

  getDashFeedbackState() {
    const cooldown = Math.max(0, this.dashCooldown);
    const cooldownProgress = cooldown > 0
      ? Math.max(0, Math.min(1, this.dashCooldownTimer / cooldown))
      : 0;
    const remainingSeconds = this.dashUnlocked
      ? Math.max(0, cooldown - this.dashCooldownTimer)
      : 0;

    return {
      unlocked: this.dashUnlocked,
      isReady: this.isDashReady(),
      isCoolingDown: Boolean(
        this.dashUnlocked &&
        cooldown > 0 &&
        cooldownProgress < 1
      ),
      cooldownProgress,
      remainingSeconds,
      distance: this.dashDistance,
      cooldown,
    };
  }

  clearDashRuntimeState({ preserveCooldown = false } = {}) {
    this.dashActive = false;
    this.dashElapsed = 0;
    this.dashStartPosition.copy(this.model.position);
    this.dashEndPosition.copy(this.model.position);

    if (!preserveCooldown) {
      this.dashCooldownTimer = this.dashUnlocked ? this.dashCooldown : 0;
    }
  }

  hasDirectMovementInput(movementInput) {
    return Boolean(
      this.state !== PLAYER_STATES.DEAD &&
      movementInput &&
      typeof movementInput.lengthSq === "function" &&
      movementInput.lengthSq() > 0.000001
    );
  }

  updateDirectMovement(delta, movementInput) {
    const direction = movementInput.clone();
    direction.y = 0;

    if (direction.lengthSq() <= 0.000001) return;
    if (direction.lengthSq() > 1) {
      direction.normalize();
    }

    this.target = null;
    this.path = [];
    this.state = PLAYER_STATES.MOVING;

    const targetVelocity = direction.multiplyScalar(this.speed);
    const velocityDelta = targetVelocity.clone().sub(this.directMovementVelocity);
    const maxVelocityDelta = DIRECT_MOVEMENT_ACCELERATION * delta;

    if (velocityDelta.length() > maxVelocityDelta) {
      velocityDelta.setLength(maxVelocityDelta);
    }

    this.directMovementVelocity.add(velocityDelta);

    this.model.position.addScaledVector(
      this.directMovementVelocity,
      delta
    );

    if (this.directMovementVelocity.lengthSq() > 0.000001) {
      const targetRotation = Math.atan2(
        this.directMovementVelocity.x,
        this.directMovementVelocity.z
      );

      if (this.shouldFaceAttackDirection()) {
        this.faceAttackDirection();
      } else {
        this.visualRotation = this.dampAngle(
          this.visualRotation,
          targetRotation,
          DIRECT_MOVEMENT_ROTATION_RESPONSE,
          delta
        );

        this.model.rotation.y = this.visualRotation;
      }
    }

    this.updateAttackState(delta);
  }

  stopDirectMovement() {
    this.directMovementVelocity.set(0, 0, 0);
  }

  dampAngle(current, target, response, delta) {
    const difference = Math.atan2(
      Math.sin(target - current),
      Math.cos(target - current)
    );
    const blend = 1 - Math.exp(-response * delta);

    return current + difference * blend;
  }

  updateMoving(delta) {
    if (!this.target) {
      this.state = PLAYER_STATES.IDLE;
      this.updateAttackState(delta);
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

      this.updateAttackState(delta);
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

    if (this.shouldFaceAttackDirection()) {
      this.faceAttackDirection();
    } else {
      this.visualRotation = Math.atan2(
        direction.x,
        direction.z
      );

      this.model.rotation.y =
        this.visualRotation;
    }

    this.updateAttackState(delta);
  }

  updateAttackState(delta) {
    switch (this.attackState) {
      case PLAYER_ATTACK_STATES.READY:
        break;

      case PLAYER_ATTACK_STATES.WINDUP:
        this.updateAttackWindup(delta);
        break;

      case PLAYER_ATTACK_STATES.COOLDOWN:
        break;
    }
  }

  updateAttackWindup(delta) {
    if (!this.lockedAttackDirection) {
      this.cancelAttackWindup();
      return;
    }

    this.faceAttackDirection();
    this.attackWindupTimer += delta;

    if (this.attackWindupTimer < this.attackWindupDuration) return;

    this.strikeDirectionalAttack();
  }

  strikeDirectionalAttack() {
    if (!this.lockedAttackDirection) {
      this.cancelAttackWindup();
      return;
    }

    const direction = this.lockedAttackDirection.clone();
    const whiffImpactPoint = this.getDirectionalAttackImpactPoint(direction);
    const enemies = this.findDirectionalAttackHits(this.pendingAttackEnemies);
    const hitImpactPoint = enemies[0]?.model?.position
      ? this.getEnemyAttackImpactPoint(enemies[0])
      : whiffImpactPoint;

    for (const enemy of enemies) {
      if (!enemy?.takeDamage) continue;

      const damageDone = enemy.takeDamage(
        this.attackDamage,
        this
      );

      this.emit({
        type: "playerAttack",
        enemy,
        damage: damageDone,
        enemyHp: enemy.hp,
        direction: direction.clone(),
        impactPoint: this.getEnemyAttackImpactPoint(enemy),
      });
    }

    if (enemies.length === 0) {
      this.emit({
        type: "playerAttackWhiff",
        direction: direction.clone(),
        impactPoint: whiffImpactPoint.clone(),
      });
    } else {
      this.emit({
        type: "playerAttackHit",
        direction: direction.clone(),
        impactPoint: hitImpactPoint.clone(),
        hitCount: enemies.length,
      });
    }

    this.attackState = PLAYER_ATTACK_STATES.COOLDOWN;
    this.attackTimer = 0;
    this.attackWindupTimer = 0;
    this.lockedAttackDirection = null;
    this.pendingAttackEnemies = [];
  }

  updateAttackCooldown(delta) {
    this.attackTimer = Math.min(
      this.attackCooldown,
      this.attackTimer + delta
    );

    if (this.attackTimer < this.attackCooldown) return;

    this.attackState = PLAYER_ATTACK_STATES.READY;
    this.emit({
      type: "attackReady",
      cooldown: this.attackCooldown,
    });
  }

  cancelAttackWindup(enemy = null) {
    if (this.attackState !== PLAYER_ATTACK_STATES.WINDUP) return;

    this.attackState = PLAYER_ATTACK_STATES.READY;
    this.attackWindupTimer = 0;
    this.lockedAttackDirection = null;
    this.pendingAttackEnemies = [];

    this.emit({
      type: "attackWindupCanceled",
      enemy,
    });
  }

  getAttackCooldownProgress() {
    if (this.attackState === PLAYER_ATTACK_STATES.READY) return 1;
    if (this.attackState === PLAYER_ATTACK_STATES.WINDUP) return 1;
    if (this.attackCooldown <= 0) return 1;

    return Math.max(0, Math.min(1, this.attackTimer / this.attackCooldown));
  }

  getAttackFeedbackState() {
    return {
      attackState: this.attackState,
      cooldownProgress: this.getAttackCooldownProgress(),
      windupProgress: this.attackWindupDuration > 0
        ? Math.max(0, Math.min(1, this.attackWindupTimer / this.attackWindupDuration))
        : 1,
      isReady: this.attackState === PLAYER_ATTACK_STATES.READY,
      isWindup: this.attackState === PLAYER_ATTACK_STATES.WINDUP,
      isCoolingDown: this.attackState === PLAYER_ATTACK_STATES.COOLDOWN,
      hasAttackTarget: false,
    };
  }

  isAttackReady() {
    return this.attackState === PLAYER_ATTACK_STATES.READY;
  }

  findDirectionalAttackHits(enemies = []) {
    const attackDirection = this.lockedAttackDirection;
    if (!attackDirection) return [];

    const attackArcDegrees =
      this.attackArcDegrees ?? PLAYER_COMBAT_CONFIG.attackArcDegrees;
    const halfArcRadians = THREE.MathUtils.degToRad(attackArcDegrees) / 2;

    return enemies
      .filter((enemy) =>
        enemy?.alive &&
        enemy.model?.position &&
        enemy.model.visible !== false
      )
      .map((enemy) =>
        this.getDirectionalAttackCandidate(enemy, attackDirection, halfArcRadians)
      )
      .filter((candidate) => candidate?.isHit)
      .sort((a, b) =>
        a.contactDistance - b.contactDistance ||
        a.centerDistance - b.centerDistance
      )
      .map(({ enemy }) => enemy);
  }

  getEnemyAttackCollisionRadius(enemy) {
    const radius = Number.parseFloat(enemy?.collisionRadius);

    return Number.isFinite(radius) && radius > 0
      ? radius
      : ENEMY_ATTACK_COLLISION_RADIUS_FALLBACK;
  }

  isEnemyInAttackDistance(enemy) {
    if (
      !enemy?.alive ||
      !enemy.model?.position ||
      enemy.model.visible === false ||
      !this.model?.position
    ) {
      return false;
    }

    const enemyRadius = this.getEnemyAttackCollisionRadius(enemy);
    const dx = enemy.model.position.x - this.model.position.x;
    const dz = enemy.model.position.z - this.model.position.z;
    const centerDistance = Math.hypot(dx, dz);

    return centerDistance - enemyRadius <= this.attackRange;
  }

  getDirectionalAttackCandidate(enemy, attackDirection, halfArcRadians) {
    if (
      !enemy?.model?.position ||
      !this.model?.position ||
      !attackDirection
    ) {
      return null;
    }

    const enemyRadius = this.getEnemyAttackCollisionRadius(enemy);
    const toEnemy = new THREE.Vector3(
      enemy.model.position.x - this.model.position.x,
      0,
      enemy.model.position.z - this.model.position.z
    );
    const centerDistance = toEnemy.length();
    const contactDistance = Math.max(0, centerDistance - enemyRadius);
    const isInDistance = contactDistance <= this.attackRange;

    if (centerDistance > ATTACK_DIRECTION_EPSILON) {
      toEnemy.normalize();
    }

    const dot = centerDistance <= ATTACK_DIRECTION_EPSILON
      ? 1
      : attackDirection.dot(toEnemy);
    const angularTolerance = centerDistance > ATTACK_DIRECTION_EPSILON
      ? Math.asin(Math.min(1, enemyRadius / centerDistance))
      : 0;
    const minDot = Math.cos(halfArcRadians + angularTolerance);
    const isInArc =
      centerDistance <= ATTACK_DIRECTION_EPSILON ||
      centerDistance <= enemyRadius ||
      dot >= minDot;

    return {
      enemy,
      centerDistance,
      contactDistance,
      dot,
      isHit: isInDistance && isInArc,
    };
  }

  getDirectionalAttackImpactPoint(direction) {
    return new THREE.Vector3(
      this.model.position.x + direction.x * this.attackRange,
      this.groundY,
      this.model.position.z + direction.z * this.attackRange
    );
  }

  getEnemyAttackImpactPoint(enemy) {
    return new THREE.Vector3(
      enemy.model.position.x,
      this.groundY,
      enemy.model.position.z
    );
  }

  shouldFaceAttackDirection() {
    return Boolean(
      this.lockedAttackDirection &&
      this.attackState === PLAYER_ATTACK_STATES.WINDUP
    );
  }

  faceAttackDirection() {
    if (!this.lockedAttackDirection) return;

    this.visualRotation = Math.atan2(
      this.lockedAttackDirection.x,
      this.lockedAttackDirection.z
    );
    this.model.rotation.y = this.visualRotation;
  }
}
