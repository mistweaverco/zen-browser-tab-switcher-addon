/*
 * Zen Browser Tab Switcher
 */

/* Enhanced fuzzy matching algorithm:
 * - Case-insensitive matching
 * - Characters must appear in order but don't need to be consecutive
 * - More intuitive than exact matching
 * - Similar to Sublime Text's search behavior
 */
function fuzzyMatch(str, query) {
  str = str.toLowerCase();
  query = query.toLowerCase();
  let i = 0;
  for (const char of query) {
    i = str.indexOf(char, i);
    if (i === -1) return false;
    i++;
  }
  return true;
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
    if (e.key === "Escape") {
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

      /* Dynamic list rendering
       * - Efficiently updates DOM only when necessary
       * - Handles both keyboard and mouse interaction
       * - Provides visual feedback for selected items
       * - Implements smooth scrolling for better UX
       */
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
        let filtered = [];
        if (query) {
          filtered = allTabs.filter(
            (tab) =>
              fuzzyMatch(tab.title || "", query) ||
              fuzzyMatch(tab.url || "", query),
          );
          renderTabs(filtered);
        } else {
          renderTabs(allTabs);
        }
      });

      input.addEventListener("keydown", (e) => {
        const items = list.querySelectorAll("li");
        const numItems = items.length;

        if (e.key === "Enter" && numItems >= 1) {
          const selectedItem = items[selectedIndex >= 0 ? selectedIndex : 0];
          const tabId = parseInt(selectedItem.dataset.tabId, 10);
          switchToTab(tabId);
          e.preventDefault();
          return;
        }

        if (
          e.key === "x" && e.ctrlKey && ((selectedIndex >= 0 &&
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

        if (e.key === "ArrowDown" || (e.key === "j" && e.ctrlKey)) {
          selectedIndex = selectedIndex < numItems - 1 ? selectedIndex + 1 : 0;
          updateSelection();
          e.preventDefault();
        } else if (e.key === "ArrowUp" || (e.key === "k" && e.ctrlKey)) {
          selectedIndex = selectedIndex <= 0 ? numItems - 1 : selectedIndex - 1;
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
    }
  }
}

/* Listen for messages from background */
browser.runtime.onMessage.addListener((message) => {
  if (message.type === "showOmnibar") {
    showOmnibar();
  }
});
