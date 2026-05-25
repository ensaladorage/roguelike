export const DECORATION_FILL_ROTATIONS = [
  0,
  Math.PI / 2,
  Math.PI,
  -Math.PI / 2,
];

// Defaults globales. Cada nivel puede sobrescribirlos desde decorationFill.modules.
export const PROP_PLACEMENT_RULES = {
  floorDetail: {
    // Scatter rellena tiles individuales por probabilidad.
    placement: "scatter",
    role: "floorDetailFill",
    // Porcentaje aproximado de tiles caminables que reciben floorDetail.
    density: 0.3,
    // null permite usar todas las walkableAreas en vez de decorZones.
    zoneTypes: null,
    allowUnzoned: true,
    collision: false,
    occupiesTile: false,
  },
  stones: {
    placement: "scatter",
    role: "stonesFill",
    density: 0.012,
    // Solo aparece en decorZones marcadas como rubble/stones.
    zoneTypes: ["rubble", "stones"],
    allowUnzoned: false,
    collision: false,
    occupiesTile: true,
    // Escala visual aleatoria determinista; no modifica el asset original.
    scaleVariation: { min: 0.92, max: 1.08 },
  },
  barrel: {
    // Cluster coloca grupos compactos en zonas de almacenaje/pared/esquina.
    placement: "cluster",
    role: "barrelFill",
    zoneTypes: ["storage", "corner", "wall", "barrelStorage"],
    allowUnzoned: false,
    collision: true,
    occupiesTile: true,
    // Numero de grupos por room compatible.
    clustersPerRoom: { min: 1, max: 1 },
    // Cantidad de barriles por grupo.
    clusterSize: { min: 2, max: 4 },
    // Radio maximo alrededor del punto elegido para agrupar barriles.
    clusterRadius: 1.35,
    // Huella usada solo para separar colocaciones; no cambia tamano visual ni colision.
    placementFootprint: { w: 0.55, d: 0.55 },
    // Desplazamiento maximo dentro del tile para que el grupo no parezca una cuadricula.
    positionJitter: 0.28,
    scaleVariation: { min: 0.94, max: 1.06 },
  },
};

export function getPropPlacementRule(moduleId) {
  return PROP_PLACEMENT_RULES[moduleId] ?? {
    placement: "scatter",
    role: `${moduleId}Fill`,
    density: 0,
    zoneTypes: null,
    allowUnzoned: true,
    collision: false,
    occupiesTile: true,
  };
}
