/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { openPrivateChannel } from "@utils/discord";
import { ChannelRouter, GuildChannelStore, GuildStore, IconUtils, NavigationRouter, RelationshipStore, SelectedGuildStore, UserStore } from "@webpack/common";

import type { PaletteCommand, PaletteListItem } from "../api/types";
import { CompassIcon, GearIcon, HashIcon, HomeIcon, ServerIcon, UserIcon } from "../ui/icons";
import { DISCORD_SETTINGS_ROUTES, openSettingsPage } from "./openSettings";

const SECTION = "Navigation";

function guildItems(): PaletteListItem[] {
    return Object.values(GuildStore.getGuilds()).map(guild => ({
        id: guild.id,
        label: guild.name,
        icon: IconUtils.getGuildIconURL({ id: guild.id, icon: guild.icon, size: 64 }) ?? ServerIcon,
        actions: [{
            id: "open",
            label: "Open Server",
            run: () => NavigationRouter.transitionToGuild(guild.id)
        }]
    }));
}

function channelItems(): PaletteListItem[] {
    const guildId = SelectedGuildStore.getGuildId();
    if (!guildId) return [];

    return GuildChannelStore.getSelectableChannels(guildId).map(({ channel }) => ({
        id: channel.id,
        label: `#${channel.name}`,
        icon: HashIcon,
        actions: [{
            id: "open",
            label: "Open Channel",
            run: () => ChannelRouter.transitionToChannel(channel.id)
        }]
    }));
}

function friendItems(): PaletteListItem[] {
    const currentUserId = UserStore.getCurrentUser().id;

    return RelationshipStore.getFriendIDs()
        .filter(id => id !== currentUserId)
        .map(id => UserStore.getUser(id))
        .filter(user => user != null)
        .map(user => ({
            id: user.id,
            label: user.globalName || user.username,
            sublabel: user.username,
            icon: IconUtils.getUserAvatarURL(user, false, 64),
            actions: [{
                id: "open",
                label: "Open DM",
                run: () => openPrivateChannel(user.id)
            }]
        }));
}

export const navigationCommands: PaletteCommand[] = [
    {
        id: "navigation.home",
        title: "Go Home",
        section: SECTION,
        keywords: ["friends", "dms", "home"],
        icon: HomeIcon,
        actions: [{
            id: "run",
            label: "Go Home",
            run: () => NavigationRouter.transitionTo("/channels/@me")
        }]
    },
    {
        id: "navigation.server",
        title: "Go to Server",
        section: SECTION,
        keywords: ["guild", "server", "jump"],
        icon: ServerIcon,
        page: () => ({
            title: "Go to Server",
            icon: ServerIcon,
            spec: { type: "list", placeholder: "Search servers...", items: guildItems }
        })
    },
    {
        id: "navigation.channel",
        title: "Go to Channel",
        section: SECTION,
        keywords: ["channel", "jump"],
        icon: HashIcon,
        predicate: () => SelectedGuildStore.getGuildId() != null,
        page: () => ({
            title: "Go to Channel",
            icon: HashIcon,
            spec: { type: "list", placeholder: "Search channels...", items: channelItems }
        })
    },
    {
        id: "navigation.dm",
        title: "Open DM",
        section: SECTION,
        keywords: ["dm", "message", "friend"],
        icon: UserIcon,
        page: () => ({
            title: "Open DM",
            icon: UserIcon,
            spec: { type: "list", placeholder: "Search friends...", items: friendItems }
        })
    },
    {
        id: "navigation.settings",
        title: "Open Settings Page",
        section: SECTION,
        keywords: ["settings", "preferences", "options"],
        icon: GearIcon,
        page: () => ({
            title: "Open Settings Page",
            icon: GearIcon,
            spec: {
                type: "list",
                placeholder: "Search settings pages...",
                items: () => DISCORD_SETTINGS_ROUTES.map(entry => ({
                    id: entry.route,
                    label: entry.label,
                    keywords: entry.keywords,
                    icon: CompassIcon,
                    actions: [{
                        id: "open",
                        label: "Open Settings Page",
                        run: () => void openSettingsPage(entry.route, entry.label)
                    }]
                }))
            }
        })
    }
];
