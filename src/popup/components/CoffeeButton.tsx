import { Coffee } from "lucide-react";

const COFFEE_URL = "https://www.buymeacoffee.com/kentjdev";
const MESSAGE = "Like what you see? Buy me a 16 oz iced latte, no sugar 🙈";

/**
 * A local stand-in for the Buy Me a Coffee widget. MV3 extension pages can't
 * load its remote script, so this matches its look and position and only
 * reaches buymeacoffee.com when clicked.
 */
export function CoffeeButton() {
    return (
        <a
            href={COFFEE_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="Support me on Buy me a coffee!"
            className="group fixed right-[18px] bottom-[18px] z-50 flex items-center gap-3 focus-visible:outline-none"
        >
            <span className="pointer-events-none max-w-60 translate-x-1 rounded-xl border border-edge bg-card px-3 py-2 text-[12.5px] leading-snug text-card-foreground opacity-0 shadow-lg transition-all group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100">
                {MESSAGE}
            </span>
            <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-[#FFDD04] text-[#0D0C22] shadow-lg transition-transform group-hover:scale-105 group-focus-visible:ring-[3px] group-focus-visible:ring-[#FFDD04]/50">
                <Coffee className="size-6" strokeWidth={2.2} />
            </span>
        </a>
    );
}
