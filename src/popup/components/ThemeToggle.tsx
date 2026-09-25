import type { ThemePreference } from "@/popup/lib/theme";
import { cn } from "@/popup/lib/utils";
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";

const OPTIONS: ReadonlyArray<{
    value: ThemePreference;
    label: string;
    icon: LucideIcon;
}> = [
    { value: "system", label: "System", icon: Monitor },
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
];

interface ThemeToggleProps {
    value: ThemePreference;
    onChange: (next: ThemePreference) => void;
}

/** An icon-only System / Light / Dark switch for full-page views. */
export function ThemeToggle({ value, onChange }: ThemeToggleProps) {
    return (
        <div
            role="radiogroup"
            aria-label="Theme"
            className="flex shrink-0 gap-0.5 rounded-full border border-edge bg-card p-0.5"
        >
            {OPTIONS.map(({ value: option, label, icon: Icon }) => {
                const selected = value === option;
                return (
                    <button
                        key={option}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-label={label}
                        title={label}
                        onClick={() => onChange(option)}
                        className={cn(
                            "flex size-7 cursor-pointer items-center justify-center rounded-full transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                            selected
                                ? "bg-tint-brand text-tint-brand-foreground"
                                : "text-muted-foreground hover:text-foreground",
                        )}
                    >
                        <Icon className="size-3.5" strokeWidth={2} />
                    </button>
                );
            })}
        </div>
    );
}
