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
    | { type: "LAZYBOARD_LEAVE" };

export type JoinError =
    | "name_taken"
    | "name_not_allowed"
    | "invalid_name"
    | "already_joined"
    | "rate_limited"
    | "network";

export type LazyboardReply =
    { ok: true } | { ok: false; error: JoinError | "failed" };

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
        status:
            status === "suspicious" || status === "blocked" ? status : "active",
        privacyNoticeVersion: String(raw.privacyNoticeVersion ?? ""),
        agreedAt: String(raw.agreedAt ?? ""),
        shareCountry: raw.shareCountry === true,
    };
}
