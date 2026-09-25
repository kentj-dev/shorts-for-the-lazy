"use strict";

const DAILY_STATS_PREFIX = "dailyStats:";
const INSTALL_PAGE_URL =
    "https://apps.hamiken.com/apps/shorts-for-the-lazy/thank-you";
let statsUpdateQueue = Promise.resolve();
/** The month pruneOldStats last cleaned up to, so it runs once per month. */
let prunedMonthPrefix = "";

chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === "install") {
        void chrome.tabs.create({ url: INSTALL_PAGE_URL });
    }
    queueStatsUpdate(pruneOldStats).catch(() => {});
});

chrome.runtime.onStartup.addListener(() => {
    queueStatsUpdate(pruneOldStats).catch(() => {});
});

function getLocalDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${DAILY_STATS_PREFIX}${year}-${month}-${day}`;
}

/** "dailyStats:YYYY-MM" for the month `key` belongs to. */
function monthPrefixOf(key) {
    return key.slice(0, DAILY_STATS_PREFIX.length + "YYYY-MM".length);
}

/** Only the current month is kept; earlier daily counters are dropped. */
async function pruneOldStats() {
    const monthPrefix = monthPrefixOf(getLocalDateKey());
    if (monthPrefix === prunedMonthPrefix) return;
    const stored = await chrome.storage.local.get(null);
    const stale = Object.keys(stored).filter(
        (key) =>
            key.startsWith(DAILY_STATS_PREFIX) && !key.startsWith(monthPrefix),
    );
    if (stale.length > 0) await chrome.storage.local.remove(stale);
    prunedMonthPrefix = monthPrefix;
}

/** Stats writes run one at a time so read-modify-write never interleaves. */
function queueStatsUpdate(task) {
    const update = statsUpdateQueue.then(task);
    statsUpdateQueue = update.catch(() => {});
    return update;
}

async function addDailyStats(delta) {
    await pruneOldStats();
    const key = getLocalDateKey();
    const stored = await chrome.storage.local.get(key);
    const current = stored[key] || {};
    const next = {
        shortsWatched: Math.max(0, Number(current.shortsWatched) || 0),
        watchSeconds: Math.max(0, Number(current.watchSeconds) || 0),
        autoScrolled: Math.max(0, Number(current.autoScrolled) || 0),
    };

    for (const field of Object.keys(next)) {
        const amount = Number(delta?.[field]);
        if (Number.isFinite(amount) && amount > 0) next[field] += amount;
    }
    await chrome.storage.local.set({ [key]: next });
}

async function setBadgeForTab(tabId, text) {
    const updates = [
        chrome.action.setBadgeBackgroundColor({ tabId, color: "#18191B" }),
        chrome.action.setBadgeText({ tabId, text }),
    ];
    if (typeof chrome.action.setBadgeTextColor === "function") {
        updates.push(
            chrome.action.setBadgeTextColor({ tabId, color: "#ffffff" }),
        );
    }
    await Promise.allSettled(updates);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "TOGGLE_AUTO_SCROLL" && sender.tab?.id) {
        void toggleAutoScroll();
        return;
    }

    if (message?.type === "ADD_DAILY_STATS" && sender.tab?.id) {
        queueStatsUpdate(() => addDailyStats(message.delta)).then(
            () => sendResponse({ ok: true }),
            () => sendResponse({ ok: false }),
        );
        return true;
    }

    if (message?.type !== "SET_BADGE" || !sender.tab?.id) return;

    const tabId = sender.tab.id;
    const text =
        typeof message.text === "string" ? message.text.slice(0, 4) : "";
    void setBadgeForTab(tabId, text);
});

/**
 * Two shortcuts can toggle auto-scroll: Chrome's browser-wide command and the
 * in-page one the content script listens for. If the user gives both the same
 * keys, one press can arrive through both, and two toggles would cancel out.
 * A press is one toggle, so anything within this window of the last is dropped.
 */
const TOGGLE_DEBOUNCE_MS = 500;
let lastToggleAt = 0;

async function toggleAutoScroll() {
    const now = Date.now();
    if (now - lastToggleAt < TOGGLE_DEBOUNCE_MS) return;
    lastToggleAt = now;
    try {
        const { enabled = true } = await chrome.storage.sync.get({
            enabled: true,
        });
        await chrome.storage.sync.set({ enabled: !enabled });
    } catch {
        // The extension may be reloading while the command is handled.
    }
}

chrome.commands.onCommand.addListener((command) => {
    if (command === "toggle-auto-scroll") void toggleAutoScroll();
});
