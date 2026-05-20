import * as THREE from "three";

export function setupInput(renderer, camera, floor, onClick) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  renderer.domElement.addEventListener("pointerdown", (event) => {
    const bounds = renderer.domElement.getBoundingClientRect();

    pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObject(floor);

    if (hits.length > 0) {
      onClick(hits[0].point);
    }
  });
}

export function setupInventoryInput(onUseSlot) {
  window.addEventListener("keydown", (event) => {
    if (event.repeat) return;

    const slotIndex = Number(event.key) - 1;
    if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex > 8) return;

    onUseSlot(slotIndex);
  });
}
