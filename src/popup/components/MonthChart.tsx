import type { DayStats } from "@/popup/hooks/useMonthStats";
import { cn } from "@/popup/lib/utils";
import { formatDuration, type DailyStats } from "@/shared/stats";
import { useMemo, useState } from "react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

type MetricKey = keyof DailyStats;

interface Metric {
    key: MetricKey;
    label: string;
    /** What the bar plots. Watch time is plotted in minutes for round ticks. */
    plot: (stats: DailyStats) => number;
    tick: (value: number) => string;
}

const METRICS: readonly Metric[] = [
    {
        key: "shortsWatched",
        label: "Shorts watched",
        plot: (stats) => stats.shortsWatched,
        tick: (value) => value.toLocaleString(),
    },
    {
        key: "watchSeconds",
        label: "Watch time",
        plot: (stats) => stats.watchSeconds / 60,
        tick: (value) => formatDuration(Math.round(value * 60)),
    },
    {
        key: "autoScrolled",
        label: "Auto-scrolled",
        plot: (stats) => stats.autoScrolled,
        tick: (value) => value.toLocaleString(),
    },
];

interface Row {
    day: number;
    date: Date;
    stats: DailyStats;
    /** Null for days that haven't happened yet, so no bar is drawn. */
    value: number | null;
}

function ChartTooltip({
    active,
    payload,
    metric,
}: {
    active?: boolean;
    payload?: ReadonlyArray<{ payload?: Row }>;
    metric: MetricKey;
}) {
    const row = payload?.[0]?.payload;
    if (!active || !row || row.value === null) return null;

    const lines: Array<{ key: MetricKey; label: string; value: string }> = [
        {
            key: "shortsWatched",
            label: "Shorts watched",
            value: row.stats.shortsWatched.toLocaleString(),
        },
        {
            key: "watchSeconds",
            label: "Watch time",
            value: formatDuration(row.stats.watchSeconds),
        },
        {
            key: "autoScrolled",
            label: "Auto-scrolled",
            value: row.stats.autoScrolled.toLocaleString(),
        },
    ];

    return (
        <div className="min-w-44 rounded-md border border-edge bg-card px-3 py-2 text-[12px] shadow-md">
            <p className="mb-1.5 font-medium">
                {row.date.toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                })}
            </p>
            {lines.map((line) => (
                <div
                    key={line.key}
                    className={cn(
                        "flex items-center gap-2 py-0.5",
                        line.key === metric
                            ? "text-foreground"
                            : "text-muted-foreground",
                    )}
                >
                    <span
                        className={cn(
                            "size-2 shrink-0 rounded-full",
                            line.key === metric
                                ? "bg-primary"
                                : "bg-transparent",
                        )}
                    />
                    <span className="flex-1">{line.label}</span>
                    <span className="font-medium tabular-nums">
                        {line.value}
                    </span>
                </div>
            ))}
        </div>
    );
}

/** One bar per day of the month, for whichever counter is picked. */
export function MonthChart({ days }: { days: DayStats[] }) {
    const [metricKey, setMetricKey] = useState<MetricKey>("shortsWatched");
    const metric =
        METRICS.find((candidate) => candidate.key === metricKey) ?? METRICS[0]!;

    const rows = useMemo<Row[]>(() => {
        const now = Date.now();
        return days.map(({ date, stats }) => ({
            day: date.getDate(),
            date,
            stats,
            value: date.getTime() > now ? null : metric.plot(stats),
        }));
    }, [days, metric]);

    const empty = rows.every((row) => !row.value);

    return (
        <div>
            <div
                role="radiogroup"
                aria-label="Metric"
                className="flex flex-wrap gap-1.5"
            >
                {METRICS.map(({ key, label }) => {
                    const selected = key === metricKey;
                    return (
                        <button
                            key={key}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => setMetricKey(key)}
                            className={cn(
                                "cursor-pointer rounded-full border border-edge px-3 py-1.5 text-[12.5px] transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                                selected
                                    ? "bg-tint-brand font-medium text-tint-brand-foreground"
                                    : "bg-secondary text-muted-foreground hover:text-foreground",
                            )}
                        >
                            {label}
                        </button>
                    );
                })}
            </div>

            <div className="relative mt-4 h-72">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={rows}
                        margin={{ top: 4, right: 4, bottom: 0, left: -8 }}
                        barCategoryGap={2}
                    >
                        <CartesianGrid
                            vertical={false}
                            stroke="var(--border)"
                        />
                        <XAxis
                            dataKey="day"
                            tickLine={false}
                            axisLine={{ stroke: "var(--edge)" }}
                            tick={{
                                fill: "var(--muted-foreground)",
                                fontSize: 11,
                            }}
                            interval="preserveStartEnd"
                            minTickGap={8}
                        />
                        <YAxis
                            tickLine={false}
                            axisLine={false}
                            allowDecimals={false}
                            tick={{
                                fill: "var(--muted-foreground)",
                                fontSize: 11,
                            }}
                            tickFormatter={metric.tick}
                            width={48}
                        />
                        <Tooltip
                            cursor={{ fill: "var(--accent)" }}
                            isAnimationActive={false}
                            content={(props) => (
                                <ChartTooltip
                                    active={props.active}
                                    payload={props.payload}
                                    metric={metric.key}
                                />
                            )}
                        />
                        <Bar
                            dataKey="value"
                            name={metric.label}
                            fill="var(--primary)"
                            radius={[4, 4, 0, 0]}
                            maxBarSize={22}
                            isAnimationActive={false}
                        />
                    </BarChart>
                </ResponsiveContainer>
                {empty ? (
                    <p className="absolute inset-0 flex items-center justify-center text-[13px] text-muted-foreground">
                        Nothing yet this month. Go watch some Shorts.
                    </p>
                ) : null}
            </div>
        </div>
    );
}
