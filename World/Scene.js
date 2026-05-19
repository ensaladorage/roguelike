import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { EnemyAI } from "./EnemyAI.js";
import { Player } from "../Core/Player.js";
import { setupInput } from "../Core/Input.js";
import { GameManager } from "../Game/GameManager.js";
import { flatDistance } from "../Game/Utils.js";
import { HUD } from "../UI/HUD.js";
import { SFX } from "../UI/SFX.js";
import { ChestManager } from "./Chest.js";
import { CoinManager } from "./Coin.js";
import { Environment } from "./Environment.js";
import { HANDCRAFTED_LEVELS } from "../Data/handcraftedLevels.js";
import { ROOM_TEMPLATES } from "../Data/roomTemplates.js";
import {
  DEFAULT_ENEMY_MODEL_ID,
  DEFAULT_PLAYER_MODEL_ID,
  MODEL_TEXTURE_DEFINITIONS,
  getModelDefinitionsToPreload,
} from "../Data/modelDefinitions.js";
import { RoomTemplateLibrary } from "./RoomTemplateLibrary.js";
import { LevelBuilder } from "./LevelBuilder.js";
import { ModularTileBuilder } from "./ModularTileBuilder.js";

const PLAYER_GROUND_Y = 0;
const PLAYER_COLLISION_RADIUS = 0.32;
const ENEMY_COLLISION_RADIUS = 0.32;
const NAV_GRID_SIZE = 0.7;

export class GameScene {
  constructor(container) {
    this.container = container;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x111317);

    this.environment = new Environment(this);
    this.chestManager = new ChestManager(this);
    this.coinManager = new CoinManager(this);
    this.models = {};
    this.levelDefinitions = HANDCRAFTED_LEVELS;
    this.roomTemplateLibrary = new RoomTemplateLibrary(ROOM_TEMPLATES);
    this.levelBuilder = new LevelBuilder({
      roomTemplateLibrary: this.roomTemplateLibrary,
    });
    this.modularTileBuilder = new ModularTileBuilder(this);

    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    this.camera.position.set(7.5, 8.5, 9.5);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    container.appendChild(this.renderer.domElement);

    this.clock = new THREE.Clock();
    this.floorSize = 48;
    this.levelIndex = 0;
    this.levelGroup = new THREE.Group();
    this.scene.add(this.levelGroup);

    this.enemy = null;
    this.enemies = [];
    this.chests = [];
    this.walkableAreas = [];
    this.collisionWalls = [];
    this.wallMeshes = [];
    this.navBounds = null;
    this.exitButton = null;
    this.clickEffects = [];
    this.feedbackEffects = [];

    this.hud = new HUD();
    this.sfx = new SFX();
    this.gameManager = new GameManager(this);

    this.init();
  }

  async init() {
    this.environment.setup();
    this.addFloor();

    try {
      await Promise.all([
        this.loadGameModels(),
        this.preloadEnvironmentTileSets(),
      ]);
    } catch (err) {
      console.error("initial asset load failed", err);
      this.addLog("Assets de entorno o personajes con fallback activo.");
    }

    try {
      await this.createPlayer();
    } catch (err) {
      console.error("createPlayer failed", err);
      this.addLog("Error creando player: " + (err.message || err));
    }

    this.loadLevel(0);

    setupInput(this.renderer, this.camera, this.floor, (point) => {
      this.createClickFeedback(point);

      const pos = this.getWalkableTarget(point);
      if (!pos) return;

      const path = this.findNavigationPath(
        this.player.model.position,
        new THREE.Vector3(pos.x, PLAYER_GROUND_Y, pos.z)
      );

      if (path.length > 0) {
        this.player.setPath(path);
      }
    });

    window.addEventListener("resize", () => this.onResize());
    this.animate();
  }

  async preloadEnvironmentTileSets() {
    const tileSetIds = [
      ...new Set(
        this.levelDefinitions.map(
          (level) => level.tileSetId ?? "scenarioDefault"
        )
      ),
    ];

    await Promise.all(
      tileSetIds.map((tileSetId) =>
        this.modularTileBuilder.preloadTileSet(tileSetId)
      )
    );
  }

  async loadGameModels() {
    const loader = new GLTFLoader();
    const texLoader = new THREE.TextureLoader();

    const loadTextureAsync = (url) =>
      new Promise((resolve, reject) => {
        texLoader.load(url, (tex) => resolve(tex), undefined, (err) => reject(err));
      });

    const loadTextureWithFallback = async (textureDefinition) => {
      try {
        return await loadTextureAsync(textureDefinition.primaryPath);
      } catch (primaryError) {
        try {
          return await loadTextureAsync(textureDefinition.fallbackPath);
        } catch (fallbackError) {
          throw fallbackError;
        }
      }
    };

    const textureEntries = await Promise.all(
      Object.values(MODEL_TEXTURE_DEFINITIONS).map(async (textureDefinition) => {
        const texture = await loadTextureWithFallback(textureDefinition);

        texture.flipY = false;
        texture.colorSpace = THREE.SRGBColorSpace;

        return [textureDefinition.id, texture];
      })
    );

    const textures = Object.fromEntries(textureEntries);

    const applyTexture = (gltf, tex) => {
      if (!gltf?.scene) return;

      gltf.scene.traverse((node) => {
        if (!node.isMesh || !node.material) return;

        const applyMaterial = (material) => {
          try {
            if (material.map !== tex) {
              material.map = tex;
            }

            if (material.map) material.map.needsUpdate = true;
            material.needsUpdate = true;
          } catch (error) {}
        };

        if (Array.isArray(node.material)) {
          node.material.forEach(applyMaterial);
        } else {
          applyMaterial(node.material);
        }
      });
    };

    const modelEntries = await Promise.all(
      getModelDefinitionsToPreload().map(async (modelDefinition) => {
        const gltf = await loader.loadAsync(modelDefinition.assetPath);
        const texture = textures[modelDefinition.textureId];

        if (texture) applyTexture(gltf, texture);
        this.prepareModelForScene(gltf.scene);

        return [modelDefinition.id, { definition: modelDefinition, gltf }];
      })
    );

    this.models.byId = Object.fromEntries(modelEntries);
    this.models.textures = textures;
    this.models.loaded = true;
  }

  prepareModelForScene(model) {
    if (!model) return;

    model.traverse((node) => {
      if (!node.isMesh) return;

      node.castShadow = true;
      node.receiveShadow = true;

      if (node.material?.map) {
        node.material.map.colorSpace = THREE.SRGBColorSpace;
      }

      if (node.material?.isMeshStandardMaterial || node.material?.isMeshPhysicalMaterial) {
        node.material.metalness = 0;
        node.material.roughness = Math.max(node.material.roughness ?? 1, 0.7);
        node.material.needsUpdate = true;
      }
    });
  }

  cloneGameModel(modelId) {
    const modelEntry = this.models.byId?.[modelId];
    if (!this.models.loaded || !modelEntry?.gltf?.scene) return null;

    const cloned = SkeletonUtils.clone(modelEntry.gltf.scene);
    const scale = modelEntry.definition.scale ?? 1;

    cloned.scale.set(scale, scale, scale);
    this.prepareModelForScene(cloned);

    return cloned;
  }

  addFloor() {
    const material = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      colorWrite: false,
    });

    this.floor = new THREE.Mesh(
      new THREE.PlaneGeometry(this.floorSize, this.floorSize),
      material
    );
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.receiveShadow = false;
    this.scene.add(this.floor);
  }

  updateFloorPlane(size) {
    this.floorSize = size;
    this.floor.geometry.dispose();
    this.floor.geometry = new THREE.PlaneGeometry(size, size);
  }

  async createPlayer() {
    let playerModel = null;
    const playerModelId = DEFAULT_PLAYER_MODEL_ID;

    if (this.models?.loaded) {
      try {
        playerModel = this.cloneGameModel(playerModelId);
      } catch (error) {
        console.warn(`Failed to clone player model ${playerModelId}:`, error);
      }
    }

    if (!playerModel) {
      playerModel = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.35, 0.72),
        new THREE.MeshStandardMaterial({ color: 0x5ecf79 })
      );
      playerModel.castShadow = true;
      playerModel.receiveShadow = true;
    }

    const playerRoot = new THREE.Group();
    playerRoot.position.y = PLAYER_GROUND_Y;
    playerRoot.add(playerModel);

    this.scene.add(playerRoot);
    this.player = new Player(playerRoot);
  }

  loadLevel(levelIndex) {
    const definition = this.levelDefinitions[levelIndex];
    if (!definition) return;

    const level = this.levelBuilder.build(definition);
    if (!level) return;

    this.levelIndex = levelIndex;
    this.levelGroup.clear();
    this.enemy = null;
    this.enemies = [];
    this.chests = [];
    if (this.coinManager) this.coinManager.clear();
    this.walkableAreas = [];
    this.collisionWalls = [];
    this.wallMeshes = [];
    this.navBounds = null;
    this.exitButton = null;
    this.clickEffects = [];
    this.feedbackEffects = [];

    this.updateFloorPlane(level.floorSize ?? 48);
    this.addLevelGeometry(level);
    this.chestManager.load(level);
    this.addLevelEnemies(level);
    this.placePlayer(level.playerStart);

    this.gameManager.setLevel(levelIndex);
    this.updateHud();
    this.addLog(`${level.name} cargado.`);
    console.log("levelLoaded", { level: levelIndex + 1, name: level.name });
  }

  placePlayer(position) {
    this.player.model.position.set(position.x, PLAYER_GROUND_Y, position.z);
    this.player.groundY = PLAYER_GROUND_Y;
    this.player.model.visible = true;
    this.player.currentEnemy = null;
    this.player.clearTarget();
  }

  addLevelGeometry(level) {
    this.walkableAreas = (level.walkableAreas ?? []).map((area) => ({ ...area }));
    this.collisionWalls = (level.collisionWalls ?? []).map((wall) => ({ ...wall }));
    this.navBounds = this.calculateNavBounds(this.walkableAreas);

    const environmentBuild = this.modularTileBuilder.buildLevel(level.environment);
    this.wallMeshes = environmentBuild.wallMeshes;

    if (level.exit?.x !== undefined && level.exit?.z !== undefined) {
      this.addExitButton(level.exit);
    }
  }

  addExitButton(exit) {
    const group = new THREE.Group();

    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x20262a,
      roughness: 0.75,
    });

    const buttonMat = new THREE.MeshStandardMaterial({
      color: 0xd7b857,
      emissive: 0x3f2e08,
      roughness: 0.55,
    });

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.82, 0.82, 0.08, 32),
      baseMat
    );
    base.position.y = 0.04;
    group.add(base);

    const button = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.62, 0.1, 32),
      buttonMat
    );
    button.position.y = 0.13;
    group.add(button);

    group.position.set(exit.x, 0, exit.z);
    this.levelGroup.add(group);

    this.exitButton = {
      group,
      button,
      disabled: Boolean(exit.disabled),
      activated: false,
    };
  }

  addLevelEnemies(level) {
    this.enemies = (level.enemies ?? []).map((data) => this.createEnemy(data));
    this.enemy = this.enemies[0] ?? null;
  }

  createEnemy(data) {
    let enemyModel = null;
    const enemyModelId = data.modelId ?? DEFAULT_ENEMY_MODEL_ID;

    if (this.models.loaded) {
      enemyModel = this.cloneGameModel(enemyModelId);
    }

    if (!enemyModel) {
      console.warn(`Enemy model ${enemyModelId} is not loaded. Using fallback.`);
      enemyModel = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 1.2, 0.8),
        new THREE.MeshStandardMaterial({ color: 0xb74343 })
      );
      enemyModel.castShadow = true;
      enemyModel.receiveShadow = true;
    }

    const enemyRoot = new THREE.Group();
    enemyRoot.position.set(data.x, 0, data.z);
    enemyRoot.add(enemyModel);
    this.levelGroup.add(enemyRoot);

    const patrolPoints = (data.patrol ?? [{ x: data.x, z: data.z }]).map(
      (point) => new THREE.Vector3(point.x, 0.6, point.z)
    );

    return new EnemyAI(enemyRoot, patrolPoints, {
      collisionRadius: ENEMY_COLLISION_RADIUS,
      patrolAreas: data.patrolAreas,
      navigation: this.createEnemyNavigation(),
    });
  }

  createEnemyNavigation() {
    return {
      canMoveBetween: (from, to, radius) =>
        this.canMoveBetween(from, to, radius),
      findPath: (from, to, radius) =>
        this.findNavigationPath(from, to, radius),
      getRandomWalkablePoint: (areas, radius, origin) =>
        this.getRandomWalkablePoint(areas, radius, origin),
    };
  }

  createClickFeedback(position) {
    const material = new THREE.MeshBasicMaterial({
      color: 0x63d982,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(0.32, 0.39, 48),
      material
    );

    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(position.x, 0.07, position.z);
    mesh.renderOrder = 40;

    this.levelGroup.add(mesh);
    this.clickEffects.push({
      mesh,
      material,
      elapsed: 0,
      duration: 0.75,
    });
  }

  calculateNavBounds(areas) {
    if (areas.length === 0) return null;

    return areas.reduce(
      (bounds, area) => ({
        minX: Math.min(bounds.minX, area.x - area.w / 2),
        maxX: Math.max(bounds.maxX, area.x + area.w / 2),
        minZ: Math.min(bounds.minZ, area.z - area.d / 2),
        maxZ: Math.max(bounds.maxZ, area.z + area.d / 2),
      }),
      {
        minX: Infinity,
        maxX: -Infinity,
        minZ: Infinity,
        maxZ: -Infinity,
      }
    );
  }

  findNavigationPath(from, to, radius = PLAYER_COLLISION_RADIUS) {
    if (!this.navBounds) return [];

    if (this.canMoveBetween(from, to, radius)) {
      return [to.clone()];
    }

    const start = this.worldToNavCell(from);
    const goal = this.worldToNavCell(to);

    if (!this.isNavCellWalkable(start, radius)) return [];
    if (!this.isNavCellWalkable(goal, radius)) return [];

    const open = [start];
    const cameFrom = new Map();
    const gScore = new Map([[this.navCellKey(start), 0]]);
    const fScore = new Map([
      [this.navCellKey(start), this.navHeuristic(start, goal)],
    ]);
    const closed = new Set();

    while (open.length > 0) {
      open.sort(
        (a, b) =>
          (fScore.get(this.navCellKey(a)) ?? Infinity) -
          (fScore.get(this.navCellKey(b)) ?? Infinity)
      );

      const current = open.shift();
      const currentKey = this.navCellKey(current);

      if (current.x === goal.x && current.z === goal.z) {
        return this.simplifyNavigationPath(
          this.reconstructNavigationPath(cameFrom, current).concat(to.clone()),
          from,
          radius
        );
      }

      closed.add(currentKey);

      for (const neighbor of this.getNavNeighbors(current, radius)) {
        const neighborKey = this.navCellKey(neighbor);
        if (closed.has(neighborKey)) continue;

        const tentativeG =
          (gScore.get(currentKey) ?? Infinity) +
          this.navStepCost(current, neighbor);

        if (tentativeG >= (gScore.get(neighborKey) ?? Infinity)) {
          continue;
        }

        cameFrom.set(neighborKey, current);
        gScore.set(neighborKey, tentativeG);
        fScore.set(
          neighborKey,
          tentativeG + this.navHeuristic(neighbor, goal)
        );

        if (!open.some((cell) => this.navCellKey(cell) === neighborKey)) {
          open.push(neighbor);
        }
      }
    }

    return [];
  }

  worldToNavCell(position) {
    return {
      x: Math.round((position.x - this.navBounds.minX) / NAV_GRID_SIZE),
      z: Math.round((position.z - this.navBounds.minZ) / NAV_GRID_SIZE),
    };
  }

  navCellToWorld(cell) {
    return new THREE.Vector3(
      this.navBounds.minX + cell.x * NAV_GRID_SIZE,
      PLAYER_GROUND_Y,
      this.navBounds.minZ + cell.z * NAV_GRID_SIZE
    );
  }

  isNavCellWalkable(cell, radius = PLAYER_COLLISION_RADIUS) {
    const position = this.navCellToWorld(cell);
    return this.isWalkablePosition(position, radius);
  }

  getNavNeighbors(cell, radius = PLAYER_COLLISION_RADIUS) {
    const neighbors = [];
    const directions = [
      { x: 1, z: 0 },
      { x: -1, z: 0 },
      { x: 0, z: 1 },
      { x: 0, z: -1 },
      { x: 1, z: 1 },
      { x: 1, z: -1 },
      { x: -1, z: 1 },
      { x: -1, z: -1 },
    ];

    for (const dir of directions) {
      const neighbor = {
        x: cell.x + dir.x,
        z: cell.z + dir.z,
      };

      if (!this.isNavCellInBounds(neighbor)) continue;
      if (!this.isNavCellWalkable(neighbor, radius)) continue;

      const currentWorld = this.navCellToWorld(cell);
      const neighborWorld = this.navCellToWorld(neighbor);

      if (!this.canMoveBetween(currentWorld, neighborWorld, radius)) continue;

      if (
        dir.x !== 0 &&
        dir.z !== 0 &&
        (!this.isNavCellWalkable({ x: cell.x + dir.x, z: cell.z }, radius) ||
          !this.isNavCellWalkable({ x: cell.x, z: cell.z + dir.z }, radius))
      ) {
        continue;
      }

      neighbors.push(neighbor);
    }

    return neighbors;
  }

  isNavCellInBounds(cell) {
    const position = this.navCellToWorld(cell);

    return (
      position.x >= this.navBounds.minX &&
      position.x <= this.navBounds.maxX &&
      position.z >= this.navBounds.minZ &&
      position.z <= this.navBounds.maxZ
    );
  }

  navCellKey(cell) {
    return `${cell.x},${cell.z}`;
  }

  navHeuristic(a, b) {
    const dx = Math.abs(a.x - b.x);
    const dz = Math.abs(a.z - b.z);
    return Math.hypot(dx, dz);
  }

  navStepCost(a, b) {
    return a.x !== b.x && a.z !== b.z ? Math.SQRT2 : 1;
  }

  reconstructNavigationPath(cameFrom, current) {
    const cells = [current];
    let currentKey = this.navCellKey(current);

    while (cameFrom.has(currentKey)) {
      current = cameFrom.get(currentKey);
      cells.unshift(current);
      currentKey = this.navCellKey(current);
    }

    return cells.slice(1).map((cell) => this.navCellToWorld(cell));
  }

  simplifyNavigationPath(points, from, radius = PLAYER_COLLISION_RADIUS) {
    if (points.length <= 2) return points;

    const simplified = [];
    let anchor = from.clone();
    let index = 0;

    while (index < points.length) {
      let nextIndex = index;

      for (let i = points.length - 1; i >= index; i -= 1) {
        if (this.canMoveBetween(anchor, points[i], radius)) {
          nextIndex = i;
          break;
        }
      }

      const next = points[nextIndex].clone();
      simplified.push(next);
      anchor = next;
      index = nextIndex + 1;
    }

    return simplified;
  }

  getWalkableTarget(point) {
    const target = { x: point.x, z: point.z };
    if (!this.isWalkablePosition(target, PLAYER_COLLISION_RADIUS)) return null;
    return target;
  }

  applyPlayerWorldCollision(previousPosition) {
    const currentPosition = this.player.model.position;

    if (this.canMoveBetween(previousPosition, currentPosition)) {
      return;
    }

    const slidePosition = this.getSlidePosition(
      previousPosition,
      currentPosition
    );

    if (slidePosition) {
      currentPosition.copy(slidePosition);
      return;
    }

    currentPosition.copy(previousPosition);
    this.player.clearTarget();
  }

  getSlidePosition(previousPosition, desiredPosition) {
    const candidates = [
      new THREE.Vector3(
        desiredPosition.x,
        previousPosition.y,
        previousPosition.z
      ),
      new THREE.Vector3(
        previousPosition.x,
        previousPosition.y,
        desiredPosition.z
      ),
    ];

    const validCandidates = candidates.filter((candidate) =>
      this.canMoveBetween(previousPosition, candidate)
    );

    if (validCandidates.length === 0) return null;

    validCandidates.sort(
      (a, b) =>
        a.distanceToSquared(desiredPosition) -
        b.distanceToSquared(desiredPosition)
    );

    return validCandidates[0];
  }

  canMoveBetween(from, to, radius = PLAYER_COLLISION_RADIUS) {
    const target = {
      x: to.x,
      z: to.z,
    };

    return (
      this.isWalkablePosition(target, radius) &&
      !this.movementHitsWall(from, to, radius)
    );
  }

  getRandomWalkablePoint(areas = [], radius = PLAYER_COLLISION_RADIUS, origin = null) {
    const sourceAreas = areas.length > 0 ? areas : this.walkableAreas;
    const validAreas = sourceAreas.filter(
      (area) => area.w > radius * 2 && area.d > radius * 2
    );

    if (validAreas.length === 0) return null;

    for (let i = 0; i < 48; i += 1) {
      const area = validAreas[Math.floor(Math.random() * validAreas.length)];
      const x =
        area.x - area.w / 2 + radius + Math.random() * (area.w - radius * 2);
      const z =
        area.z - area.d / 2 + radius + Math.random() * (area.d - radius * 2);
      const point = new THREE.Vector3(x, PLAYER_GROUND_Y, z);

      if (!this.isWalkablePosition(point, radius)) continue;
      if (origin && flatDistance(origin, point) < radius * 3) continue;

      return point;
    }

    return null;
  }

  isWalkablePosition(position, radius = 0) {
    const insideWalkableArea = this.walkableAreas.some((area) =>
      this.isInsideArea(position, area, radius)
    );

    if (!insideWalkableArea) return false;

    return !this.collisionWalls.some((wall) =>
      this.isInsideWall(position, wall, radius)
    );
  }

  isInsideArea(position, area, radius) {
    return (
      position.x >= area.x - area.w / 2 + radius &&
      position.x <= area.x + area.w / 2 - radius &&
      position.z >= area.z - area.d / 2 + radius &&
      position.z <= area.z + area.d / 2 - radius
    );
  }

  isInsideWall(position, wall, radius) {
    return (
      position.x >= wall.x - wall.w / 2 - radius &&
      position.x <= wall.x + wall.w / 2 + radius &&
      position.z >= wall.z - wall.d / 2 - radius &&
      position.z <= wall.z + wall.d / 2 + radius
    );
  }

  movementHitsWall(from, to, radius) {
    if (from.distanceToSquared(to) <= 0.000001) return false;

    return this.collisionWalls.some((wall) =>
      this.segmentIntersectsWall(from, to, wall, radius)
    );
  }

  segmentIntersectsWall(from, to, wall, radius) {
    const minX = wall.x - wall.w / 2 - radius;
    const maxX = wall.x + wall.w / 2 + radius;
    const minZ = wall.z - wall.d / 2 - radius;
    const maxZ = wall.z + wall.d / 2 + radius;

    const directionX = to.x - from.x;
    const directionZ = to.z - from.z;
    let minT = 0;
    let maxT = 1;

    const xRange = this.clipSegmentAxis(
      from.x,
      directionX,
      minX,
      maxX,
      minT,
      maxT
    );

    if (!xRange) return false;

    minT = xRange.minT;
    maxT = xRange.maxT;

    const zRange = this.clipSegmentAxis(
      from.z,
      directionZ,
      minZ,
      maxZ,
      minT,
      maxT
    );

    return Boolean(zRange);
  }

  clipSegmentAxis(origin, direction, min, max, minT, maxT) {
    if (Math.abs(direction) < 0.000001) {
      if (origin < min || origin > max) return null;
      return { minT, maxT };
    }

    let axisMinT = (min - origin) / direction;
    let axisMaxT = (max - origin) / direction;

    if (axisMinT > axisMaxT) {
      const temp = axisMinT;
      axisMinT = axisMaxT;
      axisMaxT = temp;
    }

    const nextMinT = Math.max(minT, axisMinT);
    const nextMaxT = Math.min(maxT, axisMaxT);

    if (nextMinT > nextMaxT) return null;

    return {
      minT: nextMinT,
      maxT: nextMaxT,
    };
  }

  animate() {
    const delta = this.clock.getDelta();

    this.gameManager.update(delta);

    for (const enemy of this.enemies) {
      enemy.update(delta, this.camera);
    }

    if (this.coinManager) this.coinManager.update(delta);

    const previousPlayerPosition = this.player.model.position.clone();
    this.player.update(delta);
    this.applyPlayerWorldCollision(previousPlayerPosition);

    const events = [
      ...this.player.consumeEvents(),
      ...this.enemies.flatMap((enemy) => enemy.consumeEvents()),
    ];

    this.handleGameEvents(events);
    this.chestManager.update();
    this.checkExitButton();
    this.updateClickEffects(delta);
    this.updateFeedbackEffects(delta);
    this.updateCamera(delta);
    this.player.updateOcclusionMarker(this.camera, this.wallMeshes);
    this.renderer.render(this.scene, this.camera);

    requestAnimationFrame(() => this.animate());
  }

  checkExitButton() {
    if (!this.exitButton || this.exitButton.activated) return;
    if (this.exitButton.disabled) return;

    const distance = flatDistance(
      this.player.model.position,
      this.exitButton.group.position
    );

    if (distance > 0.7) return;

    this.exitButton.activated = true;
    this.exitButton.button.position.y = 0.08;
    this.exitButton.button.material.color.setHex(0x65d67c);
    this.exitButton.button.material.emissive.setHex(0x143d1d);
    this.addLog("Salida activada.");
    console.log("levelExitActivated", {
      from: this.levelIndex + 1,
    });

    this.gameManager.activateLevelExit();
  }

  updateClickEffects(delta) {
    this.clickEffects = this.clickEffects.filter((effect) => {
      effect.elapsed += delta;

      const t = Math.min(1, effect.elapsed / effect.duration);
      const scale = 1 + t * 0.5;

      effect.mesh.scale.set(scale, scale, scale);
      effect.material.opacity = 0.9 * (1 - t);

      if (t < 1) return true;

      effect.mesh.removeFromParent();
      effect.material.dispose();
      effect.mesh.geometry.dispose();
      return false;
    });
  }

  handleGameEvents(events) {
    for (const event of events) {
      this.gameManager.handleEvent(event);
      console.log("gameEvent", event.type);

      switch (event.type) {
        case "combatStart":
          this.addLog("Combate iniciado.");
          break;

        case "playerAttack":
          this.addLog(`-${event.damage} HP enemigo.`);
          this.sfx.play("playerAttack");
          break;

        case "enemyAttack":
          this.addLog(`Enemigo ataca: -${event.damage} PV.`);
          this.sfx.play("enemyAttack");
          break;

        case "enemyDamaged":
          if (event.damage > 0) {
            this.flashModel(event.enemy.model, 0xff4058, 0.12);
          }
          break;

        case "playerDamaged":
          if (event.damage > 0) {
            this.flashModel(this.player.model, 0xff4058, 0.16);
          }
          this.updateHud();
          break;

        case "enemyCoinsDropped":
          this.coinManager.addCoinDrops(event.coins);
          break;

        case "enemyDefeated":
          this.addLog("Enemigo derrotado.");
          this.sfx.play("enemyDefeated");
          break;

        case "playerDefeated":
          this.flashModel(this.player.model, 0x7a1020, 0.6);
          this.updateHud();
          break;
      }
    }
  }

  flashModel(model, color, duration) {
    const flashColor = new THREE.Color(color);
    this.feedbackEffects = this.feedbackEffects.filter(
      (effect) => effect.model !== model
    );

    model.traverse((child) => {
      if (child.userData.ignoreFlash) return;
      if (!child.isMesh || !child.material) return;

      if (!child.userData.flashMaterialsCloned) {
        child.material = Array.isArray(child.material)
          ? child.material.map((material) => material.clone())
          : child.material.clone();
        child.userData.flashMaterialsCloned = true;
      }

      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];

      for (const material of materials) {
        if (!material?.color) continue;

        if (!material.userData.baseColor) {
          material.userData.baseColor = material.color.clone();
        }

        material.color.copy(flashColor);
      }
    });

    this.feedbackEffects.push({
      model,
      duration,
      elapsed: 0,
      flashColor,
    });
  }

  updateFeedbackEffects(delta) {
    this.feedbackEffects = this.feedbackEffects.filter((effect) => {
      effect.elapsed += delta;

      const t = Math.min(1, effect.elapsed / effect.duration);

      effect.model.traverse((child) => {
        if (!child.isMesh || !child.material) return;

        const materials = Array.isArray(child.material)
          ? child.material
          : [child.material];

        for (const material of materials) {
          if (!material?.color || !material.userData.baseColor) continue;

          material.color.copy(effect.flashColor);
          material.color.lerp(material.userData.baseColor, t);
        }
      });

      return t < 1;
    });
  }

  updateHud() {
    this.hud.updatePlayer(this.player);
  }

  addLog(message) {
    this.hud.addLog(message);
  }

  updateCamera(delta) {
    const pos = this.player.model.position;

    const desired = new THREE.Vector3(
      pos.x + 7.5,
      8.5,
      pos.z + 9.5
    );

    this.camera.position.lerp(
      desired,
      1 - Math.pow(0.001, delta)
    );

    this.camera.lookAt(pos.x, 0.4, pos.z);
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
