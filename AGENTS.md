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
- Coin logic and rendering (including outline via EffectComposer) lives in Coin.js
- Scene.js only manages world + rendering + wiring
- UI (HUD/log/audio) lives in Scene or UI helpers only
- Game rules must NOT be inside input handlers
- Game information and logic lives in GameManager.js
- Level progression logic lives in GameManager.js
- Level geometry data can live in Scene.js, but should stay declarative and easy to replace
- Enemy loot drop decisions live in EnemyAI.js and must be emitted as events
- Scene.js renders dropped loot and handles pickup wiring only

---

## Core Gameplay Rules

- Player movement is click-to-move
- Click-to-move must use navigation/pathfinding around collision walls
- Player should not run directly into walls when the destination is reachable by a doorway
- Player cannot move during combat
- Enemy initiates combat via proximity detection
- Combat is turn-based cooldown (not real-time spam)
- Only FSM controls state transitions
- Exit buttons activate when the player stands on them and ask GameManager to load the next level

---

## Combat Rules

- Player attack cooldown = source of truth
- Enemy attack cooldown = independent timer
- Damage must be event-driven
- Never trigger attacks from input
- Enemy coin drops must be event-driven after enemy death

---

## Level Rules

- Avoid overlapping floor planes to prevent Z-fighting
- Use separate walkable areas and collision walls for level layout
- Chests should be distributed naturally in rooms, not all in one cluster
- Chest ground drops should spawn toward the chest front, away from nearby walls
- Enemy patrol routes may pass through doors and enter rooms

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
