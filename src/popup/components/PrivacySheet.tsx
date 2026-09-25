import { LazyAvatar } from "@/popup/components/LazyAvatar";
import { Button } from "@/popup/components/ui/button";
import { Switch } from "@/popup/components/ui/switch";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetTitle,
} from "@/popup/components/ui/sheet";
import { cn } from "@/popup/lib/utils";
import type { PickedAvatar } from "@/shared/avatar";
import {
    PRIVACY_NOTICE,
    PRIVACY_NOTICE_VERSION,
    type NoticeIcon,
} from "@/shared/privacyNotice";
import {
    EyeOff,
    FileCheck2,
    Globe2,
    Hourglass,
    LoaderCircle,
    LogOut,
    MapPin,
    Network,
    Send,
    ShieldCheck,
    type LucideIcon,
} from "lucide-react";
import { useEffect, useRef } from "react";

const ICONS: Record<NoticeIcon, LucideIcon> = {
    send: Send,
    never: EyeOff,
    public: Globe2,
    country: MapPin,
    ip: Network,
    record: FileCheck2,
    leave: LogOut,
    inactive: Hourglass,
};

/** Past this many pixels, letting go of a downward swipe closes the sheet. */
const DISMISS_DRAG_PX = 90;

type PrivacySheetProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
} & (
    | {
          /** Asking for agreement before joining as `name`. */
          mode: "join";
          name: string;
          busy: boolean;
          onAgree: () => void;
          /** The picked avatar; the name's default when null. */
          avatar: PickedAvatar | null;
          /** Off by default: only the name and stats are shared. */
          shareCountry: boolean;
          onShareCountryChange: (share: boolean) => void;
      }
    | {
          /** Re-reading the notice after joining. */
          mode: "review";
          agreedAt: string;
          version: string;
      }
);

function formatDate(iso: string): string {
    const date = new Date(iso);
    return Number.isNaN(date.getTime())
        ? ""
        : date.toLocaleDateString(undefined, { dateStyle: "medium" });
}

/**
 * The Lazyboard privacy notice as a phone-style bottom sheet: grab handle,
 * rounded top, slides up, swipe down to dismiss. Joining happens only from
 * its "Agree & join" button.
 */
export function PrivacySheet(props: PrivacySheetProps) {
    const { open, onOpenChange } = props;
    const busy = props.mode === "join" && props.busy;
    const content = useRef<HTMLDivElement>(null);
    const drag = useRef<{ startY: number; dy: number } | null>(null);

    // A sheet dismissed by swiping keeps its offset; start fresh next time.
    useEffect(() => {
        const el = content.current;
        if (open && el) {
            el.style.transform = "";
            el.style.transition = "";
            el.style.removeProperty("--sheet-drag");
        }
    }, [open]);

    const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        if (busy || event.button !== 0) return;
        drag.current = { startY: event.clientY, dy: 0 };
        event.currentTarget.setPointerCapture(event.pointerId);
        if (content.current) content.current.style.transition = "none";
    };

    const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        const el = content.current;
        if (!drag.current || !el) return;
        const dy = Math.max(0, event.clientY - drag.current.startY);
        drag.current.dy = dy;
        el.style.transform = `translateY(${dy}px)`;
    };

    const onPointerUp = () => {
        const el = content.current;
        const dy = drag.current?.dy ?? 0;
        drag.current = null;
        if (!el) return;
        if (dy > DISMISS_DRAG_PX) {
            el.style.setProperty("--sheet-drag", `${dy}px`);
            onOpenChange(false);
        } else {
            el.style.transition =
                "transform 320ms cubic-bezier(0.32, 0.72, 0, 1)";
            el.style.transform = "";
        }
    };

    return (
        <Sheet
            open={open}
            onOpenChange={(next) => {
                // Stay put while the join request is out.
                if (!busy) onOpenChange(next);
            }}
        >
            <SheetContent
                ref={content}
                side="bottom"
                showCloseButton={false}
                aria-busy={busy}
                className="max-h-[88vh] gap-0 overflow-hidden rounded-t-[26px] border-edge bg-card shadow-[0_-16px_48px_rgba(0,0,0,0.28)]"
            >
                <div
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                    className="shrink-0 cursor-grab touch-none select-none active:cursor-grabbing"
                >
                    <div className="flex justify-center pt-2.5 pb-1.5">
                        <span className="h-1.25 w-10 rounded-full bg-muted-foreground/35" />
                    </div>
                    <div className="flex items-center gap-3 px-5 pt-1.5 pb-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-tint-brand text-tint-brand-foreground">
                            <ShieldCheck className="size-5" strokeWidth={2} />
                        </span>
                        <div className="min-w-0">
                            <SheetTitle className="text-[16px] leading-tight tracking-tight">
                                {props.mode === "join"
                                    ? "Before you join"
                                    : "Lazyboard privacy"}
                            </SheetTitle>
                            <SheetDescription className="mt-0.5 text-[11.5px] leading-snug">
                                Privacy notice · version{" "}
                                {props.mode === "join"
                                    ? PRIVACY_NOTICE_VERSION
                                    : props.version}
                            </SheetDescription>
                        </div>
                    </div>
                </div>

                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 pb-4">
                    {props.mode === "join" ? (
                        <div className="flex items-center gap-3 rounded-2xl border border-edge bg-background px-3.5 py-3">
                            <LazyAvatar name={props.name} pick={props.avatar} />
                            <div className="min-w-0 flex-1">
                                <p className="text-[11.5px] leading-tight text-muted-foreground">
                                    You'll appear as
                                </p>
                                <p className="truncate text-[15px] leading-snug font-semibold">
                                    {props.name}
                                </p>
                            </div>
                            <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10.5px] text-muted-foreground">
                                Can't change later
                            </span>
                        </div>
                    ) : null}

                    {props.mode === "join" ? (
                        <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-edge bg-background px-3.5 py-3">
                            <MapPin
                                className="size-4 shrink-0 text-muted-foreground"
                                strokeWidth={2}
                            />
                            <span className="min-w-0 flex-1">
                                <span className="block text-[13px] leading-tight font-semibold">
                                    Show my country
                                </span>
                                <span className="mt-0.5 block text-[11.5px] leading-snug text-muted-foreground">
                                    {props.shareCountry
                                        ? "Your flag appears next to your name."
                                        : "Off: only your name and stats are shared."}
                                </span>
                            </span>
                            <Switch
                                checked={props.shareCountry}
                                onCheckedChange={props.onShareCountryChange}
                                disabled={busy}
                                aria-label="Show my country"
                            />
                        </label>
                    ) : null}

                    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-edge bg-background">
                        {PRIVACY_NOTICE.map(({ icon, title, points }) => {
                            const Icon = ICONS[icon];
                            return (
                                <li
                                    key={title}
                                    className="flex gap-3 px-3.5 py-3"
                                >
                                    <Icon
                                        className={cn(
                                            "mt-px size-4 shrink-0",
                                            icon === "never"
                                                ? "text-success"
                                                : "text-muted-foreground",
                                        )}
                                        strokeWidth={2}
                                    />
                                    <div className="min-w-0 space-y-1">
                                        <p className="text-[13px] leading-tight font-semibold">
                                            {title}
                                        </p>
                                        {points.map((point) => (
                                            <p
                                                key={point}
                                                className="text-[12px] leading-snug text-muted-foreground"
                                            >
                                                {point}
                                            </p>
                                        ))}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </div>

                <div className="shrink-0 space-y-1.5 border-t border-border bg-card px-5 pt-3 pb-4">
                    {props.mode === "join" ? (
                        <>
                            <Button
                                className="h-11 w-full rounded-full text-[14px]"
                                disabled={busy}
                                onClick={props.onAgree}
                            >
                                {busy ? (
                                    <>
                                        <LoaderCircle className="animate-spin" />
                                        Joining…
                                    </>
                                ) : (
                                    "Agree & join"
                                )}
                            </Button>
                            <Button
                                variant="ghost"
                                className="h-9 w-full rounded-full text-muted-foreground"
                                disabled={busy}
                                onClick={() => onOpenChange(false)}
                            >
                                Not now
                            </Button>
                        </>
                    ) : (
                        <>
                            <p className="pb-1 text-center text-[11.5px] text-muted-foreground">
                                {formatDate(props.agreedAt)
                                    ? `You agreed on ${formatDate(props.agreedAt)}.`
                                    : "You agreed to this notice when you joined."}
                            </p>
                            <Button
                                variant="secondary"
                                className="h-11 w-full rounded-full text-[14px]"
                                onClick={() => onOpenChange(false)}
                            >
                                Done
                            </Button>
                        </>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
