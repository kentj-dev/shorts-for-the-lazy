import { AppHeader } from "@/popup/components/AppHeader";
import { HomeView } from "@/popup/components/views/HomeView";
import { SettingsView } from "@/popup/components/views/SettingsView";
import { useSettings } from "@/popup/hooks/useSettings";
import { useTheme } from "@/popup/hooks/useTheme";
import { useState } from "react";

type View = "home" | "settings";

/** Uses the side panel's resizable width and full available height. */
function Shell({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-dvh w-full p-3">
            {children}
        </div>
    );
}

export function App() {
    const { settings, save } = useSettings();
    const [theme, setTheme] = useTheme();
    const [view, setView] = useState<View>("home");

    return (
        <Shell>
            <AppHeader
                {...(view === "home"
                    ? { onOpenSettings: () => setView("settings") }
                    : { onBack: () => setView("home") })}
            />
            {/* Nothing below the header until settings load, so no switch flips on arrival. */}
            {!settings ? null : view === "settings" ? (
                <SettingsView
                    settings={settings}
                    save={save}
                    theme={theme}
                    onThemeChange={setTheme}
                />
            ) : (
                <HomeView
                    settings={settings}
                    save={save}
                    onOpenSettings={() => setView("settings")}
                />
            )}
        </Shell>
    );
}
