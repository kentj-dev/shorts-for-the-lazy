/**
 * The full-tab pages (This month, History, Settings, Privacy, Terms), all
 * served by stats.html and told apart by the URL hash, so the build keeps a
 * single entry for them.
 */

export type PageId = "month" | "history" | "settings" | "privacy" | "terms";

export const PAGE_IDS: readonly PageId[] = [
    "month",
    "history",
    "settings",
    "privacy",
    "terms",
];

export function pageFromHash(hash: string): PageId {
    const id = hash.replace(/^#/, "");
    return PAGE_IDS.includes(id as PageId) ? (id as PageId) : "month";
}

export function openPage(page: PageId): void {
    void chrome.tabs.create({
        url: chrome.runtime.getURL(`popup/stats.html#${page}`),
    });
}
