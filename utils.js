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

export const keyMatches = (event, keyConfig) => {
  const { key, modifiers } = keyConfig;
  if (event.key !== key) return false;
  if (modifiers.includes("Ctrl") && !event.ctrlKey) return false;
  if (modifiers.includes("Alt") && !event.altKey) return false;
  if (modifiers.includes("Shift") && !event.shiftKey) return false;
  if (modifiers.includes("Meta") && !event.metaKey) return false;
  if (
    !modifiers.includes("Ctrl") &&
    event.ctrlKey
  ) {
    return false;
  }
  if (
    !modifiers.includes("Alt") &&
    event.altKey
  ) {
    return false;
  }
  if (
    !modifiers.includes("Shift") &&
    event.shiftKey
  ) {
    return false;
  }
  if (
    !modifiers.includes("Meta") &&
    event.metaKey
  ) {
    return false;
  }
  return true;
};
