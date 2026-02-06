(async () => {
  const utils = await import(browser.runtime.getURL("utils.js"));
  const keyMatches = utils.keyMatches;
  let configCache = utils.defaultConfig;

  const cssOverrides = (action) => {
    if (
      !configCache.cssOverrides || configCache.cssOverrides.trim().length === 0
    ) return;
    let style = document.getElementById(utils.cssOverridesId);
    if (action === "apply") {
      if (style) {
        style.textContent = configCache.cssOverrides;
        return;
      }
      style = document.createElement("style");
      style.type = "text/css";
      style.id = "zen-browser-tab-switcher-css-overrides";
      style.textContent = configCache.cssOverrides;
      document.body.appendChild(style);
    } else if (action === "remove" && style) {
      style.remove();
    }
  };

  function fuzzyMatchString(str, query) {
    query = query.toLowerCase();
    str = str.toLowerCase();
    let i = 0;
    for (const char of query) {
      i = str.indexOf(char, i);
      if (i === -1) return false;
      i++;
    }
    return true;
  }

  const countConsecutiveMatches = (str, query) => {
    str = str.toLowerCase();
    query = query.toLowerCase();
    let maxCount = 0;
    let currentCount = 0;
    let qIndex = 0;
    for (let i = 0; i < str.length; i++) {
      if (str[i] === query[qIndex]) {
        currentCount++;
        qIndex++;
        if (qIndex === query.length) {
          maxCount = Math.max(maxCount, currentCount);
          currentCount = 0;
          qIndex = 0;
        }
      } else {
        maxCount = Math.max(maxCount, currentCount);
        currentCount = 0;
        qIndex = 0;
      }
    }
    maxCount = Math.max(maxCount, currentCount);
    return maxCount;
  };

  const getSafeLower = (str) => (str ? str.toLowerCase() : "");

  /* Fuzzy matching
 * Returns an ordered array of matched tabs
 * - Case-insensitive
 * - Characters must appear in order
 * - Non-consecutive matches allowed
 * - Higher precedence for matches earlier in the string
 * - Highest precedence for consecutive character matches
 * @param {Array} tabs - Array of tab objects with title and url
 * @param {string} query - The search query
 * @returns {Array} - Filtered array of tabs that match the query
 */
  function fuzzyMatch(tabs, query) {
    console.log(configCache);
    query = query.toLowerCase();
    tabs = tabs.filter((tab) => {
      const title = getSafeLower(tab.title);
      const url = getSafeLower(tab.url);
      return fuzzyMatchString(title, query) || fuzzyMatchString(url, query);
    });
    // Sort by position of first match in highest precedence field (title or url)
    // Also consider secondary precedence field for tie-breaking
    return tabs.sort((a, b) => {
      const aTitle = getSafeLower(a[configCache.matchPrecedence[0]]);
      const bTitle = getSafeLower(b[configCache.matchPrecedence[0]]);
      const aIndex = aTitle.indexOf(query);
      const bIndex = bTitle.indexOf(query);
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    }).sort((a, b) => {
      // Secondary sort
      // If both tabs have the same position for the primary match, use the secondary field to break ties
      const aTitle = getSafeLower(a[configCache.matchPrecedence[0]]);
      const bTitle = getSafeLower(b[configCache.matchPrecedence[0]]);
      if (aTitle === bTitle) {
        const aUrl = getSafeLower(a[configCache.matchPrecedence[1]]);
        const bUrl = getSafeLower(b[configCache.matchPrecedence[1]]);
        const aIndex = aUrl.indexOf(query);
        const bIndex = bUrl.indexOf(query);
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      }
      return 0;
    }).sort((a, b) => {
      // Consecutive character match prioritization
      // Tabs with more consecutive characters matching the query
      // are ranked higher than those with fewer consecutive matches
      // This enhances relevance for queries with repeated characters
      // e.g., "aaa" matches "baaaad" better than "abacad"
      // Tabs with longer consecutive matches appear first
      // improving user experience
      const aTitle = getSafeLower(a[configCache.matchPrecedence[0]]);
      const bTitle = getSafeLower(b[configCache.matchPrecedence[0]]);
      const aUrl = getSafeLower(a[configCache.matchPrecedence[1]]);
      const bUrl = getSafeLower(b[configCache.matchPrecedence[1]]);
      const aConsecTitle = countConsecutiveMatches(aTitle, query);
      const bConsecTitle = countConsecutiveMatches(bTitle, query);
      if (aConsecTitle !== bConsecTitle) {
        return bConsecTitle - aConsecTitle;
      }
      const aConsecUrl = countConsecutiveMatches(aUrl, query);
      const bConsecUrl = countConsecutiveMatches(bUrl, query);
      return bConsecUrl - aConsecUrl;
    }).sort((a, b) => {
      // Perfect match prioritization
      const aMatchPrecedence1 = getSafeLower(a[configCache.matchPrecedence[0]]);
      const bMatchPrecedence2 = getSafeLower(b[configCache.matchPrecedence[0]]);
      const aPerfectMatch = aMatchPrecedence1 === query ? 1 : 0;
      const bPerfectMatch = bMatchPrecedence2 === query ? 1 : 0;
      if (aPerfectMatch === bPerfectMatch) {
        const aStartsWith = aMatchPrecedence1.startsWith(query) ? 1 : 0;
        const bStartsWith = bMatchPrecedence2.startsWith(query) ? 1 : 0;
        if (aStartsWith !== bStartsWith) {
          return bStartsWith - aStartsWith;
        }
      }
      return bPerfectMatch - aPerfectMatch;
    });
  }

  /* Main UI component initialization
 * Creates an overlay with search input and results list
 * Handles all user interactions and keyboard navigation
 * Manages tab switching and UI state
 */
  function showOmnibar() {
    /* Check if overlay already exists */
    if (document.getElementById("zen-browser-tab-switcher")) {
      return;
    }

    cssOverrides("apply");

    let selectedIndex = 0;

    let mouseMoved = false;
    const mouseMoveListener = () => {
      mouseMoved = true;
      document.removeEventListener("mousemove", mouseMoveListener);
    };
    document.addEventListener("mousemove", mouseMoveListener);

    /* Create overlay */
    const overlay = document.createElement("div");
    overlay.id = "zen-browser-tab-switcher";
    overlay.className = "zen-overlay";

    /* Create omnibar container */
    const omnibar = document.createElement("div");
    omnibar.className = "zen-omnibar";

    /* Input field */
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Search tabs...";
    input.className = "zen-input";
    input.autofocus = true;

    /* Tabs list */
    const list = document.createElement("ul");
    list.className = "zen-list";

    omnibar.appendChild(input);
    omnibar.appendChild(list);
    overlay.appendChild(omnibar);
    document.body.appendChild(overlay);

    /* Explicitly focus the input */
    input.focus();

    /* Handle Escape key globally */
    const escListener = (e) => {
      if (keyMatches(e, configCache.keys.closeTabSwitcher)) {
        closeOmnibar();
        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.addEventListener("keydown", escListener);

    /* Handle tab visibility changes */
    const visibilityListener = () => {
      if (document.hidden) {
        closeOmnibar();
      }
    };

    document.addEventListener("visibilitychange", visibilityListener);

    /* Fetch tabs */
    browser.runtime
      .sendMessage({ type: "getTabs" })
      .then((tabs) => {
        const allTabs = tabs.filter(
          (tab) => Number.isInteger(tab.id) && tab.id >= 0,
        ); // Filter out invalid tabs

        function renderTabs(filteredTabs) {
          list.innerHTML = "";
          filteredTabs.forEach((tab, idx) => {
            const li = document.createElement("li");
            li.className = "zen-tab-item" + (idx === 0 ? " selected" : "");
            li.dataset.tabId = tab.id;

            li.addEventListener("mouseover", () => {
              if (mouseMoved) {
                list.querySelector("li.selected")?.classList.remove("selected");
                li.classList.add("selected");
                selectedIndex = idx;
              }
            });

            /* Favicon */
            if (tab.favIconUrl) {
              const img = document.createElement("img");
              img.src = tab.favIconUrl;
              img.className = "zen-favicon";
              li.appendChild(img);
            }

            /* Title and URL */
            const title = document.createElement("span");
            title.textContent = tab.title || "Untitled";
            title.className = "zen-title";

            const url = document.createElement("span");
            url.textContent = tab.url ? new URL(tab.url).hostname : "No URL";
            url.className = "zen-url";

            const closeBtn = document.createElement("span");
            closeBtn.className = "zen-close-btn";
            closeBtn.innerHTML = "&times;";

            li.appendChild(title);
            li.appendChild(url);
            li.appendChild(closeBtn);

            /* Click to switch */
            li.addEventListener("click", () => {
              const tabId = parseInt(li.dataset.tabId, 10);
              switchToTab(tabId);
            });

            closeBtn.addEventListener("click", (e) => {
              e.stopPropagation();
              const tabId = parseInt(li.dataset.tabId, 10);
              browser.runtime.sendMessage({ type: "closeTab", tabId });
              li.remove();
            });

            list.appendChild(li);
          });
        }

        /* Tab switching logic
       * - Validates tab ID before switching
       * - Handles errors gracefully
       * - Provides feedback on success/failure
       * - Maintains UI consistency
       */
        function switchToTab(tabId) {
          if (!Number.isInteger(tabId) || tabId < 0) {
            console.error("Invalid tabId:", tabId);
            return;
          }
          browser.runtime
            .sendMessage({ type: "switchTab", tabId })
            .then((response) => {
              if (response.error) {
                console.error("Error response from switchTab:", response.error);
                return;
              }
              closeOmnibar();
            })
            .catch((error) => {
              console.error("Error sending switchTab message:", error);
            });
        }

        renderTabs(allTabs);

        input.addEventListener("input", (e) => {
          const query = e.target.value;
          if (query) {
            renderTabs(fuzzyMatch(allTabs, query));
          } else {
            renderTabs(allTabs);
          }
        });

        // INFO:
        // This fixes an issue with at least KDE Plasma where key events
        // are inconsistently fired on keydown vs keyup
        // and ensures that the closeTabSwitcher action is triggered even after blur
        input.addEventListener("keyup", (e) => {
          if (keyMatches(e, configCache.keys.closeTabSwitcher)) {
            escListener(e);
            return;
          }
        });

        input.addEventListener("keydown", (e) => {
          const items = list.querySelectorAll("li");
          const numItems = items.length;

          if (keyMatches(e, configCache.keys.closeTabSwitcher)) {
            // handled by keyup to ensure it triggers before any potential input changes
            return;
          }

          if (e.key === "Enter" && numItems >= 1) {
            const selectedItem = items[selectedIndex >= 0 ? selectedIndex : 0];
            const tabId = parseInt(selectedItem.dataset.tabId, 10);
            switchToTab(tabId);
            e.preventDefault();
            return;
          }

          if (
            keyMatches(e, configCache.keys.closeTab) && ((selectedIndex >= 0 &&
              numItems > 0) || numItems === 1)
          ) {
            e.stopPropagation();
            selectedIndex = selectedIndex >= 0 ? selectedIndex : 0;
            const selectedItem = items[selectedIndex];
            const tabId = parseInt(selectedItem.dataset.tabId, 10);
            browser.runtime.sendMessage({ type: "closeTab", tabId });
            selectedItem.remove();
            return;
          }

          if (keyMatches(e, configCache.keys.nextTab)) {
            selectedIndex = selectedIndex < numItems - 1
              ? selectedIndex + 1
              : 0;
            updateSelection();
            e.preventDefault();
          } else if (keyMatches(e, configCache.keys.previousTab)) {
            selectedIndex = selectedIndex <= 0
              ? numItems - 1
              : selectedIndex - 1;
            updateSelection();
            e.preventDefault();
          }
        });

        function updateSelection() {
          const items = list.querySelectorAll("li");
          list.querySelector("li.selected")?.classList.remove("selected");
          if (selectedIndex >= 0 && selectedIndex < items.length) {
            items[selectedIndex].classList.add("selected");
            items[selectedIndex].scrollIntoView({ block: "nearest" });
          }
        }
      })
      .catch((error) => {
        console.error("Error fetching tabs:", error);
      });

    /* Close on click outside */
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        closeOmnibar();
      }
    });

    /* Function to close omnibar - update to remove visibility listener */
    function closeOmnibar() {
      const overlay = document.getElementById("zen-browser-tab-switcher");
      if (overlay) {
        overlay.remove();
        document.removeEventListener("mousemove", mouseMoveListener);
        document.removeEventListener("keydown", escListener);
        document.removeEventListener("visibilitychange", visibilityListener);
        cssOverrides("remove");
      }
    }
  }

  /* Listen for changes in sync storage */
  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "sync") {
      console.log("Sync storage changed:", changes);
      for (const key in changes) {
        const { newValue } = changes[key];
        configCache[key] = newValue;
      }
      console.log("Config updated in content script:", configCache);
    }
  });

  browser.runtime
    .sendMessage({ type: "getConfig" })
    .then((data) => {
      configCache = { ...configCache, ...data };
      for (const action in utils.defaultKeys) {
        if (!configCache.keys[action]) {
          configCache.keys[action] = utils.defaultKeys[action];
        }
      }
      console.log("Initial config loaded in content script:", configCache);
    })
    .catch((error) => {
      console.error("Error getting config:", error);
    });

  /* Listen for messages from background */
  browser.runtime.onMessage.addListener((message) => {
    if (message.type === "showOmnibar") {
      showOmnibar();
    }
  });
})();
