import * as THREE from "three";

export class Environment {
  constructor(scene) {
    this.scene = scene; // GameScene instance
  }

  setup() {
    // Hemisphere provides a sky/ground lighting balance
    const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    this.scene.scene.add(hemi);

    // Directional sun light (primary lighting with shadows)
    const sun = new THREE.DirectionalLight(0xffffff, 1.1);
    sun.position.set(8, 14, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 50;
    sun.shadow.camera.left = -20;
    sun.shadow.camera.right = 20;
    sun.shadow.camera.top = 20;
    sun.shadow.camera.bottom = -20;
    sun.shadow.bias = -0.0001;
    this.scene.scene.add(sun);

    // Soft ambient for fill (low intensity to avoid flatness)
    const ambient = new THREE.AmbientLight(0xffffff, 0.25);
    this.scene.scene.add(ambient);
  }

  dispose() {
    // optional cleanup hook
  }
}
