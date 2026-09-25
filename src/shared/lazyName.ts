/**
 * A best-effort filter for rude or staff-looking Lazy Names, so people hear
 * about it before anything is sent. The Lazyboard server runs the same check
 * and has the final say (lazyboard/api/src/services/profanity.rs). Keep the
 * lists in sync with it.
 *
 * ANYWHERE stems are refused even inside other words, after undoing
 * look-alike swaps (0→o, 1→i, $→s, ...). WHOLE_WORDS hide inside innocent
 * words ("ass" in "class", "rape" in "grape"), so they only count as a
 * separate word of the name: split at spaces, "-", "_", digits and camelCase.
 */

const ANYWHERE = [
    "fuck", "fuk", "fck", "shit", "nigg", "niga", "fagg", "bitch", "whore", "slut", "porn",
    "paedo", "pedophil", "molest", "nazi", "hitler", "kkk", "penis", "vagina", "pussy",
    "dildo", "jizz", "cumshot", "blowjob", "handjob", "twat", "retard", "tranny", "kike",
    "orgasm", "masturbat", "naked", "sexy", "hentai", "milf", "incest", "bestiality",
    "genocide", "terroris", "suicide", "killyourself",
];

const WHOLE_WORDS = new Set([
    "ass", "arse", "asshole", "tit", "tits", "boob", "boobs", "cum", "fag", "sex", "piss",
    "prick", "bastard", "cunt", "cock", "dick", "anal", "rape", "rapist", "pedo", "spic",
    "coon", "dyke", "chink", "wank", "horny", "nude", "isis", "hoe", "hoes", "nig", "negro",
    "kill", "die", "kys", "kms", "wtf", "stfu", "xxx", "666", "69", "420",
]);

const RESERVED = ["admin", "moderator", "official", "lazyboard", "hamiken"];

const RESERVED_WHOLE = new Set([
    "mod", "root", "owner", "dev", "developer", "staff", "support", "system", "null", "undefined",
]);

const LOOK_ALIKES: Record<string, string> = {
    "0": "o", "1": "i", "!": "i", "|": "i", "3": "e", "4": "a", "@": "a",
    "5": "s", $: "s", "7": "t", "+": "t", "8": "b", "9": "g",
};

/** Lowercase, undo look-alike swaps, and drop separators. */
function squash(text: string): string {
    let out = "";
    for (const raw of text.toLowerCase()) {
        const c = LOOK_ALIKES[raw] ?? raw;
        if (/[a-z0-9]/.test(c)) out += c;
    }
    return out;
}

/** "fuuuck" → "fuck". */
function collapseRepeats(text: string): string {
    return text.replace(/(.)\1+/g, "$1");
}

/** "BigAss_man42" → ["Big", "Ass", "man", "42"]. */
function words(name: string): string[] {
    return name.match(/[A-Z]?[a-z]+|[A-Z]+(?![a-z])|[0-9]+/g) ?? [];
}

/** True when the name is rude, hateful or pretends to be staff. */
export function isOffensiveLazyName(name: string): boolean {
    const squashed = squash(name);
    const forms = [squashed, collapseRepeats(squashed), squashed.replace(/[0-9]/g, "")];

    const anywhere = (list: string[]) =>
        forms.some((form) => list.some((word) => form.includes(word)));
    if (anywhere(ANYWHERE) || anywhere(RESERVED)) return true;
    if (forms.some((form) => RESERVED_WHOLE.has(form))) return true;

    return words(name).some((word) => {
        const plain = squash(word);
        return (
            WHOLE_WORDS.has(plain) ||
            WHOLE_WORDS.has(collapseRepeats(plain)) ||
            WHOLE_WORDS.has(word.toLowerCase())
        );
    });
}
