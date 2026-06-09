import * as THREE from "three";

export function rgb(red, green, blue) {
  const clampChannel = (value) =>
    Math.max(0, Math.min(255, Math.round(Number(value) || 0)));

  return new THREE.Color(
    `rgb(${clampChannel(red)}, ${clampChannel(green)}, ${clampChannel(blue)})`
  );
}

export const VFX_DEFAULTS = {
  entryStairsBlocker: {
    color: rgb(255, 0, 0),
    proximityRadius: 1.5,
    fadeSpeed: 30,
    tileSize: 1,
    tileOffset: 0.55,
    y: 0.46,
    horizontalTileY: 1,
    tileRotation: {
      x: 0,
      y: 0,
      z: 0,
    },
    baseOpacity: 0.18,
    pulseOpacity: 0.6,
    pulseScale: 0.1,
    pulseSpeed: 2,
  },
  purpleGasCloud: {
    color: 0x9c61ff,
    duration: 1.25,
    radius: 1.2,
    puffCount: 9,
    floorOpacity: 0.22,
    puffOpacity: 0.34,
    rise: 0.42,
  },
  playerHitSlash: {
    color: 0xff2438,
    duration: 0.3,
    width: 0.84,
    height: 0.064,
    y: 0.5,
    opacity: 1,
    zRotation: -0.55,
  },
  playerAttackRangeIndicator: {
    color: 0xffffff,
    opacity: 0.22,
    y: 0.055,
    thickness: 0.018,
    segments: 96,
  },
  playerAttackSlash: {
    color: 0xffffff,
    duration: 0.16,
    width: 0.86,
    height: 0.11,
    y: 0.22,
    opacity: 0.82,
    hitColor: 0xfff1b0,
    whiffColor: 0xd7e6ff,
  },
  modelFlash: {
    duration: 0.16,
    emissiveIntensity: 0.9,
  },
  pointLights: {
    lantern: {
      color: 0xffb45a,
      intensity: 1.2,
      distance: 5,
      decay: 2,
      y: 0.6,
      xOffset: -0.02,
      zOffset: 0,
      castShadow: false,
    },
  },
};

export class VFX {
  constructor({ root = null } = {}) {
    this.root = root;
    this.effects = [];
    this.modelFlashEffects = [];
    this.persistentEffects = [];
    this.pointLights = [];
  }

  setRoot(root) {
    this.root = root;
  }

  playPurpleGasCloud(target, options = {}) {
    if (!this.root) return;

    const config = {
      ...VFX_DEFAULTS.purpleGasCloud,
      ...options,
    };

    const group = new THREE.Group();
    const origin = this.getTargetPosition(target);
    if (!origin) return;

    group.position.set(origin.x, 0, origin.z);

    const floorMaterial = new THREE.MeshBasicMaterial({
      color: config.color,
      transparent: true,
      opacity: config.floorOpacity,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const floorHaze = new THREE.Mesh(
      new THREE.CircleGeometry(config.radius, 48),
      floorMaterial
    );
    floorHaze.rotation.x = -Math.PI / 2;
    floorHaze.position.y = 0.08;
    floorHaze.renderOrder = 35;
    group.add(floorHaze);

    const particles = [
      {
        mesh: floorHaze,
        material: floorMaterial,
        type: "floor",
        baseScale: 0.35,
        baseOpacity: config.floorOpacity,
        delay: 0,
      },
    ];

    for (let i = 0; i < config.puffCount; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * config.radius * 0.55;
      const size = 0.34 + Math.random() * 0.38;
      const delay = Math.random() * 0.18;

      const material = new THREE.MeshBasicMaterial({
        color: config.color,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      });

      const puff = new THREE.Mesh(
        new THREE.CircleGeometry(1, 28),
        material
      );
      puff.position.set(
        Math.cos(angle) * distance,
        0.36 + Math.random() * 0.58,
        Math.sin(angle) * distance
      );
      puff.scale.setScalar(size);
      puff.renderOrder = 36;
      group.add(puff);

      particles.push({
        mesh: puff,
        material,
        type: "puff",
        baseScale: size,
        baseOpacity: config.puffOpacity,
        delay,
        riseSpeed: config.rise * (0.65 + Math.random() * 0.7),
        drift: new THREE.Vector3(
          Math.cos(angle) * 0.12,
          0,
          Math.sin(angle) * 0.12
        ),
      });
    }

    this.root.add(group);
    this.effects.push({
      group,
      target,
      particles,
      elapsed: 0,
      duration: config.duration,
    });
  }

  playModelFlash(
    model,
    color = 0xffffff,
    duration = VFX_DEFAULTS.modelFlash.duration,
    options = {}
  ) {
    if (!model) return;

    const config = {
      ...VFX_DEFAULTS.modelFlash,
      ...options,
      duration,
    };
    const flashColor = new THREE.Color(color);
    this.restoreModelFlash(model);
    this.modelFlashEffects = this.modelFlashEffects.filter(
      (effect) => effect.model !== model
    );

    model.traverse((child) => {
      if (child.userData.ignoreFlash) return;
      if (!child.isMesh || !child.material) return;

      if (!child.userData.flashMaterialsCloned) {
        child.material = Array.isArray(child.material)
          ? child.material.map((material) => material.clone())
          : child.material.clone();
        child.userData.flashMaterialsCloned = true;
      }

      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];

      for (const material of materials) {
        if (!material?.color) continue;

        if (!material.userData.baseColor) {
          material.userData.baseColor = material.color.clone();
        }

        material.color.copy(flashColor);

        if (material.emissive) {
          if (!material.userData.baseEmissive) {
            material.userData.baseEmissive = material.emissive.clone();
          }

          if (material.userData.baseEmissiveIntensity === undefined) {
            material.userData.baseEmissiveIntensity =
              material.emissiveIntensity ?? 1;
          }

          material.emissive.copy(flashColor);
          material.emissiveIntensity = Math.max(
            material.emissiveIntensity ?? 1,
            config.emissiveIntensity
          );
        }
      }
    });

    this.modelFlashEffects.push({
      model,
      duration: config.duration,
      elapsed: 0,
      flashColor,
    });
  }

  playPlayerHitSlash(target, options = {}) {
    if (!this.root) return;

    const config = {
      ...VFX_DEFAULTS.playerHitSlash,
      ...options,
    };
    const origin = this.getTargetPosition(target);
    if (!origin) return;

    const group = new THREE.Group();
    group.position.set(origin.x, config.y, origin.z);

    const material = new THREE.MeshBasicMaterial({
      color: config.color,
      transparent: true,
      opacity: config.opacity,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(config.width, config.height),
      material
    );

    mesh.rotation.z = config.zRotation;
    mesh.renderOrder = 80;
    group.add(mesh);
    this.root.add(group);

    this.effects.push({
      type: "playerHitSlash",
      group,
      mesh,
      material,
      target,
      elapsed: 0,
      duration: config.duration,
      config,
    });
  }

  playPlayerAttackSlash(position, direction, options = {}) {
    if (!this.root || !position || !direction) return;

    const config = {
      ...VFX_DEFAULTS.playerAttackSlash,
      ...options,
    };
    const attackDirection = new THREE.Vector3(direction.x, 0, direction.z);
    if (attackDirection.lengthSq() <= 0.0001) return;
    attackDirection.normalize();

    const group = new THREE.Group();
    group.position.set(position.x, config.y, position.z);
    group.rotation.y = Math.atan2(attackDirection.x, attackDirection.z);

    const material = new THREE.MeshBasicMaterial({
      color: config.color,
      transparent: true,
      opacity: config.opacity,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(config.width, config.height),
      material
    );

    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = 96;
    group.add(mesh);
    this.root.add(group);

    this.effects.push({
      type: "playerAttackSlash",
      group,
      mesh,
      material,
      elapsed: 0,
      duration: config.duration,
      config,
    });
  }

  addPointLight(type, target, options = {}) {
    if (!this.root) return null;

    const defaults =
      VFX_DEFAULTS.pointLights[type] ?? VFX_DEFAULTS.pointLights.lantern;
    const config = {
      ...defaults,
      ...options,
    };
    const origin = this.getTargetPosition(target);
    if (!origin) return null;

    const light = new THREE.PointLight(
      config.color,
      config.intensity,
      config.distance,
      config.decay
    );

    light.castShadow = config.castShadow;
    light.position.set(
      origin.x + (config.xOffset ?? 0),
      config.y,
      origin.z + (config.zOffset ?? 0)
    );
    light.userData.type = type;

    this.root.add(light);
    this.pointLights.push(light);

    return light;
  }

  addEntryStairsBlocker(stairs, player, options = {}) {
    if (!this.root || !stairs || !player) return null;

    const config = {
      ...VFX_DEFAULTS.entryStairsBlocker,
      ...options,
      tileRotation: {
        ...VFX_DEFAULTS.entryStairsBlocker.tileRotation,
        ...(options.tileRotation ?? {}),
      },
    };
    const frontVector = this.getFrontVectorForSide(stairs.side);
    const sideVector = this.getSideVectorForSide(stairs.side);
    if (!frontVector || !sideVector) return null;

    const group = new THREE.Group();
    group.visible = false;

    const material = new THREE.MeshBasicMaterial({
      color: config.color,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const geometry = new THREE.PlaneGeometry(config.tileSize, config.tileSize);
    const tileDefinitions = [
      {
        direction: frontVector,
        x: frontVector.x * config.tileOffset,
        z: frontVector.z * config.tileOffset,
      },
      {
        direction: sideVector,
        x: sideVector.x * config.tileOffset,
        z: sideVector.z * config.tileOffset,
      },
      {
        direction: { x: -sideVector.x, z: -sideVector.z },
        x: -sideVector.x * config.tileOffset,
        z: -sideVector.z * config.tileOffset,
      },
      {
        direction: frontVector,
        x: 0,
        y: config.horizontalTileY,
        z: 0,
        rotation: {
          x: -Math.PI / 2,
          y: 0,
          z: 0,
        },
      },
    ];

    const tiles = tileDefinitions.map((tile) => {
      const mesh = new THREE.Mesh(geometry, material);
      const rotation = tile.rotation ?? {
        x: config.tileRotation.x,
        y: this.getYawForDirection(tile.direction) + config.tileRotation.y,
        z: config.tileRotation.z,
      };

      mesh.rotation.set(rotation.x, rotation.y, rotation.z);
      mesh.position.set(
        stairs.x + tile.x,
        tile.y ?? config.y,
        stairs.z + tile.z
      );
      mesh.renderOrder = 34;
      group.add(mesh);
      return mesh;
    });

    this.root.add(group);

    const effect = {
      type: "entryStairsBlocker",
      group,
      tiles,
      geometry,
      material,
      player,
      stairs: { ...stairs },
      config,
      elapsed: 0,
      visibility: 0,
      isPlayerInRadius: false,
    };

    this.persistentEffects.push(effect);
    return effect;
  }

  addPlayerAttackRangeIndicator(player, options = {}) {
    if (!this.root || !player) return null;

    const config = {
      ...VFX_DEFAULTS.playerAttackRangeIndicator,
      ...options,
    };
    const group = new THREE.Group();
    const material = new THREE.MeshBasicMaterial({
      color: config.color,
      transparent: true,
      opacity: config.opacity,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const effect = {
      type: "playerAttackRangeIndicator",
      group,
      material,
      geometry: null,
      mesh: null,
      player,
      config,
      lastRange: null,
    };

    this.root.add(group);
    this.persistentEffects.push(effect);
    this.updatePlayerAttackRangeIndicator(effect);

    return effect;
  }

  update(delta, camera) {
    this.updatePersistentEffects(delta);
    this.updateModelFlashEffects(delta);

    this.effects = this.effects.filter((effect) => {
      if (effect.type === "playerHitSlash") {
        return this.updatePlayerHitSlash(effect, delta, camera);
      }

      if (effect.type === "playerAttackSlash") {
        return this.updatePlayerAttackSlash(effect, delta);
      }

      effect.elapsed += delta;
      const t = Math.min(1, effect.elapsed / effect.duration);
      const origin = this.getTargetPosition(effect.target);

      if (origin) {
        effect.group.position.x = origin.x;
        effect.group.position.z = origin.z;
      }

      for (const particle of effect.particles) {
        const localDuration = Math.max(0.001, effect.duration - particle.delay);
        const localT = Math.max(
          0,
          Math.min(1, (effect.elapsed - particle.delay) / localDuration)
        );
        const eased = 1 - Math.pow(1 - localT, 2);

        if (effect.elapsed < particle.delay) {
          particle.material.opacity = 0;
          continue;
        }

        if (particle.type === "floor") {
          const scale = particle.baseScale + eased * 1.15;
          particle.mesh.scale.set(scale, scale, scale);
        } else {
          const scale = particle.baseScale * (0.7 + eased * 1.05);
          particle.mesh.scale.setScalar(scale);
          particle.mesh.position.y += particle.riseSpeed * delta;
          particle.mesh.position.x += particle.drift.x * delta;
          particle.mesh.position.z += particle.drift.z * delta;

          if (camera) {
            particle.mesh.lookAt(camera.position);
          }
        }

        particle.material.opacity = particle.baseOpacity * (1 - eased);
      }

      if (t < 1) return true;

      this.disposeEffect(effect);
      return false;
    });
  }

  updateModelFlashEffects(delta) {
    this.modelFlashEffects = this.modelFlashEffects.filter((effect) => {
      effect.elapsed += delta;

      const t = Math.min(1, effect.elapsed / effect.duration);

      effect.model.traverse((child) => {
        if (!child.isMesh || !child.material) return;

        const materials = Array.isArray(child.material)
          ? child.material
          : [child.material];

        for (const material of materials) {
          if (!material?.color || !material.userData.baseColor) continue;

          material.color.copy(effect.flashColor);
          material.color.lerp(material.userData.baseColor, t);

          if (material.emissive && material.userData.baseEmissive) {
            material.emissive.copy(effect.flashColor);
            material.emissive.lerp(material.userData.baseEmissive, t);
            material.emissiveIntensity = THREE.MathUtils.lerp(
              material.emissiveIntensity ?? 1,
              material.userData.baseEmissiveIntensity ?? 1,
              t
            );
          }
        }
      });

      if (t < 1) return true;

      this.restoreModelFlash(effect.model);
      return false;
    });
  }

  restoreModelFlash(model) {
    model.traverse((child) => {
      if (!child.isMesh || !child.material) return;

      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];

      for (const material of materials) {
        if (material?.color && material.userData.baseColor) {
          material.color.copy(material.userData.baseColor);
        }

        if (material?.emissive && material.userData.baseEmissive) {
          material.emissive.copy(material.userData.baseEmissive);
          material.emissiveIntensity =
            material.userData.baseEmissiveIntensity ?? material.emissiveIntensity;
        }
      }
    });
  }

  updatePlayerHitSlash(effect, delta, camera) {
    effect.elapsed += delta;
    const t = Math.min(1, effect.elapsed / effect.duration);
    const origin = this.getTargetPosition(effect.target);

    if (origin) {
      effect.group.position.x = origin.x;
      effect.group.position.z = origin.z;
    }

    if (camera) {
      effect.group.lookAt(camera.position);
    }

    effect.mesh.rotation.z = effect.config.zRotation;
    effect.mesh.scale.x = 0.75 + t * 0.45;
    effect.mesh.scale.y = 1 + t * 0.25;
    effect.material.opacity = effect.config.opacity * (1 - t);

    if (t < 1) return true;

    this.disposePlayerHitSlash(effect);
    return false;
  }

  updatePlayerAttackSlash(effect, delta) {
    effect.elapsed += delta;
    const t = Math.min(1, effect.elapsed / effect.duration);
    const eased = 1 - Math.pow(1 - t, 2);

    effect.mesh.scale.x = 0.75 + eased * 0.55;
    effect.mesh.scale.y = 1 + eased * 0.3;
    effect.material.opacity = effect.config.opacity * (1 - eased);

    if (t < 1) return true;

    this.disposePlayerAttackSlash(effect);
    return false;
  }

  updatePersistentEffects(delta) {
    for (const effect of this.persistentEffects) {
      switch (effect.type) {
        case "entryStairsBlocker":
          this.updateEntryStairsBlocker(effect, delta);
          break;

        case "playerAttackRangeIndicator":
          this.updatePlayerAttackRangeIndicator(effect);
          break;
      }
    }
  }

  updatePlayerAttackRangeIndicator(effect) {
    const playerPosition = this.getTargetPosition(effect.player);
    const range = Math.max(0, Number(effect.player?.attackRange) || 0);

    if (!playerPosition || range <= 0) {
      effect.group.visible = false;
      return;
    }

    effect.group.visible = true;
    effect.group.position.set(playerPosition.x, effect.config.y, playerPosition.z);

    if (
      effect.mesh &&
      effect.lastRange !== null &&
      Math.abs(effect.lastRange - range) <= 0.001
    ) {
      return;
    }

    effect.mesh?.removeFromParent();
    effect.geometry?.dispose();

    const innerRadius = Math.max(0.01, range - effect.config.thickness);
    const outerRadius = range;
    effect.geometry = new THREE.RingGeometry(
      innerRadius,
      outerRadius,
      effect.config.segments
    );
    effect.mesh = new THREE.Mesh(effect.geometry, effect.material);
    effect.mesh.rotation.x = -Math.PI / 2;
    effect.mesh.renderOrder = 32;
    effect.mesh.userData.ignoreFlash = true;
    effect.group.add(effect.mesh);
    effect.lastRange = range;
  }

  updateEntryStairsBlocker(effect, delta) {
    const playerPosition = this.getTargetPosition(effect.player);
    if (!playerPosition) {
      effect.group.visible = false;
      effect.isPlayerInRadius = false;
      return;
    }

    const isPlayerInRadius = this.isTargetWithinRadius(
      effect.player,
      effect.stairs,
      effect.config.proximityRadius
    );
    const targetVisibility = isPlayerInRadius ? 1 : 0;
    const visibilityStep = Math.min(1, delta * effect.config.fadeSpeed);

    effect.elapsed += delta;
    effect.visibility += (targetVisibility - effect.visibility) * visibilityStep;

    if (isPlayerInRadius && !effect.isPlayerInRadius) {
      effect.config.onEnterRadius?.(effect);
    }

    effect.isPlayerInRadius = isPlayerInRadius;

    if (effect.visibility <= 0.01) {
      effect.visibility = 0;
      effect.group.visible = false;
      effect.material.opacity = 0;
      return;
    }

    const pulse = (Math.sin(effect.elapsed * effect.config.pulseSpeed) + 1) / 2;
    const opacity =
      effect.config.baseOpacity + effect.config.pulseOpacity * pulse;
    const scale = 1 + effect.config.pulseScale * pulse;

    effect.group.visible = true;
    effect.material.opacity = opacity * effect.visibility;

    for (const tile of effect.tiles) {
      tile.scale.setScalar(scale);
    }
  }

  clear() {
    for (const effect of this.effects) {
      if (effect.type === "playerHitSlash") {
        this.disposePlayerHitSlash(effect);
      } else if (effect.type === "playerAttackSlash") {
        this.disposePlayerAttackSlash(effect);
      } else {
        this.disposeEffect(effect);
      }
    }

    this.effects = [];

    for (const effect of this.modelFlashEffects) {
      this.restoreModelFlash(effect.model);
    }

    this.modelFlashEffects = [];

    for (const effect of this.persistentEffects) {
      this.disposePersistentEffect(effect);
    }

    this.persistentEffects = [];

    for (const light of this.pointLights) {
      light.removeFromParent();
      light.dispose?.();
    }

    this.pointLights = [];
  }

  getTargetPosition(target) {
    if (!target) return null;

    const position = target.model?.position ?? target.position ?? target;

    if (
      typeof position.x !== "number" ||
      typeof position.z !== "number"
    ) {
      return null;
    }

    return position;
  }

  isTargetWithinRadius(target, center, radius) {
    const position = this.getTargetPosition(target);
    if (!position || !center) return false;

    const dx = position.x - center.x;
    const dz = position.z - center.z;

    return Math.hypot(dx, dz) <= radius;
  }

  disposeEffect(effect) {
    effect.group.removeFromParent();

    for (const particle of effect.particles) {
      particle.mesh.geometry.dispose();
      particle.material.dispose();
    }
  }

  disposePlayerHitSlash(effect) {
    effect.group.removeFromParent();
    effect.mesh.geometry.dispose();
    effect.material.dispose();
  }

  disposePlayerAttackSlash(effect) {
    effect.group.removeFromParent();
    effect.mesh.geometry.dispose();
    effect.material.dispose();
  }

  disposePersistentEffect(effect) {
    effect.group.removeFromParent();
    effect.geometry?.dispose();
    effect.material?.dispose();
  }

  getSideVectorForSide(side) {
    switch (side) {
      case "north":
      case "south":
        return { x: 1, z: 0 };

      case "west":
      case "east":
        return { x: 0, z: 1 };

      default:
        return null;
    }
  }

  getFrontVectorForSide(side) {
    switch (side) {
      case "north":
        return { x: 0, z: 1 };

      case "south":
        return { x: 0, z: -1 };

      case "west":
        return { x: 1, z: 0 };

      case "east":
        return { x: -1, z: 0 };

      default:
        return null;
    }
  }

  getYawForDirection(direction) {
    return Math.atan2(direction.x, direction.z);
  }
}
