/*
 * Vencord, a Discord client mod
 * Copyright (c) 2023 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { Channel } from "@vencord/discord-types";
import { ChannelStore, Menu } from "@webpack/common";

const SMALL_CAPS: Record<string, string> = {
    "ᴀ": "a", "ʙ": "b", "ᴄ": "c", "ᴅ": "d", "ᴇ": "e", "ꜰ": "f", "ɢ": "g", "ʜ": "h", "ɪ": "i", "ᴊ": "j",
    "ᴋ": "k", "ʟ": "l", "ᴍ": "m", "ɴ": "n", "ᴏ": "o", "ᴘ": "p", "ǫ": "q", "ʀ": "r", "ꜱ": "s", "ᴛ": "t",
    "ᴜ": "u", "ᴠ": "v", "ᴡ": "w", "x": "x", "ʏ": "y", "ᴢ": "z",
};

const ORIGINAL_NAME = Symbol("cleanChannelName.original");

let editingChannelId: string | null = null;

const settings = definePluginSettings({
    ignoredChannels: {
        type: OptionType.STRING,
        description: "Comma separated list of channel IDs to leave untouched.",
        default: "",
    },
});

let ignoredRaw = "";
let ignored: string[] = [];

function getIgnored() {
    if (settings.plain.ignoredChannels !== ignoredRaw) {
        ignoredRaw = settings.plain.ignoredChannels;
        ignored = ignoredRaw.split(",").map(id => id.trim()).filter(Boolean);
    }
    return ignored;
}

const patchChannelContextMenu: NavContextMenuPatchCallback = (children, { channel }: { channel: Channel; }) => {
    const list = getIgnored();
    const isIgnored = list.includes(channel.id);

    const group = findGroupChildrenByChildId("mark-channel-read", children) ?? children;
    group.push(
        <Menu.MenuCheckboxItem
            id="vc-clean-channel-name-ignore"
            label="Keep Original Name"
            checked={isIgnored}
            action={() => {
                settings.store.ignoredChannels = (isIgnored ? list.filter(id => id !== channel.id) : [...list, channel.id]).join(",");
                ChannelStore.emitChange();
            }}
        />
    );
};

function computeClean(name: string, type: number): string {
    const separator = [2, 4].includes(type) ? " " : "-";
    const cleaned = name
        .normalize("NFKC")
        .replace(/[ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀꜱᴛᴜᴠᴡxʏᴢ]/g, m => SMALL_CAPS[m])
        .replace(/[^ -~]?\p{Extended_Pictographic}[^ -~]?/ug, "")
        .replace(/-?\|-?/g, separator)
        .replace(/-?[^\p{Letter} -~]-?/ug, separator)
        .replace(/-+/g, "-")
        .replace(/(^-|-$)/g, "");
    return cleaned || name;
}

export default definePlugin({
    name: "CleanChannelName",
    authors: [Devs.AutumnVN],
    description: "Remove emoji and decoration from channel names. Reverts to the original while you're editing the channel.",
    tags: ["Appearance", "Customisation", "Chat", "Emotes", "Servers"],
    settings,
    patches: [
        {
            find: "loadAllGuildAndPrivateChannelsFromDisk(){",
            replacement: {
                match: /(?<=getChannel\(\i\)\{if\(null!=\i\)return )\i\(\i\)/,
                replace: "$self.cleanChannelName($&)",
            },
        },
    ],

    contextMenus: {
        "channel-context": patchChannelContextMenu,
        "thread-context": patchChannelContextMenu,
    },

    flux: {
        CHANNEL_SETTINGS_INIT({ channelId }: { channelId: string; }) {
            editingChannelId = channelId;
            ChannelStore.emitChange();
        },
        CHANNEL_SETTINGS_CLOSE() {
            editingChannelId = null;
            ChannelStore.emitChange();
        },
    },

    cleanChannelName(channel?: Channel) {
        if (channel == null) return channel;
        const c = channel as any;

        if (c[ORIGINAL_NAME] !== undefined) return channel;

        c[ORIGINAL_NAME] = channel.name;

        Object.defineProperty(channel, "name", {
            configurable: true,
            enumerable: true,
            get() {
                if (editingChannelId === channel.id || getIgnored().includes(channel.id)) return c[ORIGINAL_NAME];
                return computeClean(c[ORIGINAL_NAME], channel.type);
            },
            set(value: string) {
                c[ORIGINAL_NAME] = value;
            },
        });

        return channel;
    },
});
