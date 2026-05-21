import * as THREE from "three";

export const VFX_DEFAULTS = {
  purpleGasCloud: {
    color: 0x9c61ff,
    duration: 1.25,
    radius: 1.2,
    puffCount: 9,
    floorOpacity: 0.22,
    puffOpacity: 0.34,
    rise: 0.42,
  },
};

export class VFX {
  constructor({ root = null } = {}) {
    this.root = root;
    this.effects = [];
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

  update(delta, camera) {
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

  clear() {
    for (const effect of this.effects) {
      this.disposeEffect(effect);
    }

    this.effects = [];
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

  disposeEffect(effect) {
    effect.group.removeFromParent();

    for (const particle of effect.particles) {
      particle.mesh.geometry.dispose();
      particle.material.dispose();
    }
  }
}
