import buyMeACoffee from "@/assets/buymeacoffee.svg";
import hamikenLogo from "@/assets/hamiken.png";
import { version } from "@/popup/components/FooterNote";
import { LazyboardSection } from "@/popup/components/LazyboardSection";
import { PlaybackSection } from "@/popup/components/PlaybackSection";
import { SettingSection } from "@/popup/components/SettingSection";
import { ShortcutRecorder } from "@/popup/components/ShortcutRecorder";
import { StepperRow } from "@/popup/components/StepperRow";
import { Button } from "@/popup/components/ui/button";
import { useBrowserShortcut } from "@/popup/hooks/useBrowserShortcut";
import type { ThemePreference } from "@/popup/lib/theme";
import { cn } from "@/popup/lib/utils";
import {
    SESSION_MINUTES_OPTIONS,
    SESSION_SHORTS_OPTIONS,
    SKIP_LONGER_OPTIONS,
    SKIP_SHORTER_OPTIONS,
    type Settings,
} from "@/shared/settings";
import type { Shortcut } from "@/shared/shortcut";
import {
    ExternalLink,
    Monitor,
    Moon,
    Sun,
    type LucideIcon,
} from "lucide-react";
import { useCallback } from "react";

const MAKER_URL = "https://apps.hamiken.com";
const COFFEE_URL = "https://www.buymeacoffee.com/kentjdev";

/** "Off", "45s", "1m 30s", "2m". */
function formatSeconds(seconds: number): string {
    if (seconds === 0) return "Off";
    if (seconds < 60) return `${seconds}s`;
    const rest = seconds % 60;
    return rest ? `${Math.floor(seconds / 60)}m ${rest}s` : `${seconds / 60}m`;
}

/** "Off", "45 min", "1h 30m", "2h". */
function formatMinutes(minutes: number): string {
    if (minutes === 0) return "Off";
    if (minutes < 60) return `${minutes} min`;
    const rest = minutes % 60;
    return rest ? `${Math.floor(minutes / 60)}h ${rest}m` : `${minutes / 60}h`;
}

/** The pills under the heading, each scrolling to one section below. */
const SECTION_LINKS: ReadonlyArray<{ id: string; label: string }> = [
    { id: "settings-skip", label: "Skip" },
    { id: "settings-session", label: "Session" },
    { id: "settings-appearance", label: "Appearance" },
    { id: "settings-shortcut", label: "Shortcut" },
    { id: "settings-lazyboard", label: "Lazyboard" },
    { id: "settings-support", label: "Support" },
];

const PLAYBACK_LINK = { id: "settings-playback", label: "Playback" };

const THEME_OPTIONS: ReadonlyArray<{
    value: ThemePreference;
    label: string;
    icon: LucideIcon;
}> = [
    { value: "system", label: "System", icon: Monitor },
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
];

interface SettingsViewProps {
    settings: Settings;
    save: (patch: Partial<Settings>) => Promise<void>;
    theme: ThemePreference;
    onThemeChange: (next: ThemePreference) => void;
    /**
     * Also shows the Playback section. The Settings tab needs it; the popup
     * keeps Playback on its home view instead.
     */
    showPlayback?: boolean;
}

export function SettingsView({
    settings,
    save,
    theme,
    onThemeChange,
    showPlayback = false,
}: SettingsViewProps) {
    const browserShortcut = useBrowserShortcut();
    const saveShortcut = useCallback(
        (shortcut: Shortcut | null) => void save({ shortcut }),
        [save],
    );

    return (
        <div className="space-y-3.5">
            <div className="px-0.5">
                <h2 className="text-[19px] leading-tight font-semibold tracking-tight">
                    Settings
                </h2>
                <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
                    Your rules, your name, your look, your shortcut.
                </p>
                <nav
                    aria-label="Settings sections"
                    className="mt-2.5 flex flex-wrap gap-1.5"
                >
                    {(showPlayback
                        ? [PLAYBACK_LINK, ...SECTION_LINKS]
                        : SECTION_LINKS
                    ).map(({ id, label }) => (
                        <button
                            key={id}
                            type="button"
                            onClick={() =>
                                document.getElementById(id)?.scrollIntoView({
                                    behavior: "smooth",
                                    block: "start",
                                })
                            }
                            className="cursor-pointer rounded-full border border-edge bg-secondary px-2.5 py-1 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-tint-brand hover:text-tint-brand-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                        >
                            {label}
                        </button>
                    ))}
                </nav>
            </div>

            {showPlayback ? (
                <PlaybackSection settings={settings} save={save} />
            ) : null}

            <SettingSection
                id="settings-skip"
                title="Skip Shorts"
                description="Moves past a Short right away when its length at your speed is outside these limits."
            >
                {/* Each list only offers values that leave some Shorts to watch. */}
                <StepperRow
                    label="Shorter than"
                    value={settings.skipShorterThan}
                    options={SKIP_SHORTER_OPTIONS.filter(
                        (seconds) =>
                            !settings.skipLongerThan ||
                            seconds < settings.skipLongerThan,
                    )}
                    format={formatSeconds}
                    onChange={(skipShorterThan) =>
                        void save({ skipShorterThan })
                    }
                />
                <StepperRow
                    label="Longer than"
                    value={settings.skipLongerThan}
                    options={SKIP_LONGER_OPTIONS.filter(
                        (seconds) =>
                            seconds === 0 || seconds > settings.skipShorterThan,
                    )}
                    format={formatSeconds}
                    onChange={(skipLongerThan) => void save({ skipLongerThan })}
                />
            </SettingSection>

            <SettingSection
                id="settings-session"
                title="Session Limit"
                description="Stops auto-scroll after whichever comes first. Turning it back on starts a new session."
            >
                <StepperRow
                    label="Shorts"
                    value={settings.sessionShorts}
                    options={SESSION_SHORTS_OPTIONS}
                    format={(count) => (count === 0 ? "Off" : String(count))}
                    onChange={(sessionShorts) => void save({ sessionShorts })}
                />
                <StepperRow
                    label="Watch time"
                    value={settings.sessionMinutes}
                    options={SESSION_MINUTES_OPTIONS}
                    format={formatMinutes}
                    onChange={(sessionMinutes) => void save({ sessionMinutes })}
                />
            </SettingSection>

            <SettingSection
                id="settings-appearance"
                title="Appearance"
                description="System follows your device's light or dark setting."
            >
                <div
                    role="radiogroup"
                    aria-label="Theme"
                    className="grid grid-cols-3 gap-1.5 px-3 py-2.5"
                >
                    {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
                        const selected = theme === value;
                        return (
                            <button
                                key={value}
                                type="button"
                                role="radio"
                                aria-checked={selected}
                                onClick={() => onThemeChange(value)}
                                className={cn(
                                    "flex cursor-pointer items-center justify-center gap-1.5 rounded-full border border-edge px-2 py-1.5 text-[12.5px] transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                                    selected
                                        ? "bg-tint-brand font-medium text-tint-brand-foreground"
                                        : "bg-secondary text-muted-foreground hover:text-foreground",
                                )}
                            >
                                <Icon className="size-3.5" strokeWidth={2} />
                                {label}
                            </button>
                        );
                    })}
                </div>
            </SettingSection>

            <SettingSection
                id="settings-shortcut"
                title="Keyboard Shortcut"
                description="Pause or resume auto-scroll without opening this popup."
            >
                <ShortcutRecorder
                    shortcut={settings.shortcut}
                    onChange={saveShortcut}
                />
                {/*
          Chrome's own command shortcut also works outside YouTube tabs, but
          Chrome only lets people change it on its shortcuts page.
        */}
                <div className="flex items-center gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] leading-tight">
                            Browser-wide shortcut
                        </p>
                        <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">
                            {browserShortcut
                                ? `${browserShortcut} works in any tab. Optional, set in Chrome.`
                                : "Optional. Works in any tab, set in Chrome."}
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        className="border-edge"
                        onClick={() =>
                            void chrome.tabs.create({
                                url: "chrome://extensions/shortcuts",
                            })
                        }
                    >
                        Open
                    </Button>
                </div>
            </SettingSection>

            <div id="settings-lazyboard" className="scroll-mt-3">
                <LazyboardSection savedName={settings.lazyName} />
            </div>

            <SettingSection
                id="settings-support"
                title="Support"
                description="Enjoying the laziness? Fuel the next update."
                cardClassName="bg-[#FFDD00]"
            >
                {/* Bundled like the logo, so nothing loads until it's clicked. */}
                <a
                    href={COFFEE_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="flex justify-center rounded-md px-3 py-2.5 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                    <img
                        src={buyMeACoffee}
                        alt="Buy me a coffee"
                        className="h-10 w-auto transition-transform hover:scale-[1.03]"
                    />
                </a>
            </SettingSection>

            <SettingSection title="Maker">
                {/* The logo ships with the extension; only clicking opens the site. */}
                <a
                    href={MAKER_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                    <img
                        src={hamikenLogo}
                        alt=""
                        className="size-9 shrink-0 object-contain"
                    />
                    <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] leading-tight font-medium">
                            Hamiken
                        </p>
                        <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">
                            apps.hamiken.com
                        </p>
                    </div>
                    <ExternalLink
                        className="size-4 shrink-0 text-muted-foreground"
                        strokeWidth={2}
                    />
                </a>
            </SettingSection>

            <p className="text-center text-[11px] text-muted-foreground">
                Shorts for the Lazy {version()}
            </p>
        </div>
    );
}
