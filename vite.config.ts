// Modified by Oleksandr Maslov for Wafer Studio, 2026.
// Based on ZMK Studio, licensed under Apache-2.0.
// SPDX-License-Identifier: Apache-2.0

import { readFileSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";

// package.json is the version release-please bumps, so it is the one the About
// dialog should quote. Read rather than imported: a JSON import here would need
// import attributes, which vary by Node version, for no benefit.
const appVersion: string = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8")
).version;

// Project pages live under /<repo>/, so the base is supplied by CI rather than
// hard-coded — a repository rename should not require a source change. Keep the
// default root base for local development and Tauri builds.
const base = process.env.VITE_BASE_PATH ?? "/";

// Canonical and Open Graph URLs have to be absolute even in a local or Tauri
// build, so this falls back to the production origin rather than to a path.
// A relative canonical would also trip Vite's asset scanner, which treats
// `link[href]` as something it should resolve and emit.
const PRODUCTION_ORIGIN = "https://oleksandrmaslov.github.io";
const siteOrigin = (process.env.VITE_SITE_ORIGIN ?? PRODUCTION_ORIGIN).replace(
  /\/$/,
  ""
);
const siteUrl = `${siteOrigin}${base}`;

// Only the deployed site should hand crawlers a robots.txt and a sitemap. A
// Tauri bundle has no use for either, and CI is the only caller that sets this.
const isSiteBuild = Boolean(process.env.VITE_SITE_ORIGIN);

// The pages Google should hold. The design-system page is deliberately absent:
// it is an internal reference and carries a noindex tag of its own.
const indexablePages = ["", "download.html"];

// Search engines only look for robots.txt and sitemap.xml at fixed paths, and
// both need the deployed origin, which is not known until build time. Emitting
// them here keeps the deploy URL in exactly one place instead of duplicating it
// into checked-in static files that go stale on the next rename.
function seoFiles(): Plugin {
  return {
    name: "wafer-seo-files",
    generateBundle() {
      if (!isSiteBuild) return;

      const lastmod = new Date().toISOString().slice(0, 10);
      const urls = indexablePages
        .map(
          (page) =>
            `  <url>\n    <loc>${siteUrl}${page}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`
        )
        .join("\n");

      this.emitFile({
        type: "asset",
        fileName: "sitemap.xml",
        source:
          '<?xml version="1.0" encoding="UTF-8"?>\n' +
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
          `${urls}\n` +
          "</urlset>\n",
      });

      this.emitFile({
        type: "asset",
        fileName: "robots.txt",
        source:
          "User-agent: *\n" +
          "Allow: /\n" +
          `Disallow: ${base}design.html\n` +
          "\n" +
          `Sitemap: ${siteUrl}sitemap.xml\n`,
      });
    },
    // Must be `pre`. Vite's own build-html plugin walks the document looking
    // for assets to emit, and runs decodeURI over every href it finds. It gets
    // to `%SITE_URL%` before a default-order hook could substitute it, and
    // `%SI` is not a valid escape sequence, so the build dies on "URI
    // malformed". Substituting first leaves it an ordinary absolute URL, which
    // the scanner skips as external.
    transformIndexHtml: {
      order: "pre",
      handler(html: string) {
        return html.replaceAll("%SITE_URL%", siteUrl);
      },
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  base,
  plugins: [react(), seoFiles()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  // prevent vite from obscuring rust errors
  clearScreen: false,
  // Tauri expects a fixed port, fail if that port is not available
  server: {
    strictPort: true,
  },
  // to access the Tauri environment variables set by the CLI with information about the current target
  envPrefix: [
    "VITE_",
    "TAURI_PLATFORM",
    "TAURI_ARCH",
    "TAURI_FAMILY",
    "TAURI_PLATFORM_VERSION",
    "TAURI_PLATFORM_TYPE",
    "TAURI_DEBUG",
  ],
  build: {
    // Tauri uses Chromium on Windows and WebKit on macOS and Linux
    target: process.env.TAURI_PLATFORM == "windows" ? "chrome105" : "safari13",
    // don't minify for debug builds
    minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
    // produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_DEBUG,
    // include the download and design-system pages
    rollupOptions: {
      input: {
        main: "./index.html",
        download: "./download.html",
        design: "./design.html",
      },
    },
  },
});
