/* Listen for the command */
browser.commands.onCommand.addListener((command) => {
  if (command === "show-zen-browner-tab-switcher-omnibar") {
    /* Get the active tab and send message to its content script */
    browser.tabs
      .query({ active: true, currentWindow: true })
      .then((tabs) => {
        if (tabs[0] && Number.isInteger(tabs[0].id) && tabs[0].id >= 0) {
          browser.tabs
            .sendMessage(tabs[0].id, { type: "showOmnibar" })
            .then(() => {
            })
            .catch((error) => {
              console.error("Error sending showOmnibar message:", error);
            });
        } else {
          console.error("No valid active tab found");
        }
      })
      .catch((error) => {
        console.error("Error querying tabs:", error);
      });
  }
});

/* Handle messages from content scripts */
browser.runtime.onMessage.addListener((message, _, sendResponse) => {
  if (message.type === "getTabs") {
    browser.tabs
      .query({})
      .then((tabs) => {
        sendResponse(
          tabs.map((tab) => ({
            id: tab.id,
            title: tab.title || "Untitled",
            url: tab.url || "",
            favIconUrl: tab.favIconUrl || "",
            windowId: tab.windowId,
          })),
        );
      })
      .catch((error) => {
        console.error("Error querying tabs:", error);
        sendResponse({ error: error.message });
      });
    return true; /* Keep the message channel open for async response */
  } else if (message.type === "switchTab") {
    const tabId = message.tabId;
    if (!Number.isInteger(tabId) || tabId < 0) {
      console.error("Invalid tabId:", tabId);
      sendResponse({ error: "Invalid tabId" });
      return true;
    }
    browser.tabs
      .get(tabId)
      .then((tab) => {
        if (!tab || !Number.isInteger(tab.windowId)) {
          console.error("Tab not found or invalid windowId for tabId:", tabId);
          sendResponse({ error: "Tab or window not found" });
          return;
        }
        browser.windows
          .update(tab.windowId, { focused: true })
          .then(() => {
            browser.tabs
              .update(tabId, { active: true })
              .then(() => {
                sendResponse({ success: true });
              })
              .catch((error) => {
                console.error("Error activating tab:", error);
                sendResponse({ error: error.message });
              });
          })
          .catch((error) => {
            console.error("Error focusing window:", error);
            sendResponse({ error: error.message });
          });
      })
      .catch((error) => {
        console.error("Error getting tab:", error);
        sendResponse({ error: error.message });
      });
    return true; /* Keep the message channel open for async response */
  } else if (message.type === "closeTab") {
    const tabId = message.tabId;
    if (!Number.isInteger(tabId) || tabId < 0) {
      console.error("Invalid tabId for closing:", tabId);
      sendResponse({ error: "Invalid tabId" });
      return true;
    }
    browser.tabs.remove(tabId)
      .then(() => {
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error("Error closing tab:", error);
        sendResponse({ error: error.message });
      });
    return true;
  } else if (message.type === "getConfig") {
    browser.storage.sync
      .get()
      .then((config) => {
        sendResponse(config);
      })
      .catch((error) => {
        console.error("Error getting config:", error);
      });
    return true;
  }
});
