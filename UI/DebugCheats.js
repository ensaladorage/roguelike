import { ITEM_DEFINITIONS } from "../CharacterData/itemDefinitions.js";

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
  {
    id: "addGold",
    label: "Add Gold",
    description: "Add 999 gold to the player.",
  },
  {
    id: "nextLevel",
    label: "Next Level",
    description: "Trigger the current level exit.",
  },
];

const STYLE_ID = "debug-cheats-style";

export class DebugCheats {
  constructor({ onSelect, onItemAdjust, getState, getItemState } = {}) {
    this.onSelect = onSelect;
    this.onItemAdjust = onItemAdjust;
    this.getState = getState ?? (() => ({}));
    this.getItemState = getItemState ?? (() => ({}));
    this.cheats = DEBUG_CHEATS;
    this.itemCheats = Object.values(ITEM_DEFINITIONS).sort(
      (a, b) => (a.hudSlot ?? 999) - (b.hudSlot ?? 999)
    );
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

    const itemPanel = document.createElement("div");
    itemPanel.className = "debug-item-cheats";
    itemPanel.setAttribute("aria-label", "Debug item inventory cheats");

    const itemTitle = document.createElement("h3");
    itemTitle.textContent = "Items";

    const itemList = document.createElement("div");
    itemList.className = "debug-item-cheats-list";

    itemPanel.appendChild(itemTitle);
    itemPanel.appendChild(itemList);

    panel.appendChild(title);
    panel.appendChild(list);
    panel.appendChild(itemPanel);

    panel.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
    });
    panel.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    this.listElement = list;
    this.itemListElement = itemList;
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
        pointer-events: auto;
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

      .debug-item-cheats {
        position: absolute;
        top: 0;
        right: calc(100% + 10px);
        width: 208px;
        padding: 10px;
        border: 1px solid rgba(244, 241, 232, 0.18);
        border-radius: 8px;
        background: rgba(17, 19, 23, 0.9);
        box-shadow: 0 16px 36px rgba(0, 0, 0, 0.3);
        backdrop-filter: blur(10px);
      }

      .debug-item-cheats h3 {
        margin: 0 0 8px;
        font-size: 12px;
        line-height: 1.2;
      }

      .debug-item-cheats-list {
        display: grid;
        gap: 5px;
      }

      .debug-item-cheat {
        display: grid;
        grid-template-columns: 26px 1fr auto auto;
        align-items: center;
        gap: 6px;
        min-height: 30px;
        padding: 4px 5px;
        border: 1px solid rgba(244, 241, 232, 0.1);
        border-radius: 6px;
        background: rgba(244, 241, 232, 0.05);
      }

      .debug-item-cheat img {
        width: 24px;
        height: 24px;
        object-fit: contain;
        image-rendering: auto;
      }

      .debug-item-cheat-name {
        min-width: 0;
        overflow: hidden;
        color: rgba(244, 241, 232, 0.88);
        font-size: 11px;
        font-weight: 700;
        line-height: 1.1;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .debug-item-cheat-count {
        justify-self: end;
        min-width: 28px;
        color: rgba(244, 241, 232, 0.72);
        font-size: 10px;
        font-weight: 800;
        line-height: 1;
        text-align: right;
      }

      .debug-item-cheat-actions {
        display: flex;
        gap: 3px;
      }

      .debug-item-cheat-button {
        display: inline-grid;
        place-items: center;
        width: 22px;
        height: 22px;
        padding: 0;
        border: 1px solid rgba(244, 241, 232, 0.18);
        border-radius: 5px;
        background: rgba(244, 241, 232, 0.08);
        color: #f4f1e8;
        font-size: 15px;
        font-weight: 900;
        line-height: 1;
        cursor: pointer;
      }

      .debug-item-cheat-button:hover,
      .debug-item-cheat-button:focus-visible {
        border-color: rgba(86, 194, 113, 0.76);
        background: rgba(86, 194, 113, 0.24);
        outline: none;
      }

      @media (max-width: 640px) {
        .debug-cheats {
          top: calc(8px + env(safe-area-inset-top));
          right: calc(8px + env(safe-area-inset-right));
          width: min(240px, calc(100vw - 16px));
          padding: 9px;
        }

        .debug-item-cheats {
          position: static;
          width: auto;
          margin-top: 10px;
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

  adjustItem(item, delta) {
    if (!item) return;

    this.onItemAdjust?.(item, delta);
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
      option.addEventListener("click", () => {
        this.selectedIndex = index;
        this.selectCurrent();
      });

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

    this.renderItemCheats();
  }

  renderItemCheats() {
    if (!this.itemListElement) return;

    this.itemListElement.innerHTML = "";
    const itemState = this.getItemState() ?? {};

    this.itemCheats.forEach((item) => {
      const count = itemState[item.id] ?? 0;
      const row = document.createElement("div");
      row.className = "debug-item-cheat";

      const image = document.createElement("img");
      image.src = item.imagePath;
      image.alt = "";
      image.setAttribute("aria-hidden", "true");

      const name = document.createElement("span");
      name.className = "debug-item-cheat-name";
      name.textContent = item.name;
      name.title = item.name;

      const countText = document.createElement("span");
      countText.className = "debug-item-cheat-count";
      countText.textContent = `x${count}`;

      const actions = document.createElement("div");
      actions.className = "debug-item-cheat-actions";

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "debug-item-cheat-button";
      removeButton.textContent = "-";
      removeButton.title = `Remove ${item.name}`;
      removeButton.setAttribute("aria-label", `Remove ${item.name}`);
      removeButton.addEventListener("click", () => this.adjustItem(item, -1));

      const addButton = document.createElement("button");
      addButton.type = "button";
      addButton.className = "debug-item-cheat-button";
      addButton.textContent = "+";
      addButton.title = `Add ${item.name}`;
      addButton.setAttribute("aria-label", `Add ${item.name}`);
      addButton.addEventListener("click", () => this.adjustItem(item, 1));

      actions.appendChild(removeButton);
      actions.appendChild(addButton);

      row.appendChild(image);
      row.appendChild(name);
      row.appendChild(countText);
      row.appendChild(actions);
      this.itemListElement.appendChild(row);
    });
  }

  destroy() {
    window.removeEventListener("keydown", this.handleKeyDown);
    this.element?.remove();
  }
}
