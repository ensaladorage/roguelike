import * as THREE from "three";

const CURSOR_ICONS = {
  movement: "Assets/Icons/MovementIcon.png",
  attack: "Assets/Icons/AttackIcon.png",
  interactable: "Assets/Icons/InteractableIcon.png",
};

const MOVEMENT_CURSOR = `url("${CURSOR_ICONS.movement}") 4 3, auto`;

export function setupInput(
  renderer,
  camera,
  floor,
  getEnemyTargets,
  getInteractableTargets,
  onClick
) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const cursorOverlay = createCursorOverlay(renderer.domElement);
  const attackFeedback = {
    attackState: "ready",
    cooldownProgress: 1,
    windupProgress: 0,
    isReady: true,
    isWindup: false,
    isCoolingDown: false,
    hasAttackTarget: false,
  };
  const pointerState = {
    inside: false,
    clientX: 0,
    clientY: 0,
  };

  renderer.domElement.style.cursor = MOVEMENT_CURSOR;

  renderer.domElement.addEventListener("pointermove", (event) => {
    updatePointerState(pointerState, event);
    updateCursor();
  });

  renderer.domElement.addEventListener("pointerleave", () => {
    pointerState.inside = false;
    hideCursorOverlay(renderer.domElement, cursorOverlay);
  });

  renderer.domElement.addEventListener("pointerdown", (event) => {
    updatePointerState(pointerState, event);
    updatePointer(event, renderer, camera, raycaster, pointer);
    const enemyHit = getPointedEnemyHit(raycaster, getEnemyTargets);

    if (enemyHit) {
      onClick({
        enemy: enemyHit.enemy,
        point: enemyHit.point,
      });
      return;
    }

    const hits = raycaster.intersectObject(floor);

    if (hits.length > 0) {
      onClick({
        point: hits[0].point,
      });
    }
  });

  const updateCursor = () => {
    if (!pointerState.inside) return;

    updatePointerFromClientPosition(
      pointerState.clientX,
      pointerState.clientY,
      renderer,
      camera,
      raycaster,
      pointer
    );
    updateCursorOverlay(
      pointerState,
      renderer.domElement,
      cursorOverlay,
      getHoverIntent(raycaster, getEnemyTargets, getInteractableTargets),
      attackFeedback
    );
  };

  return {
    updateCursor,
    setAttackFeedback(feedback = {}) {
      Object.assign(attackFeedback, feedback);
    },
  };
}

function createCursorOverlay(canvas) {
  injectCursorStyles();

  const overlay = document.createElement("div");
  overlay.className = "game-cursor-overlay";
  overlay.setAttribute("aria-hidden", "true");

  const icon = document.createElement("img");
  icon.className = "game-cursor-overlay__icon";
  icon.alt = "";
  icon.draggable = false;

  const attackIndicator = document.createElement("span");
  attackIndicator.className = "game-cursor-overlay__attack-indicator";

  overlay.append(icon, attackIndicator);

  canvas.parentElement?.appendChild(overlay);

  return overlay;
}

function injectCursorStyles() {
  if (document.querySelector("#gameCursorStyles")) return;

  const style = document.createElement("style");
  style.id = "gameCursorStyles";
  style.textContent = `
    .game-cursor-overlay {
      --cursor-x: -100px;
      --cursor-y: -100px;
      --cursor-rotation: 0deg;
      position: fixed;
      left: 0;
      top: 0;
      width: 32px;
      height: 32px;
      opacity: 0;
      pointer-events: none;
      transform: translate(var(--cursor-x), var(--cursor-y)) rotate(var(--cursor-rotation));
      transform-origin: 7px 7px;
      transition: opacity 80ms ease;
      z-index: 1000;
    }

    .game-cursor-overlay__icon {
      display: block;
      width: 32px;
      height: 32px;
      user-select: none;
    }

    .game-cursor-overlay__attack-indicator {
      --attack-progress: 1turn;
      position: absolute;
      right: -7px;
      bottom: -5px;
      width: 11px;
      height: 11px;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.82);
      background:
        conic-gradient(
          #ffffff var(--attack-progress),
          rgba(112, 112, 112, 0.92) 0
        );
      box-shadow: 0 0 5px rgba(0, 0, 0, 0.55);
      opacity: 0;
    }

    .game-cursor-overlay.has-attack-feedback .game-cursor-overlay__attack-indicator {
      opacity: 1;
    }

    .game-cursor-overlay.is-attack-ready .game-cursor-overlay__attack-indicator {
      background: #ffffff;
      box-shadow:
        0 0 5px rgba(0, 0, 0, 0.55),
        0 0 6px rgba(255, 255, 255, 0.85);
    }

    .game-cursor-overlay.is-attack-windup .game-cursor-overlay__attack-indicator {
      background: rgba(255, 255, 255, 0.18);
      border-color: rgba(255, 255, 255, 0.95);
      box-shadow:
        0 0 5px rgba(0, 0, 0, 0.55),
        0 0 7px rgba(255, 255, 255, 0.65);
    }

    .game-cursor-overlay.is-active {
      opacity: 1;
    }

    .game-cursor-overlay.is-attack {
      animation: attackCursorMotion 760ms ease-in-out infinite alternate;
    }

    .game-cursor-overlay.is-interactable {
      animation: interactableCursorMotion 720ms ease-in-out infinite alternate;
    }

    @keyframes attackCursorMotion {
      from { --cursor-rotation: -2deg; }
      to { --cursor-rotation: 2deg; }
    }

    @keyframes interactableCursorMotion {
      from { translate: 0 -1px; }
      to { translate: 0 3px; }
    }
  `;

  document.head.appendChild(style);
}

function updateCursorOverlay(
  pointerState,
  canvas,
  overlay,
  hoverIntent,
  attackFeedback
) {
  const showCooldownFeedback = isAttackCooldownVisible(attackFeedback);
  const cursorIntent = hoverIntent ?? (
    showCooldownFeedback ? "movement" : null
  );

  if (!cursorIntent) {
    hideCursorOverlay(canvas, overlay);
    return;
  }

  const icon = getCursorIcon(cursorIntent);

  const iconElement = overlay.querySelector(".game-cursor-overlay__icon");

  if (iconElement && !iconElement.src.endsWith(icon)) {
    iconElement.src = icon;
  }

  overlay.classList.toggle("is-attack", cursorIntent === "attack");
  overlay.classList.toggle("is-interactable", cursorIntent === "interactable");
  updateAttackIndicator(overlay, attackFeedback, cursorIntent);
  overlay.classList.add("is-active");
  overlay.style.setProperty("--cursor-x", `${pointerState.clientX}px`);
  overlay.style.setProperty("--cursor-y", `${pointerState.clientY}px`);
  canvas.style.cursor = "none";
}

function getCursorIcon(cursorIntent) {
  switch (cursorIntent) {
    case "attack":
      return CURSOR_ICONS.attack;

    case "interactable":
      return CURSOR_ICONS.interactable;

    default:
      return CURSOR_ICONS.movement;
  }
}

function hideCursorOverlay(canvas, overlay) {
  overlay.classList.remove(
    "is-active",
    "is-attack",
    "is-interactable",
    "has-attack-feedback",
    "is-attack-ready",
    "is-attack-windup"
  );
  overlay.style.setProperty("--cursor-x", "-100px");
  overlay.style.setProperty("--cursor-y", "-100px");
  overlay.style.setProperty("--cursor-rotation", "0deg");
  canvas.style.cursor = MOVEMENT_CURSOR;
}

function updateAttackIndicator(overlay, attackFeedback, hoverIntent) {
  const indicator = overlay.querySelector(".game-cursor-overlay__attack-indicator");
  if (!indicator) return;

  const showCooldownFeedback = isAttackCooldownVisible(attackFeedback);
  const shouldShowFeedback =
    hoverIntent === "attack" ||
    showCooldownFeedback;
  const progress = shouldShowFeedback
    ? Math.max(0, Math.min(1, attackFeedback.cooldownProgress ?? 1))
    : 0;

  indicator.style.setProperty("--attack-progress", `${progress.toFixed(3)}turn`);
  overlay.classList.toggle("has-attack-feedback", shouldShowFeedback);
  overlay.classList.toggle(
    "is-attack-ready",
    hoverIntent === "attack" && attackFeedback.isReady
  );
  overlay.classList.toggle(
    "is-attack-windup",
    hoverIntent === "attack" && attackFeedback.isWindup
  );
}

function isAttackCooldownVisible(attackFeedback) {
  return Boolean(
    attackFeedback.isCoolingDown ||
    (
      !attackFeedback.isReady &&
      !attackFeedback.isWindup &&
      (attackFeedback.cooldownProgress ?? 1) < 1
    )
  );
}

function getHoverIntent(raycaster, getEnemyTargets, getInteractableTargets) {
  if (getPointedEnemy(raycaster, getEnemyTargets)) {
    return "attack";
  }

  if (getPointedInteractable(raycaster, getInteractableTargets)) {
    return "interactable";
  }

  return null;
}

function updatePointer(event, renderer, camera, raycaster, pointer) {
  updatePointerFromClientPosition(
    event.clientX,
    event.clientY,
    renderer,
    camera,
    raycaster,
    pointer
  );
}

function updatePointerState(pointerState, event) {
  pointerState.inside = true;
  pointerState.clientX = event.clientX;
  pointerState.clientY = event.clientY;
}

function updatePointerFromClientPosition(
  clientX,
  clientY,
  renderer,
  camera,
  raycaster,
  pointer
) {
  const bounds = renderer.domElement.getBoundingClientRect();

  pointer.x = ((clientX - bounds.left) / bounds.width) * 2 - 1;
  pointer.y = -((clientY - bounds.top) / bounds.height) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);
}

function getPointedEnemy(raycaster, getEnemyTargets) {
  return getPointedEnemyHit(raycaster, getEnemyTargets)?.enemy ?? null;
}

function getPointedEnemyHit(raycaster, getEnemyTargets) {
  const enemyTargets =
    typeof getEnemyTargets === "function" ? getEnemyTargets() : [];
  const enemyHits = raycaster.intersectObjects(enemyTargets, true);

  for (const hit of enemyHits) {
    const enemy = findEnemyFromObject(hit.object);

    if (enemy?.alive) {
      return {
        enemy,
        point: hit.point.clone(),
      };
    }
  }

  return null;
}

function getPointedInteractable(raycaster, getInteractableTargets) {
  const interactableTargets =
    typeof getInteractableTargets === "function" ? getInteractableTargets() : [];
  const hits = raycaster.intersectObjects(interactableTargets, true);

  for (const hit of hits) {
    if (findInteractableFromObject(hit.object)) return true;
  }

  return false;
}

function findEnemyFromObject(object) {
  let current = object;

  while (current) {
    if (current.userData?.enemy) {
      return current.userData.enemy;
    }

    current = current.parent;
  }

  return null;
}

function findInteractableFromObject(object) {
  let current = object;

  while (current) {
    if (current.userData?.interactable) {
      return current.userData.interactable;
    }

    current = current.parent;
  }

  return null;
}

export function setupInventoryInput(onUseSlot) {
  window.addEventListener("keydown", (event) => {
    if (event.repeat) return;

    const slotIndex = Number(event.key) - 1;
    if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex > 8) return;

    onUseSlot(slotIndex);
  });
}
