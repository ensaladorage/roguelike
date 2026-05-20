import * as THREE from "three";
import { flatDistance } from "../Game/Utils.js";
import { getItemDefinition } from "../Data/itemDefinitions.js";

const ITEM_DROP_LAUNCH_DURATION = 0.9;
const ITEM_DROP_LAUNCH_HEIGHT = 2.2;
const ITEM_DROP_GROUND_Y = 0.12;
const ITEM_DROP_WALL_CLEARANCE = 0.28;
const ITEM_DROP_LANDING_MIN_DISTANCE = 0.62;
const ITEM_DROP_LANDING_MAX_DISTANCE = 1.35;
const ITEM_DROP_LANDING_ANGLE_SPREAD = Math.PI * 0.95;
const ITEM_DROP_PICKUP_RANGE = 0.8;
const ITEM_DROP_BLOCKED_RETRY_DELAY = 1;

export class ItemDropManager {
  constructor(scene) {
    this.scene = scene;
    this.itemDrops = [];
  }

  addItemDrops(items) {
    const count = items.length;

    for (let index = 0; index < count; index += 1) {
      const itemDrop = items[index];
      const definition = getItemDefinition(itemDrop.itemId);
      if (!definition) continue;

      const model = this.createItemModel(definition);
      const origin = itemDrop.fallbackOrigin
        ? itemDrop.fallbackOrigin.clone()
        : itemDrop.position.clone();

      const resolved = this.resolveDropPosition(
        itemDrop.position.clone(),
        origin,
        index,
        count
      );

      origin.y = ITEM_DROP_GROUND_Y;
      resolved.y = ITEM_DROP_GROUND_Y;
      model.position.copy(origin);

      this.scene.levelGroup.add(model);

      this.itemDrops.push({
        itemId: definition.id,
        item: definition,
        model,
        collected: false,
        collectable: false,
        blockedPickupTimer: 0,
        spinSpeed: 1.2 + this.itemDrops.length * 0.09,
        launch: {
          from: origin,
          to: resolved,
          elapsed: 0,
          duration: ITEM_DROP_LAUNCH_DURATION + Math.random() * 0.16,
          height: ITEM_DROP_LAUNCH_HEIGHT + Math.random() * 0.18,
        },
      });
    }
  }

  createItemModel(definition) {
    const group = new THREE.Group();
    group.name = `${definition.id}Drop`;

    const bottle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.18, 0.36, 18),
      new THREE.MeshStandardMaterial({
        color: 0xf08a2c,
        emissive: 0x3a1604,
        roughness: 0.42,
        metalness: 0.05,
      })
    );
    bottle.position.y = 0.18;
    bottle.castShadow = true;
    bottle.receiveShadow = true;
    group.add(bottle);

    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 0.08, 16),
      new THREE.MeshStandardMaterial({
        color: 0xf4f1e8,
        roughness: 0.5,
      })
    );
    cap.position.y = 0.42;
    cap.castShadow = true;
    group.add(cap);

    group.userData.pulse = {
      baseScale: 1,
      t: Math.random() * Math.PI * 2,
      speed: 2,
      amplitude: 0.07,
    };

    return group;
  }

  update(delta) {
    if (!this.scene?.player || !this.scene?.inventory) return;
    const playerPos = this.scene.player.model.position;

    for (const itemDrop of this.itemDrops) {
      if (itemDrop.collected) continue;

      this.updatePulse(itemDrop, delta);
      this.updateLaunch(itemDrop, delta);
      itemDrop.model.rotation.y += delta * itemDrop.spinSpeed;

      if (itemDrop.blockedPickupTimer > 0) {
        itemDrop.blockedPickupTimer -= delta;
      }

      if (!itemDrop.collectable) continue;

      const distance = flatDistance(playerPos, itemDrop.model.position);
      if (distance <= ITEM_DROP_PICKUP_RANGE) {
        this.collectItemDrop(itemDrop);
      }
    }
  }

  updatePulse(itemDrop, delta) {
    const pulse = itemDrop.model.userData.pulse;
    if (!pulse) return;

    pulse.t += delta * pulse.speed;
    const scale = pulse.baseScale + Math.sin(pulse.t) * pulse.amplitude;
    itemDrop.model.scale.set(scale, scale, scale);
  }

  updateLaunch(itemDrop, delta) {
    const launch = itemDrop.launch;
    if (!launch) return;

    launch.elapsed += delta;
    const t = Math.min(1, launch.elapsed / launch.duration);
    const eased = 1 - Math.pow(1 - t, 3);

    itemDrop.model.position.lerpVectors(launch.from, launch.to, eased);
    itemDrop.model.position.y =
      THREE.MathUtils.lerp(launch.from.y, launch.to.y, eased) +
      Math.sin(t * Math.PI) * launch.height;

    if (t < 1) return;

    itemDrop.model.position.copy(launch.to);
    itemDrop.collectable = true;
    itemDrop.launch = null;
  }

  collectItemDrop(itemDrop) {
    if (!this.scene.inventory.canPickupItem(itemDrop.itemId)) {
      this.emitBlockedPickup(itemDrop);
      return;
    }

    const collected = this.scene.inventory.pickupItem(itemDrop.itemId, {
      source: "groundDrop",
      itemDrop,
      enemies: this.scene.enemies,
    });

    if (!collected) {
      this.emitBlockedPickup(itemDrop);
      return;
    }

    itemDrop.collected = true;
    itemDrop.model.visible = false;
    itemDrop.model.removeFromParent();
    this.scene.updateHud();
    this.scene.sfx.play("chest");
  }

  emitBlockedPickup(itemDrop) {
    if (itemDrop.blockedPickupTimer > 0) return;

    itemDrop.blockedPickupTimer = ITEM_DROP_BLOCKED_RETRY_DELAY;
    this.scene.handleGameEvents([
      {
        type: "itemPickupBlocked",
        itemId: itemDrop.itemId,
        item: itemDrop.item,
        reason: "inventoryFull",
      },
    ]);
  }

  resolveDropPosition(position, fallbackOrigin, dropIndex = 0, dropCount = 1) {
    const origin = fallbackOrigin.clone();
    origin.y = 0;

    const baseOffset = position.clone().sub(origin);
    baseOffset.y = 0;

    const baseAngle = baseOffset.lengthSq() > 0.0001
      ? Math.atan2(baseOffset.z, baseOffset.x)
      : Math.random() * Math.PI * 2;

    const centeredIndex = dropIndex - (dropCount - 1) / 2;
    const preferredAngle = baseAngle + centeredIndex * 0.42;

    for (let attempt = 0; attempt < 18; attempt += 1) {
      const angleJitter = (Math.random() - 0.5) * ITEM_DROP_LANDING_ANGLE_SPREAD;
      const distance = THREE.MathUtils.lerp(
        ITEM_DROP_LANDING_MIN_DISTANCE,
        ITEM_DROP_LANDING_MAX_DISTANCE,
        Math.random()
      );

      const angle = preferredAngle + angleJitter + attempt * 0.23;
      const candidate = new THREE.Vector3(
        origin.x + Math.cos(angle) * distance,
        0,
        origin.z + Math.sin(angle) * distance
      );

      const safeCandidate = this.resolveWallCollision(origin, candidate);
      if (safeCandidate) return safeCandidate;
    }

    const originalCandidate = position.clone();
    originalCandidate.y = 0;
    const safeOriginal = this.resolveWallCollision(origin, originalCandidate);
    if (safeOriginal) return safeOriginal;

    const fallback = origin.clone();
    fallback.y = 0;
    return fallback;
  }

  resolveWallCollision(origin, candidate) {
    if (this.isSafeLanding(origin, candidate)) {
      return candidate.clone();
    }

    const lastSafe = this.findLastSafeLandingBeforeCollision(origin, candidate);
    if (!lastSafe) return null;

    const travelled = flatDistance(origin, lastSafe);
    if (travelled < ITEM_DROP_LANDING_MIN_DISTANCE * 0.45) {
      return null;
    }

    return lastSafe;
  }

  isSafeLanding(origin, candidate) {
    return (
      this.scene.isWalkablePosition(candidate, ITEM_DROP_WALL_CLEARANCE) &&
      !this.scene.movementHitsWall(origin, candidate, ITEM_DROP_WALL_CLEARANCE)
    );
  }

  findLastSafeLandingBeforeCollision(origin, candidate) {
    let low = 0;
    let high = 1;
    let lastSafe = null;

    for (let i = 0; i < 10; i += 1) {
      const t = (low + high) / 2;
      const point = origin.clone().lerp(candidate, t);
      point.y = 0;

      if (this.isSafeLanding(origin, point)) {
        lastSafe = point;
        low = t;
      } else {
        high = t;
      }
    }

    return lastSafe;
  }

  clear() {
    for (const itemDrop of this.itemDrops) {
      itemDrop.model.removeFromParent();
    }

    this.itemDrops = [];
  }
}
