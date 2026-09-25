import { useCallback, useEffect, useState } from "react";
import {
    applyTheme,
    readThemePreference,
    saveThemePreference,
    watchSystemTheme,
    watchThemePreference,
    type ThemePreference,
} from "@/popup/lib/theme";

/**
 * The popup's appearance choice. The initial theme is already applied in
 * index.tsx before the first render; this keeps it in step afterwards.
 */
export function useTheme(): [ThemePreference, (next: ThemePreference) => void] {
    const [theme, setTheme] = useState<ThemePreference>(readThemePreference);

    useEffect(() => {
        applyTheme(theme);
        if (theme !== "system") return undefined;
        return watchSystemTheme(() => applyTheme("system"));
    }, [theme]);

    // Follow a choice made in another open extension page.
    useEffect(() => watchThemePreference(setTheme), []);

    const choose = useCallback((next: ThemePreference) => {
        saveThemePreference(next);
        setTheme(next);
    }, []);

    return [theme, choose];
}
