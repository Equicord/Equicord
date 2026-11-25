/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import { createStore, entries, set } from "@api/DataStore";
import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import type { Channel, Guild } from "@vencord/discord-types";
import { ChannelActions, lodash, Menu, SelectedGuildStore, showToast } from "@webpack/common";

import { getVoiceCategories, openEmptyVoiceModal } from "./EmptyVoiceModal";

export interface IgnoredIds {
    channels: string[];
    categories: string[];
}

const ignoredStore = createStore("EmptyVoiceFinder", "ignored");
const ignoredByGuild = new Map<string, IgnoredIds>();

export const settings = definePluginSettings({
    ignoreAfk: {
        type: OptionType.BOOLEAN,
        description: "Skip the server's AFK channel.",
        default: true
    },
    includeStages: {
        type: OptionType.BOOLEAN,
        description: "Include stage channels.",
        default: false
    },
    randomChannel: {
        type: OptionType.BOOLEAN,
        description: "Join a random empty channel instead of the first one.",
        default: false
    }
});

export function getIgnored(guildId: string): IgnoredIds {
    return ignoredByGuild.get(guildId) ?? { channels: [], categories: [] };
}

export function toggleIgnored(guildId: string, key: keyof IgnoredIds, id: string) {
    const ignored = getIgnored(guildId);
    const ids = ignored[key];
    const updated: IgnoredIds = {
        ...ignored,
        [key]: ids.includes(id) ? ids.filter(ignoredId => ignoredId !== id) : [...ids, id]
    };

    ignoredByGuild.set(guildId, updated);
    set(guildId, updated, ignoredStore);
    return updated;
}

function joinEmptyVoiceChannel(guildId: string) {
    const ignored = getIgnored(guildId);
    const channels = getVoiceCategories(guildId)
        .filter(category => !ignored.categories.includes(category.id))
        .flatMap(category => category.channels)
        .filter(({ id, userCount }) => userCount === 0 && !ignored.channels.includes(id));
    const channel = settings.store.randomChannel ? lodash.sample(channels) : channels[0];

    if (channel) {
        ChannelActions.selectVoiceChannel(channel.id);
    } else {
        showToast({ text: "No empty voice channels found" });
    }
}

const GuildContextMenu: NavContextMenuPatchCallback = (children, { guild }: { guild?: Guild; }) => {
    if (!guild) return;

    findGroupChildrenByChildId("privacy", children)?.push(
        <Menu.MenuItem
            id="vc-empty-voice-finder-join"
            label="Join Empty Voice Channel"
            action={() => joinEmptyVoiceChannel(guild.id)}
        />,
        <Menu.MenuItem
            id="vc-empty-voice-finder-open"
            label="Find Empty Voice Channels"
            action={() => openEmptyVoiceModal(guild.id)}
        />
    );
};

const ChannelContextMenu: NavContextMenuPatchCallback = (children, { channel }: { channel?: Channel; }) => {
    if (!channel || !(channel.isGuildVocal() || channel.isCategory())) return;

    const key = channel.isCategory() ? "categories" : "channels";
    const isIgnored = getIgnored(channel.guild_id)[key].includes(channel.id);
    const group = findGroupChildrenByChildId("mark-channel-read", children) ?? children;

    group.push(
        <Menu.MenuItem
            id="vc-empty-voice-finder-ignore"
            label={isIgnored ? "Unignore in Empty Voice Finder" : "Ignore in Empty Voice Finder"}
            action={() => toggleIgnored(channel.guild_id, key, channel.id)}
        />
    );
};

export default definePlugin({
    name: "EmptyVoiceFinder",
    description: "Join an empty voice channel or browse the empty ones by category.",
    tags: ["Servers", "Voice"],
    authors: [EquicordDevs.ypb],
    settings,
    contextMenus: {
        "guild-context": GuildContextMenu,
        "channel-context": ChannelContextMenu,
        "channel-category-context": ChannelContextMenu
    },
    toolboxActions: {
        "Find Empty Voice Channels"() {
            const guildId = SelectedGuildStore.getGuildId();

            if (guildId) {
                openEmptyVoiceModal(guildId);
            } else {
                showToast({ text: "Open a server first." });
            }
        }
    },
    async start() {
        for (const [guildId, ignored] of await entries<string, IgnoredIds>(ignoredStore)) {
            ignoredByGuild.set(guildId, ignored);
        }
    }
});
