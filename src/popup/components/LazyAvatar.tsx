import { cn } from "@/popup/lib/utils";
import { avatarFor, type PickedAvatar } from "@/shared/avatar";

/**
 * An emoji on a pastel disc, drawn like the public Lazyboard page does. With
 * no pick, the name decides (see src/shared/avatar.ts).
 */
export function LazyAvatar({
    name,
    pick,
    className,
}: {
    name: string;
    pick?: PickedAvatar | null;
    className?: string;
}) {
    const look = avatarFor(name, pick?.emoji, pick?.color);
    return (
        <span
            aria-hidden
            className={cn(
                "@container flex size-9 shrink-0 items-center justify-center rounded-full shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)] select-none",
                className,
            )}
            style={{ backgroundColor: look.background }}
        >
            <span className="font-emoji text-[56cqw] leading-none">
                {look.emoji}
            </span>
        </span>
    );
}
