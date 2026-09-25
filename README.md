# Shorts for the Lazy

A lightweight Manifest V3 extension that advances to the next YouTube Short when the active video reaches its end. Its toolbar badge shows the active Short's remaining whole seconds. It works in Chrome, Edge, Brave, and other Chromium-based browsers.

## Install

1. Run `npm install`, then `npm run build`. This writes the extension to `dist/`.
2. Open `chrome://extensions` (or your browser's equivalent extension page).
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the `dist/` directory.
6. If YouTube was already open when you installed the extension, refresh that tab once.

While developing, `npm run dev` rebuilds on every change; reload the extension in `chrome://extensions` to pick it up. `npm run typecheck` checks the popup's TypeScript.

## Use

Open `https://www.youtube.com/shorts/`, then click the extension's toolbar icon. The popup lets you turn auto-scroll and its countdown badge on or off, and set a delay from 0 to 5 seconds (0 seconds by default). Settings are synchronized with `chrome.storage.sync` and apply to open YouTube tabs immediately.

Press `Alt+Shift+S` (`Command+Shift+S` on macOS) on a YouTube tab to toggle auto-scroll without opening the popup. To change it, open the popup's gear button, then **Keyboard Shortcut → Change** and press the new combination. It must include Ctrl, Alt or Command so it never fires while typing, and it is ignored while a text field has focus.

Chrome does not let an extension change its own command shortcuts, so that in-page shortcut is handled by the content script. The extension also registers the same toggle as a Chrome command, which works in any tab; it can only be changed at `chrome://extensions/shortcuts`. If both are set to the same keys, one press still toggles once.

The popup's Settings page also holds the **Lazyboard**, the System / Light / Dark appearance choice, and a link to the maker.

## Lazyboard

The [Global Lazyboard](https://lazyboard.hamiken.com) is an opt-in public leaderboard; its server and page live in `../lazyboard`. Nothing is sent until you pick a **Lazy Name** in Settings, press **Join**, and agree to the privacy notice in the sheet that slides up. Names are checked against a word filter in the popup, and again by the server. After joining, the service worker (`src/background/lazyboard.ts`) sends only the activity since the previous sync, roughly once an hour at a minute the server assigned. Failed syncs are retried later under the same event ID, so they are never counted twice. The server computes every total and score itself. **Leave the Lazyboard** deletes your name and stats from the server, and so does 45 days without any activity; the popup warns from day 30 and explains afterwards.

A Short counts as watched once half of its length has actually played (never under 1 second), so swiping past one doesn't count. The same rule feeds the popup's stats and the Lazyboard. The monthly stats page links to the Global Lazyboard.

Build with `LAZYBOARD_URL=http://localhost:8080 npm run build` to point the extension at a local server.

On a Shorts page, an auto-scroll control is inserted between YouTube's Up and Down navigation buttons. The down icon means auto-scroll is active, pause means it is disabled, and refresh appears only when the tab must reconnect after the extension is reloaded. Click the control to pause, resume, or refresh as indicated.

The status reads **Active** when the extension is enabled, the active tab is a Shorts page, and an active video has been detected.

## How detection works

The content script scores all video elements using their visible area, distance from the viewport center, playback state, dimensions, and YouTube's active-renderer marker. It watches the best candidate with media events and a lightweight 400 ms fallback check. During only the final second, frame-level monitoring ensures YouTube's loop cannot skip over the 160 ms detection window. A `MutationObserver`, scroll events, and YouTube's SPA navigation event detect replaced videos and page transitions.

When a playing video is within 160 ms of its duration, the extension schedules exactly one advance for that Short. The scheduled action is cancelled if the user moves to another Short or disables the extension. It first clicks YouTube's native Next control and verifies that the active Short changed. If the control is unavailable or did not work, it targets the next Short renderer directly, then falls back to YouTube's scroll container or one window viewport.

## Files

```text
src/manifest.json              Extension metadata, permissions, popup, and content-script registration
src/content/content.js         Active-video detection, end detection, SPA monitoring, navigation, in-page shortcut
src/background/background.js   Toolbar countdown badge, daily stats, and the auto-scroll toggle
src/background/lazyboard.ts    Opt-in Lazyboard registration, hourly delta sync, leaving
src/images/                    Files loaded by URL: toolbar icon and the on-page control's icons
src/popup/                     The popup and the monthly stats tab (stats.html): React + Tailwind + shadcn/ui + Recharts
src/shared/                    Settings, shortcut, stats, Lazyboard, name filter, and privacy notice
src/styles/popup.css           Theme tokens (light and dark) and base styles
scripts/build.mjs              Vite build for the popup, content script, and service worker
```
