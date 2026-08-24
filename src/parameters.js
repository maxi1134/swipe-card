const BLOCKED_KEYS = new Set(["__proto__", "constructor", "prototype"]);

// Deep-copies plain objects/arrays while dropping prototype-polluting keys.
// Card configs arrive as JSON, so "__proto__" can be an own property.
export function sanitizedClone(value) {
  if (Array.isArray(value)) {
    return value.map(sanitizedClone);
  }
  if (
    value &&
    typeof value === "object" &&
    (value.constructor === Object || value.constructor === undefined)
  ) {
    const out = {};
    for (const key of Object.keys(value)) {
      if (BLOCKED_KEYS.has(key)) {
        continue;
      }
      out[key] = sanitizedClone(value[key]);
    }
    return out;
  }
  return value;
}

const FREE_MODE_RENAMES = {
  freeModeMomentum: "momentum",
  freeModeSticky: "sticky",
  freeModeMomentumRatio: "momentumRatio",
  freeModeMomentumBounce: "momentumBounce",
  freeModeMomentumBounceRatio: "momentumBounceRatio",
  freeModeMomentumVelocityRatio: "momentumVelocityRatio",
  freeModeMinimumVelocity: "minimumVelocity",
};

const REMOVED_PARAMS = ["lazy", "preloadImages", "loopFillGroupWithBlank"];

const warnParam = (oldName, replacement) => {
  console.warn(
    `SWIPE-CARD: Swiper parameter '${oldName}' is from Swiper v6 and ${
      replacement
        ? `was translated to '${replacement}'`
        : "no longer exists; it was ignored"
    }. Please update your card config.`
  );
};

// Translates Swiper v6 parameter names (what existing dashboards use) to the
// current Swiper API so old YAML keeps working after the upgrade.
export function normalizeParameters(parameters) {
  const cloned = sanitizedClone(parameters);
  if (cloned !== undefined && cloned !== null) {
    if (typeof cloned !== "object" || Array.isArray(cloned)) {
      console.warn(
        "SWIPE-CARD: 'parameters' must be a mapping of Swiper options; ignoring",
        parameters
      );
      return {};
    }
  }
  const params = cloned || {};

  if ("slidesPerColumn" in params) {
    params.grid = { rows: params.slidesPerColumn, ...(params.grid || {}) };
    delete params.slidesPerColumn;
    warnParam("slidesPerColumn", "grid.rows");
  }
  if ("slidesPerColumnFill" in params) {
    params.grid = { fill: params.slidesPerColumnFill, ...(params.grid || {}) };
    delete params.slidesPerColumnFill;
    warnParam("slidesPerColumnFill", "grid.fill");
  }

  const freeModeSub = {};
  let hasFreeModeSub = false;
  for (const [oldKey, newKey] of Object.entries(FREE_MODE_RENAMES)) {
    if (oldKey in params) {
      freeModeSub[newKey] = params[oldKey];
      delete params[oldKey];
      hasFreeModeSub = true;
      warnParam(oldKey, `freeMode.${newKey}`);
    }
  }
  if (hasFreeModeSub) {
    const base =
      typeof params.freeMode === "object" && params.freeMode !== null
        ? params.freeMode
        : { enabled: Boolean(params.freeMode) };
    params.freeMode = { ...base, ...freeModeSub };
  }

  if ("watchSlidesVisibility" in params) {
    if (params.watchSlidesVisibility) {
      params.watchSlidesProgress = true;
    }
    delete params.watchSlidesVisibility;
    warnParam("watchSlidesVisibility", "watchSlidesProgress");
  }
  if ("loopedSlides" in params) {
    params.loopAdditionalSlides = params.loopedSlides;
    delete params.loopedSlides;
    warnParam("loopedSlides", "loopAdditionalSlides");
  }
  for (const removed of REMOVED_PARAMS) {
    if (removed in params) {
      delete params[removed];
      warnParam(removed, null);
    }
  }

  return params;
}
