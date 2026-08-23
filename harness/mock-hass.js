/**
 * Mock Home Assistant environment for testing swipe-card outside HA.
 * Provides: window.loadCardHelpers, a hass object factory, and a mock
 * render_template websocket subscription with controllable results.
 */

/* ------------------------- mock card element ------------------------- */

class MockCard extends HTMLElement {
  setConfig(config) {
    this._config = config;
    this.attachShadow({ mode: "open" });
    const height = config.test_height || 80;
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        .card {
          background: var(--ha-card-background, #1c1c1e);
          color: #fff;
          border-radius: 12px;
          height: ${height}px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: sans-serif;
          border: 1px solid #444;
          box-sizing: border-box;
        }
      </style>
      <div class="card">${config.title || config.type || "mock card"}</div>`;
  }

  set hass(hass) {
    this._hass = hass;
    this.dispatchEvent(new CustomEvent("mock-hass-set", { bubbles: false }));
  }

  getCardSize() {
    return Math.ceil((this._config?.test_height || 80) / 50);
  }
}

class MockErrorCard extends HTMLElement {
  setConfig(config) {
    this._config = config;
    this.innerHTML = `<div style="background:#b00;color:#fff;padding:8px;">error: ${
      config.error || "?"
    }</div>`;
  }
  set hass(_) {}
  getCardSize() {
    return 1;
  }
}

customElements.define("mock-card", MockCard);
customElements.define("mock-error-card", MockErrorCard);

/* ------------------------- card helpers ------------------------- */

window.loadCardHelpers = async () => ({
  createCardElement(config) {
    if (!config || !config.type) {
      const el = document.createElement("mock-error-card");
      el.setConfig({ error: "no type" });
      return el;
    }
    const el = document.createElement("mock-card");
    el.setConfig(config);
    return el;
  },
});

/* ------------------------- render_template mock ------------------------- */

// Template registry: template string -> current result.
// Tests mutate window.__templateResults and call window.__pushTemplateUpdates()
// to simulate state-driven re-renders.
window.__templateResults = {};
window.__templateSubscriptions = [];
window.__templateSubscribeCalls = 0;
window.__templateUnsubscribeCalls = 0;

window.__pushTemplateUpdates = () => {
  for (const sub of window.__templateSubscriptions) {
    if (sub.active && sub.msg.template in window.__templateResults) {
      sub.callback({
        result: window.__templateResults[sub.msg.template],
        listeners: { all: false, domains: [], entities: [], time: false },
      });
    }
  }
};

/* ------------------------- hass object ------------------------- */

export function createMockHass(overrides = {}) {
  return {
    language: "en",
    selectedLanguage: null,
    locale: { language: "en", number_format: "auto", time_format: "auto" },
    translationMetadata: {
      translations: {
        en: { nativeName: "English", isRTL: false },
        he: { nativeName: "עברית", isRTL: true },
      },
    },
    themes: { darkMode: true },
    states: {},
    config: { state: "RUNNING", version: "2026.8.2" },
    connection: {
      subscribeMessage(callback, msg) {
        window.__templateSubscribeCalls++;
        const sub = { callback, msg, active: true };
        window.__templateSubscriptions.push(sub);
        // Deliver initial result async, like the real websocket does.
        Promise.resolve().then(() => {
          if (!sub.active) return;
          if (msg.template in window.__templateResults) {
            callback({
              result: window.__templateResults[msg.template],
              listeners: { all: false, domains: [], entities: [], time: false },
            });
          } else if (msg.report_errors) {
            callback({
              error: `mock: no result registered for template: ${msg.template}`,
              level: "ERROR",
            });
          }
        });
        return Promise.resolve(() => {
          window.__templateUnsubscribeCalls++;
          sub.active = false;
        });
      },
    },
    callWS(msg) {
      return Promise.reject(new Error(`mock callWS not implemented: ${msg.type}`));
    },
    ...overrides,
  };
}
