import type { LucideIcon } from "lucide-react";
import { Switch } from "@/popup/components/ui/switch";
import { cn } from "@/popup/lib/utils";

interface SettingRowProps {
    icon?: LucideIcon;
    label: string;
    hint?: string;
    checked: boolean;
    onChange: (next: boolean) => void;
    disabled?: boolean;
    /** Explains a disabled row, e.g. "already hidden in every chat". */
    disabledHint?: string;
}

/** One label plus a switch. The workhorse of every settings card. */
export function SettingRow({
    icon: Icon,
    label,
    hint,
    checked,
    onChange,
    disabled = false,
    disabledHint,
}: SettingRowProps) {
    const note = disabled ? (disabledHint ?? hint) : hint;

    return (
        <div
            className={cn(
                "flex items-center gap-3 px-3 py-2.5",
                disabled && "opacity-60",
            )}
        >
            {Icon ? (
                <Icon
                    className="size-[18px] shrink-0 text-muted-foreground"
                    strokeWidth={1.75}
                />
            ) : null}
            <div className="min-w-0 flex-1">
                <p className="text-[13.5px] leading-tight">{label}</p>
                {note ? (
                    <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">
                        {note}
                    </p>
                ) : null}
            </div>
            <Switch
                checked={checked}
                onCheckedChange={onChange}
                disabled={disabled}
                aria-label={label}
            />
        </div>
    );
}
