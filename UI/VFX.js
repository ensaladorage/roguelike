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

  update(delta, camera) {
    this.updatePersistentEffects(delta);

    this.effects = this.effects.filter((effect) => {
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

  updatePersistentEffects(delta) {
    for (const effect of this.persistentEffects) {
      switch (effect.type) {
        case "entryStairsBlocker":
          this.updateEntryStairsBlocker(effect, delta);
          break;
      }
    }
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
      this.disposeEffect(effect);
    }

    this.effects = [];

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
