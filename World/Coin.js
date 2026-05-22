import * as THREE from "three";
import { flatDistance } from "../Game/Utils.js";
import { DEFAULT_COIN_MODEL_ID } from "../Data/modelDefinitions.js";

const COIN_OCCLUSION_RING_RADIUS = 0.15;
const COIN_OCCLUSION_RING_THICKNESS = 0.018;
const COIN_LAUNCH_DURATION = 0.9;
const COIN_LAUNCH_HEIGHT = 2.2;
const COIN_GROUND_Y = 0.08;
const COIN_WALL_CLEARANCE = 0.28;
const COIN_LANDING_MIN_DISTANCE = 0.62;
const COIN_LANDING_MAX_DISTANCE = 1.35;
const COIN_LANDING_ANGLE_SPREAD = Math.PI * 0.95;

export const COIN_TYPES = {
  BASIC: {
    id: "basic",
    name: "Bronze Coin",
    value: 1,
    color: 0xcd7f32,
    emissive: 0x3b1f08,
    shineColor: 0xffd199,
  },
  HEAVY: {
    id: "heavy",
    name: "Silver Coin",
    value: 5,
    color: 0xc9d1d9,
    emissive: 0x26323b,
    shineColor: 0xffffff,
  },
  LARGE: {
    id: "large",
    name: "Gold Coin",
    value: 10,
    color: 0xf2c94c,
    emissive: 0x5a3b07,
    shineColor: 0xfff2a6,
  },
};

export const DEFAULT_COIN_TYPE_ID = COIN_TYPES.BASIC.id;

export function getCoinTypeDefinition(typeId = DEFAULT_COIN_TYPE_ID) {
  return (
    Object.values(COIN_TYPES).find((coinType) => coinType.id === typeId) ??
    COIN_TYPES.BASIC
  );
}

export function splitCoinValueIntoTypes(totalValue) {
  let remainingValue = Math.max(0, Math.floor(totalValue));
  const coinTypesByValue = Object.values(COIN_TYPES)
    .filter((coinType) => coinType.value > 0)
    .sort((a, b) => b.value - a.value);
  const coins = [];

  for (const coinType of coinTypesByValue) {
    while (remainingValue >= coinType.value) {
      coins.push({
        typeId: coinType.id,
        value: coinType.value,
        name: coinType.name,
      });
      remainingValue -= coinType.value;
    }
  }

  return coins;
}

export class CoinManager {
  constructor(scene) {
    this.scene = scene; // GameScene instance
    this.coinDrops = [];
    this.raycaster = new THREE.Raycaster();
    this.rayDirection = new THREE.Vector3();
    this.coinWorldPosition = new THREE.Vector3();
  }

  createCoinModel(typeId = DEFAULT_COIN_TYPE_ID) {
    let coinRoot = null;
    const coinType = getCoinTypeDefinition(typeId);

    if (typeof this.scene.cloneGameModel === "function") {
      try {
        coinRoot = this.scene.cloneGameModel(DEFAULT_COIN_MODEL_ID);
      } catch (e) {
        coinRoot = null;
      }
    }

    if (!coinRoot) {
      coinRoot = this.createFallbackCoinModel(coinType);
    } else {
      this.applyCoinVisuals(coinRoot, coinType);
    }

    const occlusionMarker = this.createOcclusionMarker();
    coinRoot.add(occlusionMarker);
    coinRoot.userData.occlusionMarker = occlusionMarker;

    coinRoot.userData.pulse = {
      baseScale: 1,
      t: Math.random() * Math.PI * 2,
      speed: 2.2,
      amplitude: 0.08,
    };

    return coinRoot;
  }

  createFallbackCoinModel(coinType) {
    const group = new THREE.Group();
    const coinMat = new THREE.MeshStandardMaterial({
      color: coinType.color,
      emissive: coinType.emissive,
      roughness: 0.35,
      metalness: 0.35,
    });

    const coin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 0.055, 24),
      coinMat
    );
    coin.userData.ignoreFlash = true;
    group.add(coin);

    const shine = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.06, 0.19),
      new THREE.MeshBasicMaterial({ color: coinType.shineColor })
    );
    shine.position.y = 0.035;
    shine.userData.ignoreFlash = true;
    group.add(shine);

    return group;
  }

  applyCoinVisuals(coinRoot, coinType) {
    coinRoot.traverse((child) => {
      if (!child.isMesh || !child.material) return;

      child.material = child.material.clone();

      if (child.material.color) {
        child.material.color.setHex(coinType.color);
      }

      if (child.material.emissive) {
        child.material.emissive.setHex(coinType.emissive);
      }

      if (
        child.material.isMeshStandardMaterial ||
        child.material.isMeshPhysicalMaterial
      ) {
        child.material.metalness = 0.35;
        child.material.roughness = 0.42;
      }

      child.userData.ignoreFlash = true;
    });
  }

  createOcclusionMarker() {
    const group = new THREE.Group();
    group.name = "coinOcclusionMarker";
    group.visible = false;
    group.renderOrder = 80;
    group.position.y = 0.02;

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(
        COIN_OCCLUSION_RING_RADIUS,
        COIN_OCCLUSION_RING_RADIUS + COIN_OCCLUSION_RING_THICKNESS,
        48
      ),
      new THREE.MeshBasicMaterial({
        color: 0xffdf5d,
        transparent: true,
        opacity: 0.82,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.renderOrder = 80;
    ring.userData.ignoreFlash = true;

    group.add(ring);
    return group;
  }

  addCoinDrops(coins) {
    const count = coins.length;

    for (let index = 0; index < count; index += 1) {
      const c = coins[index];
      const coinType = getCoinTypeDefinition(c.typeId);
      const model = this.createCoinModel(coinType.id);
      const origin = c.fallbackOrigin ? c.fallbackOrigin.clone() : c.position.clone();

      const resolved = this.resolveDropPosition(
        c.position.clone(),
        origin,
        index,
        count
      );

      origin.y = COIN_GROUND_Y;
      resolved.y = COIN_GROUND_Y;

      model.position.copy(origin);

      this.scene.levelGroup.add(model);

      this.coinDrops.push({
        model,
        typeId: coinType.id,
        value: c.value ?? coinType.value,
        collected: false,
        collectable: false,
        spinSpeed: 1.6 + this.coinDrops.length * 0.13,
        launch: {
          from: origin,
          to: resolved,
          elapsed: 0,
          duration: COIN_LAUNCH_DURATION + Math.random() * 0.16,
          height: COIN_LAUNCH_HEIGHT + Math.random() * 0.18,
        },
      });
    }
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
      const angleJitter = (Math.random() - 0.5) * COIN_LANDING_ANGLE_SPREAD;
      const distance = THREE.MathUtils.lerp(
        COIN_LANDING_MIN_DISTANCE,
        COIN_LANDING_MAX_DISTANCE,
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
    if (travelled < COIN_LANDING_MIN_DISTANCE * 0.45) {
      return null;
    }

    return lastSafe;
  }

  isSafeLanding(origin, candidate) {
    return (
      this.scene.isWalkablePosition(candidate, COIN_WALL_CLEARANCE) &&
      !this.scene.movementHitsWall(origin, candidate, COIN_WALL_CLEARANCE)
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

  update(delta) {
    if (!this.scene?.player) return;
    const playerPos = this.scene.player.model.position;

    for (const coin of this.coinDrops) {
      if (!coin.model?.userData?.pulse) continue;
      const pulse = coin.model.userData.pulse;
      pulse.t += delta * pulse.speed;
      const s = pulse.baseScale + Math.sin(pulse.t) * pulse.amplitude;
      coin.model.scale.set(s, s, s);

      if (coin.collected) continue;

      this.updateLaunch(coin, delta);

      coin.model.rotation.y += delta * (coin.spinSpeed ?? 1.6);

      if (!coin.collectable) {
        this.updateOcclusionMarker(coin);
        continue;
      }

      const distance = flatDistance(playerPos, coin.model.position);
      if (distance <= 0.8) {
        this.collectCoin(coin);
      }

      this.updateOcclusionMarker(coin);
    }
  }

  updateLaunch(coin, delta) {
    const launch = coin.launch;
    if (!launch) return;

    launch.elapsed += delta;
    const t = Math.min(1, launch.elapsed / launch.duration);
    const eased = 1 - Math.pow(1 - t, 3);

    coin.model.position.lerpVectors(launch.from, launch.to, eased);
    coin.model.position.y = THREE.MathUtils.lerp(
      launch.from.y,
      launch.to.y,
      eased
    ) + Math.sin(t * Math.PI) * launch.height;

    if (t < 1) return;

    coin.model.position.copy(launch.to);
    coin.collectable = true;
    coin.launch = null;
  }

  updateOcclusionMarker(coin) {
    const marker = coin.model.userData.occlusionMarker;
    if (!marker) return;

    if (coin.collected || !this.scene.camera || !this.scene.wallMeshes?.length) {
      marker.visible = false;
      return;
    }

    coin.model.getWorldPosition(this.coinWorldPosition);
    this.coinWorldPosition.y += 0.2;

    const cameraPosition = this.scene.camera.position;
    this.rayDirection.subVectors(this.coinWorldPosition, cameraPosition);
    const coinDistance = this.rayDirection.length();

    if (coinDistance <= 0.0001) {
      marker.visible = false;
      return;
    }

    this.rayDirection.normalize();
    this.raycaster.set(cameraPosition, this.rayDirection);
    this.raycaster.far = coinDistance - 0.08;

    const isBehindWall = this.raycaster.intersectObjects(this.scene.wallMeshes, true).length > 0;
    marker.visible = isBehindWall;
  }

  collectCoin(coin) {
    coin.collected = true;
    coin.model.visible = false;
    try { this.scene.player.addGold(coin.value); } catch (e) {}
    try { this.scene.updateHud(); } catch (e) {}
    try { this.scene.addLog(`Coin picked up: +${coin.value} gold.`); } catch (e) {}
    try { this.scene.sfx.play("chest"); } catch (e) {}
  }

  clear() {
    for (const coin of this.coinDrops) {
      coin.model.removeFromParent();
    }
    this.coinDrops = [];
  }


}
