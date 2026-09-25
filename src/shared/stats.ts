/** Today's counters, written by background.js under a per-day local key. */
export interface DailyStats {
    shortsWatched: number;
    watchSeconds: number;
    autoScrolled: number;
}

export const EMPTY_STATS: DailyStats = {
    shortsWatched: 0,
    watchSeconds: 0,
    autoScrolled: 0,
};

/**
 * Same key format as background.js: dailyStats:YYYY-MM-DD in local time.
 * background.js keeps only the current month's keys.
 */
export function todayStatsKey(date = new Date()): string {
    const day = String(date.getDate()).padStart(2, "0");
    return `${monthStatsPrefix(date)}-${day}`;
}

/** dailyStats:YYYY-MM, the prefix every key in that month shares. */
export function monthStatsPrefix(date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `dailyStats:${year}-${month}`;
}

/** Every day of the month `date` falls in, at local midnight. */
export function daysInMonth(date = new Date()): Date[] {
    const year = date.getFullYear();
    const month = date.getMonth();
    const count = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: count }, (_, i) => new Date(year, month, i + 1));
}

function count(value: unknown): number {
    return Math.floor(Math.max(0, Number(value) || 0));
}

export function parseStats(value: unknown): DailyStats {
    if (typeof value !== "object" || value === null) return EMPTY_STATS;
    const raw = value as Record<string, unknown>;
    return {
        shortsWatched: count(raw.shortsWatched),
        watchSeconds: count(raw.watchSeconds),
        autoScrolled: count(raw.autoScrolled),
    };
}

/** "45s", "12m", "1h 5m". */
export function formatDuration(totalSeconds: number): string {
    if (totalSeconds < 60) return `${totalSeconds}s`;
    const minutes = Math.floor(totalSeconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return minutes % 60 ? `${hours}h ${minutes % 60}m` : `${hours}h`;
}
