export const ADDON_ID = "zen-browser-tab-switcher";

export const cssOverridesId = "zen-browser-tab-switcher-css-overrides";

export const defaultConfigKeys = {
  closeTabSwitcher: { key: "Escape", modifiers: [] },
  nextTab: { key: "ArrowDown", modifiers: [] },
  previousTab: { key: "ArrowUp", modifiers: [] },
  closeTab: { key: "x", modifiers: ["Ctrl"] },
};

export const defaultConfig = {
  keys: defaultConfigKeys,
  cssOverrides: "",
  matchPrecedence: ["title", "url"],
};

export const Logger = {
  log: (...args) => {
    console.log(`[${ADDON_ID}]`, ...args);
  },
  error: (...args) => {
    console.error(`[${ADDON_ID}]`, ...args);
  },
  info: (...args) => {
    console.info(`[${ADDON_ID}]`, ...args);
  },
  debug: (...args) => {
    if (
      typeof browser !== "undefined" &&
      browser.runtime &&
      browser.runtime.getManifest
    ) {
      const manifest = browser.runtime.getManifest();
      if (manifest && manifest.version && manifest.version.includes("dev")) {
        console.debug(`[${ADDON_ID}]`, ...args);
      }
    }
  },
};

export const keyMatches = (event, keyConfig) => {
  const { key, modifiers } = keyConfig;
  if (event.key !== key) return false;
  if (modifiers.includes("Ctrl") && !event.ctrlKey) return false;
  if (modifiers.includes("Alt") && !event.altKey) return false;
  if (modifiers.includes("Shift") && !event.shiftKey) return false;
  if (modifiers.includes("Meta") && !event.metaKey) return false;
  if (!modifiers.includes("Ctrl") && event.ctrlKey) {
    return false;
  }
  if (!modifiers.includes("Alt") && event.altKey) {
    return false;
  }
  if (!modifiers.includes("Shift") && event.shiftKey) {
    return false;
  }
  if (!modifiers.includes("Meta") && event.metaKey) {
    return false;
  }
  return true;
};
