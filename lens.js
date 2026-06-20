const input = document.getElementById("input");

function isUrl(text) {
  const trimmed = text.trim();
  if (/^https?:\/\//i.test(trimmed)) return true;
  if (/^localhost(?::\d+)?(?:\/|$)/i.test(trimmed)) return true;
  return /^[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:[:/]|$)/i.test(trimmed);
}

function normalizeUrl(text) {
  const trimmed = text.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return "https://" + trimmed;
}

function searchUrl(query) {
  const params = new URLSearchParams({ q: query });
  return "https://www.google.com/search?" + params.toString();
}

async function getNormalWindowId() {
  const windows = await chrome.windows.getAll({ windowTypes: ["normal"] });
  return windows.find((win) => win.focused)?.id || windows.at(-1)?.id;
}

async function openInNormalWindow(url) {
  const windowId = await getNormalWindowId();
  await chrome.tabs.create(windowId ? { url, windowId } : { url });
}

input.addEventListener("keydown", async (e) => {
  if (e.key === "Escape") {
    window.close();
    return;
  }

  if (e.key === "Enter") {
    const value = input.value.trim();
    if (!value) return;

    let url;
    if (isUrl(value)) {
      url = normalizeUrl(value);
    } else {
      url = searchUrl(value);
    }

    await openInNormalWindow(url);
    window.close();
  }
});
