import { openPage } from "@/popup/lib/pages";
import { LAZYBOARD_URL } from "@/shared/lazyboard";
import {
    ChartColumn,
    History,
    Settings,
    Trophy,
    type LucideIcon,
} from "lucide-react";

const TILE_CLASS =
    "flex cursor-pointer flex-col items-center gap-1.5 px-1 py-2.5 text-[11.5px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:text-foreground focus-visible:outline-none";

function TileContent({
    icon: Icon,
    label,
}: {
    icon: LucideIcon;
    label: string;
}) {
    return (
        <>
            <Icon className="size-[18px]" strokeWidth={1.9} />
            {label}
        </>
    );
}

/** Shortcuts to everything outside the home view, above the footer. */
export function QuickNav({ onOpenSettings }: { onOpenSettings: () => void }) {
    return (
        <nav
            aria-label="More"
            className="grid grid-cols-4 divide-x divide-border overflow-hidden rounded-md border border-edge bg-card"
        >
            <button
                type="button"
                className={TILE_CLASS}
                onClick={() => openPage("month")}
            >
                <TileContent icon={ChartColumn} label="This month" />
            </button>
            <button
                type="button"
                className={TILE_CLASS}
                onClick={() => openPage("history")}
            >
                <TileContent icon={History} label="History" />
            </button>
            <a
                href={LAZYBOARD_URL}
                target="_blank"
                rel="noreferrer"
                className={TILE_CLASS}
            >
                <TileContent icon={Trophy} label="Lazyboard" />
            </a>
            <button
                type="button"
                className={TILE_CLASS}
                onClick={onOpenSettings}
            >
                <TileContent icon={Settings} label="Settings" />
            </button>
        </nav>
    );
}
