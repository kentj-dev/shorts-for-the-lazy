import { Button } from "@/popup/components/ui/button";
import { cn } from "@/popup/lib/utils";
import {
    DEFAULT_SHORTCUT,
    sameShortcut,
    shortcutFromEvent,
    shortcutKeys,
    type Shortcut,
} from "@/shared/shortcut";
import { useEffect, useState } from "react";

interface ShortcutRecorderProps {
    shortcut: Shortcut | null;
    onChange: (next: Shortcut | null) => void;
}

function Keys({ keys }: { keys: string[] }) {
    return (
        <span className="flex flex-wrap items-center gap-1">
            {keys.map((key, index) => (
                <kbd
                    key={`${key}-${index}`}
                    className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-edge bg-secondary px-1.5 font-sans text-[12px] font-medium text-secondary-foreground"
                >
                    {key}
                </kbd>
            ))}
        </span>
    );
}

/**
 * Records the in-page shortcut right in the popup. While recording, the next
 * key combination becomes the shortcut; Esc cancels and Backspace turns it
 * off. Nothing is saved until a valid combination is pressed.
 */
export function ShortcutRecorder({
    shortcut,
    onChange,
}: ShortcutRecorderProps) {
    const [recording, setRecording] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!recording) return undefined;

        const stop = (): void => {
            setRecording(false);
            setError(null);
        };
        const onKeyDown = (event: KeyboardEvent): void => {
            event.preventDefault();
            event.stopPropagation();
            const bare =
                !event.ctrlKey &&
                !event.altKey &&
                !event.metaKey &&
                !event.shiftKey;
            if (bare && event.key === "Escape") return stop();
            if (bare && (event.key === "Backspace" || event.key === "Delete")) {
                onChange(null);
                return stop();
            }
            const result = shortcutFromEvent(event);
            if (result.kind === "invalid") setError(result.reason);
            if (result.kind === "shortcut") {
                onChange(result.shortcut);
                stop();
            }
        };

        // Capture, so the recorded keys never reach the buttons underneath.
        window.addEventListener("keydown", onKeyDown, true);
        window.addEventListener("blur", stop);
        return () => {
            window.removeEventListener("keydown", onKeyDown, true);
            window.removeEventListener("blur", stop);
        };
    }, [recording, onChange]);

    const isDefault = sameShortcut(shortcut, DEFAULT_SHORTCUT);

    return (
        <div className="px-3 py-2.5">
            <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] leading-tight">
                        Toggle auto-scroll
                    </p>
                    <div className="mt-1.5 min-h-6">
                        {recording ? (
                            <span className="inline-flex h-6 items-center rounded-md border border-dashed border-primary px-2 text-[12px] font-medium text-primary">
                                Press keys…
                            </span>
                        ) : shortcut ? (
                            <Keys keys={shortcutKeys(shortcut)} />
                        ) : (
                            <span className="text-[12px] text-muted-foreground">
                                Off
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex shrink-0 gap-1.5">
                    {recording ? (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setRecording(false)}
                        >
                            Cancel
                        </Button>
                    ) : (
                        <>
                            {!isDefault ? (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onChange(DEFAULT_SHORTCUT)}
                                >
                                    Reset
                                </Button>
                            ) : null}
                            <Button
                                variant="outline"
                                size="sm"
                                className="border-edge"
                                onClick={() => {
                                    setError(null);
                                    setRecording(true);
                                }}
                            >
                                {shortcut ? "Change" : "Set"}
                            </Button>
                        </>
                    )}
                </div>
            </div>
            <p
                aria-live="polite"
                className={cn(
                    "mt-1.5 text-[11.5px] leading-snug",
                    error ? "text-destructive" : "text-muted-foreground",
                )}
            >
                {error ??
                    (recording
                        ? "Press the new combination. Esc cancels, Backspace turns it off."
                        : "Works on any YouTube tab.")}
            </p>
        </div>
    );
}
