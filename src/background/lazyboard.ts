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
 * On top of that, the popup's "Sync now" sends right away (at most once per
 * MANUAL_SYNC_COOLDOWN_MS), and a sync that couldn't get through is retried
 * as soon as the browser is back online instead of waiting for the hour.
 *
 * The server deletes installs that stay quiet for INACTIVE_DAYS. When it no
 * longer knows the token (401), the membership is dropped here too and a
 * REMOVED_KEY note is left so the popup can explain what happened.
 */
import {
    EMPTY_COUNTS,
    LAZYBOARD_API,
    LAZYBOARD_KEY,
    REMOVED_KEY,
    hasCounts,
    manualSyncReadyAt,
    parseLazyboardState,
    type InflightSync,
    type JoinError,
    type LazyboardReply,
    type LazyboardState,
    type RemovedNotice,
} from "@/shared/lazyboard";
import {
    AVATAR_KEY,
    parsePickedAvatar,
    type PickedAvatar,
} from "@/shared/avatar";

const ALARM = "lazyboard-sync";
const JITTER_MS = 3 * 60 * 1000;

/** Set at build time by scripts/build.mjs (LAZYBOARD_SYNC_MINUTES). */
declare const __LAZYBOARD_SYNC_MINUTES__: number;
const SYNC_MINUTES: number = __LAZYBOARD_SYNC_MINUTES__;
const REQUEST_TIMEOUT_MS = 15_000;
/**
 * Retries after being unreachable happen at most this often. Kept in session
 * storage because the worker itself restarts often.
 */
const RETRY_KEY = "lazyboardRetryAt";
const RETRY_GAP_MS = 5 * 60 * 1000;

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

/** Like clearState, but leaves a note for the popup: the server removed us. */
async function clearRemoved(state: LazyboardState): Promise<void> {
    await clearState();
    const notice: RemovedNotice = {
        publicName: state.publicName,
        at: new Date().toISOString(),
    };
    await chrome.storage.local.set({ [REMOVED_KEY]: notice });
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

/**
 * What a request came back with. Only JSON from the API itself is believed:
 * when the server is down, Cloudflare (or a captive portal, or a proxy)
 * answers with its own pages and status codes, and a 401 or 403 from one of
 * those must never be read as "removed" or "blocked".
 */
type ApiResult =
    | { kind: "ok"; body: Record<string, unknown> }
    /** The API refused, with one of its own error codes. */
    | { kind: "error"; status: number; code: string }
    /** Offline, timed out, server error, or not the API answering. */
    | { kind: "unreachable" };

async function call(
    path: string,
    init: RequestInit & { token?: string } = {},
): Promise<ApiResult> {
    let response: Response;
    try {
        response = await api(path, init);
    } catch {
        return { kind: "unreachable" };
    }
    // DELETE /me answers 204 with no body.
    if (response.status === 204) return { kind: "ok", body: {} };
    let body: Record<string, unknown> | null = null;
    try {
        const parsed: unknown = await response.json();
        if (typeof parsed === "object" && parsed !== null) {
            body = parsed as Record<string, unknown>;
        }
    } catch {
        body = null;
    }
    if (!body) return { kind: "unreachable" };
    if (response.ok) return { kind: "ok", body };
    // 5xx means the server is struggling; like being offline, try later.
    if (response.status < 500 && typeof body.error === "string") {
        return { kind: "error", status: response.status, code: body.error };
    }
    return { kind: "unreachable" };
}

/** The API's own answer that this install's token is unknown. */
function isUnknownToken(result: ApiResult): boolean {
    return (
        result.kind === "error" &&
        result.status === 401 &&
        result.code === "unauthorized"
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
        const stored = await chrome.storage.local.get(AVATAR_KEY);
        const avatar: PickedAvatar | null = parsePickedAvatar(
            stored[AVATAR_KEY],
        );

        const result = await call("/register", {
            method: "POST",
            body: JSON.stringify({
                public_name: name,
                privacy_notice_version: privacyNoticeVersion,
                share_country: shareCountry,
                // Only if one was picked; the page has name-based defaults.
                avatar_emoji: avatar?.emoji,
                avatar_color: avatar?.color,
            }),
        });
        if (result.kind === "unreachable")
            return { ok: false, error: "network" };
        if (result.kind === "error") {
            const known: JoinError[] = [
                "name_taken",
                "name_not_allowed",
                "invalid_name",
                "rate_limited",
            ];
            return known.includes(result.code as JoinError)
                ? { ok: false, error: result.code as JoinError }
                : { ok: false, error: "failed" };
        }

        const body = result.body;
        if (
            typeof body.installation_id !== "string" ||
            typeof body.token !== "string" ||
            typeof body.public_name !== "string" ||
            typeof body.sync_minute !== "number"
        ) {
            return { ok: false, error: "network" };
        }
        const now = new Date().toISOString();
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
            lastActiveAt: now,
            unreachableSince: null,
            status: "active",
            privacyNoticeVersion: String(
                body.privacy_notice_version ?? privacyNoticeVersion,
            ),
            agreedAt: now,
            shareCountry: body.share_country === true,
        };
        await queue(async () => {
            await writeState(state);
            await chrome.storage.local.set({ lazyName: body.public_name });
            await chrome.storage.local.remove(REMOVED_KEY);
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

    /**
     * PATCH /me. The server counts it as activity. A 401 means the install
     * was removed (usually for inactivity), so the membership goes too.
     */
    async function patchMe(
        state: LazyboardState,
        body: Record<string, unknown>,
    ): Promise<LazyboardReply> {
        const result = await call("/me", {
            method: "PATCH",
            token: state.token,
            body: JSON.stringify(body),
        });
        if (result.kind === "unreachable")
            return { ok: false, error: "network" };
        if (isUnknownToken(result)) {
            await queue(() => clearRemoved(state));
            return { ok: false, error: "removed" };
        }
        if (result.kind === "error") return { ok: false, error: "failed" };
        await update(state.installationId, (s) => {
            s.lastActiveAt = new Date().toISOString();
            s.unreachableSince = null;
        });
        return { ok: true };
    }

    /**
     * Saves the picked avatar, and tells the server when already joined. The
     * local copy only changes once the server accepted it.
     */
    async function setAvatar(
        emoji: string,
        color: string,
    ): Promise<LazyboardReply> {
        const pick = parsePickedAvatar({ emoji, color });
        if (!pick) return { ok: false, error: "failed" };
        const state = await readState();
        if (state) {
            const reply = await patchMe(state, {
                avatar_emoji: pick.emoji,
                avatar_color: pick.color,
            });
            // Removed: still keep the pick locally for rejoining.
            if (!reply.ok && reply.error !== "removed") return reply;
        }
        await chrome.storage.local.set({ [AVATAR_KEY]: pick });
        return { ok: true };
    }

    /** Shows or hides this install's country on the Lazyboard. */
    async function setShareCountry(
        shareCountry: boolean,
    ): Promise<LazyboardReply> {
        const state = await readState();
        if (!state) return { ok: false, error: "failed" };
        const reply = await patchMe(state, { share_country: shareCountry });
        if (!reply.ok) return reply;
        await update(state.installationId, (s) => {
            s.shareCountry = shareCountry;
        });
        return { ok: true };
    }

    async function leave(): Promise<LazyboardReply> {
        const state = await readState();
        if (!state) return { ok: true };
        const result = await call("/me", {
            method: "DELETE",
            token: state.token,
        });
        // Leaving must reach the server, or the name and stats would stay up.
        if (result.kind === "unreachable")
            return { ok: false, error: "network" };
        // An unknown token means the server already forgot this install.
        if (result.kind === "error" && !isUnknownToken(result)) {
            return { ok: false, error: "failed" };
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

    /**
     * One round: send the inflight sync. True only when it was renumbered
     * after a 409 and should be sent again now. After a success, whatever
     * collected meanwhile waits for the next sync: the server refuses another
     * one within MIN_SYNC_GAP_SECS anyway.
     */
    async function sendOnce(): Promise<boolean> {
        const frozen = await freeze();
        if (!frozen) return false;
        const { state, inflight } = frozen;
        const id = state.installationId;

        const result = await call("/sync", {
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

        // Only a real sync answer clears the inflight delta.
        if (
            result.kind === "unreachable" ||
            (result.kind === "ok" &&
                typeof result.body.last_sequence !== "number")
        ) {
            // Keep everything and retry the same event later; the popup says
            // the Lazyboard can't be reached for now.
            await update(id, (s) => {
                s.unreachableSince ??= new Date().toISOString();
            });
            return false;
        }

        if (result.kind === "ok") {
            await update(id, (s) => {
                if (s.inflight?.eventId === inflight.eventId) s.inflight = null;
                s.lastSyncAt = new Date().toISOString();
                s.lastActiveAt = s.lastSyncAt;
                s.unreachableSince = null;
            });
            return false;
        }

        // The API answered, so it's reachable, but it refused.
        await update(id, (s) => {
            s.unreachableSince = null;
        });
        const { status, code } = result;
        if (isUnknownToken(result)) {
            // The server no longer knows this token: almost always the
            // inactivity clean-up.
            await queue(() => clearRemoved(state));
            return false;
        }
        if (status === 403 && code === "blocked") {
            await update(id, (s) => {
                s.status = "blocked";
                s.inflight = null;
                s.pending = { ...EMPTY_COUNTS };
            });
            await chrome.alarms.clear(ALARM);
            return false;
        }
        if (
            status === 409 &&
            (code === "stale_sequence" || code === "event_id_reused")
        ) {
            // Out of step with the server (e.g. restored storage). The delta
            // never counted, so resend it under a new number.
            await resyncSequence(state, inflight);
            return true;
        }
        if (status === 422) {
            // The server will never take this payload; drop it.
            await update(id, (s) => {
                if (s.inflight?.eventId === inflight.eventId) s.inflight = null;
            });
        }
        // 429 (rate_limited or sync_too_soon) and anything else: the same
        // inflight sync is retried later.
        return false;
    }

    async function resyncSequence(
        state: LazyboardState,
        inflight: InflightSync,
    ) {
        try {
            const result = await call("/me", { token: state.token });
            if (result.kind !== "ok") return;
            const last = Number(result.body.last_sequence);
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

    /** Sends what's waiting, once more if it had to be renumbered. */
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

    /**
     * The popup's "Sync now". Waits out the cooldown since the last sync that
     * got through, then reports how this one went.
     */
    async function syncNow(): Promise<LazyboardReply> {
        const before = await readState();
        if (!before || before.status === "blocked") {
            return { ok: false, error: "failed" };
        }
        if (manualSyncReadyAt(before.lastSyncAt) !== null) {
            return { ok: false, error: "cooldown" };
        }
        if (!before.inflight && !hasCounts(before.pending)) return { ok: true };

        await sync();
        const after = await readState();
        if (!after || after.installationId !== before.installationId) {
            return { ok: false, error: "removed" };
        }
        if (after.lastSyncAt !== before.lastSyncAt) return { ok: true };
        if (after.unreachableSince) return { ok: false, error: "network" };
        return { ok: false, error: "failed" };
    }

    /**
     * After failing to reach the Lazyboard, tries again as soon as it might
     * work (back online, or the worker waking up) rather than on the hour.
     */
    async function retryUnreachable(): Promise<void> {
        if (!navigator.onLine) return;
        const state = await readState();
        if (!state?.unreachableSince || state.status === "blocked") return;
        const stored = await chrome.storage.session.get(RETRY_KEY);
        const last = Number(stored[RETRY_KEY]) || 0;
        if (Date.now() - last < RETRY_GAP_MS) return;
        await chrome.storage.session.set({ [RETRY_KEY]: Date.now() });
        await sync();
    }

    chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === ALARM) void sync();
    });
    self.addEventListener("online", () => {
        retryUnreachable().catch(() => {});
    });

    return {
        addPending,
        join,
        setShareCountry,
        setAvatar,
        leave,
        sync,
        syncNow,
        retryUnreachable,
        ensureScheduled,
    };
}
