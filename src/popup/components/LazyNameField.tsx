import { Button } from "@/popup/components/ui/button";
import { Input } from "@/popup/components/ui/input";
import { cn } from "@/popup/lib/utils";
import { isOffensiveLazyName } from "@/shared/lazyName";
import {
    LAZY_NAME_MAX,
    LAZY_NAME_PATTERN,
    normalizeLazyName,
} from "@/shared/settings";
import { Dices, Lock } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const RULES = "3–20 letters, numbers, spaces, - or _.";
const NOT_ALLOWED = "Let's keep it friendly. Try another name.";

function randomLazyName(): string {
    const moods = [
        "Sleepy",
        "Comfy",
        "Snoozy",
        "Idle",
        "Mellow",
        "Drowsy",
        "Chill",
        "Couch",
    ];
    const critters = [
        "Sloth",
        "Panda",
        "Koala",
        "Potato",
        "Cat",
        "Otter",
        "Walrus",
        "Slug",
    ];
    const pick = (list: string[]): string =>
        list[Math.floor(Math.random() * list.length)] ?? "";
    return `${pick(moods)}${pick(critters)}${Math.floor(Math.random() * 90) + 10}`;
}

/** A random name that passes the filter (the number could be "69"). */
function suggestLazyName(): string {
    let name = randomLazyName();
    while (isOffensiveLazyName(name)) name = randomLazyName();
    return name;
}

export type Hint = { text: string; tone: "plain" | "error" | "saved" };

interface LazyNameFieldProps {
    /** The name on the Lazyboard. Shown locked once set. */
    value: string;
    /** What the input starts with while no name is set. */
    initialDraft?: string;
    /** Shown next to the locked name. */
    lockedNote?: string;
    /**
     * Called with a valid, friendly name. Resolves to a hint to show, or
     * null once the name is taken care of.
     */
    onSubmit: (name: string) => Promise<Hint | null>;
}

/**
 * The name people will show up as on the Lazyboard. Submitting a name hands
 * it to `onSubmit`, which asks for agreement to the privacy notice before
 * anything is sent. Once joined the name is locked until a reinstall.
 */
export function LazyNameField({
    value,
    initialDraft = "",
    lockedNote = "Locked in for good",
    onSubmit,
}: LazyNameFieldProps) {
    const [draft, setDraft] = useState(value || initialDraft);
    const [hint, setHint] = useState<Hint>({ text: RULES, tone: "plain" });
    const [busy, setBusy] = useState(false);
    const input = useRef<HTMLInputElement>(null);

    // Follow a change made elsewhere, but never over what is being typed.
    useEffect(() => {
        if (document.activeElement !== input.current) {
            setDraft(value || initialDraft);
        }
    }, [value, initialDraft]);

    const submit = async (event: React.FormEvent): Promise<void> => {
        event.preventDefault();
        if (busy) return;
        const next = normalizeLazyName(draft);
        setDraft(next);
        if (!LAZY_NAME_PATTERN.test(next)) {
            setHint({ text: RULES, tone: "error" });
            return;
        }
        if (isOffensiveLazyName(next)) {
            setHint({ text: NOT_ALLOWED, tone: "error" });
            return;
        }
        setBusy(true);
        try {
            const result = await onSubmit(next);
            if (result) setHint(result);
        } catch {
            setHint({
                text: "Something went wrong. Try again.",
                tone: "error",
            });
        } finally {
            setBusy(false);
        }
    };

    if (value) {
        return (
            <div className="flex items-center gap-2 px-3 py-2.5">
                <Lock
                    className="size-3.5 shrink-0 text-muted-foreground"
                    strokeWidth={2}
                    aria-hidden
                />
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">
                    {value}
                </span>
                <span className="shrink-0 text-[11.5px] text-muted-foreground">
                    {lockedNote}
                </span>
            </div>
        );
    }

    return (
        <div>
            <form
                onSubmit={submit}
                noValidate
                className="flex items-center gap-2 px-3 pt-2.5 pb-1.5"
            >
                <div className="relative min-w-0 flex-1">
                    <Input
                        ref={input}
                        value={draft}
                        maxLength={LAZY_NAME_MAX}
                        autoComplete="off"
                        spellCheck={false}
                        placeholder="SleepySloth42"
                        aria-label="Lazy Name"
                        aria-describedby="lazy-name-hint"
                        aria-invalid={hint.tone === "error"}
                        onChange={(event) => {
                            setDraft(event.target.value);
                            setHint({ text: RULES, tone: "plain" });
                        }}
                        className="h-8 border-edge pe-9 text-[13.5px] md:text-[13.5px]"
                    />
                    <button
                        type="button"
                        aria-label="Suggest a name"
                        title="Suggest a name"
                        onClick={() => {
                            setDraft(suggestLazyName());
                            setHint({
                                text: "Like it? Hit Join.",
                                tone: "plain",
                            });
                            input.current?.focus();
                        }}
                        className="absolute top-0.5 right-0.5 flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                        <Dices className="size-4" strokeWidth={1.9} />
                    </button>
                </div>
                <Button type="submit" size="sm" disabled={busy} className="h-8">
                    Join
                </Button>
            </form>
            <p
                id="lazy-name-hint"
                aria-live="polite"
                className={cn(
                    "px-3 pb-2.5 text-[11.5px] leading-snug",
                    hint.tone === "error" && "text-destructive",
                    hint.tone === "saved" && "text-success",
                    hint.tone === "plain" && "text-muted-foreground",
                )}
            >
                {hint.text}
            </p>
        </div>
    );
}
