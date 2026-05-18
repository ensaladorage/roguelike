import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { flatDistance } from "../Game/Utils.js";

export class CoinManager {
  constructor(scene) {
    this.scene = scene; // GameScene instance
    this.coinDrops = [];
    this.models = {};
    this.loader = new GLTFLoader();

    // Outline handled by scene.outlineManager (created in Scene.js)
    // try load coin model asynchronously
    this.loadModel();
  }

  async loadModel() {
    try {
      const modelPath = (name) => `Assets/Models/${name}.glb`;
      const gltf = await this.loader.loadAsync(modelPath("coin"));
      this.models.coin = gltf;
      // no immediate processing needed; future clones will use it
    } catch (e) {
      // silently ignore
    }
  }

  // Outline setup moved to OutlineManager (World/OutlineManager.js)

  createCoinModel() {
    let coinRoot = null;

    if (this.models?.coin) {
      try {
        coinRoot = SkeletonUtils.clone(this.models.coin.scene);
        coinRoot.traverse((child) => {
          if (!child.isMesh) return;
          child.castShadow = true;
          child.receiveShadow = true;
          if (child.material?.map) child.material.map.colorSpace = THREE.SRGBColorSpace;
          if (child.material?.isMeshStandardMaterial || child.material?.isMeshPhysicalMaterial) {
            child.material.metalness = 0;
            child.material.roughness = 0.8;
          }
        });
      } catch (e) {
        coinRoot = null;
      }
    }

    if (!coinRoot) {
      const group = new THREE.Group();
      const coinMat = new THREE.MeshStandardMaterial({
        color: 0xe0bb42,
        emissive: 0x3b2b06,
        roughness: 0.35,
        metalness: 0.35,
      });

      const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.055, 24), coinMat);
      coin.userData.ignoreFlash = true;
      group.add(coin);

      const shine = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.19), new THREE.MeshBasicMaterial({ color: 0xffec95 }));
      shine.position.y = 0.035;
      shine.userData.ignoreFlash = true;
      group.add(shine);

      coinRoot = group;
    }

    // Add subtle outline as a mesh fallback so coins look good even without postprocessing
    const outline = coinRoot.clone();
    outline.traverse((child) => {
      if (!child.isMesh) return;
      child.material = new THREE.MeshBasicMaterial({
        color: 0xffdf5d,
        transparent: true,
        opacity: 0.18,
        depthTest: false,
        depthWrite: false,
        side: THREE.BackSide,
      });
      child.renderOrder = 10;
      child.userData.ignoreFlash = true;
    });
    outline.scale.multiplyScalar(1);
    coinRoot.add(outline);

    coinRoot.userData.pulse = {
      baseScale: 1,
      t: Math.random() * Math.PI * 2,
      speed: 2.2,
      amplitude: 0.08,
    };

    return coinRoot;
  }

  addCoinDrops(coins) {
    for (const c of coins) {
      const model = this.createCoinModel();

      const resolved = this.resolveDropPosition(
        c.position.clone(),
        c.fallbackOrigin ? c.fallbackOrigin.clone() : c.position.clone()
      );

      model.position.copy(resolved);
      model.position.y = 0.08;

      this.scene.levelGroup.add(model);

      this.coinDrops.push({
        model,
        value: c.value,
        collected: false,
        spinSpeed: 1.6 + this.coinDrops.length * 0.13,
      });
    }
  }

  resolveDropPosition(position, fallbackOrigin) {
    if (this.scene.isWalkablePosition(position, 0.12)) {
      position.y = 0;
      return position;
    }
    const fallback = fallbackOrigin.clone();
    fallback.y = 0;
    return fallback;
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
      coin.model.rotation.y += delta * (coin.spinSpeed ?? 1.6);

      const distance = flatDistance(playerPos, coin.model.position);
      if (distance <= 0.8) {
        this.collectCoin(coin);
      }
    }

    // update outline selection via scene-wide OutlineManager if present
    if (this.scene.outlineManager && this.scene.outlineManager.enabled) {
      const selected = this.coinDrops.filter(c => !c.collected).map(c => c.model);
      this.scene.outlineManager.setSelection(selected);
    }
  }

  collectCoin(coin) {
    coin.collected = true;
    coin.model.visible = false;
    try { this.scene.player.addGold(coin.value); } catch (e) {}
    try { this.scene.updateHud(); } catch (e) {}
    try { this.scene.addLog(`Moneda recogida: +${coin.value} oro.`); } catch (e) {}
    try { this.scene.sfx.play("chest"); } catch (e) {}
  }

  clear() {
    for (const coin of this.coinDrops) {
      coin.model.removeFromParent();
    }
    this.coinDrops = [];
  }


}
