export const MODEL_CATEGORIES = {
  PLAYER: "players",
  ENEMY: "enemies",
  NPC: "npcs",
  INTERACTABLE: "interactables",
  COLLECTIBLE: "collectibles",
};

export const DEFAULT_PLAYER_MODEL_ID = "player_human_01";
export const DEFAULT_ENEMY_MODEL_ID = "enemy_orc_01";
export const DEFAULT_CHEST_MODEL_ID = "chest_01";
export const DEFAULT_COIN_MODEL_ID = "coin_01";

export const MODEL_TEXTURE_DEFINITIONS = {
  colormap: {
    id: "colormap",
    primaryPath: "Assets/Models/Textures/colormap.png",
    fallbackPath: "Assets/Textures/colormap.png",
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
      textureId: "colormap",
      scale: 1,
    },
  },
  [MODEL_CATEGORIES.ENEMY]: {
    [DEFAULT_ENEMY_MODEL_ID]: {
      id: DEFAULT_ENEMY_MODEL_ID,
      category: MODEL_CATEGORIES.ENEMY,
      assetPath: "Assets/Models/character-orc.glb",
      textureId: "colormap",
      scale: 1,
    },
  },
  [MODEL_CATEGORIES.NPC]: {},
  [MODEL_CATEGORIES.INTERACTABLE]: {
    [DEFAULT_CHEST_MODEL_ID]: {
      id: DEFAULT_CHEST_MODEL_ID,
      category: MODEL_CATEGORIES.INTERACTABLE,
      assetPath: "Assets/Models/chest.glb",
      textureId: "colormap",
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
