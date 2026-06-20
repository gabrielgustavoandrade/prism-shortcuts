// Shift+Click on any link opens it in a lightweight Peek popup window
document.addEventListener(
  "click",
  async (e) => {
    if (!e.shiftKey) return;

    const link = e.target.closest("a[href]");
    if (!link) return;

    const url = link.href;
    if (!url || url.startsWith("javascript:") || url.startsWith("#")) return;

    // Check if peek is enabled
    const { peekEnabled } = await chrome.storage.sync.get({ peekEnabled: true });
    if (!peekEnabled) return;

    e.preventDefault();
    e.stopPropagation();

    chrome.runtime.sendMessage({ type: "peek", url });
  },
  true
);
