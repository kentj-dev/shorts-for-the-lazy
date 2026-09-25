/**
 * The Lazyboard: an opt-in global leaderboard. Nothing is sent until the
 * person picks a Lazy Name and agrees to the privacy notice; after that the
 * background worker sends activity deltas about once an hour.
 *
 * The server keeps the real totals and scores. Everything here is only the
 * client's bookkeeping, and the server never trusts it.
 */

/** Set at build time by scripts/build.mjs (LAZYBOARD_URL). */
declare const __LAZYBOARD_URL__: string;

export const LAZYBOARD_URL: string = __LAZYBOARD_URL__;
export const LAZYBOARD_API = `${LAZYBOARD_URL}/api/v1`;

/** chrome.storage.local key. Local on purpose: the token is per install. */
export const LAZYBOARD_KEY = "lazyboard";

/**
 * The server deletes installations that haven't synced for this many days
 * (INACTIVE_AFTER_DAYS on the server; the privacy notice says the same).
 */
export const INACTIVE_DAYS = 45;
/** Past this many quiet days, the popup warns before the spot is removed. */
export const INACTIVE_WARNING_DAYS = 30;

/**
 * chrome.storage.local key: set when the server no longer knew this install
 * (almost always the inactivity clean-up), so the popup can say so.
 */
export const REMOVED_KEY = "lazyboardRemoved";

export interface RemovedNotice {
    /** The Lazy Name it had, offered again when rejoining. */
    publicName: string;
    at: string;
}

export function parseRemovedNotice(value: unknown): RemovedNotice | null {
    if (typeof value !== "object" || value === null) return null;
    const raw = value as Record<string, unknown>;
    if (typeof raw.at !== "string") return null;
    return { publicName: String(raw.publicName ?? ""), at: raw.at };
}

export interface Counts {
    shortsWatched: number;
    /** May be fractional while pending; whole seconds are sent. */
    watchSeconds: number;
    autoScrolls: number;
}

export const EMPTY_COUNTS: Counts = {
    shortsWatched: 0,
    watchSeconds: 0,
    autoScrolls: 0,
};

/** A delta that was sent (or is being sent) and not yet acknowledged. */
export interface InflightSync extends Counts {
    eventId: string;
    sequence: number;
}

export type LazyboardStatus = "active" | "suspicious" | "blocked";

export interface LazyboardState {
    installationId: string;
    token: string;
    publicName: string;
    /** Minute of the hour this install syncs at, picked by the server. */
    syncMinute: number;
    /** The sequence number the next new sync will use. */
    sequence: number;
    /** Activity since the last sync was frozen for sending. */
    pending: Counts;
    /** Retried as-is (same event_id) until the server answers. */
    inflight: InflightSync | null;
    lastSyncAt: string | null;
    /**
     * When the server last heard from this install (sync or settings change).
     * The inactivity clean-up counts from here.
     */
    lastActiveAt: string;
    /**
     * Set when a sync couldn't reach the Lazyboard (offline, server down,
     * Cloudflare error page); cleared by the next sync that gets through.
     * Activity keeps collecting meanwhile, so nothing is lost.
     */
    unreachableSince: string | null;
    status: LazyboardStatus;
    privacyNoticeVersion: string;
    agreedAt: string;
    /** Whether the Lazyboard shows this install's country. */
    shareCountry: boolean;
}

/** Messages the popup sends to the background worker. */
export type LazyboardMessage =
    | {
          type: "LAZYBOARD_JOIN";
          name: string;
          privacyNoticeVersion: string;
          shareCountry: boolean;
      }
    | { type: "LAZYBOARD_SET_COUNTRY"; shareCountry: boolean }
    | { type: "LAZYBOARD_SET_AVATAR"; emoji: string; color: string }
    | { type: "LAZYBOARD_LEAVE" };

export type JoinError =
    | "name_taken"
    | "name_not_allowed"
    | "invalid_name"
    | "already_joined"
    | "rate_limited"
    /** Offline, timed out, or something other than the API answered. */
    | "network";

/** What the popup says whenever the Lazyboard can't be reached. */
export const UNREACHABLE_MESSAGE =
    "The Lazyboard can't be reached right now. Try again in a bit.";

export type LazyboardReply =
    | { ok: true }
    /** "removed": the server no longer knows this install. */
    | { ok: false; error: JoinError | "failed" | "removed" };

function count(value: unknown): number {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : 0;
}

function parseCounts(value: unknown): Counts {
    const raw = (value ?? {}) as Record<string, unknown>;
    return {
        shortsWatched: Math.floor(count(raw.shortsWatched)),
        watchSeconds: count(raw.watchSeconds),
        autoScrolls: Math.floor(count(raw.autoScrolls)),
    };
}

/** Reads stored state, or null when not joined (or unreadable). */
export function parseLazyboardState(value: unknown): LazyboardState | null {
    if (typeof value !== "object" || value === null) return null;
    const raw = value as Record<string, unknown>;
    if (
        typeof raw.token !== "string" ||
        typeof raw.installationId !== "string"
    ) {
        return null;
    }
    const inflight = raw.inflight as Record<string, unknown> | null | undefined;
    const status = raw.status;
    return {
        installationId: raw.installationId,
        token: raw.token,
        publicName: String(raw.publicName ?? ""),
        syncMinute: Math.min(59, Math.floor(count(raw.syncMinute))),
        sequence: Math.max(1, Math.floor(count(raw.sequence))),
        pending: parseCounts(raw.pending),
        inflight:
            inflight && typeof inflight.eventId === "string"
                ? {
                      ...parseCounts(inflight),
                      watchSeconds: Math.floor(count(inflight.watchSeconds)),
                      eventId: inflight.eventId,
                      sequence: Math.max(
                          1,
                          Math.floor(count(inflight.sequence)),
                      ),
                  }
                : null,
        lastSyncAt: typeof raw.lastSyncAt === "string" ? raw.lastSyncAt : null,
        // Older state has no lastActiveAt; the last sync or joining will do.
        lastActiveAt:
            typeof raw.lastActiveAt === "string"
                ? raw.lastActiveAt
                : typeof raw.lastSyncAt === "string"
                  ? raw.lastSyncAt
                  : String(raw.agreedAt ?? new Date().toISOString()),
        unreachableSince:
            typeof raw.unreachableSince === "string"
                ? raw.unreachableSince
                : null,
        status:
            status === "suspicious" || status === "blocked" ? status : "active",
        privacyNoticeVersion: String(raw.privacyNoticeVersion ?? ""),
        agreedAt: String(raw.agreedAt ?? ""),
        shareCountry: raw.shareCountry === true,
    };
}
