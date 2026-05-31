import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { EnemyAI } from "../World/EnemyAI.js";
import { Player } from "./Player.js";
import { setupInput, setupInventoryInput } from "./Input.js";
import { Inventory } from "./Inventory.js";
import { ItemEffects } from "./ItemEffects.js";
import { GameManager } from "../Game/GameManager.js";
import { flatDistance } from "../Game/Utils.js";
import { HUD } from "../UI/HUD.js";
import { SFX } from "../UI/SFX.js";
import { VFX } from "../UI/VFX.js";
import { DebugCheats } from "../UI/DebugCheats.js";
import { ChestManager } from "../Game/Chest.js";
import { CoinManager } from "../Game/Coin.js";
import { ItemDropManager } from "../World/ItemDrop.js";
import { Environment } from "../World/Environment.js";
import { ROOM_TEMPLATES } from "../RoomData/roomTemplates.js";
import {
  DEFAULT_ENEMY_MODEL_ID,
  DEFAULT_PLAYER_MODEL_ID,
  MODEL_TEXTURE_DEFINITIONS,
  getModelDefinitionsToPreload,
} from "../CharacterData/modelDefinitions.js";
import { RoomTemplateLibrary } from "../World/RoomTemplateLibrary.js";
import { LevelBuilder } from "../World/LevelBuilder.js";
import { ModularTileBuilder } from "../World/ModularTileBuilder.js";

const PLAYER_GROUND_Y = 0;
const PLAYER_COLLISION_RADIUS = 0.32;
const ENEMY_COLLISION_RADIUS = 0.32;
const NAV_GRID_SIZE = 0.7;
const CLICK_TARGET_SEARCH_RADIUS = 1.35;
const CLICK_TARGET_SEARCH_STEP = 0.22;
const PLAYER_COLLISION_SKIN = 0.04;
const ENTRY_STAIRS_FRONT_OFFSET = 1;
const DEBUG_SUPER_SPEED_MULTIPLIER = 5;
const DEBUG_EXTERMINATOR_DAMAGE = 999999;
const FRONT_DIRECTION_BY_SIDE = {
  north: { x: 0, z: 1 },
  south: { x: 0, z: -1 },
  west: { x: 1, z: 0 },
  east: { x: -1, z: 0 },
};

export class GameScene {
  constructor(container) {
    this.container = container;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x111317);

    this.environment = new Environment(this);
    this.chestManager = new ChestManager(this);
    this.coinManager = new CoinManager(this);
    this.itemDropManager = new ItemDropManager(this);
    this.models = {};
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
    this.currentFloorLoad = null;
    this.levelGroup = new THREE.Group();
    this.scene.add(this.levelGroup);

    this.enemy = null;
    this.enemies = [];
    this.chests = [];
    this.walkableAreas = [];
    this.collisionWalls = [];
    this.wallMeshes = [];
    this.navBounds = null;
    this.levelExitTrigger = null;
    this.clickEffects = [];
    this.feedbackEffects = [];

    this.hud = new HUD();
    this.debugCheatState = {
      superSpeed: {
        active: false,
        baseSpeed: null,
      },
      exterminator: {
        active: false,
        baseAttackDamage: null,
      },
    };
    this.debugCheats = new DebugCheats({
      onSelect: (cheat) => this.applyDebugCheat(cheat),
      getState: () => this.getDebugCheatStates(),
    });
    this.sfx = new SFX();
    this.vfx = new VFX({ root: this.levelGroup });
    this.gameManager = new GameManager(this);
    this.itemEffects = new ItemEffects();
    this.inventory = null;

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
      this.addLog("Environment or character assets are using fallback visuals.");
    }

    try {
      await this.createPlayer();
      this.inventory = new Inventory({
        player: this.player,
        itemEffects: this.itemEffects,
      });
    } catch (err) {
      console.error("createPlayer failed", err);
      this.addLog("Error creating player: " + (err.message || err));
    }

    this.loadLevel();

    setupInput(this.renderer, this.camera, this.floor, (point) => {
      const navigation = this.getClickNavigation(point);
      if (!navigation) return;

      this.createClickFeedback(navigation.target);
      this.player.setPath(navigation.path);
    });

    setupInventoryInput((slotIndex) => {
      this.useInventorySlot(slotIndex);
    });

    this.hud.setConsumableUseHandler((slotIndex) => {
      this.useInventorySlot(slotIndex);
    });

    window.addEventListener("resize", () => this.onResize());
    this.animate();
  }

  async preloadEnvironmentTileSets() {
    const tileSetIds = this.gameManager.getPreloadTileSetIds();

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

    const createModelLoader = (modelDefinition) => {
      if (modelDefinition.useEmbeddedTexture) return loader;

      const modelTextureDefinition =
        MODEL_TEXTURE_DEFINITIONS[modelDefinition.textureId] ??
        MODEL_TEXTURE_DEFINITIONS.charactersColormap;
      if (!modelTextureDefinition) return loader;

      const loadingManager = new THREE.LoadingManager();
      loadingManager.setURLModifier((url) => {
        if (
          modelDefinition.assetVersion &&
          url === modelDefinition.assetPath
        ) {
          return `${url}?v=${modelDefinition.assetVersion}`;
        }

        if (url.endsWith("Textures/colormap.png")) {
          return modelTextureDefinition.primaryPath;
        }

        return url;
      });

      return new GLTFLoader(loadingManager);
    };

    const getModelAssetPath = (modelDefinition) => {
      if (!modelDefinition.assetVersion) return modelDefinition.assetPath;

      return `${modelDefinition.assetPath}?v=${modelDefinition.assetVersion}`;
    };

    const modelEntries = await Promise.all(
      getModelDefinitionsToPreload().map(async (modelDefinition) => {
        try {
          const modelLoader = createModelLoader(modelDefinition);
          const gltf = await modelLoader.loadAsync(getModelAssetPath(modelDefinition));
          const texture = textures[modelDefinition.textureId];

          if (!modelDefinition.useEmbeddedTexture && texture) {
            applyTexture(gltf, texture);
          }
          this.prepareModelForScene(gltf.scene);

          return [modelDefinition.id, { definition: modelDefinition, gltf }];
        } catch (error) {
          console.warn(`Model ${modelDefinition.id} is not loaded. Using fallback when needed.`, {
            assetPath: modelDefinition.assetPath,
            error: error?.message ?? error,
          });

          return [
            modelDefinition.id,
            {
              definition: modelDefinition,
              gltf: null,
              loadError: error,
            },
          ];
        }
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
    cloned.userData.modelDefinition = modelEntry.definition;
    cloned.userData.animations = modelEntry.gltf.animations ?? [];
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

  updateFloorPlane(size, center = { x: 0, z: 0 }) {
    this.floorSize = size;
    this.floor.geometry.dispose();
    this.floor.geometry = new THREE.PlaneGeometry(size, size);
    this.floor.position.set(center.x ?? 0, 0, center.z ?? 0);
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

  loadLevel(options = {}) {
    const floorLoad = this.gameManager.resolveFloor();
    const definition = floorLoad?.definition;
    if (!definition) return;

    const progressSnapshot = options.preserveProgress && !options.resetProgress
      ? this.createProgressSnapshot()
      : null;
    const level = this.levelBuilder.build(definition, {
      runSeed: floorLoad.currentFloorSeed,
      floorSeed: floorLoad.currentFloorSeed,
    });
    if (!level) return;

    this.currentFloorLoad = floorLoad;
    this.levelIndex = floorLoad.levelIndex ?? floorLoad.currentFloorIndex ?? 0;
    this.clearCurrentFloorState();

    if (options.resetProgress) {
      this.resetGameplayProgress();
    }

    if (options.resetLog) {
      this.hud.clearLog();
    }

    const levelBounds = this.calculateAreaBounds(level.walkableAreas ?? []);
    const floorSize = level.floorSize ?? this.getFloorSizeForBounds(levelBounds);
    const floorCenter = level.floorCenter ?? this.getBoundsCenter(levelBounds);

    this.updateFloorPlane(floorSize, floorCenter);
    this.environment.updateForLevel(levelBounds);
    this.addLevelGeometry(level);
    this.chestManager.load(level);
    this.addLevelEnemies(level);
    this.placePlayer(level.playerStart);
    this.restoreProgressSnapshot(progressSnapshot);
    this.syncDebugCheatEffects();

    this.updateHud();
    this.addLog(`${level.name} loaded.`);
    this.addLog(`Mode: ${floorLoad.mode}. Floor ${floorLoad.currentFloorIndex}.`);
    this.addLog(`Seed: ${floorLoad.currentFloorSeed}`);
    console.log("levelLoaded", {
      mode: floorLoad.mode,
      floorIndex: floorLoad.currentFloorIndex,
      name: level.name,
      runSeed: floorLoad.runSeed,
      floorSeed: floorLoad.currentFloorSeed,
      floorType: floorLoad.floorType,
      difficultyTier: floorLoad.difficultyTier,
      status: floorLoad.status,
      procedural: level.procedural ?? null,
      navigation: {
        bounds: levelBounds,
        floorSize,
        floorCenter,
        walkableAreas: level.walkableAreas?.length ?? 0,
        collisionWalls: level.collisionWalls?.length ?? 0,
      },
      connections: (level.connections ?? []).map((connection) => connection.id),
    });
  }

  calculateAreaBounds(areas = []) {
    if (areas.length === 0) {
      return {
        minX: -this.floorSize / 2,
        maxX: this.floorSize / 2,
        minZ: -this.floorSize / 2,
        maxZ: this.floorSize / 2,
      };
    }

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

  getBoundsCenter(bounds) {
    if (!bounds) return { x: 0, z: 0 };

    return {
      x: (bounds.minX + bounds.maxX) / 2,
      z: (bounds.minZ + bounds.maxZ) / 2,
    };
  }

  getFloorSizeForBounds(bounds) {
    if (!bounds) return this.floorSize;

    return Math.ceil(
      Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ) + 10
    );
  }

  reloadCurrentLevel(options = {}) {
    this.loadLevel({
      preserveProgress: options.preserveProgress ?? true,
      resetProgress: options.resetProgress ?? false,
      resetLog: options.resetLog ?? false,
    });
  }

  clearCurrentFloorState() {
    if (this.vfx) this.vfx.clear();
    this.clearClickEffects();
    this.clearFeedbackEffects();

    if (this.chestManager) this.chestManager.clear();
    if (this.coinManager) this.coinManager.clear();
    if (this.itemDropManager) this.itemDropManager.clear();

    this.levelGroup.clear();
    this.enemy = null;
    this.enemies = [];
    this.chests = [];
    this.walkableAreas = [];
    this.collisionWalls = [];
    this.wallMeshes = [];
    this.navBounds = null;
    this.levelExitTrigger = null;
  }

  clearClickEffects() {
    for (const effect of this.clickEffects) {
      effect.mesh.removeFromParent();
      effect.material.dispose();
      effect.mesh.geometry.dispose();
    }

    this.clickEffects = [];
  }

  clearFeedbackEffects() {
    for (const effect of this.feedbackEffects) {
      this.restoreFlashEffect(effect);
    }

    this.feedbackEffects = [];
  }

  restoreFlashEffect(effect) {
    effect.model?.traverse((child) => {
      if (!child.isMesh || !child.material) return;

      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];

      for (const material of materials) {
        if (!material?.color || !material.userData.baseColor) continue;

        material.color.copy(material.userData.baseColor);
      }
    });
  }

  createProgressSnapshot() {
    return {
      player: this.player?.createProgressSnapshot?.() ?? null,
      inventory: this.inventory?.createProgressSnapshot?.() ?? null,
    };
  }

  restoreProgressSnapshot(snapshot) {
    if (!snapshot) return;

    this.player?.restoreProgressSnapshot?.(snapshot.player);
    this.inventory?.restoreProgressSnapshot?.(snapshot.inventory);
  }

  resetGameplayProgress() {
    this.restoreDebugCheatBaseStats();
    this.player?.resetForNewRun?.();
    this.inventory?.reset?.();
    this.refreshDebugCheatBaseStats();
    this.hud?.clearLog?.();
    this.syncDebugCheatEffects();
    this.updateHud();
  }

  placePlayer(position) {
    const safePosition = this.getSafePlayerStartPosition(position);

    this.player.model.position.copy(safePosition);
    this.player.groundY = PLAYER_GROUND_Y;
    this.player.resetRuntimeState?.();
  }

  getSafePlayerStartPosition(position) {
    const start = new THREE.Vector3(position.x, PLAYER_GROUND_Y, position.z);

    if (this.isWalkablePosition(start, PLAYER_COLLISION_RADIUS)) {
      return start;
    }

    const entryStairsFallback = this.getEntryStairsFrontSpawnPosition(start);
    if (entryStairsFallback) {
      console.log("playerStartAdjusted", {
        reason: "entryStairs",
        from: { x: start.x, z: start.z },
        to: { x: entryStairsFallback.x, z: entryStairsFallback.z },
      });

      return entryStairsFallback;
    }

    const fallback = this.getNearestWalkablePosition(
      start,
      PLAYER_COLLISION_RADIUS
    );

    if (!fallback) return start;

    console.log("playerStartAdjusted", {
      reason: "nearestWalkable",
      from: { x: start.x, z: start.z },
      to: { x: fallback.x, z: fallback.z },
    });

    return fallback;
  }

  getEntryStairsFrontSpawnPosition(start) {
    const stairs = this.collisionWalls.find(
      (wall) =>
        wall.role === "entryStairs" &&
        this.isInsideWall(start, wall, PLAYER_COLLISION_RADIUS)
    );

    if (!stairs) return null;

    const direction = FRONT_DIRECTION_BY_SIDE[stairs.side];
    if (!direction) return null;

    const frontPoint = new THREE.Vector3(
      stairs.x + direction.x * ENTRY_STAIRS_FRONT_OFFSET,
      PLAYER_GROUND_Y,
      stairs.z + direction.z * ENTRY_STAIRS_FRONT_OFFSET
    );

    if (this.isWalkablePosition(frontPoint, PLAYER_COLLISION_RADIUS)) {
      return frontPoint;
    }

    return this.getNearestWalkablePosition(
      frontPoint,
      PLAYER_COLLISION_RADIUS,
      1.5,
      0.15
    );
  }

  getNearestWalkablePosition(
    point,
    radius,
    maxSearchRadius = 3,
    searchStep = 0.2
  ) {
    const candidates = [];
    const seen = new Set();

    const addCandidate = (x, z) => {
      const candidate = new THREE.Vector3(x, PLAYER_GROUND_Y, z);
      const key = `${candidate.x.toFixed(3)},${candidate.z.toFixed(3)}`;

      if (seen.has(key)) return;
      if (!this.isWalkablePosition(candidate, radius)) return;

      seen.add(key);
      candidates.push(candidate);
    };

    addCandidate(point.x, point.z);

    for (const area of this.walkableAreas) {
      const minX = area.x - area.w / 2 + radius;
      const maxX = area.x + area.w / 2 - radius;
      const minZ = area.z - area.d / 2 + radius;
      const maxZ = area.z + area.d / 2 - radius;

      if (minX > maxX || minZ > maxZ) continue;

      addCandidate(
        THREE.MathUtils.clamp(point.x, minX, maxX),
        THREE.MathUtils.clamp(point.z, minZ, maxZ)
      );
    }

    const angleStep = Math.PI / 8;

    for (
      let distance = searchStep;
      distance <= maxSearchRadius;
      distance += searchStep
    ) {
      for (let angle = 0; angle < Math.PI * 2; angle += angleStep) {
        addCandidate(
          point.x + Math.cos(angle) * distance,
          point.z + Math.sin(angle) * distance
        );
      }

      if (candidates.length > 0) break;
    }

    candidates.sort(
      (a, b) => a.distanceToSquared(point) - b.distanceToSquared(point)
    );

    return candidates[0] ?? null;
  }

  addLevelGeometry(level) {
    this.walkableAreas = (level.walkableAreas ?? []).map((area) => ({ ...area }));
    this.collisionWalls = (level.collisionWalls ?? []).map((wall) => ({ ...wall }));
    this.navBounds = this.calculateNavBounds(this.walkableAreas);

    const environmentBuild = this.modularTileBuilder.buildLevel(level.environment);
    this.wallMeshes = environmentBuild.wallMeshes;

    if (level.exit?.x !== undefined && level.exit?.z !== undefined) {
      this.levelExitTrigger = {
        x: level.exit.x,
        z: level.exit.z,
        activated: false,
      };
    }
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
      enemyTypeId: data.enemyTypeId,
      enemyName: data.enemyName,
      enemyDifficulty: data.enemyDifficulty,
      maxHp: data.maxHp,
      hp: data.hp,
      speed: data.speed,
      attackDamage: data.attackDamage,
      attackRange: data.attackRange,
      attackCooldown: data.attackCooldown,
      collisionRadius: data.collisionRadius ?? ENEMY_COLLISION_RADIUS,
      patrolStopRange: data.patrolStopRange,
      patrolMoveDuration: data.patrolMoveDuration,
      patrolPauseDurations: data.patrolPauseDurations,
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

    const start = this.getNearestWalkableNavCell(from, radius, {
      maxRing: 2,
    });

    const goal = this.getNearestWalkableNavCell(to, radius, {
      maxRing: 3,
      mustConnectToPosition: true,
    });

    if (!start || !goal) return [];

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

  getNearestWalkableNavCell(position, radius, options = {}) {
    const maxRing = options.maxRing ?? 2;
    const center = this.worldToNavCell(position);
    const candidates = [];

    for (let ring = 0; ring <= maxRing; ring += 1) {
      for (let x = center.x - ring; x <= center.x + ring; x += 1) {
        for (let z = center.z - ring; z <= center.z + ring; z += 1) {
          const cellRing = Math.max(
            Math.abs(x - center.x),
            Math.abs(z - center.z)
          );

          if (cellRing !== ring) {
            continue;
          }

          candidates.push({ x, z });
        }
      }
    }

    candidates.sort((a, b) => {
      const aWorld = this.navCellToWorld(a);
      const bWorld = this.navCellToWorld(b);

      return (
        aWorld.distanceToSquared(position) -
        bWorld.distanceToSquared(position)
      );
    });

    for (const cell of candidates) {
      if (!this.isNavCellInBounds(cell)) continue;
      if (!this.isNavCellWalkable(cell, radius)) continue;

      const cellWorld = this.navCellToWorld(cell);
      if (
        options.mustConnectToPosition &&
        !this.canMoveBetween(cellWorld, position, radius)
      ) {
        continue;
      }

      return cell;
    }

    return null;
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

  getClickNavigation(point) {
    const candidates = this.getWalkableTargetCandidates(
      point,
      PLAYER_COLLISION_RADIUS
    );

    for (const target of candidates) {
      const path = this.findNavigationPath(
        this.player.model.position,
        target,
        PLAYER_COLLISION_RADIUS
      );

      if (path.length > 0) {
        return { target, path };
      }
    }

    return null;
  }

  getWalkableTargetCandidates(point, radius) {
    const candidates = [];
    const seen = new Set();
    const maxSnapDistanceSq =
      CLICK_TARGET_SEARCH_RADIUS * CLICK_TARGET_SEARCH_RADIUS;

    const addCandidate = (x, z) => {
      const target = new THREE.Vector3(x, PLAYER_GROUND_Y, z);
      const key = `${target.x.toFixed(3)},${target.z.toFixed(3)}`;

      if (seen.has(key)) return;
      if (!this.isWalkablePosition(target, radius)) return;

      seen.add(key);
      candidates.push(target);
    };

    addCandidate(point.x, point.z);

    for (const area of this.walkableAreas) {
      const minX = area.x - area.w / 2 + radius;
      const maxX = area.x + area.w / 2 - radius;
      const minZ = area.z - area.d / 2 + radius;
      const maxZ = area.z + area.d / 2 - radius;

      if (minX > maxX || minZ > maxZ) continue;

      const clampedX = THREE.MathUtils.clamp(point.x, minX, maxX);
      const clampedZ = THREE.MathUtils.clamp(point.z, minZ, maxZ);
      const dx = clampedX - point.x;
      const dz = clampedZ - point.z;

      if (dx * dx + dz * dz > maxSnapDistanceSq) continue;

      addCandidate(clampedX, clampedZ);
    }

    const angleStep = Math.PI / 8;

    for (
      let distance = CLICK_TARGET_SEARCH_STEP;
      distance <= CLICK_TARGET_SEARCH_RADIUS;
      distance += CLICK_TARGET_SEARCH_STEP
    ) {
      for (let angle = 0; angle < Math.PI * 2; angle += angleStep) {
        addCandidate(
          point.x + Math.cos(angle) * distance,
          point.z + Math.sin(angle) * distance
        );
      }
    }

    candidates.sort(
      (a, b) => a.distanceToSquared(point) - b.distanceToSquared(point)
    );

    return candidates;
  }

  applyPlayerWorldCollision(previousPosition) {
    const currentPosition = this.player.model.position;
    const movementRadius = this.getPlayerMovementCollisionRadius();

    if (this.canMoveBetween(previousPosition, currentPosition, movementRadius)) {
      return;
    }

    const slidePosition = this.getSlidePosition(
      previousPosition,
      currentPosition,
      movementRadius
    );

    if (slidePosition) {
      currentPosition.copy(slidePosition);
      return;
    }

    currentPosition.copy(previousPosition);

    const recoveryTarget = this.getPlayerNavigationDestination();
    if (recoveryTarget) {
      const recoveryPath = this.findNavigationPath(
        previousPosition,
        recoveryTarget,
        PLAYER_COLLISION_RADIUS
      );

      if (recoveryPath.length > 0) {
        this.player.setPath(recoveryPath);
        return;
      }
    }

    this.player.clearTarget();
  }

  getSlidePosition(
    previousPosition,
    desiredPosition,
    radius = PLAYER_COLLISION_RADIUS
  ) {
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
      this.canMoveBetween(previousPosition, candidate, radius)
    );

    if (validCandidates.length === 0) return null;

    validCandidates.sort(
      (a, b) =>
        a.distanceToSquared(desiredPosition) -
        b.distanceToSquared(desiredPosition)
    );

    return validCandidates[0];
  }

  getPlayerMovementCollisionRadius() {
    return Math.max(0.05, PLAYER_COLLISION_RADIUS - PLAYER_COLLISION_SKIN);
  }

  getPlayerNavigationDestination() {
    if (this.player.path.length > 0) {
      return this.player.path[this.player.path.length - 1].clone();
    }

    return this.player.target?.clone() ?? null;
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
    if (this.itemDropManager) this.itemDropManager.update(delta);
    if (this.vfx) this.vfx.update(delta, this.camera);

    const previousPlayerPosition = this.player.model.position.clone();
    this.player.update(delta);
    this.applyPlayerWorldCollision(previousPlayerPosition);

    const events = [
      ...this.player.consumeEvents(),
      ...this.enemies.flatMap((enemy) => enemy.consumeEvents()),
      ...(this.inventory ? this.inventory.consumeEvents() : []),
    ];

    this.handleGameEvents(events);
    this.chestManager.update(delta);
    this.checkLevelExitTrigger();
    this.updateClickEffects(delta);
    this.updateFeedbackEffects(delta);
    this.updateCamera(delta);
    this.player.updateOcclusionMarker(this.camera, this.wallMeshes);
    this.renderer.render(this.scene, this.camera);

    requestAnimationFrame(() => this.animate());
  }

  useInventorySlot(slotIndex) {
    if (!this.inventory) return;

    this.inventory.useConsumableSlot(slotIndex, {
      enemies: this.enemies,
      scene: this,
    });

    const events = this.inventory.consumeEvents();
    if (events.length > 0) {
      this.handleGameEvents(events);
    }

    this.updateHud();
  }

  flushInventoryEvents() {
    if (!this.inventory) return;

    const events = this.inventory.consumeEvents();
    if (events.length > 0) {
      this.handleGameEvents(events);
    }
  }

  applyDebugCheat(cheat) {
    if (!this.player) return;

    console.log("debugCheatSelected", cheat.id);

    switch (cheat.id) {
      case "killPlayer":
        this.addLog(`Debug cheat: ${cheat.label}.`);
        this.player.takeDamage(this.player.hp, {
          type: "debugCheat",
          id: cheat.id,
        });
        break;

      case "takeDamage50":
        this.addLog(`Debug cheat: ${cheat.label}.`);
        this.player.takeDamage(50, {
          type: "debugCheat",
          id: cheat.id,
        });
        break;

      case "superSpeed":
        this.toggleSuperSpeedCheat();
        break;

      case "exterminator":
        this.toggleExterminatorCheat();
        break;

      default:
        console.warn("Unknown debug cheat", cheat);
        break;
    }

    this.handleGameEvents(this.player.consumeEvents());
    this.updateHud();
  }

  getDebugCheatStates() {
    return {
      superSpeed: this.debugCheatState.superSpeed.active,
      exterminator: this.debugCheatState.exterminator.active,
    };
  }

  toggleSuperSpeedCheat() {
    const state = this.debugCheatState.superSpeed;

    if (state.active) {
      this.disableSuperSpeedCheat();
      this.addLog("Debug cheat disabled: Super Speed.");
      return;
    }

    state.active = true;
    state.baseSpeed = this.player.speed;
    this.player.speed = state.baseSpeed * DEBUG_SUPER_SPEED_MULTIPLIER;
    this.addLog("Debug cheat enabled: Super Speed.");
  }

  disableSuperSpeedCheat() {
    const state = this.debugCheatState.superSpeed;
    if (!state.active) return;

    this.player.speed =
      state.baseSpeed ?? this.player.speed / DEBUG_SUPER_SPEED_MULTIPLIER;
    state.active = false;
    state.baseSpeed = null;
  }

  toggleExterminatorCheat() {
    const state = this.debugCheatState.exterminator;

    if (state.active) {
      this.disableExterminatorCheat();
      this.addLog("Debug cheat disabled: Exterminator.");
      return;
    }

    state.active = true;
    state.baseAttackDamage = this.player.attackDamage;
    this.player.attackDamage = DEBUG_EXTERMINATOR_DAMAGE;
    this.addLog("Debug cheat enabled: Exterminator.");
  }

  disableExterminatorCheat() {
    const state = this.debugCheatState.exterminator;
    if (!state.active) return;

    this.player.attackDamage =
      state.baseAttackDamage ?? this.player.attackDamage;
    state.active = false;
    state.baseAttackDamage = null;
  }

  syncDebugCheatEffects() {
    if (!this.player) return;

    if (this.debugCheatState.superSpeed.active) {
      this.player.speed =
        (this.debugCheatState.superSpeed.baseSpeed ?? this.player.speed)
        * DEBUG_SUPER_SPEED_MULTIPLIER;
    }

    if (this.debugCheatState.exterminator.active) {
      this.player.attackDamage = DEBUG_EXTERMINATOR_DAMAGE;
    }
  }

  restoreDebugCheatBaseStats() {
    if (!this.player) return;

    const superSpeedState = this.debugCheatState.superSpeed;
    if (superSpeedState.active && superSpeedState.baseSpeed !== null) {
      this.player.speed = superSpeedState.baseSpeed;
    }

    const exterminatorState = this.debugCheatState.exterminator;
    if (
      exterminatorState.active &&
      exterminatorState.baseAttackDamage !== null
    ) {
      this.player.attackDamage = exterminatorState.baseAttackDamage;
    }
  }

  refreshDebugCheatBaseStats() {
    if (!this.player) return;

    const superSpeedState = this.debugCheatState.superSpeed;
    if (superSpeedState.active) {
      superSpeedState.baseSpeed = this.player.speed;
    }

    const exterminatorState = this.debugCheatState.exterminator;
    if (exterminatorState.active) {
      exterminatorState.baseAttackDamage = this.player.attackDamage;
    }
  }

  updateDebugCheatBaselinesForStatChange(result) {
    if (!result) return;

    const exterminatorState = this.debugCheatState.exterminator;
    if (
      result.stat === "attackDamage" &&
      exterminatorState.active &&
      Number.isFinite(result.amount)
    ) {
      exterminatorState.baseAttackDamage =
        (exterminatorState.baseAttackDamage ?? 0) + result.amount;
    }
  }

  checkLevelExitTrigger() {
    if (!this.levelExitTrigger || this.levelExitTrigger.activated) return;

    const distance = flatDistance(
      this.player.model.position,
      this.levelExitTrigger
    );

    if (distance > 0.6) return;

    this.levelExitTrigger.activated = true;
    console.log("levelExitTriggerReached", {
      from: this.currentFloorLoad?.currentFloorIndex ?? this.levelIndex,
      mode: this.currentFloorLoad?.mode,
    });
    this.gameManager.handleEvent({
      type: "levelExitReached",
      levelIndex: this.levelIndex,
      floorIndex: this.currentFloorLoad?.currentFloorIndex,
      mode: this.currentFloorLoad?.mode,
    });
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
          this.addLog("Combat started.");
          break;

        case "combatEnd":
          this.addLog("Combat interrupted.");
          break;

        case "playerAttack":
          this.addLog(`Enemy takes ${event.damage} damage.`);
          this.sfx.play("playerAttack");
          break;

        case "enemyAttack":
          this.addLog(`Enemy attacks: -${event.damage} HP.`);
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

        case "enemyItemsDropped":
          console.log("enemyItemsDropped", {
            count: event.items?.length ?? 0,
            itemIds: (event.items ?? []).map((item) => item.itemId),
          });
          if (this.itemDropManager) {
            this.itemDropManager.addItemDrops(event.items ?? []);
          }
          break;

        case "enemyDefeated":
          this.addLog("Enemy defeated.");
          this.sfx.play("enemyDefeated");
          break;

        case "enemyStunned":
          this.addLog(`Enemy stunned for ${event.duration.toFixed(1)}s.`);
          this.flashModel(event.enemy.model, 0x9c61ff, 0.22);
          break;

        case "itemPickedUp":
          this.addLog(`Item picked up: ${event.item.name}.`);
          this.updateHud();
          break;

        case "passiveItemApplied":
          this.addLog(`Passive applied: ${event.item.name}.`);
          this.updateDebugCheatBaselinesForStatChange(event.result);
          this.syncDebugCheatEffects();
          this.highlightItemStat(event.result);
          this.updateHud();
          break;

        case "itemUsed":
          this.addLog(`Item used: ${event.item.name}.`);
          this.playItemUseFeedback(event);
          this.highlightItemStat(event.result);
          this.updateHud();
          break;

        case "itemUseFailed":
          this.addLog(this.getItemUseFailedMessage(event));
          break;

        case "itemPickupBlocked":
          this.addLog(this.getItemPickupBlockedMessage(event));
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
    if (this.inventory) {
      this.hud.updateInventory(this.inventory);
    }
  }

  highlightItemStat(result) {
    if (!result?.stat) return;

    this.hud.highlightStat(result.stat);
  }

  playItemUseFeedback(event) {
    if (event.itemId !== "purpleShroom") return;

    const target = event.result?.enemy;
    if (!target) return;

    this.vfx.playPurpleGasCloud(target);
    this.sfx.play("purpleShroom");
  }

  getItemUseFailedMessage(event) {
    switch (event.reason) {
      case "fullHp":
        return "You do not need healing right now.";

      case "noEnemyInRange":
        return "No enemy is close enough to stun.";

      case "missingItem":
        return "You do not have that consumable.";

      default:
        return "Could not use that item.";
    }
  }

  getItemPickupBlockedMessage(event) {
    switch (event.reason) {
      case "inventoryFull":
        return `Inventory full: you cannot pick up ${event.item.name}.`;

      default:
        return "Could not pick up that item.";
    }
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
