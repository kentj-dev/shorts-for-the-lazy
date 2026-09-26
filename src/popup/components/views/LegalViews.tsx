import { Card } from "@/popup/components/ui/card";
import { INACTIVE_DAYS } from "@/shared/lazyboard";
import type { ReactNode } from "react";

/*
 * Bundled copies of the Lazyboard site's /privacy and /terms-of-use pages
 * (lazyboard/web/src/pages), since an extension page can't load them as
 * code. Keep both in step with those pages and with PRIVACY.md.
 */

const MAKER_URL = "https://apps.hamiken.com";
const PRIVACY_UPDATED = "26 September 2026";
const TERMS_UPDATED = "25 September 2026";

function LegalView({
    title,
    updated,
    children,
}: {
    title: string;
    updated: string;
    children: ReactNode;
}) {
    return (
        <>
            <div className="px-0.5">
                <h2 className="text-[19px] leading-tight font-semibold tracking-tight">
                    {title}
                </h2>
                <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
                    Shorts for the Lazy · Last updated {updated}
                </p>
            </div>
            <Card className="mt-6 gap-7 rounded-md border-edge px-5 py-6 text-[14px] leading-relaxed shadow-none sm:px-8 sm:py-8 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_li]:ms-5 [&_li]:list-disc [&_li]:ps-1 [&_p+p]:mt-3 [&_ul]:mt-2 [&_ul]:space-y-1.5 [&_ul+p]:mt-3">
                {children}
            </Card>
        </>
    );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section>
            <h3 className="mb-2 text-[16px] font-semibold tracking-tight">
                {title}
            </h3>
            {children}
        </section>
    );
}

function Contact() {
    return (
        <p>
            Questions? Reach the maker through{" "}
            <a href={MAKER_URL} target="_blank" rel="noreferrer">
                apps.hamiken.com
            </a>
            .
        </p>
    );
}

export function PrivacyView() {
    return (
        <LegalView title="Privacy Policy" updated={PRIVACY_UPDATED}>
            <Section title="In short">
                <p>
                    Shorts for the Lazy does not sell or share personal
                    information, never sends browsing or viewing history
                    anywhere, and collects no analytics. Everything stays in
                    your browser unless you choose to join the Lazyboard.
                </p>
            </Section>

            <Section title="In your browser">
                <p>
                    The extension reads the YouTube page only to identify the
                    active Short, monitor its playback position, and add the
                    auto-scroll control. This processing happens locally in your
                    browser.
                </p>
                <p>
                    Your preferences (auto-scroll, countdown badge, shortcut,
                    delay, playback speed, plays per Short, skip lengths,
                    session limits, pausing in background tabs, and whether to
                    save history) are stored in Chrome's synchronized extension
                    storage. Daily counters (Shorts watched, watch time, and
                    auto-scrolls) are kept in Chrome's local extension storage
                    for the current month only; earlier months are deleted
                    automatically. The light or dark appearance choice is kept
                    in the extension's local storage.
                </p>
            </Section>

            <Section title="History">
                <p>
                    Unless you turn off Save history on the History tab, the
                    extension keeps a list of up to 200 recently watched Shorts
                    (video ID, title, channel name, length, and when you watched
                    it) in Chrome's local extension storage. It is never synced
                    or sent anywhere. You can remove single entries or clear the
                    list on the History tab, and uninstalling the extension
                    deletes it.
                </p>
                <p>
                    While the History tab is open, your browser loads each
                    Short's thumbnail from YouTube's image server (i.ytimg.com),
                    the same server YouTube itself uses.
                </p>
            </Section>

            <Section title="The Lazyboard (optional)">
                <p>
                    The Lazyboard is an opt-in public leaderboard. Nothing is
                    sent until you pick a Lazy Name and agree to the Lazyboard
                    privacy notice shown in the extension. Only after that does
                    the extension send the following, about once an hour:
                </p>
                <ul>
                    <li>
                        your Lazy Name and avatar (an emoji and a background
                        colour from fixed lists);
                    </li>
                    <li>
                        the number of Shorts watched, watch time, and
                        auto-scrolls counted since you joined;
                    </li>
                    <li>
                        a random installation ID and secret token that identify
                        your installation.
                    </li>
                </ul>
                <p>
                    Video IDs, titles, links, your History list, browsing
                    history, Google account details, and email addresses are
                    never sent.
                </p>
            </Section>

            <Section title="What is public">
                <p>
                    Your Lazy Name, avatar, counts, and points are shown
                    publicly on the Lazyboard at{" "}
                    <a
                        href="https://lazyboard.hamiken.com"
                        target="_blank"
                        rel="noreferrer"
                    >
                        lazyboard.hamiken.com
                    </a>
                    . Your country is shown too, but only if you choose to.
                </p>
            </Section>

            <Section title="Country (optional)">
                <p>
                    Showing your country is off by default. Only if you turn on
                    “Show my country” does the server take your country from
                    Cloudflare's country header and show it next to your name.
                    Turning it off later erases it.
                </p>
            </Section>

            <Section title="IP addresses">
                <p>
                    The Lazyboard does not store IP addresses. Like any website,
                    the server sees the connecting IP address and uses it only
                    to validate requests and to block abuse. It is never saved
                    to the database or written to logs. For rate limiting, only
                    a keyed hash of it is held in memory for at most an hour,
                    then discarded.
                </p>
            </Section>

            <Section title="Your agreement">
                <p>
                    The server keeps a record of which notice version you agreed
                    to, when, and whether you chose to show your country.
                </p>
            </Section>

            <Section title="Leaving and inactivity">
                <p>
                    You can leave at any time in Settings → Lazyboard → Leave
                    the Lazyboard. This deletes your name and statistics from
                    the server; only the record of your agreement and the time
                    it was withdrawn is kept.
                </p>
                <p>
                    If your installation does not sync with the Lazyboard for{" "}
                    {INACTIVE_DAYS} days in a row (for example, because you
                    stopped watching Shorts or removed the extension), the
                    server deletes your name and statistics automatically, in
                    the same way as leaving. The extension tells you when this
                    has happened, and you can join again at any time.
                </p>
            </Section>

            <Section title="Where the data is kept">
                <p>
                    The Lazyboard runs on Amazon Web Services (Lightsail) in
                    Singapore. Cloudflare carries traffic to the server and
                    handles requests only to deliver them. No other third party
                    receives Lazyboard data.
                </p>
            </Section>

            <Section title="Chrome Web Store User Data Policy">
                <p>
                    The use of information received from the extension adheres
                    to the{" "}
                    <a
                        href="https://developer.chrome.com/docs/webstore/program-policies/user-data-faq"
                        target="_blank"
                        rel="noreferrer"
                    >
                        Chrome Web Store User Data Policy
                    </a>
                    , including the Limited Use requirements. The extension
                    contains no advertising, tracking, analytics, or remote
                    code.
                </p>
            </Section>

            <Section title="Changes and contact">
                <p>
                    If this policy changes, the date above is updated. Changes
                    to what the Lazyboard collects come with a new notice in the
                    extension that you are asked to agree to again.
                </p>
                <Contact />
            </Section>
        </LegalView>
    );
}

export function TermsView() {
    return (
        <LegalView title="Terms of Use" updated={TERMS_UPDATED}>
            <Section title="Agreement">
                <p>
                    These terms cover the Shorts for the Lazy browser extension
                    and the Global Lazyboard at lazyboard.hamiken.com. By
                    installing the extension or joining the Lazyboard, you agree
                    to them. If you don't agree, please uninstall the extension
                    and don't join the Lazyboard.
                </p>
            </Section>

            <Section title="The extension">
                <p>
                    Shorts for the Lazy is free. It advances YouTube Shorts
                    automatically and keeps simple statistics in your browser.
                    It is an independent project and is not affiliated with,
                    endorsed by, or sponsored by YouTube or Google. You remain
                    responsible for following YouTube's own terms of service
                    while you use it.
                </p>
            </Section>

            <Section title="The Lazyboard">
                <p>
                    Joining the Lazyboard is optional. When you join, your Lazy
                    Name, avatar, counts, and points (and your country, if you
                    choose) are shown publicly. You give permission for them to
                    be displayed there until you leave or your spot is removed.
                    The <a href="#privacy">Privacy Policy</a> explains exactly
                    what is collected and how it is handled.
                </p>
                <p>
                    Points are calculated by the server from the activity your
                    extension reports. Rankings are for fun, have no monetary
                    value, and carry no prize.
                </p>
            </Section>

            <Section title="Lazy Names">
                <p>Your Lazy Name must not:</p>
                <ul>
                    <li>
                        be offensive, hateful, sexual, or harassing, or target
                        anyone;
                    </li>
                    <li>
                        impersonate another person, the Lazyboard, or its maker;
                    </li>
                    <li>
                        contain personal information such as a real full name,
                        email address, phone number, or link.
                    </li>
                </ul>
                <p>
                    Names are filtered automatically, but filters miss things. A
                    name that breaks these rules can be removed from the
                    Lazyboard.
                </p>
            </Section>

            <Section title="Fair play">
                <p>
                    Only real watching should count. Don't modify the extension
                    or its stored data, send requests to the Lazyboard other
                    than through the extension, automate or fake activity, or
                    try to overload or break the service. The server checks
                    every sync. Activity that looks impossible can be rejected,
                    and installations that keep cheating or abusing the service
                    can be flagged or blocked without notice.
                </p>
            </Section>

            <Section title="Leaving and removal">
                <p>
                    You can leave at any time in Settings → Lazyboard → Leave
                    the Lazyboard, which deletes your name and statistics. Spots
                    with no activity for {INACTIVE_DAYS} days in a row are
                    removed automatically. You can join again at any time.
                </p>
            </Section>

            <Section title="Changes to the service">
                <p>
                    The extension and the Lazyboard may change, be paused, or
                    stop at any time. Rankings, periods, and scoring may be
                    adjusted or reset, for example to fix errors or remove
                    cheating.
                </p>
            </Section>

            <Section title="No warranty">
                <p>
                    The extension and the Lazyboard are provided “as is” and “as
                    available”, without warranties of any kind. They may not
                    always work with YouTube, which can change its pages at any
                    time, and the Lazyboard may be unavailable or contain
                    mistakes.
                </p>
            </Section>

            <Section title="Limitation of liability">
                <p>
                    To the extent the law allows, the maker is not liable for
                    any indirect, incidental, or consequential damages, or for
                    any loss of data, arising from your use of the extension or
                    the Lazyboard. Nothing in these terms limits rights you have
                    under the law that cannot be limited.
                </p>
            </Section>

            <Section title="Changes to these terms and contact">
                <p>
                    These terms may be updated; the date above shows the latest
                    version. Continuing to use the extension or the Lazyboard
                    after a change means you accept the updated terms.
                </p>
                <Contact />
            </Section>
        </LegalView>
    );
}
