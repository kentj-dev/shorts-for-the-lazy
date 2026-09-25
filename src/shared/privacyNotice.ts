/**
 * The Lazyboard privacy notice shown before joining. The server keeps the
 * canonical text of every version (lazyboard/api/privacy/<version>.md) and
 * records which version each person agreed to, so the words here must match
 * that file. To change them, publish a new version on the server first.
 */

export const PRIVACY_NOTICE_VERSION = "2026-09-25";

export type NoticeIcon =
    | "send"
    | "never"
    | "public"
    | "country"
    | "ip"
    | "record"
    | "leave"
    | "inactive";

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
            "Your Lazy Name and the avatar (emoji and colour) you pick.",
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
            "Your Lazy Name, avatar, counts and points appear on the public Lazyboard for anyone to see. Your country appears too, but only if you choose to show it.",
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
            "We do not store your IP address. Like any website, our server sees it when your extension connects, and uses it only to validate and verify requests and to block abuse. It is never saved to our database or written to our logs. To limit how often requests can be made, we keep a scrambled (hashed) form of it in memory for at most an hour, then it is forgotten. Cloudflare, which carries traffic to our server, handles it only to deliver your requests.",
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
    {
        icon: "inactive",
        title: "Inactivity",
        points: [
            "If your extension doesn't sync with the Lazyboard for 45 days in a row (for example, you stop watching Shorts or remove the extension), we delete your name and stats automatically, just as if you had left. We keep only the record that you agreed and when it was removed. You can join again anytime.",
        ],
    },
];
