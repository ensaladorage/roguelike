import * as THREE from "three";

export const PLAYER_STATES = {
  IDLE: "idle",
  MOVING: "moving",
  COMBAT: "combat",
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
export const PLAYER_COMBAT_CONFIG = {
  attackWindupDuration: 0.18,
  attackArcDegrees: 105,
};
const BASE_PLAYER_STATS = {
  maxHp: 100,
  hp: 100,
  gold: 0,
  attackDamage: 10,
  attackRange: 1.65,
  attackSpeed: 1.2,
  attackArcDegrees: PLAYER_COMBAT_CONFIG.attackArcDegrees,
};

const ATTACK_DIRECTION_EPSILON = 0.0001;

export class Player {
  constructor(model) {
    this.model = model;
    this.groundY = model.position.y;

    this.state = PLAYER_STATES.IDLE;

    this.target = null;
    this.path = [];

    this.speed = 3.5;

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

    this.attackTarget = null;
    this.currentEnemy = null;
    this.attackAutoPursuitEnabled = false;

    this.events = [];
    this.directMovementVelocity = new THREE.Vector3();

    // 🔥 IMPORTANTE
    // Guardamos la rotación visual aparte para evitar
    // que lookAt() rompa la dirección del personaje.
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

  createProgressSnapshot() {
    return {
      maxHp: this.maxHp,
      hp: this.hp,
      gold: this.gold,
      attackDamage: this.attackDamage,
      attackRange: this.attackRange,
      attackSpeed: this.attackSpeed,
      attackArcDegrees: this.attackArcDegrees,
      attackCooldown: this.attackCooldown,
      attackWindupDuration: this.attackWindupDuration,
    };
  }

  restoreProgressSnapshot(snapshot) {
    if (!snapshot) return;

    this.maxHp = snapshot.maxHp ?? this.maxHp;
    this.hp = Math.min(snapshot.hp ?? this.hp, this.maxHp);
    this.gold = snapshot.gold ?? this.gold;
    this.attackDamage = snapshot.attackDamage ?? this.attackDamage;
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
  }

  resetForNewRun() {
    this.maxHp = BASE_PLAYER_STATS.maxHp;
    this.hp = BASE_PLAYER_STATS.hp;
    this.gold = BASE_PLAYER_STATS.gold;
    this.attackDamage = BASE_PLAYER_STATS.attackDamage;
    this.attackRange = BASE_PLAYER_STATS.attackRange;
    this.attackArcDegrees = BASE_PLAYER_STATS.attackArcDegrees;
    this.setAttackSpeed(BASE_PLAYER_STATS.attackSpeed);
    this.setAttackWindupDuration(PLAYER_COMBAT_CONFIG.attackWindupDuration);
    this.resetRuntimeState();
  }

  resetRuntimeState() {
    this.target = null;
    this.path = [];
    this.attackTarget = null;
    this.currentEnemy = null;
    this.attackAutoPursuitEnabled = false;
    this.state = PLAYER_STATES.IDLE;
    this.attackTimer = this.attackCooldown;
    this.attackState = PLAYER_ATTACK_STATES.READY;
    this.attackWindupTimer = 0;
    this.lockedAttackDirection = null;
    this.pendingAttackEnemies = [];
    this.events = [];
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

  setTarget(position) {
    if (this.state === PLAYER_STATES.DEAD) return;

    this.clearAttackTarget();
    this.stopDirectMovement();
    this.path = [];

    this.target = position.clone();
    this.target.y = this.groundY;

    this.state = PLAYER_STATES.MOVING;
  }

  setPath(points) {
    if (this.state === PLAYER_STATES.DEAD) return;
    if (!points || points.length === 0) return;

    this.clearAttackTarget();
    this.applyPath(points);
  }

  applyPath(points) {
    this.stopDirectMovement();
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

  setAttackTarget(enemy, path = [], options = {}) {
    if (this.hp <= 0) return;
    if (this.state === PLAYER_STATES.DEAD) return;
    if (!enemy || !enemy.alive) return;

    const previousTarget = this.attackTarget;
    const autoPursuit = options.autoPursuit ?? true;

    this.attackTarget = enemy;
    this.currentEnemy = enemy;
    this.attackAutoPursuitEnabled = autoPursuit;

    if (path.length > 0) {
      this.applyPath(path);
    } else {
      this.target = null;
      this.path = [];
      this.state = PLAYER_STATES.COMBAT;
    }

    if (previousTarget === enemy) return;

    if (previousTarget) {
      this.emit({
        type: "combatEnd",
        enemy: previousTarget,
      });
    }

    this.emit({
      type: "combatStart",
      enemy,
    });
  }

  clearAttackTarget() {
    const enemy = this.attackTarget ?? this.currentEnemy;
    const wasAttacking = Boolean(enemy);

    this.attackTarget = null;
    this.currentEnemy = null;
    this.attackAutoPursuitEnabled = false;
    this.cancelAttackWindup(enemy);

    if (!wasAttacking) return;

    this.emit({
      type: "combatEnd",
      enemy,
    });
  }

  enterCombat(enemy) {
    this.setAttackTarget(enemy);
  }

  leaveCombat(enemy = this.currentEnemy) {
    if (this.state === PLAYER_STATES.DEAD) return;

    this.clearAttackTarget();
    this.target = null;
    this.path = [];
    this.state = PLAYER_STATES.IDLE;
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
    this.attackTarget = null;
    this.currentEnemy = null;
    this.attackState = PLAYER_ATTACK_STATES.READY;
    this.attackWindupTimer = 0;
    this.lockedAttackDirection = null;
    this.pendingAttackEnemies = [];

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

    this.clearAttackTarget();
    this.stopMovement();
  }

  stopMovement() {
    if (this.state === PLAYER_STATES.DEAD) return;

    this.stopDirectMovement();
    this.target = null;
    this.path = [];

    this.state = this.attackTarget
      ? PLAYER_STATES.COMBAT
      : PLAYER_STATES.IDLE;
  }

  cancelAttackAutoPursuit() {
    if (!this.attackTarget) return;

    this.attackAutoPursuitEnabled = false;
    this.target = null;
    this.path = [];
    this.cancelAttackWindup(this.attackTarget);
  }

  canAutoPursueAttackTarget() {
    return Boolean(this.attackTarget && this.attackAutoPursuitEnabled);
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

  startDirectionalAttackWindup(direction, enemies = []) {
    this.clearAttackTarget();
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

      case PLAYER_STATES.COMBAT:
        this.updateCombat(delta);
        break;
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

  updateCombatWhileMoving(delta) {
    if (!this.attackTarget || !this.attackTarget.alive) {
      this.clearAttackTarget();
      return;
    }

    const enemyPos = this.attackTarget.model.position;
    const dx = enemyPos.x - this.model.position.x;
    const dz = enemyPos.z - this.model.position.z;
    const distance = Math.sqrt(dx * dx + dz * dz);

    if (distance > this.attackRange) {
      this.cancelAttackWindup(this.attackTarget);
      return;
    }

    this.updateAttackState(delta);
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
        this.state = this.attackTarget
          ? PLAYER_STATES.COMBAT
          : PLAYER_STATES.IDLE;
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

    // 🔥 ROTACIÓN MANUAL LIMPIA
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

  updateCombat(delta) {
    if (
      !this.attackTarget ||
      !this.attackTarget.alive
    ) {
      this.clearAttackTarget();

      this.state = PLAYER_STATES.IDLE;

      return;
    }

    const enemyPos =
      this.attackTarget.model.position;

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

    if (distance > this.attackRange) {
      this.cancelAttackWindup(this.attackTarget);
      return;
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

  startAttackWindup() {
    if (!this.isAttackTargetValid()) return;

    this.attackState = PLAYER_ATTACK_STATES.WINDUP;
    this.attackWindupTimer = 0;

    this.emit({
      type: "attackWindupStarted",
      enemy: this.attackTarget,
      duration: this.attackWindupDuration,
    });
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

  cancelAttackWindup(enemy = this.attackTarget) {
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

  isAttackTargetValid() {
    return Boolean(
      this.attackTarget &&
      this.attackTarget.alive &&
      this.attackTarget.model?.position
    );
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
    const minDot = Math.cos(halfArcRadians);

    return enemies
      .filter((enemy) =>
        enemy?.alive &&
        enemy.model?.position &&
        enemy.model.visible !== false
      )
      .map((enemy) => {
        const toEnemy = new THREE.Vector3(
          enemy.model.position.x - this.model.position.x,
          0,
          enemy.model.position.z - this.model.position.z
        );
        const distance = toEnemy.length();

        if (distance > ATTACK_DIRECTION_EPSILON) {
          toEnemy.normalize();
        }

        return {
          enemy,
          distance,
          dot: distance <= ATTACK_DIRECTION_EPSILON
            ? 1
            : attackDirection.dot(toEnemy),
        };
      })
      .filter(({ distance, dot }) =>
        distance <= this.attackRange &&
        dot >= minDot
      )
      .sort((a, b) => a.distance - b.distance)
      .map(({ enemy }) => enemy);
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
