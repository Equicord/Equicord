/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import type { Channel } from "@vencord/discord-types";
import { findByPropsLazy } from "@webpack";
import { ChannelActions, ChannelStore, Menu, PermissionsBits, PermissionStore, React } from "@webpack/common";

const ActiveThreadsStore = findByPropsLazy("getActiveUnjoinedThreadsForParent") as {
    getActiveUnjoinedThreadsForParent?: (guildId: string, parentId: string) => Record<string, unknown>;
};

const settings = definePluginSettings({
    hiddenCategories: {
        type: OptionType.CUSTOM,
        default: {} as Record<string, true>,
        description: ""
    },
    onlyRecentActiveThreads: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Show only recently active hidden threads. If disabled It'll show all threads regardless of recent activity."
    },
    recentActiveHours: {
        type: OptionType.SLIDER,
        default: 1,
        description: "Show hidden threads active within this many hours.",
        markers: [1, 2, 3, 6, 12, 24, 48, 72, 96, 120, 168],
        stickToMarkers: true,
        componentProps: {
            equidistant: true,
            onValueRender: (value: number) => `${Math.round(value)}h`
        },
        disabled() {
            return !settings.store.onlyRecentActiveThreads;
        }
    }
});

const CategoryContextMenuPatch: NavContextMenuPatchCallback = (children, { channel }) => {
    if (channel == null || channel.type !== 4) return;

    const isRevealed = settings.store.hiddenCategories[channel.id] !== true;
    children.push(React.createElement(Menu.MenuCheckboxItem, {
        id: "vc-reveal-threads-category-toggle",
        label: "Reveal Threads",
        checked: isRevealed,
        action: () => {
            if (isRevealed) {
                settings.store.hiddenCategories[channel.id] = true;
            } else {
                delete settings.store.hiddenCategories[channel.id];
            }
        }
    }));
};

export default definePlugin({
    name: "RevealThreads",
    description: "Shows most recently active threads in categories. ( Forums / Channels )",
    authors: [EquicordDevs.omaw],
    requiresRestart: true,
    settings,
    contextMenus: {
        "channel-context": CategoryContextMenuPatch
    },

    patches: [
        {
            find: '"placeholder-channel-id"',
            replacement: [
                {
                    match: /u=\((\i\|\|\i\|\|!this\.category\.isCollapsed&&!this\.isMuted\?\i\[this\.id\]:\i\[this\.id\])\)\?\?\{\}/,
                    replace: "u=$self.mergeThreadEntries(($1)??{},this.record)"
                },
                {
                    match: /\.sortBy\(Object\.values\((\i)\),(\i)=>-\2\.joinTimestamp\)\.map\((\i)=>\3\.channel\.id\)/,
                    replace: ".sortBy(Object.values($1),$2=>-$2.joinTimestamp).map($3=>$3.channel?.id??$3.id).filter(Boolean)"
                }
            ]
        },
        {
            find: /partition\(\i,\i=>\i\.\i\.hasJoined\(\i\)\)/,
            replacement: {
                match: /(\.filter\(\i\.\i\))\.filter\(\i=>\i\.\i\.can\(\i\.\i\.VIEW_CHANNEL,\i\)\)/g,
                replace: "$1.filter(e=>!$self.isHiddenChannel(e)||$self.shouldRevealThread(e))"
            }
        },
        {
            find: "activeJoinedRelevantThreads",
            replacement: [
                {
                    match: /threadIds:(\i)\(this\.record,(\i\[this\.id\]\?\?\{\}),/g,
                    replace: "threadIds:$1(this.record,$self.mergeThreadEntries($2,this.record),"
                },
                {
                    match: /return (\i\.\i\.can\(\i\.\i\.VIEW_CHANNEL,this\.record\))\?/g,
                    replace: "return ($1||($self.isHiddenChannel(this.record)&&$self.shouldRevealThread(this.record)))?"
                }
            ]
        },
        {
            find: "isAccessibleChannelOrThreadPath",
            replacement: {
                match: /(\(0,\i\.\i\)\((\i)\)\|\|\i\.\i\.isChannelGatedAndVisible\(\i,\i\))/,
                replace: "($self.shouldRevealThread($2)&&$self.isHiddenChannel($2,true))||$1"
            }
        }
    ],

    shouldRevealThread(channel: Channel) {
        if (channel == null || channel.parent_id == null) return false;

        const parentChannel = ChannelStore.getChannel(channel.parent_id);
        const categoryId = parentChannel?.parent_id;
        if (categoryId == null || settings.store.hiddenCategories[categoryId] === true) return false;
        return this.isThreadRecentEnough(channel);
    },

    mergeThreadEntries(baseEntries: Record<string, unknown>, channel: Channel) {
        const categoryId = channel.parent_id;
        if (categoryId == null || settings.store.hiddenCategories[categoryId] === true) return baseEntries;
        if (channel.guild_id == null) return baseEntries;

        const unjoinedEntries = ActiveThreadsStore?.getActiveUnjoinedThreadsForParent?.(channel.guild_id, channel.id) ?? {};
        const mergedEntries = { ...baseEntries, ...unjoinedEntries };
        return Object.fromEntries(
            Object.entries(mergedEntries).filter(([, entry]) => {
                const threadEntry = entry as { id?: string; joinTimestamp?: number; channel?: Channel & { id?: string; }; } | null | undefined;
                if (threadEntry?.id == null && threadEntry?.channel?.id == null) return false;
                const threadChannel = threadEntry.channel ?? (threadEntry.id != null ? ChannelStore.getChannel(threadEntry.id) : null);
                return this.isThreadRecentEnough(threadChannel ?? undefined, threadEntry?.joinTimestamp);
            })
        );
    },

    isThreadRecentEnough(channel?: Channel, joinTimestamp?: number) {
        if (!settings.store.onlyRecentActiveThreads) return true;

        const nowMs = Date.now();
        const thresholdMs = nowMs - settings.store.recentActiveHours * 60 * 60 * 1000;

        if (joinTimestamp != null) {
            const normalizedJoinMs = joinTimestamp > 10_000_000_000 ? joinTimestamp : joinTimestamp * 1000;
            if (normalizedJoinMs > thresholdMs) return true;
        }
        if (channel == null) return false;

        if (channel.lastMessageId != null) {
            try {
                const lastMessageMs = Number((BigInt(channel.lastMessageId) >> 22n) + 1420070400000n);
                if (lastMessageMs > thresholdMs) return true;
            } catch { }
        }

        const metadata = (channel as Channel & { threadMetadata?: { archiveTimestamp?: string; createTimestamp?: string; }; }).threadMetadata;
        if (metadata?.archiveTimestamp != null && Date.parse(metadata.archiveTimestamp) > thresholdMs) return true;
        if (metadata?.createTimestamp != null && Date.parse(metadata.createTimestamp) > thresholdMs) return true;

        return false;
    },

    isHiddenChannel(channel: Channel & { channelId?: string; }, checkConnect = false) {
        try {
            if (channel == null || Object.hasOwn(channel, "channelId") && channel.channelId == null) return false;

            if (channel.channelId != null) channel = ChannelStore.getChannel(channel.channelId);
            if (channel == null || channel.isDM() || channel.isGroupDM() || channel.isMultiUserDM()) return false;
            if (["browse", "customize", "guide"].includes(channel.id)) return false;

            return !PermissionStore.can(PermissionsBits.VIEW_CHANNEL, channel) || checkConnect && !PermissionStore.can(PermissionsBits.CONNECT, channel);
        } catch {
            return false;
        }
    }
});