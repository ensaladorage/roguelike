export const MODEL_CATEGORIES = {
  PLAYER: "players",
  ENEMY: "enemies",
  NPC: "npcs",
  INTERACTABLE: "interactables",
  COLLECTIBLE: "collectibles",
};

export const DEFAULT_PLAYER_MODEL_ID = "player_human_01";
export const DEFAULT_ENEMY_MODEL_ID = "enemy_hog_01";
export const DEFAULT_CHEST_MODEL_ID = "chest_01";
export const DEFAULT_COIN_MODEL_ID = "coin_01";

export const MODEL_TEXTURE_DEFINITIONS = {
  charactersColormap: {
    id: "charactersColormap",
    primaryPath: "Assets/Models/Textures/characters-colormap.png",
    fallbackPath: "Assets/Textures/characters-colormap.png",
  },
  animalsColormap: {
    id: "animalsColormap",
    primaryPath: "Assets/Models/Textures/animals-colormap.png",
    fallbackPath: "Assets/Textures/animals-colormap.png",
  },
  enemiesColormap: {
    id: "enemiesColormap",
    primaryPath: "Assets/Models/Textures/enemies-colormap.png",
    fallbackPath: "Assets/Textures/enemies-colormap.png",
  },
  variationA: {
    id: "variationA",
    primaryPath: "Assets/Models/Textures/variation-a.png",
    fallbackPath: "Assets/Textures/variation-a.png",
  },
};

export const MODEL_DEFINITIONS = {
  [MODEL_CATEGORIES.PLAYER]: {
    [DEFAULT_PLAYER_MODEL_ID]: {
      id: DEFAULT_PLAYER_MODEL_ID,
      category: MODEL_CATEGORIES.PLAYER,
      assetPath: "Assets/Models/character-human.glb",
      textureId: "charactersColormap",
      scale: 1,
    },
  },
  [MODEL_CATEGORIES.ENEMY]: {
    [DEFAULT_ENEMY_MODEL_ID]: {
      id: DEFAULT_ENEMY_MODEL_ID,
      category: MODEL_CATEGORIES.ENEMY,
      assetPath: "Assets/Models/animal-hog.glb",
      textureId: "animalsColormap",
      scale: 0.45,
    },
    enemy_crab_01: {
      id: "enemy_crab_01",
      category: MODEL_CATEGORIES.ENEMY,
      assetPath: "Assets/Models/animal-crab.glb",
      textureId: "animalsColormap",
      scale: 0.3,
    },
    enemy_skeleton_01: {
      id: "enemy_skeleton_01",
      category: MODEL_CATEGORIES.ENEMY,
      assetPath: "Assets/Models/character-skeleton.glb",
      textureId: "enemiesColormap",
      scale: 1.05,
    },
    enemy_zombie_01: {
      id: "enemy_zombie_01",
      category: MODEL_CATEGORIES.ENEMY,
      assetPath: "Assets/Models/character-zombie.glb",
      textureId: "enemiesColormap",
      scale: 1.1,
    },
    enemy_orc_01: {
      id: "enemy_orc_01",
      category: MODEL_CATEGORIES.ENEMY,
      assetPath: "Assets/Models/character-orc.glb",
      textureId: "charactersColormap",
      scale: 1.3,
    },
    enemy_vampire_01: {
      id: "enemy_vampire_01",
      category: MODEL_CATEGORIES.ENEMY,
      assetPath: "Assets/Models/character-vampire.glb",
      textureId: "enemiesColormap",
      scale: 1.1,
    },
  },
  [MODEL_CATEGORIES.NPC]: {},
  [MODEL_CATEGORIES.INTERACTABLE]: {
    [DEFAULT_CHEST_MODEL_ID]: {
      id: DEFAULT_CHEST_MODEL_ID,
      category: MODEL_CATEGORIES.INTERACTABLE,
      assetPath: "Assets/Models/chest.glb",
      assetVersion: "blue-uv-01",
      textureId: "charactersColormap",
      openAnimationName: "open",
      openAnimationIndex: 1,
      scale: 1,
    },
  },
  [MODEL_CATEGORIES.COLLECTIBLE]: {
    [DEFAULT_COIN_MODEL_ID]: {
      id: DEFAULT_COIN_MODEL_ID,
      category: MODEL_CATEGORIES.COLLECTIBLE,
      assetPath: "Assets/Models/coin.glb",
      scale: 1,
    },
  },
};

export function getModelDefinition(modelId) {
  for (const categoryDefinitions of Object.values(MODEL_DEFINITIONS)) {
    if (categoryDefinitions[modelId]) return categoryDefinitions[modelId];
  }

  return null;
}

export function getModelDefinitionsToPreload() {
  return Object.values(MODEL_DEFINITIONS).flatMap((categoryDefinitions) =>
    Object.values(categoryDefinitions)
  );
}
