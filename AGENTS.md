# AGENTS.md

## Project: 3D Roguelike (Three.js)

### Goal
Build a simple top-down 3D roguelike with:
- Click-to-move player movement
- FSM-based player logic
- Enemy AI with patrol, combat, and drops
- Modular handcrafted rooms assembled into floors
- Chests, coins, items, consumables, shop, and boss progression
- Single-player browser prototype

---

## Core Architecture

- `Scene.js` is orchestration only: world setup, rendering, manager wiring, and event routing.
- Do not put game rules, item logic, enemy decisions, or room data directly in `Scene.js`.
- Player logic lives in `Core/Player.js`.
- Enemy logic lives in `World/EnemyAI.js`.
- Enemy difficulty/type definitions live in `Data/easyEnemies.js`, `Data/mediumEnemies.js`, `Data/hardEnemies.js`, and `Data/enemyDefinitions.js`.
- Chest logic lives in `World/Chest.js`.
- Coin type definitions, denomination values, physical rendering, landing, pickup, and collection behavior live in `World/Coin.js`.
- Enemy coin reward total value ranges live in `World/EnemyAI.js`, currently `ENEMY_COIN_DROP`.
- Chest coin reward total value ranges live in `World/Chest.js`, currently `CHEST_COIN_DROP`.
- Item definitions live in `Data/itemDefinitions.js`.
- Inventory state lives in `Core/Inventory.js`.
- Item effect logic lives in `Core/ItemEffects.js`.
- Ground item drop visuals and pickup wiring live in `World/ItemDrop.js`.
- Game state and level progression live in `Game/GameManager.js`.
- HUD, logs, audio, and visual feedback live in UI helpers or Scene event handling.
- Prefer event-driven communication between gameplay systems.

---

## Model and Asset Rules

- Gameplay model definitions live in `Data/modelDefinitions.js`.
- Environment/tile asset definitions live in `Data/tileSetDefinitions.js`.
- Enemy model texture mapping lives in `Data/modelDefinitions.js`; hog/crab use `animalsColormap`, while skeleton/zombie/vampire use `enemiesColormap`.
- Do not hardcode `.glb` asset paths in `Scene.js`.
- Use semantic model ids such as:
  - `player_human_01`
  - `enemy_orc_01`
  - `chest_01`
  - `coin_01`
- Scene may preload and clone models from definitions.
- Other systems should request model clones through Scene or a model helper, not load GLBs directly.
- Room spawns may specify `modelId` when a non-default model is needed.

---

## Level and Room Architecture

- Levels/floors are assembled from multiple reusable room instances placed together in world space.
- Enter rooms, combat rooms, treasure rooms, and exit rooms are **not** separate levels.
- Room-to-room movement happens through connected walkable geometry, not `nextLevel` loading.
- Room/layout data must live in data files.
- Three.js mesh placement must live in builder classes.
- `LevelBuilder` decides how room instances become one combined floor.
- Room type collections live in data files:
  - `enterRooms.js`
  - `combatRooms.js`
  - `treasureRooms.js`
  - `exitRooms.js`
- `Data/roomTemplates.js` is the room template registry.
- Seeded procedural room decoration is configured from level data and built by `World/DecorationBuilder.js` using rules from `World/PropPlacementRules.js`.
- Manual room-composition smoke tests live in `Game/RoomTester.js`; use it to assemble specific rooms for visual/playable testing without changing `LevelBuilder`.

---

## Room Authoring Rules

New rooms must be reusable room templates and must declare:

- `id`
- `type`
- `dimensions`
- `openings`
- `walkableAreas`
- `floor/wall modules`
- `enemySpawns`
- `chestSpawns`
- optional `obstacles`
- optional `setDressingModules` only for fixed authored room markers such as exit banners
- optional `decorZones` for semantic decoration guidance only
- optional `modelId` on enemy/chest spawns

Rules:
- New rooms must not be authored directly inside `Scene.js`.
- Do not put decorative props directly in room templates; room scripts should not define `decorativeModules`.
- Each new room should be testable in a simple floor composition with the matching enter/exit room orientation, such as `enter_room_north_south_01` and `exit_room_north_south_01`.
- Prefer readable handcrafted layouts over dense geometry.
- Openings must align cleanly with shared connectors.
- Avoid duplicated room borders on connected sides.

---

## Decoration Rules

- Decoration placement must stay out of `Scene.js`; use `DecorationBuilder`, `PropPlacementRules`, room templates, and level data.
- Decorative props are generated from seeded level decoration config, not hand-placed in room scripts.
- Do not add `decorativeModules` to room templates for props such as `floorDetail`, `stones`, barrels, banners, rubble, or set dressing.
- Exit room banners are a special authored marker: place them in `setDressingModules`, not in procedural decoration or `decorativeModules`.
- Use `obstacleModules` only for intentional gameplay blockers or collision obstacles, not for ordinary decoration.
- Use `decorZones` only as semantic hints for procedural placement; they should not contain concrete props.
- Seeded decoration must remain deterministic for a given run seed.
- `floorDetail` and `stones` are scatter-style decorations placed from walkable floor using density, random rotation, and scale variation.
- `floorDetail` and `stones` should be available to enter, combat, exit, treasure, and future room types unless a level config explicitly narrows them.
- Generated barrels should be enabled by room type from level config, commonly combat and treasure, and should stay out of enter/exit unless explicitly requested.
- Barrel clusters should use semantic spots such as corners, door-adjacent areas, and chest-adjacent areas, with spacing between group spots.
- Generated decoration must avoid openings, connectors, player spawn, enemy spawn, chest spawn, stairs, and critical navigation paths.
- Visual scale/placement footprint/collision footprint may differ when needed, but navigation validation should use the gameplay collision footprint.

---

## Room Connection Rules

- Shared room borders are detected in `LevelBuilder` by matching opposite openings in world space.
- Connected borders must be handled once.
- Do not render duplicated wall or doorway modules from both connected rooms.
- Room templates declare openings; `LevelBuilder` decides whether an opening becomes:
  - a standalone doorway
  - a shared connector
  - a closed wall
- Connectors are not standalone levels.
- Connector styles should live in builder-owned data.
- Connector collision must allow click-to-move pathfinding to pass cleanly.

---

## Gameplay Rules

- Player movement is click-to-move.
- Click-to-move must use navigation/pathfinding around collision walls.
- Player cannot move during combat unless a specific item/effect allows disengage.
- Enemy proximity can initiate combat.
- Combat uses cooldown timers, not input spam.
- Only FSM/state systems should control state transitions.
- Damage and drops must be event-driven.
- Never trigger attacks directly from input.

---

## Enemy Rules

- Enemy movement must use the same walkable/collision navigation rules as the player.
- EnemyAI owns patrol and behavior decisions.
- `EnemyAI.js` should keep shared enemy behavior only: patrol, states, combat flow, drops, damage, stun, and event emission.
- Enemy-specific stats such as HP, damage, speed, attack range/cooldown, collision radius, model id, and difficulty must come from enemy definition data files, not from room templates or `EnemyAI` defaults.
- Combat room `enemySpawns` define position and patrol intent; `LevelBuilder` resolves the actual enemy type from `level.enemyDifficulty` using seeded deterministic selection.
- Enemy difficulty groups are easy, medium, and hard. Current pools are easy: hogs/crabs; medium: skeletons/zombies; hard: orcs/vampires.
- Scene may inject navigation callbacks such as:
  - `canMoveBetween`
  - `findPath`
  - random walkable point helpers
- Scene must not contain enemy decision logic.
- Enemy patrol should choose reachable walkable targets, move for a short duration, pause, then choose again.
- Current patrol-only enemies must keep patrol targets and patrol paths inside the room where they spawn.
- Future chase enemies may leave their spawn room while chasing the player, but that behavior must be explicit and must not loosen patrol confinement.
- During player combat, non-active enemies may be paused by GameManager.
- The active combat enemy must not be paused by the combat movement lock.

---

## Item Rules

- Items are data-driven through `Data/itemDefinitions.js`.
- Do not create one script per item.
- Passive items modify player stats through `Core/ItemEffects.js`.
- Consumables are stored and limited by `Core/Inventory.js`.
- Item pickup/use must emit events such as:
  - `itemPickedUp`
  - `passiveItemApplied`
  - `itemUsed`
  - `itemUseFailed`
  - `itemPickupBlocked`
- Scene only routes item events, updates HUD, plays feedback, and wires managers.
- Consumable HUD icons should appear after discovery and remain visible even at count 0.
- Item HUD order and use slots should be data-driven from item definitions.
- Food-themed item examples:
  - steak: damage up
  - chili: attack speed up
  - ramen: max HP up
  - energy drink: heal consumable
  - purple mushroom: stun/disengage consumable

---

## Chest, Coin, and Drop Rules

- Chests may drop physical coins, items, or consumables.
- Chests must not grant instant gold directly; chest gold comes from physical coin drops collected by the player.
- Chest rewards should be controlled by `World/Chest.js` or reward config, not hardcoded in room templates.
- Room templates place chests; they should not define default reward values unless using explicit overrides.
- Enemy loot decisions live in `EnemyAI.js` and must be emitted as events.
- Scene renders dropped loot and handles pickup wiring only.
- Enemy coin drop parameters live in `World/EnemyAI.js` -> `ENEMY_COIN_DROP`.
- Chest coin drop parameters live in `World/Chest.js` -> `CHEST_COIN_DROP`.
- Coin type definitions and denomination values live in `World/Coin.js` -> `COIN_TYPES`.
- Enemy/chest coin drops should roll a configurable total gold value, then convert that total into the fewest useful coin denominations.
- `World/Coin.js` must not own enemy/chest coin reward total ranges or reward source tables.
- Coin and item drops should:
  - launch from source
  - avoid walls
  - land on walkable ground
  - become collectible after landing
  - remain on the ground if pickup is blocked
- Coin outlines/visibility helpers must not use global postprocessing or alter scene lighting.

---

## Level Design Rules

- Avoid overlapping floor planes to prevent Z-fighting.
- Use separate walkable areas and collision walls.
- Chests should be distributed naturally in rooms.
- Enemy spawns and chest spawns should feel intentional, not clustered randomly.
- Wall module rotation must follow room side:
  - north/south use one Y rotation
  - east/west use the perpendicular Y rotation
- Corner wall modules must be explicitly oriented.
- Visual obstacle size and collision size may differ when needed for navigation.
- Enter rooms use stairs as entry set dressing with collision; exit rooms use visible non-blocking stairs for future level transition triggers.

---

## Reset Rules

When the player dies:
- reset player position
- reset enemy state
- reset chests
- reset drops
- reset UI/HUD/log
- reset the current level/floor

---

## Text and UI Rules

- All player-facing game text must be in English:
  - HUD labels
  - item names
  - logs
  - aria labels
  - hints
  - level names shown on screen
- Spanish is allowed for programmer-facing comments, notes, and documentation.
- HUD stat numbers must come from player/game state, not static placeholder HTML.

---

## Debug and Verification

- Use console logs for gameplay events during development.
- Do not remove useful debug logs during active debugging.
- Local browser test URL:
  - `http://127.0.0.1:5500/index.html`
- A smoke check should:
  - reload the page
  - confirm the title is `Roguelike`
  - confirm there are no browser errors or warnings
