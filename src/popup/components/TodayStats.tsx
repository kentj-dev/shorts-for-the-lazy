import { Card } from "@/popup/components/ui/card";
import { formatDuration, type DailyStats } from "@/shared/stats";
import {
    ChartColumn,
    ChevronsDown,
    Clock,
    Play,
    type LucideIcon,
} from "lucide-react";

export function StatCard({
    icon: Icon,
    value,
    label,
    detail,
}: {
    icon: LucideIcon;
    value: string;
    label: string;
    /** A quieter line under the label, such as a daily average. */
    detail?: string;
}) {
    return (
        <Card className="min-w-0 flex-1 gap-0 rounded-md border border-edge px-3 py-3 shadow-none">
            <span className="flex size-7 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                <Icon className="size-[15px]" strokeWidth={1.9} />
            </span>
            <p className="mt-2 text-[20px] leading-none font-semibold tracking-tight">
                {value}
            </p>
            <p className="mt-1 text-[11.5px] leading-snug text-muted-foreground">
                {label}
            </p>
            {detail ? (
                <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground/80">
                    {detail}
                </p>
            ) : null}
        </Card>
    );
}

/** Today's local counters. They reset when the day turns over. */
export function TodayStats({ stats }: { stats: DailyStats }) {
    return (
        <section className="space-y-1.5">
            <div className="flex items-center justify-between px-0.5">
                <h2 className="text-[15px] leading-tight font-semibold tracking-tight">
                    Today
                </h2>
                <button
                    type="button"
                    onClick={() =>
                        void chrome.tabs.create({
                            url: chrome.runtime.getURL("popup/stats.html"),
                        })
                    }
                    className="flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                    <ChartColumn className="size-3.5" strokeWidth={2} />
                    This month
                </button>
            </div>
            <div className="flex gap-2.5">
                <StatCard
                    icon={Play}
                    value={stats.shortsWatched.toLocaleString()}
                    label="Shorts watched"
                />
                <StatCard
                    icon={Clock}
                    value={formatDuration(stats.watchSeconds)}
                    label="Watch time"
                />
                <StatCard
                    icon={ChevronsDown}
                    value={stats.autoScrolled.toLocaleString()}
                    label="Auto-scrolled"
                />
            </div>
        </section>
    );
}
