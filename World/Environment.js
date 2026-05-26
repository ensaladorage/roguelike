import * as THREE from "three";

export class Environment {
  constructor(scene) {
    this.scene = scene;
    this.sun = null;
    this.sunTarget = null;
  }

  setup() {
    const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    this.scene.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffffff, 1.1);
    sun.position.set(8, 32, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 90;
    sun.shadow.camera.left = -28;
    sun.shadow.camera.right = 28;
    sun.shadow.camera.top = 28;
    sun.shadow.camera.bottom = -28;
    sun.shadow.bias = -0.0001;
    this.sun = sun;

    this.sunTarget = new THREE.Object3D();
    this.scene.scene.add(this.sunTarget);
    sun.target = this.sunTarget;
    this.scene.scene.add(sun);

    const ambient = new THREE.AmbientLight(0xffffff, 0.25);
    this.scene.scene.add(ambient);
  }

  updateForLevel(bounds) {
    if (!this.sun || !this.sunTarget || !bounds) return;

    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerZ = (bounds.minZ + bounds.maxZ) / 2;
    const spanX = bounds.maxX - bounds.minX;
    const spanZ = bounds.maxZ - bounds.minZ;
    const shadowSize = Math.max(32, Math.max(spanX, spanZ) + 16);
    const halfShadowSize = shadowSize / 2;

    this.sunTarget.position.set(centerX, 0, centerZ);
    this.sun.position.set(centerX + 12, 36, centerZ + 14);

    const shadowCamera = this.sun.shadow.camera;
    shadowCamera.left = -halfShadowSize;
    shadowCamera.right = halfShadowSize;
    shadowCamera.top = halfShadowSize;
    shadowCamera.bottom = -halfShadowSize;
    shadowCamera.far = Math.max(90, shadowSize + 70);
    shadowCamera.updateProjectionMatrix();
    this.sun.target.updateMatrixWorld();
  }
}
