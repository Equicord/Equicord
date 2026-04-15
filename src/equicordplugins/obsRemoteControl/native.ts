/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { exec, spawn } from "node:child_process";
import { basename, dirname } from "node:path";
import { promisify } from "node:util";

import { IpcMainInvokeEvent } from "electron";

export async function getProcesses(_: IpcMainInvokeEvent): Promise<string | Error> {
    try {
        let cmd = "";
        switch (process.platform) {
            case "win32":
                cmd = "tasklist";
                break;
            case "linux":
                cmd = "ps -A";
                break;
            case "darwin":
                cmd = "ps -ax";
                break;
            default:
                return new Error("Unsupported platform");
        }

        const execAsync = promisify(exec);
        const { stdout, stderr } = await execAsync(cmd);
        if (stderr) {
            return new Error(stderr);
        }
        return stdout.trim();
    } catch (e) {
        if (e instanceof Error) {
            return e;
        }
        return new Error(JSON.stringify(e));
    }
}

export async function startProcess(_: IpcMainInvokeEvent, path: string, args: string[]): Promise<undefined | any> {
    return new Promise(resolve => {
        try {
            const child = spawn(basename(path), args, {
                cwd: dirname(path),
                detached: true
            });

            child.stderr?.on("data", data => {
                resolve(new Error(data));
                child.unref();
            });
            child.stdout?.on("data", () => {
                resolve(undefined);
                child.unref();
            });

            setTimeout(() => {
                resolve(new Error("Process took too long to start"));
            }, 10000);
        } catch (e) {
            resolve(e);
        }
    });
}
