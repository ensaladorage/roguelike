import * as THREE from "three";
import {
  createShopOffers,
  getShopProgressContext,
  getShopRarityWeightEntry,
  getShopRarityWeights,
} from "./ShopOfferFactory.js";
import { SHOP_DEFINITION, SHOP_EVENTS } from "./shopDefinitions.js";

const SHOP_INTERACTION_RANGE = 1.2;
const SHOP_INTERACTION_COOLDOWN = 1.15;
const SHOP_LABEL_Y = 1.36;
const SHOP_ITEM_Y = 0.82;
const SHOP_CONFIRM_LOCK_REASON = "shopPurchaseConfirmation";

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

      this.scene.levelGroup.add(model);
      this.stands.push({
        offerId: offer.id,
        offerIndex: index,
        spawn,
        model,
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
    if (!this.scene?.player || this.stands.length === 0) return;

    const playerPosition = this.scene.player.model.position;

    for (const stand of this.stands) {
      if (stand.cooldown > 0) {
        stand.cooldown -= delta;
      }

      this.updateStandAnimation(stand, delta);

      if (this.pendingConfirmation) continue;
      if (stand.cooldown > 0) continue;

      const distance = this.getFlatDistance(playerPosition, stand.model.position);
      if (distance > SHOP_INTERACTION_RANGE) continue;

      const result = this.requestPurchaseConfirmation(stand);
      stand.cooldown = SHOP_INTERACTION_COOLDOWN;

      if (result.success) {
        this.refreshStand(stand);
      }
    }
  }

  requestPurchaseConfirmation(stand) {
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
        stand.cooldown = SHOP_INTERACTION_COOLDOWN;

        if (result.success) {
          this.refreshStand(stand);
        }
      } else {
        stand.cooldown = SHOP_INTERACTION_COOLDOWN;
      }

      this.closePurchaseConfirmation();
    });

    const keyHandler = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        stand.cooldown = SHOP_INTERACTION_COOLDOWN;
        this.closePurchaseConfirmation();
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        const result = this.purchaseOffer(offer.id);
        stand.cooldown = SHOP_INTERACTION_COOLDOWN;

        if (result.success) {
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
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.46, 0.58, 0.42, 24),
      new THREE.MeshStandardMaterial({
        color: 0x4b4f55,
        roughness: 0.72,
        metalness: 0.05,
      })
    );
    base.position.y = 0.21;
    base.castShadow = true;
    base.receiveShadow = true;

    const top = new THREE.Mesh(
      new THREE.CylinderGeometry(0.52, 0.46, 0.12, 24),
      new THREE.MeshStandardMaterial({
        color: rarityColor,
        emissive: rarityColor,
        emissiveIntensity: 0.18,
        roughness: 0.45,
      })
    );
    top.position.y = 0.48;
    top.castShadow = true;

    const itemMarker = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.34, 0.34),
      new THREE.MeshStandardMaterial({
        color: rarityColor,
        emissive: rarityColor,
        emissiveIntensity: 0.34,
        roughness: 0.35,
      })
    );
    itemMarker.position.y = SHOP_ITEM_Y;
    itemMarker.rotation.y = Math.PI / 4;
    itemMarker.castShadow = true;

    const label = this.createOfferLabel(offer);
    label.position.y = SHOP_LABEL_Y;

    group.add(base, top, itemMarker, label);
    group.userData.shopVisuals = {
      base,
      top,
      itemMarker,
      label,
    };

    return group;
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
    if (!marker || offer?.purchased) return;

    marker.rotation.y += delta * 1.7;
    marker.position.y = SHOP_ITEM_Y + Math.sin(performance.now() * 0.004) * 0.04;
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

      if (child.material?.map) {
        child.material.map.dispose();
      }

      if (child.material) {
        child.material.dispose();
      }

      if (child.geometry) {
        child.geometry.dispose();
      }
    });
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
