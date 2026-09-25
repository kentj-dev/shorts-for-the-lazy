# Privacy Policy for Shorts for the Lazy

Shorts for the Lazy does not sell or share personal information, and it never collects browsing history, video history, or analytics.

The extension reads the YouTube page only to identify the active Short, monitor its playback position, and add the user-facing auto-scroll control. This processing happens locally in the browser.

The extension stores the user's auto-scroll, countdown-badge, shortcut, and delay preferences using Chrome's synchronized extension storage. Daily counters (Shorts watched, watch time, and auto-scrolls) are kept in Chrome's local extension storage for the current month only; earlier months are deleted automatically. The popup's light or dark appearance choice is kept in the popup's local storage.

## Lazyboard (optional)

The Lazyboard is an opt-in public leaderboard. Nothing is sent until the user picks a Lazy Name and agrees to the Lazyboard privacy notice shown in the extension. Only after that agreement does the extension send the following to the Lazyboard server, about once an hour:

- the chosen Lazy Name and avatar (an emoji and a background colour from fixed lists);
- the number of Shorts watched, watch time, and auto-scrolls counted since joining;
- a random installation ID and secret token that identify the installation.

Video IDs, titles, links, browsing history, Google account details, and email addresses are never sent. The Lazy Name, avatar, counts, and points are shown publicly on the Lazyboard.

Showing a country is optional and off by default. Only if the user turns on "Show my country" does the server take the country from Cloudflare's country header and show it next to their name; turning it off later erases it. The Lazyboard does not store IP addresses. Like any website, the server sees the connecting IP address and uses it only to validate and verify requests and to block abuse. It is never saved to the database or written to logs; for rate limiting, only a keyed hash of it is held in memory for at most an hour and then discarded. Cloudflare, which carries traffic to the server, handles it only to deliver requests. The server keeps a record of which notice version the user agreed to, when, and whether they chose to show their country.

Users can leave at any time in Settings → Lazyboard → Leave the Lazyboard. This deletes their name and statistics from the server; only the record of the agreement and the time it was withdrawn is kept.

If an installation does not sync with the Lazyboard for 45 days in a row (for example, because the user stopped watching Shorts or removed the extension), the server deletes its name and statistics automatically, in the same way as leaving. Only the record of the agreement and the time it was removed is kept. The extension tells the user when this has happened, and they can join again at any time.

The extension contains no advertising, tracking, analytics, or remote code.
