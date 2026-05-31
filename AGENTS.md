# AGENTS.md

## Project: 3D Roguelike (Three.js)

### Goal

Build a browser-based top-down 3D roguelike with:

* Click-to-move player movement
* FSM-based player logic
* Enemy AI with patrol, combat, stun, drops, and death
* Modular handcrafted rooms assembled into floors
* Chests, coins, items, consumables, shop, and boss progression
* Seeded procedural floors for normal runs
* Separate tester mode for room/floor debugging

---

## Core Architecture

* `Scene.js` is orchestration only: world setup, rendering, manager wiring, events, camera, input, and navigation.
* Do not put game rules, item logic, enemy decisions, or room data directly in `Scene.js`.
* Player logic lives in `Core/Player.js`.
* Enemy logic lives in `World/EnemyAI.js`.
* Game state and level progression live in `Game/GameManager.js`.
* Inventory state lives in `Core/Inventory.js`.
* Item effect logic lives in `Core/ItemEffects.js`.
* Chest logic lives in `Game/Chest.js`.
* Coin logic lives in `Game/Coin.js`.
* Ground item drop visuals and pickup wiring live in `World/ItemDrop.js`.
* Level assembly lives in `World/LevelBuilder.js`.
* Procedural floor creation lives in `Game/ProceduralLevelFactory.js`.
* Manual room/floor tests live in `Game/RoomTester.js`.
* HUD, logs, SFX, VFX, and feedback live in UI helpers or Scene event routing.
* Prefer event-driven communication between gameplay systems.

---

## Game Modes and Run State

* The game should support two modes:

  * `tester`: loads explicit room/floor compositions for debugging.
  * `run`: uses procedural floor generation and run progression.
* Tester mode must not be treated as the real progression flow.
* Run mode should use a `RunState` object or class owned by `GameManager`.
* `RunState` should track:

  * mode
  * run seed
  * current floor index
  * current floor seed
  * floor type
  * difficulty tier
  * whether the run is active, won, or lost
* Normal progression target:

  * 10 procedural combat/treasure floors
  * then a shop floor
  * then a boss floor
* Shop and boss are future features; do not implement them unless explicitly requested.

---

## Model and Asset Rules

* Gameplay model definitions live in `Data/modelDefinitions.js`.
* Environment/tile asset definitions live in `RoomData/tileSetDefinitions.js`.
* Tile assets that need a non-default colormap should declare `assetTexturePath` in their tile definition.
* Do not hardcode `.glb` asset paths in `Scene.js`.
* Use semantic model ids such as:

  * `player_human_01`
  * `enemy_orc_01`
  * `chest_01`
  * `coin_01`
* Scene may preload and clone models from model definitions.
* Other systems should request model clones through Scene or a model helper, not load GLBs directly.
* Room spawns may specify `modelId` when a non-default model is needed.

---

## Level and Room Architecture

* Floors are assembled from reusable room instances placed together in world space.
* Enter rooms, combat rooms, treasure rooms, and exit rooms are not separate levels.
* Room-to-room movement happens through connected walkable geometry, not `nextLevel` loading.
* Room/layout data must live in data files.
* Three.js mesh placement must live in builder classes.
* `LevelBuilder` decides how room instances become one combined floor.
* Room type collections live in data files:

  * `enterRooms.js`
  * `combatRooms.js`
  * `treasureRooms.js`
* `exitRooms.js`
* `RoomData/roomTemplates.js` is the room template registry.
* Seeded decoration is built by `World/DecorationBuilder.js` using `World/PropPlacementRules.js`.
* Room-composition smoke tests should use `Game/RoomTester.js`.
* Room tag filtering helpers live in `RoomData/roomTagFilters.js`.

---

## Room Authoring Rules

New rooms must be reusable room templates and must declare:

* `id`
* `type`
* `tags`
* `dimensions`
* `openings`
* `walkableAreas`
* `floor/wall modules`
* `enemySpawns`
* `chestSpawns`
* optional `obstacles`
* optional `setDressingModules`
* optional `decorZones`
* optional `modelId` on enemy/chest spawns

Rules:

* New rooms must not be authored directly inside `Scene.js`.
* Do not put ordinary decorative props directly in room templates.
* Use `setDressingModules` only for fixed authored room markers, such as exit banners or stairs.
* Use `decorZones` as semantic decoration hints, not concrete prop placement.
* Use room `tags` for procedural selection intent, such as size, openness, obstacles, enemy difficulty, reward/chest behavior, and connection orientation.
* Each new room should be testable in a simple floor with a matching enter and exit room orientation.
* Prefer readable handcrafted layouts over dense geometry.
* Openings must align cleanly with shared connectors.
* Avoid duplicated room borders on connected sides.

---

## Room Connection Rules

* Shared room borders are detected in `LevelBuilder` by matching opposite openings in world space.
* Connected borders must be handled once.
* Do not render duplicated wall or doorway modules from both connected rooms.
* Room templates declare openings; `LevelBuilder` decides whether an opening becomes:

  * a standalone doorway
  * a shared connector
  * a closed wall
* Connectors are not standalone levels.
* Connector styles should live in builder-owned data.
* Connector collision must allow click-to-move pathfinding to pass cleanly.
* Connector set dressing such as lanterns should be generated from `LevelBuilder` connector style parameters; their point lights are owned by `UI/VFX.js`.

---

## Decoration Rules

* Decoration placement must stay out of `Scene.js`.
* Decorative props are generated from seeded config, not hand-placed in room scripts.
* Decoration must remain deterministic for a given seed.
* Scatter-style props such as floor detail and stones may appear broadly.
* Barrels should use semantic spots such as corners, door-adjacent areas, and chest-adjacent areas.
* Generated decoration must avoid:

  * openings
  * connectors
  * player spawn
  * enemy spawns
  * chest spawns
  * stairs
  * critical navigation paths
* Visual size, placement footprint, and collision footprint may differ when needed, but gameplay validation should use the collision footprint.

---

## Gameplay Rules

* Player movement is click-to-move.
* Click-to-move must use navigation/pathfinding around collision walls.
* Player cannot move during combat unless a specific item/effect allows disengage.
* Enemy proximity can initiate combat.
* Combat uses cooldown timers, not input spam.
* Only FSM/state systems should control state transitions.
* Damage and drops must be event-driven.
* Never trigger attacks directly from input.

---

## Enemy Rules

* Enemy movement must use the same walkable/collision navigation rules as the player.
* `EnemyAI.js` owns patrol, states, combat flow, drops, damage, stun, and event emission.
* Enemy stats such as HP, damage, speed, attack range, cooldowns, collision radius, model id, and difficulty must come from enemy definition data.
* Room `enemySpawns` define position and patrol intent.
* `LevelBuilder` may resolve enemy type from level difficulty using seeded deterministic selection.
* Enemy difficulty groups are easy, medium, and hard.
* Scene may inject navigation callbacks such as:

  * `canMoveBetween`
  * `findPath`
  * random walkable point helpers
* Scene must not contain enemy decision logic.
* Current patrol enemies must keep patrol targets and patrol paths inside their spawn room.
* Future chase enemies may leave their spawn room only if explicitly designed.
* During player combat, non-active enemies may be paused by `GameManager`.
* The active combat enemy must not be paused by the combat movement lock.

---

## Item Rules

* Items are data-driven through `CharacterData/itemDefinitions.js`.
* Item rarity definitions live in `CharacterData/itemDefinitions.js` -> `ITEM_RARITIES`.
* Do not create one script per item.
* Passive items modify player stats through `Core/ItemEffects.js`.
* Consumables are stored and limited by `Core/Inventory.js`.
* Item pickup/use must emit events such as:

  * `itemPickedUp`
  * `passiveItemApplied`
  * `itemUsed`
  * `itemUseFailed`
  * `itemPickupBlocked`
* Scene only routes item events, updates HUD, plays feedback, and wires managers.
* Consumable HUD icons should appear after discovery and remain visible even at count 0.
* Item HUD order and use slots should be data-driven from item definitions.
* Chest item reward rarity percentages live in `Game/Chest.js` -> `CHEST_REWARD.rarityChancePercentByFloor`.
* Enemy potion drops use a fixed percent in `World/EnemyAI.js` -> `ENEMY_POTION_DROP.chancePercent`; do not scale enemy potion chance with chest rarity progression.
* Food-themed item examples:

  * steak: damage up
  * chili: attack speed up
  * ramen: max HP up
  * energy drink: heal consumable
  * purple mushroom: stun/disengage consumable

---

## Chest, Coin, and Drop Rules

* Chests may drop physical coins, items, or consumables.
* Chests must not grant instant gold directly; chest gold comes from physical coin drops collected by the player.
* Chest rewards should be controlled by `Game/Chest.js` or reward config, not hardcoded in room templates.
* Room templates place chests; they should not define default reward values unless using explicit overrides.
* Enemy loot decisions live in `EnemyAI.js` and must be emitted as events.
* Scene renders dropped loot and handles pickup wiring only.
* Coin type definitions and denomination values live in `Game/Coin.js`.
* Enemy/chest coin drops should roll a configurable total gold value, then convert it into useful coin denominations.
* Coin and item drops should:

  * launch from source
  * avoid walls
  * land on walkable ground
  * become collectible after landing
  * remain on the ground if pickup is blocked
* Coin outlines/visibility helpers must not use global postprocessing or alter scene lighting.

---

## Level Design Rules

* Avoid overlapping floor planes to prevent Z-fighting.
* Use separate walkable areas and collision walls.
* Chests should be distributed naturally in rooms.
* Enemy spawns and chest spawns should feel intentional, not clustered randomly.
* Wall module rotation must follow room side:

  * north/south use one Y rotation
  * east/west use the perpendicular Y rotation
* Corner wall modules must be explicitly oriented.
* Visual obstacle size and collision size may differ when needed for navigation.
* Enter rooms may use stairs as entry set dressing with collision.
* Exit rooms may use visible non-blocking stairs or exit markers for future floor transitions.

---

## Reset Rules

Do not reload the browser page to reset gameplay.

When the player dies or a run resets:

* clear current enemies
* clear chests
* clear coins
* clear item drops
* clear visual effects
* reset player position
* reset player state
* reset inventory/stats according to run rules
* reset HUD/log
* rebuild the current floor or restart the run through `GameManager`

---

## Text and UI Rules

* All player-facing game text must be in English:

  * HUD labels
  * item names
  * logs
  * aria labels
  * hints
  * level names shown on screen
* Spanish is allowed for programmer-facing comments, notes, and documentation.
* HUD stat numbers must come from player/game state, not static placeholder HTML.

---

## Debug and Verification

* Use console logs for gameplay events during development.
* Do not remove useful debug logs during active debugging.
* Local browser test URL:

  * `http://127.0.0.1:5500/index.html`
* A smoke check should:

  * reload the page
  * confirm the title is `Roguelike`
  * confirm there are no browser errors or warnings
