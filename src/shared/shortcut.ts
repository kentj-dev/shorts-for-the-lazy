/**
 * The in-page shortcut that toggles auto-scroll on YouTube tabs.
 *
 * Chrome does not let an extension change its own `chrome.commands` keys, so
 * the popup records this one itself and content.js listens for it. Stored
 * under `shortcut` in sync storage: missing means DEFAULT_SHORTCUT, null means
 * turned off. Keep the default in step with src/content/content.js.
 */

export interface Shortcut {
    /** The physical key (KeyboardEvent.code), so layouts and Option don't matter. */
    code: string;
    ctrlKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
    metaKey: boolean;
}

export const IS_MAC = /mac|iphone|ipad/i.test(
    (navigator as Navigator & { userAgentData?: { platform?: string } })
        .userAgentData?.platform ?? navigator.platform,
);

export const DEFAULT_SHORTCUT: Shortcut = IS_MAC
    ? {
          code: "KeyS",
          ctrlKey: false,
          altKey: false,
          shiftKey: true,
          metaKey: true,
      }
    : {
          code: "KeyS",
          ctrlKey: false,
          altKey: true,
          shiftKey: true,
          metaKey: false,
      };

/** Keys that only modify another key; pressing one alone records nothing. */
const MODIFIER_CODES = new Set([
    "ShiftLeft",
    "ShiftRight",
    "ControlLeft",
    "ControlRight",
    "AltLeft",
    "AltRight",
    "MetaLeft",
    "MetaRight",
    "CapsLock",
    "Fn",
]);

export function parseShortcut(value: unknown): Shortcut | null {
    if (value === undefined) return DEFAULT_SHORTCUT;
    if (typeof value !== "object" || value === null) return null;
    const raw = value as Record<string, unknown>;
    if (typeof raw.code !== "string" || !raw.code) return null;
    return {
        code: raw.code,
        ctrlKey: Boolean(raw.ctrlKey),
        altKey: Boolean(raw.altKey),
        shiftKey: Boolean(raw.shiftKey),
        metaKey: Boolean(raw.metaKey),
    };
}

export function sameShortcut(a: Shortcut | null, b: Shortcut | null): boolean {
    if (!a || !b) return a === b;
    return (
        a.code === b.code &&
        a.ctrlKey === b.ctrlKey &&
        a.altKey === b.altKey &&
        a.shiftKey === b.shiftKey &&
        a.metaKey === b.metaKey
    );
}

export type RecordResult =
    | { kind: "pending" }
    | { kind: "invalid"; reason: string }
    | { kind: "shortcut"; shortcut: Shortcut };

/**
 * Turns a keydown into a shortcut. A bare key would fire while you type or
 * use YouTube's own keys, so a Ctrl, Alt or Cmd modifier is required.
 */
export function shortcutFromEvent(event: KeyboardEvent): RecordResult {
    if (MODIFIER_CODES.has(event.code) || !event.code)
        return { kind: "pending" };
    const shortcut: Shortcut = {
        code: event.code,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey,
        metaKey: event.metaKey,
    };
    if (!shortcut.ctrlKey && !shortcut.altKey && !shortcut.metaKey) {
        return {
            kind: "invalid",
            reason: `Include ${IS_MAC ? "⌘, ⌥ or ⌃" : "Ctrl or Alt"} so it doesn't fire while you type.`,
        };
    }
    return { kind: "shortcut", shortcut };
}

const CODE_LABELS: Record<string, string> = {
    Space: "Space",
    Enter: "Enter",
    Tab: "Tab",
    Backspace: "⌫",
    Delete: "Del",
    ArrowUp: "↑",
    ArrowDown: "↓",
    ArrowLeft: "←",
    ArrowRight: "→",
    Minus: "-",
    Equal: "=",
    BracketLeft: "[",
    BracketRight: "]",
    Backslash: "\\",
    Semicolon: ";",
    Quote: "'",
    Comma: ",",
    Period: ".",
    Slash: "/",
    Backquote: "`",
};

function keyLabel(code: string): string {
    if (code.startsWith("Key")) return code.slice(3);
    if (code.startsWith("Digit")) return code.slice(5);
    if (code.startsWith("Numpad")) return `Num ${code.slice(6)}`;
    return CODE_LABELS[code] ?? code;
}

/** Each key as its own chip: ["⌘", "⇧", "S"] on a Mac, ["Alt", "Shift", "S"] elsewhere. */
export function shortcutKeys(shortcut: Shortcut): string[] {
    const keys: string[] = [];
    if (IS_MAC) {
        if (shortcut.ctrlKey) keys.push("⌃");
        if (shortcut.altKey) keys.push("⌥");
        if (shortcut.shiftKey) keys.push("⇧");
        if (shortcut.metaKey) keys.push("⌘");
    } else {
        if (shortcut.ctrlKey) keys.push("Ctrl");
        if (shortcut.altKey) keys.push("Alt");
        if (shortcut.shiftKey) keys.push("Shift");
        if (shortcut.metaKey) keys.push("Win");
    }
    keys.push(keyLabel(shortcut.code));
    return keys;
}
