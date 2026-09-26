import type { Settings } from "@/shared/settings";
import { useEffect, useState } from "react";

export interface TabStatus {
    title: string;
    hint: string;
    active: boolean;
}

/** What content.js answers to GET_STATUS. */
interface ContentStatus {
    videoDetected?: boolean;
    sessionShorts?: number;
    sessionWatchSeconds?: number;
    sessionLimitReached?: boolean;
}

type StatusSettings = Pick<
    Settings,
    "enabled" | "sessionShorts" | "sessionMinutes"
>;

const CHECKING: TabStatus = { title: "Checking...", hint: "", active: false };
const STATUS_TIMEOUT_MS = 1200;

const OFF: TabStatus = {
    title: "Auto-scroll is off",
    hint: "Turn it on to advance Shorts automatically.",
    active: false,
};

/** "4 of 10 Shorts · 12 of 30 min", or "" when no limit is set. */
function sessionProgress(
    settings: StatusSettings,
    response: ContentStatus,
): string {
    const parts: string[] = [];
    if (settings.sessionShorts > 0) {
        parts.push(
            `${response.sessionShorts ?? 0} of ${settings.sessionShorts} Shorts`,
        );
    }
    if (settings.sessionMinutes > 0) {
        const minutes = Math.floor((response.sessionWatchSeconds ?? 0) / 60);
        parts.push(`${minutes} of ${settings.sessionMinutes} min`);
    }
    return parts.join(" · ");
}

async function readTabStatus(settings: StatusSettings): Promise<TabStatus> {
    let tab: chrome.tabs.Tab | undefined;
    try {
        [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    } catch {
        if (!settings.enabled) return OFF;
        return {
            title: "Unavailable",
            hint: "Couldn't read the active tab.",
            active: false,
        };
    }
    if (!tab?.id || !tab.url?.startsWith("https://www.youtube.com/shorts/")) {
        if (!settings.enabled) return OFF;
        return {
            title: "No Short open",
            hint: "Open a YouTube Short to start.",
            active: false,
        };
    }

    let response: ContentStatus | undefined;
    try {
        response = (await Promise.race([
            chrome.tabs.sendMessage(tab.id, { type: "GET_STATUS" }),
            new Promise((_, reject) =>
                setTimeout(
                    () => reject(new Error("Status request timed out")),
                    STATUS_TIMEOUT_MS,
                ),
            ),
        ])) as ContentStatus | undefined;
    } catch {
        if (!settings.enabled) return OFF;
        return {
            title: "Refresh the YouTube tab",
            hint: "The extension can't reach this page yet.",
            active: false,
        };
    }

    if (!settings.enabled) {
        return response?.sessionLimitReached
            ? {
                  title: "Session limit reached",
                  hint: "Turn auto-scroll on to start a new session.",
                  active: false,
              }
            : OFF;
    }
    if (!response?.videoDetected) {
        return {
            title: "Waiting for video",
            hint: "The Short hasn't started playing yet.",
            active: false,
        };
    }
    return {
        title: "Active",
        hint:
            sessionProgress(settings, response) ||
            "Scrolling when this Short ends.",
        active: true,
    };
}

/** What auto-scroll is doing in the active tab, re-read when settings change. */
export function useTabStatus(settings: StatusSettings | null): TabStatus {
    const [status, setStatus] = useState<TabStatus>(CHECKING);
    const enabled = settings?.enabled;
    const sessionShorts = settings?.sessionShorts ?? 0;
    const sessionMinutes = settings?.sessionMinutes ?? 0;

    useEffect(() => {
        if (enabled === undefined) return undefined;
        let active = true;
        void readTabStatus({ enabled, sessionShorts, sessionMinutes }).then(
            (next) => {
                if (active) setStatus(next);
            },
        );
        return () => {
            active = false;
        };
    }, [enabled, sessionShorts, sessionMinutes]);

    return status;
}
