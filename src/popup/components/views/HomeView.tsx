import { AutoScrollCard } from "@/popup/components/AutoScrollCard";
import { CurrentTabCard } from "@/popup/components/CurrentTabCard";
import { FooterNote } from "@/popup/components/FooterNote";
import { PlaybackSection } from "@/popup/components/PlaybackSection";
import { QuickNav } from "@/popup/components/QuickNav";
import { TodayStats } from "@/popup/components/TodayStats";
import { useTabStatus } from "@/popup/hooks/useTabStatus";
import { useTodayStats } from "@/popup/hooks/useTodayStats";
import type { Settings } from "@/shared/settings";

interface HomeViewProps {
    settings: Settings;
    save: (patch: Partial<Settings>) => Promise<void>;
    onOpenSettings: () => void;
}

export function HomeView({ settings, save, onOpenSettings }: HomeViewProps) {
    const status = useTabStatus(settings);
    const stats = useTodayStats();

    return (
        <div className="space-y-3.5">
            <AutoScrollCard
                enabled={settings.enabled}
                onChange={(enabled) => void save({ enabled })}
            />
            <CurrentTabCard status={status} />
            <PlaybackSection settings={settings} save={save} />
            <TodayStats stats={stats} />
            <QuickNav onOpenSettings={onOpenSettings} />
            <FooterNote />
        </div>
    );
}
