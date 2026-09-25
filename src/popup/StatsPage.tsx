import logo from "@/assets/logo.png";
import { CoffeeButton } from "@/popup/components/CoffeeButton";
import { MonthChart } from "@/popup/components/MonthChart";
import { ThemeToggle } from "@/popup/components/ThemeToggle";
import { StatCard } from "@/popup/components/TodayStats";
import { Card } from "@/popup/components/ui/card";
import { useMonthStats } from "@/popup/hooks/useMonthStats";
import { useTheme } from "@/popup/hooks/useTheme";
import { LAZYBOARD_URL } from "@/shared/lazyboard";
import { formatDuration, type DailyStats } from "@/shared/stats";
import { ChevronsDown, Clock, Play, Trophy } from "lucide-react";
import { useMemo, useState } from "react";

function sum(days: ReadonlyArray<{ stats: DailyStats }>): DailyStats {
    return days.reduce(
        (total, { stats }) => ({
            shortsWatched: total.shortsWatched + stats.shortsWatched,
            watchSeconds: total.watchSeconds + stats.watchSeconds,
            autoScrolled: total.autoScrolled + stats.autoScrolled,
        }),
        { shortsWatched: 0, watchSeconds: 0, autoScrolled: 0 },
    );
}

function hasActivity(stats: DailyStats): boolean {
    return stats.shortsWatched + stats.watchSeconds + stats.autoScrolled > 0;
}

/** The current month's counters, opened in its own tab from the popup. */
export function StatsPage() {
    const [theme, setTheme] = useTheme();
    const [month] = useState(() => new Date());
    const days = useMonthStats(month);

    const total = useMemo(() => sum(days ?? []), [days]);
    const activeDays = useMemo(
        () => (days ?? []).filter(({ stats }) => hasActivity(stats)).reverse(),
        [days],
    );
    // Averages cover the days so far, not the whole month.
    const daysSoFar = new Date().getDate();
    const perDay = (value: number): number => Math.round(value / daysSoFar);

    return (
        <main className="mx-auto max-w-4xl px-4 pt-12 pb-24 sm:px-6">
            <header className="flex items-center gap-3">
                <img
                    src={logo}
                    alt=""
                    className="size-11 shrink-0 rounded-xl bg-secondary"
                />
                <div className="min-w-0 flex-1">
                    <h1 className="text-[22px] leading-tight font-semibold tracking-tight">
                        {month.toLocaleDateString(undefined, {
                            month: "long",
                            year: "numeric",
                        })}
                    </h1>
                    <p className="text-[13px] leading-snug text-muted-foreground">
                        Shorts for the Lazy, this month so far.
                    </p>
                </div>
                <a
                    href={LAZYBOARD_URL}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Global Lazyboard (opens in a new tab)"
                    className="flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-edge bg-card px-3 text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                    <Trophy
                        className="size-3.5 text-primary"
                        strokeWidth={2}
                    />
                    <span className="hidden sm:inline">Global Lazyboard</span>
                </a>
                <ThemeToggle value={theme} onChange={setTheme} />
            </header>

            {/* Nothing below the header until storage answers, so no zeros flash. */}
            {!days ? null : (
                <div className="mt-6 space-y-6">
                    <div className="grid gap-3 sm:grid-cols-3">
                        <StatCard
                            icon={Play}
                            value={total.shortsWatched.toLocaleString()}
                            label="Shorts watched"
                            detail={`${perDay(total.shortsWatched).toLocaleString()} a day`}
                        />
                        <StatCard
                            icon={Clock}
                            value={formatDuration(total.watchSeconds)}
                            label="Watch time"
                            detail={`${formatDuration(perDay(total.watchSeconds))} a day`}
                        />
                        <StatCard
                            icon={ChevronsDown}
                            value={total.autoScrolled.toLocaleString()}
                            label="Auto-scrolled"
                            detail={`${perDay(total.autoScrolled).toLocaleString()} a day`}
                        />
                    </div>

                    <section className="space-y-2">
                        <h2 className="px-0.5 text-[15px] leading-tight font-semibold tracking-tight">
                            Day by day
                        </h2>
                        <Card className="gap-0 rounded-md border-edge p-4 shadow-none">
                            <MonthChart days={days} />
                        </Card>
                    </section>

                    {activeDays.length > 0 ? (
                        <section className="space-y-2">
                            <h2 className="px-0.5 text-[15px] leading-tight font-semibold tracking-tight">
                                Daily breakdown
                            </h2>
                            <Card className="gap-0 overflow-x-auto rounded-md border-edge py-0 shadow-none">
                                <table className="w-full text-[13px]">
                                    <thead className="text-left text-[12px] text-muted-foreground">
                                        <tr className="border-b border-border">
                                            <th className="px-4 py-2.5 font-medium">
                                                Day
                                            </th>
                                            <th className="px-4 py-2.5 text-right font-medium">
                                                Shorts watched
                                            </th>
                                            <th className="px-4 py-2.5 text-right font-medium">
                                                Watch time
                                            </th>
                                            <th className="px-4 py-2.5 text-right font-medium">
                                                Auto-scrolled
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border tabular-nums">
                                        {activeDays.map(({ date, stats }) => (
                                            <tr key={date.getDate()}>
                                                <td className="px-4 py-2.5 whitespace-nowrap">
                                                    {date.toLocaleDateString(
                                                        undefined,
                                                        {
                                                            weekday: "short",
                                                            month: "short",
                                                            day: "numeric",
                                                        },
                                                    )}
                                                </td>
                                                <td className="px-4 py-2.5 text-right">
                                                    {stats.shortsWatched.toLocaleString()}
                                                </td>
                                                <td className="px-4 py-2.5 text-right">
                                                    {formatDuration(
                                                        stats.watchSeconds,
                                                    )}
                                                </td>
                                                <td className="px-4 py-2.5 text-right">
                                                    {stats.autoScrolled.toLocaleString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </Card>
                        </section>
                    ) : null}

                    <p className="text-center text-[12px] text-muted-foreground">
                        Only the current month is kept. Earlier months are
                        cleared automatically. Nothing leaves your browser
                        unless you join the Lazyboard. A Short counts once
                        you've watched half of it.
                    </p>
                </div>
            )}
            <CoffeeButton />
        </main>
    );
}
