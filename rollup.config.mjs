import resolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";

// Turns imported .css files into JS string default exports so they can be
// injected into the card's shadow DOM via unsafeCSS().
const cssAsString = {
  name: "css-as-string",
  transform(code, id) {
    if (id.endsWith(".css")) {
      return {
        code: `export default ${JSON.stringify(code)};`,
        map: { mappings: "" },
      };
    }
    return null;
  },
};

export default {
  input: "src/index.js",
  output: {
    file: "dist/swipe-card.js",
    format: "es",
  },
  plugins: [resolve(), cssAsString, terser()],
};
