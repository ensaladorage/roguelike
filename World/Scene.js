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
<<<<<<< HEAD
import { CoinManager } from "./Coin.js";
import { Environment } from "./Environment.js";
=======
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { OutlinePass } from "three/addons/postprocessing/OutlinePass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { FXAAShader } from "three/addons/shaders/FXAAShader.js";
>>>>>>> f7b05e759bd4449ca4a7c5e3e6db122cdd20a069

const PLAYER_GROUND_Y = 0;
const PLAYER_COLLISION_RADIUS = 0.32;
const WALL_HEIGHT = 1.65;
const WALL_THICKNESS = 0.34;
const FLOOR_Y = 0.01;
const NAV_GRID_SIZE = 0.7;

const LEVELS = [
  {
    name: "Nivel 1",
    playerStart: { x: 0, z: 17.2 },
    floorSize: 48,
    floorPatches: [
      { x: 0, z: 14.5, w: 4, d: 11, color: 0x27312f },
      { x: 0, z: -15.55, w: 4, d: 13.1, color: 0x27312f },
      { x: -11.25, z: 0, w: 1.5, d: 18, color: 0x303735 },
      { x: -0.15, z: 0, w: 6.7, d: 18, color: 0x303735 },
      { x: 11.1, z: 0, w: 1.8, d: 18, color: 0x303735 },
      { x: -7, z: -4.25, w: 7, d: 9.5, color: 0x303735 },
      { x: -7, z: 7.75, w: 7, d: 2.5, color: 0x303735 },
      { x: 6.7, z: -8.1, w: 7, d: 1.8, color: 0x303735 },
      { x: 6.7, z: -0.05, w: 7, d: 4.3, color: 0x303735 },
      { x: 6.7, z: 8.05, w: 7, d: 1.9, color: 0x303735 },
      { x: -7, z: 3.5, w: 7, d: 6, color: 0x3a3428 },
      { x: 6.7, z: -4.7, w: 7, d: 5, color: 0x2c3a3d },
      { x: 6.7, z: 4.6, w: 7, d: 5, color: 0x35383f },
    ],
    walkableAreas: [
      { x: 0, z: 14, w: 4, d: 12 },
      { x: 0, z: 0, w: 24, d: 18 },
      { x: 0, z: -15.1, w: 4, d: 14 },
    ],
    rooms: [
      {
        x: -7,
        z: 3.5,
        w: 7,
        d: 6,
        door: { side: "east", offset: 0, width: 2.3 },
      },
      {
        x: 6.7,
        z: -4.7,
        w: 7,
        d: 5,
        door: { side: "west", offset: 0, width: 2.1 },
      },
      {
        x: 6.7,
        z: 4.6,
        w: 7,
        d: 5,
        door: { side: "west", offset: 0, width: 2.1 },
      },
    ],
    outerWalls: [
      { x: -2.17, z: 14, w: WALL_THICKNESS, d: 12 },
      { x: 2.17, z: 14, w: WALL_THICKNESS, d: 12 },
      { x: 0, z: 20.17, w: 4.34, d: WALL_THICKNESS },
      { x: -12.17, z: 0, w: WALL_THICKNESS, d: 18.34 },
      { x: 12.17, z: 0, w: WALL_THICKNESS, d: 18.34 },
      { x: -7, z: 9.17, w: 10, d: WALL_THICKNESS },
      { x: 7, z: 9.17, w: 10, d: WALL_THICKNESS },
      { x: -7, z: -9.17, w: 10, d: WALL_THICKNESS },
      { x: 7, z: -9.17, w: 10, d: WALL_THICKNESS },
      { x: -2.17, z: -15.1, w: WALL_THICKNESS, d: 14 },
      { x: 2.17, z: -15.1, w: WALL_THICKNESS, d: 14 },
      { x: 0, z: -22.27, w: 4.34, d: WALL_THICKNESS },
    ],
    chests: [
      { x: -9.7, z: 2.2, rotationY: Math.PI / 2, gold: 18 },
      { x: -6.1, z: 5.7, rotationY: Math.PI, gold: 25 },
      { x: 5.2, z: -6.4, rotationY: 0, gold: 32 },
      { x: 9.4, z: -4.0, rotationY: -Math.PI / 2, gold: 22 },
      { x: 9.4, z: 3.6, rotationY: -Math.PI / 2, gold: 28 },
      { x: 6.3, z: 6.3, rotationY: Math.PI, gold: 36 },
    ],
    enemies: [
      {
        x: -1.7,
        z: 7.7,
        coinDrop: { count: 5, value: 4, radius: 0.58 },
        patrol: [
          { x: -1.7, z: 7.7 },
          { x: -3.6, z: 3.5 },
          { x: -7.3, z: 3.2 },
          { x: -3.6, z: 3.5 },
          { x: -1.7, z: 1.0 },
          { x: 2.4, z: 1.0 },
          { x: 2.4, z: 7.7 },
        ],
      },
      {
        x: 2.4,
        z: -8.0,
        coinDrop: { count: 6, value: 3, radius: 0.65 },
        patrol: [
          { x: 2.4, z: -8.0 },
          { x: 10.8, z: -8.0 },
          { x: 10.8, z: -1.6 },
          { x: 2.4, z: -1.6 },
          { x: 2.4, z: -4.7 },
          { x: 3.1, z: -4.7 },
          { x: 6.9, z: -4.8 },
          { x: 3.1, z: -4.7 },
          { x: 2.4, z: -1.6 },
          { x: 2.4, z: 4.6 },
          { x: 3.1, z: 4.6 },
          { x: 7.2, z: 4.7 },
          { x: 3.1, z: 4.6 },
          { x: 2.4, z: 4.6 },
          { x: 2.4, z: -8.0 },
        ],
      },
    ],
    exit: { x: 0, z: -20.45, nextLevel: 1 },
  },
  {
    name: "Nivel 2",
    playerStart: { x: 0, z: 13.8 },
    floorSize: 48,
    floorPatches: [
      { x: 0, z: 0, w: 22, d: 32, color: 0x2d3536 },
    ],
    walkableAreas: [
      { x: 0, z: 0, w: 22, d: 32 },
    ],
    rooms: [],
    outerWalls: [
      { x: -11.17, z: 0, w: WALL_THICKNESS, d: 32.34 },
      { x: 11.17, z: 0, w: WALL_THICKNESS, d: 32.34 },
      { x: 0, z: 16.17, w: 22.34, d: WALL_THICKNESS },
      { x: 0, z: -16.17, w: 22.34, d: WALL_THICKNESS },
    ],
    chests: [],
    enemies: [],
    exit: { x: 0, z: -14.1, nextLevel: null, disabled: true },
  },
];

export class GameScene {
  constructor(container) {
    this.container = container;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x111317);

    this.chestManager = new ChestManager(this);
    this.models = {};
    this.loadModels = async () => {
      const loader = new GLTFLoader();
      const texLoader = new THREE.TextureLoader();

      const modelPath = (name) => `Assets/Models/${name}.glb`;
      const texPathPrimary = (name) => `Assets/Models/Textures/${name}.png`;
      const texPathFallback = (name) => `Assets/Textures/${name}.png`;

      const loadTextureAsync = (url) =>
        new Promise((resolve, reject) => {
          texLoader.load(url, (tex) => resolve(tex), undefined, (err) => reject(err));
        });

      // try to load texture from primary (moved) location first, fallback if missing
      const loadTextureWithFallback = async (name) => {
        try {
          return await loadTextureAsync(texPathPrimary(name));
        } catch (e) {
          try {
            return await loadTextureAsync(texPathFallback(name));
          } catch (e2) {
            throw e2;
          }
        }
      };

<<<<<<< HEAD
      const [playerGltf, enemyGltf, chestGltf, colormap, variationA] =
        await Promise.all([
          loader.loadAsync(modelPath("character-human")),
          loader.loadAsync(modelPath("character-orc")),
=======
      const [playerGltf, enemyGltf, coinGltf, chestGltf, colormap, variationA] =
        await Promise.all([
          loader.loadAsync(modelPath("character-human")),
          loader.loadAsync(modelPath("character-orc")),
          loader.loadAsync(modelPath("coin")),
>>>>>>> f7b05e759bd4449ca4a7c5e3e6db122cdd20a069
          loader.loadAsync(modelPath("chest")),
          loadTextureWithFallback("colormap"),
          loadTextureWithFallback("variation-a"),
        ]);

      // ensure textures are configured for glTF (no flipY)
      try {
        colormap.flipY = false;
        colormap.encoding = THREE.sRGBEncoding;
      } catch (e) {}
      try {
        variationA.flipY = false;
        variationA.encoding = THREE.sRGBEncoding;
      } catch (e) {}

      // apply a default color map to loaded models (colormap)
      const applyTexture = (gltf, tex) => {
        if (!gltf || !gltf.scene) return;
        gltf.scene.traverse((node) => {
          if (node.isMesh && node.material) {
            const apply = (m) => {
              try {
                if (m.map !== tex) {
                  m.map = tex;
                }
                if (m.map) m.map.needsUpdate = true;
                m.needsUpdate = true;
              } catch (e) {
                // ignore individual material failures
              }
            };

            if (Array.isArray(node.material)) {
              node.material.forEach(apply);
            } else {
              apply(node.material);
            }
          }
        });
      };

        applyTexture(playerGltf, colormap);
      applyTexture(enemyGltf, colormap);
      applyTexture(coinGltf, colormap);
      applyTexture(chestGltf, colormap);

      // ensure model instances cast/receive shadows when cloned
      const prepareForScene = (gltf) => {
        if (!gltf || !gltf.scene) return;
        gltf.scene.traverse((n) => {
          if (n.isMesh) {
            n.castShadow = true;
            n.receiveShadow = true;
            if (n.material) {
              if (n.material.isMeshStandardMaterial || n.material.isMeshPhysicalMaterial) {
                // Ensure texture uses sRGB color space
                if (n.material.map) {
                  n.material.map.colorSpace = THREE.SRGBColorSpace;
                }
                // Optimize material properties (avoid overly glossy/rough)
                n.material.metalness = 0;
                n.material.roughness = Math.max(n.material.roughness ?? 1, 0.7);
                n.material.needsUpdate = true;
              }
            }
          }
        });
      };

      prepareForScene(playerGltf);
      prepareForScene(enemyGltf);
<<<<<<< HEAD
=======
      prepareForScene(coinGltf);
>>>>>>> f7b05e759bd4449ca4a7c5e3e6db122cdd20a069
      prepareForScene(chestGltf);

      this.models.player = playerGltf;
      this.models.enemy = enemyGltf;
<<<<<<< HEAD
=======
      this.models.coin = coinGltf;
>>>>>>> f7b05e759bd4449ca4a7c5e3e6db122cdd20a069
      this.models.chest = chestGltf;
      this.models.textures = {
        colormap,
        "variation-a": variationA,
      };
      this.models.loaded = true;
    };

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
    // Color space & tone mapping (CRUCIAL for proper texture display)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;

    container.appendChild(this.renderer.domElement);
<<<<<<< HEAD
=======

    // Post-processing toggle (disabled by default to preserve original lighting)
    this.postProcessingEnabled = false;
    if (this.postProcessingEnabled) {
      this.setupPostProcessing?.();
    }
>>>>>>> f7b05e759bd4449ca4a7c5e3e6db122cdd20a069

    this.clock = new THREE.Clock();
    this.floorSize = 48;

    this.levelIndex = 0;
    this.levelGroup = new THREE.Group();
    this.scene.add(this.levelGroup);

    this.enemy = null;
    this.enemies = [];
    this.chests = [];
    this.coinDrops = [];
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
    this.coinOutlineEnabled = false;

    this.hud.onOutlineToggle(() => {
      this.toggleCoinOutline(!this.coinOutlineEnabled);
    });

    this.init();
  }

  async init() {
    this.addLights();
    this.addFloor();

    try {
      await this.loadModels();
    } catch (err) {
      console.error("model load failed", err);
      this.addLog("Error cargando modelos: " + (err.message || err));
      this.models.loaded = false;
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

  addLights() {
    // Hemisphere provides a sky/ground lighting balance
    const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    this.scene.add(hemi);

    // Directional sun light (primary lighting with shadows)
    const sun = new THREE.DirectionalLight(0xffffff, 1.1);
    sun.position.set(8, 14, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 50;
    sun.shadow.camera.left = -20;
    sun.shadow.camera.right = 20;
    sun.shadow.camera.top = 20;
    sun.shadow.camera.bottom = -20;
    sun.shadow.bias = -0.0001;
    this.scene.add(sun);

    // Soft ambient for fill (low intensity to avoid flatness)
    const ambient = new THREE.AmbientLight(0xffffff, 0.25);
    this.scene.add(ambient);
  }

  addFloor() {
    const geo = new THREE.PlaneGeometry(
      this.floorSize,
      this.floorSize
    );

    const mat = new THREE.MeshStandardMaterial({
      color: 0x111317,
      roughness: 0.95,
      metalness: 0,
    });

    this.floor = new THREE.Mesh(geo, mat);
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.receiveShadow = true;

    this.scene.add(this.floor);
  }

  async createPlayer() {
    let playerModel;

    if (this.models && this.models.loaded && this.models.player) {
      try {
        playerModel = SkeletonUtils.clone(this.models.player.scene);
        playerModel.traverse((child) => {
          if (!child.isMesh) return;

          child.castShadow = true;
          child.receiveShadow = true;

          if (child.material) {
            // Ensure texture uses sRGB color space
            if (child.material.map) {
              child.material.map.colorSpace = THREE.SRGBColorSpace;
            }
            // Optimize material
            if (child.material.isMeshStandardMaterial || child.material.isMeshPhysicalMaterial) {
              child.material.metalness = 0;
              child.material.roughness = Math.max(child.material.roughness ?? 1, 0.7);
              child.material.needsUpdate = true;
            }
          }
        });
        playerModel.scale.set(1.2, 1.2, 1.2);
      } catch (e) {
        console.warn("Failed to clone player model:", e);
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

    // Create root group for player (allows rotation, weapons, effects, animations, offsets)
    const playerRoot = new THREE.Group();
    playerRoot.position.y = PLAYER_GROUND_Y;
    playerRoot.add(playerModel);

    this.scene.add(playerRoot);
    this.player = new Player(playerRoot);
  }

  loadLevel(levelIndex) {
    const level = LEVELS[levelIndex];
    if (!level) return;

    this.levelIndex = levelIndex;
    this.floorSize = level.floorSize;
    this.levelGroup.clear();
    this.enemy = null;
    this.enemies = [];
    this.chests = [];
    this.coinDrops = [];
    this.walkableAreas = [];
    this.collisionWalls = [];
    this.wallMeshes = [];
    this.navBounds = null;
    this.exitButton = null;
    this.clickEffects = [];
    this.feedbackEffects = [];

    this.addLevelGeometry(level);
    this.chestManager.load(level);
    this.addLevelEnemies(level);
    this.placePlayer(level.playerStart);

    this.gameManager.setLevel(levelIndex);
    this.updateHud();
    this.addLog(`${level.name} cargado.`);
    console.log("levelLoaded", { level: levelIndex + 1, name: level.name });
  }

  hasLevel(levelIndex) {
    return Boolean(LEVELS[levelIndex]);
  }

  getNextLevelIndex() {
    return this.exitButton?.nextLevel ?? null;
  }

  placePlayer(position) {
    this.player.model.position.set(
      position.x,
      PLAYER_GROUND_Y,
      position.z
    );
    this.player.groundY = PLAYER_GROUND_Y;
    this.player.model.visible = true;
    this.player.currentEnemy = null;
    this.player.clearTarget();
  }

  addLevelGeometry(level) {
    for (const patch of level.floorPatches) {
      this.createFloorPatch(patch);
    }

    const walkableAreas = level.walkableAreas ?? level.floorPatches;

    for (const area of walkableAreas) {
      this.walkableAreas.push(area);
    }

    this.navBounds = this.calculateNavBounds(this.walkableAreas);

    for (const wall of level.outerWalls) {
      this.createWall(wall);
    }

    for (const room of level.rooms) {
      this.createRoomWalls(room);
    }

    if (level.exit) {
      this.addExitButton(level.exit);
    }
  }

  createFloorPatch(area) {
    const geo = new THREE.PlaneGeometry(area.w, area.d);
    const mat = new THREE.MeshStandardMaterial({
      color: area.color,
      roughness: 0.9,
      metalness: 0,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(area.x, FLOOR_Y, area.z);
    mesh.receiveShadow = true;

    this.levelGroup.add(mesh);
  }

  createRoomWalls(room) {
    const west = room.x - room.w / 2;
    const east = room.x + room.w / 2;
    const north = room.z - room.d / 2;
    const south = room.z + room.d / 2;

    this.createRoomWallSide(
      room,
      "north",
      room.x,
      north,
      room.w,
      WALL_THICKNESS
    );
    this.createRoomWallSide(
      room,
      "south",
      room.x,
      south,
      room.w,
      WALL_THICKNESS
    );
    this.createRoomWallSide(
      room,
      "west",
      west,
      room.z,
      WALL_THICKNESS,
      room.d
    );
    this.createRoomWallSide(
      room,
      "east",
      east,
      room.z,
      WALL_THICKNESS,
      room.d
    );
  }

  createRoomWallSide(room, side, x, z, w, d) {
    if (room.door.side !== side) {
      this.createWall({ x, z, w, d });
      return;
    }

    if (side === "north" || side === "south") {
      this.createHorizontalWallWithOpening(room, z);
      return;
    }

    this.createVerticalWallWithOpening(room, x);
  }

  createHorizontalWallWithOpening(room, z) {
    const wallStart = room.x - room.w / 2;
    const wallEnd = room.x + room.w / 2;
    const openingCenter = room.x + room.door.offset;
    const openingStart = openingCenter - room.door.width / 2;
    const openingEnd = openingCenter + room.door.width / 2;

    this.createWallFromRange(wallStart, openingStart, z, "horizontal");
    this.createWallFromRange(openingEnd, wallEnd, z, "horizontal");
  }

  createVerticalWallWithOpening(room, x) {
    const wallStart = room.z - room.d / 2;
    const wallEnd = room.z + room.d / 2;
    const openingCenter = room.z + room.door.offset;
    const openingStart = openingCenter - room.door.width / 2;
    const openingEnd = openingCenter + room.door.width / 2;

    this.createWallFromRange(wallStart, openingStart, x, "vertical");
    this.createWallFromRange(openingEnd, wallEnd, x, "vertical");
  }

  createWallFromRange(start, end, fixed, axis) {
    const length = end - start;
    if (length <= 0.1) return;

    const center = start + length / 2;

    if (axis === "horizontal") {
      this.createWall({
        x: center,
        z: fixed,
        w: length,
        d: WALL_THICKNESS,
      });
      return;
    }

    this.createWall({
      x: fixed,
      z: center,
      w: WALL_THICKNESS,
      d: length,
    });
  }

  createWall(piece) {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x15191c,
      roughness: 0.8,
    });

    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(piece.w, WALL_HEIGHT, piece.d),
      mat
    );

    mesh.position.set(piece.x, WALL_HEIGHT / 2, piece.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    this.levelGroup.add(mesh);
    this.collisionWalls.push(piece);
    this.wallMeshes.push(mesh);
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
      nextLevel: exit.nextLevel,
      disabled: Boolean(exit.disabled),
      activated: false,
    };
  }

  addLevelEnemies(level) {
    this.enemies = level.enemies.map((data) =>
      this.createEnemy(data)
    );

    this.enemy = this.enemies[0] ?? null;
  }

  createEnemy(data) {
    let enemyModel;
    if (this.models.loaded) {
      enemyModel = SkeletonUtils.clone(this.models.enemy.scene);
      enemyModel.traverse((child) => {
        if (!child.isMesh) return;

        child.castShadow = true;
        child.receiveShadow = true;

        if (child.material) {
          // Ensure texture uses sRGB color space
          if (child.material.map) {
            child.material.map.colorSpace = THREE.SRGBColorSpace;
          }
          // Optimize material
          if (child.material.isMeshStandardMaterial || child.material.isMeshPhysicalMaterial) {
            child.material.metalness = 0;
            child.material.roughness = Math.max(child.material.roughness ?? 1, 0.7);
            child.material.needsUpdate = true;
          }
        }
      });
      enemyModel.scale.set(1.2, 1.2, 1.2);
    } else {
      enemyModel = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 1.2, 0.8),
        new THREE.MeshStandardMaterial({ color: 0xb74343 })
      );
      enemyModel.castShadow = true;
      enemyModel.receiveShadow = true;
    }

    // Create root group for enemy (allows rotation, effects, animations, offsets)
    const enemyRoot = new THREE.Group();
    enemyRoot.position.set(data.x, 0, data.z);
    enemyRoot.add(enemyModel);
    this.levelGroup.add(enemyRoot);

    const patrolPoints = data.patrol.map(
      (point) => new THREE.Vector3(point.x, 0.6, point.z)
    );

    return new EnemyAI(enemyRoot, patrolPoints, {
      coinDrop: data.coinDrop,
    });
  }

  addCoinDrops(coins) {
    for (const coin of coins) {
      const model = this.createCoinModel();

      const resolved = this.resolveDropPosition(
        coin.position.clone(),
        coin.fallbackOrigin ? coin.fallbackOrigin.clone() : coin.position.clone()
      );

      model.position.copy(resolved);
      model.position.y = 0.08;

      this.levelGroup.add(model);

      // mark spawned coin as outlined via post-processing
      this.addOutlineFor?.(model);

      this.coinDrops.push({
        model,
        value: coin.value,
        collected: false,
        spinSpeed: 1.4 + Math.random() * 1.1,
      });
    }
  }

  resolveDropPosition(position, fallbackOrigin) {
    if (this.isWalkablePosition(position, 0.12)) {
      position.y = 0;
      return position;
    }

    const fallback = fallbackOrigin.clone();
    fallback.y = 0;
    return fallback;
  }

 createCoinModel() {
  let coinRoot;

  // =========================
  // 1. MODELO (GLTF si existe)
  // =========================
  if (this.models?.loaded && this.models.coin) {
    const cloned = SkeletonUtils.clone(this.models.coin.scene);

    cloned.traverse((child) => {
      if (!child.isMesh) return;

      child.castShadow = true;
      child.receiveShadow = true;

      if (child.material?.map) {
        child.material.map.colorSpace = THREE.SRGBColorSpace;
      }

      if (
        child.material?.isMeshStandardMaterial ||
        child.material?.isMeshPhysicalMaterial
      ) {
        child.material.metalness = 0;
        child.material.roughness = 0.8;
      }
    });

    coinRoot = cloned;
  }

  // =========================
  // 2. FALLBACK PRIMITIVO
  // =========================
  if (!coinRoot) {
    const group = new THREE.Group();

    const coinMat = new THREE.MeshStandardMaterial({
      color: 0xe0bb42,
      emissive: 0x3b2b06,
      roughness: 0.35,
      metalness: 0.35,
    });

    const coin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 0.055, 24),
      coinMat
    );

    coin.userData.ignoreFlash = true;
    group.add(coin);

    const shine = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.06, 0.19),
      new THREE.MeshBasicMaterial({ color: 0xffec95 })
    );

    shine.position.y = 0.035;
    shine.userData.ignoreFlash = true;
    group.add(shine);

    coinRoot = group;
  }

  // =========================
  // 3. ZELDA PULSE EFFECT DATA
  // =========================
  coinRoot.userData.pulse = {
    baseScale: 1,
    t: Math.random() * Math.PI * 2, // desincroniza monedas
    speed: 2.2,
    amplitude: 0.08,
  };

  coinRoot.rotation.y = Math.random() * Math.PI * 2;
  coinRoot.rotation.x = (Math.random() - 0.5) * 0.16;

  return coinRoot;
}

  // Post-processing / Outline helpers
  setupPostProcessing() {
    try {
      this.composer = new EffectComposer(this.renderer);
      this.composer.setSize(window.innerWidth, window.innerHeight);

      const renderPass = new RenderPass(this.scene, this.camera);
      this.composer.addPass(renderPass);

      this.outlinePass = new OutlinePass(new THREE.Vector2(window.innerWidth, window.innerHeight), this.scene, this.camera);
      this.outlinePass.edgeStrength = 3.0;
      this.outlinePass.edgeGlow = 0.6;
      this.outlinePass.visibleEdgeColor.setHex(0xffdf5d);
      this.outlinePass.hiddenEdgeColor.setHex(0x332200);
      this.outlinePass.selectedObjects = [];
      this.composer.addPass(this.outlinePass);

      this.fxaaPass = new ShaderPass(FXAAShader);
      if (this.fxaaPass.material && this.fxaaPass.material.uniforms && this.fxaaPass.material.uniforms.resolution) {
        this.fxaaPass.material.uniforms.resolution.value.set(1 / window.innerWidth, 1 / window.innerHeight);
      }
      this.composer.addPass(this.fxaaPass);
    } catch (e) {
      console.warn("Post-processing setup failed:", e);
      this.composer = null;
      this.outlinePass = null;
      this.fxaaPass = null;
    }
  }

  addOutlineFor(object) {
    if (!this.outlinePass) return;
    if (!this.outlinePass.selectedObjects) this.outlinePass.selectedObjects = [];
    if (!this.outlinePass.selectedObjects.includes(object)) {
      this.outlinePass.selectedObjects.push(object);
    }
  }

  removeOutlineFor(object) {
    if (!this.outlinePass || !this.outlinePass.selectedObjects) return;
    const idx = this.outlinePass.selectedObjects.indexOf(object);
    if (idx !== -1) this.outlinePass.selectedObjects.splice(idx, 1);
  }

  toggleCoinOutline(enabled) {
    this.coinOutlineEnabled = enabled;
    this.hud.setOutlineButtonState(enabled);
    this.postProcessingEnabled = enabled;

    if (enabled && !this.composer) {
      this.setupPostProcessing();
    }

    if (!this.outlinePass) return;

    if (enabled) {
      for (const coin of this.coinDrops) {
        if (coin.model && !this.outlinePass.selectedObjects.includes(coin.model)) {
          this.addOutlineFor(coin.model);
        }
      }
      this.addLog("Outline de monedas activado.");
    } else {
      for (const coin of this.coinDrops) {
        if (coin.model) {
          this.removeOutlineFor(coin.model);
        }
      }
      this.addLog("Outline de monedas desactivado.");
    }
  }

  createClickFeedback(position) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0x63d982,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(0.32, 0.39, 48),
      mat
    );

    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(position.x, 0.07, position.z);
    mesh.renderOrder = 40;

    this.levelGroup.add(mesh);
    this.clickEffects.push({
      mesh,
      material: mat,
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

  findNavigationPath(from, to) {
    if (!this.navBounds) return [];

    if (this.canMoveBetween(from, to)) {
      return [to.clone()];
    }

    const start = this.worldToNavCell(from);
    const goal = this.worldToNavCell(to);

    if (!this.isNavCellWalkable(start)) return [];
    if (!this.isNavCellWalkable(goal)) return [];

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
          this.reconstructNavigationPath(cameFrom, current).concat(
            to.clone()
          )
        );
      }

      closed.add(currentKey);

      for (const neighbor of this.getNavNeighbors(current)) {
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

  isNavCellWalkable(cell) {
    const position = this.navCellToWorld(cell);
    return this.isWalkablePosition(position, PLAYER_COLLISION_RADIUS);
  }

  getNavNeighbors(cell) {
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
      if (!this.isNavCellWalkable(neighbor)) continue;

      const currentWorld = this.navCellToWorld(cell);
      const neighborWorld = this.navCellToWorld(neighbor);

      if (!this.canMoveBetween(currentWorld, neighborWorld)) continue;

      if (
        dir.x !== 0 &&
        dir.z !== 0 &&
        (!this.isNavCellWalkable({ x: cell.x + dir.x, z: cell.z }) ||
          !this.isNavCellWalkable({ x: cell.x, z: cell.z + dir.z }))
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

  simplifyNavigationPath(points) {
    if (points.length <= 2) return points;

    const simplified = [];
    let anchor = this.player.model.position.clone();
    let index = 0;

    while (index < points.length) {
      let nextIndex = index;

      for (let i = points.length - 1; i >= index; i -= 1) {
        if (this.canMoveBetween(anchor, points[i])) {
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

    if (!this.isWalkablePosition(target, PLAYER_COLLISION_RADIUS)) {
      return null;
    }

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

  canMoveBetween(from, to) {
    const target = {
      x: to.x,
      z: to.z,
    };

    return (
      this.isWalkablePosition(target, PLAYER_COLLISION_RADIUS) &&
      !this.movementHitsWall(from, to, PLAYER_COLLISION_RADIUS)
    );
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

    for (const coin of this.coinDrops) {
      if (!coin.model?.userData?.pulse) continue;

      const pulse = coin.model.userData.pulse;
      pulse.t += delta * pulse.speed;

      const s = pulse.baseScale + Math.sin(pulse.t) * pulse.amplitude;
      coin.model.scale.set(s, s, s);
    }

    this.updateCoinDrops(delta);

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

<<<<<<< HEAD
    this.renderer.render(this.scene, this.camera);
=======
    if (this.postProcessingEnabled && this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
>>>>>>> f7b05e759bd4449ca4a7c5e3e6db122cdd20a069

    requestAnimationFrame(() => this.animate());
  }

  checkCoinProximity() {
    const playerPos = this.player.model.position;

    for (const coin of this.coinDrops) {
      if (coin.collected) continue;

      const distance = flatDistance(playerPos, coin.model.position);

      if (distance <= 0.8) {
        this.collectCoin(coin);
      }
    }
  }

  collectCoin(coin) {
    coin.collected = true;
    coin.model.visible = false;
    this.player.addGold(coin.value);
    this.updateHud();
    this.addLog(`Moneda recogida: +${coin.value} oro.`);
    console.log("coinCollected", { gold: coin.value });
    this.sfx.play("chest");
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
      to:
        this.exitButton.nextLevel === null
          ? null
          : this.exitButton.nextLevel + 1,
    });

    this.gameManager.activateLevelExit();
  }

  updateCoinDrops(delta) {
    for (const coin of this.coinDrops) {
      if (coin.collected) continue;

      coin.model.rotation.y += delta * coin.spinSpeed;
    }
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
          this.addCoinDrops(event.coins);
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

      const t = Math.min(
        1,
        effect.elapsed / effect.duration
      );

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
    this.camera.aspect =
      window.innerWidth / window.innerHeight;

    this.camera.updateProjectionMatrix();

    this.renderer.setSize(
      window.innerWidth,
      window.innerHeight
    );
    if (this.composer) {
      this.composer.setSize(window.innerWidth, window.innerHeight);
      if (this.fxaaPass && this.fxaaPass.material && this.fxaaPass.material.uniforms && this.fxaaPass.material.uniforms.resolution) {
        this.fxaaPass.material.uniforms.resolution.value.set(1 / window.innerWidth, 1 / window.innerHeight);
      }
    }
  }
}