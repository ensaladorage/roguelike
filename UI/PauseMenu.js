const STYLE_ID = "pause-menu-style";

export class PauseMenu {
  constructor({
    initialSoundLevel = 70,
    onOpenChange,
    onSoundLevelChange,
    canOpen,
  } = {}) {
    this.isOpen = false;
    this.soundLevel = this.normalizeSoundLevel(initialSoundLevel);
    this.onOpenChange = onOpenChange;
    this.onSoundLevelChange = onSoundLevelChange;
    this.canOpen = canOpen ?? (() => true);

    this.handleKeyDown = this.handleKeyDown.bind(this);

    this.ensureStyles();
    this.element = this.createElement();
    document.body.appendChild(this.element);
    window.addEventListener("keydown", this.handleKeyDown);
    this.render();
  }

  createElement() {
    const overlay = document.createElement("section");
    overlay.className = "pause-menu";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "pauseMenuTitle");
    overlay.setAttribute("aria-hidden", "true");

    const panel = document.createElement("div");
    panel.className = "pause-menu__panel";

    const title = document.createElement("h2");
    title.id = "pauseMenuTitle";
    title.textContent = "Paused";

    const control = document.createElement("label");
    control.className = "pause-menu__control";

    const labelRow = document.createElement("span");
    labelRow.className = "pause-menu__label-row";

    const labelText = document.createElement("span");
    labelText.textContent = "Sounds";

    const value = document.createElement("output");
    value.className = "pause-menu__value";
    value.setAttribute("for", "pauseMenuSounds");

    labelRow.append(labelText, value);

    const slider = document.createElement("input");
    slider.id = "pauseMenuSounds";
    slider.type = "range";
    slider.min = "0";
    slider.max = "100";
    slider.step = "1";
    slider.setAttribute("aria-label", "Sounds");

    slider.addEventListener("input", () => {
      this.soundLevel = this.normalizeSoundLevel(slider.value);
      this.onSoundLevelChange?.(this.soundLevel);
      this.render();
    });

    control.append(labelRow, slider);
    panel.append(title, control);
    overlay.appendChild(panel);

    overlay.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
    });

    overlay.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    this.sliderElement = slider;
    this.valueElement = value;

    return overlay;
  }

  ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .pause-menu {
        position: fixed;
        inset: 0;
        z-index: 40;
        display: none;
        place-items: center;
        padding: 18px;
        background: rgba(17, 19, 23, 0.52);
        color: #f4f1e8;
        pointer-events: auto;
      }

      .pause-menu.is-open {
        display: grid;
      }

      .pause-menu__panel {
        width: min(360px, calc(100vw - 36px));
        padding: 18px;
        border: 1px solid rgba(244, 241, 232, 0.22);
        border-radius: 8px;
        background: rgba(25, 28, 33, 0.96);
        box-shadow: 0 24px 48px rgba(0, 0, 0, 0.42);
        backdrop-filter: blur(10px);
      }

      .pause-menu h2 {
        margin: 0 0 16px;
        font-size: 20px;
        line-height: 1.2;
        letter-spacing: 0;
      }

      .pause-menu__control {
        display: grid;
        gap: 10px;
      }

      .pause-menu__label-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        font-size: 14px;
        font-weight: 800;
        line-height: 1.2;
      }

      .pause-menu__value {
        min-width: 36px;
        color: rgba(244, 241, 232, 0.78);
        text-align: right;
      }

      .pause-menu input[type="range"] {
        width: 100%;
        accent-color: #56c271;
        cursor: pointer;
      }

      .pause-menu input[type="range"]:focus-visible {
        outline: 2px solid #f0b35a;
        outline-offset: 4px;
      }
    `;

    document.head.appendChild(style);
  }

  handleKeyDown(event) {
    if (event.key !== "Escape" || event.repeat) return;
    if (this.isEditableTarget(event.target) && !this.isOpen) return;

    if (!this.isOpen && !this.canOpen()) return;

    event.preventDefault();
    event.stopPropagation();
    this.toggle();
  }

  toggle() {
    this.setOpen(!this.isOpen);
  }

  setOpen(isOpen) {
    if (this.isOpen === isOpen) return;

    this.isOpen = isOpen;
    this.render();
    this.onOpenChange?.(this.isOpen);

    if (this.isOpen) {
      this.sliderElement?.focus();
    }
  }

  render() {
    this.element.classList.toggle("is-open", this.isOpen);
    this.element.setAttribute("aria-hidden", String(!this.isOpen));

    if (this.sliderElement) {
      this.sliderElement.value = String(this.soundLevel);
    }

    if (this.valueElement) {
      this.valueElement.textContent = String(this.soundLevel);
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

  normalizeSoundLevel(value) {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) return 70;

    return Math.max(0, Math.min(100, Math.round(numericValue)));
  }
}
