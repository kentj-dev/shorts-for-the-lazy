import shortsIcon from "@/assets/yt-shorts.svg";
import type { TabStatus } from "@/popup/hooks/useTabStatus";
import { cn } from "@/popup/lib/utils";

/** What auto-scroll is doing in the active tab. Informational, not a link. */
export function CurrentTabCard({ status }: { status: TabStatus }) {
    return (
        <section className="space-y-1.5">
            <h2 className="px-0.5 text-[15px] leading-tight font-semibold tracking-tight">
                Current Tab
            </h2>
            <div className="flex items-center gap-3 rounded-md border border-edge bg-card px-3 py-2.5">
                <img
                    src={shortsIcon}
                    alt=""
                    className="size-10 shrink-0 rounded-xl bg-secondary p-[7px]"
                />
                <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] leading-tight font-medium">
                        {status.title}
                    </p>
                    {status.hint ? (
                        <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                            {status.hint}
                        </p>
                    ) : null}
                </div>
                <span
                    aria-hidden="true"
                    className={cn(
                        "me-1 size-2 shrink-0 rounded-full",
                        status.active
                            ? "bg-success shadow-[0_0_0_3px_color-mix(in_srgb,var(--success)_20%,transparent)]"
                            : "bg-warning",
                    )}
                />
            </div>
        </section>
    );
}
