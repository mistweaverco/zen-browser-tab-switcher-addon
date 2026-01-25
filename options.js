// Fetch and display the current shortcut
async function updateUI() {
  const commands = await browser.commands.getAll();
  const toggleCommand = commands.find((c) =>
    c.name === "show-zen-browner-tab-switcher-omnibar"
  );

  if (toggleCommand) {
    document.getElementById("current-shortcut").textContent =
      toggleCommand.shortcut || "None set";
  }
}

// Redirect user to the Firefox Shortcut Management page
document.getElementById("change-shortcut").addEventListener("click", () => {
  browser.tabs.create({
    url:
      "https://support.mozilla.org/en-US/kb/manage-extension-shortcuts-firefox",
  });
});

updateUI();
