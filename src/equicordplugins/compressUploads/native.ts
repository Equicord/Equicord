/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { execFile } from "child_process";
import { IpcMainInvokeEvent } from "electron";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { promisify } from "util";

declare const FFMPEG_PATH: string | null;

const run = promisify(execFile);

const PRESETS = new Set(["veryfast", "fast", "medium", "slow"]);

interface Opts {
    ffmpegPath?: string;
    crf: number;
    codec: string;
    maxHeight: number;
    preset: string;
    audioKbps: number;
    ext: string;
}

export async function compressVideo(_: IpcMainInvokeEvent, data: Uint8Array, opts: Opts) {
    const ext = /^\.[a-z0-9]{1,5}$/i.test(opts.ext) ? opts.ext : ".mp4";
    const crf = Math.min(40, Math.max(14, Math.floor(Number(opts.crf) || 20)));
    const isH265 = opts.codec === "h265";
    const maxH = Math.max(144, Math.floor(Number(opts.maxHeight) || 1080));
    const preset = PRESETS.has(opts.preset) ? opts.preset : "medium";
    const audioKbps = Math.min(320, Math.max(32, Math.floor(Number(opts.audioKbps) || 128)));

    const dir = await mkdtemp(join(tmpdir(), "compress-uploads-"));
    const input = join(dir, "in" + ext);
    const output = join(dir, "out.mp4");

    try {
        await writeFile(input, data);

        await run(opts.ffmpegPath?.trim() || FFMPEG_PATH || "ffmpeg", [
            "-y", "-i", input,
            "-vf", `scale=-2:'min(ih,${maxH})'`,
            "-c:v", isH265 ? "libx265" : "libx264", "-crf", String(crf), "-preset", preset,
            "-pix_fmt", "yuv420p", "-profile:v", isH265 ? "main" : "high",
            ...(isH265 ? ["-tag:v", "hvc1"] : []),
            "-c:a", "aac", "-b:a", `${audioKbps}k`,
            "-movflags", "+faststart",
            output
        ], { maxBuffer: 10 * 1024 * 1024 });

        const out = new Uint8Array(await readFile(output));
        return { data: out as Uint8Array | null, error: null as string | null, inSize: data.length, outSize: out.length };
    } catch (e: any) {
        return {
            data: null as Uint8Array | null,
            error: String(e?.stderr ?? e?.message ?? e).slice(-800),
            inSize: data.length,
            outSize: 0
        };
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
}
