import { DelayRow } from "@/popup/components/DelayRow";
import { SettingRow } from "@/popup/components/SettingRow";
import { SettingSection } from "@/popup/components/SettingSection";
import { StepperRow } from "@/popup/components/StepperRow";
import { LOOP_OPTIONS, SPEED_OPTIONS, type Settings } from "@/shared/settings";

interface PlaybackSectionProps {
    settings: Settings;
    save: (patch: Partial<Settings>) => Promise<void>;
}

/** How each Short plays. On the popup's home view and the Settings tab. */
export function PlaybackSection({ settings, save }: PlaybackSectionProps) {
    return (
        <SettingSection id="settings-playback" title="Playback">
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
            <StepperRow
                label="Speed"
                hint="The countdown and skip lengths follow it."
                value={settings.playbackSpeed}
                options={SPEED_OPTIONS}
                format={(speed) => `${speed}×`}
                onChange={(playbackSpeed) => void save({ playbackSpeed })}
            />
            <StepperRow
                label="Plays per Short"
                hint="Loops each Short before scrolling on."
                value={settings.loopCount}
                options={LOOP_OPTIONS}
                format={(count) => `${count}×`}
                onChange={(loopCount) => void save({ loopCount })}
            />
            <SettingRow
                label="Pause in background"
                hint="Pauses when you leave the tab, resumes on return."
                checked={settings.pauseWhenHidden}
                onChange={(pauseWhenHidden) => void save({ pauseWhenHidden })}
            />
        </SettingSection>
    );
}
