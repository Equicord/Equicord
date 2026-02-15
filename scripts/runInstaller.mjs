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

import { mkdirSync } from "fs";
import { join } from "path";

const BASE_URL = "https://github.com/Equicord/Equilotl/releases/latest/download/";
const INSTALLER_PATH_DARWIN = "Equilotl.app/Contents/MacOS/Equilotl";
const INSTALLER_APP_DARWIN = "Equilotl.app";

const BASE_DIR = join(import.meta.dir, "..");
const FILE_DIR = join(BASE_DIR, "dist", "Installer");
const ETAG_FILE = join(FILE_DIR, "etag.txt");

function getFilename() {
    switch (process.platform) {
        case "win32":
            return "EquilotlCli.exe";
        case "darwin":
            return "Equilotl.MacOS.zip";
        case "linux":
            return "EquilotlCli-linux";
        default:
            throw new Error("Unsupported platform: " + process.platform);
    }
}

async function ensureBinary() {
    const filename = getFilename();
    console.log("Downloading " + filename);

    mkdirSync(FILE_DIR, { recursive: true });

    const downloadName = join(FILE_DIR, filename);
    const outputFile = process.platform === "darwin"
        ? join(FILE_DIR, INSTALLER_PATH_DARWIN)
        : downloadName;
    const outputApp = process.platform === "darwin"
        ? join(FILE_DIR, INSTALLER_APP_DARWIN)
        : null;

    const etagFile = Bun.file(ETAG_FILE);
    const etag = await Bun.file(outputFile).exists() && await etagFile.exists()
        ? await etagFile.text()
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

    await Bun.write(ETAG_FILE, res.headers.get("etag"));

    if (process.platform === "darwin") {
        console.log("Saving zip...");
        await Bun.write(downloadName, new Uint8Array(await res.arrayBuffer()));

        console.log("Unzipping app bundle...");
        Bun.spawnSync(["ditto", "-x", "-k", downloadName, FILE_DIR], { stdio: ["inherit", "inherit", "inherit"] });

        console.log("Clearing quarantine from installer app (this is required to run it)");
        console.log("xattr might error, that's okay");

        const logAndRun = args => {
            console.log("Running", args.join(" "));
            try {
                Bun.spawnSync(args, { stdio: ["inherit", "inherit", "inherit"] });
            } catch { }
        };
        logAndRun(["sudo", "xattr", "-dr", "com.apple.quarantine", outputApp]);
    } else {
        await Bun.write(outputFile, new Uint8Array(await res.arrayBuffer()));
        if (process.platform !== "win32") {
            const { chmodSync } = await import("fs");
            chmodSync(outputFile, 0o755);
        }
    }

    console.log("Finished downloading!");

    return outputFile;
}



const installerBin = await ensureBinary();

console.log("Now running Installer...");

const args = process.argv.slice(2);

const result = Bun.spawnSync([installerBin, ...args], {
    stdio: ["inherit", "inherit", "inherit"],
    env: {
        ...process.env,
        EQUICORD_USER_DATA_DIR: BASE_DIR,
        EQUICORD_DIRECTORY: join(BASE_DIR, "dist/desktop"),
        EQUICORD_DEV_INSTALL: "1"
    }
});

if (!result.success) {
    console.error("Something went wrong. Please check the logs above.");
}
