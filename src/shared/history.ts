/**
 * Recently watched Shorts, kept only in chrome.storage.local and never sent
 * anywhere. background.js adds to the list once a Short counts as watched;
 * the History page reads it.
 */

export const HISTORY_KEY = "recentShorts";
export const HISTORY_LIMIT = 200;

export interface RecentShort {
    /** YouTube's video ID, the part after /shorts/. */
    id: string;
    /** Empty when the page didn't show one in time. */
    title: string;
    channel: string;
    /** The Short's own length in seconds, at 1x. */
    lengthSeconds: number;
    /** When it was last watched, in milliseconds since the epoch. */
    watchedAt: number;
}

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{6,20}$/;

export function isVideoId(value: unknown): value is string {
    return typeof value === "string" && VIDEO_ID_PATTERN.test(value);
}

function text(value: unknown, max: number): string {
    return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function parseRecentShort(value: unknown): RecentShort | null {
    if (typeof value !== "object" || value === null) return null;
    const raw = value as Record<string, unknown>;
    if (!isVideoId(raw.id)) return null;
    const watchedAt = Number(raw.watchedAt);
    if (!Number.isFinite(watchedAt) || watchedAt <= 0) return null;
    return {
        id: raw.id,
        title: text(raw.title, 200),
        channel: text(raw.channel, 100),
        lengthSeconds: Math.max(0, Math.round(Number(raw.lengthSeconds) || 0)),
        watchedAt,
    };
}

export function parseHistory(value: unknown): RecentShort[] {
    if (!Array.isArray(value)) return [];
    return value
        .map(parseRecentShort)
        .filter((entry): entry is RecentShort => entry !== null);
}

/** Puts `entry` first, dropping an older visit to the same Short. */
export function addToHistory(
    history: readonly RecentShort[],
    entry: RecentShort,
): RecentShort[] {
    return [entry, ...history.filter(({ id }) => id !== entry.id)].slice(
        0,
        HISTORY_LIMIT,
    );
}

export function shortUrl(id: string): string {
    return `https://www.youtube.com/shorts/${id}`;
}

/**
 * YouTube's 480x360 still. A vertical Short sits pillarboxed in the middle,
 * so cropping it to 9:16 with object-cover shows just the video.
 */
export function thumbnailUrl(id: string): string {
    return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}
