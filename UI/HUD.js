export class HUD {
  constructor() {
    this.hpText = document.querySelector("#hpText");
    this.hpBar = document.querySelector("#hpBar");
    this.goldText = document.querySelector("#goldText");
    this.damageText = document.querySelector("#damageText");
    this.attackSpeedText = document.querySelector("#attackSpeedText");
    this.itemText = document.querySelector("#itemText");
    this.logElement = document.querySelector("#log");
    this.logEntries = [];
    this.statHighlightTimers = new Map();
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
