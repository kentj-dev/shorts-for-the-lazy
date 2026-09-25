/**
 * The Lazyboard privacy notice shown before joining. The server keeps the
 * canonical text of every version (lazyboard/api/privacy/<version>.md) and
 * records which version each person agreed to, so the words here must match
 * that file. To change them, publish a new version on the server first.
 */

export const PRIVACY_NOTICE_VERSION = "2026-09-25";

export type NoticeIcon =
    "send" | "never" | "public" | "country" | "ip" | "record" | "leave";

export interface NoticeSection {
    icon: NoticeIcon;
    title: string;
    points: string[];
}

export const PRIVACY_NOTICE: NoticeSection[] = [
    {
        icon: "send",
        title: "What we send",
        points: [
            "Your Lazy Name.",
            "How many Shorts you watched, your watch time, and how many auto-scrolls happened, counted from the moment you join. These are sent as totals about once an hour.",
            "A random installation ID and secret token, so your extension can prove it is you.",
        ],
    },
    {
        icon: "never",
        title: "What we never send",
        points: [
            "Which videos you watch, their titles or links.",
            "Your browsing history, Google account, or email address.",
        ],
    },
    {
        icon: "public",
        title: "What is public",
        points: [
            "Your Lazy Name, counts and points appear on the public Lazyboard for anyone to see. Your country appears too, but only if you choose to show it.",
        ],
    },
    {
        icon: "country",
        title: "Country (optional)",
        points: [
            "Showing your country is your choice, and it is off unless you turn it on. If you do, your country comes from Cloudflare, which sits in front of our server. You can turn it off anytime in Settings, and we erase it.",
        ],
    },
    {
        icon: "ip",
        title: "IP address",
        points: [
            "Like any website, our server sees your IP address when your extension connects. It is used briefly to stop abuse and is never stored.",
        ],
    },
    {
        icon: "record",
        title: "Your agreement",
        points: [
            "We keep a record of this notice's version, the time you agreed, and whether you chose to show your country.",
        ],
    },
    {
        icon: "leave",
        title: "Leaving",
        points: [
            "You can leave anytime in Settings, under Lazyboard. Leaving deletes your name and stats from our server. We keep only the record that you agreed and when you left.",
        ],
    },
];
