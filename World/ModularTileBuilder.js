import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { getTileSetDefinition } from "../RoomData/tileSetDefinitions.js";

export class ModularTileBuilder {
  constructor(scene) {
    this.scene = scene;
    this.loadingManager = new THREE.LoadingManager();
    this.loadingManager.setURLModifier((url) => this.resolveAssetUrl(url));
    this.loader = new GLTFLoader(this.loadingManager);
    this.assetCache = new Map();
    this.assetMeta = new Map();
    this.warnedAssets = new Set();
  }

  resolveAssetUrl(url, definition = null) {
    if (url.endsWith("Textures/colormap.png") && definition?.assetTexturePath) {
      return definition.assetTexturePath;
    }

    if (url.endsWith("Textures/colormap.png")) {
      return "Assets/Models/Textures/characters-colormap.png";
    }

    if (url.startsWith("Textures/")) {
      return `Assets/Models/${url}`;
    }

    return url.replace(
      "Assets/Models/Scenario/Textures/",
      "Assets/Models/Textures/"
    );
  }

  createLoaderForDefinition(definition) {
    if (!definition?.assetTexturePath) return this.loader;

    const loadingManager = new THREE.LoadingManager();
    loadingManager.setURLModifier((url) =>
      this.resolveAssetUrl(url, definition)
    );

    return new GLTFLoader(loadingManager);
  }

  async preloadTileSet(tileSetId) {
    const tileSet = getTileSetDefinition(tileSetId);
    const moduleDefinitions = Object.values(tileSet.modules);

    await Promise.all(
      moduleDefinitions.map(async (definition) => {
        if (!definition.assetPath) return;
        if (this.assetCache.has(definition.assetPath)) return;

        try {
          const loader = this.createLoaderForDefinition(definition);
          const gltf = await loader.loadAsync(definition.assetPath);
          this.prepareAsset(gltf.scene);
          this.assetCache.set(definition.assetPath, gltf);
          this.assetMeta.set(definition.assetPath, this.measureAsset(gltf.scene));
        } catch (error) {
          this.assetCache.set(definition.assetPath, null);
          this.logMissingAsset(definition, error);
        }
      })
    );
  }

  buildLevel(environment) {
    const tileSet = getTileSetDefinition(environment.tileSetId);
    const build = {
      wallMeshes: [],
      roomObjectsById: new Map(),
      connectionObjectsById: new Map(),
    };

    for (const floorModule of environment.floorModules ?? []) {
      this.buildPiece(floorModule, tileSet, build);
    }

    for (const wallModule of environment.wallModules ?? []) {
      this.buildPiece(wallModule, tileSet, build);
    }

    for (const doorwayModule of environment.doorwayModules ?? []) {
      this.buildPiece(doorwayModule, tileSet, build);
    }

    for (const decorativeModule of environment.decorativeModules ?? []) {
      this.buildPiece(decorativeModule, tileSet, build);
    }

    return build;
  }

  buildPiece(piece, tileSet, build) {
    const definition = tileSet.modules[piece.moduleId];
    if (!definition) return;

    for (const stackPiece of this.createVerticalStackPieces(piece, definition)) {
      switch (definition.placementMode) {
        case "grid":
          this.buildGridModules(stackPiece, definition, build);
          break;

        case "linear":
          this.buildLinearModules(stackPiece, definition, build);
          break;

        case "single":
        default:
          this.buildSingleModule(stackPiece, definition, build);
      }
    }
  }

  buildGridModules(piece, definition, build) {
    const footprint = definition.footprint ?? { w: piece.w, d: piece.d };
    const countX = Math.max(1, Math.round(piece.w / footprint.w));
    const countZ = Math.max(1, Math.round(piece.d / footprint.d));
    const tileW = piece.w / countX;
    const tileD = piece.d / countZ;
    const startX = piece.x - piece.w / 2 + tileW / 2;
    const startZ = piece.z - piece.d / 2 + tileD / 2;

    for (let ix = 0; ix < countX; ix += 1) {
      for (let iz = 0; iz < countZ; iz += 1) {
        const modulePiece = {
          ...piece,
          x: startX + ix * tileW,
          z: startZ + iz * tileD,
          w: tileW,
          d: tileD,
        };

        if (this.isGridModuleHidden(modulePiece, piece.hiddenAreas)) continue;

        const object = this.createModuleObject(modulePiece, definition);
        if (object) this.addBuiltObject(object, modulePiece, build);
      }
    }
  }

  isGridModuleHidden(modulePiece, hiddenAreas = []) {
    return hiddenAreas.some((area) =>
      modulePiece.x >= area.x - area.w / 2 &&
      modulePiece.x <= area.x + area.w / 2 &&
      modulePiece.z >= area.z - area.d / 2 &&
      modulePiece.z <= area.z + area.d / 2
    );
  }

  buildLinearModules(piece, definition, build) {
    const axis = this.getModuleAxis(piece);
    const isHorizontal = axis === "x";
    const length = isHorizontal ? piece.w : piece.d;
    const thickness = isHorizontal ? piece.d : piece.w;
    const footprintLength = definition.footprint?.length ?? length;
    const count = Math.max(1, Math.round(length / footprintLength));
    const segmentLength = length / count;
    const startOffset = -length / 2 + segmentLength / 2;

    for (let index = 0; index < count; index += 1) {
      const offset = startOffset + index * segmentLength;
      const modulePiece = {
        ...piece,
        x: isHorizontal ? piece.x + offset : piece.x,
        z: isHorizontal ? piece.z : piece.z + offset,
        w: isHorizontal ? segmentLength : thickness,
        d: isHorizontal ? thickness : segmentLength,
      };

      const object = this.createModuleObject(modulePiece, definition);
      if (!object) continue;

      this.addBuiltObject(object, modulePiece, build, { blocksSight: true });
    }
  }

  buildSingleModule(piece, definition, build) {
    for (const modulePiece of this.createRepeatedSingleModulePieces(piece, definition)) {
      const object = this.createModuleObject(modulePiece, definition);
      if (!object) continue;

      this.addBuiltObject(object, modulePiece, build, {
        blocksSight: this.blocksSight(definition),
      });
      const light = this.createPointLightForModule(modulePiece, definition);
      if (light) this.registerBuiltObject(light, modulePiece, build);
    }
  }

  addBuiltObject(object, piece, build, options = {}) {
    this.applyPieceMetadata(object, piece);
    this.scene.levelGroup.add(object);
    this.registerBuiltObject(object, piece, build);

    if (options.blocksSight) {
      build.wallMeshes.push(object);
    }
  }

  registerBuiltObject(object, piece, build) {
    this.applyPieceMetadata(object, piece);

    if (piece.roomId) {
      this.addObjectToMap(build.roomObjectsById, piece.roomId, object);
    }

    if (piece.connectionId) {
      this.addObjectToMap(build.connectionObjectsById, piece.connectionId, object);
    }
  }

  addObjectToMap(map, key, object) {
    const objects = map.get(key) ?? [];
    objects.push(object);
    map.set(key, objects);
  }

  applyPieceMetadata(object, piece) {
    if (piece.moduleId) object.userData.moduleId = piece.moduleId;
    if (piece.role) object.userData.role = piece.role;
    if (piece.roomId) object.userData.roomId = piece.roomId;
    if (piece.connectionId) object.userData.connectionId = piece.connectionId;
    if (piece.connectorVisibility) {
      object.userData.connectorVisibility = piece.connectorVisibility;
    }
    if (piece.connectorVisibleRoomId) {
      object.userData.connectorVisibleRoomId = piece.connectorVisibleRoomId;
    }
  }

  createModuleObject(piece, definition) {
    const asset = definition.assetPath ? this.assetCache.get(definition.assetPath) : null;

    if (asset?.scene) {
      return this.createAssetInstance(piece, definition, asset.scene);
    }

    return this.createFallbackInstance(piece, definition);
  }

  createPointLightForModule(piece, definition) {
    if (!definition.pointLightType) return;
    if (typeof this.scene.vfx?.addPointLight !== "function") return;

    return this.scene.vfx.addPointLight(definition.pointLightType, piece, {
      ...(definition.pointLight ?? {}),
      ...(piece.pointLight ?? {}),
    });
  }

  createAssetInstance(piece, definition, assetScene) {
    const meta = this.assetMeta.get(definition.assetPath);
    if (!meta) {
      return this.createFallbackInstance(piece, definition);
    }

    const root = new THREE.Group();
    const clone = SkeletonUtils.clone(assetScene);
    const rotationY = this.getModuleRotationY(piece, definition);
    const scale = this.getScaleForDefinition(piece, definition, meta.size);
    const scaleMultiplier = piece.scaleMultiplier ?? 1;
    const finalScale = {
      x: scale.x * scaleMultiplier,
      y: scale.y * scaleMultiplier,
      z: scale.z * scaleMultiplier,
    };

    clone.scale.set(finalScale.x, finalScale.y, finalScale.z);
    clone.position.set(
      -meta.center.x * finalScale.x,
      -meta.min.y * finalScale.y,
      -meta.center.z * finalScale.z
    );

    root.add(clone);
    root.position.set(piece.x, piece.y ?? definition.positionY ?? 0, piece.z);
    root.rotation.y = rotationY;

    return root;
  }

  createFallbackInstance(piece, definition) {
    const fallback = definition.fallback ?? {};

    switch (fallback.kind) {
      case "wall":
      case "corner":
      case "obstacle":
        return this.createFallbackWall(piece, fallback);

      case "doorway":
        return this.createFallbackDoorway(piece, fallback);

      case "decor":
        return this.createFallbackDecor(piece, fallback, definition);

      case "floor":
      default:
        return this.createFallbackFloor(piece, fallback, definition);
    }
  }

  createFallbackFloor(piece, fallback, definition) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(piece.w, piece.d),
      new THREE.MeshStandardMaterial({
        color: piece.color ?? fallback.color ?? 0x303735,
        roughness: 0.9,
        metalness: 0,
      })
    );

    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(piece.x, piece.y ?? definition.positionY ?? 0.01, piece.z);
    mesh.receiveShadow = true;

    return mesh;
  }

  createFallbackWall(piece, fallback) {
    const height = piece.height ?? 1;
    const baseY = piece.y ?? 0;
    const scaleMultiplier = piece.scaleMultiplier ?? 1;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(
        piece.w * scaleMultiplier,
        height * scaleMultiplier,
        piece.d * scaleMultiplier
      ),
      new THREE.MeshStandardMaterial({
        color: fallback.color ?? 0x15191c,
        roughness: 0.8,
        metalness: 0,
      })
    );

    mesh.position.set(piece.x, baseY + height / 2, piece.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    return mesh;
  }

  createFallbackDecor(piece, fallback, definition) {
    const height = piece.height ?? definition.footprint?.height ?? 0.35;
    const baseY = piece.y ?? 0;
    const scaleMultiplier = piece.scaleMultiplier ?? 1;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(
        (piece.w ?? 1) * scaleMultiplier,
        height * scaleMultiplier,
        (piece.d ?? 1) * scaleMultiplier
      ),
      new THREE.MeshStandardMaterial({
        color: fallback.color ?? 0x5a5f5c,
        roughness: 0.85,
        metalness: 0,
      })
    );

    mesh.position.set(piece.x, baseY + height / 2, piece.z);
    mesh.rotation.y = piece.rotationY ?? 0;
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    return mesh;
  }

  createFallbackDoorway(piece, fallback) {
    const group = new THREE.Group();
    const width = Math.max(piece.w, piece.d);
    const thickness = Math.min(piece.w, piece.d);
    const height = piece.height ?? 1.65;

    const frameMaterial = new THREE.MeshStandardMaterial({
      color: fallback.color ?? 0x20262a,
      roughness: 0.75,
      metalness: 0,
    });

    const accentMaterial = new THREE.MeshStandardMaterial({
      color: fallback.accent ?? 0x464b53,
      roughness: 0.7,
      metalness: 0,
    });

    const postSize = Math.max(0.12, thickness * 0.45);
    const span = width - postSize;

    const leftPost = new THREE.Mesh(
      new THREE.BoxGeometry(postSize, height, thickness),
      frameMaterial
    );
    const rightPost = leftPost.clone();
    const lintel = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.2, thickness),
      accentMaterial
    );

    leftPost.position.set(-span / 2, height / 2, 0);
    rightPost.position.set(span / 2, height / 2, 0);
    lintel.position.set(0, height - 0.1, 0);

    leftPost.castShadow = true;
    leftPost.receiveShadow = true;
    rightPost.castShadow = true;
    rightPost.receiveShadow = true;
    lintel.castShadow = true;
    lintel.receiveShadow = true;

    group.add(leftPost);
    group.add(rightPost);
    group.add(lintel);

    group.position.set(piece.x, piece.y ?? 0, piece.z);
    group.rotation.y = this.getModuleRotationY(piece, {
      placementMode: "linear",
      fallback: { kind: "doorway" },
    });

    return group;
  }

  getModuleRotationY(piece, definition) {
    if (piece.absoluteRotationY !== undefined) {
      return piece.absoluteRotationY;
    }

    if (piece.rotationY !== undefined) {
      return piece.rotationY;
    }

    if (definition.placementMode === "linear" || definition.fallback?.kind === "doorway") {
      return this.getModuleAxis(piece) === "x" ? 0 : Math.PI / 2;
    }

    return 0;
  }

  getScaleForDefinition(piece, definition, sourceSize) {
    if (definition.preserveOriginalScale) {
      return new THREE.Vector3(1, 1, 1);
    }

    const safeSize = {
      x: Math.max(sourceSize.x, 0.0001),
      y: Math.max(sourceSize.y, 0.0001),
      z: Math.max(sourceSize.z, 0.0001),
    };

    switch (definition.placementMode) {
      case "grid":
      case "single":
        return new THREE.Vector3(
          piece.w / safeSize.x,
          (piece.height ?? definition.footprint?.height ?? safeSize.y) / safeSize.y,
          piece.d / safeSize.z
        );

      case "linear": {
        const axis = this.getModuleAxis(piece);
        const length = axis === "x" ? piece.w : piece.d;
        const thickness = axis === "x" ? piece.d : piece.w;

        return new THREE.Vector3(
          length / safeSize.x,
          (piece.height ?? definition.footprint?.height ?? safeSize.y) / safeSize.y,
          thickness / safeSize.z
        );
      }

      default:
        return new THREE.Vector3(1, 1, 1);
    }
  }

  blocksSight(definition) {
    const kind = definition.fallback?.kind;
    return kind === "wall" || kind === "doorway" || kind === "obstacle";
  }

  createVerticalStackPieces(piece, definition) {
    const count = this.getVerticalStackCount(piece);
    if (count <= 1) return [piece];

    const step = this.getVerticalStackStep(piece, definition);
    const baseY = piece.y ?? definition.positionY ?? 0;

    return Array.from({ length: count }, (_, index) => ({
      ...piece,
      y: baseY + index * step,
    }));
  }

  getVerticalStackCount(piece) {
    return Math.max(1, Math.round(piece.stackY ?? piece.countY ?? 1));
  }

  getVerticalStackStep(piece, definition) {
    const step = (
      piece.stackStepY ??
      piece.height ??
      definition.footprint?.height ??
      1
    );

    return Math.max(0.0001, step);
  }

  getModuleAxis(piece) {
    switch (piece.side) {
      case "north":
      case "south":
        return "x";

      case "east":
      case "west":
        return "z";

      default:
        return piece.w >= piece.d ? "x" : "z";
    }
  }

  createRepeatedSingleModulePieces(piece, definition) {
    const axis = this.getSingleModuleRepeatAxis(piece, definition);
    if (!axis) return [piece];

    const footprint = definition.footprint ?? { w: 1, d: 1 };
    const tileLength = axis === "x" ? footprint.w ?? 1 : footprint.d ?? 1;
    const length = axis === "x" ? piece.w : piece.d;
    const count = Math.max(1, Math.round(length / tileLength));
    if (count <= 1) return [piece];

    const startOffset = -((count - 1) * tileLength) / 2;

    return Array.from({ length: count }, (_, index) => {
      const offset = startOffset + index * tileLength;

      return {
        ...piece,
        x: axis === "x" ? piece.x + offset : piece.x,
        z: axis === "z" ? piece.z + offset : piece.z,
        w: footprint.w ?? 1,
        d: footprint.d ?? 1,
      };
    });
  }

  getSingleModuleRepeatAxis(piece, definition) {
    if (!piece.side) return null;

    const footprint = definition.footprint ?? { w: 1, d: 1 };
    const axis = this.getModuleAxis(piece);
    const length = axis === "x" ? piece.w : piece.d;
    const tileLength = axis === "x" ? footprint.w ?? 1 : footprint.d ?? 1;

    return length > tileLength + 0.05 ? axis : null;
  }

  prepareAsset(root) {
    root.traverse((node) => {
      if (!node.isMesh) return;

      node.castShadow = true;
      node.receiveShadow = true;

      if (node.material?.map) {
        node.material.map.colorSpace = THREE.SRGBColorSpace;
      }

      if (node.material?.isMeshStandardMaterial || node.material?.isMeshPhysicalMaterial) {
        node.material.metalness = 0;
        node.material.roughness = Math.max(node.material.roughness ?? 1, 0.72);
        node.material.needsUpdate = true;
      }
    });
  }

  measureAsset(root) {
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();

    box.getSize(size);
    box.getCenter(center);

    return {
      size,
      center,
      min: box.min.clone(),
    };
  }

  logMissingAsset(definition, error) {
    if (this.warnedAssets.has(definition.assetPath)) return;

    this.warnedAssets.add(definition.assetPath);
    console.warn("environmentAssetFallback", {
      assetPath: definition.assetPath,
      error: error?.message ?? error,
    });

    if (typeof this.scene.addLog === "function") {
      this.scene.addLog(`Fallback visual para ${definition.id}.`);
    }
  }
}
