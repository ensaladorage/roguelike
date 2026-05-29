import * as THREE from "three";

export const PLAYER_STATES = {
  IDLE: "idle",
  MOVING: "moving",
  COMBAT: "combat",
  DEAD: "dead",
};

const OCCLUSION_RING_INNER_RADIUS = 0.42;
const OCCLUSION_RING_OUTER_RADIUS = 0.5;
const OCCLUSION_RING_Y = 0.06;
const MIN_ATTACK_SPEED = 0.1;
const BASE_PLAYER_STATS = {
  maxHp: 100,
  hp: 100,
  gold: 0,
  attackDamage: 10,
  attackRange: 1.65,
  attackSpeed: 1.2,
};

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
    this.attackCooldown = this.getAttackCooldownFromSpeed(this.attackSpeed);
    this.attackTimer = 0;

    this.currentEnemy = null;

    this.events = [];

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

  createProgressSnapshot() {
    return {
      maxHp: this.maxHp,
      hp: this.hp,
      gold: this.gold,
      attackDamage: this.attackDamage,
      attackRange: this.attackRange,
      attackSpeed: this.attackSpeed,
      attackCooldown: this.attackCooldown,
    };
  }

  restoreProgressSnapshot(snapshot) {
    if (!snapshot) return;

    this.maxHp = snapshot.maxHp ?? this.maxHp;
    this.hp = Math.min(snapshot.hp ?? this.hp, this.maxHp);
    this.gold = snapshot.gold ?? this.gold;
    this.attackDamage = snapshot.attackDamage ?? this.attackDamage;
    this.attackRange = snapshot.attackRange ?? this.attackRange;

    if (snapshot.attackSpeed !== undefined) {
      this.setAttackSpeed(snapshot.attackSpeed);
    } else if (snapshot.attackCooldown !== undefined) {
      this.attackCooldown = snapshot.attackCooldown;
    }
  }

  resetForNewRun() {
    this.maxHp = BASE_PLAYER_STATS.maxHp;
    this.hp = BASE_PLAYER_STATS.hp;
    this.gold = BASE_PLAYER_STATS.gold;
    this.attackDamage = BASE_PLAYER_STATS.attackDamage;
    this.attackRange = BASE_PLAYER_STATS.attackRange;
    this.setAttackSpeed(BASE_PLAYER_STATS.attackSpeed);
    this.resetRuntimeState();
  }

  resetRuntimeState() {
    this.target = null;
    this.path = [];
    this.currentEnemy = null;
    this.state = PLAYER_STATES.IDLE;
    this.attackTimer = 0;
    this.events = [];
    this.visualRotation = 0;
    this.model.rotation.y = 0;
    this.model.visible = true;

    if (this.occlusionMarker) {
      this.occlusionMarker.visible = false;
    }
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

    const coveredSamples = [
      this.isOcclusionSampleCovered(camera, wallMeshes, 0.2),
      this.isOcclusionSampleCovered(camera, wallMeshes, 0.75),
    ];

    this.occlusionMarker.visible = coveredSamples.every(Boolean);
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

  leaveCombat(enemy = this.currentEnemy) {
    if (this.state === PLAYER_STATES.DEAD) return;
    if (this.state !== PLAYER_STATES.COMBAT && !this.currentEnemy) return;

    this.currentEnemy = null;
    this.target = null;
    this.path = [];
    this.state = PLAYER_STATES.IDLE;

    this.emit({
      type: "combatEnd",
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
    if (this.state === PLAYER_STATES.DEAD) return false;
    if (chest.collected) return false;

    chest.collected = true;

    return true;
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
