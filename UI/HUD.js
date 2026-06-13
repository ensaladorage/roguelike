import {
  ITEM_FOOD_CATEGORIES,
  ITEM_RARITIES,
  getItemDefinitionByUseSlot,
  getItemMaxStack,
} from "../CharacterData/itemDefinitions.js";
import {
  getItemDisplayDescription,
  getItemDisplayName,
} from "../Game/ItemInstanceFactory.js";

const QUICK_USE_SLOTS = [1, 2];
const INVENTORY_STYLE_ID = "inventory-panel-style";
const MAX_LOG_ENTRIES = 90;
const VISIBLE_LOG_ENTRIES = 5;
const ITEM_RARITY_CLASSES = ["is-common", "is-rare", "is-epic"];
const ITEM_RARITY_CLASS_BY_RARITY = {
  [ITEM_RARITIES.COMMON]: "is-common",
  [ITEM_RARITIES.RARE]: "is-rare",
  [ITEM_RARITIES.EPIC]: "is-epic",
};
const ITEM_RARITY_LABEL_BY_RARITY = {
  [ITEM_RARITIES.COMMON]: "Common",
  [ITEM_RARITIES.RARE]: "Rare",
  [ITEM_RARITIES.EPIC]: "Epic",
};
const EQUIPMENT_SLOT_ORDER = [
  ITEM_FOOD_CATEGORIES.PROTEIN,
  ITEM_FOOD_CATEGORIES.SPICY,
  ITEM_FOOD_CATEGORIES.HEARTY,
  ITEM_FOOD_CATEGORIES.ABILITY,
];
const EQUIPMENT_SLOT_LABELS = {
  [ITEM_FOOD_CATEGORIES.PROTEIN]: "Protein",
  [ITEM_FOOD_CATEGORIES.SPICY]: "Spicy",
  [ITEM_FOOD_CATEGORIES.HEARTY]: "Hearty",
  [ITEM_FOOD_CATEGORIES.ABILITY]: "Ability",
};

export class HUD {
  constructor() {
    this.hpText = document.querySelector("#hpText");
    this.hpBar = document.querySelector("#hpBar");
    this.goldText = document.querySelector("#goldText");
    this.damageText = document.querySelector("#damageText");
    this.attackSpeedText = document.querySelector("#attackSpeedText");
    this.maxHpText = null;
    this.speedText = null;
    this.attackRangeText = null;
    this.inventoryGoldText = null;
    this.logElement = document.querySelector("#log");
    this.logSlider = document.querySelector("#logSlider");
    this.quickUseElement = document.querySelector("#quickUseBar");
    this.abilitySlot = document.querySelector("#abilitySlot");
    this.abilitySlotImage = document.querySelector("#abilitySlotImage");
    this.abilitySlotCooldown = document.querySelector("#abilitySlotCooldown");
    this.itemTooltip = document.querySelector("#itemTooltip");
    this.epicRewardOverlay = document.querySelector("#epicRewardOverlay");
    this.epicRewardOptions = document.querySelector("#epicRewardOptions");
    this.defeatOverlay = document.querySelector("#defeatOverlay");
    this.victoryOverlay = document.querySelector("#victoryOverlay");
    this.bossOverlay = document.querySelector("#bossHealth");
    this.bossNameText = document.querySelector("#bossName");
    this.bossHpText = document.querySelector("#bossHpText");
    this.bossHpBar = document.querySelector("#bossHpBar");
    this.quickUseButtons = new Map();
    this.lastAbilitySlotState = {
      instanceId: null,
      wasReady: false,
      wasUnlocked: false,
    };
    this.onUseConsumableSlot = null;
    this.logEntries = [];
    this.logOffset = 0;
    this.statHighlightTimers = new Map();
    this.onEpicRewardSelect = null;
    this.onEpicRewardCancel = null;
    this.inventoryPanelOpen = false;
    this.inventoryHint = null;
    this.equippedHudList = null;
    this.equippedHudSignature = "";
    this.inventoryPanel = null;
    this.inventorySlotList = null;
    this.currentPlayer = null;
    this.currentInventory = null;
    this.swapConfirmationOverlay = null;
    this.swapConfirmation = null;
    this.handleModalEscape = this.handleModalEscape.bind(this);

    this.ensureInventoryStyles();
    this.setupQuickUseButtons();
    this.setupAbilitySlot();
    this.setupEpicRewardOverlay();
    this.setupInventoryPanel();
    this.setupSwapConfirmation();
    this.setupLogSlider();
    window.addEventListener("keydown", this.handleModalEscape);
  }

  setConsumableUseHandler(handler) {
    this.onUseConsumableSlot = handler;
  }

  showDefeatedOverlay() {
    if (!this.defeatOverlay) return;

    this.defeatOverlay.hidden = false;
  }

  hideDefeatedOverlay() {
    if (!this.defeatOverlay) return;

    this.defeatOverlay.hidden = true;
  }

  showVictoryOverlay() {
    if (!this.victoryOverlay) return;

    this.victoryOverlay.hidden = false;
  }

  hideVictoryOverlay() {
    if (!this.victoryOverlay) return;

    this.victoryOverlay.hidden = true;
  }

  showItemTooltip(item, position = {}) {
    if (!this.itemTooltip || !item) return;

    this.itemTooltip.innerHTML = "";
    this.applyItemRarityClass(this.itemTooltip, item);

    const name = document.createElement("strong");
    name.textContent = getItemDisplayName(item);

    const category = document.createElement("span");
    category.className = "item-tooltip__meta";
    category.textContent = `Category: ${this.getItemCategoryLabel(item)}`;

    const description = document.createElement("span");
    description.textContent = getItemDisplayDescription(item);

    this.itemTooltip.append(
      this.createItemRarityLabel(item),
      name,
      category,
      description
    );
    this.itemTooltip.hidden = false;
    this.moveItemTooltip(position);
  }

  moveItemTooltip(position = {}) {
    if (!this.itemTooltip || this.itemTooltip.hidden) return;

    const x = Number.isFinite(position.clientX) ? position.clientX : 0;
    const y = Number.isFinite(position.clientY) ? position.clientY : 0;
    this.itemTooltip.style.left = `${x + 18}px`;
    this.itemTooltip.style.top = `${y + 18}px`;
  }

  getElementTooltipPosition(element) {
    const rect = element?.getBoundingClientRect?.();
    if (!rect) return {};

    return {
      clientX: rect.right,
      clientY: rect.top,
    };
  }

  hideItemTooltip() {
    if (!this.itemTooltip) return;

    this.itemTooltip.hidden = true;
    this.clearItemRarityClass(this.itemTooltip);
  }

  toggleInventoryPanel(inventory) {
    if (this.inventoryPanelOpen) {
      this.hideInventoryPanel();
      return false;
    }

    this.showInventoryPanel(inventory);
    return true;
  }

  showInventoryPanel(inventory) {
    if (!this.inventoryPanel) return;

    this.inventoryPanelOpen = true;
    this.inventoryPanel.hidden = false;
    this.inventoryPanel.setAttribute("aria-hidden", "false");
    if (this.inventoryHint) {
      this.inventoryHint.hidden = true;
    }
    this.setEquippedHudHidden(true);
    this.updateInventoryPanel(inventory);
  }

  hideInventoryPanel() {
    if (!this.inventoryPanel) return;

    this.inventoryPanelOpen = false;
    this.inventoryPanel.hidden = true;
    this.inventoryPanel.setAttribute("aria-hidden", "true");
    if (this.inventoryHint) {
      this.inventoryHint.hidden = false;
    }
    this.updateEquippedHud(this.currentInventory);
    this.hideItemTooltip();
  }

  updateInventoryPanel(inventory) {
    this.currentInventory = inventory ?? this.currentInventory;
    if (!this.inventorySlotList || !inventory) return;

    this.inventorySlotList.innerHTML = "";

    for (const category of EQUIPMENT_SLOT_ORDER) {
      const equippedItem = inventory.getEquippedItemForCategory?.(category) ?? null;
      const slot = this.createInventorySlot(category, equippedItem);
      this.inventorySlotList.appendChild(slot);
    }

    this.updateInventoryStats();
  }

  showItemSwapConfirmation({
    currentItem,
    newItem,
    onConfirm = null,
    onCancel = null,
  } = {}) {
    if (!this.swapConfirmationOverlay || !currentItem || !newItem) return;

    this.hideItemTooltip();
    this.swapConfirmation = {
      currentItem,
      newItem,
      onConfirm,
      onCancel,
    };
    this.renderSwapConfirmation();
    this.swapConfirmationOverlay.hidden = false;
    this.swapConfirmationOverlay.setAttribute("aria-hidden", "false");
    this.swapConfirmationOverlay.querySelector("[data-swap-confirm='replace']")?.focus();
  }

  hideItemSwapConfirmation({ cancelled = false } = {}) {
    if (!this.swapConfirmationOverlay) return;

    const confirmation = this.swapConfirmation;
    this.swapConfirmation = null;
    this.swapConfirmationOverlay.hidden = true;
    this.swapConfirmationOverlay.setAttribute("aria-hidden", "true");

    if (cancelled) {
      confirmation?.onCancel?.();
    }
  }

  showEpicChestRewards(options = [], onSelect = null, onCancel = null) {
    if (!this.epicRewardOverlay || !this.epicRewardOptions) return;

    this.onEpicRewardSelect = onSelect;
    this.onEpicRewardCancel = onCancel;
    this.epicRewardOptions.innerHTML = "";

    for (const option of options) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "epic-reward-card";
      this.applyItemRarityClass(button, option.item ?? { rarity: option.rarity });
      button.dataset.rewardId = option.id;

      const image = document.createElement("img");
      image.src = option.item.imagePath;
      image.alt = "";
      image.setAttribute("aria-hidden", "true");

      const name = document.createElement("strong");
      name.textContent = getItemDisplayName(option.item);

      const description = document.createElement("span");
      description.textContent = getItemDisplayDescription(option.item);

      button.append(
        this.createItemRarityLabel(option.item ?? { rarity: option.rarity }),
        image,
        name,
        description
      );
      button.addEventListener("click", () => {
        this.onEpicRewardSelect?.(option);
      });

      this.epicRewardOptions.appendChild(button);
    }

    this.epicRewardOverlay.hidden = false;
    this.epicRewardOverlay
      .querySelector("[data-epic-reward-close]")
      ?.focus();
  }

  hideEpicChestRewards({ cancelled = false } = {}) {
    if (!this.epicRewardOverlay) return;

    const onCancel = this.onEpicRewardCancel;
    this.epicRewardOverlay.hidden = true;
    this.onEpicRewardSelect = null;
    this.onEpicRewardCancel = null;

    if (cancelled) {
      onCancel?.();
    }
  }

  handleModalEscape(event) {
    if (event.key !== "Escape") return;

    if (this.isSwapConfirmationOpen()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.hideItemSwapConfirmation({ cancelled: true });
      return;
    }

    if (this.isEpicRewardOverlayOpen()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.hideEpicChestRewards({ cancelled: true });
    }
  }

  isSwapConfirmationOpen() {
    return Boolean(
      this.swapConfirmationOverlay &&
      !this.swapConfirmationOverlay.hidden &&
      this.swapConfirmation
    );
  }

  isEpicRewardOverlayOpen() {
    return Boolean(this.epicRewardOverlay && !this.epicRewardOverlay.hidden);
  }

  updateBoss(boss) {
    if (!this.bossOverlay || !boss) return;

    const maxHp = Math.max(1, boss.maxHp ?? 1);
    const hp = Math.max(0, Math.ceil(boss.hp ?? 0));
    const ratio = Math.max(0, Math.min(1, hp / maxHp));

    this.bossOverlay.hidden = false;

    if (this.bossNameText) {
      this.bossNameText.textContent = boss.enemyName ?? "Boss";
    }

    if (this.bossHpText) {
      this.bossHpText.textContent = `${hp} / ${Math.ceil(maxHp)} HP`;
    }

    if (this.bossHpBar) {
      this.bossHpBar.style.width = `${ratio * 100}%`;
    }
  }

  hideBoss() {
    if (!this.bossOverlay) return;

    this.bossOverlay.hidden = true;

    if (this.bossNameText) this.bossNameText.textContent = "";
    if (this.bossHpText) this.bossHpText.textContent = "";
    if (this.bossHpBar) this.bossHpBar.style.width = "0%";
  }

  updatePlayer(player) {
    this.currentPlayer = player;

    if (this.hpText) {
      this.hpText.textContent =
        `${player.hp} / ${player.maxHp} HP`;
    }

    if (this.hpBar) {
      const ratio = player.hp / player.maxHp;
      this.hpBar.style.width =
        `${Math.max(0, Math.min(1, ratio)) * 100}%`;
    }

    if (this.goldText) {
      this.goldText.textContent = player.gold.toString();
    }

    if (this.inventoryGoldText) {
      this.inventoryGoldText.textContent = player.gold.toString();
    }

    if (this.damageText) {
      this.damageText.textContent = player.attackDamage.toString();
    }

    if (this.attackSpeedText) {
      const attacksPerSecond = Number.isFinite(player.attackSpeed)
        ? player.attackSpeed
        : player.attackCooldown > 0
          ? 1 / player.attackCooldown
          : 0;

      this.attackSpeedText.textContent = `${attacksPerSecond.toFixed(2)}/s`;
    }

    if (this.maxHpText) {
      this.maxHpText.textContent = player.maxHp.toString();
    }

    if (this.speedText) {
      this.speedText.textContent = Number.isFinite(player.speed)
        ? player.speed.toFixed(2)
        : "0";
    }

    if (this.attackRangeText) {
      this.attackRangeText.textContent = Number.isFinite(player.attackRange)
        ? player.attackRange.toFixed(2)
        : "0";
    }
  }

  updateInventory(inventory) {
    this.currentInventory = inventory;
    this.updateQuickUseButtons(inventory);
    this.updateAbilitySlot(this.currentPlayer, inventory);
    if (this.inventoryPanelOpen) {
      this.updateInventoryPanel(inventory);
    }
    this.updateEquippedHud(inventory);
  }

  setupAbilitySlot() {
    if (!this.abilitySlot) return;

    this.abilitySlot.addEventListener("mouseenter", (event) => {
      const item = this.getEquippedAbilityItem();
      if (!item) return;

      this.showItemTooltip(item, event);
    });
    this.abilitySlot.addEventListener("mousemove", (event) => {
      this.moveItemTooltip(event);
    });
    this.abilitySlot.addEventListener("mouseleave", () => {
      this.hideItemTooltip();
    });
    this.abilitySlot.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
  }

  updateAbilitySlot(player = this.currentPlayer, inventory = this.currentInventory) {
    this.currentPlayer = player ?? this.currentPlayer;
    this.currentInventory = inventory ?? this.currentInventory;
    if (!this.abilitySlot || !this.abilitySlotImage || !this.abilitySlotCooldown) {
      return;
    }

    const item = this.getEquippedAbilityItem();
    const feedback = this.currentPlayer?.getDashFeedbackState?.() ?? {
      unlocked: false,
      isReady: false,
      isCoolingDown: false,
      cooldownProgress: 0,
      remainingSeconds: 0,
    };
    const hasItem = Boolean(item);
    const progress = hasItem
      ? Math.max(0, Math.min(1, feedback.cooldownProgress ?? 0))
      : 0;
    const isCoolingDown = Boolean(hasItem && feedback.isCoolingDown);
    const isReady = Boolean(hasItem && feedback.isReady);
    const instanceId = item?.instanceId ?? item?.baseItemId ?? null;

    this.abilitySlot.classList.toggle("is-empty", !hasItem);
    this.abilitySlot.classList.toggle("is-cooling", isCoolingDown);
    this.abilitySlot.setAttribute("aria-disabled", hasItem ? "false" : "true");

    if (hasItem) {
      this.abilitySlotImage.src = item.imagePath;
      this.abilitySlotImage.hidden = false;
      this.abilitySlot.title = `Space: ${getItemDisplayName(item)}`;
      this.abilitySlot.setAttribute(
        "aria-label",
        `Space: ${getItemDisplayName(item)}`
      );
    } else {
      this.abilitySlotImage.hidden = true;
      this.abilitySlot.removeAttribute("title");
      this.abilitySlot.setAttribute("aria-label", "Space: ability empty");
    }

    this.abilitySlotCooldown.style.height = `${Math.round(progress * 100)}%`;

    const shouldFlash =
      hasItem &&
      isReady &&
      instanceId === this.lastAbilitySlotState.instanceId &&
      this.lastAbilitySlotState.wasUnlocked &&
      !this.lastAbilitySlotState.wasReady;

    if (shouldFlash) {
      this.flashAbilitySlot();
    }

    this.lastAbilitySlotState = {
      instanceId,
      wasReady: isReady,
      wasUnlocked: hasItem,
    };
  }

  getEquippedAbilityItem() {
    return this.currentInventory?.getEquippedItemForCategory?.(
      ITEM_FOOD_CATEGORIES.ABILITY
    ) ?? null;
  }

  flashAbilitySlot() {
    if (!this.abilitySlot) return;

    this.abilitySlot.classList.remove("is-ready-flash");
    void this.abilitySlot.offsetWidth;
    this.abilitySlot.classList.add("is-ready-flash");
  }

  setupQuickUseButtons() {
    if (!this.quickUseElement) return;

    this.quickUseElement.innerHTML = "";

    for (const useSlot of QUICK_USE_SLOTS) {
      const item = getItemDefinitionByUseSlot(useSlot);
      if (!item) continue;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "quick-use-button";
      button.dataset.slotIndex = String(useSlot - 1);
      button.title = `Use ${item.name}`;
      button.setAttribute("aria-label", `Use ${item.name}`);
      button.disabled = false;
      button.setAttribute("aria-disabled", "true");
      button.classList.add("is-empty");

      const image = document.createElement("img");
      image.src = item.imagePath;
      image.alt = "";
      image.setAttribute("aria-hidden", "true");
      image.hidden = true;

      const count = document.createElement("span");
      count.className = "quick-use-count";
      count.textContent = "x0";
      count.hidden = true;

      const key = document.createElement("span");
      key.className = "quick-use-key";
      key.textContent = String(useSlot);

      button.append(key, image);
      button.appendChild(count);
      this.quickUseElement.appendChild(button);
      this.quickUseButtons.set(useSlot, { button, count, image, item });

      button.addEventListener("mouseenter", (event) => {
        this.showItemTooltip(item, event);
      });
      button.addEventListener("mousemove", (event) => {
        this.moveItemTooltip(event);
      });
      button.addEventListener("mouseleave", () => {
        this.hideItemTooltip();
      });
    }

    this.quickUseElement.addEventListener("click", (event) => {
      const button = event.target.closest("[data-slot-index]");
      if (!button || button.classList.contains("is-empty")) return;

      const slotIndex = Number(button.dataset.slotIndex);
      if (!Number.isInteger(slotIndex)) return;

      this.onUseConsumableSlot?.(slotIndex);
    });
  }

  setupEpicRewardOverlay() {
    if (!this.epicRewardOverlay) return;

    this.epicRewardOverlay.addEventListener("click", (event) => {
      if (!event.target?.closest?.("[data-epic-reward-close]")) return;

      event.stopPropagation();
      this.hideEpicChestRewards({ cancelled: true });
    });

    this.epicRewardOverlay.addEventListener("keydown", (event) => {
      this.handleModalEscape(event);
    });
  }

  setupInventoryPanel() {
    const closedHint = document.createElement("div");
    closedHint.className = "inventory-hint";
    closedHint.setAttribute("role", "status");
    closedHint.innerHTML = `<span class="inventory-hint__key">C</span><span>Inventory</span>`;
    closedHint.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
    });
    closedHint.addEventListener("click", (event) => {
      event.stopPropagation();
    });
    document.body.appendChild(closedHint);

    const equippedHud = document.createElement("div");
    equippedHud.className = "inventory-equipped-hud";
    equippedHud.setAttribute("aria-label", "Equipped items");
    equippedHud.hidden = true;
    equippedHud.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
    });
    equippedHud.addEventListener("click", (event) => {
      event.stopPropagation();
    });
    document.body.appendChild(equippedHud);

    const panel = document.createElement("section");
    panel.className = "inventory-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "false");
    panel.setAttribute("aria-labelledby", "inventoryPanelTitle");
    panel.setAttribute("aria-hidden", "true");
    panel.hidden = true;

    const header = document.createElement("div");
    header.className = "inventory-panel__header";

    const title = document.createElement("h2");
    title.id = "inventoryPanelTitle";
    title.textContent = "Inventory";

    const headerHint = document.createElement("span");
    headerHint.textContent = "C";

    header.append(title, headerHint);

    const slots = document.createElement("div");
    slots.className = "inventory-panel__slots";

    const stats = this.createInventoryStatsSection();

    panel.append(header, slots, stats);
    document.body.appendChild(panel);

    panel.addEventListener("pointerdown", (event) => event.stopPropagation());
    panel.addEventListener("click", (event) => event.stopPropagation());

    this.inventoryHint = closedHint;
    this.equippedHudList = equippedHud;
    this.inventoryPanel = panel;
    this.inventorySlotList = slots;
  }

  setupLogSlider() {
    if (!this.logSlider) return;

    this.logSlider.addEventListener("input", () => {
      this.logOffset = Number.parseInt(this.logSlider.value, 10) || 0;
      this.renderLog();
    });
  }

  setupSwapConfirmation() {
    const overlay = document.createElement("section");
    overlay.className = "item-swap-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "itemSwapTitle");
    overlay.setAttribute("aria-hidden", "true");
    overlay.hidden = true;

    overlay.addEventListener("pointerdown", (event) => event.stopPropagation());
    overlay.addEventListener("click", (event) => {
      event.stopPropagation();
      const action = event.target?.dataset?.swapConfirm;
      if (!action) return;

      if (action === "replace") {
        const confirmation = this.swapConfirmation;
        this.hideItemSwapConfirmation();
        confirmation?.onConfirm?.();
        return;
      }

      this.hideItemSwapConfirmation({ cancelled: true });
    });

    overlay.addEventListener("keydown", (event) => {
      this.handleModalEscape(event);
    });

    document.body.appendChild(overlay);
    this.swapConfirmationOverlay = overlay;
  }

  createInventorySlot(category, item) {
    const slot = document.createElement("div");
    slot.className = "inventory-panel__slot";
    slot.classList.toggle("is-empty", !item);
    if (item) {
      this.applyItemRarityClass(slot, item);
    }

    const icon = document.createElement("div");
    icon.className = "inventory-panel__icon";

    if (item?.imagePath) {
      const image = document.createElement("img");
      image.src = item.imagePath;
      image.alt = "";
      image.setAttribute("aria-hidden", "true");
      icon.appendChild(image);
    } else {
      icon.textContent = EQUIPMENT_SLOT_LABELS[category]?.charAt(0) ?? "?";
    }

    const copy = document.createElement("div");
    copy.className = "inventory-panel__copy";

    const label = document.createElement("span");
    label.className = "inventory-panel__category";
    label.textContent = EQUIPMENT_SLOT_LABELS[category] ?? category;

    const name = document.createElement("strong");
    name.textContent = item ? getItemDisplayName(item) : "Empty slot";

    const stats = document.createElement("span");
    stats.className = "inventory-panel__stats";
    stats.textContent = item ? getItemDisplayDescription(item) : "No item equipped.";

    copy.append(label, name, stats);
    if (item) {
      slot.append(this.createItemRarityLabel(item));
    }
    slot.append(icon, copy);

    if (item) {
      slot.addEventListener("mouseenter", (event) => {
        this.showItemTooltip(item, event);
      });
      slot.addEventListener("mousemove", (event) => {
        this.moveItemTooltip(event);
      });
      slot.addEventListener("mouseleave", () => {
        this.hideItemTooltip();
      });
    }

    return slot;
  }

  updateEquippedHud(inventory = this.currentInventory) {
    this.currentInventory = inventory ?? this.currentInventory;
    if (!this.equippedHudList || !this.currentInventory) return;

    const equippedItems = EQUIPMENT_SLOT_ORDER.map((category) => ({
      category,
      item: this.currentInventory.getEquippedItemForCategory?.(category) ?? null,
    }));
    const hasEquippedItem = equippedItems.some(({ item }) => Boolean(item));
    const shouldHide = this.inventoryPanelOpen || !hasEquippedItem;
    const nextSignature = equippedItems
      .map(({ item }) => item?.instanceId ?? item?.baseItemId ?? "empty")
      .join("|");

    if (nextSignature === this.equippedHudSignature) {
      this.setEquippedHudHidden(shouldHide);
      return;
    }

    this.equippedHudSignature = nextSignature;
    this.equippedHudList.innerHTML = "";

    for (const { category, item } of equippedItems) {
      this.equippedHudList.appendChild(
        this.createEquippedHudSlot(category, item)
      );
    }

    this.setEquippedHudHidden(shouldHide);
  }

  setEquippedHudHidden(hidden) {
    if (!this.equippedHudList) return;

    this.equippedHudList.hidden = Boolean(hidden);
  }

  createEquippedHudSlot(category, item) {
    const slot = document.createElement("button");
    slot.type = "button";
    slot.className = "inventory-equipped-hud__slot";
    slot.classList.toggle("is-empty", !item);
    slot.setAttribute(
      "aria-label",
      item
        ? `${EQUIPMENT_SLOT_LABELS[category] ?? category}: ${getItemDisplayName(item)}`
        : `${EQUIPMENT_SLOT_LABELS[category] ?? category}: empty`
    );
    slot.tabIndex = item ? 0 : -1;

    if (item) {
      this.applyItemRarityClass(slot, item);
    }

    if (item?.imagePath) {
      const image = document.createElement("img");
      image.src = item.imagePath;
      image.alt = "";
      image.setAttribute("aria-hidden", "true");
      slot.appendChild(image);
    } else {
      slot.textContent = EQUIPMENT_SLOT_LABELS[category]?.charAt(0) ?? "?";
    }

    if (item) {
      slot.addEventListener("mouseenter", (event) => {
        this.showItemTooltip(item, event);
      });
      slot.addEventListener("mousemove", (event) => {
        this.moveItemTooltip(event);
      });
      slot.addEventListener("mouseleave", () => {
        this.hideItemTooltip();
      });
      slot.addEventListener("focus", (event) => {
        this.showItemTooltip(
          item,
          this.getElementTooltipPosition(event.currentTarget)
        );
      });
      slot.addEventListener("blur", () => {
        this.hideItemTooltip();
      });
    }

    return slot;
  }

  renderSwapConfirmation() {
    if (!this.swapConfirmationOverlay || !this.swapConfirmation) return;

    const { currentItem, newItem } = this.swapConfirmation;
    this.swapConfirmationOverlay.innerHTML = "";

    const dialog = document.createElement("div");
    dialog.className = "item-swap-dialog";

    const title = document.createElement("h2");
    title.id = "itemSwapTitle";
    title.textContent = "Replace equipped item?";

    const comparison = document.createElement("div");
    comparison.className = "item-swap-comparison";
    comparison.append(
      this.createSwapCard("Equipped", currentItem),
      this.createSwapCard("New", newItem)
    );

    const actions = document.createElement("div");
    actions.className = "item-swap-actions";

    const keepButton = document.createElement("button");
    keepButton.type = "button";
    keepButton.dataset.swapConfirm = "keep";
    keepButton.textContent = "Keep Current";

    const replaceButton = document.createElement("button");
    replaceButton.type = "button";
    replaceButton.dataset.swapConfirm = "replace";
    replaceButton.textContent = "Replace";

    actions.append(keepButton, replaceButton);
    dialog.append(title, comparison, actions);
    this.swapConfirmationOverlay.appendChild(dialog);
  }

  createSwapCard(labelText, item) {
    const card = document.createElement("article");
    card.className = "item-swap-card";
    this.applyItemRarityClass(card, item);

    const label = document.createElement("span");
    label.className = "item-swap-card__label";
    label.textContent = labelText;

    const image = document.createElement("img");
    image.src = item.imagePath;
    image.alt = "";
    image.setAttribute("aria-hidden", "true");

    const name = document.createElement("strong");
    name.textContent = getItemDisplayName(item);

    const category = document.createElement("span");
    category.className = "item-swap-card__category";
    category.textContent = EQUIPMENT_SLOT_LABELS[item.foodCategory] ?? item.foodCategory ?? "Item";

    const description = document.createElement("span");
    description.className = "item-swap-card__stats";
    description.textContent = getItemDisplayDescription(item);

    card.append(this.createItemRarityLabel(item), label, image, name, category, description);
    return card;
  }

  getItemRarity(item) {
    return item?.rarity ?? ITEM_RARITIES.COMMON;
  }

  getItemRarityClass(item) {
    const rarity = this.getItemRarity(item);
    return ITEM_RARITY_CLASS_BY_RARITY[rarity] ?? ITEM_RARITY_CLASS_BY_RARITY[ITEM_RARITIES.COMMON];
  }

  getItemRarityLabel(item) {
    const rarity = this.getItemRarity(item);
    return ITEM_RARITY_LABEL_BY_RARITY[rarity] ?? ITEM_RARITY_LABEL_BY_RARITY[ITEM_RARITIES.COMMON];
  }

  getItemCategoryLabel(item) {
    if (item?.foodCategory) {
      return EQUIPMENT_SLOT_LABELS[item.foodCategory] ?? item.foodCategory;
    }

    return item?.type === "consumable" ? "Consumable" : "Item";
  }

  createItemRarityLabel(item) {
    const label = document.createElement("span");
    label.className = "item-rarity-label";
    label.textContent = this.getItemRarityLabel(item);
    return label;
  }

  clearItemRarityClass(element) {
    element?.classList?.remove(...ITEM_RARITY_CLASSES);
  }

  applyItemRarityClass(element, item) {
    if (!element) return;

    this.clearItemRarityClass(element);
    if (!item) return;

    element.classList.add(this.getItemRarityClass(item));
  }

  updateQuickUseButtons(inventory) {
    for (const [useSlot, quickUse] of this.quickUseButtons.entries()) {
      const item = getItemDefinitionByUseSlot(useSlot);
      if (!item) continue;

      const count = inventory.getConsumableCount(item.id);
      const maxStack = getItemMaxStack(item.id);
      const isMax = Number.isFinite(maxStack) && count >= maxStack;
      const isEmpty = count <= 0;

      quickUse.count.textContent = isMax ? "Max." : `x${count}`;
      quickUse.count.hidden = isEmpty;
      quickUse.count.classList.toggle("is-max", isMax);
      quickUse.image.hidden = isEmpty;
      quickUse.button.disabled = false;
      quickUse.button.setAttribute("aria-disabled", isEmpty ? "true" : "false");
      quickUse.button.classList.toggle("is-empty", isEmpty);
      quickUse.button.setAttribute(
        "aria-label",
        `${useSlot}: ${getItemDisplayName(item)} (${count})`
      );
    }
  }

  createInventoryStatsSection() {
    const section = document.createElement("section");
    section.className = "inventory-panel__stats-block";
    section.setAttribute("aria-label", "Player stats");

    const title = document.createElement("h3");
    title.textContent = "Player Stats";

    const list = document.createElement("div");
    list.className = "inventory-panel__stat-list";

    const damage = this.createInventoryStatRow("Damage", "10");
    const attackSpeed = this.createInventoryStatRow("Attack Speed", "1.20/s");
    const maxHp = this.createInventoryStatRow("Max HP", "100");
    const speed = this.createInventoryStatRow("Move Speed", "3.50");
    const range = this.createInventoryStatRow("Attack Range", "1.65");
    const gold = this.createInventoryGoldRow();

    this.damageText = damage.value;
    this.attackSpeedText = attackSpeed.value;
    this.maxHpText = maxHp.value;
    this.speedText = speed.value;
    this.attackRangeText = range.value;
    this.inventoryGoldText = gold.value;

    list.append(
      damage.row,
      attackSpeed.row,
      maxHp.row,
      speed.row,
      range.row,
      gold.row
    );
    section.append(title, list);
    return section;
  }

  createInventoryStatRow(labelText, initialValue) {
    const row = document.createElement("div");
    row.className = "inventory-panel__stat-row";

    const label = document.createElement("span");
    label.textContent = labelText;

    const value = document.createElement("strong");
    value.textContent = initialValue;

    row.append(label, value);
    return { row, value };
  }

  createInventoryGoldRow() {
    const row = document.createElement("div");
    row.className = "inventory-panel__stat-row inventory-panel__gold-row";

    const label = document.createElement("span");
    label.textContent = "Gold:";

    const valueWrap = document.createElement("strong");
    valueWrap.className = "inventory-panel__gold-value";

    const icon = document.createElement("span");
    icon.className = "coin-icon";
    icon.setAttribute("aria-hidden", "true");

    const value = document.createElement("span");
    value.textContent = "0";

    valueWrap.append(icon, value);
    row.append(label, valueWrap);
    return { row, value };
  }

  updateInventoryStats() {
    if (this.currentPlayer) {
      this.updatePlayer(this.currentPlayer);
    }
  }

  highlightStat(statName, duration = 3500) {
    const target = this.getStatElement(statName);
    if (!target) return;

    target.classList.remove("stat-highlight");
    void target.offsetWidth;
    target.classList.add("stat-highlight");

    if (this.statHighlightTimers.has(statName)) {
      window.clearTimeout(this.statHighlightTimers.get(statName));
    }

    const timer = window.setTimeout(() => {
      target.classList.remove("stat-highlight");
      this.statHighlightTimers.delete(statName);
    }, duration);

    this.statHighlightTimers.set(statName, timer);
  }

  clearLog() {
    this.logEntries = [];
    this.logOffset = 0;

    if (this.logElement) {
      this.logElement.innerHTML = "";
    }
    this.updateLogSlider();

    this.clearStatHighlights();
    this.hideItemTooltip();
    this.hideEpicChestRewards();
    this.hideInventoryPanel();
    this.hideItemSwapConfirmation();
  }

  clearStatHighlights() {
    for (const timer of this.statHighlightTimers.values()) {
      window.clearTimeout(timer);
    }

    this.statHighlightTimers.clear();

    for (const stat of ["hp", "maxHp", "attackDamage", "attackCooldown", "attackSpeed"]) {
      this.getStatElement(stat)?.classList.remove("stat-highlight");
    }
  }

  getStatElement(statName) {
    switch (statName) {
      case "hp":
      case "maxHp":
        return this.hpText;

      case "attackDamage":
        return this.damageText;

      case "attackCooldown":
      case "attackSpeed":
        return this.attackSpeedText;

      default:
        return null;
    }
  }

  addLog(message) {
    if (!this.logElement) return;

    this.logEntries.unshift(message);
    this.logEntries = this.logEntries.slice(0, MAX_LOG_ENTRIES);
    this.logOffset = 0;
    this.renderLog();
  }

  renderLog() {
    if (!this.logElement) return;

    this.updateLogSlider();
    this.logElement.innerHTML = "";

    const entries = this.logEntries.slice(
      this.logOffset,
      this.logOffset + VISIBLE_LOG_ENTRIES
    );

    for (const entry of entries) {
      const p = document.createElement("p");
      p.textContent = entry;
      this.logElement.appendChild(p);
    }
  }

  updateLogSlider() {
    if (!this.logSlider) return;

    const maxOffset = Math.max(0, this.logEntries.length - VISIBLE_LOG_ENTRIES);
    this.logOffset = Math.max(0, Math.min(maxOffset, this.logOffset));
    this.logSlider.max = String(maxOffset);
    this.logSlider.value = String(this.logOffset);
    this.logSlider.hidden = maxOffset <= 0;
  }

  ensureInventoryStyles() {
    if (document.getElementById(INVENTORY_STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = INVENTORY_STYLE_ID;
    style.textContent = `
      .inventory-panel {
        position: fixed;
        top: 156px;
        left: 16px;
        z-index: 32;
        width: min(340px, calc(100vw - 32px));
        max-height: calc(100dvh - 178px);
        overflow: auto;
        padding: 14px;
        border: 1px solid rgba(244, 241, 232, 0.2);
        border-radius: 8px;
        background: linear-gradient(180deg, rgba(31, 35, 42, 0.96), rgba(15, 17, 22, 0.96));
        box-shadow: 0 22px 46px rgba(0, 0, 0, 0.42);
        backdrop-filter: blur(12px);
        color: #f4f1e8;
        pointer-events: auto;
      }

      .inventory-hint {
        position: fixed;
        left: 16px;
        top: 156px;
        z-index: 8;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-height: 36px;
        padding: 7px 10px 7px 7px;
        border: 1px solid rgba(244, 241, 232, 0.18);
        border-radius: 8px;
        background: rgba(17, 19, 23, 0.72);
        box-shadow: 0 12px 26px rgba(0, 0, 0, 0.26);
        backdrop-filter: blur(10px);
        color: rgba(244, 241, 232, 0.82);
        font: inherit;
        font-size: 13px;
        font-weight: 800;
        cursor: inherit;
        pointer-events: auto;
      }

      .inventory-hint__key {
        display: grid;
        place-items: center;
        min-width: 24px;
        height: 24px;
        border: 1px solid rgba(244, 241, 232, 0.28);
        border-radius: 6px;
        background: rgba(244, 241, 232, 0.1);
        color: #f8e9b4;
        font-size: 13px;
        font-weight: 900;
        text-transform: uppercase;
      }

      .item-tooltip {
        z-index: 36;
      }

      .item-tooltip__meta {
        color: rgba(240, 179, 90, 0.9);
        font-size: 11px;
        font-weight: 900;
        text-transform: uppercase;
      }

      .inventory-equipped-hud {
        position: fixed;
        left: 39px;
        top: 219px;
        z-index: 8;
        display: grid;
        gap: 28px;
        pointer-events: none;
      }

      .inventory-equipped-hud[hidden] {
        display: none;
      }

      .inventory-equipped-hud__slot {
        display: grid;
        place-items: center;
        width: 52px;
        height: 52px;
        border: 1px solid rgba(244, 241, 232, 0.18);
        border-radius: 8px;
        background: rgba(17, 19, 23, 0.76);
        box-shadow: 0 12px 24px rgba(0, 0, 0, 0.24);
        backdrop-filter: blur(10px);
        color: rgba(244, 241, 232, 0.58);
        font: inherit;
        font-size: 20px;
        font-weight: 900;
        pointer-events: auto;
      }

      .inventory-equipped-hud__slot.is-empty {
        visibility: hidden;
        pointer-events: none;
      }

      .inventory-equipped-hud__slot.is-common {
        border-color: rgba(255, 255, 255, 0.78);
        box-shadow: 0 12px 24px rgba(0, 0, 0, 0.24), inset 0 0 0 1px rgba(255, 255, 255, 0.16);
      }

      .inventory-equipped-hud__slot.is-rare {
        border-color: rgba(90, 168, 255, 0.78);
        box-shadow: 0 12px 24px rgba(0, 0, 0, 0.24), inset 0 0 0 1px rgba(90, 168, 255, 0.2);
      }

      .inventory-equipped-hud__slot.is-epic {
        border-color: rgba(180, 117, 255, 0.78);
        box-shadow: 0 12px 24px rgba(0, 0, 0, 0.24), inset 0 0 0 1px rgba(180, 117, 255, 0.24);
      }

      .inventory-equipped-hud__slot img {
        width: 42px;
        height: 42px;
        object-fit: contain;
      }

      .inventory-equipped-hud__slot:focus-visible {
        outline: 2px solid #f0b35a;
        outline-offset: 2px;
      }

      .inventory-panel[hidden],
      .inventory-hint[hidden],
      .item-swap-overlay[hidden] {
        display: none;
      }

      .inventory-panel__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 12px;
      }

      .inventory-panel__header h2 {
        margin: 0;
        font-size: 18px;
        line-height: 1.2;
        letter-spacing: 0;
      }

      .inventory-panel__header span {
        min-width: 28px;
        padding: 3px 7px;
        border: 1px solid rgba(244, 241, 232, 0.18);
        border-radius: 6px;
        background: rgba(244, 241, 232, 0.1);
        color: rgba(244, 241, 232, 0.78);
        font-size: 12px;
        font-weight: 900;
        text-align: center;
      }

      .inventory-panel__slots {
        display: grid;
        gap: 8px;
      }

      .inventory-panel__slot {
        position: relative;
        display: grid;
        grid-template-columns: 52px minmax(0, 1fr);
        gap: 10px;
        align-items: center;
        min-height: 72px;
        padding: 9px;
        border: 1px solid rgba(244, 241, 232, 0.16);
        border-radius: 8px;
        background: rgba(244, 241, 232, 0.08);
      }

      .inventory-panel__slot .item-rarity-label {
        position: absolute;
        top: 7px;
        right: 9px;
        max-width: 72px;
        text-align: right;
      }

      .inventory-panel__slot.is-empty {
        opacity: 0.72;
      }

      .inventory-panel__slot.is-common {
        border-color: rgba(255, 255, 255, 0.78);
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.16);
      }

      .inventory-panel__slot.is-rare {
        border-color: rgba(90, 168, 255, 0.78);
        box-shadow: inset 0 0 0 1px rgba(90, 168, 255, 0.2);
      }

      .inventory-panel__slot.is-epic {
        border-color: rgba(180, 117, 255, 0.78);
        box-shadow: inset 0 0 0 1px rgba(180, 117, 255, 0.24);
      }

      .inventory-panel__icon {
        display: grid;
        place-items: center;
        width: 52px;
        height: 52px;
        border: 1px solid rgba(244, 241, 232, 0.15);
        border-radius: 8px;
        background: rgba(0, 0, 0, 0.2);
        color: rgba(244, 241, 232, 0.58);
        font-size: 20px;
        font-weight: 900;
      }

      .inventory-panel__icon img {
        width: 42px;
        height: 42px;
        object-fit: contain;
      }

      .inventory-panel__copy {
        display: grid;
        gap: 3px;
        min-width: 0;
      }

      .inventory-panel__category {
        color: #f0b35a;
        font-size: 11px;
        font-weight: 900;
        letter-spacing: 0;
        text-transform: uppercase;
      }

      .inventory-panel__copy strong {
        overflow: hidden;
        font-size: 15px;
        line-height: 1.15;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .inventory-panel__stats {
        color: rgba(244, 241, 232, 0.72);
        font-size: 12px;
        line-height: 1.25;
      }

      .inventory-panel__stats-block {
        display: grid;
        gap: 8px;
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid rgba(244, 241, 232, 0.14);
      }

      .inventory-panel__stats-block h3 {
        margin: 0;
        color: rgba(244, 241, 232, 0.84);
        font-size: 13px;
        line-height: 1.2;
        letter-spacing: 0;
        text-transform: uppercase;
      }

      .inventory-panel__stat-list {
        display: grid;
        gap: 6px;
      }

      .inventory-panel__stat-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        min-height: 28px;
        padding: 5px 8px;
        border: 1px solid rgba(244, 241, 232, 0.1);
        border-radius: 7px;
        background: rgba(244, 241, 232, 0.055);
        color: rgba(244, 241, 232, 0.76);
        font-size: 12px;
      }

      .inventory-panel__stat-row strong {
        color: #f4f1e8;
        font-size: 13px;
      }

      .inventory-panel__gold-row {
        border-color: rgba(244, 201, 91, 0.22);
        background: rgba(244, 201, 91, 0.075);
      }

      .inventory-panel__gold-value {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      .inventory-panel__gold-value .coin-icon {
        width: 14px;
        height: 14px;
      }

      .item-swap-overlay {
        position: fixed;
        inset: 0;
        z-index: 34;
        display: grid;
        place-items: center;
        padding: 18px;
        background: rgba(17, 19, 23, 0.6);
        color: #f4f1e8;
        pointer-events: auto;
      }

      .item-swap-dialog {
        width: min(560px, calc(100vw - 36px));
        padding: 18px;
        border: 1px solid rgba(244, 241, 232, 0.22);
        border-radius: 8px;
        background: rgba(25, 28, 33, 0.97);
        box-shadow: 0 24px 52px rgba(0, 0, 0, 0.46);
      }

      .item-swap-dialog h2 {
        margin: 0 0 14px;
        font-size: 20px;
        line-height: 1.2;
        letter-spacing: 0;
        text-align: center;
      }

      .item-swap-comparison {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }

      .item-swap-card {
        display: grid;
        justify-items: center;
        gap: 7px;
        min-height: 176px;
        padding: 12px;
        border: 1px solid rgba(244, 241, 232, 0.16);
        border-radius: 8px;
        background: rgba(244, 241, 232, 0.08);
        text-align: center;
      }

      .item-swap-card .item-rarity-label {
        justify-self: start;
      }

      .item-swap-card.is-common {
        border-color: rgba(255, 255, 255, 0.78);
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.16);
      }

      .item-swap-card.is-rare {
        border-color: rgba(90, 168, 255, 0.78);
        box-shadow: inset 0 0 0 1px rgba(90, 168, 255, 0.2);
      }

      .item-swap-card.is-epic {
        border-color: rgba(180, 117, 255, 0.78);
        box-shadow: inset 0 0 0 1px rgba(180, 117, 255, 0.24);
      }

      .item-swap-card__label,
      .item-swap-card__category {
        color: #f0b35a;
        font-size: 11px;
        font-weight: 900;
        text-transform: uppercase;
      }

      .item-swap-card img {
        width: 50px;
        height: 50px;
        object-fit: contain;
      }

      .item-swap-card strong {
        font-size: 15px;
        line-height: 1.15;
      }

      .item-swap-card__stats {
        color: rgba(244, 241, 232, 0.74);
        font-size: 12px;
        line-height: 1.3;
      }

      .item-swap-actions {
        display: flex;
        justify-content: center;
        gap: 10px;
        margin-top: 14px;
      }

      .item-swap-actions button {
        min-width: 118px;
        min-height: 40px;
        border: 1px solid rgba(244, 241, 232, 0.22);
        border-radius: 8px;
        background: rgba(244, 241, 232, 0.12);
        color: #f4f1e8;
        font: inherit;
        font-weight: 800;
        cursor: pointer;
      }

      .item-swap-actions [data-swap-confirm="replace"] {
        background: #56c271;
        border-color: #56c271;
        color: #111317;
      }

      .item-swap-actions button:focus-visible {
        outline: 2px solid #f0b35a;
        outline-offset: 2px;
      }

      @media (max-width: 640px) {
        .inventory-panel {
          top: calc(116px + env(safe-area-inset-top));
          left: calc(8px + env(safe-area-inset-left));
          width: min(320px, calc(100vw - 16px));
          max-height: calc(100dvh - 128px - env(safe-area-inset-bottom));
          padding: 10px;
        }

        .inventory-hint {
          top: calc(116px + env(safe-area-inset-top));
          left: calc(8px + env(safe-area-inset-left));
        }

        .inventory-equipped-hud {
          top: calc(173px + env(safe-area-inset-top));
          left: calc(25px + env(safe-area-inset-left));
          gap: 26px;
        }

        .inventory-equipped-hud__slot {
          width: 46px;
          height: 46px;
        }

        .inventory-equipped-hud__slot img {
          width: 36px;
          height: 36px;
        }

        .inventory-panel__slot {
          grid-template-columns: 46px minmax(0, 1fr);
          min-height: 64px;
          padding: 7px;
        }

        .inventory-panel__icon {
          width: 46px;
          height: 46px;
        }

        .inventory-panel__icon img {
          width: 36px;
          height: 36px;
        }

        .item-swap-comparison {
          grid-template-columns: 1fr;
        }
      }
    `;

    document.head.appendChild(style);
  }
}
