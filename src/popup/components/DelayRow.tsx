import { Slider } from "@/popup/components/ui/slider";
import { clampDelay, DELAY_STEP, MAX_DELAY_SECONDS } from "@/shared/settings";
import { Minus, Plus } from "lucide-react";
import { useEffect, useState } from "react";

interface DelayRowProps {
    value: number;
    onChange: (next: number) => void;
}

function StepButton({
    label,
    onClick,
    children,
}: {
    label: string;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            aria-label={label}
            onClick={onClick}
            className="flex size-7 cursor-pointer items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:outline-none"
        >
            {children}
        </button>
    );
}

/**
 * The wait before scrolling on. Dragging only moves the number; the value is
 * saved when the thumb is released, so sync storage isn't written per pixel.
 */
export function DelayRow({ value, onChange }: DelayRowProps) {
    const [draft, setDraft] = useState(value);
    useEffect(() => setDraft(value), [value]);

    const step = (direction: 1 | -1): void =>
        onChange(clampDelay(draft + direction * DELAY_STEP));

    return (
        <div className="px-3 py-2.5">
            <div className="mb-2.5 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] leading-tight">Delay</p>
                    <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">
                        Wait before scrolling to the next Short.
                    </p>
                </div>
                <div className="flex shrink-0 items-center overflow-hidden rounded-lg border border-edge">
                    <StepButton label="Decrease delay" onClick={() => step(-1)}>
                        <Minus className="size-3.5" strokeWidth={2} />
                    </StepButton>
                    <output
                        aria-live="polite"
                        className="min-w-11 text-center text-[13px] font-medium tabular-nums"
                    >
                        {draft.toFixed(1)}s
                    </output>
                    <StepButton label="Increase delay" onClick={() => step(1)}>
                        <Plus className="size-3.5" strokeWidth={2} />
                    </StepButton>
                </div>
            </div>
            <Slider
                min={0}
                max={MAX_DELAY_SECONDS}
                step={DELAY_STEP}
                value={[draft]}
                onValueChange={([next]) => setDraft(clampDelay(next))}
                onValueCommit={([next]) => onChange(clampDelay(next))}
                aria-label="Delay in seconds"
            />
            <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
                <span>0s</span>
                <span>{MAX_DELAY_SECONDS / 2}s</span>
                <span>{MAX_DELAY_SECONDS}s</span>
            </div>
        </div>
    );
}
