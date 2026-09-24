import { useEffect, useState } from "react";

export interface TabStatus {
    title: string;
    hint: string;
    active: boolean;
}

const CHECKING: TabStatus = { title: "Checking...", hint: "", active: false };
const STATUS_TIMEOUT_MS = 1200;

async function readTabStatus(enabled: boolean): Promise<TabStatus> {
    if (!enabled) {
        return {
            title: "Auto-scroll is off",
            hint: "Turn it on to advance Shorts automatically.",
            active: false,
        };
    }

    let tab: chrome.tabs.Tab | undefined;
    try {
        [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    } catch {
        return {
            title: "Unavailable",
            hint: "Couldn't read the active tab.",
            active: false,
        };
    }
    if (!tab?.id || !tab.url?.startsWith("https://www.youtube.com/shorts/")) {
        return {
            title: "No Short open",
            hint: "Open a YouTube Short to start.",
            active: false,
        };
    }

    try {
        const response = (await Promise.race([
            chrome.tabs.sendMessage(tab.id, { type: "GET_STATUS" }),
            new Promise((_, reject) =>
                setTimeout(
                    () => reject(new Error("Status request timed out")),
                    STATUS_TIMEOUT_MS,
                ),
            ),
        ])) as { videoDetected?: boolean } | undefined;
        return response?.videoDetected
            ? {
                  title: "Active",
                  hint: "Scrolling when this Short ends.",
                  active: true,
              }
            : {
                  title: "Waiting for video",
                  hint: "The Short hasn't started playing yet.",
                  active: false,
              };
    } catch {
        return {
            title: "Refresh the YouTube tab",
            hint: "The extension can't reach this page yet.",
            active: false,
        };
    }
}

/** What auto-scroll is doing in the active tab, re-read when it is toggled. */
export function useTabStatus(enabled: boolean | undefined): TabStatus {
    const [status, setStatus] = useState<TabStatus>(CHECKING);

    useEffect(() => {
        if (enabled === undefined) return undefined;
        let active = true;
        void readTabStatus(enabled).then((next) => {
            if (active) setStatus(next);
        });
        return () => {
            active = false;
        };
    }, [enabled]);

    return status;
}
