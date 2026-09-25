/**
 * Lazyboard sync, run by the service worker.
 *
 * Nothing here talks to the network until the person has joined (picked a
 * Lazy Name and agreed to the privacy notice). After that:
 *
 *   activity   -> added to `pending` (inside the stats queue)
 *   hourly     -> `pending` is frozen into `inflight` with a fresh event_id
 *                 and sequence, then POSTed; `pending` keeps collecting
 *   success    -> `inflight` cleared, sequence moves on
 *   failure    -> `inflight` kept and retried as-is next time, so the server
 *                 can recognise a retry by its event_id and never count twice
 *
 * Each install syncs at its own minute of the hour (plus a little jitter), so
 * installs don't all arrive at :00. Browser shutdown is never relied on.
 */
import {
    EMPTY_COUNTS,
    LAZYBOARD_API,
    LAZYBOARD_KEY,
    parseLazyboardState,
    type Counts,
    type InflightSync,
    type JoinError,
    type LazyboardReply,
    type LazyboardState,
} from "@/shared/lazyboard";

const ALARM = "lazyboard-sync";
const JITTER_MS = 3 * 60 * 1000;

/** Set at build time by scripts/build.mjs (LAZYBOARD_SYNC_MINUTES). */
declare const __LAZYBOARD_SYNC_MINUTES__: number;
const SYNC_MINUTES: number = __LAZYBOARD_SYNC_MINUTES__;
const REQUEST_TIMEOUT_MS = 15_000;

/** Runs a storage read-modify-write after every earlier one finished. */
type Queue = <T>(task: () => Promise<T>) => Promise<T>;

async function readState(): Promise<LazyboardState | null> {
    const stored = await chrome.storage.local.get(LAZYBOARD_KEY);
    return parseLazyboardState(stored[LAZYBOARD_KEY]);
}

async function writeState(state: LazyboardState): Promise<void> {
    await chrome.storage.local.set({ [LAZYBOARD_KEY]: state });
}

/** Forgets the membership and frees the Lazy Name for a fresh start. */
async function clearState(): Promise<void> {
    await chrome.storage.local.remove([LAZYBOARD_KEY, "lazyName"]);
    await chrome.alarms.clear(ALARM);
}

async function api(
    path: string,
    init: RequestInit & { token?: string } = {},
): Promise<Response> {
    const { token, ...rest } = init;
    const headers = new Headers(rest.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (rest.body) headers.set("Content-Type", "application/json");
    return fetch(`${LAZYBOARD_API}${path}`, {
        ...rest,
        headers,
        cache: "no-store",
        credentials: "omit",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
}

async function errorCode(response: Response): Promise<string> {
    try {
        const body = (await response.json()) as { error?: unknown };
        return typeof body.error === "string" ? body.error : "";
    } catch {
        return "";
    }
}

function hasCounts(counts: Counts): boolean {
    return (
        counts.shortsWatched > 0 ||
        counts.watchSeconds >= 1 ||
        counts.autoScrolls > 0
    );
}

/**
 * The next time this install's minute comes round, plus some jitter. Local
 * builds with a shorter interval just sync that often from now.
 */
function nextSyncTime(syncMinute: number, now = new Date()): number {
    if (SYNC_MINUTES !== 60) return now.getTime() + SYNC_MINUTES * 60_000;
    const next = new Date(now);
    next.setMinutes(syncMinute, 0, 0);
    if (next.getTime() <= now.getTime()) next.setHours(next.getHours() + 1);
    return next.getTime() + Math.floor(Math.random() * JITTER_MS);
}

export function createLazyboard(queue: Queue) {
    let joining: Promise<LazyboardReply> | null = null;
    let syncing: Promise<void> | null = null;

    async function schedule(state: LazyboardState): Promise<void> {
        if (state.status === "blocked") return;
        await chrome.alarms.create(ALARM, {
            when: nextSyncTime(state.syncMinute),
            periodInMinutes: SYNC_MINUTES,
        });
    }

    /**
     * Adds activity to what the next sync will send. Called from inside the
     * stats queue, so it must not queue itself.
     */
    async function addPending(delta: Record<string, unknown>): Promise<void> {
        const state = await readState();
        if (!state || state.status === "blocked") return;
        const amount = (key: string) => {
            const n = Number(delta?.[key]);
            return Number.isFinite(n) && n > 0 ? n : 0;
        };
        state.pending = {
            shortsWatched:
                state.pending.shortsWatched + amount("shortsWatched"),
            watchSeconds: state.pending.watchSeconds + amount("watchSeconds"),
            // background.js calls it autoScrolled; the server, auto_scrolls.
            autoScrolls: state.pending.autoScrolls + amount("autoScrolled"),
        };
        await writeState(state);
    }

    async function register(
        name: string,
        privacyNoticeVersion: string,
        shareCountry: boolean,
    ): Promise<LazyboardReply> {
        if (await readState()) return { ok: false, error: "already_joined" };

        let response: Response;
        try {
            response = await api("/register", {
                method: "POST",
                body: JSON.stringify({
                    public_name: name,
                    privacy_notice_version: privacyNoticeVersion,
                    share_country: shareCountry,
                }),
            });
        } catch {
            return { ok: false, error: "network" };
        }
        if (!response.ok) {
            const code = await errorCode(response);
            const known: JoinError[] = [
                "name_taken",
                "name_not_allowed",
                "invalid_name",
            ];
            if (known.includes(code as JoinError)) {
                return { ok: false, error: code as JoinError };
            }
            if (response.status === 429)
                return { ok: false, error: "rate_limited" };
            return { ok: false, error: "failed" };
        }

        const body = (await response.json()) as {
            installation_id: string;
            token: string;
            public_name: string;
            sync_minute: number;
            privacy_notice_version: string;
            share_country: boolean;
        };
        const state: LazyboardState = {
            installationId: body.installation_id,
            token: body.token,
            publicName: body.public_name,
            syncMinute: body.sync_minute,
            sequence: 1,
            // Only activity from now on counts.
            pending: { ...EMPTY_COUNTS },
            inflight: null,
            lastSyncAt: null,
            status: "active",
            privacyNoticeVersion: body.privacy_notice_version,
            agreedAt: new Date().toISOString(),
            shareCountry: body.share_country === true,
        };
        await queue(async () => {
            await writeState(state);
            await chrome.storage.local.set({ lazyName: body.public_name });
        });
        await schedule(state);
        return { ok: true };
    }

    function join(
        name: string,
        privacyNoticeVersion: string,
        shareCountry: boolean,
    ): Promise<LazyboardReply> {
        // A double click must not register twice.
        joining ??= register(name, privacyNoticeVersion, shareCountry).finally(
            () => {
                joining = null;
            },
        );
        return joining;
    }

    /** Shows or hides this install's country on the Lazyboard. */
    async function setShareCountry(
        shareCountry: boolean,
    ): Promise<LazyboardReply> {
        const state = await readState();
        if (!state) return { ok: false, error: "failed" };
        try {
            const response = await api("/me", {
                method: "PATCH",
                token: state.token,
                body: JSON.stringify({ share_country: shareCountry }),
            });
            if (!response.ok) return { ok: false, error: "failed" };
        } catch {
            return { ok: false, error: "network" };
        }
        await update(state.installationId, (s) => {
            s.shareCountry = shareCountry;
        });
        return { ok: true };
    }

    async function leave(): Promise<LazyboardReply> {
        const state = await readState();
        if (!state) return { ok: true };
        try {
            const response = await api("/me", {
                method: "DELETE",
                token: state.token,
            });
            // 401: the server already forgot this install.
            if (!response.ok && response.status !== 401) {
                return { ok: false, error: "failed" };
            }
        } catch {
            return { ok: false, error: "network" };
        }
        await queue(clearState);
        return { ok: true };
    }

    /** Moves pending activity into a new inflight sync, unless one is waiting. */
    function freeze(): Promise<{
        state: LazyboardState;
        inflight: InflightSync;
    } | null> {
        return queue(async () => {
            const state = await readState();
            if (!state || state.status === "blocked") return null;
            if (!state.inflight) {
                if (!hasCounts(state.pending)) return null;
                const wholeSeconds = Math.floor(state.pending.watchSeconds);
                state.inflight = {
                    eventId: crypto.randomUUID(),
                    sequence: state.sequence,
                    shortsWatched: state.pending.shortsWatched,
                    watchSeconds: wholeSeconds,
                    autoScrolls: state.pending.autoScrolls,
                };
                state.sequence += 1;
                // Keep the part-second so it counts next time.
                state.pending = {
                    ...EMPTY_COUNTS,
                    watchSeconds: state.pending.watchSeconds - wholeSeconds,
                };
                await writeState(state);
            }
            return { state, inflight: state.inflight };
        });
    }

    /** Applies a change to stored state, if this install is still the same one. */
    function update(
        installationId: string,
        change: (state: LazyboardState) => void,
    ) {
        return queue(async () => {
            const state = await readState();
            if (!state || state.installationId !== installationId) return;
            change(state);
            await writeState(state);
        });
    }

    /** One round: send the inflight sync. True if it's worth another round. */
    async function sendOnce(): Promise<boolean> {
        const frozen = await freeze();
        if (!frozen) return false;
        const { state, inflight } = frozen;
        const id = state.installationId;

        let response: Response;
        try {
            response = await api("/sync", {
                method: "POST",
                token: state.token,
                body: JSON.stringify({
                    event_id: inflight.eventId,
                    sequence: inflight.sequence,
                    shorts_watched: inflight.shortsWatched,
                    watch_seconds: inflight.watchSeconds,
                    auto_scrolls: inflight.autoScrolls,
                }),
            });
        } catch {
            return false; // Offline or timed out: retry the same event later.
        }

        if (response.ok) {
            await update(id, (s) => {
                if (s.inflight?.eventId === inflight.eventId) s.inflight = null;
                s.lastSyncAt = new Date().toISOString();
            });
            return true;
        }

        const code = await errorCode(response);
        switch (response.status) {
            case 401:
                // The server no longer knows this token.
                await queue(clearState);
                return false;
            case 403:
                await update(id, (s) => {
                    s.status = "blocked";
                    s.inflight = null;
                    s.pending = { ...EMPTY_COUNTS };
                });
                await chrome.alarms.clear(ALARM);
                return false;
            case 409:
                if (code === "stale_sequence" || code === "event_id_reused") {
                    // Out of step with the server (e.g. restored storage). The
                    // delta never counted, so resend it under a new number.
                    await resyncSequence(state, inflight);
                    return true;
                }
                return false;
            case 422:
                // The server will never take this payload; drop it.
                await update(id, (s) => {
                    if (s.inflight?.eventId === inflight.eventId)
                        s.inflight = null;
                });
                return false;
            default:
                return false; // 429 or 5xx: retry later.
        }
    }

    async function resyncSequence(
        state: LazyboardState,
        inflight: InflightSync,
    ) {
        try {
            const response = await api("/me", { token: state.token });
            if (!response.ok) return;
            const me = (await response.json()) as { last_sequence?: unknown };
            const last = Number(me.last_sequence);
            if (!Number.isFinite(last)) return;
            await update(state.installationId, (s) => {
                if (s.inflight?.eventId !== inflight.eventId) return;
                s.inflight = {
                    ...s.inflight,
                    eventId: crypto.randomUUID(),
                    sequence: last + 1,
                };
                s.sequence = last + 2;
            });
        } catch {
            // Try again next hour.
        }
    }

    /** Sends what's waiting. A retried sync may be followed by fresh pending. */
    function sync(): Promise<void> {
        syncing ??= (async () => {
            try {
                if (await sendOnce()) await sendOnce();
            } catch {
                // Never let a sync failure escape the worker.
            }
        })().finally(() => {
            syncing = null;
        });
        return syncing;
    }

    /** Makes sure the hourly alarm exists (alarms don't always survive restarts). */
    async function ensureScheduled(): Promise<void> {
        const state = await readState();
        if (!state) return;
        const existing = await chrome.alarms.get(ALARM);
        // Also when a build with a different interval replaced the old one.
        if (existing?.periodInMinutes !== SYNC_MINUTES) await schedule(state);
        // A browser that was closed through its sync minute catches up now.
        const last = state.lastSyncAt ? Date.parse(state.lastSyncAt) : 0;
        if (
            state.inflight ||
            (hasCounts(state.pending) &&
                Date.now() - last > SYNC_MINUTES * 60_000)
        ) {
            void sync();
        }
    }

    chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === ALARM) void sync();
    });

    return { addPending, join, setShareCountry, leave, sync, ensureScheduled };
}
