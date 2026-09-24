import { AutoScrollCard } from "@/popup/components/AutoScrollCard";
import { CurrentTabCard } from "@/popup/components/CurrentTabCard";
import { DelayRow } from "@/popup/components/DelayRow";
import { FooterNote } from "@/popup/components/FooterNote";
import { SettingRow } from "@/popup/components/SettingRow";
import { SettingSection } from "@/popup/components/SettingSection";
import { TodayStats } from "@/popup/components/TodayStats";
import { useTabStatus } from "@/popup/hooks/useTabStatus";
import { useTodayStats } from "@/popup/hooks/useTodayStats";
import type { Settings } from "@/shared/settings";

interface HomeViewProps {
    settings: Settings;
    save: (patch: Partial<Settings>) => Promise<void>;
}

export function HomeView({ settings, save }: HomeViewProps) {
    const status = useTabStatus(settings.enabled);
    const stats = useTodayStats();

    return (
        <div className="space-y-3.5">
            <AutoScrollCard
                enabled={settings.enabled}
                onChange={(enabled) => void save({ enabled })}
            />
            <CurrentTabCard status={status} />
            <SettingSection title="Playback">
                <SettingRow
                    label="Countdown badge"
                    hint="Shows the time left on the Short."
                    checked={settings.badgeEnabled}
                    onChange={(badgeEnabled) => void save({ badgeEnabled })}
                />
                <DelayRow
                    value={settings.delaySeconds}
                    onChange={(delaySeconds) => void save({ delaySeconds })}
                />
            </SettingSection>
            <TodayStats stats={stats} />
            <FooterNote />
        </div>
    );
}
