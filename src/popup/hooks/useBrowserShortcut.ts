import { useEffect, useState } from "react";

const COMMAND = "toggle-auto-scroll";

/**
 * Chrome's own shortcut for the toggle command, e.g. "⇧⌘S", or "" when unset.
 * Read-only: Chrome only lets people change it on chrome://extensions/shortcuts.
 * Re-read when the popup regains focus, in case it was just changed there.
 */
export function useBrowserShortcut(): string | null {
    const [shortcut, setShortcut] = useState<string | null>(null);

    useEffect(() => {
        const read = (): void => {
            chrome.commands.getAll().then(
                (commands) => {
                    setShortcut(
                        commands.find((command) => command.name === COMMAND)
                            ?.shortcut ?? "",
                    );
                },
                () => setShortcut(""),
            );
        };
        read();
        window.addEventListener("focus", read);
        return () => window.removeEventListener("focus", read);
    }, []);

    return shortcut;
}
