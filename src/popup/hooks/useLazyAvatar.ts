import {
    AVATAR_KEY,
    parsePickedAvatar,
    type PickedAvatar,
} from "@/shared/avatar";
import { useEffect, useState } from "react";

/** The avatar picked in the popup, live. Null until one is picked. */
export function useLazyAvatar(): PickedAvatar | null {
    const [pick, setPick] = useState<PickedAvatar | null>(null);

    useEffect(() => {
        let active = true;
        chrome.storage.local.get(AVATAR_KEY).then(
            (stored) => {
                if (active) setPick(parsePickedAvatar(stored[AVATAR_KEY]));
            },
            () => {},
        );
        const onChanged = (
            changes: Record<string, chrome.storage.StorageChange>,
            area: string,
        ): void => {
            const change = changes[AVATAR_KEY];
            if (area === "local" && change) {
                setPick(parsePickedAvatar(change.newValue));
            }
        };
        chrome.storage.onChanged.addListener(onChanged);
        return () => {
            active = false;
            chrome.storage.onChanged.removeListener(onChanged);
        };
    }, []);

    return pick;
}
