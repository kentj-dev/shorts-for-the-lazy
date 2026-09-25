/**
 * Build script for the "Shorts for the Lazy" Chrome extension.
 *
 * Each target gets its own small Vite build, because Chrome MV3 has different
 * module rules per target:
 *
 *   popup       -> HTML + React + Tailwind, ES modules (fine inside an
 *                  extension page)
 *   background  -> ES module service worker ("type": "module" in manifest)
 *   content     -> one IIFE file, because classic content scripts cannot use
 *                  import/export
 *
 * Run `node scripts/build.mjs` for a one-shot build, or add `--watch` to keep
 * every target rebuilding while you develop.
 */
import { build } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync, watch as watchFiles } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const watch = process.argv.includes("--watch");

/**
 * Where the Lazyboard lives (API under /api/v1, public page at the root).
 * Override with LAZYBOARD_URL=http://localhost:8080 for local testing, and
 * add the extension's chrome-extension:// origin to the server's CORS_ORIGINS.
 */
const lazyboardUrl = (
    process.env.LAZYBOARD_URL ?? "https://lazyboard.hamiken.com"
).replace(/\/+$/, "");
/**
 * Minutes between Lazyboard syncs. Hourly in production; set
 * LAZYBOARD_SYNC_MINUTES=1 for local testing (keep the server's
 * RL_SYNC_PER_HOUR above 60/this).
 */
const syncMinutes = Number(process.env.LAZYBOARD_SYNC_MINUTES ?? 60);
if (!(syncMinutes >= 1)) {
    throw new Error("LAZYBOARD_SYNC_MINUTES must be a number of at least 1");
}
const define = {
    __LAZYBOARD_URL__: JSON.stringify(lazyboardUrl),
    __LAZYBOARD_SYNC_MINUTES__: JSON.stringify(syncMinutes),
};

/** The content script and the service worker share these settings. */
const scriptBuild = (entry, outFile, format, globalName) => ({
    configFile: false,
    root,
    define,
    resolve: { alias: { "@": path.join(root, "src") } },
    build: {
        outDir: dist,
        emptyOutDir: false,
        target: "chrome114",
        minify: false, // readable output keeps selector debugging sane
        sourcemap: watch ? "inline" : false,
        watch: watch ? {} : null,
        lib: {
            entry: path.join(root, entry),
            formats: [format],
            fileName: () => outFile,
            name: globalName,
        },
    },
});

const popupBuild = () => ({
    configFile: false,
    root: path.join(root, "src/popup"),
    base: "./",
    define,
    resolve: { alias: { "@": path.join(root, "src") } },
    plugins: [react(), tailwindcss()],
    build: {
        outDir: path.join(dist, "popup"),
        emptyOutDir: false,
        target: "chrome114",
        sourcemap: watch ? "inline" : false,
        watch: watch ? {} : null,
        rollupOptions: {
            input: {
                popup: path.join(root, "src/popup/index.html"),
                // The monthly stats page, opened in its own tab.
                stats: path.join(root, "src/popup/stats.html"),
            },
        },
    },
});

const targets = [
    popupBuild(),
    scriptBuild(
        "src/background/background.js",
        "background.js",
        "es",
        "lazyBackground",
    ),
    scriptBuild("src/content/content.js", "content.js", "iife", "lazyContent"),
];

/**
 * Unpacked builds (`npm run dev`, `dev:local`, `build:unpacked`) get the
 * Chrome Web Store listing's public key, so Chrome gives them the store's
 * extension ID. The API's CORS_ORIGINS then works for them unchanged, with
 * no per-machine IDs to add. The store package (`npm run build`) never
 * carries the key: the store supplies the ID itself.
 *
 * extension-key.txt holds the listing's *public* key (Developer Dashboard →
 * the item → Package → "View public key"), base64 without the BEGIN/END
 * lines. It is not a secret.
 */
const unpacked = watch || process.argv.includes("--unpacked");
const keyFile = path.join(root, "extension-key.txt");

async function manifestJson() {
    const manifest = JSON.parse(
        await readFile(path.join(root, "src/manifest.json"), "utf8"),
    );
    if (unpacked) {
        const key = existsSync(keyFile)
            ? (await readFile(keyFile, "utf8"))
                  .replace(/-----[^-]+-----/g, "")
                  .replace(/\s+/g, "")
            : "";
        if (key) manifest.key = key;
        else
            console.warn(
                "\n[lazy] extension-key.txt is missing: this unpacked build gets a random ID,\n" +
                    "       so add chrome-extension://<its id> to the API's CORS_ORIGINS.",
            );
    } else if ("key" in manifest) {
        throw new Error(
            "src/manifest.json must not contain a key; the store build supplies none",
        );
    }
    return `${JSON.stringify(manifest, null, 4)}\n`;
}

/** The manifest and the images the content script and toolbar load by URL. */
async function copyStatic() {
    await mkdir(dist, { recursive: true });
    await writeFile(path.join(dist, "manifest.json"), await manifestJson());
    await cp(path.join(root, "src/images"), path.join(dist, "images"), {
        recursive: true,
    });
}

if (!watch) await rm(dist, { recursive: true, force: true });
await copyStatic();
await Promise.all(targets.map((config) => build(config)));

if (watch) {
    for (const target of ["src/manifest.json", "src/images"]) {
        watchFiles(path.join(root, target), () => void copyStatic());
    }
    console.log(
        "\n[lazy] watching. Reload the extension in chrome://extensions after changes.",
    );
} else {
    console.log(
        "\n[lazy] built dist/ — load it via chrome://extensions -> Load unpacked.",
    );
}
