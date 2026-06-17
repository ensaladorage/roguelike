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
import { PauseMenu } from "../UI/PauseMenu.js";
import { SFX } from "../UI/SFX.js";
import { VFX } from "../UI/VFX.js";
import { DebugCheats } from "../UI/DebugCheats.js";
import { ChestManager } from "../Game/Chest.js";
import { CoinManager } from "../Game/Coin.js";
import { GameEventRouter } from "../Game/GameEventRouter.js";
import { SHOP_INTERACTION_RANGE, ShopManager } from "../Game/ShopManager.js";
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
import { NavigationGrid } from "../World/NavigationGrid.js";
import { RoomVisibilityManager } from "../World/RoomVisibilityManager.js";
import { WorldNavigationAdapter } from "../World/WorldNavigationAdapter.js";

const PLAYER_GROUND_Y = 0;
const PLAYER_COLLISION_RADIUS = 0.32;
const ENEMY_COLLISION_RADIUS = 0.32;
const NAV_GRID_SIZE = 0.7;
const NAVIGATION_TARGET_SEARCH_RADIUS = 1.35;
const NAVIGATION_TARGET_SEARCH_STEP = 0.22;
const PLAYER_COLLISION_SKIN = 0.04;
const PLAYER_ENEMY_COLLISION_SKIN = -0.03;
const PLAYER_ENEMY_COLLISION_RADIUS_SCALE = 0.72;
const ENTRY_STAIRS_FRONT_OFFSET = 2;
const EXIT_INTERACTABLE_HOLE_SIZE = 1;
const EXIT_INTERACTABLE_HOLE_Y = 0.08;
const DEBUG_SUPER_SPEED_MULTIPLIER = 5;
const DEBUG_EXTERMINATOR_DAMAGE = 999999;
const DEBUG_GOLD_AMOUNT = 999;
const MAX_RENDER_PIXEL_RATIO = 1.75;
const PAUSE_LOCK_REASON = "pauseMenu";
const ITEM_SWAP_LOCK_REASON = "itemSwapConfirmation";
const INTERACTION_CLICK_FEEDBACK_COLOR = 0xffd84a;
const INTERACTION_OUT_OF_RANGE_MESSAGE = "Move closer.";
const PLAYER_INTERACTION_RANGE_FALLBACK = 1.65;
const LEVEL_EXIT_INTERACTION_RANGE = 0.6;
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

    this.navigationGrid = new NavigationGrid({
      gridSize: NAV_GRID_SIZE,
      groundY: PLAYER_GROUND_Y,
      targetSearchRadius: NAVIGATION_TARGET_SEARCH_RADIUS,
      targetSearchStep: NAVIGATION_TARGET_SEARCH_STEP,
    });
    this.navigationAdapter = new WorldNavigationAdapter(this.navigationGrid);
    this.environment = new Environment(this);
    this.chestManager = new ChestManager(this, {
      navigation: this.navigationAdapter,
    });
    this.coinManager = new CoinManager(this, {
      navigation: this.navigationAdapter,
    });
    this.shopManager = new ShopManager(this);
    this.itemDropManager = new ItemDropManager(this, {
      navigation: this.navigationAdapter,
    });
    this.models = {};
    this.roomTemplateLibrary = new RoomTemplateLibrary(ROOM_TEMPLATES);
    this.levelBuilder = new LevelBuilder({
      roomTemplateLibrary: this.roomTemplateLibrary,
    });
    this.modularTileBuilder = new ModularTileBuilder(this);
    this.roomVisibilityManager = new RoomVisibilityManager(this);

    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    this.camera.position.set(7.5, 8.5, 9.5);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(this.getRenderPixelRatio());
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
    this.currentLevel = null;
    this.levelGroup = new THREE.Group();
    this.scene.add(this.levelGroup);

    this.enemy = null;
    this.enemies = [];
    this.chests = [];
    this.walkableAreas = [];
    this.collisionWalls = [];
    this.allWallMeshes = [];
    this.wallMeshes = [];
    this.levelExitTrigger = null;
    this.exitInteractableTargets = [];
    this.clickEffects = [];
    this.feedbackEffects = [];
    this.playerControlLocks = new Set();
    this.inputController = null;
    this.isPaused = false;
    this.bossExitBlockedNotified = false;
    this.bossHudDiscovered = false;
    this.stageLockedConnectionBlockers = [];
    this.stageLockedConnectionBlockerEffects = [];

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
      onItemAdjust: (item, delta) => this.applyDebugItemCheat(item, delta),
      getState: () => this.getDebugCheatStates(),
      getItemState: () => this.getDebugItemCheatStates(),
    });
    this.sfx = new SFX();
    this.pauseMenu = new PauseMenu({
      initialSoundLevel: this.sfx.getSoundLevelPercent(),
      onOpenChange: (isOpen) => this.setPaused(isOpen),
      onSoundLevelChange: (soundLevel) =>
        this.sfx.setSoundLevelPercent(soundLevel),
      canOpen: () => !this.shopManager?.pendingConfirmation,
    });
    this.vfx = new VFX({ root: this.levelGroup });
    this.gameManager = new GameManager(this);
    this.eventRouter = new GameEventRouter(() =>
      this.createEventRouterContext()
    );
    this.itemEffects = new ItemEffects();
    this.inventory = null;

    this.init();
  }

  createEventRouterContext() {
    return {
      gameManager: this.gameManager,
      player: this.player,
      enemies: this.enemies,
      inventory: this.inventory,
      shopManager: this.shopManager,
      coinManager: this.coinManager,
      itemDropManager: this.itemDropManager,
      hud: this.hud,
      sfx: this.sfx,
      vfx: this.vfx,
      addLog: (message) => this.addLog(message),
      updateHud: () => this.updateHud(),
      syncBossHud: () => this.syncBossHud(),
      flashModel: (model, color, duration) =>
        this.flashModel(model, color, duration),
      playEnemyDamageFlash: (enemy, color) =>
        this.playEnemyDamageFlash(enemy, color),
      updateDebugCheatBaselinesForStatChange: (result) =>
        this.updateDebugCheatBaselinesForStatChange(result),
      syncDebugCheatEffects: () => this.syncDebugCheatEffects(),
      setBossExitBlockedNotified: (value) => {
        this.bossExitBlockedNotified = value;
      },
    };
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

    this.inputController = setupInput(
      this.renderer,
      this.camera,
      this.floor,
      () => this.getEnemyClickTargets(),
      () => this.getInteractableClickTargets(),
      (payload) => this.handleWorldClick(payload),
      {
        onKeyboardMovementStart: () => this.handleKeyboardMovementStart(),
        onDashPressed: () => this.handleDashPressed(),
        onInteractableHover: (interactable, pointer) =>
          this.handleInteractableHover(interactable, pointer),
      }
    );

    setupInventoryInput((slotIndex) => {
      this.useInventorySlot(slotIndex);
    }, {
      onToggleInventory: () => this.toggleInventoryPanel(),
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
    const loadStartedAt = this.nowMs();
    const floorLoad = this.gameManager.resolveFloor();
    const floorResolvedAt = this.nowMs();
    const definition = floorLoad?.definition;
    if (!definition) return;

    const progressSnapshot = options.preserveProgress && !options.resetProgress
      ? this.createProgressSnapshot()
      : null;
    const buildStartedAt = this.nowMs();
    const level = this.levelBuilder.build(definition, {
      runSeed: floorLoad.currentFloorSeed,
      floorSeed: floorLoad.currentFloorSeed,
      floorIndex: floorLoad.currentFloorIndex,
      floorType: floorLoad.floorType,
      stagePlan: floorLoad.stagePlan,
      stageType: floorLoad.stageType,
      shopTier: floorLoad.shopTier,
      cycleIndex: floorLoad.cycleIndex,
      cycleFloorIndex: floorLoad.cycleFloorIndex,
      difficultyScale: floorLoad.difficultyScale,
      mode: floorLoad.mode,
    });
    const levelBuiltAt = this.nowMs();
    if (!level) return;

    this.currentFloorLoad = floorLoad;
    this.levelIndex = floorLoad.levelIndex ?? floorLoad.currentFloorIndex ?? 0;
    this.clearCurrentFloorState();
    this.currentLevel = level;

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
    const geometryStartedAt = this.nowMs();
    const environmentBuild = this.addLevelGeometry(level);
    const geometryBuiltAt = this.nowMs();
    this.chestManager.load(level);
    this.shopManager.load(level, {
      runSeed: floorLoad.runSeed,
      floorSeed: floorLoad.currentFloorSeed,
      floorIndex: level.floorIndex ?? floorLoad.currentFloorIndex,
      completedFloors: Math.max(
        0,
        (level.floorIndex ?? floorLoad.currentFloorIndex ?? 1) - 1
      ),
      floorType: level.floorType ?? floorLoad.floorType,
      stagePlan: floorLoad.stagePlan,
      stageType: floorLoad.stageType,
      shopTier: floorLoad.shopTier,
      shopTierDefinition: level.shopTier ?? null,
      mode: floorLoad.mode,
    });
    this.addLevelEnemies(level);
    this.gameManager.registerStageClearTargets(level, this.enemies);
    this.placePlayer(level.playerStart);
    this.restoreProgressSnapshot(progressSnapshot);
    this.roomVisibilityManager.load(level, {
      ...environmentBuild,
      enemies: this.enemies,
      chests: this.chestManager.chests,
      shopStands: this.shopManager.stands,
      shopFountains: this.shopManager.fountains,
    });
    this.syncDebugCheatEffects();

    this.updateHud();
    this.addLog(`${level.name} loaded.`);
    this.addLog(`Mode: ${floorLoad.mode}. Floor ${floorLoad.currentFloorIndex}.`);
    this.addLog(`Seed: ${floorLoad.currentFloorSeed}`);
    const loadFinishedAt = this.nowMs();
    console.log("levelLoadTiming", {
      totalMs: Number((loadFinishedAt - loadStartedAt).toFixed(2)),
      resolveFloorMs: Number((floorResolvedAt - loadStartedAt).toFixed(2)),
      buildLevelMs: Number((levelBuiltAt - buildStartedAt).toFixed(2)),
      geometryMs: Number((geometryBuiltAt - geometryStartedAt).toFixed(2)),
      entityAndVisibilityMs: Number((loadFinishedAt - geometryBuiltAt).toFixed(2)),
      renderPixelRatio: this.renderer.getPixelRatio(),
      geometryStats: environmentBuild.stats
        ? {
            ...environmentBuild.stats,
            modulesById: Object.fromEntries(environmentBuild.stats.modulesById),
          }
        : null,
    });
    console.log("levelLoaded", {
      mode: floorLoad.mode,
      floorIndex: floorLoad.currentFloorIndex,
      name: level.name,
      runSeed: floorLoad.runSeed,
      floorSeed: floorLoad.currentFloorSeed,
      floorType: floorLoad.floorType,
      difficultyTier: floorLoad.difficultyTier,
      stageName: floorLoad.stageName,
      stageType: floorLoad.stageType,
      shopTier: floorLoad.shopTier,
      cycleIndex: floorLoad.cycleIndex,
      cycleFloorIndex: floorLoad.cycleFloorIndex,
      difficultyScale: floorLoad.difficultyScale,
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
    if (this.shopManager) this.shopManager.clearFloor();
    if (this.roomVisibilityManager) this.roomVisibilityManager.clear();
    this.hud?.hideBoss?.();
    this.hud?.hideVictoryOverlay?.();
    this.playerControlLocks.clear();
    this.bossExitBlockedNotified = false;
    this.bossHudDiscovered = false;
    this.stageLockedConnectionBlockers = [];
    this.stageLockedConnectionBlockerEffects = [];
    this.hud?.hideItemTooltip?.();
    this.hud?.hideEpicChestRewards?.();
    this.hud?.hideInventoryPanel?.();
    this.hud?.hideItemSwapConfirmation?.();

    this.levelGroup.clear();
    this.currentLevel = null;
    this.enemy = null;
    this.enemies = [];
    this.chests = [];
    this.walkableAreas = [];
    this.collisionWalls = [];
    this.allWallMeshes = [];
    this.wallMeshes = [];
    this.navigationAdapter.clear();
    this.levelExitTrigger = null;
    this.exitInteractableTargets = [];
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
      floor: {
        floorIndex: this.currentFloorLoad?.currentFloorIndex ?? null,
        floorSeed: this.currentFloorLoad?.currentFloorSeed ?? null,
        floorType: this.currentFloorLoad?.floorType ?? null,
        cycleIndex: this.currentFloorLoad?.cycleIndex ?? null,
        cycleFloorIndex: this.currentFloorLoad?.cycleFloorIndex ?? null,
        difficultyScale: this.currentFloorLoad?.difficultyScale ?? null,
      },
      shop: this.shopManager?.createProgressSnapshot?.() ?? null,
    };
  }

  restoreProgressSnapshot(snapshot) {
    if (!snapshot) return;

    this.player?.restoreProgressSnapshot?.(snapshot.player);
    this.inventory?.restoreProgressSnapshot?.(snapshot.inventory);

    if (this.shouldRestoreShopProgress(snapshot)) {
      this.shopManager?.restoreProgressSnapshot?.(snapshot.shop);
    }
  }

  shouldRestoreShopProgress(snapshot) {
    const shopSnapshot = snapshot?.shop;
    if (!shopSnapshot?.offers?.length) return false;

    const currentContext = this.shopManager?.lastContext;
    if (!currentContext) return false;

    return (
      shopSnapshot.lastContext?.floorSeed === currentContext.floorSeed &&
      shopSnapshot.lastContext?.floorIndex === currentContext.floorIndex
    );
  }

  resetGameplayProgress() {
    this.restoreDebugCheatBaseStats();
    this.player?.resetForNewRun?.();
    this.inventory?.reset?.();
    this.shopManager?.clear?.();
    this.hud?.hideBoss?.();
    this.playerControlLocks.clear();
    this.bossExitBlockedNotified = false;
    this.bossHudDiscovered = false;
    this.refreshDebugCheatBaseStats();
    this.hud?.clearLog?.();
    this.syncDebugCheatEffects();
    this.updateHud();
  }

  setPlayerControlLocked(locked, reason = "interaction") {
    if (locked) {
      this.playerControlLocks.add(reason);
      this.player?.clearTarget?.();
      return;
    }

    this.playerControlLocks.delete(reason);
  }

  isPlayerControlLocked() {
    return this.playerControlLocks.size > 0;
  }

  setPaused(paused) {
    this.isPaused = Boolean(paused);
    this.setPlayerControlLocked(this.isPaused, PAUSE_LOCK_REASON);

    if (this.isPaused) {
      this.hud?.hideInventoryPanel?.();
      this.hud?.hideItemSwapConfirmation?.({ cancelled: true });
    }
  }

  toggleInventoryPanel() {
    if (this.pauseMenu?.isOpen) return;
    if (!this.inventory) return;

    this.hud?.toggleInventoryPanel?.(this.inventory);
  }

  requestItemSwapConfirmation({
    currentItem,
    newItem,
    onConfirm,
    onCancel,
  } = {}) {
    if (this.pauseMenu?.isOpen) return false;
    if (!currentItem || !newItem) return false;

    this.setPlayerControlLocked(true, ITEM_SWAP_LOCK_REASON);
    this.hud?.showItemSwapConfirmation?.({
      currentItem,
      newItem,
      onConfirm: () => {
        this.setPlayerControlLocked(false, ITEM_SWAP_LOCK_REASON);
        onConfirm?.();
      },
      onCancel: () => {
        this.setPlayerControlLocked(false, ITEM_SWAP_LOCK_REASON);
        onCancel?.();
      },
    });
    return true;
  }

  updatePausedFrame() {
    this.inputController?.updateCursor?.();
    this.renderer.render(this.scene, this.camera);
  }

  placePlayer(position) {
    const safePosition = this.getSafePlayerStartPosition(position);
    const spawnRotationY = this.getPlayerSpawnRotation(position, safePosition);

    this.player.model.position.copy(safePosition);
    this.player.groundY = PLAYER_GROUND_Y;
    this.player.resetRuntimeState?.();
    this.player.setFacingRotation?.(spawnRotationY);
    this.vfx?.addPlayerAttackRangeIndicator?.(this.player);
  }

  getPlayerSpawnRotation(startPosition, safePosition) {
    const entryStairsRotation = this.getEntryStairsFacingRotation(safePosition);

    if (entryStairsRotation !== null) {
      return entryStairsRotation;
    }

    return typeof startPosition?.rotationY === "number"
      ? startPosition.rotationY
      : 0;
  }

  getEntryStairsFacingRotation(position) {
    const stairs = this.getNearestEntryStairs(position);
    if (!stairs) return null;

    const direction = FRONT_DIRECTION_BY_SIDE[stairs.side];
    if (!direction) return null;

    return Math.atan2(direction.x, direction.z);
  }

  getNearestEntryStairs(position) {
    const entryStairs = this.collisionWalls.filter(
      (wall) => wall.role === "entryStairs"
    );
    if (entryStairs.length === 0) return null;

    return entryStairs.reduce((nearest, stairs) => {
      const distance =
        (position.x - stairs.x) ** 2 +
        (position.z - stairs.z) ** 2;

      if (!nearest || distance < nearest.distance) {
        return { stairs, distance };
      }

      return nearest;
    }, null)?.stairs ?? null;
  }

  getSafePlayerStartPosition(position) {
    const start = new THREE.Vector3(position.x, PLAYER_GROUND_Y, position.z);

    if (this.navigationAdapter.isWalkablePosition(start, PLAYER_COLLISION_RADIUS)) {
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

    const fallback = this.navigationAdapter.getNearestWalkablePosition(
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
        this.navigationAdapter.isPointInsideWall(
          start,
          wall,
          PLAYER_COLLISION_RADIUS
        )
    );

    if (!stairs) return null;

    const direction = FRONT_DIRECTION_BY_SIDE[stairs.side];
    if (!direction) return null;

    const frontPoint = new THREE.Vector3(
      stairs.x + direction.x * ENTRY_STAIRS_FRONT_OFFSET,
      PLAYER_GROUND_Y,
      stairs.z + direction.z * ENTRY_STAIRS_FRONT_OFFSET
    );

    if (
      this.navigationAdapter.isWalkablePosition(
        frontPoint,
        PLAYER_COLLISION_RADIUS
      )
    ) {
      return frontPoint;
    }

    return this.navigationAdapter.getNearestWalkablePosition(
      frontPoint,
      PLAYER_COLLISION_RADIUS,
      1.5,
      0.15
    );
  }

  addLevelGeometry(level) {
    this.walkableAreas = (level.walkableAreas ?? []).map((area) => ({ ...area }));
    this.collisionWalls = (level.collisionWalls ?? []).map((wall) => ({ ...wall }));
    this.stageLockedConnectionBlockers = this.collisionWalls.filter(
      (wall) => wall.role === "stageLockedConnection"
    );
    this.navigationAdapter.configure({
      walkableAreas: this.walkableAreas,
      collisionWalls: this.collisionWalls,
    });

    const environmentBuild = this.modularTileBuilder.buildLevel(level.environment);
    this.allWallMeshes = environmentBuild.wallMeshes;
    this.wallMeshes = [...this.allWallMeshes];

    if (level.exit?.x !== undefined && level.exit?.z !== undefined) {
      this.levelExitTrigger = {
        x: level.exit.x,
        z: level.exit.z,
        activated: false,
      };
    }

    this.registerExitStairsInteractables();

    this.addEntryStairsBlockerVfx();
    this.addStageLockedConnectionBlockerVfx();

    return environmentBuild;
  }

  registerExitStairsInteractables() {
    if (!this.levelExitTrigger) {
      this.exitInteractableTargets = [];
      return;
    }

    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      colorWrite: false,
      side: THREE.DoubleSide,
    });
    const target = new THREE.Mesh(
      new THREE.PlaneGeometry(
        EXIT_INTERACTABLE_HOLE_SIZE,
        EXIT_INTERACTABLE_HOLE_SIZE
      ),
      material
    );

    target.name = "exitStairsInteractableHole";
    target.rotation.x = -Math.PI / 2;
    target.position.set(
      this.levelExitTrigger.x,
      PLAYER_GROUND_Y + EXIT_INTERACTABLE_HOLE_Y,
      this.levelExitTrigger.z
    );
    target.userData.interactable = {
      type: "levelExit",
    };
    target.userData.role = "exitStairsFloorHole";

    this.levelGroup.add(target);
    this.exitInteractableTargets = [target];
  }

  addEntryStairsBlockerVfx() {
    if (!this.vfx || !this.player) return;

    const entryStairs = this.collisionWalls.filter(
      (wall) => wall.role === "entryStairs"
    );

    for (const stairs of entryStairs) {
      this.vfx.addEntryStairsBlocker(stairs, this.player, {
        onEnterRadius: () => this.sfx.play("entryStairsBlocked"),
      });
    }
  }

  addStageLockedConnectionBlockerVfx() {
    if (!this.vfx || !this.player) return;

    this.stageLockedConnectionBlockerEffects = [];

    for (const blocker of this.stageLockedConnectionBlockers) {
      const effect = this.vfx.addStageLockedConnectionBlocker(
        blocker,
        this.player,
        {
          onEnterRadius: (blockerEffect) => {
            this.sfx.play("entryStairsBlocked");
            this.vfx.playFloatingText(
              "Defeat all enemies",
              blockerEffect.blocker,
              {
                y: 1.25,
              }
            );
          },
          isVisible: (blockerEffect) =>
            this.isStageLockedConnectionBlockerVisible(blockerEffect.blocker),
        }
      );

      if (effect) {
        this.stageLockedConnectionBlockerEffects.push(effect);
      }
    }
  }

  isStageLockedConnectionBlockerVisible(blocker) {
    const manager = this.roomVisibilityManager;
    const roomIds = blocker?.roomIds ?? [];

    if (!manager?.enabled) return true;
    if (roomIds.length === 0) return true;

    return roomIds.some((roomId) => manager.visitedRoomIds?.has?.(roomId));
  }

  addLevelEnemies(level) {
    this.enemies = (level.enemies ?? []).map((data) => this.createEnemy(data));
    this.enemy = this.enemies[0] ?? null;
    this.syncBossHud();
  }

  spawnRuntimeEnemy(data) {
    const enemy = this.createEnemy(this.applyRuntimeEnemyDifficultyScale(data));

    this.enemies.push(enemy);
    this.enemy = this.enemy ?? enemy;
    this.syncBossHud();

    return enemy;
  }

  applyRuntimeEnemyDifficultyScale(data) {
    const difficultyScale = this.currentFloorLoad?.difficultyScale ?? 1;

    if (difficultyScale === 1 || data.difficultyScaleApplied) return data;

    return {
      ...data,
      difficultyScaleApplied: true,
      maxHp: data.maxHp === undefined
        ? data.maxHp
        : Math.ceil(data.maxHp * difficultyScale),
      hp: data.hp === undefined
        ? data.hp
        : Math.ceil(data.hp * difficultyScale),
      attackDamage: data.attackDamage === undefined
        ? data.attackDamage
        : Math.round(data.attackDamage * difficultyScale),
    };
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
    enemyRoot.rotation.y = data.rotationY ?? 0;
    enemyRoot.add(enemyModel);
    this.levelGroup.add(enemyRoot);

    const patrolPoints = (data.patrol ?? [{ x: data.x, z: data.z }]).map(
      (point) => new THREE.Vector3(point.x, 0.6, point.z)
    );

    const enemy = new EnemyAI(enemyRoot, patrolPoints, {
      enemyTypeId: data.enemyTypeId,
      enemyName: data.enemyName,
      enemyDifficulty: data.enemyDifficulty,
      isBoss: data.isBoss,
      maxHp: data.maxHp,
      hp: data.hp,
      speed: data.speed,
      attackDamage: data.attackDamage,
      attackRange: data.attackRange,
      attackCooldown: data.attackCooldown,
      collisionRadius: data.collisionRadius ?? ENEMY_COLLISION_RADIUS,
      chase: data.chase,
      patrolStopRange: data.patrolStopRange,
      patrolMoveDuration: data.patrolMoveDuration,
      patrolPauseDurations: data.patrolPauseDurations,
      coinDrop: data.coinDrop,
      potionDrop: data.potionDrop,
      boss: data.boss,
      patrolAreas: data.patrolAreas,
      navigation: this.createEnemyNavigation(),
    });

    enemy.roomId = data.roomId;
    enemy.roomTemplateId = data.roomTemplateId;
    enemyRoot.userData.enemy = enemy;

    return enemy;
  }

  getBossEnemies() {
    return this.enemies.filter((enemy) => enemy?.isBoss);
  }

  getPrimaryBossEnemy() {
    return this.getBossEnemies()[0] ?? null;
  }

  hasLivingBoss() {
    return this.getBossEnemies().some((enemy) => enemy?.alive);
  }

  isBossFloor() {
    return (
      this.currentFloorLoad?.floorType === "boss" ||
      this.currentLevel?.floorType === "boss"
    );
  }

  isBossExitLocked() {
    return this.isBossFloor() && this.hasLivingBoss();
  }

  onStageCleared() {
    this.bossExitBlockedNotified = false;
    this.chestManager?.unlockStageClearRewards?.();
    this.unlockStageLockedConnections();
  }

  unlockStageLockedConnections() {
    if (
      this.stageLockedConnectionBlockers.length === 0 &&
      this.stageLockedConnectionBlockerEffects.length === 0
    ) {
      return;
    }

    const lockedConnectionIds = new Set(
      this.stageLockedConnectionBlockers.map((wall) => wall.connectionId)
    );
    this.collisionWalls = this.collisionWalls.filter(
      (wall) =>
        wall.role !== "stageLockedConnection" ||
        !lockedConnectionIds.has(wall.connectionId)
    );
    this.navigationAdapter.configure({
      walkableAreas: this.walkableAreas,
      collisionWalls: this.collisionWalls,
    });
    this.stageLockedConnectionBlockers = [];

    for (const effect of this.stageLockedConnectionBlockerEffects) {
      this.vfx?.removePersistentEffect?.(effect);
    }
    this.stageLockedConnectionBlockerEffects = [];
  }

  syncBossHud() {
    if (!this.hud?.updateBoss) return;

    const boss = this.getPrimaryBossEnemy();
    this.updateBossHudDiscovery();

    if (!this.isBossFloor() || !boss || !this.bossHudDiscovered || this.player?.hp <= 0) {
      this.hud.hideBoss?.();
      return;
    }

    this.hud.updateBoss(boss);
  }

  updateBossHudDiscovery() {
    if (this.bossHudDiscovered || !this.isBossFloor()) return;

    const room = this.getCurrentVisibilityRoom();
    if (room?.type !== "boss") return;

    this.bossHudDiscovered = true;
  }

  getCurrentVisibilityRoom() {
    const manager = this.roomVisibilityManager;
    const roomId = manager?.currentRoomId;

    if (!roomId || !manager?.rooms?.get) return null;

    return manager.rooms.get(roomId) ?? null;
  }

  getEnemyClickTargets() {
    return this.enemies
      .filter((enemy) => enemy?.alive && enemy.model?.visible !== false)
      .map((enemy) => enemy.model);
  }

  getInteractableClickTargets() {
    const chests = (this.chestManager?.chests ?? [])
      .filter((chest) => !chest.collected && chest.model?.visible !== false)
      .map((chest) => chest.model);
    const shopStands = (this.shopManager?.stands ?? [])
      .filter((stand) => stand.model?.visible !== false)
      .map((stand) => stand.model);
    const shopFountains = (this.shopManager?.fountains ?? [])
      .filter((fountain) => fountain.model?.visible !== false)
      .map((fountain) => fountain.model);
    const itemDrops = this.itemDropManager?.getInteractableTargets?.() ?? [];
    const exitStairs = (this.exitInteractableTargets ?? []).filter(
      (target) => target.visible !== false
    );

    return [...chests, ...shopStands, ...shopFountains, ...itemDrops, ...exitStairs];
  }

  handleWorldClick(payload) {
    if (this.isPlayerControlLocked()) return;

    const chest = this.getChestFromInteractable(payload?.interactable);
    if (chest) {
      this.cancelStoredActionIntents();
      this.handleChestClick(chest, payload);
      return;
    }

    const shopStand = this.getShopStandFromInteractable(payload?.interactable);
    if (shopStand) {
      this.cancelStoredActionIntents();
      this.handleShopStandClick(shopStand, payload);
      return;
    }

    const shopFountain = this.getShopFountainFromInteractable(payload?.interactable);
    if (shopFountain) {
      this.cancelStoredActionIntents();
      this.handleShopFountainClick(shopFountain, payload);
      return;
    }

    const itemDrop = this.getItemDropFromInteractable(payload?.interactable);
    if (itemDrop) {
      this.cancelStoredActionIntents();
      this.handleItemDropClick(itemDrop, payload);
      return;
    }

    if (payload?.interactable?.type === "levelExit") {
      this.cancelStoredActionIntents();
      this.handleLevelExitClick(payload);
      return;
    }

    if (!payload?.point) return;

    this.handleDirectionalAttackClick(payload.point);
  }

  handleDirectionalAttackClick(point) {
    if (!point || !this.player) return;

    this.cancelStoredActionIntents({ keepAttack: true });
    this.player.requestDirectionalAttack(point, {
      enemies: this.enemies,
    });
  }

  handleKeyboardMovementStart() {
    if (this.isPlayerControlLocked()) return;

    this.cancelStoredActionIntents({ keepAttack: true });
    this.player?.stopMovement?.();
  }

  cancelStoredActionIntents({
    keepAttack = false,
  } = {}) {
    if (!keepAttack) {
      this.player?.clearAttackIntent?.();
    }

    // Add future delayed interactables here so manual movement/interactions clear stale actions.
    this.chestManager?.cancelPendingChestOpen?.();
    this.shopManager?.cancelPendingStandInteraction?.();
    this.shopManager?.cancelPendingFountainInteraction?.();
    this.itemDropManager?.cancelPendingItemPickup?.();
    this.hud?.hideItemTooltip?.();
  }

  getChestFromInteractable(interactable) {
    if (interactable?.type !== "chest") return null;

    return interactable.chest ?? null;
  }

  getShopStandFromInteractable(interactable) {
    if (interactable?.type !== "shop") return null;

    return this.shopManager?.findStand?.(interactable.offerId) ?? null;
  }

  getShopFountainFromInteractable(interactable) {
    if (interactable?.type !== "shopFountain") return null;

    return this.shopManager?.findFountain?.(interactable.fountainId) ?? null;
  }

  getItemDropFromInteractable(interactable) {
    return this.itemDropManager?.findDropFromInteractable?.(interactable) ?? null;
  }

  handleInteractableHover(interactable, pointer = {}) {
    const itemDrop = this.getItemDropFromInteractable(interactable);
    if (!itemDrop?.item) {
      this.hud?.hideItemTooltip?.();
      return;
    }

    this.hud?.showItemTooltip?.(itemDrop.item, pointer);
  }

  isChestInPlayerInteractionRange(chest) {
    if (!chest?.model?.position || !this.player?.model?.position) return false;

    return flatDistance(
      this.player.model.position,
      chest.model.position
    ) <= this.getChestInteractionRange(chest);
  }

  getPlayerInteractionRange() {
    const attackRange = Number.parseFloat(this.player?.attackRange);
    if (Number.isFinite(attackRange) && attackRange > 0) {
      return attackRange;
    }

    return PLAYER_INTERACTION_RANGE_FALLBACK;
  }

  getChestInteractionRange(chest) {
    return Math.max(
      chest?.triggerRange ?? 1.25,
      this.getPlayerInteractionRange()
    );
  }

  handleChestClick(chest, payload = {}) {
    this.chestManager?.cancelPendingChestOpen?.();

    if (!this.isChestInPlayerInteractionRange(chest)) {
      this.playInteractionOutOfRangeSfx();
      this.showMoveCloserFeedback(null, { showClickFeedback: false });
      return;
    }

    if (chest?.lockedUntilStageClear && !chest.stageUnlocked) {
      this.addLog("Clear the room before opening this chest.");
      return;
    }

    if (!this.chestManager?.isChestInteractable?.(chest)) return;

    this.chestManager.requestChestOpen(chest);
  }

  isShopStandInPlayerInteractionRange(stand) {
    if (!stand?.model?.position || !this.player?.model?.position) return false;

    return flatDistance(
      this.player.model.position,
      stand.model.position
    ) <= SHOP_INTERACTION_RANGE;
  }

  isShopFountainInPlayerInteractionRange(fountain) {
    if (!fountain?.model?.position || !this.player?.model?.position) return false;

    return flatDistance(
      this.player.model.position,
      fountain.model.position
    ) <= SHOP_INTERACTION_RANGE;
  }

  isItemDropInPlayerInteractionRange(itemDrop) {
    if (!itemDrop?.model?.position || !this.player?.model?.position) return false;

    return flatDistance(
      this.player.model.position,
      itemDrop.model.position
    ) <= this.getItemDropInteractionRange(itemDrop);
  }

  getItemDropInteractionRange(itemDrop) {
    return Math.max(
      this.itemDropManager?.getPickupRange?.(itemDrop) ?? 0.8,
      this.getPlayerInteractionRange()
    );
  }

  isLevelExitInPlayerInteractionRange() {
    if (!this.levelExitTrigger || !this.player?.model?.position) return false;

    return flatDistance(
      this.player.model.position,
      this.levelExitTrigger
    ) <= LEVEL_EXIT_INTERACTION_RANGE;
  }

  showMoveCloserFeedback(position = null, { showClickFeedback = true } = {}) {
    this.addLog(INTERACTION_OUT_OF_RANGE_MESSAGE);

    if (showClickFeedback && position) {
      this.createClickFeedback(position, {
        color: INTERACTION_CLICK_FEEDBACK_COLOR,
      });
    }
  }

  playInteractionOutOfRangeSfx() {
    this.sfx?.play?.("interactionOutOfRange");
  }

  handleShopStandClick(stand, payload = {}) {
    this.shopManager?.cancelPendingStandInteraction?.(stand);

    if (!this.isShopStandInPlayerInteractionRange(stand)) {
      this.showMoveCloserFeedback(payload.point ?? stand?.model?.position);
      return;
    }

    const result = this.shopManager?.requestStandInteraction?.(stand);
    if (!result) return;
  }

  handleShopFountainClick(fountain, payload = {}) {
    this.shopManager?.cancelPendingFountainInteraction?.(fountain);

    if (!this.isShopFountainInPlayerInteractionRange(fountain)) {
      this.showMoveCloserFeedback(payload.point ?? fountain?.model?.position);
      return;
    }

    const result = this.shopManager?.requestFountainInteraction?.(fountain);
    if (!result) return;
  }

  handleItemDropClick(itemDrop, payload = {}) {
    if (!this.itemDropManager?.isItemDropInteractable?.(itemDrop)) return;
    this.itemDropManager?.cancelPendingItemPickup?.(itemDrop);

    if (!this.isItemDropInPlayerInteractionRange(itemDrop)) {
      this.playInteractionOutOfRangeSfx();
      this.showMoveCloserFeedback(null, { showClickFeedback: false });
      return;
    }

    this.itemDropManager.requestItemPickup(itemDrop);
  }

  handleLevelExitClick(payload = {}) {
    if (!this.levelExitTrigger || this.levelExitTrigger.activated) return;

    if (!this.isLevelExitInPlayerInteractionRange()) {
      this.showMoveCloserFeedback(payload.point ?? this.levelExitTrigger);
      return;
    }

    this.tryActivateLevelExit({ forceLockedMessage: true });
  }

  createEnemyNavigation() {
    return {
      canMoveBetween: (from, to, radius) =>
        this.navigationAdapter.canMoveBetween(from, to, radius),
      findPath: (from, to, radius) =>
        this.navigationAdapter.findPath(from, to, radius),
      findReachableTargetNear: (from, to, radius) =>
        this.navigationAdapter.findReachableTargetNear(from, to, radius),
      getRandomWalkablePoint: (areas, radius, origin) =>
        this.navigationAdapter.getRandomWalkablePoint(areas, radius, origin),
    };
  }

  createClickFeedback(position, options = {}) {
    if (!position) return;

    const radius = options.radius ?? 0.36;
    const thickness = options.thickness ?? Math.max(0.045, radius * 0.16);
    const material = new THREE.MeshBasicMaterial({
      color: options.color ?? INTERACTION_CLICK_FEEDBACK_COLOR,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(radius, radius + thickness, 48),
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

  applyPlayerWorldCollision(previousPosition) {
    const currentPosition = this.player.model.position;
    const movementRadius = this.getPlayerMovementCollisionRadius();

    if (
      this.navigationAdapter.canMoveBetween(
        previousPosition,
        currentPosition,
        movementRadius
      )
    ) {
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
      const recoveryPath = this.navigationAdapter.findPath(
        previousPosition,
        recoveryTarget,
        PLAYER_COLLISION_RADIUS
      );

      if (this.player.applyRecoveryPath?.(recoveryPath)) {
        return;
      }
    }

    this.player.clearTarget();
  }

  applyPlayerEnemyCollision(previousPosition) {
    if (!this.player || this.player.hp <= 0) return;

    const currentPosition = this.player.model.position;
    const playerRadius = this.getPlayerMovementCollisionRadius();
    let collision = null;

    for (const enemy of this.enemies) {
      if (!enemy?.alive) continue;
      if (enemy.model?.visible === false) continue;
      if (!enemy.model?.position) continue;

      const enemyRadius =
        (enemy.collisionRadius ?? ENEMY_COLLISION_RADIUS) *
        PLAYER_ENEMY_COLLISION_RADIUS_SCALE;
      const combinedRadius =
        playerRadius + enemyRadius + PLAYER_ENEMY_COLLISION_SKIN;
      const hit = this.getSegmentCircleCollision(
        previousPosition,
        currentPosition,
        enemy.model.position,
        combinedRadius
      );

      if (!hit) continue;

      if (typeof enemy.startChase === "function") {
        enemy.startChase(this.player, "collision");
      }

      if (!collision || hit.t < collision.hit.t) {
        collision = { enemy, hit, combinedRadius };
      }
    }

    if (!collision) return;

    const nextPosition = this.getPlayerEnemyCollisionStopPosition(
      previousPosition,
      currentPosition,
      collision.enemy.model.position,
      collision.hit,
      collision.combinedRadius,
      playerRadius
    );

    currentPosition.copy(nextPosition);
    this.player.stopMovement();
  }

  getPlayerEnemyCollisionStopPosition(
    previousPosition,
    currentPosition,
    enemyPosition,
    hit,
    combinedRadius,
    playerRadius
  ) {
    if (hit.startedInside) {
      const pushDirection = currentPosition.clone().sub(enemyPosition);
      pushDirection.y = 0;

      if (pushDirection.lengthSq() <= 0.0001) {
        pushDirection.copy(previousPosition).sub(enemyPosition);
        pushDirection.y = 0;
      }

      if (pushDirection.lengthSq() <= 0.0001) {
        pushDirection.set(1, 0, 0);
      }

      if (pushDirection.lengthSq() > 0.0001) {
        pushDirection.normalize();
        const pushedPosition = new THREE.Vector3(
          enemyPosition.x + pushDirection.x * combinedRadius,
          PLAYER_GROUND_Y,
          enemyPosition.z + pushDirection.z * combinedRadius
        );

        if (
          this.navigationAdapter.canMoveBetween(
            previousPosition,
            pushedPosition,
            playerRadius
          )
        ) {
          return pushedPosition;
        }
      }

      return previousPosition.clone();
    }

    const movement = currentPosition.clone().sub(previousPosition);
    const safeT = Math.max(0, hit.t - 0.02);
    const stopPosition = previousPosition
      .clone()
      .addScaledVector(movement, safeT);

    stopPosition.y = PLAYER_GROUND_Y;
    return stopPosition;
  }

  getSegmentCircleCollision(from, to, center, radius) {
    const start = new THREE.Vector2(from.x, from.z);
    const end = new THREE.Vector2(to.x, to.z);
    const circle = new THREE.Vector2(center.x, center.z);
    const movement = end.clone().sub(start);
    const startOffset = start.clone().sub(circle);
    const radiusSq = radius * radius;

    if (startOffset.lengthSq() <= radiusSq) {
      return {
        t: 0,
        startedInside: true,
      };
    }

    const a = movement.lengthSq();
    if (a <= 0.000001) return null;

    const b = 2 * startOffset.dot(movement);
    const c = startOffset.lengthSq() - radiusSq;
    const discriminant = b * b - 4 * a * c;

    if (discriminant < 0) return null;

    const sqrtDiscriminant = Math.sqrt(discriminant);
    const t = (-b - sqrtDiscriminant) / (2 * a);

    if (t < 0 || t > 1) return null;

    return {
      t,
      startedInside: false,
    };
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
      this.navigationAdapter.canMoveBetween(previousPosition, candidate, radius)
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

  getPlayerDashDestination(start, direction, distance) {
    if (!start || !direction || distance <= 0) return null;

    const radius = this.getPlayerMovementCollisionRadius();
    const safeDirection = direction.clone();
    safeDirection.y = 0;
    if (safeDirection.lengthSq() <= 0.000001) return null;
    safeDirection.normalize();

    const maxDistance = Math.max(0, Number.parseFloat(distance) || 0);
    const step = 0.12;
    const steps = Math.max(1, Math.ceil(maxDistance / step));
    let previous = start.clone();
    let lastValid = start.clone();

    for (let index = 1; index <= steps; index += 1) {
      const traveled = Math.min(maxDistance, index * step);
      const candidate = start.clone().addScaledVector(safeDirection, traveled);
      candidate.y = PLAYER_GROUND_Y;

      if (!this.navigationAdapter.canMoveBetween(previous, candidate, radius)) {
        break;
      }

      lastValid = candidate;
      previous = candidate;
    }

    return lastValid;
  }

  getPlayerNavigationDestination() {
    if (this.player.path.length > 0) {
      return this.player.path[this.player.path.length - 1].clone();
    }

    return this.player.target?.clone() ?? null;
  }

  animate() {
    const delta = this.clock.getDelta();

    if (this.isPaused) {
      this.updatePausedFrame();
      requestAnimationFrame(() => this.animate());
      return;
    }

    this.gameManager.update(delta);

    for (const enemy of this.enemies) {
      if (enemy.model?.visible === false) continue;
      enemy.update(delta, this.camera, this.player);
    }

    if (this.coinManager) this.coinManager.update(delta);
    if (this.itemDropManager) this.itemDropManager.update(delta);
    if (this.shopManager) this.shopManager.update(delta);
    if (this.vfx) this.vfx.update(delta, this.camera);

    const keyboardMovementInput = this.getKeyboardMovementInput();
    const previousPlayerPosition = this.player.model.position.clone();

    this.player.update(delta, keyboardMovementInput);
    this.applyPlayerWorldCollision(previousPlayerPosition);
    this.applyPlayerEnemyCollision(previousPlayerPosition);
    this.roomVisibilityManager.update(this.player.model.position, delta);

    const events = this.eventRouter.collectFrameEvents();
    this.handleGameEvents(events);
    this.syncBossHud();
    this.chestManager.update(delta);
    this.checkLevelExitTrigger();
    this.updateClickEffects(delta);
    this.updateFeedbackEffects(delta);
    this.updateCamera(delta);
    this.player.updateOcclusionMarker(this.camera, this.wallMeshes);
    this.updateAttackCursorFeedback();
    this.hud?.updateAbilitySlot?.(this.player, this.inventory);
    this.inputController?.updateCursor?.();
    this.renderer.render(this.scene, this.camera);

    requestAnimationFrame(() => this.animate());
  }

  getKeyboardMovementInput() {
    if (this.isPlayerControlLocked()) return null;

    const movementInput = this.inputController?.getMovementInput?.();
    if (!movementInput || movementInput.lengthSq() <= 0.000001) return null;

    return movementInput;
  }

  handleDashPressed() {
    if (this.isPlayerControlLocked()) return;
    if (!this.player) return;

    const direction = this.getPlayerDashDirection();

    this.player.requestDash(direction, {
      resolveDestination: (start, dashDirection, distance) =>
        this.getPlayerDashDestination(start, dashDirection, distance),
    });
  }

  getPlayerDashDirection() {
    const movementInput = this.getKeyboardMovementInput();
    if (movementInput && movementInput.lengthSq() > 0.000001) {
      return movementInput;
    }

    const pointerPoint = this.inputController?.getPointerWorldPoint?.();
    const playerPosition = this.player?.model?.position;
    if (pointerPoint && playerPosition) {
      const pointerDirection = new THREE.Vector3(
        pointerPoint.x - playerPosition.x,
        0,
        pointerPoint.z - playerPosition.z
      );

      if (pointerDirection.lengthSq() > 0.000001) return pointerDirection;
    }

    const facing = this.player?.visualRotation ?? this.player?.model?.rotation?.y ?? 0;
    return new THREE.Vector3(Math.sin(facing), 0, Math.cos(facing));
  }

  isKeyboardMovementActive() {
    return Boolean(this.getKeyboardMovementInput());
  }

  useInventorySlot(slotIndex) {
    if (this.isPlayerControlLocked()) return;
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

      case "addGold":
        this.addDebugGold();
        break;

      case "nextLevel":
        this.triggerDebugNextLevel();
        break;

      default:
        console.warn("Unknown debug cheat", cheat);
        break;
    }

    this.handleGameEvents(this.player.consumeEvents());
    this.updateHud();
  }

  applyDebugItemCheat(item, delta) {
    if (!this.player || !this.inventory || !item) return;

    console.log("debugItemCheatSelected", {
      itemId: item.id,
      delta,
    });

    if (delta > 0) {
      this.inventory.pickupItem(item.id, {
        source: "debugCheat",
        scene: this,
      });
    } else if (delta < 0) {
      this.inventory.removeItem(item.id, {
        source: "debugCheat",
        scene: this,
      });
    }

    const events = [
      ...this.inventory.consumeEvents(),
      ...this.player.consumeEvents(),
    ];

    if (events.length > 0) {
      this.handleGameEvents(events);
    }

    this.updateHud();
  }

  addDebugGold() {
    this.player.addGold(DEBUG_GOLD_AMOUNT);
    this.addLog(`Debug cheat: +${DEBUG_GOLD_AMOUNT} gold.`);
  }

  triggerDebugNextLevel() {
    if (this.levelExitTrigger) {
      this.levelExitTrigger.activated = true;
    }

    this.addLog("Debug cheat: Next Level.");
    console.log("debugNextLevelTriggered", {
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

  getDebugCheatStates() {
    return {
      superSpeed: this.debugCheatState.superSpeed.active,
      exterminator: this.debugCheatState.exterminator.active,
    };
  }

  getDebugItemCheatStates() {
    if (!this.inventory) return {};

    const entries = [
      ...this.inventory.getPassiveEntries(),
      ...this.inventory.getConsumableEntries(),
    ];

    return Object.fromEntries(
      entries.map((entry) => [entry.item.baseItemId ?? entry.item.id, entry.count])
    );
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

    if (distance > LEVEL_EXIT_INTERACTION_RANGE) return;

    this.tryActivateLevelExit();
  }

  tryActivateLevelExit({ forceLockedMessage = false } = {}) {
    if (!this.levelExitTrigger || this.levelExitTrigger.activated) return false;

    if (this.gameManager.isStageExitLocked()) {
      if (forceLockedMessage || !this.bossExitBlockedNotified) {
        this.addLog(this.gameManager.getStageExitLockedMessage());
        this.bossExitBlockedNotified = true;
      }
      return false;
    }

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
    return true;
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
    this.eventRouter.route(events);
  }

  playEnemyDamageFlash(enemy, color) {
    if (!enemy?.model) return;

    if (enemy.isBoss) {
      this.vfx?.playModelFlash?.(enemy.model, color, 0.18, {
        emissiveIntensity: 1.4,
      });
      return;
    }

    this.flashModel(enemy.model, color, 0.12);
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
    this.hud?.updateAbilitySlot?.(this.player, this.inventory);
    this.syncBossHud();
  }

  addLog(message) {
    this.hud.addLog(message);
  }

  updateAttackCursorFeedback() {
    if (!this.player || !this.inputController?.setAttackFeedback) return;

    this.inputController.setAttackFeedback(
      this.player.getAttackFeedbackState?.() ?? {}
    );
  }

  nowMs() {
    return globalThis.performance?.now?.() ?? Date.now();
  }

  getRenderPixelRatio() {
    return Math.min(window.devicePixelRatio || 1, MAX_RENDER_PIXEL_RATIO);
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
    this.renderer.setPixelRatio(this.getRenderPixelRatio());
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
