import { useEffect, useState } from "react";
import {
    EMPTY_STATS,
    parseStats,
    todayStatsKey,
    type DailyStats,
} from "@/shared/stats";

/** Today's counters, live while the popup is open. */
export function useTodayStats(): DailyStats {
    const [stats, setStats] = useState<DailyStats>(EMPTY_STATS);

    useEffect(() => {
        let active = true;
        const key = todayStatsKey();
        chrome.storage.local.get(key).then(
            (stored) => {
                if (active) setStats(parseStats(stored[key]));
            },
            () => {},
        );

        const onChanged = (
            changes: Record<string, chrome.storage.StorageChange>,
            area: string,
        ): void => {
            if (area !== "local") return;
            const change = changes[todayStatsKey()];
            if (change) setStats(parseStats(change.newValue));
        };
        chrome.storage.onChanged.addListener(onChanged);
        return () => {
            active = false;
            chrome.storage.onChanged.removeListener(onChanged);
        };
    }, []);

    return stats;
}
