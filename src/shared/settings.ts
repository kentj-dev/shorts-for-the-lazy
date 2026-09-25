import { parseShortcut, type Shortcut } from "@/shared/shortcut";

/**
 * Everything the popup reads and writes. Most of it lives in
 * chrome.storage.sync; LOCAL_SETTING_KEYS live in chrome.storage.local.
 */
export interface Settings {
    enabled: boolean;
    badgeEnabled: boolean;
    /** Seconds to wait after a Short ends, 0 to MAX_DELAY_SECONDS. */
    delaySeconds: number;
    /**
     * The Lazy Name used on the Lazyboard; empty when not joined. It stays
     * locked while joined, and leaving (or being removed for inactivity)
     * frees it up again.
     */
    lazyName: string;
    /** Null when the in-page shortcut is turned off. */
    shortcut: Shortcut | null;
}

export const MAX_DELAY_SECONDS = 5;
export const DELAY_STEP = 0.1;

export const LAZY_NAME_PATTERN = /^[A-Za-z0-9 _-]{3,20}$/;
export const LAZY_NAME_MAX = 20;

export function clampDelay(value: unknown): number {
    const seconds = Math.min(
        MAX_DELAY_SECONDS,
        Math.max(0, Number(value) || 0),
    );
    return Math.round(seconds * 10) / 10;
}

/** Collapses runs of spaces so "Lazy   Bones " and "Lazy Bones" match. */
export function normalizeLazyName(value: unknown): string {
    return String(value ?? "")
        .trim()
        .replace(/\s+/g, " ");
}

/** Reads raw storage, tolerating anything missing or malformed. */
export function parseSettings(raw: Record<string, unknown>): Settings {
    return {
        enabled: raw.enabled !== false,
        badgeEnabled: raw.badgeEnabled !== false,
        delaySeconds: clampDelay(raw.delaySeconds),
        lazyName: normalizeLazyName(raw.lazyName),
        shortcut: parseShortcut(raw.shortcut),
    };
}

export const SYNC_SETTING_KEYS = [
    "enabled",
    "badgeEnabled",
    "delaySeconds",
    "shortcut",
] as const satisfies readonly (keyof Settings)[];

/** Kept out of sync on purpose: sync data comes back after a reinstall. */
export const LOCAL_SETTING_KEYS = [
    "lazyName",
] as const satisfies readonly (keyof Settings)[];

const LOCAL_KEY_SET: ReadonlySet<string> = new Set(LOCAL_SETTING_KEYS);

export function isLocalSettingKey(key: string): boolean {
    return LOCAL_KEY_SET.has(key);
}
