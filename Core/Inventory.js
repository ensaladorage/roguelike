import {
  ITEM_TYPES,
  getItemDefinitionByUseSlot,
  getItemDefinition,
  getItemMaxStack,
} from "../CharacterData/itemDefinitions.js";

export class Inventory {
  constructor({ player, itemEffects }) {
    this.player = player;
    this.itemEffects = itemEffects;
    this.passives = new Map();
    this.consumables = new Map();
    this.knownConsumables = new Set();
    this.events = [];
  }

  pickupItem(itemId, context = {}) {
    const definition = getItemDefinition(itemId);
    if (!definition) return false;

    this.addItemCount(this.passives, definition.id, 0);
    this.addItemCount(this.consumables, definition.id, 0);

    if (definition.type === ITEM_TYPES.PASSIVE) {
      const result = this.itemEffects.apply(definition.id, {
        ...context,
        player: this.player,
      });

      if (!result.applied) return false;

      this.addItemCount(this.passives, definition.id, 1);
      this.emit({
        type: "itemPickedUp",
        itemId: definition.id,
        item: definition,
      });
      this.emit({
        type: "passiveItemApplied",
        itemId: definition.id,
        item: definition,
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

  getConsumableEntries() {
    const itemIds = new Set([
      ...this.knownConsumables,
      ...this.consumables.keys(),
    ]);

    return [...itemIds]
      .map((itemId) => this.createEntry(itemId, this.getConsumableCount(itemId)))
      .filter((entry) => entry.item)
      .sort(this.sortEntriesByHudSlot);
  }

  createProgressSnapshot() {
    return {
      passives: [...this.passives.entries()],
      consumables: [...this.consumables.entries()],
      knownConsumables: [...this.knownConsumables],
    };
  }

  restoreProgressSnapshot(snapshot) {
    if (!snapshot) return;

    this.passives = new Map(snapshot.passives ?? []);
    this.consumables = new Map(snapshot.consumables ?? []);
    this.knownConsumables = new Set(snapshot.knownConsumables ?? []);
  }

  reset() {
    this.passives = new Map();
    this.consumables = new Map();
    this.knownConsumables = new Set();
    this.events = [];
  }

  getPassiveEntries() {
    return this.getEntries(this.passives).sort(this.sortEntriesByHudSlot);
  }

  getConsumableCount(itemId) {
    return this.consumables.get(itemId) ?? 0;
  }

  canPickupItem(itemId) {
    const definition = getItemDefinition(itemId);
    if (!definition) return false;

    if (definition.type !== ITEM_TYPES.CONSUMABLE) return true;

    return this.getConsumableCount(itemId) < getItemMaxStack(itemId);
  }

  getEntries(source) {
    return [...source.entries()]
      .filter(([, count]) => count > 0)
      .map(([itemId, count]) => this.createEntry(itemId, count))
      .filter((entry) => entry.item);
  }

  createEntry(itemId, count) {
    const maxStack = getItemMaxStack(itemId);

    return {
      item: getItemDefinition(itemId),
      count,
      maxStack,
      isMax: Number.isFinite(maxStack) && count >= maxStack,
    };
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

  emit(event) {
    this.events.push(event);
  }

  consumeEvents() {
    const events = this.events;
    this.events = [];
    return events;
  }
}
