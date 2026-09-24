import logo from "@/assets/logo.png";
import { cn } from "@/popup/lib/utils";
import { ArrowLeft, Settings } from "lucide-react";

interface AppHeaderProps {
    /** Shows a back button and shrinks the mark. */
    onBack?: () => void;
    /** Omitted on sub-pages, where the gear would be a dead end. */
    onOpenSettings?: () => void;
}

function IconButton({
    label,
    onClick,
    children,
    className,
}: {
    label: string;
    onClick?: () => void;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <button
            type="button"
            aria-label={label}
            onClick={onClick}
            className={cn(
                "flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors",
                "hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                className,
            )}
        >
            {children}
        </button>
    );
}

/** The title bar: brand mark, name, tagline, and the settings button. */
export function AppHeader({ onBack, onOpenSettings }: AppHeaderProps) {
    return (
        <header className="flex items-center gap-2 px-0.5 pt-0.5 pb-3">
            {onBack ? (
                <IconButton label="Back" onClick={onBack}>
                    <ArrowLeft className="size-[18px]" />
                </IconButton>
            ) : null}

            <img
                src={logo}
                alt=""
                className={cn(
                    "shrink-0 rounded-xl bg-secondary",
                    onBack ? "size-9" : "size-11",
                )}
            />

            <div className="min-w-0 flex-1">
                <h1
                    className={cn(
                        "leading-tight font-semibold tracking-tight",
                        onBack ? "text-[15px]" : "text-[19px]",
                    )}
                >
                    Shorts for the Lazy
                </h1>
                <p className="truncate text-[11.5px] leading-snug text-muted-foreground">
                    Sit back and let Shorts scroll themselves.
                </p>
            </div>

            {onOpenSettings ? (
                <IconButton label="Settings" onClick={onOpenSettings}>
                    <Settings className="size-[18px]" />
                </IconButton>
            ) : null}
        </header>
    );
}
