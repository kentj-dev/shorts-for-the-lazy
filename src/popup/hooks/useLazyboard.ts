import {
    LAZYBOARD_KEY,
    parseLazyboardState,
    parseRemovedNotice,
    REMOVED_KEY,
    type LazyboardState,
    type RemovedNotice,
} from "@/shared/lazyboard";
import { useEffect, useState } from "react";

/**
 * One chrome.storage.local key, parsed and kept live. Undefined while
 * loading; a failed read counts as missing.
 */
function useLocalValue<T>(
    key: string,
    parse: (value: unknown) => T | null,
): T | null | undefined {
    const [value, setValue] = useState<T | null | undefined>();

    useEffect(() => {
        let active = true;
        chrome.storage.local.get(key).then(
            (stored) => {
                if (active) setValue(parse(stored[key]));
            },
            () => {
                if (active) setValue(null);
            },
        );
        const onChanged = (
            changes: Record<string, chrome.storage.StorageChange>,
            area: string,
        ): void => {
            const change = changes[key];
            if (area === "local" && change) setValue(parse(change.newValue));
        };
        chrome.storage.onChanged.addListener(onChanged);
        return () => {
            active = false;
            chrome.storage.onChanged.removeListener(onChanged);
        };
    }, [key, parse]);

    return value;
}

/**
 * The Lazyboard membership the background worker keeps in local storage.
 * Undefined while loading, null when not joined.
 */
export function useLazyboard(): LazyboardState | null | undefined {
    return useLocalValue(LAZYBOARD_KEY, parseLazyboardState);
}

/** Set when the server removed this install (usually for inactivity). */
export function useRemovedNotice(): RemovedNotice | null | undefined {
    return useLocalValue(REMOVED_KEY, parseRemovedNotice);
}

export function dismissRemovedNotice(): void {
    void chrome.storage.local.remove(REMOVED_KEY).catch(() => {});
}
