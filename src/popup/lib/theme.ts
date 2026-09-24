/**
 * Popup appearance: System, Light or Dark.
 *
 * The choice lives in the popup's own localStorage rather than chrome.storage.
 * localStorage is synchronous, so the theme is applied before React renders
 * anything and a dark popup never flashes light while settings load.
 *
 * Dark mode is a `.dark` class on <html>; src/styles/popup.css swaps the
 * palette on it. "System" follows the OS setting, including a change made
 * while the popup is open.
 */

export type ThemePreference = "system" | "light" | "dark";

export const THEME_PREFERENCES: readonly ThemePreference[] = [
    "system",
    "light",
    "dark",
];

const THEME_KEY = "lazy:theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

function isThemePreference(value: unknown): value is ThemePreference {
    return THEME_PREFERENCES.includes(value as ThemePreference);
}

export function readThemePreference(): ThemePreference {
    try {
        const stored = localStorage.getItem(THEME_KEY);
        return isThemePreference(stored) ? stored : "system";
    } catch {
        return "system";
    }
}

export function saveThemePreference(preference: ThemePreference): void {
    try {
        localStorage.setItem(THEME_KEY, preference);
    } catch {
        // Appearance still changes for this session; it just is not remembered.
    }
}

export function applyTheme(preference: ThemePreference): void {
    const dark =
        preference === "dark" ||
        (preference === "system" && window.matchMedia(DARK_QUERY).matches);
    document.documentElement.classList.toggle("dark", dark);
}

/** Calls `onChange` when the OS switches between light and dark. */
export function watchSystemTheme(onChange: () => void): () => void {
    const media = window.matchMedia(DARK_QUERY);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
}
