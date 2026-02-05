import { defaultConfig, defaultConfigKeys } from "./utils.js";

const defaultKeys = defaultConfigKeys;
let configCache = defaultConfig;

let isRecordingKey = false;

const cssOverridesExceedsLimit = (css) => {
  // Total is 100 KB for all config,
  // but we want to be conservative and limit CSS to 50 KB
  const maxSizeInBytes = 50 * 1024;
  const encoder = new TextEncoder();
  const cssSize = encoder.encode(css).length;
  return cssSize > maxSizeInBytes;
};

const saveConfig = async (configObject) => {
  try {
    await browser.storage.sync.set(configObject);
  } catch (error) {
    console.error("Error saving config:", error);
  }
};

const loadConfig = async () => {
  try {
    const data = await browser.storage.sync.get();
    configCache = { ...configCache, ...data };
    for (const action in defaultKeys) {
      if (!configCache.keys[action]) {
        configCache.keys[action] = defaultKeys[action];
      }
    }
    console.log("Loaded config:", configCache);
  } catch (error) {
    console.error("Error loading config:", error);
  }
};

const updateUI = async () => {
  await loadConfig();
  const commands = await browser.commands.getAll();
  const toggleCommand = commands.find((c) =>
    c.name === "show-zen-browner-tab-switcher-omnibar"
  );

  if (toggleCommand) {
    document.querySelector("button[data-action='openTabSwitcher']")
      .textContent = toggleCommand.shortcut || "None";
  }

  for (const action in configCache.keys) {
    const keyObj = configCache.keys ? configCache.keys[action] : null;
    document.querySelector(`button[data-action='${action}']`).textContent =
      keyToString(keyObj ? keyObj : defaultKeys[action]);
  }

  const sortPrecedence = document.querySelector(
    "select[data-action='sortPrecedence']",
  );
  const precedenceOptions = sortPrecedence.querySelectorAll("option");
  precedenceOptions.forEach((option) => {
    option.selected = configCache.matchPrecedence[0] === option.value;
  });
  if (configCache.cssOverrides && configCache.cssOverrides.trim().length > 0) {
    document.querySelector("textarea[data-type='changeCSS']").value =
      configCache.cssOverrides;
  }
};

const keyToString = (keyObj) => {
  if (!keyObj || !keyObj.key) return "None";
  const modifiers = keyObj.modifiers ? keyObj.modifiers.join("+") : "";
  return modifiers.length > 0 ? `${modifiers}+${keyObj.key}` : keyObj.key;
};

const editKey = (evt) => {
  if (
    evt.target.dataset.type === "changeShortcut" &&
    evt.target.dataset.action === "openTabSwitcher"
  ) {
    browser.tabs.create({
      url:
        "https://support.mozilla.org/en-US/kb/manage-extension-shortcuts-firefox",
    });
    return;
  }
  if (evt.target.dataset.type === "changeShortcut") {
    isRecordingKey = true;
    evt.target.textContent =
      "Press new shortcut... (Backspace to clear to defaults)";
  }
};

const recordKey = async (evt) => {
  const action = evt.target.dataset.action;
  const keyObj = {
    key: evt.key,
    modifiers: [
      evt.altKey ? "Alt" : null,
      evt.ctrlKey ? "Ctrl" : null,
      evt.metaKey ? "Meta" : null,
      evt.shiftKey ? "Shift" : null,
    ].filter(Boolean),
  };
  if (keyObj.key !== "Backspace") {
    configCache.keys[action] = keyObj;
  } else {
    configCache.keys[action] = undefined;
  }
  await saveConfig(configCache);
  await updateUI();
  isRecordingKey = false;
};

const changePrecedence = async (evt) => {
  const newPrecedence = evt.target.value;
  const validOptions = ["title", "url"];
  const newValue = newPrecedence === validOptions[0]
    ? [validOptions[0], validOptions[1]]
    : [validOptions[1], validOptions[0]];
  configCache.matchPrecedence = newValue;
  await saveConfig(configCache);
};

const changeCSSOverrides = async (newCSS) => {
  if (cssOverridesExceedsLimit(newCSS)) {
    alert(
      "CSS overrides exceed the maximum allowed size of 50 KB. Changes not saved.",
    );
    console.error("CSS overrides exceed the maximum allowed size of 50 KB.");
    return;
  }
  configCache.cssOverrides = newCSS;
  await saveConfig(configCache);
};

let changeDebounceTimer = null;
export const debouncedChangeCSSOverrides = (newCSS) => {
  if (changeDebounceTimer) {
    clearTimeout(changeDebounceTimer);
    changeDebounceTimer = null;
  }
  changeDebounceTimer = setTimeout(async () => {
    await changeCSSOverrides(newCSS);
  }, 1500);
};

document.querySelector("textarea[data-type='changeCSS']").addEventListener(
  "change",
  (evt) => {
    debouncedChangeCSSOverrides(evt.target.value);
  },
);

document.body.addEventListener("keyup", async (evt) => {
  if (!isRecordingKey) {
    return;
  }
  evt.preventDefault();
  if (isRecordingKey) {
    await recordKey(evt);
  }
});

document.body.addEventListener("click", (evt) => {
  if (evt.target.dataset.type === "changeShortcut") {
    editKey(evt);
    return;
  }
  if (
    evt.target.parentNode?.dataset.type === "changeSetting" &&
    evt.target.parentNode.dataset.action === "sortPrecedence"
  ) {
    changePrecedence(evt);
    return;
  }
});

updateUI();
