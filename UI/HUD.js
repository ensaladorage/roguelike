import {
  getItemDefinitionByUseSlot,
  getItemMaxStack,
} from "../CharacterData/itemDefinitions.js";

const QUICK_USE_SLOTS = [1, 2];

export class HUD {
  constructor() {
    this.hpText = document.querySelector("#hpText");
    this.hpBar = document.querySelector("#hpBar");
    this.goldText = document.querySelector("#goldText");
    this.damageText = document.querySelector("#damageText");
    this.attackSpeedText = document.querySelector("#attackSpeedText");
    this.itemText = document.querySelector("#itemText");
    this.logElement = document.querySelector("#log");
    this.quickUseElement = document.querySelector("#quickUseBar");
    this.quickUseButtons = new Map();
    this.onUseConsumableSlot = null;
    this.logEntries = [];
    this.statHighlightTimers = new Map();

    this.setupQuickUseButtons();
  }

  setConsumableUseHandler(handler) {
    this.onUseConsumableSlot = handler;
  }

  updatePlayer(player) {
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
  }

  updateInventory(inventory) {
    this.updateQuickUseButtons(inventory);

    if (!this.itemText) return;

    const consumables = inventory.getConsumableEntries();
    const entries = [
      ...consumables,
      ...inventory.getPassiveEntries(),
    ];

    this.itemText.innerHTML = "";

    if (entries.length === 0) {
      this.itemText.textContent = "Empty";
      return;
    }

    const list = document.createElement("span");
    list.className = "inventory-items";

    entries.forEach((entry, index) => {
      const item = document.createElement("span");
      item.className = "inventory-item";
      item.title = entry.item.useSlot
        ? `${entry.item.useSlot}: ${entry.item.name}`
        : `${entry.item.hudSlot}: ${entry.item.name}`;

      const image = document.createElement("img");
      image.src = entry.item.imagePath;
      image.alt = entry.item.name;

      const count = document.createElement("span");
      count.className = "inventory-count";
      if (entry.isMax) {
        count.classList.add("is-max");
      }
      count.textContent = entry.isMax ? "Max." : `x${entry.count}`;

      item.appendChild(image);
      item.appendChild(count);
      list.appendChild(item);
    });

    this.itemText.appendChild(list);
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
      button.disabled = true;
      button.classList.add("is-empty");

      const image = document.createElement("img");
      image.src = item.imagePath;
      image.alt = "";
      image.setAttribute("aria-hidden", "true");

      const count = document.createElement("span");
      count.className = "quick-use-count";
      count.textContent = "x0";

      button.appendChild(image);
      button.appendChild(count);
      this.quickUseElement.appendChild(button);
      this.quickUseButtons.set(useSlot, { button, count, item });
    }

    this.quickUseElement.addEventListener("click", (event) => {
      const button = event.target.closest("[data-slot-index]");
      if (!button || button.disabled) return;

      const slotIndex = Number(button.dataset.slotIndex);
      if (!Number.isInteger(slotIndex)) return;

      this.onUseConsumableSlot?.(slotIndex);
    });
  }

  updateQuickUseButtons(inventory) {
    for (const [useSlot, quickUse] of this.quickUseButtons.entries()) {
      const item = getItemDefinitionByUseSlot(useSlot);
      if (!item) continue;

      const count = inventory.getConsumableCount(item.id);
      const maxStack = getItemMaxStack(item.id);
      const isMax = Number.isFinite(maxStack) && count >= maxStack;

      quickUse.count.textContent = isMax ? "Max." : `x${count}`;
      quickUse.count.classList.toggle("is-max", isMax);
      quickUse.button.disabled = count <= 0;
      quickUse.button.classList.toggle("is-empty", count <= 0);
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
    this.logEntries = this.logEntries.slice(0, 5);

    this.logElement.innerHTML = "";

    for (const entry of this.logEntries) {
      const p = document.createElement("p");
      p.textContent = entry;
      this.logElement.appendChild(p);
    }
  }
}
