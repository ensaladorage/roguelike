export const TILE_SIZE = 1;

export const TILESET_DEFINITIONS = {
  scenarioDefault: {
    id: "scenarioDefault",
    tileSize: TILE_SIZE,
    modules: {
      floor: {
        id: "floor",
        placementMode: "grid",
        assetPath: "Assets/Models/Scenario/floor.glb",
        preserveOriginalScale: true,
        footprint: { w: 1, d: 1, height: 0 },
        fallback: {
          kind: "floor",
          color: 0x303735,
        },
        positionY: 0,
      },
      floorDetail: {
        id: "floorDetail",
        placementMode: "grid",
        assetPath: "Assets/Models/Scenario/floor-detail.glb",
        preserveOriginalScale: true,
        footprint: { w: 1, d: 1, height: 0.05 },
        fallback: {
          kind: "floor",
          color: 0x3b4140,
        },
        positionY: 0.012,
      },
      wallNarrow: {
        id: "wallNarrow",
        placementMode: "linear",
        assetPath: "Assets/Models/Scenario/wall-narrow.glb",
        preserveOriginalScale: true,
        footprint: { length: 1, thickness: 1, height: 1 },
        fallback: {
          kind: "wall",
          color: 0x15191c,
        },
      },
      wallCorner: {
        id: "wallCorner",
        placementMode: "single",
        assetPath: "Assets/Models/Scenario/wall.glb",
        preserveOriginalScale: true,
        footprint: { w: 1, d: 1, height: 1.1 },
        fallback: {
          kind: "wall",
          color: 0x15191c,
        },
      },
      wallHalf: {
        id: "wallHalf",
        placementMode: "linear",
        assetPath: "Assets/Models/Scenario/wall-half.glb",
        preserveOriginalScale: true,
        footprint: { length: 1, thickness: 1, height: 1 },
        fallback: {
          kind: "wall",
          color: 0x202326,
        },
      },
      wallOpening: {
        id: "wallOpening",
        placementMode: "single",
        assetPath: "Assets/Models/Scenario/wall-opening.glb",
        preserveOriginalScale: true,
        footprint: { w: 1, d: 1, height: 1 },
        fallback: {
          kind: "doorway",
          color: 0x20262a,
          accent: 0x464b53,
        },
      },
      dirt: {
        id: "dirt",
        placementMode: "grid",
        assetPath: "Assets/Models/Scenario/dirt.glb",
        preserveOriginalScale: true,
        footprint: { w: 1, d: 1, height: 0.9 },
        fallback: {
          kind: "decor",
          color: 0x3a2d22,
        },
      },
      stones: {
        id: "stones",
        placementMode: "single",
        assetPath: "Assets/Models/Scenario/stones.glb",
        preserveOriginalScale: true,
        footprint: { w: 1, d: 1, height: 0.45 },
        fallback: {
          kind: "decor",
          color: 0x5a5f5c,
        },
      },
      rocks: {
        id: "rocks",
        placementMode: "single",
        assetPath: "Assets/Models/Scenario/rocks.glb",
        preserveOriginalScale: true,
        footprint: { w: 1, d: 1, height: 0.5 },
        fallback: {
          kind: "obstacle",
          color: 0x4f5550,
        },
      },
      gate: {
        id: "gate",
        placementMode: "single",
        assetPath: "Assets/Models/Scenario/gate.glb",
        preserveOriginalScale: true,
        footprint: { w: 1, d: 1, height: 0.75 },
        fallback: {
          kind: "decor",
          color: 0x343a3d,
        },
      },
      banner: {
        id: "banner",
        placementMode: "single",
        assetPath: "Assets/Models/Scenario/banner.glb",
        preserveOriginalScale: true,
        footprint: { w: 1, d: 1, height: 0.66 },
        fallback: {
          kind: "decor",
          color: 0x8a2531,
        },
      },
      barrel: {
        id: "barrel",
        placementMode: "single",
        assetPath: "Assets/Models/Scenario/barrel.glb",
        preserveOriginalScale: true,
        footprint: { w: 1, d: 1, height: 0.9 },
        fallback: {
          kind: "obstacle",
          color: 0x6b4f3c,
        },
      },
      woodSupport: {
        id: "woodSupport",
        placementMode: "single",
        assetPath: "Assets/Models/Scenario/wood-support.glb",
        preserveOriginalScale: true,
        footprint: { w: 1, d: 1, height: 1 },
        fallback: {
          kind: "decor",
          color: 0xb56f42,
        },
      },
    },
  },
};

export function getTileSetDefinition(tileSetId) {
  return TILESET_DEFINITIONS[tileSetId] ?? TILESET_DEFINITIONS.scenarioDefault;
}
