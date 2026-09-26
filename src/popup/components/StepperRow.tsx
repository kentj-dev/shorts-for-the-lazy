import { cn } from "@/popup/lib/utils";
import { Minus, Plus } from "lucide-react";

export function StepButton({
    label,
    onClick,
    disabled = false,
    children,
}: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            aria-label={label}
            onClick={onClick}
            disabled={disabled}
            className="flex size-7 cursor-pointer items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:outline-none disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
        >
            {children}
        </button>
    );
}

interface StepperRowProps {
    label: string;
    hint?: string;
    value: number;
    /** The values the buttons step through, in order. */
    options: readonly number[];
    format: (value: number) => string;
    onChange: (next: number) => void;
}

/** One label plus a − value + control that steps through fixed options. */
export function StepperRow({
    label,
    hint,
    value,
    options,
    format,
    onChange,
}: StepperRowProps) {
    const index = options.indexOf(value);
    // A value outside the list (say, excluded by another rule) steps from the nearest end.
    const below = options.filter((option) => option < value);
    const above = options.filter((option) => option > value);
    const previous = index > 0 ? options[index - 1] : below.at(-1);
    const next = index >= 0 ? options[index + 1] : above[0];

    return (
        <div className="flex items-center gap-3 px-3 py-2.5">
            <div className="min-w-0 flex-1">
                <p className="text-[13.5px] leading-tight">{label}</p>
                {hint ? (
                    <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">
                        {hint}
                    </p>
                ) : null}
            </div>
            <div className="flex shrink-0 items-center overflow-hidden rounded-lg border border-edge">
                <StepButton
                    label={`Decrease ${label.toLowerCase()}`}
                    disabled={previous === undefined}
                    onClick={() => previous !== undefined && onChange(previous)}
                >
                    <Minus className="size-3.5" strokeWidth={2} />
                </StepButton>
                <output
                    aria-live="polite"
                    className={cn(
                        "min-w-14 px-1 text-center text-[13px] font-medium tabular-nums",
                        value === 0 && "text-muted-foreground",
                    )}
                >
                    {format(value)}
                </output>
                <StepButton
                    label={`Increase ${label.toLowerCase()}`}
                    disabled={next === undefined}
                    onClick={() => next !== undefined && onChange(next)}
                >
                    <Plus className="size-3.5" strokeWidth={2} />
                </StepButton>
            </div>
        </div>
    );
}
