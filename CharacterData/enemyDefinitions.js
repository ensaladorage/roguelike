import { EASY_ENEMY_DEFINITIONS } from "./easyEnemies.js";
import { MEDIUM_ENEMY_DEFINITIONS } from "./mediumEnemies.js";
import { HARD_ENEMY_DEFINITIONS } from "./hardEnemies.js";

export const ENEMY_DIFFICULTY = {
  EASY: "easy",
  MEDIUM: "medium",
  HARD: "hard",
};

export const ENEMY_DEFINITIONS_BY_DIFFICULTY = {
  [ENEMY_DIFFICULTY.EASY]: EASY_ENEMY_DEFINITIONS,
  [ENEMY_DIFFICULTY.MEDIUM]: MEDIUM_ENEMY_DEFINITIONS,
  [ENEMY_DIFFICULTY.HARD]: HARD_ENEMY_DEFINITIONS,
};

export const ENEMY_DEFINITIONS = [
  ...EASY_ENEMY_DEFINITIONS,
  ...MEDIUM_ENEMY_DEFINITIONS,
  ...HARD_ENEMY_DEFINITIONS,
];

export const ENEMY_DEFINITIONS_BY_ID = Object.fromEntries(
  ENEMY_DEFINITIONS.map((definition) => [definition.id, definition])
);

export function getEnemyDefinition(enemyTypeId) {
  return ENEMY_DEFINITIONS_BY_ID[enemyTypeId] ?? null;
}

export function getEnemyDefinitionsForDifficulty(difficulty = ENEMY_DIFFICULTY.EASY) {
  return (
    ENEMY_DEFINITIONS_BY_DIFFICULTY[difficulty] ??
    ENEMY_DEFINITIONS_BY_DIFFICULTY[ENEMY_DIFFICULTY.EASY]
  );
}

export function pickEnemyDefinitionForDifficulty(difficulty, randomValue = 0) {
  const definitions = getEnemyDefinitionsForDifficulty(difficulty);
  const index = Math.floor(Math.max(0, Math.min(0.999999, randomValue)) * definitions.length);

  return definitions[index] ?? definitions[0] ?? null;
}
