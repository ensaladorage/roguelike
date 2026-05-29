const DEBUG_CHEATS = [
  {
    id: "killPlayer",
    label: "Kill Player",
    description: "Set player HP to 0.",
  },
  {
    id: "takeDamage50",
    label: "Take Damage 50",
    description: "Deal 50 damage to the player.",
  },
  {
    id: "superSpeed",
    label: "Super Speed",
    description: "Toggle player movement speed x5.",
    toggle: true,
  },
  {
    id: "exterminator",
    label: "Exterminator",
    description: "Toggle player damage to 999999.",
    toggle: true,
  },
];

const STYLE_ID = "debug-cheats-style";

export class DebugCheats {
  constructor({ onSelect, getState } = {}) {
    this.onSelect = onSelect;
    this.getState = getState ?? (() => ({}));
    this.cheats = DEBUG_CHEATS;
    this.selectedIndex = 0;
    this.isOpen = false;

    this.handleKeyDown = this.handleKeyDown.bind(this);

    this.ensureStyles();
    this.element = this.createElement();
    document.body.appendChild(this.element);
    window.addEventListener("keydown", this.handleKeyDown);
    this.render();
  }

  createElement() {
    const panel = document.createElement("section");
    panel.className = "debug-cheats";
    panel.setAttribute("aria-label", "Debug cheats");
    panel.setAttribute("aria-hidden", "true");

    const title = document.createElement("h2");
    title.textContent = "Debug Cheats";

    const list = document.createElement("div");
    list.className = "debug-cheats-list";
    list.setAttribute("role", "listbox");
    list.setAttribute("aria-label", "Available debug cheats");

    panel.appendChild(title);
    panel.appendChild(list);

    this.listElement = list;
    return panel;
  }

  ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .debug-cheats {
        position: fixed;
        top: 18px;
        right: 18px;
        z-index: 20;
        display: none;
        width: min(280px, calc(100vw - 36px));
        padding: 12px;
        border: 1px solid rgba(244, 241, 232, 0.2);
        border-radius: 8px;
        background: rgba(17, 19, 23, 0.9);
        box-shadow: 0 16px 36px rgba(0, 0, 0, 0.34);
        backdrop-filter: blur(10px);
        color: #f4f1e8;
        pointer-events: none;
      }

      .debug-cheats.is-open {
        display: block;
      }

      .debug-cheats h2 {
        margin: 0 0 10px;
        font-size: 14px;
        line-height: 1.2;
      }

      .debug-cheats-list {
        display: grid;
        gap: 6px;
      }

      .debug-cheats-option {
        display: grid;
        gap: 3px;
        padding: 8px 9px;
        border: 1px solid rgba(244, 241, 232, 0.12);
        border-radius: 6px;
        background: rgba(244, 241, 232, 0.06);
      }

      .debug-cheats-option.is-selected {
        border-color: rgba(86, 194, 113, 0.7);
        background: rgba(86, 194, 113, 0.18);
      }

      .debug-cheats-label {
        font-size: 13px;
        font-weight: 800;
        line-height: 1.2;
      }

      .debug-cheats-title-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }

      .debug-cheats-status {
        min-width: 34px;
        padding: 2px 6px;
        border-radius: 999px;
        background: rgba(244, 241, 232, 0.1);
        color: rgba(244, 241, 232, 0.72);
        font-size: 10px;
        font-weight: 800;
        line-height: 1;
        text-align: center;
      }

      .debug-cheats-option.is-active .debug-cheats-status {
        background: rgba(86, 194, 113, 0.22);
        color: #76e293;
      }

      .debug-cheats-description {
        color: rgba(244, 241, 232, 0.7);
        font-size: 11px;
        line-height: 1.25;
      }

      @media (max-width: 640px) {
        .debug-cheats {
          top: calc(8px + env(safe-area-inset-top));
          right: calc(8px + env(safe-area-inset-right));
          width: min(240px, calc(100vw - 16px));
          padding: 9px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  handleKeyDown(event) {
    if (this.isEditableTarget(event.target)) return;

    if (event.key.toLowerCase() === "p") {
      if (event.repeat) return;
      event.preventDefault();
      event.stopPropagation();
      this.toggle();
      return;
    }

    if (!this.isOpen) return;

    switch (event.key) {
      case "ArrowUp":
        event.preventDefault();
        event.stopPropagation();
        this.moveSelection(-1);
        break;

      case "ArrowDown":
        event.preventDefault();
        event.stopPropagation();
        this.moveSelection(1);
        break;

      case "Home":
        event.preventDefault();
        event.stopPropagation();
        this.selectedIndex = 0;
        this.render();
        break;

      case "End":
        event.preventDefault();
        event.stopPropagation();
        this.selectedIndex = this.cheats.length - 1;
        this.render();
        break;

      case "Enter":
        if (event.repeat) return;
        event.preventDefault();
        event.stopPropagation();
        this.selectCurrent();
        break;
    }
  }

  isEditableTarget(target) {
    if (!target) return false;

    const tagName = target.tagName?.toLowerCase();
    return (
      target.isContentEditable ||
      tagName === "input" ||
      tagName === "textarea" ||
      tagName === "select"
    );
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    this.isOpen = true;
    this.element.classList.add("is-open");
    this.element.setAttribute("aria-hidden", "false");
    this.render();
  }

  close() {
    this.isOpen = false;
    this.element.classList.remove("is-open");
    this.element.setAttribute("aria-hidden", "true");
  }

  moveSelection(direction) {
    const count = this.cheats.length;
    if (count === 0) return;

    this.selectedIndex = (this.selectedIndex + direction + count) % count;
    this.render();
  }

  selectCurrent() {
    const cheat = this.cheats[this.selectedIndex];
    if (!cheat) return;

    this.onSelect?.(cheat);
    this.render();
  }

  render() {
    if (!this.listElement) return;

    this.listElement.innerHTML = "";

    const state = this.getState() ?? {};

    this.cheats.forEach((cheat, index) => {
      const isActive = Boolean(cheat.toggle && state[cheat.id]);
      const option = document.createElement("div");
      option.className = "debug-cheats-option";
      option.classList.toggle("is-selected", index === this.selectedIndex);
      option.classList.toggle("is-active", isActive);
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", String(index === this.selectedIndex));

      const titleRow = document.createElement("div");
      titleRow.className = "debug-cheats-title-row";

      const label = document.createElement("span");
      label.className = "debug-cheats-label";
      label.textContent = cheat.label;

      titleRow.appendChild(label);

      if (cheat.toggle) {
        const status = document.createElement("span");
        status.className = "debug-cheats-status";
        status.textContent = isActive ? "ON" : "OFF";
        titleRow.appendChild(status);
      }

      const description = document.createElement("span");
      description.className = "debug-cheats-description";
      description.textContent = cheat.description;

      option.appendChild(titleRow);
      option.appendChild(description);
      this.listElement.appendChild(option);
    });
  }

  destroy() {
    window.removeEventListener("keydown", this.handleKeyDown);
    this.element?.remove();
  }
}
