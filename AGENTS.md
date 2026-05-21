# AGENTS.md

## Project: 3D Roguelike (Three.js)

### Goal
Build a simple top-down roguelike with:
- Click-to-move player
- FSM-based player logic
- Enemy AI with patrol and attack
- Chests with loot and coins
- Single-player prototype
- Levels are generated with random structure
- Every 10 randoms levels there is 1 Boss level
- Before Boss level there is a Shop level, where Player can buy items

---

## Architecture Rules

- Player logic lives in Player.js (FSM only)
- Enemy logic lives in EnemyAI.js
- Chest logic lives in Chest.js
- Chest open rewards live in Chest.js, currently CHEST_REWARD.
- Environment and global lighting live in Environment.js
- Coin logic lives in Coin.js
- Coin reward counts/values live in Coin.js, currently COIN_REWARDS and getCoinReward.
- Item definitions live in Data/itemDefinitions.js.
- Inventory state lives in Core/Inventory.js.
- Item effect logic lives in Core/ItemEffects.js.
- Ground item drop visuals and pickup wiring live in World/ItemDrop.js.
- Scene.js only manages world + rendering + wiring
- UI (HUD/log/audio) lives in Scene or UI helpers only
- Game rules must NOT be inside input handlers
- Game information and logic lives in GameManager.js
- Level progression logic lives in GameManager.js
- Level geometry data must stay out of Scene.js and live in data files or builder-owned definitions
- Model asset definitions must live in Data/modelDefinitions.js, not hardcoded in Scene.js
- Scene.js may preload and clone models from model definitions, but should not own model ids or asset paths
- Enemy loot drop decisions live in EnemyAI.js and must be emitted as events
- Scene.js renders dropped loot and handles pickup wiring only

---

## Item and potion rules

- Items are data-driven through Data/itemDefinitions.js.
- Do not create one script per item.
- Passive item effects are applied through Core/ItemEffects.js.
- Consumable inventory storage and stack limits are owned by Core/Inventory.js.
- Item pickup/use must emit events such as itemPickedUp, passiveItemApplied, itemUsed, itemUseFailed, or itemPickupBlocked.
- Scene.js must only orchestrate item events, HUD updates, and manager wiring.
- Consumable HUD icons appear only after the player has received that consumable at least once.
- After a discovered consumable is used, its HUD icon must remain visible and show count 0.
- When a consumable stack reaches its max, the HUD count should display "Max.".
- HUD item order is data-driven by Data/itemDefinitions.js -> hudSlot. Current order is 1 energyDrink, 2 purpleShroom, 3 ramen, 4 steak, 5 chili.
- Consumable keyboard use is data-driven by Data/itemDefinitions.js -> useSlot. Current usable slots are 1 energyDrink and 2 purpleShroom.
- Stats modified by item effects should visually highlight in red for about 3 seconds so the player notices the changed stat.
- Food-themed passive items currently include:
  - steak: damage up
  - chili: attack speed up
  - ramen: max HP up
- Consumable items currently include:
  - energyDrink: heal
  - purpleShroom: stun nearby/current enemy, disengage combat, and allow player movement again
- Potion means energyDrink unless explicitly stated otherwise.
- energyDrink is a ground drop only when dropped by enemies or chests. It should not be auto-added from the normal chest item pool.
- energyDrink ground drops use World/ItemDrop.js and should behave like coin drops: launch from source, avoid walls, land on walkable ground, become collectible after landing, and remain on the ground if not collectible.
- The current energyDrink ground drop visual is a simple 3D debug bottle/cylinder. Do not place the EnergyDrink.png image as a billboard or label on top of the 3D drop.
- The energyDrink inventory max stack is Data/itemDefinitions.js -> ITEM_DEFINITIONS.energyDrink.inventory.maxStack, currently 3.
- The purpleShroom inventory max stack is Data/itemDefinitions.js -> ITEM_DEFINITIONS.purpleShroom.inventory.maxStack, currently 3.
- If the player already has max energyDrink count, the potion cannot be picked up and must remain on the floor.
- Enemy energyDrink drop chance lives in World/EnemyAI.js -> ENEMY_POTION_DROP.chancePercent, currently 5. This is a 1-100 percent value, not a 0-1 fraction.
- Chest energyDrink drop chance lives in World/Chest.js -> CHEST_REWARD.potionDropChancePercent, currently 5. This is a 1-100 percent value, not a 0-1 fraction.
- Potion drop rolls must log debug output whether they spawn or fail. Current debug log names are enemyPotionDropRoll and chestPotionDropRoll.
- Normal chest item rewards live in World/Chest.js -> CHEST_REWARD.itemChancePercent and CHEST_REWARD.itemPool. itemChancePercent is a 0-100 percent value.
- Normal chest item reward count lives in World/Chest.js -> CHEST_REWARD.itemRollCount. Each roll can spawn one item from itemPool using itemChancePercent, so itemRollCount: 3 can produce 0-3 normal items.
- Normal chest item drop rolls should log debug output whether they spawn or fail. Current debug log name is chestItemDropRoll.
- Chest spawn data may later pass rewardOverrides for advanced chest types, but default chest rewards still live in Chest.js and room templates should not hardcode reward values.
- Keep enemy potion drop decisions in EnemyAI.js and emit events. Scene.js renders dropped items through ItemDropManager only.
- Keep chest potion drop decisions in Chest.js. Chest room data must not hardcode potion rewards.

---

## Level architecture rules

- Keep Scene.js as orchestration only.
- Room/layout data must live in data files.
- Three.js mesh placement must live in builder classes.
- Support modular .glb environment assets for floors and walls.
- Keep handcrafted room templates as the main workflow.
- Do not implement full procedural generation until room templates and level assembly are stable.
- Preserve compatibility with current gameplay systems: player, enemies, chests, coins, exit, collisions, navigation.
- A floor can contain multiple reusable room instances placed together in world space.
- Room instances must support world position and optional rotation.
- Room templates define local openings, spawns, walls, walkable areas, decorations, and obstacles.
- Room type collections live in Data files by category: enterRooms.js, combatRooms.js, exitRooms.js, treasureRooms.js, etc.
- Data/roomTemplates.js is the room template registry; it imports room collections and exports ROOM_TEMPLATES.
- LevelBuilder decides how placed room instances become one combined floor.
- Do not treat EnterRoom, CombatRoom, ExitRoom, or other rooms as separate levels connected by nextLevel.
- Scene.js must build all rooms of the current floor into the same levelGroup.
- Room-to-room movement happens through walkable connected geometry, not level loading.

---

## Room connection rules

- Detect shared room borders in LevelBuilder by matching opposite room openings at the same world-space center.
- Connected room borders must be handled once; do not render duplicated wall or doorway modules from both rooms.
- Room templates should keep declaring openings, but LevelBuilder decides whether an opening becomes a standalone doorway or part of a shared connector.
- Shared connectors are not standalone levels and should not be standalone room templates unless explicitly redesigned later.
- Connector styles live in builder-owned data, currently CONNECTOR_STYLES in LevelBuilder.js.
- The current openCorridor connector uses a 3-tile floor strip, side wall pieces, a central woodSupport arch, and a walkable connector area.
- Connector visual meshes and collision boxes may differ when needed for gameplay feel.
- Keep connector collision narrow enough that click-to-move pathfinding can pass through the corridor.
- Tune connector side wall spacing with sideWallOffset in the connector style.

---

## Room authoring rules

- New rooms must be added as reusable room templates in data files.
- Each room template must declare:
  - id
  - type
  - dimensions
  - openings
  - walkable areas
  - wall/floor modules
  - enemy spawns
  - chest spawns
  - modelId on enemy/chest spawns when a non-default model is required
  - optional decorations
  - optional obstacles
- New rooms must not be authored directly inside Scene.js.
- Each new room should be testable in a simple floor composition with enter_room_01 and exit_room_01.
- Prefer small, readable handcrafted layouts over overly dense geometry.
- Openings must align cleanly with shared connectors.
- Avoid duplicated borders on connected room sides.

---

## Model and asset rules

- Gameplay model definitions live in Data/modelDefinitions.js.
- Use MODEL_DEFINITIONS to register player, enemy, NPC, interactable, and collectible models.
- Use semantic model ids such as player_human_01, enemy_orc_01, chest_01, and coin_01.
- New .glb model files should be referenced through assetPath in Data/modelDefinitions.js.
- Default model ids live in Data/modelDefinitions.js: DEFAULT_PLAYER_MODEL_ID, DEFAULT_ENEMY_MODEL_ID, DEFAULT_CHEST_MODEL_ID, and DEFAULT_COIN_MODEL_ID.
- Scene.js loads model definitions with loadGameModels and stores them in models.byId.
- Scene.js clones models through cloneGameModel(modelId); other systems should ask Scene for clones instead of loading GLBs directly.
- Enemy room spawns can specify modelId to choose a specific enemy model.
- Chest spawns can specify modelId to choose a specific chest model.
- CoinManager uses DEFAULT_COIN_MODEL_ID and must not load coin.glb directly.
- ChestManager uses DEFAULT_CHEST_MODEL_ID or chest spawn modelId and must not load chest.glb directly.
- Character, enemy, NPC, chest, and coin asset paths must not be hardcoded in Scene.js.
- Environment/tile assets are separate from gameplay model definitions and remain in Data/tileSetDefinitions.js.

---

## Core Gameplay Rules

- Player movement is click-to-move
- Click-to-move must use navigation/pathfinding around collision walls
- Player should not run directly into walls when the destination is reachable by a doorway
- Player cannot move during combat
- Enemy initiates combat via proximity detection
- Combat start proximity currently lives in GameManager.js as combatStartRange; future per-enemy ranges should come from enemy data and fall back to this default.
- Combat is turn-based cooldown (not real-time spam)
- Only FSM controls state transitions
- Exit buttons are in-floor gameplay elements unless a future floor progression feature explicitly uses them for level loading

---

## Enemy navigation and patrol rules

- Enemy movement must use the same walkable/collision navigation rules as the player; enemies must not move directly through collision walls, rocks, obstacles, or non-walkable space.
- EnemyAI.js owns enemy patrol behavior and movement decisions, but Scene.js injects navigation callbacks and world collision data access.
- Scene.js must stay orchestration-only for enemy navigation: provide canMoveBetween, findPath, and random walkable point helpers; do not put enemy decision logic in Scene.js.
- LevelBuilder must pass room walkable areas to enemy spawn data as patrolAreas so enemies can patrol naturally inside their combat room.
- Enemy patrol should be natural/random by default: choose a random reachable walkable target, follow a navigation path for a random movement duration, pause briefly, then choose a new route.
- Enemy patrol routes must validate reachability through pathfinding before movement and should retry random targets before falling back or pausing.
- Enemy movement should resolve collisions each step and may slide along valid axes, but must stop/repath when blocked.
- Enemy patrol timing defaults currently live in EnemyAI.js: movement duration 2-4 seconds and pause duration 0.5 or 1 second.
- Enemy collision radius is configured from Scene.js when creating EnemyAI, currently ENEMY_COLLISION_RADIUS.
- When the player is in combat, GameManager.js must pause movement for all non-active enemies with pauseMovement("playerCombat").
- EnemyAI.js owns pauseMovement/resumeMovement/isMovementPaused so future enemy behaviors such as chase can also be stopped by combat rules.
- The active combat enemy must not be paused by the playerCombat movement lock.

---

## Combat Rules

- Player attackSpeed is configured in Player.js and is the player-facing attack rate stat shown in the HUD.
- Player attackCooldown is derived from attackSpeed in Player.js and used internally for combat timing.
- Enemy attack cooldown = independent timer
- Damage must be event-driven
- Damage flash effects must be triggered only by real damage events, not by combat start or attack intent events
- Never trigger attacks from input
- Enemy coin drops must be event-driven after enemy death

---

## Level Rules

- Avoid overlapping floor planes to prevent Z-fighting
- Use separate walkable areas and collision walls for level layout
- Chests should be distributed naturally in rooms, not all in one cluster
- Room templates place chests only; chest rewards must not be hardcoded in room data.
- Room templates place enemies only; enemy coin reward values must not be hardcoded in room data.
- Chest ground drops should spawn toward the chest front, away from nearby walls
- Coin outlines/visibility helpers must not use global postprocessing or alter scene lighting
- Coin drops should animate from their source, avoid walls, and become collectible only after landing
- Potion drops should follow the same ground drop behavior as coins and should be managed by World/ItemDrop.js.
- Enemy patrol routes may pass through doors and enter rooms
- Wall module rotation must follow the side of the room: north/south use one Y rotation, east/west use the perpendicular Y rotation.
- Corner wall modules must be oriented explicitly per corner.
- Visual obstacle size and collision size can differ when needed for navigation.
- Rocks use reduced collision through ROCK_COLLISION_SCALE in LevelBuilder.js; tune that constant before resizing the visual mesh.

---

## Reset Rules

When player dies:
- reset player position
- reset enemy HP + position
- reset chests
- reset UI (HUD + log)
- reset level

---

## Coding Rules

- Keep files modular
- Avoid mixing UI + game logic
- Prefer event-driven communication
- No direct DOM access inside Player or Enemy
- All player-facing game text must be in English: HUD labels, item names, logs, debug/log window messages, aria labels, hints, and level names shown on screen.
- Spanish is allowed only for programmer-facing text such as code comments, internal notes, or developer documentation.
- HUD stat numbers must be read from player/game state, not from static placeholder text in index.html.

---

## Debug Rules

- Use console logs for events
- Never remove logs during debugging phase

---

## Local browser verification

- The in-app browser can be used to verify the game at http://127.0.0.1:5500/index.html when the user has the local server running.
- Prefer the Browser plugin / in-app browser for visual checks instead of OS browser commands.
- If the in-app browser is already open to http://127.0.0.1:5500/index.html, reuse the selected tab and reload it after code changes.
- Browser setup that worked in Codex uses the Node REPL browser client:
  - locate browser-client.mjs under C:/Users/Javi/.codex/plugins/cache/openai-bundled/browser/*/scripts/browser-client.mjs
  - current known working path: C:/Users/Javi/.codex/plugins/cache/openai-bundled/browser/26.519.21041/scripts/browser-client.mjs
  - import setupBrowserRuntime from that browser-client.mjs path
  - get the in-app browser with agent.browsers.get("iab")
  - use browser.tabs.selected() or browser.tabs.new()
  - call tab.reload() or tab.goto("http://127.0.0.1:5500/index.html")
  - read errors with tab.dev.logs({ levels: ["error", "warning"], limit: 20 })
- Do not waste time trying file:// URLs for this project in the in-app browser; they are blocked by browser policy.
- If http://localhost or another port is blocked, try the known working URL: http://127.0.0.1:5500/index.html.
- A successful smoke check should reload the page, confirm the title is Roguelike, and confirm there are 0 browser warning/error logs.
