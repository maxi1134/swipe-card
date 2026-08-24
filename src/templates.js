const isTemplateRegex = /{%|{{/;

export const isTemplate = (value) =>
  typeof value === "string" && isTemplateRegex.test(value);

// Subscribes to HA's render_template websocket API. The callback receives
// { result, listeners } events; the returned promise resolves to an
// unsubscribe function and rejects if the template fails to compile
// (e.g. syntax error, or strict mode with unknown entities).
export const subscribeRenderTemplate = (conn, onChange, params) =>
  conn.subscribeMessage((msg) => onChange(msg), {
    type: "render_template",
    ...params,
  });
