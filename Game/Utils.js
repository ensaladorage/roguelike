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

export function createSeededRandom(seed) {
  let state = hashString(seed);

  return () => {
    state = Math.imul(1664525, state) + 1013904223;
    return (state >>> 0) / 4294967296;
  };
}

export function hashString(value) {
  let hash = 2166136261;
  const text = String(value);

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}
