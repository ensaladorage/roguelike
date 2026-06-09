import {
  getItemDescription,
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
    this.onUseConsumableSlot = null;
    this.logEntries = [];
    this.statHighlightTimers = new Map();
    this.onEpicRewardSelect = null;

    this.setupQuickUseButtons();
    this.setupEpicRewardOverlay();
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

    const name = document.createElement("strong");
    name.textContent = item.name;

    const description = document.createElement("span");
    description.textContent = getItemDescription(item);

    this.itemTooltip.append(name, description);
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

  hideItemTooltip() {
    if (!this.itemTooltip) return;

    this.itemTooltip.hidden = true;
  }

  showEpicChestRewards(options = [], onSelect = null) {
    if (!this.epicRewardOverlay || !this.epicRewardOptions) return;

    this.onEpicRewardSelect = onSelect;
    this.epicRewardOptions.innerHTML = "";

    for (const option of options) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `epic-reward-card is-${option.rarity ?? "epic"}`;
      button.dataset.rewardId = option.id;

      const image = document.createElement("img");
      image.src = option.item.imagePath;
      image.alt = "";
      image.setAttribute("aria-hidden", "true");

      const name = document.createElement("strong");
      name.textContent = option.item.name;

      const description = document.createElement("span");
      description.textContent = getItemDescription(option.item);

      button.append(image, name, description);
      button.addEventListener("click", () => {
        this.onEpicRewardSelect?.(option);
      });

      this.epicRewardOptions.appendChild(button);
    }

    this.epicRewardOverlay.hidden = false;
    this.epicRewardOptions.querySelector("button")?.focus();
  }

  hideEpicChestRewards() {
    if (!this.epicRewardOverlay) return;

    this.epicRewardOverlay.hidden = true;
    this.onEpicRewardSelect = null;
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
      button.hidden = true;
      button.style.display = "none";
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

  setupEpicRewardOverlay() {
    if (!this.epicRewardOverlay) return;

    this.epicRewardOverlay.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;

      event.preventDefault();
    });
  }

  updateQuickUseButtons(inventory) {
    for (const [useSlot, quickUse] of this.quickUseButtons.entries()) {
      const item = getItemDefinitionByUseSlot(useSlot);
      if (!item) continue;

      const count = inventory.getConsumableCount(item.id);
      const isKnown = inventory.isConsumableKnown?.(item.id) ?? count > 0;
      const maxStack = getItemMaxStack(item.id);
      const isMax = Number.isFinite(maxStack) && count >= maxStack;

      quickUse.button.hidden = !isKnown;
      quickUse.button.style.display = isKnown ? "" : "none";
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

  clearLog() {
    this.logEntries = [];

    if (this.logElement) {
      this.logElement.innerHTML = "";
    }

    this.clearStatHighlights();
    this.hideItemTooltip();
    this.hideEpicChestRewards();
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
    this.logEntries = this.logEntries.slice(0, 5);

    this.logElement.innerHTML = "";

    for (const entry of this.logEntries) {
      const p = document.createElement("p");
      p.textContent = entry;
      this.logElement.appendChild(p);
    }
  }
}
