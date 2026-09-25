import { cn } from "@/popup/lib/utils";

/** FNV-1a, so the same name always gets the same colours. */
function hash(text: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

/** "SleepyKoala88" → "SK". */
export function initials(name: string): string {
    const parts = name.match(/[A-Z]?[a-z]+|[A-Z]+(?![a-z])|[0-9]+/g) ?? [name];
    const letters = parts.filter((p) => /[A-Za-z]/.test(p)).map((p) => p[0]);
    return (letters.slice(0, 2).join("") || name.slice(0, 2)).toUpperCase();
}

/** A gradient disc with initials. Matches the public Lazyboard page. */
export function LazyAvatar({
    name,
    className,
}: {
    name: string;
    className?: string;
}) {
    const h = hash(name.toLowerCase());
    const hue = h % 360;
    const hue2 = (hue + 40 + ((h >> 9) % 80)) % 360;
    return (
        <span
            aria-hidden
            className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold text-white",
                className,
            )}
            style={{
                backgroundImage: `linear-gradient(135deg, hsl(${hue} 78% 58%), hsl(${hue2} 72% 44%))`,
            }}
        >
            {initials(name)}
        </span>
    );
}
