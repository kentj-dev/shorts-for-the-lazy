import { Button } from "@/popup/components/ui/button";
import { Input } from "@/popup/components/ui/input";
import { cn } from "@/popup/lib/utils";
import {
    LAZY_NAME_MAX,
    LAZY_NAME_PATTERN,
    normalizeLazyName,
} from "@/shared/settings";
import { Dices, Lock } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const RULES = "3–20 letters, numbers, spaces, - or _.";

function suggestLazyName(): string {
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

type Hint = { text: string; tone: "plain" | "error" | "saved" };

interface LazyNameFieldProps {
    value: string;
    onSave: (next: string) => Promise<void>;
}

/**
 * The name people will show up as on the leaderboard. Saving asks for a
 * second click, then locks the name until the extension is reinstalled.
 */
export function LazyNameField({ value, onSave }: LazyNameFieldProps) {
    const [draft, setDraft] = useState(value);
    const [hint, setHint] = useState<Hint>({ text: RULES, tone: "plain" });
    const [confirming, setConfirming] = useState(false);
    const input = useRef<HTMLInputElement>(null);

    // Follow a change made elsewhere, but never over what is being typed.
    useEffect(() => {
        if (document.activeElement !== input.current) setDraft(value);
    }, [value]);

    const submit = async (event: React.FormEvent): Promise<void> => {
        event.preventDefault();
        const next = normalizeLazyName(draft);
        setDraft(next);
        if (!LAZY_NAME_PATTERN.test(next)) {
            setHint({ text: RULES, tone: "error" });
            return;
        }
        if (!confirming) {
            setConfirming(true);
            setHint({
                text: `"${next}" is forever. Only a reinstall can change it.`,
                tone: "error",
            });
            return;
        }
        setConfirming(false);
        try {
            await onSave(next);
        } catch {
            setHint({ text: "Couldn't save. Try again.", tone: "error" });
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
                    Locked in for good
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
                            setConfirming(false);
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
                            setConfirming(false);
                            setHint({
                                text: "Like it? Hit Save.",
                                tone: "plain",
                            });
                            input.current?.focus();
                        }}
                        className="absolute top-0.5 right-0.5 flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                        <Dices className="size-4" strokeWidth={1.9} />
                    </button>
                </div>
                <Button
                    type="submit"
                    variant={confirming ? "default" : "outline"}
                    size="sm"
                    className={cn("h-8", !confirming && "border-edge")}
                >
                    {confirming ? "Lock it in" : "Save"}
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
