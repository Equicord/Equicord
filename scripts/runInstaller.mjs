/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2023 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import "./checkNodeVersion.js";

import { execFileSync } from "child_process";
import { createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { Readable } from "stream";
import { finished } from "stream/promises";
import { fileURLToPath } from "url";

const BASE_URL = "https://github.com/Equicord/Equilotl/releases/latest/download/";
const RELEASE_API_URL = "https://api.github.com/repos/Equicord/Equilotl/releases/latest";
const INSTALLER_CLI_DARWIN = "EquilotlCli-darwin";

const BASE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const FILE_DIR = join(BASE_DIR, "dist", "Installer");
const ETAG_FILE = join(FILE_DIR, "etag.txt");
const DARWIN_TAG_FILE = join(FILE_DIR, "darwin-cli-tag.txt");

function getFilename() {
    switch (process.platform) {
        case "win32":
            return "EquilotlCli.exe";
        case "linux":
            return "EquilotlCli-linux";
        default:
            throw new Error("Unsupported platform: " + process.platform);
    }
}

function downloadToFile(res, outputFile, mode) {
    const body = Readable.fromWeb(res.body);
    return finished(body.pipe(createWriteStream(outputFile, {
        mode,
        autoClose: true
    })));
}

async function ensureDarwinCliBinary() {
    mkdirSync(FILE_DIR, { recursive: true });

    const outputFile = join(FILE_DIR, INSTALLER_CLI_DARWIN);
    const releaseRes = await fetch(RELEASE_API_URL, {
        headers: {
            "User-Agent": "Equicord (https://github.com/Equicord/Equicord)"
        }
    });

    if (!releaseRes.ok)
        throw new Error(`Failed to fetch latest Equilotl release metadata: ${releaseRes.status} ${releaseRes.statusText}`);

    const release = await releaseRes.json();
    const latestTag = release?.tag_name;
    if (!latestTag)
        throw new Error("Latest Equilotl release metadata did not include a tag");

    const cachedTag = existsSync(DARWIN_TAG_FILE)
        ? readFileSync(DARWIN_TAG_FILE, "utf-8")
        : "";

    if (existsSync(outputFile) && cachedTag === latestTag) {
        console.log("macOS Equilotl CLI is up to date, not rebuilding!");
        return outputFile;
    }

    console.log(`Building macOS Equilotl CLI for ${latestTag}...`);

    const srcDir = join(FILE_DIR, "Equilotl-src");
    const srcArchive = join(FILE_DIR, `Equilotl-${latestTag}.tar.gz`);

    const tarballUrl = release?.tarball_url;
    if (!tarballUrl)
        throw new Error("Latest Equilotl release metadata did not include a tarball URL");

    const tarRes = await fetch(tarballUrl, {
        headers: {
            "User-Agent": "Equicord (https://github.com/Equicord/Equicord)"
        }
    });

    if (!tarRes.ok)
        throw new Error(`Failed to download Equilotl source tarball: ${tarRes.status} ${tarRes.statusText}`);

    await downloadToFile(tarRes, srcArchive);

    rmSync(srcDir, { recursive: true, force: true });
    mkdirSync(srcDir, { recursive: true });

    execFileSync("tar", ["-xzf", srcArchive, "-C", srcDir, "--strip-components=1"], {
        stdio: "inherit"
    });

    execFileSync("go", ["build", "-tags", "cli", "-o", outputFile], {
        cwd: srcDir,
        stdio: "inherit"
    });

    writeFileSync(DARWIN_TAG_FILE, latestTag);

    return outputFile;
}

async function ensureBinary() {
    if (process.platform === "darwin") {
        return ensureDarwinCliBinary();
    }

    const filename = getFilename();
    console.log("Downloading " + filename);

    mkdirSync(FILE_DIR, { recursive: true });

    const outputFile = join(FILE_DIR, filename);

    const etag = existsSync(outputFile) && existsSync(ETAG_FILE)
        ? readFileSync(ETAG_FILE, "utf-8")
        : null;

    const res = await fetch(BASE_URL + filename, {
        headers: {
            "User-Agent": "Equicord (https://github.com/Equicord/Equicord)",
            "If-None-Match": etag
        }
    });

    if (res.status === 304) {
        console.log("Up to date, not redownloading!");
        return outputFile;
    }
    if (!res.ok)
        throw new Error(`Failed to download installer: ${res.status} ${res.statusText}`);

    writeFileSync(ETAG_FILE, res.headers.get("etag"));

    // WHY DOES NODE FETCH RETURN A WEB STREAM OH MY GOD
    await downloadToFile(res, outputFile, 0o755);

    console.log("Finished downloading!");

    return outputFile;
}

const installerBin = await ensureBinary();

console.log("Now running Installer...");

const argStart = process.argv.indexOf("--");
const args = argStart === -1 ? [] : process.argv.slice(argStart + 1);

try {
    execFileSync(installerBin, args, {
        stdio: "inherit",
        env: {
            ...process.env,
            EQUICORD_USER_DATA_DIR: BASE_DIR,
            EQUICORD_DIRECTORY: join(BASE_DIR, "dist/desktop"),
            EQUICORD_DEV_INSTALL: "1"
        }
    });
} catch {
    console.error("Something went wrong. Please check the logs above.");
}
