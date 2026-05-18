export function clampPosition(point, size, margin = 0.75) {
  return {
    x: Math.max(-size / 2 + margin, Math.min(size / 2 - margin, point.x)),
    z: Math.max(-size / 2 + margin, Math.min(size / 2 - margin, point.z)),
  };
}

export function flatDistance(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}