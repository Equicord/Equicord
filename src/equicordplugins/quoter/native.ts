/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { exec as execCallback } from "child_process";
import { IpcMainInvokeEvent } from "electron";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { promisify } from "util";

const exec = promisify(execCallback);
const COMMAND_TIMEOUT = 30_000;

function quotePath(path: string): string {
    return `"${path.replaceAll("\"", "\\\"")}"`;
}

export async function convertPngToGif(_: IpcMainInvokeEvent, png: ArrayBuffer, command: string): Promise<Uint8Array> {
    const trimmedCommand = command.trim();
    if (!trimmedCommand.includes("{input}") || !trimmedCommand.includes("{output}")) {
        throw new Error("GIF command must include {input} and {output}.");
    }

    const dir = await mkdtemp(join(tmpdir(), "equicord-quoter-"));
    const input = join(dir, "input.png");
    const output = join(dir, "output.gif");

    try {
        await writeFile(input, Buffer.from(png));
        await exec(
            trimmedCommand
                .replaceAll("{input}", quotePath(input))
                .replaceAll("{output}", quotePath(output)),
            { timeout: COMMAND_TIMEOUT }
        );

        return new Uint8Array(await readFile(output));
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
}
