# Prism Shortcuts

Fast keyboard shortcuts, Peek, and Lens navigation for Chrome.

## Features

- Copy the current page URL.
- Copy the current page as a Markdown link.
- Copy a clean URL with common tracking parameters removed.
- Close unpinned tabs in the current window with undo.
- Close duplicate tabs while keeping the active duplicate.
- Pin or unpin the current tab.
- Open a lightweight Lens search/URL launcher.
- Shift-click links to open them in a Peek popup window.

## Install Locally

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click **Load unpacked**.
4. Select this folder.

## Package For Chrome Web Store

Create a ZIP that contains the extension files at the archive root:

```sh
zip -r prism-shortcuts-2.0.zip manifest.json background.js popup.html popup.js peek.js lens.html lens.js offscreen.html offscreen.js icons
```

Upload the ZIP in the Chrome Web Store Developer Dashboard.

## Privacy

Prism Shortcuts does not collect, sell, or transmit personal data. See [PRIVACY.md](PRIVACY.md).

