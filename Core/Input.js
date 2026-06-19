import * as THREE from "three";

const CURSOR_ICONS = {
  movement: "Assets/Icons/MovementIcon.png",
  attack: "Assets/Icons/AttackIcon.png",
  interactable: "Assets/Icons/InteractableIcon.png",
  interactableActive: "Assets/Icons/InteractableIconActive.png",
};

const MOVEMENT_CURSOR = `url("${CURSOR_ICONS.movement}") 4 3, auto`;
const AIM_ASSIST_RADIUS_PX = 66;
const AIM_ASSIST_MAX_OFFSET_PX = 28;
const AIM_ASSIST_STRENGTH = 0.52;
const AIM_ASSIST_SMOOTHING = 0.26;
const AIM_ASSIST_POINTER_SNAP_DELTA_PX = 72;
const AIM_ASSIST_TARGET_HEIGHT_RATIO = 0.56;
const AIM_ASSIST_GROUND_Y = 0;
const KEYBOARD_MOVEMENT_DIRECTIONS = {
  KeyW: { screenX: 0, screenY: 1 },
  KeyA: { screenX: -1, screenY: 0 },
  KeyS: { screenX: 0, screenY: -1 },
  KeyD: { screenX: 1, screenY: 0 },
};
const KEYBOARD_INPUT_TAGS_TO_IGNORE = new Set([
  "INPUT",
  "SELECT",
  "TEXTAREA",
]);
const DASH_KEY_CODE = "Space";

export function setupInput(
  renderer,
  camera,
  floor,
  getEnemyTargets,
  getInteractableTargets,
  onClick,
  options = {}
) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const cursorOverlay = createCursorOverlay(renderer.domElement);
  const keyboardMovement = createKeyboardMovementState();
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
    previousClientX: 0,
    previousClientY: 0,
    pointerDeltaPx: 0,
    assistOffsetX: 0,
    assistOffsetY: 0,
    assistOffsetInitialized: false,
  };

  renderer.domElement.style.cursor = MOVEMENT_CURSOR;

  renderer.domElement.addEventListener("pointermove", (event) => {
    updatePointerState(pointerState, event);
    updateCursor();
  });

  renderer.domElement.addEventListener("pointerleave", () => {
    pointerState.inside = false;
    resetCursorAssistOffset(pointerState);
    hideCursorOverlay(renderer.domElement, cursorOverlay);
    options.onInteractableHover?.(null);
  });

  renderer.domElement.addEventListener("pointerdown", (event) => {
    updatePointerState(pointerState, event);
    updatePointer(event, renderer, camera, raycaster, pointer);
    const pointerTarget = resolvePointerTarget(
      raycaster,
      pointerState,
      renderer,
      camera,
      getEnemyTargets,
      getInteractableTargets
    );

    if (pointerTarget.intent === "interactable" && pointerTarget.groundPoint) {
      onClick({
        point: pointerTarget.groundPoint,
        interactable: pointerTarget.interactable,
      });
      return;
    }

    if (pointerTarget.intent === "attack" && pointerTarget.groundPoint) {
      onClick({
        point: pointerTarget.groundPoint,
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
    const pointerTarget = resolvePointerTarget(
      raycaster,
      pointerState,
      renderer,
      camera,
      getEnemyTargets,
      getInteractableTargets
    );
    const hoveredInteractable = pointerTarget.interactable ?? null;
    const hoveredInteractableActive = hoveredInteractable
      ? Boolean(options.isInteractableCursorActive?.(hoveredInteractable))
      : false;
    const hoverIntent = pointerTarget.intent === "interactable"
      ? hoveredInteractableActive
        ? "interactableActive"
        : "interactable"
      : pointerTarget.intent === "attack"
        ? "attack"
        : null;
    options.onInteractableHover?.(
      hoveredInteractable,
      {
        clientX: pointerState.clientX,
        clientY: pointerState.clientY,
      }
    );
    updateCursorOverlay(
      pointerState,
      renderer.domElement,
      cursorOverlay,
      hoverIntent,
      pointerTarget.assistTarget,
      attackFeedback
    );
  };

  const handleKeyDown = (event) => {
    if (isDashKeyboardEvent(event)) {
      if (shouldIgnoreKeyboardInput(event)) return;

      event.preventDefault();
      if (!event.repeat) {
        options.onDashPressed?.();
      }
      return;
    }

    if (!isKeyboardMovementEvent(event)) return;
    if (shouldIgnoreKeyboardInput(event)) return;

    const wasMoving = hasKeyboardMovementInput(keyboardMovement);
    keyboardMovement.pressedCodes.add(event.code);
    event.preventDefault();

    if (!wasMoving && hasKeyboardMovementInput(keyboardMovement)) {
      options.onKeyboardMovementStart?.();
    }
  };

  const handleKeyUp = (event) => {
    if (isDashKeyboardEvent(event)) {
      event.preventDefault();
      return;
    }

    if (!isKeyboardMovementEvent(event)) return;

    keyboardMovement.pressedCodes.delete(event.code);
    event.preventDefault();
  };

  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
  window.addEventListener("blur", () => keyboardMovement.pressedCodes.clear());

  return {
    updateCursor,
    setAttackFeedback(feedback = {}) {
      Object.assign(attackFeedback, feedback);
    },
    getMovementInput() {
      return getKeyboardMovementInput(keyboardMovement, camera);
    },
    getPointerWorldPoint() {
      return getPointerWorldPoint(
        pointerState,
        renderer,
        camera,
        raycaster,
        pointer,
        floor
      );
    },
  };
}

function createKeyboardMovementState() {
  return {
    pressedCodes: new Set(),
  };
}

function isKeyboardMovementEvent(event) {
  return Object.prototype.hasOwnProperty.call(
    KEYBOARD_MOVEMENT_DIRECTIONS,
    event.code
  );
}

function isDashKeyboardEvent(event) {
  return event.code === DASH_KEY_CODE;
}

function shouldIgnoreKeyboardInput(event) {
  if (event.altKey || event.ctrlKey || event.metaKey) return true;

  const target = event.target;
  if (!target) return false;
  if (target.isContentEditable) return true;

  return KEYBOARD_INPUT_TAGS_TO_IGNORE.has(target.tagName);
}

function hasKeyboardMovementInput(keyboardMovement) {
  return getKeyboardScreenMovementInput(keyboardMovement).lengthSq() > 0;
}

function getKeyboardMovementInput(keyboardMovement, camera) {
  const screenDirection = getKeyboardScreenMovementInput(keyboardMovement);
  if (screenDirection.lengthSq() <= 0.000001) return new THREE.Vector3();

  const screenAxes = getCameraScreenGroundAxes(camera);
  const worldDirection = new THREE.Vector3()
    .addScaledVector(screenAxes.right, screenDirection.x)
    .addScaledVector(screenAxes.up, screenDirection.y);

  if (worldDirection.lengthSq() > 1) {
    worldDirection.normalize();
  }

  return worldDirection;
}

function getKeyboardScreenMovementInput(keyboardMovement) {
  const direction = new THREE.Vector2();

  for (const code of keyboardMovement.pressedCodes) {
    const keyDirection = KEYBOARD_MOVEMENT_DIRECTIONS[code];
    if (!keyDirection) continue;

    direction.x += keyDirection.screenX;
    direction.y += keyDirection.screenY;
  }

  if (direction.lengthSq() > 1) {
    direction.normalize();
  }

  return direction;
}

function getCameraScreenGroundAxes(camera) {
  camera.updateMatrixWorld();

  const right = getGroundDirectionFromCameraColumn(camera, 0);
  let up = getGroundDirectionFromCameraColumn(camera, 1);

  if (up.lengthSq() <= 0.000001) {
    camera.getWorldDirection(up);
    up.y = 0;
    up.multiplyScalar(-1);
  }

  if (up.lengthSq() <= 0.000001) {
    up.set(0, 0, -1);
  } else {
    up.normalize();
  }

  return {
    right: right.lengthSq() > 0.000001
      ? right.normalize()
      : new THREE.Vector3(1, 0, 0),
    up,
  };
}

function getGroundDirectionFromCameraColumn(camera, columnIndex) {
  const elements = camera.matrixWorld.elements;
  const offset = columnIndex * 4;

  return new THREE.Vector3(
    elements[offset],
    0,
    elements[offset + 2]
  );
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

    .game-cursor-overlay.is-interactable-active {
      animation: interactableActiveCursorMotion 880ms ease-in-out infinite alternate;
    }

    .game-cursor-overlay.is-interactable-active .game-cursor-overlay__icon {
      animation: interactableActiveIconGlow 880ms ease-in-out infinite alternate;
    }

    @keyframes attackCursorMotion {
      from { --cursor-rotation: -2deg; }
      to { --cursor-rotation: 2deg; }
    }

    @keyframes interactableCursorMotion {
      from { translate: 0 -1px; }
      to { translate: 0 3px; }
    }

    @keyframes interactableActiveCursorMotion {
      from { translate: 0 -0.5px; }
      to { translate: 0 0.5px; }
    }

    @keyframes interactableActiveIconGlow {
      from { filter: drop-shadow(0 0 0 rgba(255, 255, 255, 0)); }
      to { filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.36)); }
    }

    @media (prefers-reduced-motion: reduce) {
      .game-cursor-overlay.is-attack,
      .game-cursor-overlay.is-interactable,
      .game-cursor-overlay.is-interactable-active,
      .game-cursor-overlay.is-interactable-active .game-cursor-overlay__icon {
        animation: none;
      }
    }
  `;

  document.head.appendChild(style);
}

function updateCursorOverlay(
  pointerState,
  canvas,
  overlay,
  hoverIntent,
  assistTarget,
  attackFeedback
) {
  const showAttackCooldown = isAttackCooldownVisible(attackFeedback);
  const cursorIntent = showAttackCooldown ? "attack" : hoverIntent;

  if (!cursorIntent) {
    resetCursorAssistOffset(pointerState);
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
  overlay.classList.toggle(
    "is-interactable-active",
    cursorIntent === "interactableActive"
  );
  updateAttackIndicator(overlay, attackFeedback, cursorIntent);
  const cursorPosition = getCursorOverlayPosition(pointerState, assistTarget);
  overlay.classList.add("is-active");
  overlay.style.setProperty("--cursor-x", `${cursorPosition.x}px`);
  overlay.style.setProperty("--cursor-y", `${cursorPosition.y}px`);
  canvas.style.cursor = "none";
}

function getCursorOverlayPosition(pointerState, assistTarget) {
  const targetOffset = getCursorAssistOffset(pointerState, assistTarget);
  const pointerDelta = pointerState.pointerDeltaPx;

  if (pointerDelta > AIM_ASSIST_POINTER_SNAP_DELTA_PX) {
    pointerState.assistOffsetX = targetOffset.x;
    pointerState.assistOffsetY = targetOffset.y;
    pointerState.assistOffsetInitialized = true;
  } else {
    pointerState.assistOffsetInitialized = true;
    pointerState.assistOffsetX = THREE.MathUtils.lerp(
      pointerState.assistOffsetX,
      targetOffset.x,
      AIM_ASSIST_SMOOTHING
    );
    pointerState.assistOffsetY = THREE.MathUtils.lerp(
      pointerState.assistOffsetY,
      targetOffset.y,
      AIM_ASSIST_SMOOTHING
    );
  }
  pointerState.pointerDeltaPx = 0;

  return {
    x: pointerState.clientX + pointerState.assistOffsetX,
    y: pointerState.clientY + pointerState.assistOffsetY,
  };
}

function getCursorAssistOffset(pointerState, assistTarget) {
  if (!assistTarget) return { x: 0, y: 0 };

  const offsetX = assistTarget.clientX - pointerState.clientX;
  const offsetY = assistTarget.clientY - pointerState.clientY;
  const distance = Math.hypot(offsetX, offsetY);

  if (distance <= 0.001) return { x: 0, y: 0 };

  const assistFalloff = 1 - Math.min(1, distance / AIM_ASSIST_RADIUS_PX);
  const assistedDistance = Math.min(
    distance * AIM_ASSIST_STRENGTH * assistFalloff,
    AIM_ASSIST_MAX_OFFSET_PX
  );
  const assistScale = assistedDistance / distance;

  return {
    x: offsetX * assistScale,
    y: offsetY * assistScale,
  };
}

function getCursorIcon(cursorIntent) {
  switch (cursorIntent) {
    case "attack":
      return CURSOR_ICONS.attack;

    case "interactable":
      return CURSOR_ICONS.interactable;

    case "interactableActive":
      return CURSOR_ICONS.interactableActive;

    default:
      return CURSOR_ICONS.movement;
  }
}

function hideCursorOverlay(canvas, overlay) {
  overlay.classList.remove(
    "is-active",
    "is-attack",
    "is-interactable",
    "is-interactable-active",
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

function getPointerWorldPoint(
  pointerState,
  renderer,
  camera,
  raycaster,
  pointer,
  floor
) {
  if (!pointerState.inside || !floor) return null;

  updatePointerFromClientPosition(
    pointerState.clientX,
    pointerState.clientY,
    renderer,
    camera,
    raycaster,
    pointer
  );

  const hits = raycaster.intersectObject(floor);

  return hits[0]?.point?.clone?.() ?? null;
}

function updatePointerState(pointerState, event) {
  const wasInside = pointerState.inside;

  pointerState.previousClientX = wasInside
    ? pointerState.clientX
    : event.clientX;
  pointerState.previousClientY = wasInside
    ? pointerState.clientY
    : event.clientY;
  pointerState.inside = true;
  pointerState.clientX = event.clientX;
  pointerState.clientY = event.clientY;
  pointerState.pointerDeltaPx = Math.hypot(
    pointerState.clientX - pointerState.previousClientX,
    pointerState.clientY - pointerState.previousClientY
  );
}

function resetCursorAssistOffset(pointerState) {
  pointerState.assistOffsetX = 0;
  pointerState.assistOffsetY = 0;
  pointerState.assistOffsetInitialized = false;
  pointerState.pointerDeltaPx = 0;
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

function resolvePointerTarget(
  raycaster,
  pointerState,
  renderer,
  camera,
  getEnemyTargets,
  getInteractableTargets
) {
  const directInteractableHit = getPointedInteractableHit(
    raycaster,
    getInteractableTargets
  );

  if (directInteractableHit) {
    return {
      intent: "interactable",
      interactable: directInteractableHit.interactable,
      groundPoint: directInteractableHit.groundPoint,
      assistTarget: null,
    };
  }

  const directEnemyHit = getPointedEnemyHit(raycaster, getEnemyTargets);

  if (directEnemyHit) {
    return {
      intent: "attack",
      enemy: directEnemyHit.enemy,
      groundPoint: getGroundPoint(directEnemyHit.point),
      assistTarget: null,
    };
  }

  const assistTarget = getAimAssistTarget(
    pointerState,
    renderer,
    camera,
    getEnemyTargets,
    getInteractableTargets
  );

  if (assistTarget?.intent === "interactable" && assistTarget.groundPoint) {
    return {
      intent: "interactable",
      interactable: assistTarget.interactable,
      groundPoint: assistTarget.groundPoint,
      assistTarget,
    };
  }

  if (
    assistTarget?.intent === "attack" &&
    assistTarget.enemy?.alive &&
    assistTarget.groundPoint
  ) {
    return {
      intent: "attack",
      enemy: assistTarget.enemy,
      groundPoint: assistTarget.groundPoint,
      assistTarget,
    };
  }

  return {
    intent: null,
    interactable: null,
    enemy: null,
    groundPoint: null,
    assistTarget: null,
  };
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

function getPointedInteractableHit(raycaster, getInteractableTargets) {
  const interactableTargets =
    typeof getInteractableTargets === "function" ? getInteractableTargets() : [];
  const hits = raycaster.intersectObjects(interactableTargets, true);

  for (const hit of hits) {
    const interactable = findInteractableFromObject(hit.object);

    if (interactable) {
      const targetRoot = findInteractableRoot(hit.object);
      const groundPoint = getGroundPoint(
        targetRoot ? getObjectAimPoint(targetRoot) : hit.point
      );

      return {
        interactable,
        object: targetRoot ?? hit.object,
        point: hit.point.clone(),
        groundPoint,
      };
    }
  }

  return null;
}

function getAimAssistTarget(
  pointerState,
  renderer,
  camera,
  getEnemyTargets,
  getInteractableTargets
) {
  if (!pointerState.inside) return null;

  const bounds = renderer.domElement.getBoundingClientRect();
  const candidates = [
    ...getInteractableAimAssistCandidates(getInteractableTargets),
    ...getEnemyAimAssistCandidates(getEnemyTargets),
  ];
  let bestTarget = null;

  for (const candidate of candidates) {
    if (!candidate.object?.visible) continue;

    const aimPoint = getObjectAimPoint(candidate.object);
    const screenPoint = getClientPointFromWorld(aimPoint, camera, bounds);
    if (!screenPoint) continue;

    const distance = Math.hypot(
      screenPoint.x - pointerState.clientX,
      screenPoint.y - pointerState.clientY
    );

    if (distance > AIM_ASSIST_RADIUS_PX) continue;

    const score =
      distance / AIM_ASSIST_RADIUS_PX +
      (candidate.intent === "interactable" ? -0.08 : 0);

    if (bestTarget && score >= bestTarget.score) continue;

    bestTarget = {
      ...candidate,
      score,
      clientX: screenPoint.x,
      clientY: screenPoint.y,
      point: aimPoint,
      groundPoint: getGroundPoint(aimPoint),
    };
  }

  return bestTarget;
}

function getEnemyAimAssistCandidates(getEnemyTargets) {
  const enemyTargets =
    typeof getEnemyTargets === "function" ? getEnemyTargets() : [];

  return enemyTargets
    .map((object) => ({
      intent: "attack",
      object,
      enemy: findEnemyFromObject(object),
    }))
    .filter((candidate) => candidate.enemy?.alive);
}

function getInteractableAimAssistCandidates(getInteractableTargets) {
  const interactableTargets =
    typeof getInteractableTargets === "function" ? getInteractableTargets() : [];
  const assistedTypes = new Set(["chest", "shop", "shopFountain", "itemDrop"]);

  return interactableTargets
    .map((object) => ({
      intent: "interactable",
      object,
      interactable: findInteractableFromObject(object),
    }))
    .filter((candidate) => assistedTypes.has(candidate.interactable?.type));
}

function getClientPointFromWorld(worldPoint, camera, bounds) {
  const projected = worldPoint.clone().project(camera);

  if (
    projected.z < -1 ||
    projected.z > 1 ||
    !Number.isFinite(projected.x) ||
    !Number.isFinite(projected.y)
  ) {
    return null;
  }

  return {
    x: bounds.left + ((projected.x + 1) / 2) * bounds.width,
    y: bounds.top + ((1 - projected.y) / 2) * bounds.height,
  };
}

function getObjectAimPoint(object) {
  const box = new THREE.Box3().setFromObject(object);

  if (!isFiniteBox(box)) {
    const position = new THREE.Vector3();
    object.getWorldPosition(position);
    return position;
  }

  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());

  center.y = box.min.y + size.y * AIM_ASSIST_TARGET_HEIGHT_RATIO;

  return center;
}

function getGroundPoint(point) {
  return new THREE.Vector3(point.x, AIM_ASSIST_GROUND_Y, point.z);
}

function isFiniteBox(box) {
  return Number.isFinite(box.min.x) &&
    Number.isFinite(box.min.y) &&
    Number.isFinite(box.min.z) &&
    Number.isFinite(box.max.x) &&
    Number.isFinite(box.max.y) &&
    Number.isFinite(box.max.z);
}

function findInteractableRoot(object) {
  let current = object;

  while (current) {
    if (current.userData?.interactable) {
      return current;
    }

    current = current.parent;
  }

  return null;
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

export function setupInventoryInput(onUseSlot, options = {}) {
  window.addEventListener("keydown", (event) => {
    if (event.repeat) return;
    if (isEditableInputTarget(event.target)) return;

    if (event.key?.toLowerCase() === "c") {
      event.preventDefault();
      options.onToggleInventory?.();
      return;
    }

    const slotIndex = Number(event.key) - 1;
    if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex > 8) return;

    onUseSlot(slotIndex);
  });
}

function isEditableInputTarget(target) {
  if (!target) return false;

  const tagName = target.tagName?.toLowerCase();
  return (
    target.isContentEditable ||
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select"
  );
}
