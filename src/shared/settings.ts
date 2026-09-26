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
    /** Pause the Short while its tab is hidden, and resume on return. */
    pauseWhenHidden: boolean;
    /** Applied to each Short as it starts; 1 leaves YouTube's own speed alone. */
    playbackSpeed: number;
    /** How many times a Short plays before auto-scroll moves on. */
    loopCount: number;
    /** Skip Shorts shorter than this many seconds at the chosen speed; 0 is off. */
    skipShorterThan: number;
    /** Skip Shorts longer than this many seconds at the chosen speed; 0 is off. */
    skipLongerThan: number;
    /** Stop auto-scroll after this many Shorts in a session; 0 is off. */
    sessionShorts: number;
    /** Stop auto-scroll after this many minutes of watching; 0 is off. */
    sessionMinutes: number;
    /** Keep a local list of recently watched Shorts. */
    historyEnabled: boolean;
}

export const MAX_DELAY_SECONDS = 5;
export const DELAY_STEP = 0.1;

/*
 * The steppers in the popup move between these values, in order. 0 means
 * off, which is also the default wherever it appears.
 */
export const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 1.75, 2] as const;
export const LOOP_OPTIONS = [1, 2, 3, 4, 5] as const;
export const SKIP_SHORTER_OPTIONS = [0, 5, 10, 15, 20, 30, 45] as const;
export const SKIP_LONGER_OPTIONS = [0, 15, 30, 45, 60, 90, 120] as const;
export const SESSION_SHORTS_OPTIONS = [
    0, 5, 10, 15, 20, 25, 30, 40, 50, 75, 100,
] as const;
export const SESSION_MINUTES_OPTIONS = [
    0, 5, 10, 15, 20, 30, 45, 60, 90, 120,
] as const;

/** `value` if it is one of `options`, otherwise `fallback`. */
function pickOption(
    value: unknown,
    options: readonly number[],
    fallback = 0,
): number {
    const number = Number(value);
    return options.includes(number) ? number : fallback;
}

/**
 * Both skip rules together skip everything when the lower bound isn't below
 * the upper one, so that pair is treated as no rule at all.
 */
export function skipRange(settings: {
    skipShorterThan: number;
    skipLongerThan: number;
}): { min: number; max: number } | null {
    const { skipShorterThan: min, skipLongerThan: max } = settings;
    if (!min && !max) return null;
    if (min && max && min >= max) return null;
    return { min, max };
}

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
        pauseWhenHidden: raw.pauseWhenHidden !== false,
        playbackSpeed: pickOption(raw.playbackSpeed, SPEED_OPTIONS, 1),
        loopCount: pickOption(raw.loopCount, LOOP_OPTIONS, 1),
        skipShorterThan: pickOption(raw.skipShorterThan, SKIP_SHORTER_OPTIONS),
        skipLongerThan: pickOption(raw.skipLongerThan, SKIP_LONGER_OPTIONS),
        sessionShorts: pickOption(raw.sessionShorts, SESSION_SHORTS_OPTIONS),
        sessionMinutes: pickOption(raw.sessionMinutes, SESSION_MINUTES_OPTIONS),
        historyEnabled: raw.historyEnabled !== false,
    };
}

export const SYNC_SETTING_KEYS = [
    "enabled",
    "badgeEnabled",
    "delaySeconds",
    "shortcut",
    "pauseWhenHidden",
    "playbackSpeed",
    "loopCount",
    "skipShorterThan",
    "skipLongerThan",
    "sessionShorts",
    "sessionMinutes",
    "historyEnabled",
] as const satisfies readonly (keyof Settings)[];

/** Kept out of sync on purpose: sync data comes back after a reinstall. */
export const LOCAL_SETTING_KEYS = [
    "lazyName",
] as const satisfies readonly (keyof Settings)[];

const LOCAL_KEY_SET: ReadonlySet<string> = new Set(LOCAL_SETTING_KEYS);

export function isLocalSettingKey(key: string): boolean {
    return LOCAL_KEY_SET.has(key);
}
