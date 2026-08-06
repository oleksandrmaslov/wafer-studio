// Modified by Oleksandr Maslov for Wafer Studio, 2026.
// Based on ZMK Studio, licensed under Apache-2.0.
// SPDX-License-Identifier: Apache-2.0

import fs from "fs/promises";
import path from "path";
import url from "url";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.resolve(__filename, "../..");

/**
 * Where the desktop builds come from.
 *
 * This used to read `zmkfirmware/zmk-studio`, which meant the download page
 * offered upstream ZMK Studio installers under this product's name. Wafer
 * Studio publishes its own. Overridable so a fork can point somewhere else
 * without editing the script.
 */
const REPO =
  process.env.WAFER_RELEASE_REPO || "oleksandrmaslov/wafer-studio";

const DATA_FILE = path.resolve(__dirname, "src", "data", "release-data.json");

/**
 * What the page renders when there is nothing to offer yet.
 *
 * Written on *every* failure rather than leaving the previous file in place,
 * and that is the deliberate part: a stale file here is worse than an empty
 * one, because its contents were a different project's installers. The page
 * has a real empty state, so "no builds published yet" is something it can say.
 */
const EMPTY = {
  tag_name: null,
  html_url: `https://github.com/${REPO}/releases`,
  assets: [],
};

async function write(data) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(data));
}

async function generateReleaseData() {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${REPO}/releases/latest`,
      {
        headers: process.env.GITHUB_TOKEN
          ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
          : {},
      },
    );

    if (!response.ok) {
      throw new Error(`GitHub returned ${response.status}`);
    }

    const data = await response.json();
    await write({
      tag_name: data.tag_name ?? null,
      html_url: data.html_url ?? EMPTY.html_url,
      assets: (data.assets ?? []).map((asset) => ({
        name: asset.name,
        browser_download_url: asset.browser_download_url,
        size: asset.size,
      })),
    });
    console.log(`Release data generated from ${REPO} (${data.tag_name}).`);
  } catch (error) {
    // Never fatal. This runs ahead of both `dev` and `build`, so a repository
    // with no releases yet — or simply no network — must not stop someone
    // working on the application. It is a download page, not a dependency.
    console.warn(
      `Release data unavailable (${error.message}); writing the empty state.`,
    );
    await write(EMPTY);
  }
}

generateReleaseData();
