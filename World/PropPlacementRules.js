export const DECORATION_FILL_ROTATIONS = [
  0,
  Math.PI / 2,
  Math.PI,
  -Math.PI / 2,
];

export const PROP_PLACEMENT_RULES = {
  floorDetail: {
    placement: "scatter",
    role: "floorDetailFill",
    density: 0.3,
    zoneTypes: null,
    allowUnzoned: true,
    collision: false,
    occupiesTile: false,
  },
  stones: {
    placement: "scatter",
    role: "stonesFill",
    density: 0.012,
    zoneTypes: ["rubble", "cover", "rockCover"],
    allowUnzoned: false,
    collision: false,
    occupiesTile: true,
    scaleVariation: { min: 0.92, max: 1.08 },
  },
  barrel: {
    placement: "cluster",
    role: "barrelFill",
    zoneTypes: ["storage", "corner", "wall", "barrelStorage"],
    allowUnzoned: false,
    collision: true,
    occupiesTile: true,
    clustersPerRoom: { min: 1, max: 1 },
    clusterSize: { min: 2, max: 4 },
    clusterRadius: 1.35,
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
