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
    // Cluster coloca grupos compactos en spots semanticos calculados por sala.
    placement: "cluster",
    role: "barrelFill",
    spotStrategy: "semantic",
    // Tipos de spot automatico: esquinas de areas caminables, laterales de puertas y zonas junto a cofres.
    spotTypes: ["corner", "door", "chest"],
    // Distancia minima entre grupos elegidos dentro de la misma room.
    spotMinDistance: 5,
    // Separacion desde el borde de cada walkableArea para calcular spots de esquina.
    spotInset: 1.4,
    // Distancia hacia dentro y hacia el lado para spots cerca de puertas.
    doorSpotDepth: 2.2,
    doorSpotSideOffset: 2,
    // Distancia desde cada cofre para proponer spots cercanos sin ocuparlo.
    chestSpotOffset: 1.8,
    allowUnzoned: false,
    collision: true,
    occupiesTile: true,
    // Numero de grupos por room compatible.
    clustersPerRoom: { min: 1, max: 1 },
    // Cantidad de barriles por grupo.
    clusterSize: { min: 2, max: 4 },
    // Radio maximo alrededor del punto elegido para agrupar barriles.
    clusterRadius: 1.35,
    // Radio real de dispersion continua dentro del grupo; menor valor junta mas los props.
    clusterScatterRadius: 0.45,
    // Huella usada solo para separar colocaciones; no cambia tamano visual ni colision.
    placementFootprint: { w: 0.55, d: 0.55 },
    // Huella usada para validar navegacion; debe parecerse a la colision real del barril.
    collisionFootprint: { w: 0.1, d: 0.1 },
    // Offset extra para scatter; los clusters usan clusterScatterRadius para separacion visual.
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
