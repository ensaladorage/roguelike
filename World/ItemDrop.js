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
const ITEM_DROP_GROUP_MIN_SPACING = 1.02;
const ITEM_DROP_GROUP_FORWARD_DISTANCE = 1.15;
const ITEM_DROP_GROUP_FORWARD_STEP = 0.34;
const ITEM_DROP_GROUP_SIDE_SPACING = 0.88;
const ITEM_DROP_GROUP_MAX_DISTANCE = 2.35;
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
  iceCream: { color: 0x9edcff, emissive: 0x12304a },
  potato: { color: 0xcaa15c, emissive: 0x2d1f0c },
  garlic: { color: 0xf1efe0, emissive: 0x2d2b1e },
};

function getItemDropVisualStyle(definition) {
  return ITEM_DROP_ID_STYLES[definition.id] ??
    ITEM_DROP_CATEGORY_STYLES[definition.foodCategory] ??
    { color: 0xd5b069, emissive: 0x2d210c };
}

export class ItemDropManager {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.navigation = options.navigation ?? scene.navigationAdapter ?? scene;
    this.itemDrops = [];
    this.pendingItemDrop = null;
  }

  addItemDrops(items) {
    const preparedDrops = [];
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

      const origin = itemDrop.fallbackOrigin
        ? itemDrop.fallbackOrigin.clone()
        : itemDrop.position.clone();
      const position = itemDrop.position.clone();

      preparedDrops.push({
        itemDrop,
        itemInstance,
        definition,
        origin,
        position,
        index,
        count,
      });
    }

    const resolvedPositions = this.resolveDropDestinations(preparedDrops);

    for (let index = 0; index < preparedDrops.length; index += 1) {
      const {
        itemDrop,
        itemInstance,
        definition,
        origin,
      } = preparedDrops[index];
      const model = this.createItemModel(definition);
      const resolved = resolvedPositions[index];

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

  resolveDropDestinations(preparedDrops) {
    const resolvedPositions = new Array(preparedDrops.length);
    const groups = new Map();

    for (let index = 0; index < preparedDrops.length; index += 1) {
      const preparedDrop = preparedDrops[index];
      const groupId = preparedDrop.itemDrop.dropLayout?.groupId;

      if (!groupId) {
        resolvedPositions[index] = this.resolveDropPosition(
          preparedDrop.position.clone(),
          preparedDrop.origin,
          preparedDrop.index,
          preparedDrop.count
        );
        continue;
      }

      if (!groups.has(groupId)) {
        groups.set(groupId, []);
      }
      groups.get(groupId).push({ preparedDrop, index });
    }

    for (const entries of groups.values()) {
      const drops = entries.map((entry) => entry.preparedDrop);
      const layout = drops[0]?.itemDrop.dropLayout ?? {};
      const positions = drops.length > 1
        ? this.resolveGroupedDropPositions(drops, layout)
        : [
          this.resolveDropPosition(
            drops[0].position.clone(),
            drops[0].origin,
            drops[0].index,
            drops[0].count
          ),
        ];

      for (let index = 0; index < entries.length; index += 1) {
        resolvedPositions[entries[index].index] = positions[index];
      }
    }

    return resolvedPositions;
  }

  resolveGroupedDropPositions(preparedDrops, layout = {}) {
    const origin = preparedDrops[0]?.origin?.clone?.();
    if (!origin) return [];

    origin.y = 0;

    const minSpacing = Number.isFinite(layout.minSpacing)
      ? Math.max(0, layout.minSpacing)
      : ITEM_DROP_GROUP_MIN_SPACING;
    const accepted = [];

    for (let index = 0; index < preparedDrops.length; index += 1) {
      const candidates = this.createGroupedDropCandidates(
        preparedDrops,
        index,
        origin,
        layout
      );
      const chosen =
        this.chooseGroupedDropCandidate(origin, candidates, accepted, minSpacing) ??
        this.resolveGroupedDropFallback(
          origin,
          preparedDrops[index].position,
          accepted,
          layout
        );

      accepted.push(chosen);
    }

    return accepted;
  }

  createGroupedDropCandidates(preparedDrops, dropIndex, origin, layout = {}) {
    const count = preparedDrops.length;
    const centeredIndex = dropIndex - (count - 1) / 2;
    const baseAngle = this.getGroupedDropBaseAngle(preparedDrops, origin, layout);
    const forwardDistance = Number.isFinite(layout.forwardDistance)
      ? layout.forwardDistance
      : ITEM_DROP_GROUP_FORWARD_DISTANCE;
    const forwardStep = Number.isFinite(layout.forwardStep)
      ? layout.forwardStep
      : ITEM_DROP_GROUP_FORWARD_STEP;
    const sideSpacing = Number.isFinite(layout.sideSpacing)
      ? layout.sideSpacing
      : ITEM_DROP_GROUP_SIDE_SPACING;
    const maxDistance = Number.isFinite(layout.maxDistance)
      ? Math.max(forwardDistance, layout.maxDistance)
      : ITEM_DROP_GROUP_MAX_DISTANCE;
    const forward = new THREE.Vector3(Math.cos(baseAngle), 0, Math.sin(baseAngle));
    const right = new THREE.Vector3(forward.z, 0, -forward.x);
    const candidates = [];

    for (let row = 0; row < 5; row += 1) {
      const distance = forwardDistance +
        row * forwardStep +
        Math.abs(centeredIndex) * 0.08;
      const side = centeredIndex * sideSpacing +
        (row % 2 === 0 ? 0 : Math.sign(centeredIndex || 1) * sideSpacing * 0.35);
      candidates.push(
        this.clampGroupedDropOffset(
          origin,
          forward.clone().multiplyScalar(distance).addScaledVector(right, side),
          maxDistance
        )
      );
    }

    const radialBase = Math.min(
      maxDistance,
      forwardDistance + Math.abs(centeredIndex) * 0.22
    );
    for (let ring = 0; ring < 6; ring += 1) {
      const angleOffset = centeredIndex * 0.52 + (ring - 2.5) * 0.24;
      const distance = Math.min(maxDistance, radialBase + ring * 0.18);
      candidates.push(new THREE.Vector3(
        origin.x + Math.cos(baseAngle + angleOffset) * distance,
        0,
        origin.z + Math.sin(baseAngle + angleOffset) * distance
      ));
    }

    const preferred = preparedDrops[dropIndex]?.position?.clone?.();
    if (preferred) {
      preferred.y = 0;
      candidates.push(preferred);
    }

    return candidates;
  }

  getGroupedDropBaseAngle(preparedDrops, origin, layout = {}) {
    if (Number.isFinite(layout.forwardX) || Number.isFinite(layout.forwardZ)) {
      const x = Number.isFinite(layout.forwardX) ? layout.forwardX : 0;
      const z = Number.isFinite(layout.forwardZ) ? layout.forwardZ : 0;
      if (Math.hypot(x, z) > 0.0001) {
        return Math.atan2(z, x);
      }
    }

    const firstOffset = preparedDrops[0]?.position?.clone?.().sub(origin);
    if (firstOffset && firstOffset.lengthSq() > 0.0001) {
      firstOffset.y = 0;
      return Math.atan2(firstOffset.z, firstOffset.x);
    }

    return Math.random() * Math.PI * 2;
  }

  clampGroupedDropOffset(origin, offset, maxDistance) {
    const distance = Math.hypot(offset.x, offset.z);
    if (distance > maxDistance && distance > 0.0001) {
      offset.multiplyScalar(maxDistance / distance);
    }

    return new THREE.Vector3(origin.x + offset.x, 0, origin.z + offset.z);
  }

  chooseGroupedDropCandidate(origin, candidates, accepted, minSpacing) {
    let bestCandidate = null;
    let bestDistance = -Infinity;

    for (const candidate of candidates) {
      const safeCandidate = this.resolveWallCollision(origin, candidate);
      if (!safeCandidate) continue;

      const nearestDistance = this.getNearestDropDistance(safeCandidate, accepted);
      if (nearestDistance >= minSpacing) {
        return safeCandidate;
      }

      if (nearestDistance > bestDistance) {
        bestDistance = nearestDistance;
        bestCandidate = safeCandidate;
      }
    }

    return bestCandidate;
  }

  resolveGroupedDropFallback(origin, preferredPosition, accepted, layout = {}) {
    const maxDistance = Number.isFinite(layout.maxDistance)
      ? Math.max(ITEM_DROP_LANDING_MAX_DISTANCE, layout.maxDistance)
      : ITEM_DROP_GROUP_MAX_DISTANCE;
    const candidates = [];

    if (preferredPosition) {
      const preferred = preferredPosition.clone();
      preferred.y = 0;
      candidates.push(preferred);
    }

    for (let ring = 0; ring < 3; ring += 1) {
      const distance = Math.min(maxDistance, ITEM_DROP_LANDING_MAX_DISTANCE + ring * 0.35);
      for (let step = 0; step < 12; step += 1) {
        const angle = (step / 12) * Math.PI * 2 + ring * 0.17;
        candidates.push(new THREE.Vector3(
          origin.x + Math.cos(angle) * distance,
          0,
          origin.z + Math.sin(angle) * distance
        ));
      }
    }

    let bestCandidate = null;
    let bestDistance = -Infinity;

    for (const candidate of candidates) {
      const safeCandidate = this.resolveWallCollision(origin, candidate);
      if (!safeCandidate) continue;

      const nearestDistance = this.getNearestDropDistance(safeCandidate, accepted);
      if (nearestDistance > bestDistance) {
        bestDistance = nearestDistance;
        bestCandidate = safeCandidate;
      }
    }

    if (bestCandidate) return bestCandidate;

    const originFallback = origin.clone();
    originFallback.y = 0;
    return originFallback;
  }

  getNearestDropDistance(candidate, accepted) {
    if (accepted.length === 0) return Infinity;

    return accepted.reduce(
      (nearest, position) => Math.min(nearest, flatDistance(candidate, position)),
      Infinity
    );
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
      this.navigation.isWalkablePosition(candidate, ITEM_DROP_WALL_CLEARANCE) &&
      !this.navigation.movementHitsWall(origin, candidate, ITEM_DROP_WALL_CLEARANCE)
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
