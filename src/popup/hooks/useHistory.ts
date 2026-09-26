import { useCallback, useEffect, useState } from "react";
import { HISTORY_KEY, parseHistory, type RecentShort } from "@/shared/history";

export interface UseHistory {
    /** Newest first; null until storage answers. */
    history: RecentShort[] | null;
    remove: (id: string) => Promise<void>;
    clear: () => Promise<void>;
}

/** The recently watched list, live while the page is open. */
export function useHistory(): UseHistory {
    const [history, setHistory] = useState<RecentShort[] | null>(null);

    useEffect(() => {
        let active = true;
        chrome.storage.local.get(HISTORY_KEY).then(
            (stored) => {
                if (active) setHistory(parseHistory(stored[HISTORY_KEY]));
            },
            () => {
                if (active) setHistory([]);
            },
        );

        const onChanged = (
            changes: Record<string, chrome.storage.StorageChange>,
            area: string,
        ): void => {
            const change = changes[HISTORY_KEY];
            if (area === "local" && change)
                setHistory(parseHistory(change.newValue));
        };
        chrome.storage.onChanged.addListener(onChanged);
        return () => {
            active = false;
            chrome.storage.onChanged.removeListener(onChanged);
        };
    }, []);

    const remove = useCallback(async (id: string) => {
        const stored = await chrome.storage.local.get(HISTORY_KEY);
        const next = parseHistory(stored[HISTORY_KEY]).filter(
            (entry) => entry.id !== id,
        );
        await chrome.storage.local.set({ [HISTORY_KEY]: next });
    }, []);

    const clear = useCallback(
        () => chrome.storage.local.remove(HISTORY_KEY),
        [],
    );

    return { history, remove, clear };
}
