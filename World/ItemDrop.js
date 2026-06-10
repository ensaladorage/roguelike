import * as THREE from "three";
import { flatDistance } from "../Game/Utils.js";
import { getItemDefinition } from "../CharacterData/itemDefinitions.js";
import {
  getItemBaseId,
  normalizeItemInstance,
} from "../Game/ItemInstanceFactory.js";

const ITEM_DROP_LAUNCH_DURATION = 0.9;
const ITEM_DROP_LAUNCH_HEIGHT = 2.2;
const ITEM_DROP_GROUND_Y = 0.12;
const ITEM_DROP_WALL_CLEARANCE = 0.28;
const ITEM_DROP_LANDING_MIN_DISTANCE = 0.62;
const ITEM_DROP_LANDING_MAX_DISTANCE = 1.35;
const ITEM_DROP_LANDING_ANGLE_SPREAD = Math.PI * 0.95;
const ITEM_DROP_PICKUP_RANGE = 0.8;
const ITEM_DROP_BLOCKED_RETRY_DELAY = 1;
const ITEM_DROP_CUBE_SIZE = 0.36;
const ITEM_DROP_CUBE_Y = 0.24;
const ITEM_DROP_HITBOX_RADIUS = 0.48;
const ITEM_DROP_HITBOX_HEIGHT = 0.78;
const ITEM_DROP_POTION_ID = "energyDrink";

const ITEM_DROP_CATEGORY_STYLES = {
  protein: { color: 0xb44b3f, emissive: 0x2c0c08 },
  spicy: { color: 0xe4572e, emissive: 0x3a1005 },
  hearty: { color: 0x59b86f, emissive: 0x0f2a15 },
  ability: { color: 0x6b7cff, emissive: 0x111d4c },
};

const ITEM_DROP_ID_STYLES = {
  purpleShroom: { color: 0x8c55d8, emissive: 0x22103d },
  fish: { color: 0x5ab9d6, emissive: 0x0d2c36 },
};

function getItemDropVisualStyle(definition) {
  return ITEM_DROP_ID_STYLES[definition.id] ??
    ITEM_DROP_CATEGORY_STYLES[definition.foodCategory] ??
    { color: 0xd5b069, emissive: 0x2d210c };
}

export class ItemDropManager {
  constructor(scene) {
    this.scene = scene;
    this.itemDrops = [];
    this.pendingItemDrop = null;
  }

  addItemDrops(items) {
    const count = items.length;

    for (let index = 0; index < count; index += 1) {
      const itemDrop = items[index];
      const itemInstance = normalizeItemInstance(
        itemDrop.itemInstance ?? itemDrop.itemId,
        {
          ...itemDrop.instanceContext,
          source: itemDrop.source ?? "groundDrop",
          rollIndex: itemDrop.rollIndex ?? index,
        }
      );
      const definition = getItemDefinition(getItemBaseId(itemInstance ?? itemDrop.itemId));
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
        item: itemInstance ?? definition,
        itemInstance,
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
    const interactable = {
      type: "itemDrop",
      itemDrop: null,
    };

    if (definition.id === ITEM_DROP_POTION_ID) {
      this.addPotionVisual(group);
    } else {
      this.addCubeVisual(group, definition);
    }

    this.addInteractionHitbox(group, interactable);
    group.userData.pulse = {
      baseScale: 1,
      t: Math.random() * Math.PI * 2,
      speed: 2,
      amplitude: 0.07,
    };
    group.userData.interactable = interactable;

    return group;
  }

  addPotionVisual(group) {
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
  }

  addCubeVisual(group, definition) {
    const style = getItemDropVisualStyle(definition);
    const cube = new THREE.Mesh(
      new THREE.BoxGeometry(
        ITEM_DROP_CUBE_SIZE,
        ITEM_DROP_CUBE_SIZE,
        ITEM_DROP_CUBE_SIZE
      ),
      new THREE.MeshStandardMaterial({
        color: style.color,
        emissive: style.emissive,
        roughness: 0.48,
        metalness: 0.04,
      })
    );
    cube.name = `${definition.id}DropVisual`;
    cube.position.y = ITEM_DROP_CUBE_Y;
    cube.rotation.set(0.18, 0.42, 0.12);
    cube.castShadow = true;
    cube.receiveShadow = true;
    group.add(cube);

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.3, 0.045, 24),
      new THREE.MeshStandardMaterial({
        color: 0x15181f,
        roughness: 0.7,
        metalness: 0,
      })
    );
    base.name = `${definition.id}DropBase`;
    base.position.y = 0.025;
    base.receiveShadow = true;
    group.add(base);
  }

  addInteractionHitbox(group, interactable) {
    const hitbox = new THREE.Mesh(
      new THREE.BoxGeometry(
        ITEM_DROP_HITBOX_RADIUS * 2,
        ITEM_DROP_HITBOX_HEIGHT,
        ITEM_DROP_HITBOX_RADIUS * 2
      ),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
        colorWrite: false,
      })
    );
    hitbox.name = `${group.name}InteractionHitbox`;
    hitbox.position.y = ITEM_DROP_HITBOX_HEIGHT / 2;
    hitbox.userData.interactable = interactable;
    hitbox.userData.isInteractionHitbox = true;
    group.add(hitbox);
  }

  update(delta) {
    if (!this.scene?.player || !this.scene?.inventory) return;

    for (const itemDrop of this.itemDrops) {
      if (itemDrop.collected) continue;

      this.updatePulse(itemDrop, delta);
      this.updateLaunch(itemDrop, delta);
      itemDrop.model.rotation.y += delta * itemDrop.spinSpeed;

      if (itemDrop.blockedPickupTimer > 0) {
        itemDrop.blockedPickupTimer -= delta;
      }
    }

    this.checkPendingItemDropInteraction();
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
    itemDrop.model.userData.interactable.itemDrop = itemDrop;
  }

  getInteractableTargets() {
    return this.itemDrops
      .filter((itemDrop) =>
        itemDrop.collectable &&
        !itemDrop.collected &&
        itemDrop.model?.visible !== false
      )
      .map((itemDrop) => itemDrop.model);
  }

  findDropFromInteractable(interactable) {
    if (interactable?.type !== "itemDrop") return null;

    return interactable.itemDrop ?? null;
  }

  getPickupRange(itemDrop) {
    return itemDrop?.pickupRange ?? ITEM_DROP_PICKUP_RANGE;
  }

  requestItemPickup(itemDrop) {
    if (!this.isItemDropInteractable(itemDrop)) return false;

    this.pendingItemDrop = itemDrop;
    this.checkPendingItemDropInteraction();
    return true;
  }

  cancelPendingItemPickup(itemDrop = null) {
    if (itemDrop && this.pendingItemDrop !== itemDrop) return;

    this.pendingItemDrop = null;
  }

  checkPendingItemDropInteraction() {
    const itemDrop = this.pendingItemDrop;
    if (!itemDrop) return;

    if (!this.isItemDropInteractable(itemDrop)) {
      this.pendingItemDrop = null;
      return;
    }

    const playerPos = this.scene.player.model.position;
    const distance = flatDistance(playerPos, itemDrop.model.position);
    if (distance > this.getPickupRange(itemDrop)) return;

    this.pendingItemDrop = null;
    this.collectItemDrop(itemDrop);
  }

  isItemDropInteractable(itemDrop) {
    return Boolean(
      itemDrop &&
      itemDrop.collectable &&
      !itemDrop.collected &&
      itemDrop.model?.visible !== false
    );
  }

  collectItemDrop(itemDrop) {
    const inventoryItem = itemDrop.itemInstance ?? itemDrop.itemId;
    const pickupBlockReason = this.scene.inventory.getPickupBlockReason?.(inventoryItem);

    if (pickupBlockReason === "slotOccupied") {
      this.requestItemSwap(itemDrop, inventoryItem);
      return;
    }

    if (pickupBlockReason) {
      this.emitBlockedPickup(itemDrop);
      return;
    }

    const collected = this.scene.inventory.pickupItem(inventoryItem, {
      source: "groundDrop",
      itemDrop,
      enemies: this.scene.enemies,
    });

    if (!collected) {
      this.emitBlockedPickup(itemDrop);
      return;
    }

    this.completeItemDropCollection(itemDrop);
    this.scene.sfx.play("chest");
  }

  requestItemSwap(itemDrop, inventoryItem) {
    const candidate = this.scene.inventory.getReplacementCandidate?.(inventoryItem);
    if (!candidate?.previousItem || !candidate?.itemInstance) {
      this.emitBlockedPickup(itemDrop);
      return;
    }

    const opened = this.scene.requestItemSwapConfirmation?.({
      currentItem: candidate.previousItem,
      newItem: candidate.itemInstance,
      onConfirm: () => {
        this.replaceItemDrop(itemDrop, candidate.itemInstance);
      },
      onCancel: () => {
        itemDrop.blockedPickupTimer = 0;
      },
    });

    if (!opened) {
      this.emitBlockedPickup(itemDrop);
    }
  }

  replaceItemDrop(itemDrop, itemInstance) {
    if (!this.isItemDropInteractable(itemDrop)) return;

    const result = this.scene.inventory.replaceEquippedItem(itemInstance, {
      source: "groundDropSwap",
      itemDrop,
      enemies: this.scene.enemies,
    });

    if (!result.success) {
      this.emitBlockedPickup(itemDrop);
      return;
    }

    const dropOrigin = this.scene.player?.model?.position?.clone?.() ??
      itemDrop.model.position.clone();
    const previousDropPosition = itemDrop.model.position.clone();
    this.completeItemDropCollection(itemDrop);
    this.addItemDrops([
      {
        itemId: result.previousItem.baseItemId,
        itemInstance: result.previousItem,
        position: new THREE.Vector3(previousDropPosition.x, 0, previousDropPosition.z),
        fallbackOrigin: dropOrigin,
        source: "equipmentSwap",
      },
    ]);
    this.scene.sfx.play("chest");
  }

  completeItemDropCollection(itemDrop) {
    if (this.pendingItemDrop === itemDrop) {
      this.pendingItemDrop = null;
    }

    itemDrop.collected = true;
    itemDrop.model.visible = false;
    itemDrop.model.removeFromParent();
    if (typeof this.scene.flushInventoryEvents === "function") {
      this.scene.flushInventoryEvents();
    }
    this.scene.updateHud();
  }

  emitBlockedPickup(itemDrop) {
    if (itemDrop.blockedPickupTimer > 0) return;

    itemDrop.blockedPickupTimer = ITEM_DROP_BLOCKED_RETRY_DELAY;
    this.scene.handleGameEvents([
      {
        type: "itemPickupBlocked",
        itemId: itemDrop.itemId,
        item: itemDrop.item,
        itemInstance: itemDrop.itemInstance,
        reason: this.scene.inventory?.getPickupBlockReason?.(
          itemDrop.itemInstance ?? itemDrop.itemId
        ) ?? "inventoryFull",
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
    this.pendingItemDrop = null;
    for (const itemDrop of this.itemDrops) {
      itemDrop.model.removeFromParent();
    }

    this.itemDrops = [];
  }
}
