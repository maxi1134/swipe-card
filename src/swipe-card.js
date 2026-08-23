import { LitElement, html, css, unsafeCSS } from "lit";

import Swiper from "swiper/bundle";
import swiperStyle from "swiper/css/bundle";

import { normalizeParameters, sanitizedClone } from "./parameters.js";
import { isTemplate, subscribeRenderTemplate } from "./templates.js";

const TEMPLATE_KEYS = ["start_card", "reset_after"];

const computeCardSize = (card) => {
  if (typeof card.getCardSize === "function") {
    return card.getCardSize();
  }
  if (customElements.get(card.localName)) {
    return 1;
  }
  return customElements
    .whenDefined(card.localName)
    .then(() => computeCardSize(card));
};

class SwipeCard extends LitElement {
  static get properties() {
    return {
      _config: { state: true },
      _cards: { state: true },
      preview: { attribute: false },
    };
  }

  static getConfigElement() {
    return document.createElement("swipe-card-editor");
  }

  static getStubConfig() {
    return { cards: [] };
  }

  constructor() {
    super();
    this._templateResults = {};
    this._unsubRenderTemplates = new Map();
    this._buildId = 0;
  }

  shouldUpdate(changedProps) {
    return (
      changedProps.has("_config") ||
      changedProps.has("_cards") ||
      changedProps.has("preview")
    );
  }

  static get styles() {
    return css`
      ${unsafeCSS(swiperStyle)}
      :host {
        --swiper-theme-color: var(--primary-color);
        display: block;
        width: 100%;
      }
      .swiper {
        width: 100%;
        height: 100%;
      }
    `;
  }

  setConfig(config) {
    if (!config || !config.cards || !Array.isArray(config.cards)) {
      throw new Error("Card config incorrect: 'cards' must be a list");
    }
    TEMPLATE_KEYS.forEach((key) => {
      if (this._config && this._config[key] !== config[key]) {
        this._tryDisconnectKey(key);
        delete this._templateResults[key];
      }
    });
    this._config = config;
    this._parameters = normalizeParameters(config.parameters);
    this._cards = [];
    this._destroySwiper();
    this._loaded = false;
    if (window.ResizeObserver) {
      this._ro?.disconnect();
      this._ro = new ResizeObserver(() => this._scheduleSwiperUpdate());
    }
    this._templateReady = this._makeTemplateReadyPromise();
    this._tryConnect();
    this._createCards();
  }

  set hass(hass) {
    this._hass = hass;
    (this._cards || []).forEach((element) => {
      element.hass = hass;
    });
    this._tryConnect();
  }

  get hass() {
    return this._hass;
  }

  connectedCallback() {
    super.connectedCallback();
    this._tryConnect();
    if (this._config && this._hass && this._updated && !this._loaded) {
      this._initialLoad();
    } else if (this.swiper) {
      this.swiper.update();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._tryDisconnect();
  }

  updated(changedProperties) {
    super.updated(changedProperties);
    this._updated = true;
    if (changedProperties.has("preview") && this._cards) {
      this._cards.forEach((element) => {
        if (element.localName === "hui-card") {
          element.preview = this.preview ?? false;
        }
      });
    }
    if (this._config && this._hass && this.isConnected && !this._loaded) {
      this._initialLoad();
    } else if (this.swiper) {
      this.swiper.update();
    }
  }

  render() {
    if (!this._config || !this._hass) {
      return html``;
    }
    const lang = this._hass.selectedLanguage || this._hass.language;
    const isRTL = Boolean(
      this._hass.translationMetadata?.translations?.[lang]?.isRTL
    );

    return html`
      <div class="swiper swiper-container" dir="${isRTL ? "rtl" : "ltr"}">
        <div class="swiper-wrapper">${this._cards}</div>
        ${"pagination" in this._parameters
          ? html`<div class="swiper-pagination"></div>`
          : ""}
        ${"navigation" in this._parameters
          ? html`
              <div class="swiper-button-next"></div>
              <div class="swiper-button-prev"></div>
            `
          : ""}
        ${"scrollbar" in this._parameters
          ? html`<div class="swiper-scrollbar"></div>`
          : ""}
      </div>
    `;
  }

  async _initialLoad() {
    this._loaded = true;
    const initId = (this._initId = (this._initId || 0) + 1);

    await this.updateComplete;
    // Swiper must not initialize before the slides exist, or start_card
    // silently falls back to the first slide.
    await this._cardPromises;
    await this._templateReady;

    if (initId !== this._initId || this.swiper || !this.isConnected) {
      return;
    }
    const container = this.shadowRoot.querySelector(".swiper");
    if (!container) {
      return;
    }

    const parameters = {
      observer: true,
      observeParents: true,
      ...sanitizedClone(this._parameters),
    };

    if ("pagination" in parameters) {
      if (parameters.pagination === null || parameters.pagination === true) {
        parameters.pagination = {};
      }
      parameters.pagination.el =
        this.shadowRoot.querySelector(".swiper-pagination");
    }

    if ("navigation" in parameters) {
      if (parameters.navigation === null || parameters.navigation === true) {
        parameters.navigation = {};
      }
      parameters.navigation.nextEl = this.shadowRoot.querySelector(
        ".swiper-button-next"
      );
      parameters.navigation.prevEl = this.shadowRoot.querySelector(
        ".swiper-button-prev"
      );
    }

    if ("scrollbar" in parameters) {
      if (parameters.scrollbar === null || parameters.scrollbar === true) {
        parameters.scrollbar = {};
      }
      parameters.scrollbar.el =
        this.shadowRoot.querySelector(".swiper-scrollbar");
    }

    parameters.initialSlide = this._getStartIndex();

    this.swiper = new Swiper(container, parameters);

    if (this._config.reset_after) {
      this.swiper
        .on("slideChange", () => this._setResetTimer())
        .on("click", () => this._setResetTimer())
        .on("touchEnd", () => this._setResetTimer());
    }
  }

  _destroySwiper() {
    if (this.swiper) {
      try {
        this.swiper.destroy(true, true);
      } catch (_err) {
        // Swiper can throw when the DOM is already gone; nothing to clean up.
      }
      this.swiper = undefined;
    }
    if (this._resetTimer) {
      window.clearTimeout(this._resetTimer);
      this._resetTimer = undefined;
    }
  }

  _scheduleSwiperUpdate() {
    if (this._updateTimer) {
      window.clearTimeout(this._updateTimer);
    }
    this._updateTimer = window.setTimeout(() => {
      this._updateTimer = undefined;
      this.swiper?.update();
    }, 50);
  }

  _getStartIndex() {
    const count = this._cards?.length || 0;
    let raw = this._config.start_card;
    if (isTemplate(raw)) {
      raw = this._templateResults.start_card?.result;
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n === 0 || count === 0) {
      return 0;
    }
    // 1-based from the start, negative counts from the end (-1 = last).
    const index = n > 0 ? n - 1 : count + n;
    return Math.max(0, Math.min(count - 1, index));
  }

  _getResetAfterSeconds() {
    let raw = this._config.reset_after;
    if (isTemplate(raw)) {
      raw = this._templateResults.reset_after?.result;
    }
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }

  _setResetTimer() {
    if (this._resetTimer) {
      window.clearTimeout(this._resetTimer);
      this._resetTimer = undefined;
    }
    const seconds = this._getResetAfterSeconds();
    if (seconds <= 0) {
      return;
    }
    this._resetTimer = window.setTimeout(() => {
      this.swiper?.slideTo(this._getStartIndex());
    }, seconds * 1000);
  }

  _makeTemplateReadyPromise() {
    if (!this._config || !isTemplate(this._config.start_card)) {
      return Promise.resolve();
    }
    if (this._templateResults.start_card !== undefined) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this._resolveTemplateReady = resolve;
      // Don't block the card forever if the first result never arrives.
      window.setTimeout(resolve, 2000);
    });
  }

  _tryConnect() {
    TEMPLATE_KEYS.forEach((key) => this._tryConnectKey(key));
  }

  async _tryConnectKey(key) {
    if (this._unsubRenderTemplates.get(key) !== undefined) {
      return;
    }
    if (!this._hass || !this._config) {
      return;
    }
    const value = this._config[key];
    if (!isTemplate(value)) {
      return;
    }
    try {
      const sub = subscribeRenderTemplate(
        this._hass.connection,
        (result) => {
          if (result && typeof result === "object" && "error" in result) {
            console.warn(
              `SWIPE-CARD: template error for '${key}':`,
              result.error
            );
            return;
          }
          this._templateResults = { ...this._templateResults, [key]: result };
          this._onTemplateResult(key);
        },
        {
          template: value,
          variables: {
            config: this._config,
            user: this._hass.user?.name,
          },
          strict: true,
        }
      );
      this._unsubRenderTemplates.set(key, sub);
      await sub;
    } catch (err) {
      console.warn(`SWIPE-CARD: template for '${key}' failed to render`, err);
      this._templateResults = {
        ...this._templateResults,
        [key]: { result: undefined },
      };
      this._unsubRenderTemplates.delete(key);
      this._onTemplateResult(key);
    }
  }

  _onTemplateResult(key) {
    if (key === "start_card") {
      if (this._resolveTemplateReady) {
        this._resolveTemplateReady();
        this._resolveTemplateReady = undefined;
      }
      if (this.swiper) {
        this.swiper.slideTo(this._getStartIndex());
      }
    }
  }

  _tryDisconnect() {
    TEMPLATE_KEYS.forEach((key) => this._tryDisconnectKey(key));
  }

  async _tryDisconnectKey(key) {
    const unsubPromise = this._unsubRenderTemplates.get(key);
    if (!unsubPromise) {
      return;
    }
    this._unsubRenderTemplates.delete(key);
    try {
      const unsub = await unsubPromise;
      await unsub();
    } catch (err) {
      if (err?.code === "not_found" || err?.code === "template_error") {
        // Subscription is already gone; nothing to do.
      } else {
        console.warn(`SWIPE-CARD: failed to unsubscribe '${key}' template`, err);
      }
    }
  }

  async _createCards() {
    const buildId = ++this._buildId;
    this._cardPromises = Promise.all(
      this._config.cards.map((config) => this._createCardElement(config))
    );

    const cards = await this._cardPromises;
    if (buildId !== this._buildId) {
      return;
    }
    // hass/preview may have been assigned while the cards were being
    // built (and the forwarding setters saw an empty list) — re-apply.
    cards.forEach((element) => {
      if (this._hass) {
        element.hass = this._hass;
      }
      if (element.localName === "hui-card") {
        element.preview = this.preview ?? false;
      }
    });
    this._cards = cards;
    if (this._ro) {
      this._cards.forEach((card) => {
        this._ro.observe(card);
      });
    }
    this._scheduleSwiperUpdate();
  }

  async _createCardElement(cardConfig) {
    let element;
    if (customElements.get("hui-card")) {
      // The modern path: hui-card handles per-card visibility conditions,
      // error cards, ll-rebuild/ll-upgrade and preview propagation.
      element = document.createElement("hui-card");
      element.hass = this._hass;
      element.preview = this.preview ?? false;
      element.config = cardConfig;
      if (typeof element.load === "function") {
        element.load();
      }
    } else {
      // Legacy fallback for frontends without hui-card.
      const helpers = await window.loadCardHelpers?.();
      element = helpers.createCardElement(cardConfig);
      if (this._hass) {
        element.hass = this._hass;
      }
      element.addEventListener(
        "ll-rebuild",
        (ev) => {
          ev.stopPropagation();
          this._rebuildCard(element, cardConfig);
        },
        { once: true }
      );
    }
    element.classList.add("swiper-slide");
    if ("card_width" in this._config) {
      element.style.width = this._config.card_width;
    }
    element.addEventListener("card-visibility-changed", () =>
      this._scheduleSwiperUpdate()
    );
    return element;
  }

  async _rebuildCard(cardElToReplace, config) {
    let newCardEl;
    try {
      newCardEl = await this._createCardElement(config);
    } catch (_err) {
      return;
    }
    if (cardElToReplace.parentElement) {
      cardElToReplace.parentElement.replaceChild(newCardEl, cardElToReplace);
    }
    this._cards = this._cards.map((curCardEl) =>
      curCardEl === cardElToReplace ? newCardEl : curCardEl
    );
    this._ro?.unobserve(cardElToReplace);
    this._ro?.observe(newCardEl);
    this._scheduleSwiperUpdate();
  }

  getGridOptions() {
    return {
      columns: 12,
      rows: "auto",
      min_columns: 3,
      min_rows: 1,
    };
  }

  async getCardSize() {
    await this._cardPromises;

    if (!this._cards || this._cards.length === 0) {
      return 1;
    }

    const results = await Promise.all(this._cards.map(computeCardSize));
    return Math.max(...results);
  }
}

customElements.define("swipe-card", SwipeCard);
