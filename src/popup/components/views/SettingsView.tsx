import buyMeACoffee from "@/assets/buymeacoffee.svg";
import hamikenLogo from "@/assets/hamiken.png";
import { version } from "@/popup/components/FooterNote";
import { LazyboardSection } from "@/popup/components/LazyboardSection";
import { SettingSection } from "@/popup/components/SettingSection";
import { ShortcutRecorder } from "@/popup/components/ShortcutRecorder";
import { Button } from "@/popup/components/ui/button";
import { useBrowserShortcut } from "@/popup/hooks/useBrowserShortcut";
import type { ThemePreference } from "@/popup/lib/theme";
import { cn } from "@/popup/lib/utils";
import type { Settings } from "@/shared/settings";
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
}

export function SettingsView({
    settings,
    save,
    theme,
    onThemeChange,
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
                    Your name, your look, your shortcut.
                </p>
            </div>

            <LazyboardSection savedName={settings.lazyName} />

            <SettingSection
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

            <SettingSection
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
