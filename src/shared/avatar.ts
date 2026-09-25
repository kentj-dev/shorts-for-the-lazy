/**
 * Lazyboard avatars: one emoji on one pastel or dark colour, from fixed lists.
 * The API refuses anything else (lazyboard/api/src/services/avatar.rs) and the
 * page draws them (lazyboard/web/src/lib/avatar.ts). Keep all three in sync.
 */

/** chrome.storage.local key: the avatar picked in the popup. */
export const AVATAR_KEY = "lazyAvatar";

export interface PickedAvatar {
    emoji: string;
    color: AvatarColor;
}

/** Everything the picker offers, in the API's order. */
export const AVATAR_EMOJI = [
    "🐰",
    "🐨",
    "🦧",
    "🐼",
    "🦦",
    "🦙",
    "🦝",
    "🐧",
    "🦥",
    "🐱",
    "🐵",
    "🦊",
    "🐻",
    "🐹",
    "🦉",
    "🐯",
    "🐸",
    "🦔",
    "🐶",
    "🐷",
    "🐮",
    "🐌",
    "🐢",
    "🦄",
    "🦁",
    "🦭",
    "🦫",
    "🐭",
    "🐺",
    "🐤",
    "🐬",
    "🐙",
    "🦈",
    "🐳",
    "🦋",
    "🐝",
    "🐞",
    "🦖",
    "🐲",
    "👻",
    "👽",
    "🤖",
    "😎",
    "😴",
    "🥱",
    "🛋️",
    "🥔",
    "🍕",
    "🍩",
    "🧋",
    "🍿",
    "🎮",
    "🌙",
    "⭐",
    "🌈",
    "🍄",
    "🌵",
];

/** FNV-1a. */
function hash(text: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

/** Backgrounds by the name the API stores: pastel, then dark. */
export const AVATAR_COLORS = {
    // Pastel
    butter: "#fce38a",
    pink: "#f7b7d2",
    lavender: "#cdb8f5",
    sky: "#a8d1f5",
    peach: "#f9c99a",
    mint: "#b5e8c9",
    coral: "#f8b4b4",
    lilac: "#e4d4f7",
    // Dark
    midnight: "#1e2340",
    navy: "#1f3a5f",
    slate: "#3a4556",
    charcoal: "#2f3036",
    forest: "#1f4a38",
    plum: "#46275a",
    wine: "#5a2433",
    cocoa: "#4a3226",
} as const;

export type AvatarColor = keyof typeof AVATAR_COLORS;

/** Dark backgrounds, which need a light edge and light marks on them. */
export const DARK_COLORS: ReadonlySet<AvatarColor> = new Set([
    "midnight",
    "navy",
    "slate",
    "charcoal",
    "forest",
    "plum",
    "wine",
    "cocoa",
]);

/** Defaults stay pastel; dark ones are for people who pick them. */
const COLOR_NAMES = (Object.keys(AVATAR_COLORS) as AvatarColor[]).filter(
    (color) => !DARK_COLORS.has(color),
);

/** Animal emoji used for defaults, in the API's list. */
const ANIMAL_EMOJI = [
    "🐰",
    "🐨",
    "🦧",
    "🐼",
    "🦦",
    "🦙",
    "🦝",
    "🐧",
    "🦥",
    "🐱",
    "🐵",
    "🦊",
    "🐻",
    "🐹",
    "🦉",
    "🐯",
    "🐸",
    "🦔",
    "🐶",
    "🐷",
    "🐮",
    "🐌",
    "🐢",
    "🦄",
    "🦁",
    "🦭",
    "🦫",
    "🐭",
    "🐺",
    "🐤",
    "🐬",
];

/** Words people use in names, mapped to an emoji. */
const ALIASES: Record<string, string> = {
    bunny: "🐰",
    rabbit: "🐰",
    hare: "🐰",
    koala: "🐨",
    orangutan: "🦧",
    urangutan: "🦧",
    ape: "🦧",
    gorilla: "🦧",
    panda: "🐼",
    otter: "🦦",
    llama: "🦙",
    alpaca: "🦙",
    raccoon: "🦝",
    penguin: "🐧",
    sloth: "🦥",
    cat: "🐱",
    kitty: "🐱",
    kitten: "🐱",
    monkey: "🐵",
    tarsier: "🐵",
    lemur: "🐵",
    fox: "🦊",
    bear: "🐻",
    hamster: "🐹",
    gerbil: "🐹",
    owl: "🦉",
    tiger: "🐯",
    frog: "🐸",
    toad: "🐸",
    hedgehog: "🦔",
    dog: "🐶",
    puppy: "🐶",
    pup: "🐶",
    doggo: "🐶",
    pig: "🐷",
    piggy: "🐷",
    cow: "🐮",
    potato: "🥔",
    couch: "🛋️",
    snail: "🐌",
    slug: "🐌",
    turtle: "🐢",
    tortoise: "🐢",
    unicorn: "🦄",
    lion: "🦁",
    seal: "🦭",
    walrus: "🦭",
    beaver: "🦫",
    capybara: "🦫",
    mouse: "🐭",
    wolf: "🐺",
    chick: "🐤",
    duck: "🐤",
    dolphin: "🐬",
    octopus: "🐙",
    shark: "🦈",
    whale: "🐳",
    bee: "🐝",
    dino: "🦖",
    rex: "🦖",
    dragon: "🐲",
    ghost: "👻",
    alien: "👽",
    robot: "🤖",
    bot: "🤖",
    sleepy: "😴",
    snoozy: "😴",
    pizza: "🍕",
    donut: "🍩",
    boba: "🧋",
    popcorn: "🍿",
};

export interface AvatarLook {
    emoji: string;
    /** The flat background colour. */
    background: string;
}

/** The chosen avatar, or the name's default for anything not chosen. */
export function avatarFor(
    name: string,
    emoji?: string | null,
    color?: string | null,
): AvatarLook {
    const key = name.toLowerCase();
    // Split camelCase too: "SleepyKoala88" → sleepy, koala. Animals win over
    // moods, so check them first.
    const words = [
        ...(name.match(/[A-Z]?[a-z]+/g)?.map((w) => w.toLowerCase()) ?? []),
        ...(key.match(/[a-z]+/g) ?? []),
    ];
    const named =
        words
            .map((w) => ALIASES[w])
            .find((e) => e && ANIMAL_EMOJI.includes(e)) ??
        words.map((w) => ALIASES[w]).find(Boolean);
    const fallbackEmoji =
        named ?? ANIMAL_EMOJI[hash(key) % ANIMAL_EMOJI.length]!;
    const fallbackColor =
        COLOR_NAMES[hash(`${key}#disc`) % COLOR_NAMES.length]!;

    const chosenColor =
        color && color in AVATAR_COLORS
            ? (color as AvatarColor)
            : fallbackColor;
    return {
        emoji: emoji || fallbackEmoji,
        background: AVATAR_COLORS[chosenColor],
    };
}

/** Reads a stored pick, or null if missing or no longer allowed. */
export function parsePickedAvatar(value: unknown): PickedAvatar | null {
    if (typeof value !== "object" || value === null) return null;
    const raw = value as Record<string, unknown>;
    const emoji = typeof raw.emoji === "string" ? raw.emoji : "";
    const color = typeof raw.color === "string" ? raw.color : "";
    if (!AVATAR_EMOJI.includes(emoji) || !(color in AVATAR_COLORS)) return null;
    return { emoji, color: color as AvatarColor };
}

/** The colour name a default avatar gets, so the picker can start there. */
export function defaultPick(name: string): PickedAvatar {
    const look = avatarFor(name);
    const color = (Object.keys(AVATAR_COLORS) as AvatarColor[]).find(
        (key) => AVATAR_COLORS[key] === look.background,
    )!;
    return { emoji: look.emoji, color };
}
