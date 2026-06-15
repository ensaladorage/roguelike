# AGENTS.md

Responder siempre en español.

## Proyecto

Roguelike 3D top-down para navegador, servido como app estática de ES modules. Three.js se carga desde el import map de `index.html`; no hay bundler. Entradas principales: `main.js` y `Core/Scene.js`.

El modo actual y único es `run`; no reintroducir tester mode. La progresión vive en `Game/RunPlan.js`: 10 stages, con combate compacto en 1, 2, 4, 5, 7 y 8; tiendas en 3, 6 y 9; boss en 10. Los pisos de combate siguen `enter -> combat -> treasure -> exit`; la treasure room queda bloqueada hasta limpiar los enemigos requeridos. La victoria/derrota reinicia por `GameManager`, sin recargar la página.

## Arquitectura

`Core/Scene.js` es solo orquestación: Three.js/cámara/renderer, wiring de managers, clones de modelos, rutas de input, eventos hacia HUD/SFX/VFX, carga de pisos, visibilidad y reset. No poner ahí reglas de gameplay, IA, loot, items, tienda, progresión, room data ni generación procedural.

Responsabilidades principales:

* `Core/Player.js`: FSM del jugador, WASD, combate direccional, stats, daño, muerte, oro y snapshots.
* `Core/Input.js`: teclado, raycast de mouse, cursor e prioridad de interacción.
* `World/EnemyAI.js`: FSM enemiga, patrol, chase, leash, return, stun, ataque, muerte y drops.
* `Game/GameManager.js`, `Game/RunState.js`, `Game/RunPlan.js`: progresión, stage clear, reset, semillas, stages, tiers y boss tuning.
* `Game/ProceduralLevelFactory.js`, `World/LevelBuilder.js`, `RoomData/*`: composición de pisos, rooms, conectores, colisiones, blockers, spawns y datos de rooms.
* `Game/Chest.js`, `Game/chest-epic.js`, `World/ItemDrop.js`, `Game/Coin.js`, `Core/Inventory.js`, `Core/ItemEffects.js`: cofres, recompensas, drops físicos, pickups, inventario y efectos.
* `Game/ShopFloorFactory.js`, `Game/ShopManager.js`, `Game/ShopOfferFactory.js`, `Game/shopDefinitions.js`: tiendas, offers, precios, rarezas y fuentes de curación.
* `UI/HUD.js`, `UI/SFX.js`, `UI/VFX.js`, `UI/PauseMenu.js`, `UI/DebugCheats.js`: overlays DOM, logs, modales, audio, feedback visual y herramientas debug.

Preferir comunicación por eventos entre sistemas.

## Controles e Interacciones

* Movimiento libre solo con WASD. Los clicks en mundo vacío nunca mueven al jugador.
* Clicks en cofres, item drops, shop stands, fuentes y salidas usan lógica de interacción. Si están fuera de rango, mostrar feedback y exigir acercarse con WASD.
* Otros clicks atacan hacia la posición del mundo. Clickar enemigos es ataque direccional, no target selection.
* El ataque bloquea dirección al inicio; el jugador puede moverse durante windup, strike y cooldown. Hits se resuelven en `Core/Player.js` con `attackRange` y `attackArcDegrees`.
* VFX/SFX de combate se disparan por eventos; las reglas de hit no pertenecen a UI/VFX.
* `Escape` cierra pausa y modales relevantes. Confirmaciones de tienda, cofres épicos y sustitución de item deben poder cerrarse con `Escape` además de sus botones.

## Rooms, Enemigos y Visibilidad

Room data vive en `RoomData/`; no hardcodear geometría en `Scene.js`. Tipos actuales: `enter`, `combat`, `treasure`, `exit`, `shop`, `boss`.

* Los pisos se ensamblan con templates reutilizables en un único world space conectado.
* Combat floors compactos usan room de combate, treasure room bloqueada y salida.
* Los conectores a treasure usan blockers invisibles `stageLockedConnection` hasta stage clear.
* `RoomVisibilityManager` controla visibilidad de rooms, cofres, shops, fuentes y entidades asociadas.
* Conectores/colisiones deben soportar WASD, navegación enemiga, pathing de interacción, drops y validación de rooms.
* Decoración determinista, fuera de rutas críticas, openings, conectores, spawns, cofres, escaleras, shop interactables y blockers.
* Stats enemigas vienen de `CharacterData/*Enemies.js`. Easy no aggro por proximidad salvo config explícita; medium/hard sí pueden. Chase/leash/return vive en `World/EnemyAI.js`.

## Loot, Items, Cofres y Tienda

Items son data-driven en `CharacterData/itemDefinitions.js`; no crear un script por item. Ejemplos actuales: `steak`, `chili`, `potato`, `ramen`, `energyDrink`, `purpleShroom`, `iceCream`, `fish`, `garlic`, `dragonSteak`, `spicySauce`, `dragonFruit`.

* Coins e items son drops físicos salvo flujos explícitos de elección inmediata.
* Item drops muestran tooltip y se recogen solo por click/interact. `World/ItemDrop.js` resuelve aterrizajes, animación, rango de pickup y dispersión; los cofres pueden usar `dropLayout` para separar drops agrupados.
* Cofres normales de treasure sueltan oro y 1-2 items comunes físicos; sus drops deben aterrizar separados y clicables.
* Cada treasure room de combate tiene 1-2 cofres normales y un cofre épico central.
* Cofres épicos abren modal HUD con 3 opciones rare/epic-display; elegir añade el item o abre sustitución si el slot está ocupado.
* Mimic/coffin sigue configurable en `Game/Chest.js`; no mezclarlo en treasure rooms normalizadas salvo intención explícita.
* `SHOP_TIERS` en `Game/RunPlan.js` define offers, pools, rarezas, multiplicador de precio y curación. Stage 3 no cura; stage 6 cura 25 HP una vez; stage 9 cura 45 HP una vez.
* Fuentes y offers son interactables de `ShopManager`; `Scene.js` solo enruta interacción y feedback.

## Assets y Modelos

Los ids de modelos viven en `CharacterData/modelDefinitions.js`; usar ids semánticos (`player_human_01`, `enemy_orc_01`, `chest_01`, `chest_epic_01`, `coin_01`). No hardcodear paths `.glb` en sistemas de gameplay. Tiles con colormaps especiales deben declarar `assetTexturePath`. `Scene.js` puede precargar modelos y distribuir clones. Room spawns pueden especificar `modelId`.

## Reset, Texto y Validación

No recargar la página para resetear. Muerte, victoria o reset manual deben limpiar enemigos, cofres, coins, item drops, VFX/SFX transitorios, estado runtime del jugador, combate y overlays/logs del HUD según corresponda; luego reiniciar por `GameManager`.

Reglas de texto:

* Todo texto visible para jugador debe estar en inglés.
* Español permitido en comentarios, docs y notas internas.
* Números del HUD deben venir de estado real de juego/jugador, no placeholders HTML.

Validación:

* Mantener logs útiles de desarrollo.
* No ejecutar `node --check`; está bloqueado en este entorno.
* No usar Playwright, Puppeteer, `npm install` ni automatización de navegador salvo petición explícita.
* No reintroducir tester mode, click-to-move ni ataques por target lock de enemigos salvo petición explícita.
