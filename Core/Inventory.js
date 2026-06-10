import {
  ITEM_FOOD_CATEGORIES,
  ITEM_TYPES,
  getItemDefinition,
  getItemDefinitionByUseSlot,
  getItemMaxStack,
} from "../CharacterData/itemDefinitions.js";
import {
  getItemBaseId,
  getItemDefinitionForInstance,
  normalizeItemInstance,
} from "../Game/ItemInstanceFactory.js";

const EQUIPMENT_STATS = new Set([
  "attackDamage",
  "attackSpeed",
  "maxHp",
  "moveSpeed",
  "speed",
]);

export class Inventory {
  constructor({ player, itemEffects }) {
    this.player = player;
    this.itemEffects = itemEffects;
    this.equippedByCategory = this.createEmptyEquipmentSlots();
    this.appliedEquipmentTotals = {};
    this.consumables = new Map();
    this.knownConsumables = new Set();
    this.events = [];
  }

  pickupItem(itemOrId, context = {}) {
    const baseItemId = getItemBaseId(itemOrId);
    const definition = getItemDefinition(baseItemId);
    if (!definition) return false;

    if (definition.type === ITEM_TYPES.EQUIPPABLE) {
      const itemInstance = normalizeItemInstance(itemOrId, context);
      if (!itemInstance) return false;

      const category = itemInstance.foodCategory;
      if (!category || !this.equippedByCategory.has(category)) {
        this.emit({
          type: "itemPickupBlocked",
          itemId: definition.id,
          item: itemInstance,
          itemInstance,
          reason: "invalidEquipmentCategory",
        });
        return false;
      }

      const occupiedItem = this.equippedByCategory.get(category);
      if (occupiedItem) {
        this.emit({
          type: "itemPickupBlocked",
          itemId: definition.id,
          item: itemInstance,
          itemInstance,
          reason: "slotOccupied",
          foodCategory: category,
          occupiedItem,
        });
        return false;
      }

      this.equippedByCategory.set(category, itemInstance);
      const result = this.recalculateEquipmentEffects();
      this.emit({
        type: "itemPickedUp",
        itemId: definition.id,
        item: itemInstance,
        itemInstance,
      });
      this.emit({
        type: "passiveItemApplied",
        itemId: definition.id,
        item: itemInstance,
        itemInstance,
        result,
      });
      return true;
    }

    if (definition.type === ITEM_TYPES.CONSUMABLE) {
      this.knownConsumables.add(definition.id);

      if (!this.canPickupItem(definition.id)) {
        this.emit({
          type: "itemPickupBlocked",
          itemId: definition.id,
          item: definition,
          reason: "inventoryFull",
        });
        return false;
      }

      this.addItemCount(this.consumables, definition.id, 1);
      this.emit({
        type: "itemPickedUp",
        itemId: definition.id,
        item: definition,
      });
      return true;
    }

    return false;
  }

  removeItem(itemOrId, context = {}) {
    const baseItemId = getItemBaseId(itemOrId);
    const definition = getItemDefinition(baseItemId);
    if (!definition) return false;

    if (definition.type === ITEM_TYPES.EQUIPPABLE) {
      const entry = this.findEquippedEntry(itemOrId);
      if (!entry) {
        this.emit({
          type: "itemRemoveFailed",
          itemId: definition.id,
          item: definition,
          reason: "missingItem",
        });
        return false;
      }

      this.equippedByCategory.set(entry.category, null);
      const result = this.recalculateEquipmentEffects(context);
      this.emit({
        type: "itemRemoved",
        itemId: definition.id,
        item: entry.item,
        itemInstance: entry.item,
      });
      this.emit({
        type: "passiveItemRemoved",
        itemId: definition.id,
        item: entry.item,
        itemInstance: entry.item,
        result,
      });
      return true;
    }

    if (definition.type === ITEM_TYPES.CONSUMABLE) {
      this.knownConsumables.add(definition.id);

      const count = this.getConsumableCount(definition.id);
      if (count <= 0) {
        this.emit({
          type: "itemRemoveFailed",
          itemId: definition.id,
          item: definition,
          reason: "missingItem",
        });
        return false;
      }

      this.setItemCount(this.consumables, definition.id, count - 1);
      this.emit({
        type: "itemRemoved",
        itemId: definition.id,
        item: definition,
      });
      return true;
    }

    return false;
  }

  getEquippedItemForCategory(category) {
    if (!category || !this.equippedByCategory.has(category)) return null;

    return this.equippedByCategory.get(category) ?? null;
  }

  getReplacementCandidate(itemOrId, context = {}) {
    const itemInstance = normalizeItemInstance(itemOrId, context);
    if (!itemInstance) {
      return {
        canReplace: false,
        reason: "unknownItem",
        itemInstance: null,
        previousItem: null,
        foodCategory: null,
      };
    }

    const definition = getItemDefinition(itemInstance.baseItemId);
    if (!definition || definition.type !== ITEM_TYPES.EQUIPPABLE) {
      return {
        canReplace: false,
        reason: "unsupportedItemType",
        itemInstance,
        previousItem: null,
        foodCategory: itemInstance.foodCategory ?? null,
      };
    }

    const category = itemInstance.foodCategory;
    if (!category || !this.equippedByCategory.has(category)) {
      return {
        canReplace: false,
        reason: "invalidEquipmentCategory",
        itemInstance,
        previousItem: null,
        foodCategory: category ?? null,
      };
    }

    const previousItem = this.getEquippedItemForCategory(category);

    return {
      canReplace: Boolean(previousItem),
      reason: previousItem ? null : "emptySlot",
      itemInstance,
      previousItem,
      foodCategory: category,
    };
  }

  replaceEquippedItem(itemOrId, context = {}) {
    const candidate = this.getReplacementCandidate(itemOrId, context);
    if (!candidate.itemInstance || !candidate.foodCategory) {
      return {
        success: false,
        reason: candidate.reason,
        previousItem: null,
        equippedItem: null,
        result: null,
      };
    }

    if (!candidate.previousItem) {
      const pickedUp = this.pickupItem(candidate.itemInstance, context);

      return {
        success: pickedUp,
        reason: pickedUp ? null : this.getPickupBlockReason(candidate.itemInstance),
        previousItem: null,
        equippedItem: pickedUp ? candidate.itemInstance : null,
        result: null,
      };
    }

    this.equippedByCategory.set(candidate.foodCategory, candidate.itemInstance);
    const result = this.recalculateEquipmentEffects(context);
    this.emit({
      type: "itemReplaced",
      itemId: candidate.itemInstance.baseItemId,
      item: candidate.itemInstance,
      itemInstance: candidate.itemInstance,
      previousItem: candidate.previousItem,
      foodCategory: candidate.foodCategory,
      result,
    });

    return {
      success: true,
      reason: null,
      previousItem: candidate.previousItem,
      equippedItem: candidate.itemInstance,
      result,
    };
  }

  useConsumable(itemId, context = {}) {
    const definition = getItemDefinition(itemId);
    if (!definition || definition.type !== ITEM_TYPES.CONSUMABLE) return false;

    const count = this.getConsumableCount(definition.id);
    if (count <= 0) {
      this.emit({
        type: "itemUseFailed",
        itemId: definition.id,
        item: definition,
        reason: "missingItem",
      });
      return false;
    }

    const result = this.itemEffects.apply(definition.id, {
      ...context,
      player: this.player,
    });

    if (!result.consumed) {
      this.emit({
        type: "itemUseFailed",
        itemId: definition.id,
        item: definition,
        reason: result.reason,
      });
      return false;
    }

    this.setItemCount(this.consumables, definition.id, count - 1);
    this.emit({
      type: "itemUsed",
      itemId: definition.id,
      item: definition,
      result,
    });
    return true;
  }

  useConsumableSlot(slotIndex, context = {}) {
    const useSlot = slotIndex + 1;
    const definition = getItemDefinitionByUseSlot(useSlot);
    if (!definition || definition.type !== ITEM_TYPES.CONSUMABLE) return false;

    return this.useConsumable(definition.id, context);
  }

  recalculateEquipmentEffects() {
    const nextTotals = this.calculateEquipmentTotals();
    const result = this.itemEffects.applyEquipmentTotals({
      player: this.player,
      previousTotals: this.appliedEquipmentTotals,
      nextTotals,
    });

    this.appliedEquipmentTotals = { ...nextTotals };
    return result;
  }

  calculateEquipmentTotals() {
    const totals = {};

    for (const itemInstance of this.equippedByCategory.values()) {
      if (!itemInstance?.rolledStats) continue;

      for (const [stat, value] of Object.entries(itemInstance.rolledStats)) {
        if (!EQUIPMENT_STATS.has(stat)) continue;

        totals[stat] = (totals[stat] ?? 0) + (Number.parseFloat(value) || 0);
      }
    }

    return totals;
  }

  getConsumableEntries() {
    const itemIds = new Set([
      ...this.knownConsumables,
      ...this.consumables.keys(),
    ]);

    return [...itemIds]
      .map((itemId) => this.createConsumableEntry(itemId, this.getConsumableCount(itemId)))
      .filter((entry) => entry.item)
      .sort(this.sortEntriesByHudSlot);
  }

  createProgressSnapshot() {
    return {
      equippedByCategory: Object.fromEntries(this.equippedByCategory.entries()),
      appliedEquipmentTotals: { ...this.appliedEquipmentTotals },
      consumables: [...this.consumables.entries()],
      knownConsumables: [...this.knownConsumables],
    };
  }

  restoreProgressSnapshot(snapshot) {
    if (!snapshot) return;

    this.equippedByCategory = this.createEmptyEquipmentSlots();

    if (snapshot.equippedByCategory) {
      for (const [category, itemInstance] of Object.entries(snapshot.equippedByCategory)) {
        if (!this.equippedByCategory.has(category)) continue;

        this.equippedByCategory.set(category, normalizeItemInstance(itemInstance));
      }
    } else {
      this.restoreLegacyPassives(snapshot.passives);
    }

    this.appliedEquipmentTotals = { ...(snapshot.appliedEquipmentTotals ?? {}) };
    this.consumables = new Map(snapshot.consumables ?? []);
    this.knownConsumables = new Set(snapshot.knownConsumables ?? []);
    this.recalculateEquipmentEffects();
  }

  restoreLegacyPassives(passives = []) {
    for (const [itemId, count] of passives) {
      if (count <= 0) continue;

      const itemInstance = normalizeItemInstance(itemId, {
        source: "legacySnapshot",
      });
      const category = itemInstance?.foodCategory;
      if (!category || this.equippedByCategory.get(category)) continue;

      this.equippedByCategory.set(category, itemInstance);
    }
  }

  reset() {
    this.equippedByCategory = this.createEmptyEquipmentSlots();
    this.appliedEquipmentTotals = {};
    this.consumables.clear();
    this.knownConsumables.clear();
    this.events = [];
  }

  getPassiveEntries() {
    return [...this.equippedByCategory.values()]
      .filter(Boolean)
      .map((itemInstance) => this.createEquipmentEntry(itemInstance))
      .sort(this.sortEntriesByHudSlot);
  }

  getPassiveCount(itemId) {
    return this.getPassiveEntries()
      .filter((entry) => entry.item?.baseItemId === itemId)
      .length;
  }

  getConsumableCount(itemId) {
    return this.consumables.get(itemId) ?? 0;
  }

  isConsumableKnown(itemId) {
    const definition = getItemDefinition(itemId);
    if (!definition || definition.type !== ITEM_TYPES.CONSUMABLE) return false;

    return this.knownConsumables.has(definition.id) ||
      this.getConsumableCount(definition.id) > 0;
  }

  canPickupItem(itemOrId) {
    return this.getPickupBlockReason(itemOrId) === null;
  }

  getPickupBlockReason(itemOrId) {
    const baseItemId = getItemBaseId(itemOrId);
    const definition = getItemDefinition(baseItemId);
    if (!definition) return "unknownItem";

    if (definition.type === ITEM_TYPES.CONSUMABLE) {
      return this.getConsumableCount(definition.id) < getItemMaxStack(definition.id)
        ? null
        : "inventoryFull";
    }

    if (definition.type === ITEM_TYPES.EQUIPPABLE) {
      const category = itemOrId?.foodCategory ?? definition.foodCategory;
      if (!category || !this.equippedByCategory.has(category)) {
        return "invalidEquipmentCategory";
      }

      return this.equippedByCategory.get(category) ? "slotOccupied" : null;
    }

    return "unsupportedItemType";
  }

  createEquipmentEntry(itemInstance) {
    const definition = getItemDefinitionForInstance(itemInstance);

    return {
      item: itemInstance,
      itemInstance,
      definition,
      count: 1,
      maxStack: 1,
      isMax: true,
      foodCategory: itemInstance.foodCategory,
    };
  }

  createConsumableEntry(itemId, count) {
    const maxStack = getItemMaxStack(itemId);

    return {
      item: getItemDefinition(itemId),
      count,
      maxStack,
      isMax: Number.isFinite(maxStack) && count >= maxStack,
    };
  }

  findEquippedEntry(itemOrId) {
    const baseItemId = getItemBaseId(itemOrId);
    const instanceId = itemOrId?.instanceId ?? null;

    for (const [category, item] of this.equippedByCategory.entries()) {
      if (!item) continue;
      if (instanceId && item.instanceId === instanceId) return { category, item };
      if (!instanceId && item.baseItemId === baseItemId) return { category, item };
    }

    return null;
  }

  sortEntriesByHudSlot(a, b) {
    return (a.item.hudSlot ?? 999) - (b.item.hudSlot ?? 999);
  }

  addItemCount(source, itemId, amount) {
    this.setItemCount(source, itemId, (source.get(itemId) ?? 0) + amount);
  }

  setItemCount(source, itemId, count) {
    if (count <= 0) {
      source.delete(itemId);
      return;
    }

    source.set(itemId, count);
  }

  createEmptyEquipmentSlots() {
    return new Map(
      Object.values(ITEM_FOOD_CATEGORIES).map((category) => [category, null])
    );
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
