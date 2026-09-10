/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { Settings } from "@api/Settings";
import { IpcEvents } from "@shared/IpcEvents";
import { SettingsStore } from "@shared/SettingsStore";
import { mergeDefaults } from "@utils/mergeDefaults";
import { ipcMain } from "electron";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

import { NATIVE_SETTINGS_FILE, RELEASE_CHANNEL, SETTINGS_DIR, SETTINGS_FILE } from "./utils/constants";

mkdirSync(SETTINGS_DIR, { recursive: true });

function readSettings<T = object>(name: string, file: string): Partial<T> {
    try {
        return JSON.parse(readFileSync(file, "utf-8"));
    } catch (err: any) {
        if (err?.code !== "ENOENT")
            console.error(`Failed to read ${name} settings`, err);

        return {};
    }
}

export interface NativeSettings {
    plugins: {
        [plugin: string]: {
            [setting: string]: any;
        };
    };
    customCspRules: Record<string, string[]>;
    separateChannelSettings: Record<string, boolean>;
}

export interface SettingsChannelInfo {
    channel: string;
    separate: boolean;
    restartNeeded: boolean;
}

const DefaultNativeSettings: NativeSettings = {
    plugins: {},
    customCspRules: {},
    separateChannelSettings: {}
};

const nativeSettings = readSettings<NativeSettings>("native", NATIVE_SETTINGS_FILE);
mergeDefaults(nativeSettings, DefaultNativeSettings);

export const NativeSettings = new SettingsStore(nativeSettings as NativeSettings);

NativeSettings.addGlobalChangeListener(() => {
    try {
        writeFileSync(NATIVE_SETTINGS_FILE, JSON.stringify(NativeSettings.plain, null, 4));
    } catch (e) {
        console.error("Failed to write native settings", e);
    }
});

const CHANNEL_SETTINGS_FILE = join(SETTINGS_DIR, `settings.${RELEASE_CHANNEL}.json`);
const canSplitChannel = RELEASE_CHANNEL !== "stable";
const shouldUseChannelFile = () => canSplitChannel && NativeSettings.store.separateChannelSettings[RELEASE_CHANNEL] === true;

let settingsFile = SETTINGS_FILE;
if (shouldUseChannelFile()) {
    if (!existsSync(CHANNEL_SETTINGS_FILE) && existsSync(SETTINGS_FILE))
        copyFileSync(SETTINGS_FILE, CHANNEL_SETTINGS_FILE);

    settingsFile = CHANNEL_SETTINGS_FILE;
}

export const RendererSettings = new SettingsStore(readSettings<Settings>("renderer", settingsFile));

function writeRendererSettings() {
    try {
        writeFileSync(settingsFile, JSON.stringify(RendererSettings.plain, null, 4));
    } catch (e) {
        console.error("Failed to write renderer settings", e);
    }
}

RendererSettings.addGlobalChangeListener(writeRendererSettings);

ipcMain.handle(IpcEvents.GET_SETTINGS_DIR, () => SETTINGS_DIR);
ipcMain.on(IpcEvents.GET_SETTINGS, e => e.returnValue = RendererSettings.plain);

ipcMain.handle(IpcEvents.SET_SETTINGS, (_, data: Settings, pathToNotify?: string) => {
    RendererSettings.setData(data, pathToNotify);
});

ipcMain.handle(IpcEvents.GET_SETTINGS_CHANNEL, (): SettingsChannelInfo => ({
    channel: RELEASE_CHANNEL,
    separate: shouldUseChannelFile(),
    restartNeeded: (settingsFile === CHANNEL_SETTINGS_FILE) !== shouldUseChannelFile()
}));

ipcMain.handle(IpcEvents.SET_SEPARATE_CHANNEL_SETTINGS, (_, enabled: boolean) => {
    if (!canSplitChannel) return;

    NativeSettings.store.separateChannelSettings[RELEASE_CHANNEL] = enabled === true;

    // Turning it off only applies on the next start, so a stale session never overwrites the shared file.
    if (enabled === true) {
        settingsFile = CHANNEL_SETTINGS_FILE;
        writeRendererSettings();
    }
});
