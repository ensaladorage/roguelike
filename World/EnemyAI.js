import * as THREE from "three";

export const ENEMY_STATES = {
  PATROL: "patrol",
  COMBAT: "combat",
  DEAD: "dead",
};

export class EnemyAI {
  constructor(model, patrolPoints = [], options = {}) {
    this.model = model;

    this.state = ENEMY_STATES.PATROL;
    this.patrolPoints = patrolPoints.length > 0
      ? patrolPoints.map((point) => point.clone())
      : [model.position.clone()];
    this.currentPatrolIndex = 0;

    this.speed = 1.35;
    this.patrolStopRange = 0.08;

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
    this.coinDrop = {
      count: options.coinDrop?.count ?? 4,
      value: options.coinDrop?.value ?? 3,
      radius: options.coinDrop?.radius ?? 0.7,
    };
    this.healthBar = this.createHealthBar();
    this.model.add(this.healthBar);
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

    this.emit({
      type: "enemyStateChanged",
      enemy: this,
      state: this.state,
    });
  }

  updatePatrol(delta) {
    if (this.patrolPoints.length === 0) return;

    const target = this.patrolPoints[this.currentPatrolIndex];
    const arrived = this.moveTo(target, delta, this.patrolStopRange);

    if (arrived) {
      this.currentPatrolIndex =
        (this.currentPatrolIndex + 1) % this.patrolPoints.length;
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

  moveTo(target, delta, stopRange) {
    const dir = new THREE.Vector3().subVectors(target, this.model.position);
    dir.y = 0;

    const distance = dir.length();

    if (distance <= stopRange) {
      this.model.position.x = target.x;
      this.model.position.z = target.z;
      return true;
    }

    dir.normalize();

    const step = Math.min(distance, this.speed * delta);
    this.model.position.addScaledVector(dir, step);
    this.face(target);

    return false;
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
    const count = Math.max(0, this.coinDrop.count);
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
      const distance = (this.coinDrop.radius ?? 0.7) + 0.45 + ringOffset + (Math.random() * 0.18 - 0.09);

      const position = origin
        .clone()
        .addScaledVector(forward, distance)
        .addScaledVector(right, sideOffset);

      coins.push({
        value: this.coinDrop.value,
        position: new THREE.Vector3(position.x, 0, position.z),
        fallbackOrigin: origin.clone(),
      });
    }

    console.log("enemyCoinsDropped", {
      count: coins.length,
      value: this.coinDrop.value,
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
