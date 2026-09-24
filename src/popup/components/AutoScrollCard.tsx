import { Switch } from "@/popup/components/ui/switch";
import { ChevronsDown } from "lucide-react";

interface AutoScrollCardProps {
    enabled: boolean;
    onChange: (next: boolean) => void;
}

/** The main switch, tinted like the Introvert popup's "Leave me alone" card. */
export function AutoScrollCard({ enabled, onChange }: AutoScrollCardProps) {
    return (
        <div className="flex items-center gap-3 rounded-md border border-edge bg-tint-brand px-3 py-3 shadow-none">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/70 text-tint-brand-foreground dark:bg-white/10">
                <ChevronsDown className="size-[18px]" strokeWidth={1.9} />
            </span>
            <div className="min-w-0 flex-1">
                <p className="text-[14px] leading-tight font-medium">
                    Auto-scroll
                </p>
                <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
                    Moves to the next Short when the current one ends.
                </p>
            </div>
            <Switch
                checked={enabled}
                onCheckedChange={onChange}
                aria-label="Auto-scroll"
            />
        </div>
    );
}
