import * as THREE from "three";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { flatDistance } from "../Game/Utils.js";

export class ChestManager {
  constructor(scene) {
    this.scene = scene;

    this.chests = [];
  }

  // =========================
  // LOAD CHESTS FROM LEVEL
  // =========================
  load(level) {
    this.clear();

    this.chests = level.chests.map((data) => {
      const model = this.createChestModel();

      model.position.set(data.x, 0, data.z);
      model.rotation.y = data.rotationY;
      model.scale.set(1.6, 1.6, 1.6
      
      );

      this.scene.levelGroup.add(model);

      return {
        model,
        gold: data.gold,
        coinDrop: data.coinDrop ?? {
          count: 3,
          value: 1,
          radius: 0.62,
        },
        collected: false,
      };
    });
  }

  // =========================
  // UPDATE LOOP ENTRY POINT
  // =========================
  update() {
    this.checkChestProximity();
  }

  // =========================
  // PROXIMITY CHECK
  // =========================
  checkChestProximity() {
    const playerPos = this.scene.player.model.position;

    for (const chest of this.chests) {
      if (chest.collected) continue;

      const distance = flatDistance(playerPos, chest.model.position);

      if (distance <= 1.25) {
        this.collectChest(chest);
      }
    }
  }

  // =========================
  // COLLECT CHEST
  // =========================
  collectChest(chest) {
    const collectedGold = this.scene.player.collectChest(chest);

    if (collectedGold <= 0) return;

    chest.collected = true;

    const lid = chest.model.getObjectByName("lid");
    if (lid) lid.rotation.x = -0.85;

    this.spawnCoins(chest);

    this.scene.updateHud();
    this.scene.addLog(`Cofre abierto: +${collectedGold} oro.`);

    this.scene.sfx.play("chest");
  }

  // =========================
  // COINS FROM CHEST
  // =========================
  spawnCoins(chest) {
    const coins = [];
    const coinDrop = chest.coinDrop;
    const count = Math.max(0, coinDrop.count ?? 0);

    const origin = chest.model.position;

    const forward = new THREE.Vector3(0, 0, 1)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), chest.model.rotation.y)
      .normalize();

    const right = new THREE.Vector3(forward.z, 0, -forward.x);

    for (let i = 0; i < count; i++) {
      const centered = i - (count - 1) / 2;

      const sideOffset = centered * 0.28;
      const forwardOffset =
        (coinDrop.radius ?? 0.6) + (Math.abs(centered) % 2) * 0.12;

      const position = origin
        .clone()
        .addScaledVector(forward, forwardOffset)
        .addScaledVector(right, sideOffset);

      coins.push({
        value: coinDrop.value ?? 1,
        position: new THREE.Vector3(position.x, 0, position.z),
        fallbackOrigin: origin.clone(),
      });
    }

    if (this.scene.coinManager) {
      this.scene.coinManager.addCoinDrops(coins);
    } else {
      // fallback: try old API if coinManager not yet initialized
      if (typeof this.scene.addCoinDrops === 'function') this.scene.addCoinDrops(coins);
    }
  }

  // =========================
  // COIN UPDATE
  // =========================


  // =========================
  // CREATE CHEST MODEL
  // =========================
  createChestModel() {
    if (this.scene.models && this.scene.models.loaded && this.scene.models.chest) {
      try {
        const cloned = SkeletonUtils.clone(this.scene.models.chest.scene);
        cloned.traverse((child) => {
          if (!child.isMesh) return;

          child.castShadow = true;
          child.receiveShadow = true;

          if (child.material) {
            // Ensure texture uses sRGB color space
            if (child.material.map) {
              child.material.map.colorSpace = THREE.SRGBColorSpace;
            }
            // Optimize material
            if (child.material.isMeshStandardMaterial || child.material.isMeshPhysicalMaterial) {
              child.material.metalness = 0;
              child.material.roughness = Math.max(child.material.roughness ?? 1, 0.7);
              child.material.needsUpdate = true;
            }
          }
        });
        return cloned;
      } catch (e) {
        console.warn("Final chest model clone failed:", e);
      }
    }

    console.warn("Final chest model is not loaded. Check Assets/Models/chest.glb.");
    return new THREE.Group();
  }

  // =========================
  // CLEAN
  // =========================
  clear() {
    for (const chest of this.chests) {
      chest.model.removeFromParent();
    }

    if (this.scene.coinManager) {
      this.scene.coinManager.clear();
    }

    this.chests = [];
  }
}
