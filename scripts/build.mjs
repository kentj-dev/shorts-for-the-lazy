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
import { cp, mkdir, rm } from "node:fs/promises";
import { watch as watchFiles } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const watch = process.argv.includes("--watch");

/** The content script and the service worker share these settings. */
const scriptBuild = (entry, outFile, format, globalName) => ({
    configFile: false,
    root,
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
    resolve: { alias: { "@": path.join(root, "src") } },
    plugins: [react(), tailwindcss()],
    build: {
        outDir: path.join(dist, "popup"),
        emptyOutDir: false,
        target: "chrome114",
        sourcemap: watch ? "inline" : false,
        watch: watch ? {} : null,
        rollupOptions: {
            input: path.join(root, "src/popup/index.html"),
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

/** The manifest and the images the content script and toolbar load by URL. */
async function copyStatic() {
    await mkdir(dist, { recursive: true });
    await cp(
        path.join(root, "src/manifest.json"),
        path.join(dist, "manifest.json"),
    );
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
