import "./swipe-card.js";
import "./editor.js";

export const VERSION = "6.1.0";

window.customCards = window.customCards || [];
window.customCards.push({
  type: "swipe-card",
  name: "Swipe Card",
  description: "A card that lets you swipe through multiple Lovelace cards.",
  documentationURL: "https://github.com/maxi1134/swipe-card",
});

console.info(
  `%c   SWIPE-CARD  \n%c Version ${VERSION} `,
  "color: orange; font-weight: bold; background: black",
  "color: white; font-weight: bold; background: dimgray"
);
