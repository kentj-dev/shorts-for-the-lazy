import { Card } from "@/popup/components/ui/card";
import { formatDuration, type DailyStats } from "@/shared/stats";
import { ChevronsDown, Clock, Play, type LucideIcon } from "lucide-react";

function StatCard({
    icon: Icon,
    value,
    label,
}: {
    icon: LucideIcon;
    value: string;
    label: string;
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
        </Card>
    );
}

/** Today's local counters. They reset when the day turns over. */
export function TodayStats({ stats }: { stats: DailyStats }) {
    return (
        <section className="space-y-1.5">
            <h2 className="px-0.5 text-[15px] leading-tight font-semibold tracking-tight">
                Today
            </h2>
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
