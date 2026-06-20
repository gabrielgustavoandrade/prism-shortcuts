const COMMAND_META = {
  "copy-url": {
    label: "Copy URL",
    shortLabel: "Copy",
    cat: "copy",
    catLabel: "copy",
    icon: '<path d="M6.5 9.5 5.4 10.6a2.9 2.9 0 0 1-4.1-4.1l1.5-1.5a2.9 2.9 0 0 1 4.1 0M9.5 6.5l1.1-1.1a2.9 2.9 0 0 1 4.1 4.1L13.2 11a2.9 2.9 0 0 1-4.1 0M5.8 10.2l4.4-4.4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  },
  "copy-markdown": {
    label: "Copy as Markdown",
    shortLabel: "Markdown",
    cat: "copy",
    catLabel: "copy",
    icon: '<path d="M2 4.5h12v7H2zM4 9V7l1.5 1.7L7 7v2M10 7v2.5M8.8 8.3 10 9.5l1.2-1.2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>',
  },
  "copy-clean": {
    label: "Copy clean URL",
    shortLabel: "Clean",
    cat: "copy",
    catLabel: "copy",
    icon: '<path d="M8 2.5 8.8 5l2.4.8-2.4.8L8 9l-.8-2.4-2.4-.8L7.2 5 8 2.5ZM4 9.5l.5 1.3 1.3.5-1.3.5L4 13l-.5-1.2-1.3-.5 1.3-.5L4 9.5ZM12 9l.6 1.6 1.6.6-1.6.6L12 13.5l-.6-1.7-1.6-.6 1.6-.6L12 9Z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>',
  },
  "close-unpinned": {
    label: "Close unpinned tabs",
    shortLabel: "Close",
    cat: "tabs",
    catLabel: "tabs",
    icon: '<path d="M4.5 4.5h7v7h-7zM6 6l4 4M10 6l-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  },
  "close-duplicates": {
    label: "Close duplicate tabs",
    shortLabel: "Dupes",
    cat: "tabs",
    catLabel: "tabs",
    icon: '<path d="M5.5 5.5h6v6h-6zM3.5 9.5v-7h7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  },
  "pin-tab": {
    label: "Pin / unpin tab",
    shortLabel: "Pin",
    cat: "tabs",
    catLabel: "tabs",
    icon: '<path d="M9.8 2.8 13.2 6.2M10.8 5.2 7.4 8.6M6.5 7.7l1.8 1.8-3.6 3.6M5.4 4.6l6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  },
  "open-lens": {
    label: "Open Lens window",
    shortLabel: "Lens",
    cat: "nav",
    catLabel: "nav",
    icon: '<circle cx="7" cy="7" r="3.6" stroke="currentColor" stroke-width="1.6"/><path d="M10 10 13.2 13.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  },
};

function formatShortcutPart(part) {
  const normalized = part.trim();
  const symbols = {
    Command: "⌘",
    Cmd: "⌘",
    Shift: "⇧",
    Alt: "⌥",
    Option: "⌥",
    MacCtrl: "⌃",
    Control: "⌃",
    Ctrl: "⌃",
    Comma: ",",
    Period: ".",
    Space: "Space",
  };
  return symbols[normalized] || normalized;
}

function createIcon(icon) {
  const glyphEl = document.createElement("span");
  glyphEl.className = "shortcut-glyph";
  glyphEl.setAttribute("aria-hidden", "true");
  glyphEl.innerHTML = `<svg width="18" height="18" viewBox="0 0 16 16" fill="none">${icon}</svg>`;
  return glyphEl;
}

function createShortcutLabel(meta) {
  const labelEl = document.createElement("span");
  labelEl.className = "shortcut-label";
  labelEl.append(meta.label, " ");

  const categoryEl = document.createElement("span");
  categoryEl.className = `cat cat--${meta.cat}`;
  categoryEl.textContent = meta.catLabel;
  labelEl.appendChild(categoryEl);

  return labelEl;
}

function createShortcutKeys(shortcut) {
  const keysEl = document.createElement("div");
  keysEl.className = "shortcut-keys";

  if (!shortcut) {
    const span = document.createElement("span");
    span.className = "not-set";
    span.textContent = "Not set";
    keysEl.appendChild(span);
    return keysEl;
  }

  shortcut.split("+").forEach((part) => {
    const kbd = document.createElement("kbd");
    kbd.textContent = formatShortcutPart(part);
    kbd.title = part.trim();
    keysEl.appendChild(kbd);
  });

  return keysEl;
}

async function renderShortcuts() {
  const container = document.getElementById("shortcuts");
  let commands = [];
  try {
    commands = await chrome.commands.getAll();
  } catch {
    commands = [];
  }
  const commandsByName = Object.fromEntries(commands.map((cmd) => [cmd.name, cmd]));

  for (const commandName of Object.keys(COMMAND_META)) {
    const meta = COMMAND_META[commandName];
    const cmd = commandsByName[commandName] || {
      name: commandName,
      shortcut: "",
    };

    const item = document.createElement("div");
    item.className = "shortcut-item";
    item.dataset.tone = meta.cat;

    const glyphEl = createIcon(meta.icon);

    const shortLabelEl = document.createElement("span");
    shortLabelEl.className = "shortcut-title";
    shortLabelEl.textContent = meta.shortLabel;

    const labelEl = createShortcutLabel(meta);
    const keysEl = createShortcutKeys(cmd.shortcut);

    item.title = cmd.shortcut ? `${meta.label} (${cmd.shortcut})` : `${meta.label} (not set)`;

    item.appendChild(glyphEl);
    item.appendChild(shortLabelEl);
    item.appendChild(labelEl);
    item.appendChild(keysEl);
    container.appendChild(item);
  }
}

async function renderSettings() {
  const defaults = { stripTracking: false, peekEnabled: true };
  const settings = await chrome.storage.sync.get(defaults);

  const stripEl = document.getElementById("stripTracking");
  const peekEl = document.getElementById("peekEnabled");

  stripEl.checked = settings.stripTracking;
  peekEl.checked = settings.peekEnabled;

  stripEl.addEventListener("change", () => {
    chrome.storage.sync.set({ stripTracking: stripEl.checked });
  });

  peekEl.addEventListener("change", () => {
    chrome.storage.sync.set({ peekEnabled: peekEl.checked });
  });
}

document.getElementById("remap").addEventListener("click", () => {
  chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
});

renderShortcuts();
renderSettings();
