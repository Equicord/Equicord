/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { spawn } from "child_process";
import { type IpcMainInvokeEvent } from "electron";
import { mkdtemp, readFile, rm, stat, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { isAbsolute, join, normalize } from "path";

const MAX_INPUT_BYTES = 1024 * 1024 * 1024;
const MAX_STDERR_LENGTH = 10_000;
const MAX_ATTEMPTS = 4;
const PROBE_TIMEOUT_MS = 30 * 1000;
const ENCODE_TIMEOUT_MS = 30 * 60 * 1000;

const PRESETS = new Set(["veryfast", "fast", "medium", "slow"]);

interface Opts {
    ffmpegPath?: string;
    crf: number;
    h265: boolean;
    maxHeight: number;
    preset: string;
    audioKbps: number;
    maxSize?: number;
    ext: string;
}

interface RunResult {
    code: number | null;
    stderr: string;
}

function runFFmpeg(binary: string, args: string[], timeoutMs: number): Promise<RunResult> {
    return new Promise((resolve, reject) => {
        const ffmpeg = spawn(binary, args, { windowsHide: true });
        let stderr = "";

        const timer = setTimeout(() => {
            ffmpeg.kill();
            reject(new Error(`ffmpeg did not finish within ${Math.round(timeoutMs / 1000)} seconds`));
        }, timeoutMs);

        // Keep draining stderr so ffmpeg never blocks on a full pipe, but don't hold on to all of it
        ffmpeg.stderr?.on("data", chunk => {
            if (stderr.length < MAX_STDERR_LENGTH) stderr += chunk.toString();
        });
        ffmpeg.on("error", e => {
            clearTimeout(timer);
            reject(e);
        });
        ffmpeg.on("close", code => {
            clearTimeout(timer);
            resolve({ code, stderr });
        });
    });
}

async function resolveFFmpeg(configured: string | undefined) {
    const binary = configured?.trim();
    if (!binary) return "ffmpeg";

    if (!isAbsolute(binary)) throw new Error("The ffmpeg path must be absolute");

    const path = normalize(binary);
    const file = await stat(path).catch(() => null);
    if (!file?.isFile()) throw new Error("The ffmpeg path does not point to a file");

    return path;
}

async function probeDuration(ffmpegPath: string, input: string): Promise<number | null> {
    try {
        // ffmpeg exits with an error when no output is given, but still prints the input info to stderr
        const { stderr } = await runFFmpeg(ffmpegPath, ["-hide_banner", "-nostdin", "-i", input], PROBE_TIMEOUT_MS);
        const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
        if (!match) return null;

        const seconds = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
        return seconds > 0 ? seconds : null;
    } catch {
        return null;
    }
}

function heightForBitrate(kbps: number): number {
    if (kbps >= 2500) return Infinity;
    if (kbps >= 1200) return 720;
    if (kbps >= 600) return 480;
    return 360;
}

function failure(inSize: number, error: string) {
    return { data: null, error, inSize, outSize: 0, attempts: 0, capped: false };
}

export async function compressVideo(_: IpcMainInvokeEvent, data: Uint8Array, opts: Opts) {
    if (!(data instanceof Uint8Array)) return failure(0, "Invalid video data");
    if (data.length === 0 || data.length > MAX_INPUT_BYTES) {
        return failure(data.length, `Video must be smaller than ${MAX_INPUT_BYTES / 1024 / 1024} MB`);
    }

    const ext = /^\.[a-z0-9]{1,5}$/i.test(opts.ext) ? opts.ext : ".mp4";
    const crf = Math.min(40, Math.max(14, Math.floor(Number(opts.crf) || 20)));
    const isH265 = opts.h265 === true;
    const baseMaxH = Math.max(144, Math.floor(Number(opts.maxHeight) || 1080));
    const maxSize = Number(opts.maxSize);
    const targetSize = Number.isFinite(maxSize) && maxSize > 0 ? Math.floor(maxSize * 0.97) : 0;
    const preset = PRESETS.has(opts.preset) ? opts.preset : "medium";
    const audioKbps = Math.min(320, Math.max(32, Math.floor(Number(opts.audioKbps) || 128)));

    const dir = await mkdtemp(join(tmpdir(), "compress-uploads-"));
    const input = join(dir, "in" + ext);
    const output = join(dir, "out.mp4");

    try {
        await writeFile(input, data);

        const ffmpegPath = await resolveFFmpeg(opts.ffmpegPath);

        const duration = targetSize ? await probeDuration(ffmpegPath, input) : null;

        let encodeCrf = crf;
        let fallbackMaxH = baseMaxH;
        let budget = 1;
        let attempts = 0;

        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            attempts++;
            let maxH = fallbackMaxH;
            let rateArgs: string[] = [];

            if (targetSize && duration) {
                const totalKbps = (targetSize * 8 / 1000 / duration) * budget;
                const videoKbps = Math.max(80, Math.floor(totalKbps - audioKbps));
                maxH = Math.min(baseMaxH, heightForBitrate(videoKbps));
                rateArgs = ["-maxrate", `${videoKbps}k`, "-bufsize", `${videoKbps * 2}k`];
            }

            const { code, stderr } = await runFFmpeg(ffmpegPath, [
                "-y", "-hide_banner", "-nostdin", "-loglevel", "error",
                "-i", input,
                "-vf", `scale=-2:'min(ih,${maxH})'`,
                "-c:v", isH265 ? "libx265" : "libx264", "-crf", String(encodeCrf), "-preset", preset,
                ...rateArgs,
                "-pix_fmt", "yuv420p", "-profile:v", isH265 ? "main" : "high",
                ...(isH265 ? ["-tag:v", "hvc1"] : []),
                "-c:a", "aac", "-b:a", `${audioKbps}k`,
                "-movflags", "+faststart",
                output
            ], ENCODE_TIMEOUT_MS);

            if (code !== 0) throw new Error(stderr.trim() || `ffmpeg exited with code ${code}`);
            if (!targetSize || (await stat(output)).size <= targetSize) break;

            if (duration) {
                budget *= 0.8;
            } else if (encodeCrf < 40) {
                encodeCrf = Math.min(40, encodeCrf + 5);
            } else if (fallbackMaxH > 144) {
                fallbackMaxH = Math.max(144, Math.floor(fallbackMaxH * 0.75 / 2) * 2);
                encodeCrf = crf;
            } else break;
        }

        const out = new Uint8Array(await readFile(output));
        return {
            data: out,
            error: null,
            inSize: data.length,
            outSize: out.length,
            attempts,
            capped: Boolean(duration)
        };
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return failure(data.length, message.replaceAll(dir, "<tmp>").slice(-800));
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
}
