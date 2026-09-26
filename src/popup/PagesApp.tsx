import logo from "@/assets/logo.png";
import { PageFooter } from "@/popup/components/PageFooter";
import { PageLoader } from "@/popup/components/PageLoader";
import { ThemeToggle } from "@/popup/components/ThemeToggle";
import { HistoryView } from "@/popup/components/views/HistoryView";
import { PrivacyView, TermsView } from "@/popup/components/views/LegalViews";
import { MonthView } from "@/popup/components/views/MonthView";
import { SettingsView } from "@/popup/components/views/SettingsView";
import { useSettings } from "@/popup/hooks/useSettings";
import { useTheme } from "@/popup/hooks/useTheme";
import { pageFromHash, type PageId } from "@/popup/lib/pages";
import type { ThemePreference } from "@/popup/lib/theme";
import { cn } from "@/popup/lib/utils";
import { LAZYBOARD_URL } from "@/shared/lazyboard";
import {
    ChartColumn,
    History,
    ScrollText,
    Settings,
    ShieldCheck,
    Trophy,
    type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

const PAGES: ReadonlyArray<{
    id: PageId;
    label: string;
    title: string;
    icon: LucideIcon;
}> = [
    {
        id: "month",
        label: "This month",
        title: "This Month",
        icon: ChartColumn,
    },
    { id: "history", label: "History", title: "History", icon: History },
    { id: "settings", label: "Settings", title: "Settings", icon: Settings },
    {
        id: "privacy",
        label: "Privacy",
        title: "Privacy Policy",
        icon: ShieldCheck,
    },
    { id: "terms", label: "Terms", title: "Terms of Use", icon: ScrollText },
];

/** Follows the URL hash, so each page has its own link and Back works. */
function usePage(): PageId {
    const [page, setPage] = useState(() => pageFromHash(location.hash));
    useEffect(() => {
        const onHashChange = (): void => setPage(pageFromHash(location.hash));
        window.addEventListener("hashchange", onHashChange);
        return () => window.removeEventListener("hashchange", onHashChange);
    }, []);
    return page;
}

/** The popup's settings plus Playback, at the page's full width. */
function SettingsPage({
    theme,
    onThemeChange,
}: {
    theme: ThemePreference;
    onThemeChange: (next: ThemePreference) => void;
}) {
    const { settings, save } = useSettings();
    if (!settings) return <PageLoader />;
    return (
        <SettingsView
            settings={settings}
            save={save}
            theme={theme}
            onThemeChange={onThemeChange}
            showPlayback
        />
    );
}

/** The full-tab pages opened from the popup, with a tab bar between them. */
export function PagesApp() {
    const [theme, setTheme] = useTheme();
    const page = usePage();
    const current = PAGES.find(({ id }) => id === page) ?? PAGES[0];

    useEffect(() => {
        document.title = `${current?.title} · Shorts for the Lazy`;
        window.scrollTo(0, 0);
    }, [current]);

    return (
        <div className="flex min-h-dvh flex-col">
            <main className="mx-auto w-full max-w-4xl flex-1 px-4 pt-10 sm:px-6">
                <header className="flex items-center gap-3">
                    <img
                        src={logo}
                        alt=""
                        className="size-10 shrink-0 rounded-xl bg-secondary"
                    />
                    <p className="min-w-0 flex-1 truncate text-[16px] leading-tight font-semibold tracking-tight">
                        Shorts for the Lazy
                    </p>
                    <a
                        href={LAZYBOARD_URL}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Global Lazyboard (opens in a new tab)"
                        className="flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-edge bg-card px-3 text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                        <Trophy
                            className="size-3.5 text-primary"
                            strokeWidth={2}
                        />
                        <span className="hidden sm:inline">
                            Global Lazyboard
                        </span>
                    </a>
                    <ThemeToggle value={theme} onChange={setTheme} />
                </header>

                {/*
              The divider is an inset shadow under the tabs' underlines, so
              nothing overflows the bar. It still scrolls sideways on narrow
              windows, just without a visible scrollbar.
            */}
                <nav
                    aria-label="Pages"
                    className="mt-6 mb-7 flex gap-1 overflow-x-auto overflow-y-hidden shadow-[inset_0_-1px_0_var(--color-border)] [scrollbar-width:none]"
                >
                    {PAGES.map(({ id, label, icon: Icon }) => {
                        const selected = id === page;
                        return (
                            <a
                                key={id}
                                href={`#${id}`}
                                aria-current={selected ? "page" : undefined}
                                className={cn(
                                    "flex shrink-0 bg-card items-center rounded-t-lg gap-1.5 border-b-2 px-3 py-2 text-[13.5px] font-medium transition-colors focus-visible:rounded-t-md focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                                    selected
                                        ? "border-primary text-foreground"
                                        : "border-tint-brand text-muted-foreground hover:text-foreground",
                                )}
                            >
                                <Icon className="size-4" strokeWidth={2} />
                                {label}
                            </a>
                        );
                    })}
                </nav>

                {page === "history" ? (
                    <HistoryView />
                ) : page === "settings" ? (
                    <SettingsPage theme={theme} onThemeChange={setTheme} />
                ) : page === "privacy" ? (
                    <PrivacyView />
                ) : page === "terms" ? (
                    <TermsView />
                ) : (
                    <MonthView />
                )}
            </main>
            <PageFooter />
        </div>
    );
}
