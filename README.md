# Shorts for the Lazy

A lightweight Manifest V3 extension that advances to the next YouTube Short when the active video reaches its end. Its toolbar badge shows the active Short's remaining whole seconds. It works in Chrome, Edge, Brave, and other Chromium-based browsers.

## Install

1. Open `chrome://extensions` (or your browser's equivalent extension page).
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this project directory.
5. If YouTube was already open when you installed the extension, refresh that tab once.

No build or dependency installation is required.

## Use

Open `https://www.youtube.com/shorts/`, then click the extension's toolbar icon. The popup lets you turn auto-scroll and its countdown badge on or off, and set a delay from 0 to 5 seconds (0 seconds by default). Settings are synchronized with `chrome.storage.sync` and apply to open YouTube tabs immediately.

Press `Alt+Shift+S` (`Command+Shift+S` on macOS) to toggle auto-scroll without opening the popup. Use the popup's gear button or `chrome://extensions/shortcuts` to customize the shortcut.

On a Shorts page, an auto-scroll control is inserted between YouTube's Up and Down navigation buttons. The down icon means auto-scroll is active, pause means it is disabled, and refresh appears only when the tab must reconnect after the extension is reloaded. Click the control to pause, resume, or refresh as indicated.

The status reads **Active** when the extension is enabled, the active tab is a Shorts page, and an active video has been detected.

## How detection works

The content script scores all video elements using their visible area, distance from the viewport center, playback state, dimensions, and YouTube's active-renderer marker. It watches the best candidate with media events and a lightweight 400 ms fallback check. During only the final second, frame-level monitoring ensures YouTube's loop cannot skip over the 160 ms detection window. A `MutationObserver`, scroll events, and YouTube's SPA navigation event detect replaced videos and page transitions.

When a playing video is within 160 ms of its duration, the extension schedules exactly one advance for that Short. The scheduled action is cancelled if the user moves to another Short or disables the extension. It first clicks YouTube's native Next control and verifies that the active Short changed. If the control is unavailable or did not work, it targets the next Short renderer directly, then falls back to YouTube's scroll container or one window viewport.

## Files

```text
manifest.json  Extension metadata, permissions, popup, and content-script registration
content.js     Active-video detection, end detection, SPA monitoring, and navigation
background.js  Per-tab toolbar countdown badge
popup.html     Popup structure
popup.css      Popup styling
popup.js       Settings persistence and live status
README.md      Installation and implementation notes
```

Icons are intentionally omitted; Chromium supplies a generic extension icon and the unpacked extension remains valid.
