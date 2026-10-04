import { useEffect, useState } from "react";
import {
    EMPTY_STATS,
    parseStats,
    todayStatsKey,
    type DailyStats,
} from "@/shared/stats";

/** Today's counters, including day changes while the side panel stays open. */
export function useTodayStats(): DailyStats {
    const [stats, setStats] = useState<DailyStats>(EMPTY_STATS);

    useEffect(() => {
        let active = true;
        let key = todayStatsKey();
        let revision = 0;
        const load = (): void => {
            const currentRevision = ++revision;
            chrome.storage.local.get(key).then(
                (stored) => {
                    if (active && currentRevision === revision) {
                        setStats(parseStats(stored[key]));
                    }
                },
                () => {},
            );
        };
        const checkDay = (): void => {
            const nextKey = todayStatsKey();
            if (key === nextKey) return;
            key = nextKey;
            setStats(EMPTY_STATS);
            load();
        };
        load();

        const onChanged = (
            changes: Record<string, chrome.storage.StorageChange>,
            area: string,
        ): void => {
            if (area !== "local") return;
            checkDay();
            const change = changes[key];
            if (change) {
                ++revision;
                setStats(parseStats(change.newValue));
            }
        };
        chrome.storage.onChanged.addListener(onChanged);
        window.addEventListener("focus", checkDay);
        const interval = window.setInterval(checkDay, 60_000);
        return () => {
            active = false;
            chrome.storage.onChanged.removeListener(onChanged);
            window.removeEventListener("focus", checkDay);
            window.clearInterval(interval);
        };
    }, []);

    return stats;
}
