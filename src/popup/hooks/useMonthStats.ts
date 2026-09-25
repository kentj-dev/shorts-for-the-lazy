import { useEffect, useState } from "react";
import {
    daysInMonth,
    parseStats,
    todayStatsKey,
    type DailyStats,
} from "@/shared/stats";

export interface DayStats {
    date: Date;
    stats: DailyStats;
}

/**
 * Every day of the month `month` falls in, with its counters. Null until
 * storage answers, then live while the page is open.
 */
export function useMonthStats(month: Date): DayStats[] | null {
    const [days, setDays] = useState<DayStats[] | null>(null);

    useEffect(() => {
        let active = true;
        const dates = daysInMonth(month);
        const keys = dates.map((date) => todayStatsKey(date));

        const load = (): void => {
            chrome.storage.local.get(keys).then(
                (stored) => {
                    if (!active) return;
                    setDays(
                        dates.map((date, i) => ({
                            date,
                            stats: parseStats(stored[keys[i] ?? ""]),
                        })),
                    );
                },
                () => {},
            );
        };
        load();

        const onChanged = (
            changes: Record<string, chrome.storage.StorageChange>,
            area: string,
        ): void => {
            if (area === "local" && keys.some((key) => key in changes)) load();
        };
        chrome.storage.onChanged.addListener(onChanged);
        return () => {
            active = false;
            chrome.storage.onChanged.removeListener(onChanged);
        };
    }, [month]);

    return days;
}
