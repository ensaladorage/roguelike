# AGENTS.md

Responder siempre en espanol.

## Project

Browser-based top-down 3D roguelike built as a static ES module app with Three.js loaded from the `index.html` import map. There is no bundler.

Entrypoints:

* `main.js`
* `Core/Scene.js`

Core loop:

* Run-only finite roguelike progression.
* WASD movement with collision/path validation.
* Mouse-directed melee attacks with windup, cooldown, range, arc, VFX and SFX.
* Event-driven enemies, loot, inventory, shop, HUD, progression, reset and victory flow.

## Current State

Default and only gameplay mode is `run`; tester mode has been removed.

Run progression is data-driven through `Game/RunPlan.js`:

* 10 stages total.
* Stages 1, 2, 4, 5, 7 and 8 are compact combat floors.
* Stages 3, 6 and 9 are tiered shop floors.
* Stage 10 is a placeholder boss floor using existing enemy/boss systems.

Combat stages use an `enter -> combat -> treasure -> exit` structure. Treasure rooms are locked by stage-clear blockers until all required combat enemies are defeated. Boss defeat marks the run completed, shows the green `Completed` overlay, and restarts internally without reloading the browser page.

## Architecture

`Scene.js` is orchestration only.

Allowed in `Scene.js`:

* Three.js/camera/renderer setup.
* manager wiring and model cloning.
* input routing and navigation callbacks.
* event routing to HUD/SFX/VFX.
* floor loading, visibility wiring and reset orchestration.

Do not put core gameplay rules, enemy decisions, item logic, loot logic, room data, procedural generation, shop rules or progression rules directly in `Scene.js`.

Primary ownership:

* `Core/Player.js`: player FSM, WASD movement, directional combat, stats, damage, death, gold and snapshots.
* `Core/Input.js`: keyboard input, mouse raycast routing, cursor state and interaction priority.
* `World/EnemyAI.js`: enemy FSM, patrol, chase, leash, return, stun, attack, death and drops.
* `Game/GameManager.js`: run progression, stage clear, victory/defeat reset and floor resolution.
* `Game/RunState.js`: run seed, stage index, stage type, difficulty, status and snapshots.
* `Game/RunPlan.js`: stage order, enemy pools, gold, treasure, shop tiers, healing and boss placeholder tuning.
* `Game/ProceduralLevelFactory.js`: compact combat floor layout generation.
* `World/LevelBuilder.js`: room assembly, connectors, collision, locked blockers, spawns and visibility data.
* `Game/Chest.js` and `Game/chest-epic.js`: chest rewards, normal/epic chest behavior and epic reward choices.
* `World/ItemDrop.js`, `Game/Coin.js`, `Core/Inventory.js`, `Core/ItemEffects.js`: physical drops, pickups, inventory and item effects.
* `Game/ShopFloorFactory.js`, `Game/ShopManager.js`, `Game/ShopOfferFactory.js`, `Game/shopDefinitions.js`: shops, offers, prices, rarity weights and healing fountains.
* `UI/HUD.js`, `UI/SFX.js`, `UI/VFX.js`: UI overlays, logs, cursor feedback, sounds and visual effects.

Prefer event-driven communication between systems.

## Controls and Combat

Movement:

* WASD is the only free movement control.
* Empty-world clicks must never move the player.
* Interactable clicks may use existing pathfinding only to reach that interactable.

Mouse priority:

* Clicks on chests, item drops, shop stands, shop fountains and exits use their interaction logic.
* Other clicks attack toward the clicked world position.
* Enemy clicks are directional attacks, not target selection.

Player attacks:

* Direction is locked when the attack starts.
* The player can move during windup, strike and cooldown.
* Hits are resolved in `Core/Player.js` by `attackRange` and `attackArcDegrees`.
* Damage is applied only to visible enemies inside the cone.
* A whiff is valid and should produce whiff feedback, not errors.
* Attack VFX/SFX are routed by events; combat hit rules do not belong in UI/VFX.
* The subtle white attack range ring follows `player.attackRange` and is owned by VFX/player feedback code.

Enemy rules:

* Enemy stats come from `CharacterData/*Enemies.js`.
* Difficulty groups are `easy`, `medium` and `hard`.
* Easy enemies do not aggro by proximity unless explicitly configured.
* Medium/hard enemies may aggro by proximity.
* Chase/leash/return behavior belongs in `World/EnemyAI.js`.
* Scene may inject navigation callbacks but must not contain enemy decision logic.

## Rooms, Floors and Visibility

Room data lives in `RoomData/`; gameplay systems must not hardcode room geometry in `Scene.js`.

Current room types:

* `enter`
* `combat`
* `treasure`
* `exit`
* `shop`
* `boss`

Rules:

* Floors are assembled from reusable room templates in one connected world space.
* Combat floors are compact and currently use one combat room, one locked treasure room and one exit.
* Treasure room connections use invisible `stageLockedConnection` blockers until stage clear.
* `RoomVisibilityManager` controls room visibility; shop fountains should obey the same visibility rules as shop altars/items.
* Connector collision must support WASD movement, enemy navigation, interaction pathing, drops and room validation.
* Decoration stays deterministic and out of critical navigation paths, openings, connectors, spawns, chests, stairs, shop interactables and locked blockers.

## Loot, Items and Chests

Items are data-driven in `CharacterData/itemDefinitions.js`; do not create one script per item.

Current item examples:

* `steak`: attack damage.
* `chili`: attack speed.
* `ramen`: max HP.
* `energyDrink`: healing consumable.
* `purpleShroom`: area stun/poison.

Loot rules:

* Coins are physical drops and collected from the ground.
* Item rewards should spawn as physical clickable item drops unless explicitly using an immediate-choice flow.
* Item drops show hover tooltip and are picked up only by click/interact logic.
* Normal treasure chests drop gold and common physical items.
* Every combat-stage treasure room has 1-2 normal chests and one central epic chest.
* Epic chests open a HUD choice modal with 3 rare/epic-display options; selecting one adds that item to inventory.
* Mimic/coffin behavior remains configurable in `Game/Chest.js` and should not be mixed into normalized run treasure rooms unless intentionally reintroduced.

## Shops

Shop tiers are configured through `SHOP_TIERS` in `Game/RunPlan.js` and consumed by shop factories/managers.

Rules:

* Tier controls offer count, possible item IDs, rarity weights, price multiplier and healing.
* Stage 3 tier 1 has no healing fountain.
* Stage 6 tier 2 has a one-use 25 HP fountain.
* Stage 9 tier 3 has a one-use 45 HP fountain.
* Fountains are shop interactables owned by `ShopManager`.
* Scene only routes shop/fountain interactions and feedback.

## Assets and Models

Gameplay model ids live in `CharacterData/modelDefinitions.js`.

Rules:

* Use semantic ids such as `player_human_01`, `enemy_orc_01`, `chest_01`, `chest_epic_01`, `coin_01`.
* Do not hardcode `.glb` paths in gameplay systems.
* Tile definitions that need non-default colormaps should declare `assetTexturePath`.
* Scene may preload models and distribute clones.
* Room spawns may specify `modelId` for non-default visuals.

## Reset, Text and Verification

Do not reload the browser page to reset gameplay.

Death, completion or manual run reset should clear:

* enemies
* chests
* coins
* item drops
* VFX/SFX transient state
* player runtime state
* combat state
* HUD overlays/log state as appropriate

Then restart the run through `GameManager`.

Text rules:

* All player-facing text must be English.
* Spanish is allowed for programmer-facing comments, notes and documentation.
* HUD numbers must come from game/player state, not static placeholder HTML.

Validation rules:

* Keep useful development console logs.
* Do not run `node --check`; it is blocked in this environment.
* Do not run browser smoke tests unless explicitly requested.
