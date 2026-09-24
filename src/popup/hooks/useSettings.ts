import { useCallback, useEffect, useRef, useState } from "react";
import {
    isLocalSettingKey,
    LOCAL_SETTING_KEYS,
    parseSettings,
    SYNC_SETTING_KEYS,
    type Settings,
} from "@/shared/settings";

export interface UseSettings {
    /** Null until the first read finishes, so nothing renders with defaults first. */
    settings: Settings | null;
    /** Writes the given fields; the storage listener brings the result back. */
    save: (patch: Partial<Settings>) => Promise<void>;
}

async function readAll(): Promise<Record<string, unknown>> {
    const [sync, local] = await Promise.all([
        chrome.storage.sync.get([...SYNC_SETTING_KEYS]),
        chrome.storage.local.get([...LOCAL_SETTING_KEYS]),
    ]);
    return { ...sync, ...local };
}

/**
 * Loads settings once, then follows chrome.storage. The subscription
 * matters even inside the popup: the keyboard shortcut, the on-page button or
 * another signed-in device can change things while it is open.
 */
export function useSettings(): UseSettings {
    const [settings, setSettings] = useState<Settings | null>(null);
    const current = useRef<Settings | null>(null);
    current.current = settings;

    useEffect(() => {
        let active = true;
        const read = (): void => {
            readAll().then(
                (raw) => {
                    if (active) setSettings(parseSettings(raw));
                },
                () => {
                    if (active) setSettings(parseSettings({}));
                },
            );
        };
        read();

        const onChanged = (
            changes: Record<string, chrome.storage.StorageChange>,
            area: string,
        ): void => {
            const keys: readonly string[] =
                area === "sync"
                    ? SYNC_SETTING_KEYS
                    : area === "local"
                      ? LOCAL_SETTING_KEYS
                      : [];
            if (keys.some((key) => key in changes)) read();
        };
        chrome.storage.onChanged.addListener(onChanged);
        return () => {
            active = false;
            chrome.storage.onChanged.removeListener(onChanged);
        };
    }, []);

    const save = useCallback(async (patch: Partial<Settings>) => {
        if ("lazyName" in patch) {
            // The name is permanent once set; re-read storage so a stale
            // popup can't slip a second name in.
            const { lazyName } = parseSettings(await readAll());
            if (lazyName || current.current?.lazyName) {
                throw new Error("Lazy Name is locked.");
            }
        }
        // Optimistic, so switches and the slider never lag behind the click.
        setSettings((prev) => (prev ? { ...prev, ...patch } : prev));

        const sync: Record<string, unknown> = {};
        const local: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(patch)) {
            (isLocalSettingKey(key) ? local : sync)[key] = value;
        }
        await Promise.all([
            Object.keys(sync).length && chrome.storage.sync.set(sync),
            Object.keys(local).length && chrome.storage.local.set(local),
        ]);
    }, []);

    return { settings, save };
}
