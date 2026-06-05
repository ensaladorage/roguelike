# AGENTS.md

## Project

Browser-based top-down 3D roguelike built with Three.js as a static ES module app.

Entrypoint:

* `main.js`
* `Core/Scene.js`

Three.js is loaded from CDN through the import map in `index.html`. The project currently does not use a bundler.

Core goals:

* Click-to-move movement with pathfinding.
* FSM-driven player and enemy behavior.
* Modular handcrafted rooms assembled into procedural floors.
* Run mode plus tester mode.
* Event-driven combat, loot, inventory, shop, HUD feedback, and progression.

---

## Current State

Default mode is `run`.

Progression:

* Floors 1-10: procedural combat/treasure floors.
* Floor 11: shop floor, implemented.
* Floor 12: boss floor, reserved for future implementation.

Current important systems:

* Procedural floor assembly works.
* Internal reset works.
* Shop placeholder works.
* Loot rarity exists.
* Combat uses click attack intention, windup, cooldown, chase/leash enemies, and item effects.
* Boss is not implemented yet.

---

## Architecture Boundaries

`Scene.js` is orchestration only.

Allowed in `Scene.js`:

* Three.js setup
* camera/render setup
* manager wiring
* input routing
* model loading/cloning
* navigation callbacks
* event routing
* HUD/SFX/VFX routing
* reset orchestration

Do not put core gameplay rules, enemy decisions, item logic, loot logic, room data, procedural generation, shop rules, or progression rules directly in `Scene.js`.

Primary ownership:

* `Core/Player.js`: player FSM, movement, combat, damage, death, gold, snapshots.
* `World/EnemyAI.js`: enemy FSM, patrol, chase, returning, stun, combat, death, drops.
* `Game/GameManager.js`: mode, progression, death, reset, floor loading.
* `Game/RunState.js`: run seed, floor seed, floor index, status, floor type.
* `Core/Inventory.js`: inventory and consumables.
* `Core/ItemEffects.js`: passive and consumable effects.
* `Game/Chest.js`: chests, sarcophagi/mimics, chest rewards.
* `Game/Coin.js`: coin types, values, conversion, physical coin behavior.
* `World/ItemDrop.js`: physical item drops and pickup wiring.
* `World/LevelBuilder.js`: room assembly, connectors, collision, shop spawns, stairs, decoration hooks.
* `World/DecorationBuilder.js`: deterministic procedural decoration.
* `World/PropPlacementRules.js`: decoration placement rules.
* `Game/ProceduralLevelFactory.js`: procedural floor creation.
* `Game/RoomTester.js`: manual room/floor debugging.
* `Game/ShopFloorFactory.js`: shop floor creation.
* `Game/ShopManager.js`: shop offers, purchase flow, altar interaction, shop events.
* `Game/ShopOfferFactory.js`: shop offer generation.
* `Game/shopDefinitions.js`: shop configuration.
* UI helpers: HUD, logs, SFX, VFX, outlines, feedback.

Prefer event-driven communication between systems.

---

## Modes and Progression

Modes:

* `tester`: explicit room/floor compositions for debugging.
* `run`: real seeded progression.

Default mode is configured in:

* `Game/GameConfig.js`

Run mode uses `RunState`.

RunState should track:

* mode
* runSeed
* floorIndex
* floorSeed
* floorType
* difficultyTier
* active/won/lost state

Shop is implemented. Boss is still future work.

---

## Assets and Models

Gameplay models live in:

* `CharacterData/modelDefinitions.js`

Enemy/item data lives in:

* `CharacterData/`

Room/tile data lives in:

* `RoomData/`

Environment and tile assets live in:

* `RoomData/tileSetDefinitions.js`

Rules:

* Use semantic ids such as `player_human_01`, `enemy_orc_01`, `chest_01`, `coin_01`.
* Do not hardcode `.glb` paths in gameplay systems.
* Tile definitions that need non-default colormaps should declare `assetTexturePath`.
* Scene may preload models and distribute clones.
* Room spawns may specify `modelId` for non-default visuals.

---

## Rooms and Floors

Floors are assembled from reusable room instances in one connected world space.

Room types:

* enter
* combat
* treasure
* exit
* shop
* boss future

Room files:

* `RoomData/enterRooms.js`
* `RoomData/combatRooms.js`
* `RoomData/treasureRooms.js`
* `RoomData/exitRooms.js`
* `RoomData/shopRooms.js`
* future `RoomData/bossRooms.js`
* `RoomData/roomTemplates.js`
* `RoomData/roomTagFilters.js`

Room templates must define:

* id
* type
* tags
* dimensions
* openings
* walkableAreas
* floor modules
* wall modules
* enemySpawns
* chestSpawns

Optional:

* obstacles
* setDressingModules
* decorZones
* modelId overrides

Rules:

* Do not author rooms in `Scene.js`.
* Use readable handcrafted layouts over dense geometry.
* Use tags for procedural selection intent.
* Openings must align cleanly.
* Connected sides must avoid duplicated borders.
* Each room should be testable through `RoomTester`.

---

## Procedural Floors

`ProceduralLevelFactory` creates procedural floors from room templates.

Current normal floors use:

* 1 enter room
* 2-3 combat rooms
* 3-4 treasure rooms
* 1 exit room

Dead-end rooms may attach to combat/treasure rooms, but not directly to enter/exit rooms.

The main path to the exit must remain valid.

---

## Connectors and Decoration

`LevelBuilder` detects shared borders by matching opposite openings in world space.

Connector rules:

* Connected borders are handled once.
* Connector collision must allow click-to-move pathfinding.
* Connector styles live in builder-owned data.
* Connector lights/VFX are routed through `UI/VFX.js`.

Decoration rules:

* Decoration stays out of `Scene.js`.
* Decoration is seeded and deterministic.
* Scatter props may appear broadly.
* Barrels should prefer semantic spots such as corners, doors, room edges, and chest-adjacent areas.
* Decoration must avoid openings, connectors, player/enemy/chest spawns, stairs, shop altars, and critical navigation paths.
* Visual footprint and collision footprint may differ, but gameplay validation uses collision footprint.

---

## Gameplay and Enemies

Movement:

* Player uses click-to-move pathfinding.
* Player can attack by explicit click intention on an enemy.
* Clicking the floor can cancel attack intention and move when allowed.
* Combat uses windup and cooldown feedback.

Combat rules:

* Damage is event-driven.
* Drops are event-driven.
* Do not trigger attacks directly from input without going through player combat logic.
* FSM/state systems own state transitions.

Enemy rules:

* Enemy movement uses the same walkable/collision rules as the player.
* Enemy stats come from enemy definition files.
* Difficulty groups are `easy`, `medium`, and `hard`.
* Easy enemies do not aggro by proximity unless explicitly configured.
* Medium/hard enemies may aggro by proximity.
* Chase/leash/return behavior belongs in `World/EnemyAI.js`.
* Patrol enemies should stay inside their spawn room unless explicitly designed otherwise.
* Scene may inject navigation callbacks but must not contain enemy decision logic.

---

## Items, Loot, Chests, Coins, and Drops

Items are data-driven through:

* `CharacterData/itemDefinitions.js`

Current item examples:

* steak: damage
* chili: attack speed
* ramen: max HP / heal effect
* energyDrink: healing consumable
* purpleShroom: stun/disengage consumable

Rules:

* Do not create one script per item.
* Passive items use `Core/ItemEffects.js`.
* Consumables use `Core/Inventory.js`.
* Scene only routes item events, HUD updates, and feedback.
* Consumable HUD icons remain visible once discovered.

Loot rules:

* Loot has rarity classes.
* Chest rarity progression lives in `Game/Chest.js`.
* Enemy potion drop chance lives in `World/EnemyAI.js` and should not be tied to chest rarity progression.
* Standard chests may grant items directly through item/inventory logic.
* Coins are physical drops and must be collected from the ground.
* Item drops may also be physical when spawned as ground loot.
* Room templates place chests/enemies but should not define default reward values unless explicitly overriding.
* Scene renders drops and routes pickups only.

Chest special cases:

* `Game/Chest.js` also handles sarcophagi/mimic coffin behavior.
* Mimics may drop loot or spawn an enemy such as a vampire.
* Mimic/sarcophagus behavior should remain configurable in chest logic, not room generation.

Coin/drop behavior:

* Coin definitions and denominations live in `Game/Coin.js`.
* Enemy/chest coin drops roll total gold, then convert to useful denominations.
* Coins and physical item drops should launch from source, avoid walls, land on walkable ground, become collectible after landing, and remain on the ground if pickup is blocked.

---

## Shop

Shop is implemented.

Shop ownership:

* `Game/ShopFloorFactory.js`
* `Game/ShopManager.js`
* `Game/ShopOfferFactory.js`
* `Game/shopDefinitions.js`
* `RoomData/shopRooms.js`

Rules:

* Shop offers should be data-driven.
* Shop item rarity/price/offer rules belong in shop definitions/factories.
* Purchase logic belongs in `ShopManager`.
* Scene only routes shop interaction and feedback.
* Shop should work in run mode and be testable separately.

---

## Level Design

Rules:

* Avoid overlapping floor planes and Z-fighting.
* Keep walkable areas and collision walls separate.
* Place enemies and chests intentionally.
* Room layouts should create meaningful combat decisions.
* Wall module rotation follows side: north/south share one Y rotation, east/west use the perpendicular rotation.
* Corner wall modules must be explicitly oriented.
* Visual size and collision size may differ when navigation needs it.

Design goals:

* Prefer interesting shapes, loops, branches, chokepoints, obstacles, and risk/reward treasure rooms over simply making rooms larger.
* Boss room should be fixed/handcrafted, not procedural.

---

## Reset, Text, and Verification

Do not reload the browser page to reset gameplay.

Death or run reset should clear:

* enemies
* chests
* coins
* item drops
* VFX
* player state
* combat state
* HUD/log state

Then rebuild the floor or restart the run through `GameManager`.

Text rules:

* All player-facing text must be English.
* Spanish is allowed for programmer-facing comments, notes, and documentation.
* HUD numbers must come from game/player state, not static placeholder HTML.

Validation rules:

* Keep useful development console logs.
* Do not run `node --check`; it is blocked in this environment.
* Do not run browser smoke tests unless explicitly requested.
