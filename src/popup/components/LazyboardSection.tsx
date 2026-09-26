import { AvatarSheet } from "@/popup/components/AvatarSheet";
import { LazyAvatar } from "@/popup/components/LazyAvatar";
import { LazyNameField, type Hint } from "@/popup/components/LazyNameField";
import { PrivacySheet } from "@/popup/components/PrivacySheet";
import { SettingRow } from "@/popup/components/SettingRow";
import { SettingSection } from "@/popup/components/SettingSection";
import { Button } from "@/popup/components/ui/button";
import { useLazyAvatar } from "@/popup/hooks/useLazyAvatar";
import {
    dismissRemovedNotice,
    useLazyboard,
    useRemovedNotice,
} from "@/popup/hooks/useLazyboard";
import { defaultPick, type PickedAvatar } from "@/shared/avatar";
import {
    INACTIVE_DAYS,
    INACTIVE_WARNING_DAYS,
    LAZYBOARD_URL,
    UNREACHABLE_MESSAGE,
    hasCounts,
    manualSyncReadyAt,
    type LazyboardMessage,
    type LazyboardReply,
    type LazyboardState,
} from "@/shared/lazyboard";
import { PRIVACY_NOTICE_VERSION } from "@/shared/privacyNotice";
import {
    ChevronRight,
    CloudOff,
    ExternalLink,
    Hourglass,
    RefreshCw,
    ShieldCheck,
    Trophy,
    X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

const DAY_MS = 24 * 60 * 60 * 1000;

const JOIN_ERRORS: Record<string, string> = {
    name_taken: "That name is taken. Try another.",
    name_not_allowed: "Let's keep it friendly. Try another name.",
    invalid_name: "3–20 letters, numbers, spaces, - or _.",
    rate_limited: "Too many tries. Give it a few minutes.",
    network: UNREACHABLE_MESSAGE,
    already_joined: "You're already on the Lazyboard.",
};

/** Asks the service worker; never rejects, so no caller can crash on it. */
function send(message: LazyboardMessage): Promise<LazyboardReply> {
    return chrome.runtime.sendMessage(message).then(
        (reply: LazyboardReply | undefined) =>
            reply ?? { ok: false, error: "failed" },
        (): LazyboardReply => ({ ok: false, error: "failed" }),
    );
}

/** Shown while syncs can't reach the Lazyboard. Nothing is lost meanwhile. */
function UnreachableNotice() {
    return (
        <div
            role="status"
            className="flex items-start gap-3 bg-secondary px-3 py-2.5 first:rounded-t-[inherit]"
        >
            <CloudOff
                className="mt-px size-4 shrink-0 text-muted-foreground"
                strokeWidth={2}
            />
            <div className="min-w-0 flex-1">
                <p className="text-[13px] leading-tight font-semibold">
                    Can't reach the Lazyboard right now
                </p>
                <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">
                    Everything else works as usual. Your activity is saved and
                    will sync once it's back.
                </p>
            </div>
        </div>
    );
}

async function saveAvatar(pick: PickedAvatar): Promise<string | null> {
    const reply = await send({
        type: "LAZYBOARD_SET_AVATAR",
        emoji: pick.emoji,
        color: pick.color,
    });
    if (reply.ok) return null;
    return reply.error === "network"
        ? UNREACHABLE_MESSAGE
        : "Couldn't save your avatar. Try again.";
}

/** Whole days since `iso`, or 0 when it can't be read. */
function daysSince(iso: string): number {
    const then = Date.parse(iso);
    return Number.isNaN(then) ? 0 : Math.floor((Date.now() - then) / DAY_MS);
}

/** Shown once after the server removed this install for inactivity. */
function RemovedBanner({ onDismiss }: { onDismiss: () => void }) {
    return (
        <div
            role="status"
            className="flex items-start gap-3 bg-tint-brand px-3 py-2.5 text-tint-brand-foreground first:rounded-t-[inherit]"
        >
            <Hourglass className="mt-px size-4 shrink-0" strokeWidth={2} />
            <div className="min-w-0 flex-1">
                <p className="text-[13px] leading-tight font-semibold">
                    Your Lazyboard spot was removed
                </p>
                <p className="mt-0.5 text-[11.5px] leading-snug opacity-90">
                    It had no activity for {INACTIVE_DAYS} days, so your name
                    and stats were deleted. Join again anytime.
                </p>
            </div>
            <button
                type="button"
                onClick={onDismiss}
                aria-label="Dismiss"
                className="-m-1 flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md opacity-80 transition-opacity hover:opacity-100 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            >
                <X className="size-3.5" strokeWidth={2.2} />
            </button>
        </div>
    );
}

/** The current avatar and a button to change it. */
function AvatarRow({
    name,
    avatar,
    onChange,
}: {
    name: string;
    avatar: PickedAvatar | null;
    onChange: () => void;
}) {
    return (
        <div className="flex items-center gap-3 px-3 py-2.5">
            <LazyAvatar name={name} pick={avatar} className="size-9" />
            <div className="min-w-0 flex-1">
                <p className="text-[13.5px] leading-tight">Avatar</p>
                <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">
                    {avatar
                        ? "Your emoji and colour."
                        : "Picked from your name. Make it yours."}
                </p>
            </div>
            <Button
                variant="outline"
                size="sm"
                className="border-edge"
                onClick={onChange}
            >
                Change
            </Button>
        </div>
    );
}

/** Re-renders every `ms` so countdowns stay current while the popup is open. */
function useNow(ms: number): number {
    const [now, setNow] = useState(Date.now);
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), ms);
        return () => clearInterval(id);
    }, [ms]);
    return now;
}

const SYNC_ERRORS: Record<string, string> = {
    network: UNREACHABLE_MESSAGE,
    cooldown: "Synced recently. Try again in a few minutes.",
    removed: "",
};

/** "Sync now", allowed once per cooldown and only with something to send. */
function SyncNowRow({ membership }: { membership: LazyboardState }) {
    const now = useNow(15_000);
    const [syncing, setSyncing] = useState(false);
    const [result, setResult] = useState<{ text: string; error: boolean }>();

    const readyAt = manualSyncReadyAt(membership.lastSyncAt, now);
    const waiting =
        membership.inflight !== null || hasCounts(membership.pending);
    const minutesLeft = readyAt ? Math.ceil((readyAt - now) / 60_000) : 0;

    const syncNow = async () => {
        setSyncing(true);
        setResult(undefined);
        const reply = await send({ type: "LAZYBOARD_SYNC_NOW" });
        setSyncing(false);
        setResult(
            reply.ok
                ? {
                      text: "Synced. The board updates within a minute.",
                      error: false,
                  }
                : {
                      text:
                          SYNC_ERRORS[reply.error] ??
                          "Couldn't sync right now. Try again later.",
                      error: true,
                  },
        );
    };

    const hint =
        result?.text ||
        (!waiting
            ? "Up to date. Nothing new to send."
            : readyAt
              ? `Available in ${minutesLeft}m. Your activity is saved.`
              : "Send your latest activity now.");

    return (
        <div className="flex items-center gap-3 px-3 py-2.5">
            <div className="min-w-0 flex-1">
                <p className="text-[13.5px] leading-tight">Sync now</p>
                <p
                    aria-live="polite"
                    className={
                        result?.error
                            ? "mt-0.5 text-[11.5px] leading-snug text-destructive"
                            : "mt-0.5 text-[11.5px] leading-snug text-muted-foreground"
                    }
                >
                    {hint}
                </p>
            </div>
            <Button
                variant="outline"
                size="sm"
                className="border-edge"
                disabled={syncing || !waiting || readyAt !== null}
                onClick={() => void syncNow()}
            >
                <RefreshCw
                    className={syncing ? "animate-spin" : undefined}
                    strokeWidth={2}
                />
                Sync
            </Button>
        </div>
    );
}

function syncNote(lastSyncAt: string | null, syncMinute: number): string {
    const minute = `:${String(syncMinute).padStart(2, "0")}`;
    if (!lastSyncAt) return `Syncs hourly around ${minute}`;
    const minutes = Math.round((Date.now() - Date.parse(lastSyncAt)) / 60_000);
    const ago =
        minutes < 1
            ? "just now"
            : minutes < 60
              ? `${minutes}m ago`
              : `${Math.floor(minutes / 60)}h ago`;
    return `Synced ${ago} · hourly around ${minute}`;
}

interface LazyboardSectionProps {
    /** A Lazy Name saved before the Lazyboard existed, if any. */
    savedName: string;
}

/**
 * Joining the global Lazyboard. Picking a name opens the privacy sheet;
 * only "Agree & join" there sends anything.
 */
export function LazyboardSection({ savedName }: LazyboardSectionProps) {
    const membership = useLazyboard();
    const removed = useRemovedNotice();
    const avatar = useLazyAvatar();
    const [pickingAvatar, setPickingAvatar] = useState(false);
    const [joinName, setJoinName] = useState<string | null>(null);
    /** Outlives joinName so the sheet keeps its text while sliding away. */
    const [sheetName, setSheetName] = useState("");
    /** The join sheet's country switch. Off unless the person turns it on. */
    const [shareCountry, setShareCountry] = useState(false);
    const [countryError, setCountryError] = useState("");
    const [savingCountry, setSavingCountry] = useState(false);
    const [joining, setJoining] = useState(false);
    const [reviewing, setReviewing] = useState(false);
    const [confirmLeave, setConfirmLeave] = useState(false);
    const [leaveError, setLeaveError] = useState("");
    const [leaving, setLeaving] = useState(false);
    /** Settles the name field's pending submit once the sheet is done. */
    const settle = useRef<((hint: Hint | null) => void) | null>(null);

    const finish = (hint: Hint | null) => {
        settle.current?.(hint);
        settle.current = null;
        setJoinName(null);
    };

    const requestJoin = (name: string) =>
        new Promise<Hint | null>((resolve) => {
            settle.current = resolve;
            setJoinName(name);
            setSheetName(name);
        });

    const agree = async () => {
        if (!joinName) return;
        setJoining(true);
        const reply = await send({
            type: "LAZYBOARD_JOIN",
            name: joinName,
            privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
            shareCountry,
        }).catch((): LazyboardReply => ({ ok: false, error: "failed" }));
        setJoining(false);
        finish(
            reply.ok
                ? null
                : {
                      text:
                          JOIN_ERRORS[reply.error] ??
                          "Couldn't join. Try again.",
                      tone: "error",
                  },
        );
    };

    const changeCountry = async (share: boolean) => {
        setSavingCountry(true);
        setCountryError("");
        const reply = await send({
            type: "LAZYBOARD_SET_COUNTRY",
            shareCountry: share,
        }).catch((): LazyboardReply => ({ ok: false, error: "failed" }));
        setSavingCountry(false);
        // "removed" swaps this whole section for the banner; nothing to say.
        if (!reply.ok && reply.error !== "removed") {
            setCountryError(
                reply.error === "network"
                    ? UNREACHABLE_MESSAGE
                    : "Couldn't change that right now. Try again.",
            );
        }
    };

    const leave = async () => {
        if (!confirmLeave) {
            setConfirmLeave(true);
            return;
        }
        setLeaving(true);
        setLeaveError("");
        const reply = await send({ type: "LAZYBOARD_LEAVE" }).catch(
            (): LazyboardReply => ({ ok: false, error: "failed" }),
        );
        setLeaving(false);
        setConfirmLeave(false);
        if (!reply.ok) {
            setLeaveError(
                reply.error === "network"
                    ? UNREACHABLE_MESSAGE
                    : "Couldn't leave right now. Try again.",
            );
        }
    };

    if (membership === undefined || removed === undefined) return null;
    const joined = membership !== null;
    const blocked = membership?.status === "blocked";
    const quietDays = membership ? daysSince(membership.lastActiveAt) : 0;
    const daysLeft = Math.max(1, INACTIVE_DAYS - quietDays);
    const lockedNote = !membership
        ? undefined
        : blocked
          ? "Paused for unusual activity"
          : quietDays >= INACTIVE_WARNING_DAYS
            ? `No activity lately: removed in ${daysLeft} day${daysLeft === 1 ? "" : "s"} unless you watch a Short`
            : syncNote(membership.lastSyncAt, membership.syncMinute);

    return (
        <SettingSection
            title="Lazyboard"
            description={
                joined
                    ? `You're on the global leaderboard. After ${INACTIVE_DAYS} days without activity, your spot is removed automatically.`
                    : "Pick a Lazy Name to join the global leaderboard. Nothing is sent until you agree."
            }
        >
            {!joined && removed ? (
                <RemovedBanner onDismiss={dismissRemovedNotice} />
            ) : null}
            {membership?.unreachableSince && !blocked ? (
                <UnreachableNotice />
            ) : null}
            <LazyNameField
                value={membership?.publicName ?? ""}
                // After a removal, offer the old name again; it may still be free.
                initialDraft={savedName || removed?.publicName || ""}
                lockedNote={lockedNote}
                onSubmit={requestJoin}
            />

            <AvatarRow
                name={membership?.publicName || savedName || "Lazy"}
                avatar={avatar}
                onChange={() => setPickingAvatar(true)}
            />
            <AvatarSheet
                open={pickingAvatar}
                onOpenChange={setPickingAvatar}
                name={membership?.publicName || savedName || "Lazy"}
                initial={
                    avatar ??
                    defaultPick(membership?.publicName || savedName || "Lazy")
                }
                onSave={saveAvatar}
            />

            {membership ? (
                <>
                    {blocked ? null : <SyncNowRow membership={membership} />}
                    <SettingRow
                        label="Show my country"
                        hint={
                            countryError ||
                            (membership.shareCountry
                                ? "Your flag shows next to your name."
                                : "Off: only your name and stats are shared.")
                        }
                        checked={membership.shareCountry}
                        onChange={(share) => void changeCountry(share)}
                        disabled={savingCountry || blocked}
                    />
                    <button
                        type="button"
                        onClick={() => setReviewing(true)}
                        className="flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                        <ShieldCheck
                            className="size-4 shrink-0 text-muted-foreground"
                            strokeWidth={2}
                        />
                        <span className="min-w-0 flex-1 text-[13.5px] leading-tight">
                            Privacy notice
                        </span>
                        <ChevronRight
                            className="size-4 shrink-0 text-muted-foreground"
                            strokeWidth={2}
                        />
                    </button>
                    <div className="flex items-center gap-3 px-3 py-2.5">
                        <div className="min-w-0 flex-1">
                            <p className="text-[13.5px] leading-tight">
                                Leave the Lazyboard
                            </p>
                            <p
                                aria-live="polite"
                                className={
                                    leaveError || confirmLeave
                                        ? "mt-0.5 text-[11.5px] leading-snug text-destructive"
                                        : "mt-0.5 text-[11.5px] leading-snug text-muted-foreground"
                                }
                            >
                                {leaveError ||
                                    (confirmLeave
                                        ? "Your name and stats will be deleted."
                                        : "Deletes your name and stats from the server.")}
                            </p>
                        </div>
                        <Button
                            variant={confirmLeave ? "destructive" : "outline"}
                            size="sm"
                            className={confirmLeave ? undefined : "border-edge"}
                            disabled={leaving}
                            onClick={() => void leave()}
                            onBlur={() => setConfirmLeave(false)}
                        >
                            {confirmLeave ? "Leave" : "Leave…"}
                        </Button>
                    </div>
                </>
            ) : null}

            {/* Public, so worth a look before joining too. */}
            <a
                href={LAZYBOARD_URL}
                target="_blank"
                rel="noreferrer"
                className="group flex items-center gap-3 bg-tint-brand px-3 last:rounded-b-[inherit] py-2.5 text-tint-brand-foreground transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors group-hover:bg-primary-foreground/20">
                    <Trophy className="size-4" strokeWidth={2.2} />
                </span>
                <span className="min-w-0 flex-1 text-[13.5px] leading-tight font-semibold">
                    See the Lazyboard
                </span>
                <ExternalLink
                    className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    strokeWidth={2}
                />
            </a>

            {membership ? (
                <PrivacySheet
                    mode="review"
                    open={reviewing}
                    onOpenChange={setReviewing}
                    agreedAt={membership.agreedAt}
                    version={membership.privacyNoticeVersion}
                />
            ) : null}
            {/* Stays mounted after joining so it can slide away. */}
            <PrivacySheet
                mode="join"
                open={joinName !== null}
                name={sheetName}
                busy={joining}
                avatar={avatar}
                shareCountry={shareCountry}
                onShareCountryChange={setShareCountry}
                onAgree={() => void agree()}
                onOpenChange={(open) => {
                    if (!open) {
                        finish({
                            text: "No problem. Nothing was sent.",
                            tone: "plain",
                        });
                    }
                }}
            />
        </SettingSection>
    );
}
