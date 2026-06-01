# AGENTS.md

## Project

Browser-based top-down 3D roguelike built with Three.js.

Core goals:

* Click-to-move movement with pathfinding around collision.
* FSM-driven player and enemy behavior.
* Modular handcrafted rooms assembled into complete floors.
* Seeded procedural run mode plus separate tester mode.
* Event-driven combat, drops, inventory, HUD feedback, and progression.

## Architecture Boundaries

`Scene.js` is orchestration only: world setup, rendering, manager wiring, camera, input, events, navigation callbacks, model cloning, HUD routing, SFX/VFX routing, and feedback.

Do not put game rules, enemy decisions, item logic, drop logic, room data, or procedural generation directly in `Scene.js`.

Primary ownership:

* `Core/Player.js`: player FSM, combat state, movement rules.
* `World/EnemyAI.js`: enemy patrol, combat, stun, drops, death, events.
* `Game/GameManager.js`: game state, run state, progression, reset flow.
* `Core/Inventory.js`: inventory and consumable counts.
* `Core/ItemEffects.js`: passive and consumable effects.
* `Game/Chest.js`: chest rewards and chest config.
* `Game/Coin.js`: coin types, values, and coin conversion.
* `World/ItemDrop.js`: ground item visuals and pickup wiring.
* `World/LevelBuilder.js`: room assembly, walls, connectors, collision.
* `Game/ProceduralLevelFactory.js`: seeded procedural floor creation.
* `Game/RoomTester.js`: manual room/floor debugging.
* UI helpers: HUD, logs, SFX, VFX, outlines, and player feedback.

Prefer event-driven communication between gameplay systems.

## Modes and Progression

The game has two modes:

* `tester`: explicit room/floor compositions for debugging.
* `run`: seeded procedural floors and real run progression.

Tester mode is not the progression flow.

Run mode should use a `RunState` owned by `GameManager` with mode, run seed, floor index, floor seed, floor type, difficulty tier, and active/won/lost state.

Normal progression target is 10 procedural combat/treasure floors, then shop, then boss. Shop and boss are future features; do not implement them unless explicitly requested.

## Models and Assets

Gameplay models live in `CharacterData/modelDefinitions.js`; environment and tile assets live in `RoomData/tileSetDefinitions.js`.

Rules:

* Use semantic model ids such as `player_human_01`, `enemy_orc_01`, `chest_01`, and `coin_01`.
* Do not hardcode `.glb` paths in `Scene.js`.
* Tile definitions that need non-default colormaps should declare `assetTexturePath`.
* Scene may preload and clone model definitions; other systems should request clones through Scene or a model helper.
* Room spawns may specify `modelId` for non-default enemy or chest visuals.

## Rooms and Floors

Floors are assembled from reusable room instances in one connected world space. Enter, combat, treasure, and exit rooms are room types, not separate levels.

Room/layout data must live in data files; Three.js placement belongs in builders. `LevelBuilder` decides how room instances become a combined floor.

Room collections and helpers:

* `RoomData/enterRooms.js`
* `RoomData/combatRooms.js`
* `RoomData/treasureRooms.js`
* `RoomData/exitRooms.js`
* `RoomData/roomTemplates.js`
* `RoomData/roomTagFilters.js`

New room templates must declare `id`, `type`, `tags`, `dimensions`, `openings`, `walkableAreas`, floor/wall modules, `enemySpawns`, and `chestSpawns`. Optional fields include `obstacles`, `setDressingModules`, `decorZones`, and spawn-level `modelId`.

Room authoring rules:

* Do not author rooms in `Scene.js`.
* Use readable handcrafted layouts over dense geometry.
* Use `tags` for procedural selection intent.
* Use `setDressingModules` only for fixed authored markers such as stairs or exit banners.
* Use `decorZones` as semantic decoration hints, not concrete prop placement.
* Openings must align cleanly, and connected sides must avoid duplicated borders.
* Each new room should be testable with matching enter/exit orientation through `RoomTester`.

## Connectors and Decoration

`LevelBuilder` detects shared borders by matching opposite openings in world space. It decides whether each opening becomes a standalone doorway, shared connector, or closed wall.

Connector rules:

* Connected borders are handled once.
* Connector collision must allow click-to-move pathfinding.
* Connector styles live in builder-owned data.
* Connector set dressing may come from connector style params; point lights belong to `UI/VFX.js`.
* Procedural dead-end rooms must attach only to already placed combat/treasure rooms, never directly to enter or exit rooms, while preserving a main path to the exit.

Decoration rules:

* Decoration stays out of `Scene.js`.
* Decoration is seeded and deterministic.
* `World/DecorationBuilder.js` uses `World/PropPlacementRules.js`.
* Scatter props may appear broadly; barrels should prefer semantic spots such as corners, doors, or chest-adjacent areas.
* Generated decoration must avoid openings, connectors, player/enemy/chest spawns, stairs, and critical navigation paths.
* Visual footprint and collision footprint may differ, but gameplay validation uses collision footprint.

## Gameplay and Enemies

Movement and combat:

* Player movement is click-to-move using navigation/pathfinding.
* Player cannot move during combat unless an item/effect allows disengage.
* Enemy proximity may initiate combat.
* Combat uses cooldown timers, not input spam.
* FSM/state systems own state transitions.
* Damage and drops are event-driven.
* Never trigger attacks directly from input.

Enemy rules:

* Enemy movement uses the same walkable/collision rules as the player.
* Enemy stats come from enemy definition data.
* Room `enemySpawns` define position and patrol intent.
* `LevelBuilder` may resolve enemy type from difficulty through seeded deterministic selection.
* Difficulty groups are `easy`, `medium`, and `hard`.
* Scene may inject navigation callbacks such as `canMoveBetween`, `findPath`, and random walkable point helpers.
* Scene must not contain enemy decision logic.
* Patrol enemies stay inside their spawn room; future chase enemies may leave only if explicitly designed.
* `GameManager` may pause non-active enemies during combat; the active combat enemy must not be paused by the combat movement lock.

## Items, Chests, Coins, and Drops

Items are data-driven through `CharacterData/itemDefinitions.js`, including `ITEM_RARITIES`, HUD order, and use slots. Do not create one script per item.

Item rules:

* Passive items modify player stats through `Core/ItemEffects.js`.
* Consumables are stored and limited by `Core/Inventory.js`.
* Item pickup/use emits events such as `itemPickedUp`, `passiveItemApplied`, `itemUsed`, `itemUseFailed`, and `itemPickupBlocked`.
* Scene only routes item events, updates HUD, and plays feedback.
* Consumable HUD icons appear after discovery and remain visible at count 0.

Reward rules:

* Chest rarity percentages live in `Game/Chest.js` under `CHEST_REWARD.rarityChancePercentByFloor`.
* Enemy potion drop chance is fixed in `World/EnemyAI.js` under `ENEMY_POTION_DROP.chancePercent`; do not scale it with chest rarity progression.
* Chests may drop physical coins, items, or consumables.
* Chests must not grant instant gold directly; gold comes from physical coin pickup.
* Room templates place chests but should not define default reward values unless explicitly overriding.
* Enemy loot decisions live in `EnemyAI.js` and are emitted as events.
* Scene renders dropped loot and handles pickup wiring only.
* Coin definitions and denomination values live in `Game/Coin.js`.
* Enemy/chest coin drops roll configurable total gold, then convert to useful denominations.
* Coin and item drops should launch from source, avoid walls, land on walkable ground, become collectible after landing, and remain on the ground if pickup is blocked.
* Coin outlines/visibility helpers must not use global postprocessing or alter scene lighting.

Food-themed item examples: steak for damage, chili for attack speed, ramen for max HP, energy drink for healing, purple mushroom for stun/disengage.

## Level Design

* Avoid overlapping floor planes and Z-fighting.
* Keep walkable areas and collision walls separate.
* Place chests and enemy spawns intentionally, not clustered randomly.
* Wall module rotation follows side: north/south share one Y rotation, east/west use the perpendicular rotation.
* Corner wall modules must be explicitly oriented.
* Visual obstacle size and collision size may differ when navigation needs it.
* Enter rooms may use colliding entry stairs; exit rooms may use visible non-blocking stairs or markers.

## Reset, Text, and Verification

Do not reload the browser page to reset gameplay. Death or run reset should clear enemies, chests, coins, item drops, VFX, player position/state, inventory/stats as appropriate, HUD/log state, then rebuild the floor or restart the run through `GameManager`.

All player-facing text must be English, including HUD labels, item names, logs, aria labels, hints, and level names. Spanish is allowed for programmer-facing comments, notes, and docs. HUD numbers must come from game/player state, not static placeholder HTML.

Debug and verification:

* Keep useful development console logs during active debugging.
* Local browser test URL: `http://127.0.0.1:5500/index.html`.
* Smoke check: reload the page, confirm title is `Roguelike`, and confirm no browser errors or warnings.
