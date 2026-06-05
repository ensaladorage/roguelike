import * as THREE from "three";
import {
  createShopOffers,
  getShopProgressContext,
  getShopRarityWeightEntry,
  getShopRarityWeights,
} from "./ShopOfferFactory.js";
import { SHOP_DEFINITION, SHOP_EVENTS } from "./shopDefinitions.js";
import { DEFAULT_SHOP_ALTAR_MODEL_ID } from "../CharacterData/modelDefinitions.js";

export const SHOP_INTERACTION_RANGE = 1.2;
const SHOP_INTERACTION_COOLDOWN = 1.15;
const SHOP_CONFIRM_LOCK_REASON = "shopPurchaseConfirmation";
const SHOP_FALLBACK_ALTAR_SCALE = 0.86;
const SHOP_FALLBACK_ITEM_Y = 0.92;
const SHOP_FALLBACK_LABEL_Y = 1.46;

const SHOP_RARITY_COLORS = {
  common: 0x7ecf8d,
  rare: 0x5aa8ff,
  epic: 0xb66dff,
};

export class ShopManager {
  constructor(scene, config = SHOP_DEFINITION) {
    this.scene = scene;
    this.config = config;
    this.offers = [];
    this.stands = [];
    this.events = [];
    this.lastContext = null;
    this.pendingStand = null;
    this.pendingConfirmation = null;
    this.confirmationElement = null;
  }

  load(level, context = {}) {
    this.clearFloor();

    const spawns = level.shopOfferSpawns ?? [];
    if (spawns.length === 0) return [];

    const offers = this.openShop(context);
    this.logShopEntry(context);
    const offerCount = Math.min(spawns.length, offers.length);

    for (let index = 0; index < offerCount; index += 1) {
      const offer = offers[index];
      const spawn = spawns[index];
      const model = this.createStandModel(offer, spawn);
      model.userData.interactable = {
        type: "shop",
        offerId: offer.id,
      };

      this.scene.levelGroup.add(model);
      this.stands.push({
        offerId: offer.id,
        offerIndex: index,
        spawn,
        model,
        roomId: spawn.roomId,
        roomTemplateId: spawn.roomTemplateId,
        cooldown: 0,
      });
    }

    this.refreshStands();
    return offers;
  }

  logShopEntry(context = {}) {
    const progress = getShopProgressContext(context);
    const rarityWeights = getShopRarityWeights(this.config, context);
    const weightEntry = getShopRarityWeightEntry(this.config, context);
    const floorType = context.floorType ?? "shop";

    console.log("shopFloorEntered", {
      floorType,
      floorIndex: progress.floorIndex,
      completedFloors: progress.completedFloors,
      rarityWeightProfile: weightEntry?.id ?? "default",
      rarityWeights,
    });

    this.scene?.addLog?.(`Floor type: ${floorType}. Run floor ${progress.floorIndex}.`);
    this.scene?.addLog?.(
      `Shop rarity weights: common ${rarityWeights.common ?? 0}, rare ${rarityWeights.rare ?? 0}, epic ${rarityWeights.epic ?? 0}.`
    );
  }

  openShop(context = {}) {
    this.lastContext = context;
    this.offers = createShopOffers({
      config: this.config,
      context,
    });

    for (const offer of this.offers) {
      this.emit({
        type: SHOP_EVENTS.OFFER_CREATED,
        offer,
        itemId: offer.itemId,
        item: offer.itemDefinition,
        rarity: offer.rarity,
        price: offer.price,
      });
    }

    console.log("shopOffersGenerated", {
      count: this.offers.length,
      context,
      offers: this.offers.map((offer) => this.serializeOffer(offer)),
    });

    return this.offers;
  }

  update(delta = 0) {
    if (this.stands.length === 0) return;

    for (const stand of this.stands) {
      if (stand.cooldown > 0) {
        stand.cooldown -= delta;
      }

      this.updateStandAnimation(stand, delta);
    }

    this.checkPendingStandInteraction();
  }

  requestStandInteraction(standOrOfferId) {
    const stand = typeof standOrOfferId === "string"
      ? this.findStand(standOrOfferId)
      : standOrOfferId;

    if (!stand) {
      return this.failPurchase({
        reason: "offerMissing",
        offerId: standOrOfferId,
      });
    }

    const offer = this.findOffer(stand.offerId);
    if (!offer) {
      return this.failPurchase({
        reason: "offerMissing",
        offerId: stand.offerId,
      });
    }

    if (offer.purchased) {
      this.emit({
        type: SHOP_EVENTS.OFFER_ALREADY_PURCHASED,
        offer,
        itemId: offer.itemId,
        item: offer.itemDefinition,
        rarity: offer.rarity,
        price: offer.price,
      });

      return {
        success: false,
        reason: "alreadyPurchased",
        offer,
      };
    }

    if (this.pendingConfirmation) {
      return {
        success: false,
        reason: "confirmationPending",
        offer,
      };
    }

    if (stand.model?.visible === false || stand.cooldown > 0) {
      return {
        success: false,
        reason: "interactionUnavailable",
        offer,
      };
    }

    if (!this.isStandInInteractionRange(stand)) {
      this.pendingStand = stand;

      return {
        success: false,
        reason: "movingToInteraction",
        offer,
      };
    }

    this.pendingStand = null;
    return this.requestPurchaseConfirmation(stand);
  }

  cancelPendingStandInteraction(stand = null) {
    if (stand && this.pendingStand !== stand) return;

    this.pendingStand = null;
  }

  checkPendingStandInteraction() {
    const stand = this.pendingStand;
    if (!stand) return;

    if (this.pendingConfirmation) return;

    const offer = this.findOffer(stand.offerId);
    if (!offer || offer.purchased || stand.model?.visible === false) {
      this.pendingStand = null;
      return;
    }

    if (stand.cooldown > 0) return;
    if (!this.isStandInInteractionRange(stand)) return;

    this.pendingStand = null;
    this.requestPurchaseConfirmation(stand);
  }

  requestPurchaseConfirmation(stand) {
    const offer = this.findOffer(stand.offerId);

    if (!offer) {
      return this.failPurchase({
        reason: "offerMissing",
        offerId: stand.offerId,
      });
    }

    if (!this.isStandInInteractionRange(stand)) {
      return {
        success: false,
        reason: "outOfRange",
        offer,
      };
    }

    if (offer.purchased) {
      this.emit({
        type: SHOP_EVENTS.OFFER_ALREADY_PURCHASED,
        offer,
        itemId: offer.itemId,
        item: offer.itemDefinition,
        rarity: offer.rarity,
        price: offer.price,
      });

      return {
        success: false,
        reason: "alreadyPurchased",
        offer,
      };
    }

    const player = this.scene?.player;
    const inventory = this.scene?.inventory;

    if (!player || !inventory) {
      return this.failPurchase({
        reason: "shopUnavailable",
        offer,
      });
    }

    if (player.gold < offer.price) {
      return this.failPurchase({
        reason: "insufficientGold",
        offer,
        gold: player.gold,
      });
    }

    if (!inventory.canPickupItem(offer.itemId)) {
      return this.failPurchase({
        reason: "inventoryFull",
        offer,
        gold: player.gold,
      });
    }

    this.openPurchaseConfirmation(offer, stand);
    return {
      success: false,
      reason: "confirmationPending",
      offer,
    };
  }

  openPurchaseConfirmation(offer, stand) {
    this.closePurchaseConfirmation({ unlock: false });
    this.scene?.setPlayerControlLocked?.(true, SHOP_CONFIRM_LOCK_REASON);

    const overlay = document.createElement("div");
    overlay.className = "shop-confirm-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "shopConfirmTitle");
    overlay.innerHTML = `
      <div class="shop-confirm-dialog">
        <h2 id="shopConfirmTitle">Confirm purchase</h2>
        <p>Buy ${offer.itemDefinition.name} for ${offer.price} gold?</p>
        <div class="shop-confirm-actions">
          <button type="button" data-shop-confirm="yes">Buy</button>
          <button type="button" data-shop-confirm="no">Cancel</button>
        </div>
      </div>
    `;

    overlay.addEventListener("click", (event) => {
      const action = event.target?.dataset?.shopConfirm;
      if (!action) return;

      if (action === "yes") {
        const result = this.purchaseOffer(offer.id);

        if (result.success) {
          stand.cooldown = SHOP_INTERACTION_COOLDOWN;
          this.refreshStand(stand);
        }
      }

      this.closePurchaseConfirmation();
    });

    const keyHandler = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        this.closePurchaseConfirmation();
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        const result = this.purchaseOffer(offer.id);

        if (result.success) {
          stand.cooldown = SHOP_INTERACTION_COOLDOWN;
          this.refreshStand(stand);
        }

        this.closePurchaseConfirmation();
      }
    };

    window.addEventListener("keydown", keyHandler);
    document.body.appendChild(overlay);
    overlay.querySelector("[data-shop-confirm='yes']")?.focus();

    this.pendingConfirmation = {
      offerId: offer.id,
      stand,
      keyHandler,
    };
    this.confirmationElement = overlay;
  }

  closePurchaseConfirmation({ unlock = true } = {}) {
    if (this.pendingConfirmation?.keyHandler) {
      window.removeEventListener("keydown", this.pendingConfirmation.keyHandler);
    }

    this.confirmationElement?.remove();
    this.confirmationElement = null;
    this.pendingConfirmation = null;

    if (unlock) {
      this.scene?.setPlayerControlLocked?.(false, SHOP_CONFIRM_LOCK_REASON);
    }
  }

  purchaseOffer(offerIdOrIndex) {
    const offer = this.findOffer(offerIdOrIndex);

    if (!offer) {
      return this.failPurchase({
        reason: "offerMissing",
        offerId: offerIdOrIndex,
      });
    }

    if (offer.purchased) {
      const result = {
        success: false,
        reason: "alreadyPurchased",
        offer,
      };

      this.emit({
        type: SHOP_EVENTS.OFFER_ALREADY_PURCHASED,
        offer,
        itemId: offer.itemId,
        item: offer.itemDefinition,
        rarity: offer.rarity,
        price: offer.price,
      });

      return result;
    }

    const player = this.scene?.player;
    const inventory = this.scene?.inventory;

    if (!player || !inventory) {
      return this.failPurchase({
        reason: "shopUnavailable",
        offer,
      });
    }

    if (player.gold < offer.price) {
      return this.failPurchase({
        reason: "insufficientGold",
        offer,
        gold: player.gold,
      });
    }

    if (!inventory.canPickupItem(offer.itemId)) {
      return this.failPurchase({
        reason: "inventoryFull",
        offer,
        gold: player.gold,
      });
    }

    if (!this.spendGold(player, offer.price)) {
      return this.failPurchase({
        reason: "insufficientGold",
        offer,
        gold: player.gold,
      });
    }

    const pickedUp = inventory.pickupItem(offer.itemId, {
      source: "shop",
      offer,
      shop: this,
      enemies: this.scene?.enemies ?? [],
    });

    if (!pickedUp) {
      player.addGold?.(offer.price);
      return this.failPurchase({
        reason: "itemPickupFailed",
        offer,
        gold: player.gold,
      });
    }

    offer.purchased = true;
    const result = {
      success: true,
      offer,
      itemId: offer.itemId,
      price: offer.price,
      remainingGold: player.gold,
    };

    this.emit({
      type: SHOP_EVENTS.PURCHASE_SUCCEEDED,
      offer,
      itemId: offer.itemId,
      item: offer.itemDefinition,
      rarity: offer.rarity,
      price: offer.price,
      remainingGold: player.gold,
    });

    return result;
  }

  findOffer(offerIdOrIndex) {
    if (typeof offerIdOrIndex === "number") {
      return this.offers[offerIdOrIndex] ?? null;
    }

    return this.offers.find((offer) => offer.id === offerIdOrIndex) ?? null;
  }

  findStand(offerId) {
    return this.stands.find((stand) => stand.offerId === offerId) ?? null;
  }

  isStandInInteractionRange(stand) {
    const playerPosition = this.scene?.player?.model?.position;
    const standPosition = stand?.model?.position;
    if (!playerPosition || !standPosition) return false;

    return this.getFlatDistance(playerPosition, standPosition) <=
      SHOP_INTERACTION_RANGE;
  }

  spendGold(player, price) {
    if (typeof player.spendGold === "function") {
      return player.spendGold(price);
    }

    if (player.gold < price) return false;

    player.gold -= price;
    return true;
  }

  failPurchase({ reason, offer = null, offerId = null, gold = null }) {
    const result = {
      success: false,
      reason,
      offer,
      offerId: offer?.id ?? offerId,
    };

    this.emit({
      type: SHOP_EVENTS.PURCHASE_FAILED,
      reason,
      offer,
      offerId: result.offerId,
      itemId: offer?.itemId ?? null,
      item: offer?.itemDefinition ?? null,
      rarity: offer?.rarity ?? null,
      price: offer?.price ?? null,
      gold,
    });

    return result;
  }

  createStandModel(offer, spawn) {
    const group = new THREE.Group();
    group.name = `shopStand_${offer.id}`;
    group.position.set(spawn.x, 0, spawn.z);
    group.rotation.y = spawn.rotationY ?? 0;

    const rarityColor = SHOP_RARITY_COLORS[offer.rarity] ?? SHOP_RARITY_COLORS.common;
    const visualConfig = this.config.standVisual ?? {};
    const itemY = spawn.itemY ?? visualConfig.itemY ?? SHOP_FALLBACK_ITEM_Y;
    const labelY = spawn.labelY ?? visualConfig.labelY ?? SHOP_FALLBACK_LABEL_Y;
    const altar = this.createAltarModel(spawn);

    const itemMarker = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.34, 0.34),
      new THREE.MeshStandardMaterial({
        color: rarityColor,
        emissive: rarityColor,
        emissiveIntensity: 0.34,
        roughness: 0.35,
      })
    );
    itemMarker.position.y = itemY;
    itemMarker.rotation.y = Math.PI / 4;
    itemMarker.castShadow = true;

    const label = this.createOfferLabel(offer);
    label.position.y = labelY;

    group.add(altar, itemMarker, label);
    group.userData.shopVisuals = {
      altar,
      itemMarker,
      label,
      itemY,
    };

    return group;
  }

  createAltarModel(spawn) {
    const visualConfig = this.config.standVisual ?? {};
    const modelId =
      spawn.altarModelId ??
      visualConfig.altarModelId ??
      DEFAULT_SHOP_ALTAR_MODEL_ID;
    const scale =
      spawn.altarScale ??
      visualConfig.altarScale ??
      SHOP_FALLBACK_ALTAR_SCALE;
    let altar = null;
    let usesSharedAsset = false;

    try {
      altar = this.scene?.cloneGameModel?.(modelId) ?? null;
      usesSharedAsset = Boolean(altar);
    } catch (error) {
      console.warn(`Shop altar model ${modelId} clone failed:`, error);
    }

    if (!altar) {
      console.warn(`Shop altar model ${modelId} is not loaded. Using fallback.`);
      altar = this.createFallbackAltarModel();
    }

    altar.name = `shopAltar_${spawn.id ?? modelId}`;
    altar.scale.multiplyScalar(scale);
    altar.position.y = spawn.altarY ?? visualConfig.altarY ?? 0;

    if (usesSharedAsset) {
      this.makeSharedAssetMaterialsLocal(altar);
    }

    return altar;
  }

  createFallbackAltarModel() {
    const group = new THREE.Group();
    const altar = new THREE.Mesh(
      new THREE.BoxGeometry(0.74, 0.52, 0.74),
      new THREE.MeshStandardMaterial({
        color: 0x7a5a3d,
        roughness: 0.85,
        metalness: 0,
      })
    );

    altar.position.y = 0.26;
    altar.castShadow = true;
    altar.receiveShadow = true;

    group.add(altar);

    return group;
  }

  makeSharedAssetMaterialsLocal(root) {
    root.traverse((child) => {
      if (!child.isMesh || !child.material) return;

      if (child.geometry) {
        child.userData.preserveSharedGeometry = true;
      }

      if (Array.isArray(child.material)) {
        child.material = child.material.map((material) =>
          this.cloneMaterialForStand(material)
        );
      } else {
        child.material = this.cloneMaterialForStand(child.material);
      }
    });
  }

  cloneMaterialForStand(material) {
    const cloned = material.clone();

    if (cloned.map) {
      cloned.userData = {
        ...(cloned.userData ?? {}),
        preserveSharedMap: true,
      };
    }

    return cloned;
  }

  createOfferLabel(offer) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 128;

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(material);

    sprite.scale.set(1.85, 0.92, 1);
    sprite.userData.canvas = canvas;
    sprite.userData.texture = texture;
    sprite.userData.offerId = offer.id;
    this.updateOfferLabel(sprite, offer);

    return sprite;
  }

  updateOfferLabel(sprite, offer) {
    const canvas = sprite.userData.canvas;
    const texture = sprite.userData.texture;
    if (!canvas || !texture) return;

    const context = canvas.getContext("2d");
    const rarityColor = SHOP_RARITY_COLORS[offer.rarity] ?? SHOP_RARITY_COLORS.common;
    const accent = `#${rarityColor.toString(16).padStart(6, "0")}`;
    const title = offer.purchased ? "SOLD" : offer.itemDefinition.name;
    const subtitle = offer.purchased ? offer.itemDefinition.name : `${offer.price} gold`;

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "rgba(17, 19, 23, 0.82)";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = accent;
    context.lineWidth = 6;
    context.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
    context.fillStyle = offer.purchased ? "#9aa0a6" : "#f4f1e8";
    context.font = "700 24px system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(title, canvas.width / 2, 44, 228);
    context.fillStyle = offer.purchased ? "#747a80" : accent;
    context.font = "600 22px system-ui, sans-serif";
    context.fillText(subtitle, canvas.width / 2, 84, 228);

    texture.needsUpdate = true;
  }

  updateStandAnimation(stand, delta) {
    const offer = this.findOffer(stand.offerId);
    const marker = stand.model.userData.shopVisuals?.itemMarker;
    const itemY = stand.model.userData.shopVisuals?.itemY ?? SHOP_FALLBACK_ITEM_Y;
    if (!marker || offer?.purchased) return;

    marker.rotation.y += delta * 1.7;
    marker.position.y = itemY + Math.sin(performance.now() * 0.004) * 0.04;
  }

  refreshStands() {
    for (const stand of this.stands) {
      this.refreshStand(stand);
    }
  }

  refreshStand(stand) {
    const offer = this.findOffer(stand.offerId);
    if (!offer) return;

    const visuals = stand.model.userData.shopVisuals ?? {};
    if (visuals.label) {
      this.updateOfferLabel(visuals.label, offer);
    }

    stand.model.traverse((child) => {
      if (!child.isMesh || !child.material) return;

      child.material.opacity = offer.purchased ? 0.46 : 1;
      child.material.transparent = offer.purchased;
      child.material.needsUpdate = true;
    });
  }

  getFlatDistance(a, b) {
    const dx = a.x - b.x;
    const dz = a.z - b.z;

    return Math.sqrt(dx * dx + dz * dz);
  }

  createProgressSnapshot() {
    return {
      lastContext: this.lastContext,
      offers: this.offers.map((offer) => this.serializeOffer(offer)),
    };
  }

  restoreProgressSnapshot(snapshot) {
    if (!snapshot) return;

    this.lastContext = snapshot.lastContext ?? null;
    this.offers = (snapshot.offers ?? [])
      .map((offer) => this.restoreOffer(offer))
      .filter(Boolean);
    this.refreshStands();
  }

  restoreOffer(savedOffer) {
    const offer = createShopOffers({
      config: {
        ...this.config,
        offerCount: 1,
        possibleItemIds: [savedOffer.itemId],
      },
      context: this.lastContext ?? {},
    })[0];

    if (!offer) return null;

    return {
      ...offer,
      id: savedOffer.id,
      offerIndex: savedOffer.offerIndex,
      price: savedOffer.price,
      purchased: Boolean(savedOffer.purchased),
    };
  }

  serializeOffer(offer) {
    return {
      id: offer.id,
      offerIndex: offer.offerIndex,
      itemId: offer.itemId,
      rarity: offer.rarity,
      price: offer.price,
      purchased: offer.purchased,
    };
  }

  clearFloor() {
    this.closePurchaseConfirmation();
    this.pendingStand = null;

    for (const stand of this.stands) {
      this.disposeStand(stand.model);
      stand.model.removeFromParent();
    }

    this.stands = [];
  }

  clear() {
    this.clearFloor();
    this.offers = [];
    this.events = [];
    this.lastContext = null;
  }

  disposeStand(model) {
    model.traverse((child) => {
      if (child.userData.texture) {
        child.userData.texture.dispose();
      }

      if (child.material) {
        this.disposeMaterial(child.material);
      }

      if (child.geometry && !child.userData.preserveSharedGeometry) {
        child.geometry.dispose();
      }
    });
  }

  disposeMaterial(material) {
    if (Array.isArray(material)) {
      material.forEach((entry) => this.disposeMaterial(entry));
      return;
    }

    if (material.map && !material.userData?.preserveSharedMap) {
      material.map.dispose();
    }

    material.dispose();
  }

  emit(event) {
    this.events.push(event);
  }

  consumeEvents() {
    const events = this.events;
    this.events = [];
    return events;
  }
}
