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
- Environment and global lighting live in Environment.js
- Coin logic lives in Coin.js
- Scene.js only manages world + rendering + wiring
- UI (HUD/log/audio) lives in Scene or UI helpers only
- Game rules must NOT be inside input handlers
- Game information and logic lives in GameManager.js
- Level progression logic lives in GameManager.js
- Level geometry data must stay out of Scene.js and live in data files or builder-owned definitions
- Enemy loot drop decisions live in EnemyAI.js and must be emitted as events
- Scene.js renders dropped loot and handles pickup wiring only

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
  - size
  - openings
  - walkable areas
  - wall/floor modules
  - enemy spawns
  - chest spawns
  - optional decorations
  - optional obstacles
- New rooms must not be authored directly inside Scene.js.
- Each new room should be testable in a simple floor composition with EnterRoom and ExitRoom.
- Prefer small, readable handcrafted layouts over overly dense geometry.
- Openings must align cleanly with shared connectors.
- Avoid duplicated borders on connected room sides.

---

## Core Gameplay Rules

- Player movement is click-to-move
- Click-to-move must use navigation/pathfinding around collision walls
- Player should not run directly into walls when the destination is reachable by a doorway
- Player cannot move during combat
- Enemy initiates combat via proximity detection
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

---

## Combat Rules

- Player attack cooldown = source of truth
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
- Chest ground drops should spawn toward the chest front, away from nearby walls
- Coin outlines/visibility helpers must not use global postprocessing or alter scene lighting
- Coin drops should animate from their source, avoid walls, and become collectible only after landing
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

---

## Debug Rules

- Use console logs for events
- Never remove logs during debugging phase
