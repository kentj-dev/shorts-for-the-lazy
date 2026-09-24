import { Panda } from "lucide-react";

/** Version comes from the manifest, so it can never drift from the build. */
export function version(): string {
    try {
        return `v${chrome.runtime.getManifest().version}`;
    } catch {
        return "";
    }
}

export function FooterNote() {
    return (
        <div className="flex items-center gap-2 rounded-md border border-edge bg-card px-3 py-2.5 shadow-none">
            <Panda
                className="size-3.75 shrink-0 text-muted-foreground"
                strokeWidth={1.9}
            />
            <p className="flex-1 text-[12px] text-muted-foreground">
                Less thumb work, same Shorts.
            </p>
            <span className="text-[11px] text-muted-foreground">
                {version()}
            </span>
        </div>
    );
}
