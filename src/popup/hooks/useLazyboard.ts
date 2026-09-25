import {
    LAZYBOARD_KEY,
    parseLazyboardState,
    type LazyboardState,
} from "@/shared/lazyboard";
import { useEffect, useState } from "react";

/**
 * The Lazyboard membership the background worker keeps in local storage.
 * Undefined while loading, null when not joined.
 */
export function useLazyboard(): LazyboardState | null | undefined {
    const [state, setState] = useState<LazyboardState | null | undefined>();

    useEffect(() => {
        let active = true;
        chrome.storage.local.get(LAZYBOARD_KEY).then(
            (stored) => {
                if (active)
                    setState(parseLazyboardState(stored[LAZYBOARD_KEY]));
            },
            () => {
                if (active) setState(null);
            },
        );
        const onChanged = (
            changes: Record<string, chrome.storage.StorageChange>,
            area: string,
        ): void => {
            const change = changes[LAZYBOARD_KEY];
            if (area === "local" && change) {
                setState(parseLazyboardState(change.newValue));
            }
        };
        chrome.storage.onChanged.addListener(onChanged);
        return () => {
            active = false;
            chrome.storage.onChanged.removeListener(onChanged);
        };
    }, []);

    return state;
}
