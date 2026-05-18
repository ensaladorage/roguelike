export class HUD {
  constructor() {
    this.hpText = document.querySelector("#hpText");
    this.hpBar = document.querySelector("#hpBar");
    this.goldText = document.querySelector("#goldText");
    this.logElement = document.querySelector("#log");
    this.logEntries = [];
  }

  updatePlayer(player) {
    if (this.hpText) {
      this.hpText.textContent =
        `${player.hp} / ${player.maxHp} PV`;
    }

    if (this.hpBar) {
      const ratio = player.hp / player.maxHp;
      this.hpBar.style.width =
        `${Math.max(0, Math.min(1, ratio)) * 100}%`;
    }

    if (this.goldText) {
      this.goldText.textContent = player.gold.toString();
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
