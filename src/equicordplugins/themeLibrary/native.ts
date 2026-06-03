/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IpcMainInvokeEvent } from "electron";
import { existsSync, writeFileSync } from "fs";
import { join, normalize } from "path";

import { THEMES_DIR } from "@main/utils/constants";
import type { Theme } from "./types";

function getThemePath(theme: Theme): string | null {
    if (typeof theme.name !== "string" || !theme.name) return null;

    const normalizedBasePath = normalize(THEMES_DIR + "/");
    const themePath = normalize(join(THEMES_DIR, `${theme.name}.theme.css`));
    return themePath.startsWith(normalizedBasePath) ? themePath : null
}

export async function themeExists(_: IpcMainInvokeEvent, theme: Theme) {
    const path = getThemePath(theme);
    return path ? existsSync(path) : false;
}

export function getThemesDir(_: IpcMainInvokeEvent, theme: Theme) {
    return getThemePath(theme);
}

export async function downloadTheme(_: IpcMainInvokeEvent, theme: Theme) {
    if (!theme.content || !theme.name || !theme.id) return;

    const path = getThemePath(theme);
    if (!path) throw new Error("Invalid theme name");

    const download = await fetch(`https://themes.equicord.org/api/download/${encodeURIComponent(theme.id)}`);
    const content = await download.text();
    writeFileSync(path, content);
}
