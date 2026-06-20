const DEFAULT_SETTINGS = { stripTracking: false, peekEnabled: true };

const TRACKING_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "utm_cid",
  "fbclid",
  "gclid",
  "gclsrc",
  "dclid",
  "gbraid",
  "wbraid",
  "msclkid",
  "twclid",
  "li_fat_id",
  "mc_cid",
  "mc_eid",
  "_ga",
  "_gl",
  "_hsenc",
  "_hsmi",
  "_openstat",
  "yclid",
  "ymclid",
  "igshid",
  "s_cid",
  "s_kwcid",
  "sxsrf",
  "ei",
  "ved",
  "gs_lcp",
  "sclient",
];

const ICONS = {
  check:
    '<path d="M13.5 4.5L6.5 11.5L2.5 7.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  close:
    '<path d="M12 4L4 12M4 4l8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  pin:
    '<path d="M9.828 2.172a2 2 0 0 1 2.828 0l1.172 1.172a2 2 0 0 1 0 2.828L11 9l-1 4-3-3-4.5 4.5M6 10L2.5 13.5M7 3l6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  merge:
    '<path d="M8 2v12M4 8h8M3 4l5 4-5 4M13 4l-5 4 5 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
};

let closedTabsForUndo = [];
let undoTimeout = null;

function cleanUrl(url) {
  try {
    const clean = new URL(url);
    TRACKING_PARAMS.forEach((param) => clean.searchParams.delete(param));
    return clean.toString();
  } catch {
    return url;
  }
}

async function getSettings() {
  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...stored };
}

function isRestricted(url) {
  return (
    url?.startsWith("chrome://") ||
    url?.startsWith("chrome-extension://") ||
    url?.startsWith("about:")
  );
}

function isAllowedPeekUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function clearUndo() {
  closedTabsForUndo = [];
  if (undoTimeout) {
    clearTimeout(undoTimeout);
    undoTimeout = null;
  }
}

function saveTabsForUndo(tabs) {
  clearUndo();
  closedTabsForUndo = tabs
    .filter((tab) => tab.url)
    .map((tab) => ({ url: tab.url, pinned: Boolean(tab.pinned) }));
  undoTimeout = setTimeout(clearUndo, 6000);
}

function findDuplicateTabsToClose(tabs, activeTabId) {
  const tabsByUrl = new Map();

  for (const tab of tabs) {
    if (!tab.url) continue;
    const group = tabsByUrl.get(tab.url) || [];
    group.push(tab);
    tabsByUrl.set(tab.url, group);
  }

  const duplicates = [];
  for (const group of tabsByUrl.values()) {
    if (group.length < 2) continue;

    const keeper = group.find((tab) => tab.id === activeTabId) || group[0];
    duplicates.push(...group.filter((tab) => tab.id !== keeper.id));
  }

  return duplicates;
}

async function copyViaOffscreen(text) {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
  });

  if (contexts.length === 0) {
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: ["CLIPBOARD"],
      justification: "Copy to clipboard",
    });
  }

  await chrome.runtime.sendMessage({ type: "copy", text });
}

async function copyToClipboard(tab, text) {
  if (isRestricted(tab.url)) {
    await copyViaOffscreen(text);
    return;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (value) => {
        const textarea = document.createElement("textarea");
        textarea.value = value;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
      },
      args: [text],
    });
  } catch {
    await copyViaOffscreen(text);
  }
}

async function showToast(tabId, { icon, label, color, action }) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (iconSvg, text, accentColor, actionLabel) => {
        const existing = document.getElementById("__prism-toast");
        if (existing) existing.remove();

        const safeAccentColor = /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(accentColor)
          ? accentColor
          : "#888";

        const overlay = document.createElement("div");
        overlay.id = "__prism-toast";

        const content = document.createElement("div");
        content.className = "__at-content";
        if (actionLabel) content.classList.add("--has-action");

        const left = document.createElement("div");
        left.className = "__at-left";

        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("width", "16");
        svg.setAttribute("height", "16");
        svg.setAttribute("viewBox", "0 0 16 16");
        svg.setAttribute("fill", "none");
        svg.innerHTML = iconSvg;

        const labelEl = document.createElement("span");
        labelEl.textContent = text;

        left.append(svg, labelEl);
        content.appendChild(left);

        if (actionLabel) {
          const actionBtn = document.createElement("button");
          actionBtn.className = "__at-action";
          actionBtn.textContent = actionLabel;
          actionBtn.addEventListener("click", () => {
            chrome.runtime.sendMessage({ type: "undo-close" });
            overlay.remove();
          });
          content.appendChild(actionBtn);
        }

        const style = document.createElement("style");
        style.textContent = `
          #__prism-toast {
            position: fixed;
            top: max(22px, env(safe-area-inset-top));
            left: 0;
            right: 0;
            z-index: 2147483647;
            display: flex;
            justify-content: center;
            pointer-events: none;
            padding: 0 max(12px, env(safe-area-inset-right)) 0 max(12px, env(safe-area-inset-left));
          }
          #__prism-toast,
          #__prism-toast * {
            box-sizing: border-box;
          }
          #__prism-toast .__at-content {
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            width: max-content;
            max-width: min(calc(100vw - 24px), 420px);
            min-height: 42px;
            padding: 11px 16px;
            background:
              linear-gradient(180deg, rgba(255,255,255,0.20), rgba(255,255,255,0.08)),
              rgba(24, 24, 28, 0.72);
            border: 1px solid rgba(255,255,255,0.24);
            border-radius: 999px;
            box-shadow:
              0 18px 48px rgba(0,0,0,0.28),
              inset 0 1px 0 rgba(255,255,255,0.26),
              inset 0 -1px 0 rgba(255,255,255,0.08);
            -webkit-backdrop-filter: blur(24px) saturate(1.5);
            backdrop-filter: blur(24px) saturate(1.5);
            opacity: 0;
            transform: translateY(-6px) scale(0.992);
            transform-origin: center top;
            animation: __at-in 0.24s cubic-bezier(0.4, 0, 0.2, 1) forwards;
            pointer-events: none;
            overflow: hidden;
            will-change: opacity, transform;
          }
          #__prism-toast .__at-content.--has-action {
            pointer-events: auto;
          }
          #__prism-toast .__at-left {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            min-width: 0;
          }
          #__prism-toast .__at-left svg {
            width: 16px;
            height: 16px;
            flex: 0 0 16px;
            color: ${safeAccentColor};
          }
          #__prism-toast .__at-content span {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
            font-size: 13px;
            font-weight: 600;
            color: rgba(255,255,255,0.94);
            letter-spacing: 0;
            line-height: 1.2;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          #__prism-toast .__at-action {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
            font-size: 12px;
            font-weight: 600;
            color: rgba(255,255,255,0.94);
            background: ${safeAccentColor}30;
            border: 1px solid ${safeAccentColor}66;
            border-radius: 999px;
            padding: 5px 12px;
            cursor: pointer;
            pointer-events: auto;
            transition: background 0.15s, border-color 0.15s, transform 0.15s;
          }
          #__prism-toast .__at-action:hover {
            background: ${safeAccentColor}44;
            border-color: ${safeAccentColor}88;
            transform: translateY(-1px);
          }
          @keyframes __at-in {
            from { opacity: 0; transform: translateY(-6px) scale(0.992); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
          @keyframes __at-out {
            from { opacity: 1; transform: translateY(0) scale(1); }
            to { opacity: 0; transform: translateY(-6px) scale(0.992); }
          }
          @media (prefers-reduced-motion: reduce) {
            #__prism-toast .__at-content {
              animation-duration: 0.01ms;
              animation-delay: 0ms;
            }
          }
        `;

        overlay.append(content, style);
        document.body.appendChild(overlay);

        const timeout = actionLabel ? 5000 : 1600;
        setTimeout(() => {
          content.style.animation = "__at-out 0.2s cubic-bezier(0.4, 0, 0.2, 1) forwards";
          setTimeout(() => overlay.remove(), 200);
        }, timeout);
      },
      args: [icon, label, color, action || null],
    });
  } catch {
    // Toasts are feedback only; unsupported pages should not break commands.
  }
}

async function showToastForTab(tab, options) {
  if (tab?.id && !isRestricted(tab.url)) {
    await showToast(tab.id, options);
  }
}

async function copyCurrentTabUrl(tab, settings, { clean = false, markdown = false } = {}) {
  if (!tab.url) return;

  const url = clean || settings.stripTracking ? cleanUrl(tab.url) : tab.url;
  if (!markdown) {
    await copyToClipboard(tab, url);
    await showToastForTab(tab, {
      icon: ICONS.check,
      label: clean ? "Clean URL copied" : "URL copied",
      color: "#34c759",
    });
    return;
  }

  const safeTitle = (tab.title || url).replace(/[[\]]/g, "\\$&");
  await copyToClipboard(tab, `[${safeTitle}](${url})`);
  await showToastForTab(tab, {
    icon: ICONS.check,
    label: "Markdown copied",
    color: "#34c759",
  });
}

async function handleCloseUnpinned(tab) {
  const allTabs = await chrome.tabs.query({ currentWindow: true });
  const unpinned = allTabs.filter((candidate) => !candidate.pinned && candidate.id !== tab.id);
  if (unpinned.length === 0) return;

  saveTabsForUndo(unpinned);
  await chrome.tabs.remove(unpinned.map((candidate) => candidate.id));

  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await showToastForTab(activeTab, {
    icon: ICONS.close,
    label: `Closed ${unpinned.length} tab${unpinned.length === 1 ? "" : "s"}`,
    color: "#fc5c5c",
    action: "Undo",
  });
}

async function handleCloseDuplicates(tab) {
  const allTabs = await chrome.tabs.query({ currentWindow: true });
  const duplicates = findDuplicateTabsToClose(allTabs, tab.id);

  if (duplicates.length === 0) {
    await showToastForTab(tab, {
      icon: ICONS.check,
      label: "No duplicates found",
      color: "#888",
    });
    return;
  }

  await chrome.tabs.remove(duplicates.map((duplicate) => duplicate.id));

  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await showToastForTab(activeTab, {
    icon: ICONS.merge,
    label: `Closed ${duplicates.length} duplicate${duplicates.length === 1 ? "" : "s"}`,
    color: "#f5a623",
  });
}

async function handlePinTab(tab) {
  const pinned = !tab.pinned;
  await chrome.tabs.update(tab.id, { pinned });
  await showToastForTab(tab, {
    icon: ICONS.pin,
    label: pinned ? "Tab pinned" : "Tab unpinned",
    color: pinned ? "#5badff" : "#888",
  });
}

async function handleOpenLens(tab) {
  const win = await chrome.windows.get(tab.windowId);
  const width = 460;
  const height = 180;
  const left = Math.round((win.left ?? 0) + ((win.width ?? width) - width) / 2);
  const top = Math.round((win.top ?? 0) + 80);

  await chrome.windows.create({
    url: "lens.html",
    type: "popup",
    width,
    height,
    left,
    top,
  });
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!msg || typeof msg !== "object") return;

  if (msg.type === "peek") {
    if (!sender.tab || !isAllowedPeekUrl(msg.url)) return;

    chrome.windows.get(sender.tab.windowId, (win) => {
      if (chrome.runtime.lastError || !win) return;

      const width = 480;
      const height = 720;
      const left = Math.round(win.left + win.width - width - 40);
      const top = Math.round(win.top + (win.height - height) / 2);
      chrome.windows.create({ url: msg.url, type: "popup", width, height, left, top });
    });
    return;
  }

  if (msg.type === "undo-close") {
    if (closedTabsForUndo.length === 0) return;

    const tabs = closedTabsForUndo;
    clearUndo();
    tabs.forEach((tab) => chrome.tabs.create({ url: tab.url, pinned: tab.pinned }));
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  switch (command) {
    case "copy-url":
      await copyCurrentTabUrl(tab, await getSettings());
      break;
    case "copy-markdown":
      await copyCurrentTabUrl(tab, await getSettings(), { markdown: true });
      break;
    case "copy-clean":
      await copyCurrentTabUrl(tab, await getSettings(), { clean: true });
      break;
    case "close-unpinned":
      await handleCloseUnpinned(tab);
      break;
    case "close-duplicates":
      await handleCloseDuplicates(tab);
      break;
    case "pin-tab":
      await handlePinTab(tab);
      break;
    case "open-lens":
      await handleOpenLens(tab);
      break;
  }
});
