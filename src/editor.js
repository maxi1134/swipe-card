import { LitElement, html, css } from "lit";
import { keyed } from "lit/directives/keyed.js";
import { mdiArrowLeft, mdiArrowRight, mdiDelete, mdiPlus } from "@mdi/js";

const fireEvent = (node, type, detail = {}) =>
  node.dispatchEvent(
    new CustomEvent(type, { detail, bubbles: true, composed: true })
  );

const NUMERIC = /^-?\d+(\.\d+)?$/;

const SCHEMA = [
  { name: "start_card", selector: { text: {} } },
  { name: "reset_after", selector: { text: {} } },
  { name: "card_width", selector: { text: {} } },
  { name: "parameters", selector: { object: {} } },
];

const LABELS = {
  start_card: "Start card",
  reset_after: "Reset after (seconds)",
  card_width: "Card width (CSS)",
  parameters: "Swiper parameters (YAML)",
};

const HELPER_TEXTS = {
  start_card:
    "Slide shown first: a 1-based number, a negative number counting from the end, or a Jinja template returning one.",
  reset_after:
    "Return to the start card after this many seconds of inactivity. Accepts a Jinja template.",
  card_width: "CSS width forced on every slide, e.g. 80% or 200px.",
  parameters:
    "Any option from https://swiperjs.com/swiper-api#parameters, e.g. navigation, pagination, effect.",
};

class SwipeCardEditor extends LitElement {
  static get properties() {
    return {
      hass: { attribute: false },
      lovelace: { attribute: false },
      _config: { state: true },
      _selectedCard: { state: true },
      _GUImode: { state: true },
      _guiModeAvailable: { state: true },
      _editorComponentsReady: { state: true },
    };
  }

  constructor() {
    super();
    this._selectedCard = 0;
    this._GUImode = true;
    this._guiModeAvailable = true;
    this._keySalt = 0;
    this._editorComponentsReady = this._componentsReady();
  }

  _componentsReady() {
    return Boolean(
      customElements.get("hui-card-picker") &&
        customElements.get("hui-card-element-editor")
    );
  }

  connectedCallback() {
    super.connectedCallback();
    this._loadEditorComponents();
  }

  async _loadEditorComponents() {
    if (this._componentsReady()) {
      this._editorComponentsReady = true;
      return;
    }
    try {
      // hui-card-picker and hui-card-element-editor are lazy-loaded by the
      // frontend; instantiating the stack card editor forces the chunk that
      // registers them (the standard trick used by custom cards in 2026).
      const helpers = await window.loadCardHelpers?.();
      helpers?.createCardElement({ type: "vertical-stack", cards: [] });
      await customElements.whenDefined("hui-vertical-stack-card");
      await customElements.get("hui-vertical-stack-card").getConfigElement();
      if (!customElements.get("ha-form")) {
        customElements.get("hui-tile-card")?.getConfigElement();
      }
    } catch (err) {
      console.warn("SWIPE-CARD: failed to preload editor components", err);
    }
    this._editorComponentsReady = this._componentsReady();
  }

  setConfig(config) {
    if (!config || (config.cards && !Array.isArray(config.cards))) {
      throw new Error("Card config incorrect");
    }
    this._config = { ...config, cards: config.cards || [] };
  }

  get _cards() {
    return this._config?.cards || [];
  }

  // HA hands config editors the LovelaceConfig (with .views); tolerate
  // being given the Lovelace wrapper object instead — hui-card-picker
  // renders blank if it receives the wrapper.
  get _lovelaceConfig() {
    const ll = this.lovelace;
    if (ll && !ll.views && ll.config?.views) {
      return ll.config;
    }
    return ll;
  }

  get _cardEditorEl() {
    return this.shadowRoot?.querySelector("hui-card-element-editor");
  }

  render() {
    if (!this.hass || !this._config) {
      return html``;
    }

    const selected = this._selectedCard;
    const numcards = this._cards.length;

    return html`
      <ha-form
        .hass=${this.hass}
        .data=${this._config}
        .schema=${SCHEMA}
        .computeLabel=${this._computeLabel}
        .computeHelper=${this._computeHelper}
        @value-changed=${this._handleFormValueChanged}
      ></ha-form>
      <div class="toolbar">
        <div class="tabs" role="tablist">
          ${this._cards.map(
            (_card, i) => html`
              <button
                role="tab"
                class="tab ${i === selected ? "active" : ""}"
                @click=${() => this._selectCard(i)}
              >
                ${i + 1}
              </button>
            `
          )}
          <button
            class="tab add ${selected === numcards ? "active" : ""}"
            title="Add card"
            @click=${() => this._selectCard(numcards)}
          >
            <ha-svg-icon .path=${mdiPlus}></ha-svg-icon>
          </button>
        </div>
      </div>
      ${!this._editorComponentsReady
        ? html`<div class="loading">Loading editor…</div>`
        : selected < numcards
          ? html`
              <div id="card-options">
                <ha-button
                  .disabled=${!this._guiModeAvailable}
                  @click=${this._toggleMode}
                >
                  ${this._GUImode ? "Show code editor" : "Show visual editor"}
                </ha-button>
                <ha-icon-button
                  .disabled=${selected === 0}
                  label="Move card before"
                  .path=${mdiArrowLeft}
                  @click=${this._handleMoveBefore}
                ></ha-icon-button>
                <ha-icon-button
                  .disabled=${selected === numcards - 1}
                  label="Move card after"
                  .path=${mdiArrowRight}
                  @click=${this._handleMoveAfter}
                ></ha-icon-button>
                <ha-icon-button
                  label="Delete card"
                  .path=${mdiDelete}
                  @click=${this._handleDeleteCard}
                ></ha-icon-button>
              </div>
              ${keyed(
                `${this._keySalt}-${selected}`,
                html`
                  <hui-card-element-editor
                    .hass=${this.hass}
                    .value=${this._cards[selected]}
                    .lovelace=${this._lovelaceConfig}
                    @config-changed=${this._handleChildConfigChanged}
                    @GUImode-changed=${this._handleGUIModeChanged}
                  ></hui-card-element-editor>
                `
              )}
            `
          : html`
              <hui-card-picker
                .hass=${this.hass}
                .lovelace=${this._lovelaceConfig}
                @config-changed=${this._handleCardPicked}
              ></hui-card-picker>
            `}
    `;
  }

  _computeLabel = (schema) => LABELS[schema.name] || schema.name;

  _computeHelper = (schema) => HELPER_TEXTS[schema.name];

  _handleFormValueChanged(ev) {
    ev.stopPropagation();
    const value = { ...ev.detail.value };
    for (const key of ["start_card", "reset_after"]) {
      const raw = value[key];
      if (raw === "" || raw === undefined || raw === null) {
        delete value[key];
      } else if (typeof raw === "string" && NUMERIC.test(raw.trim())) {
        value[key] = Number(raw.trim());
      }
    }
    if (value.card_width === "" || value.card_width === undefined) {
      delete value.card_width;
    }
    if (
      !value.parameters ||
      (typeof value.parameters === "object" &&
        Object.keys(value.parameters).length === 0)
    ) {
      delete value.parameters;
    }
    this._config = { ...value, cards: this._cards };
    fireEvent(this, "config-changed", { config: this._config });
  }

  _selectCard(index) {
    this._GUImode = true;
    this._guiModeAvailable = true;
    this._selectedCard = index;
  }

  _toggleMode() {
    this._cardEditorEl?.toggleMode();
  }

  _handleChildConfigChanged(ev) {
    // Must not bubble to the dialog, or HA saves the child config
    // as the whole card.
    ev.stopPropagation();
    const cards = [...this._cards];
    cards[this._selectedCard] = ev.detail.config;
    this._config = { ...this._config, cards };
    this._guiModeAvailable = ev.detail.guiModeAvailable !== false;
    fireEvent(this, "config-changed", { config: this._config });
  }

  _handleGUIModeChanged(ev) {
    ev.stopPropagation();
    this._GUImode = ev.detail.guiMode;
    this._guiModeAvailable = ev.detail.guiModeAvailable;
  }

  _handleCardPicked(ev) {
    ev.stopPropagation();
    const cards = [...this._cards, ev.detail.config];
    this._keySalt++;
    this._config = { ...this._config, cards };
    this._selectedCard = cards.length - 1;
    fireEvent(this, "config-changed", { config: this._config });
  }

  _handleDeleteCard() {
    const cards = [...this._cards];
    cards.splice(this._selectedCard, 1);
    this._keySalt++;
    this._config = { ...this._config, cards };
    this._selectedCard = Math.max(0, this._selectedCard - 1);
    fireEvent(this, "config-changed", { config: this._config });
  }

  _handleMoveBefore() {
    this._moveCard(-1);
  }

  _handleMoveAfter() {
    this._moveCard(1);
  }

  _moveCard(direction) {
    const source = this._selectedCard;
    const target = source + direction;
    const cards = [...this._cards];
    const card = cards.splice(source, 1)[0];
    cards.splice(target, 0, card);
    this._keySalt++;
    this._config = { ...this._config, cards };
    this._selectedCard = target;
    fireEvent(this, "config-changed", { config: this._config });
  }

  static get styles() {
    return css`
      ha-form {
        display: block;
        margin-bottom: 8px;
      }
      .toolbar {
        display: flex;
        align-items: center;
        margin-top: 12px;
      }
      .tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        flex-grow: 1;
      }
      .tab {
        min-width: 40px;
        height: 32px;
        padding: 0 12px;
        border-radius: 16px;
        border: 1px solid var(--divider-color, #e0e0e0);
        background: none;
        color: var(--primary-text-color, #212121);
        cursor: pointer;
        font: inherit;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .tab.active {
        background: var(--primary-color, #03a9f4);
        color: var(--text-primary-color, #fff);
        border-color: var(--primary-color, #03a9f4);
      }
      .tab.add ha-svg-icon {
        width: 20px;
        height: 20px;
      }
      #card-options {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        width: 100%;
        margin-top: 4px;
      }
      .loading {
        padding: 16px 0;
        color: var(--secondary-text-color, #727272);
      }
      hui-card-element-editor,
      hui-card-picker {
        display: block;
        margin-top: 8px;
      }
    `;
  }
}

customElements.define("swipe-card-editor", SwipeCardEditor);
