import { LazyAvatar } from "@/popup/components/LazyAvatar";
import { Button } from "@/popup/components/ui/button";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetTitle,
} from "@/popup/components/ui/sheet";
import { cn } from "@/popup/lib/utils";
import {
    AVATAR_COLORS,
    AVATAR_EMOJI,
    DARK_COLORS,
    type AvatarColor,
    type PickedAvatar,
} from "@/shared/avatar";
import { Check, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";

const COLOR_NAMES = Object.keys(AVATAR_COLORS) as AvatarColor[];

interface AvatarSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Shown under the preview. */
    name: string;
    /** Where the picker starts: the current pick or the name's default. */
    initial: PickedAvatar;
    /** Resolves to an error message, or null once saved. */
    onSave: (pick: PickedAvatar) => Promise<string | null>;
}

/** Picks an emoji and a pastel colour, previewed live, in a bottom sheet. */
export function AvatarSheet({
    open,
    onOpenChange,
    name,
    initial,
    onSave,
}: AvatarSheetProps) {
    const [draft, setDraft] = useState(initial);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    // Start from what's saved every time it opens.
    useEffect(() => {
        if (open) {
            setDraft(initial);
            setError("");
        }
    }, [open]);

    const save = async () => {
        setBusy(true);
        setError("");
        const problem = await onSave(draft).catch(
            () => "Something went wrong. Try again.",
        );
        setBusy(false);
        if (problem) setError(problem);
        else onOpenChange(false);
    };

    return (
        <Sheet open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
            <SheetContent
                side="bottom"
                showCloseButton={false}
                aria-busy={busy}
                // Focusing the first swatch would look like a second selection.
                onOpenAutoFocus={(event) => event.preventDefault()}
                className="max-h-[88vh] gap-0 overflow-hidden rounded-t-[26px] border-edge bg-card shadow-[0_-16px_48px_rgba(0,0,0,0.28)]"
            >
                <div className="flex shrink-0 justify-center pt-2.5 pb-1.5">
                    <span className="h-[5px] w-10 rounded-full bg-muted-foreground/35" />
                </div>
                <div className="shrink-0 px-5 pt-1 pb-3 text-center">
                    <SheetTitle className="text-[16px] leading-tight tracking-tight">
                        Your avatar
                    </SheetTitle>
                    <SheetDescription className="mt-0.5 text-[11.5px] leading-snug">
                        Shown next to your name on the Lazyboard.
                    </SheetDescription>
                </div>

                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-4">
                    <div className="flex flex-col items-center gap-2">
                        <LazyAvatar
                            name={name}
                            pick={draft}
                            className="size-20"
                        />
                        <p className="max-w-full truncate text-[14px] font-semibold">
                            {name}
                        </p>
                    </div>

                    <div
                        role="radiogroup"
                        aria-label="Background colour"
                        // Pastels on the first row, darks on the second.
                        className="mx-auto grid w-fit grid-cols-8 gap-2"
                    >
                        {COLOR_NAMES.map((color) => {
                            const selected = draft.color === color;
                            const dark = DARK_COLORS.has(color);
                            return (
                                <button
                                    key={color}
                                    type="button"
                                    role="radio"
                                    aria-checked={selected}
                                    aria-label={color}
                                    onClick={() =>
                                        setDraft((d) => ({ ...d, color }))
                                    }
                                    className={cn(
                                        "flex size-8 cursor-pointer items-center justify-center rounded-full transition-transform hover:scale-110 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                                        // Keeps dark swatches visible on the dark sheet.
                                        dark &&
                                            "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.22)]",
                                        selected &&
                                            "ring-2 ring-foreground ring-offset-2 ring-offset-card",
                                    )}
                                    style={{
                                        backgroundColor: AVATAR_COLORS[color],
                                    }}
                                >
                                    {selected ? (
                                        <Check
                                            className={cn(
                                                "size-4",
                                                dark
                                                    ? "text-white"
                                                    : "text-[#2a2b30]",
                                            )}
                                            strokeWidth={3}
                                        />
                                    ) : null}
                                </button>
                            );
                        })}
                    </div>

                    <div
                        role="radiogroup"
                        aria-label="Emoji"
                        className="grid grid-cols-8 gap-1 rounded-2xl border border-edge bg-background p-2"
                    >
                        {AVATAR_EMOJI.map((emoji) => {
                            const selected = draft.emoji === emoji;
                            return (
                                <button
                                    key={emoji}
                                    type="button"
                                    role="radio"
                                    aria-checked={selected}
                                    aria-label={emoji}
                                    onClick={() =>
                                        setDraft((d) => ({ ...d, emoji }))
                                    }
                                    className={cn(
                                        "flex aspect-square cursor-pointer items-center justify-center rounded-xl font-emoji text-[20px] transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                                        selected &&
                                            "bg-tint-brand ring-2 ring-primary",
                                    )}
                                >
                                    {emoji}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="shrink-0 space-y-1.5 border-t border-border bg-card px-5 pt-3 pb-4">
                    {error ? (
                        <p
                            aria-live="polite"
                            className="pb-1 text-center text-[11.5px] text-destructive"
                        >
                            {error}
                        </p>
                    ) : null}
                    <Button
                        className="h-11 w-full rounded-full text-[14px]"
                        disabled={busy}
                        onClick={() => void save()}
                    >
                        {busy ? (
                            <>
                                <LoaderCircle className="animate-spin" />
                                Saving…
                            </>
                        ) : (
                            "Save avatar"
                        )}
                    </Button>
                    <Button
                        variant="ghost"
                        className="h-9 w-full rounded-full text-muted-foreground"
                        disabled={busy}
                        onClick={() => onOpenChange(false)}
                    >
                        Cancel
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    );
}
