/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DataStore } from "@api/index";

import plugins from "~plugins";
import gitHash from "~git-hash";

export interface ChangelogEntry {
    hash: string;
    author: string;
    message: string;
    timestamp?: number;
}

export interface UpdateSession {
    id: string;
    timestamp: number;
    fromHash: string;
    toHash: string;
    commits: ChangelogEntry[];
    newPlugins: string[];
    updatedPlugins: string[];
    newSettings?: Map<string, string[]>;
}

export type ChangelogHistory = UpdateSession[];

const CHANGELOG_HISTORY_KEY = "EquicordChangelog_History";
const LAST_SEEN_HASH_KEY = "EquicordChangelog_LastSeenHash";
const KNOWN_PLUGINS_KEY = "EquicordChangelog_KnownPlugins";
const KNOWN_SETTINGS_KEY = "EquicordChangelog_KnownSettings";

type KnownPluginSettingsMap = Map<string, Set<string>>;

export async function getChangelogHistory(): Promise<ChangelogHistory> {
    const history = (await DataStore.get(
        CHANGELOG_HISTORY_KEY,
    )) as ChangelogHistory;
    return history || [];
}

export async function saveUpdateSession(
    commits: ChangelogEntry[],
    newPlugins: string[],
    updatedPlugins: string[],
    newSettings: Map<string, string[]>,
): Promise<void> {
    const history = await getChangelogHistory();
    const lastSeenHash = await getLastSeenHash();
    const currentHash = gitHash;

    // Don't save if no changes
    if (
        commits.length === 0 &&
        newPlugins.length === 0 &&
        updatedPlugins.length === 0 &&
        newSettings.size === 0
    ) {
        return;
    }

    const session: UpdateSession = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        fromHash: lastSeenHash || "unknown",
        toHash: currentHash,
        commits,
        newPlugins,
        updatedPlugins,
        newSettings,
    };

    // Add to beginning of history (most recent first)
    history.unshift(session);

    // Keep only last 50 sessions to prevent storage bloat
    if (history.length > 50) {
        history.splice(50);
    }

    await DataStore.set(CHANGELOG_HISTORY_KEY, history);
    await setLastSeenHash(currentHash);
    await updateKnownPlugins();
    await updateKnownSettings();
}

export async function getLastSeenHash(): Promise<string | null> {
    return (await DataStore.get(LAST_SEEN_HASH_KEY)) as string | null;
}

export async function setLastSeenHash(hash: string): Promise<void> {
    await DataStore.set(LAST_SEEN_HASH_KEY, hash);
}

export async function getKnownPlugins(): Promise<Set<string>> {
    const known = (await DataStore.get(KNOWN_PLUGINS_KEY)) as string[];
    return new Set(known || []);
}

export async function updateKnownPlugins(): Promise<void> {
    const currentPlugins = Object.keys(plugins);
    await DataStore.set(KNOWN_PLUGINS_KEY, currentPlugins);
}

function getSettingsSetForPlugin(plugin: string): Set<string> {
    const settings = plugins[plugin]?.settings?.def || {};
    return new Set(
        Object.keys(settings).filter((setting) => setting !== "enabled"),
    );
}

function getCurrentSettings(pluginList: string[]): KnownPluginSettingsMap {
    return new Map(
        pluginList.map((name) => [name, getSettingsSetForPlugin(name)]),
    );
}

export async function getKnownSettings(): Promise<KnownPluginSettingsMap> {
    let map = (await DataStore.get(
        KNOWN_SETTINGS_KEY,
    )) as KnownPluginSettingsMap;
    if (map === undefined) {
        const knownPlugins = await getKnownPlugins();
        const Plugins = [...Object.keys(plugins), ...Array.from(knownPlugins)];
        map = getCurrentSettings(Plugins);
        await DataStore.set(KNOWN_SETTINGS_KEY, map);
    }
    return map;
}

export async function getNewSettings(): Promise<Map<string, string[]>> {
    const map = getCurrentSettings(Object.keys(plugins));
    const knownSettings = await getKnownSettings();
    const newSettings = new Map<string, string[]>();

    map.forEach((settings, plugin) => {
        const filteredSettings = [...settings].filter(
            (setting) => !knownSettings.get(plugin)?.has(setting),
        );
        if (filteredSettings.length > 0) {
            newSettings.set(plugin, filteredSettings);
        }
    });

    return newSettings;
}

export async function updateKnownSettings(): Promise<void> {
    const currentSettings = getCurrentSettings(Object.keys(plugins));
    const knownSettings = await getKnownSettings();
    const allSettings = new Map();

    new Set([...currentSettings.keys(), ...knownSettings.keys()]).forEach(
        (plugin) => {
            allSettings.set(
                plugin,
                new Set([
                    ...(currentSettings.get(plugin) || []),
                    ...(knownSettings.get(plugin) || []),
                ]),
            );
        },
    );

    await DataStore.set(KNOWN_SETTINGS_KEY, allSettings);
}

export async function getNewPlugins(): Promise<string[]> {
    const currentPlugins = Object.keys(plugins);
    const knownPlugins = await getKnownPlugins();

    return currentPlugins.filter(
        (plugin) =>
            !knownPlugins.has(plugin) &&
            !plugins[plugin].hidden &&
            !plugins[plugin].required,
    );
}

export async function getUpdatedPlugins(): Promise<string[]> {
    // This is a placeholder - in a real implementation, you'd track plugin version changes
    // For now, we'll return empty array since plugin version tracking would need to be implemented
    return [];
}

export async function clearChangelogHistory(): Promise<void> {
    await DataStore.del(CHANGELOG_HISTORY_KEY);
    await DataStore.del(LAST_SEEN_HASH_KEY);
    await DataStore.del(KNOWN_SETTINGS_KEY);
}

export async function initializeChangelog(): Promise<void> {
    // Initialize with current state if first time
    const lastSeenHash = await getLastSeenHash();
    if (!lastSeenHash) {
        await setLastSeenHash(gitHash);
        await updateKnownPlugins();
        await updateKnownSettings();
    }
}

export function formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 60) {
        return `${diffMinutes} minute${diffMinutes !== 1 ? "s" : ""} ago`;
    } else if (diffHours < 24) {
        return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
    } else if (diffDays < 7) {
        return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
    } else {
        return date.toLocaleDateString();
    }
}

// Development helper functions
export async function debugClearAllData(): Promise<void> {
    await DataStore.del(CHANGELOG_HISTORY_KEY);
    await DataStore.del(LAST_SEEN_HASH_KEY);
    await DataStore.del(KNOWN_PLUGINS_KEY);
    await DataStore.del(KNOWN_SETTINGS_KEY);
}

export async function debugAddMockUpdateSession(): Promise<void> {
    const mockSession: UpdateSession = {
        id: crypto.randomUUID(),
        timestamp: Date.now() - 24 * 60 * 60 * 1000, // 1 day ago
        fromHash: "abc123f",
        toHash: "def456a",
        commits: [
            {
                hash: "def456a12345678901234567890123456789",
                author: "Developer",
                message: "Add awesome new feature",
                timestamp: Date.now() - 24 * 60 * 60 * 1000,
            },
            {
                hash: "cde345b12345678901234567890123456789",
                author: "Maintainer",
                message: "Fix critical bug",
                timestamp: Date.now() - 25 * 60 * 60 * 1000,
            },
        ],
        newPlugins: ["TestPlugin", "AnotherNewPlugin"],
        updatedPlugins: ["ExistingPlugin"],
        newSettings: new Map([
            ["ExistingPlugin", ["newSetting1", "newSetting2"]],
            ["AnotherPlugin", ["coolFeature"]],
        ]),
    };

    const history = await getChangelogHistory();
    history.unshift(mockSession);
    await DataStore.set(CHANGELOG_HISTORY_KEY, history);
}

// Console debugging utilities
export const ChangelogDebug = {
    async clearAll() {
        await debugClearAllData();
        console.log("[ChangelogDebug] All changelog data cleared");
    },

    async addMockSession() {
        await debugAddMockUpdateSession();
        console.log("[ChangelogDebug] Mock update session added");
    },

    async showHistory() {
        const history = await getChangelogHistory();
        console.log("[ChangelogDebug] Changelog history:", history);
        return history;
    },

    async showKnownPlugins() {
        const plugins = await getKnownPlugins();
        console.log("[ChangelogDebug] Known plugins:", Array.from(plugins));
        return plugins;
    },

    async showNewPlugins() {
        const newPlugins = await getNewPlugins();
        console.log("[ChangelogDebug] New plugins:", newPlugins);
        return newPlugins;
    },

    async showNewSettings() {
        const newSettings = await getNewSettings();
        console.log(
            "[ChangelogDebug] New settings:",
            Object.fromEntries(newSettings),
        );
        return newSettings;
    },

    async showKnownSettings() {
        const knownSettings = await getKnownSettings();
        const obj = Object.fromEntries(
            Array.from(knownSettings.entries()).map(([key, value]) => [
                key,
                Array.from(value),
            ]),
        );
        console.log("[ChangelogDebug] Known settings:", obj);
        return knownSettings;
    },

    async reset() {
        await this.clearAll();
        await initializeChangelog();
        console.log(
            "[ChangelogDebug] Changelog system reset and reinitialized",
        );
    },

    async status() {
        const history = await getChangelogHistory();
        const knownPlugins = await getKnownPlugins();
        const newPlugins = await getNewPlugins();
        const newSettings = await getNewSettings();
        const lastSeenHash = await getLastSeenHash();

        console.log("[ChangelogDebug] Status:", {
            historyCount: history.length,
            knownPluginsCount: knownPlugins.size,
            newPluginsCount: newPlugins.length,
            newSettingsCount: newSettings.size,
            lastSeenHash,
            currentHash: gitHash.slice(0, 7),
        });

        return {
            history,
            knownPlugins,
            newPlugins,
            newSettings,
            lastSeenHash,
            currentHash: gitHash,
        };
    },
};

// Make debug utilities available globally in development
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
    (window as any).ChangelogDebug = ChangelogDebug;
}
