import { LazyNameField, type Hint } from "@/popup/components/LazyNameField";
import { PrivacySheet } from "@/popup/components/PrivacySheet";
import { SettingRow } from "@/popup/components/SettingRow";
import { SettingSection } from "@/popup/components/SettingSection";
import { Button } from "@/popup/components/ui/button";
import { useLazyboard } from "@/popup/hooks/useLazyboard";
import {
    LAZYBOARD_URL,
    type LazyboardMessage,
    type LazyboardReply,
} from "@/shared/lazyboard";
import { PRIVACY_NOTICE_VERSION } from "@/shared/privacyNotice";
import { ChevronRight, ExternalLink, ShieldCheck } from "lucide-react";
import { useRef, useState } from "react";

const JOIN_ERRORS: Record<string, string> = {
    name_taken: "That name is taken. Try another.",
    name_not_allowed: "Let's keep it friendly. Try another name.",
    invalid_name: "3–20 letters, numbers, spaces, - or _.",
    rate_limited: "Too many tries. Give it a few minutes.",
    network: "Couldn't reach the Lazyboard. Try again.",
    already_joined: "You're already on the Lazyboard.",
};

function send(message: LazyboardMessage): Promise<LazyboardReply> {
    return chrome.runtime
        .sendMessage(message)
        .then(
            (reply: LazyboardReply | undefined) =>
                reply ?? { ok: false, error: "failed" },
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
        if (!reply.ok) {
            setCountryError(
                reply.error === "network"
                    ? "Couldn't reach the Lazyboard. Try again."
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
                    ? "Couldn't reach the Lazyboard. Try again."
                    : "Couldn't leave right now. Try again.",
            );
        }
    };

    if (membership === undefined) return null;
    const joined = membership !== null;
    const blocked = membership?.status === "blocked";

    return (
        <SettingSection
            title="Lazyboard"
            description={
                joined
                    ? "You're on the global leaderboard."
                    : "Pick a Lazy Name to join the global leaderboard. Nothing is sent until you agree."
            }
        >
            <LazyNameField
                value={membership?.publicName ?? ""}
                initialDraft={savedName}
                lockedNote={
                    membership
                        ? blocked
                            ? "Paused for unusual activity"
                            : syncNote(
                                  membership.lastSyncAt,
                                  membership.syncMinute,
                              )
                        : undefined
                }
                onSubmit={requestJoin}
            />

            {membership ? (
                <>
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
                    <a
                        href={LAZYBOARD_URL}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                        <span className="min-w-0 flex-1 text-[13.5px] leading-tight">
                            See the Lazyboard
                        </span>
                        <ExternalLink
                            className="size-4 shrink-0 text-muted-foreground"
                            strokeWidth={2}
                        />
                    </a>
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
